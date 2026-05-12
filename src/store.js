import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, getDocs, getDoc,
  updateDoc, deleteDoc, doc, query, orderBy, setDoc,
  where, runTransaction, increment, serverTimestamp
} from 'firebase/firestore';

// ===== Firebase設定 =====
const firebaseConfig = {
  apiKey: 'AIzaSyAx-He9tpBZ40wVnkmkktzevWthKm27AJI',
  authDomain: 'my-kakeibo-poc.firebaseapp.com',
  projectId: 'my-kakeibo-poc',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ===========================
// entries（収支明細）
// ===========================
export async function fetchEntries() {
  const q = query(collection(db, 'entries'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addEntry(data) {
  return addDoc(collection(db, 'entries'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function removeEntry(id) {
  return deleteDoc(doc(db, 'entries', id));
}

// ===========================
// splits（割り勘・立替）
// ===========================
export async function fetchSplits() {
  const q = query(collection(db, 'splits'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addSplit(splitData, createEntry = true) {
  const splitRef = await runTransaction(db, async (tx) => {
    // 1. splits に保存
    const splitDocRef = doc(collection(db, 'splits'));
    tx.set(splitDocRef, {
      ...splitData,
      settled: false,
      createdAt: serverTimestamp(),
    });

    // 2. entryも作成する場合
    if (createEntry) {
      const entryRef = doc(collection(db, 'entries'));
      tx.set(entryRef, {
        type: 'expense',
        amount: splitData.totalAmount,
        memo: splitData.title,
        date: splitData.date,
        cat: splitData.cat || 'other',
        pay: splitData.pay || 'cash',
        payer: splitData.paidBy,
        splitId: splitDocRef.id,
        tags: '',
        createdAt: serverTimestamp(),
      });
    }

    // 3. debts 更新
    // paidBy が全額立替 → 相手の shares 分が負債
    const { paidBy, shares } = splitData;
    for (const [userId, shareAmt] of Object.entries(shares)) {
      if (userId === paidBy || shareAmt <= 0) continue;
      const debtId = `${userId}_${paidBy}`;
      const debtRef = doc(db, 'debts', debtId);
      tx.set(debtRef, {
        from: userId,
        to: paidBy,
        amount: increment(shareAmt),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    return splitDocRef;
  });
  return splitRef;
}

export async function settleSplit(splitId) {
  // split を精算済みに
  await updateDoc(doc(db, 'splits', splitId), {
    settled: true,
    settledAt: serverTimestamp(),
  });
}

// ===========================
// debts（負債サマリー）
// ===========================
export async function fetchDebts() {
  const snap = await getDocs(collection(db, 'debts'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function settleDebt(debtId) {
  // 負債額を 0 にリセット
  await updateDoc(doc(db, 'debts', debtId), {
    amount: 0,
    updatedAt: serverTimestamp(),
  });
}

// ===========================
// subscriptions（サブスク）
// ===========================
export async function fetchSubscriptions() {
  const snap = await getDocs(collection(db, 'subscriptions'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addSubscription(data) {
  return addDoc(collection(db, 'subscriptions'), {
    ...data,
    active: true,
    lastGeneratedMonth: '',
    createdAt: serverTimestamp(),
  });
}

export async function updateSubscription(id, data) {
  return updateDoc(doc(db, 'subscriptions', id), data);
}

export async function removeSubscription(id) {
  return deleteDoc(doc(db, 'subscriptions', id));
}

// サブスク自動記録チェック
export async function checkAndGenerateSubscriptions(entriesCallback) {
  const today = new Date();
  const todayDay = today.getDate();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const currentMonth = `${yyyy}-${mm}`;
  const dateStr = `${yyyy}-${mm}-${String(todayDay).padStart(2, '0')}`;

  const subs = await fetchSubscriptions();
  let generated = 0;

  for (const sub of subs) {
    if (!sub.active) continue;
    if (sub.lastGeneratedMonth === currentMonth) continue;

    // 引き落とし日の計算（月末フォールバック）
    const daysInMonth = new Date(yyyy, today.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(sub.billingDay, daysInMonth);

    if (todayDay !== targetDay) continue;

    // entries に追加
    await addEntry({
      type: 'expense',
      amount: sub.amount,
      memo: sub.name,
      date: dateStr,
      cat: sub.cat,
      pay: sub.pay,
      payer: sub.payer,
      subscriptionId: sub.id,
      tags: '',
    });

    // lastGeneratedMonth 更新
    await updateSubscription(sub.id, { lastGeneratedMonth: currentMonth });
    generated++;
  }

  return generated;
}

// ===========================
// reports（AIレポートキャッシュ）
// ===========================
export async function fetchReport(yearMonth) {
  const d = await getDoc(doc(db, 'reports', yearMonth));
  return d.exists() ? d.data() : null;
}

export async function saveReport(yearMonth, content, usage) {
  return setDoc(doc(db, 'reports', yearMonth), {
    content,
    generatedAt: serverTimestamp(),
    promptTokens: usage?.prompt_tokens || 0,
    completionTokens: usage?.completion_tokens || 0,
  });
}