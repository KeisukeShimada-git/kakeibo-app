import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, getDocs, getDoc,
  updateDoc, deleteDoc, doc, query, orderBy, setDoc,
  runTransaction, increment, serverTimestamp, where
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

/**
 * 明細を追加する。
 * data.isSplit === true のとき、splits / debts も同一トランザクションで作成する。
 *
 * data: {
 *   type, amount, memo, date, cat, pay, payer, tags,
 *   isSplit,          // boolean
 *   shares,           // { keisuke: number, nene: number } — isSplit=true のときのみ
 * }
 */
export async function addEntry(data) {
  const { isSplit, shares, ...entryFields } = data;

  if (!isSplit) {
    // 割り勘なし: 通常の addDoc
    return addDoc(collection(db, 'entries'), {
      ...entryFields,
      isSplit: false,
      createdAt: serverTimestamp(),
    });
  }

  // 割り勘あり: トランザクションで entry + split + debts を一括作成
  return runTransaction(db, async (tx) => {
    const now = new Date(); // serverTimestamp() はトランザクション内で使用不可のため new Date()

    // 1. entry ドキュメントの参照を先に作成
    const entryRef = doc(collection(db, 'entries'));

    // 2. split ドキュメントの参照を作成
    const splitRef = doc(collection(db, 'splits'));

    // 3. entry を書き込む（splitId を持たせる）
    tx.set(entryRef, {
      ...entryFields,
      isSplit: true,
      shares,
      splitId: splitRef.id,
      createdAt: now,
    });

    // 4. split を書き込む（entryId を持たせる）
    tx.set(splitRef, {
      title: entryFields.memo || '（メモなし）',
      date: entryFields.date,
      totalAmount: entryFields.amount,
      paidBy: entryFields.payer,
      shares,
      entryId: entryRef.id,
      settled: false,
      createdAt: now,
    });

    // 5. debts を更新（立替した人以外の負担分が負債になる）
    const paidBy = entryFields.payer;
    for (const [userId, shareAmt] of Object.entries(shares)) {
      if (userId === paidBy || !shareAmt || shareAmt <= 0) continue;
      const debtId = `${userId}_${paidBy}`;
      const debtRef = doc(db, 'debts', debtId);
      tx.set(
        debtRef,
        {
          from: userId,
          to: paidBy,
          amount: increment(shareAmt),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return entryRef;
  });
}

/**
 * 明細を削除する。
 * 紐づく split がある場合は split も削除し、debts から該当金額を差し引く。
 */
export async function removeEntry(entryId) {
  // entry を取得して splitId を確認
  const entrySnap = await getDoc(doc(db, 'entries', entryId));
  if (!entrySnap.exists()) return;

  const entry = entrySnap.data();

  if (!entry.isSplit || !entry.splitId) {
    // 割り勘なし: entry だけ削除
    return deleteDoc(doc(db, 'entries', entryId));
  }

  // 割り勘あり: split も取得して一括削除 + debts ロールバック
  const splitSnap = await getDoc(doc(db, 'splits', entry.splitId));

  return runTransaction(db, async (tx) => {
    const now = new Date();

    // entry 削除
    tx.delete(doc(db, 'entries', entryId));

    // split 削除
    tx.delete(doc(db, 'splits', entry.splitId));

    // debts から差し引く（split が精算済みでなければ）
    if (splitSnap.exists()) {
      const split = splitSnap.data();
      if (!split.settled) {
        const paidBy = split.paidBy;
        for (const [userId, shareAmt] of Object.entries(split.shares || {})) {
          if (userId === paidBy || !shareAmt || shareAmt <= 0) continue;
          const debtId = `${userId}_${paidBy}`;
          const debtRef = doc(db, 'debts', debtId);
          // increment に負値を渡して差し引く（0未満にならないよう注意）
          tx.set(
            debtRef,
            {
              from: userId,
              to: paidBy,
              amount: increment(-shareAmt),
              updatedAt: now,
            },
            { merge: true }
          );
        }
      }
    }
  });
}

// ===========================
// splits（割り勘・立替）
// ===========================
export async function fetchSplits() {
  const q = query(collection(db, 'splits'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function settleSplit(splitId) {
  await updateDoc(doc(db, 'splits', splitId), {
    settled: true,
    settledAt: new Date(),
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
  await updateDoc(doc(db, 'debts', debtId), {
    amount: 0,
    updatedAt: new Date(),
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

// サブスク自動記録チェック（起動時に呼ぶ）
export async function checkAndGenerateSubscriptions() {
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

    // 月末フォールバック（例: 31日指定で2月は28日）
    const daysInMonth = new Date(yyyy, today.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(sub.billingDay, daysInMonth);

    if (todayDay !== targetDay) continue;

    await addDoc(collection(db, 'entries'), {
      type: 'expense',
      amount: sub.amount,
      memo: sub.name,
      date: dateStr,
      cat: sub.cat,
      pay: sub.pay,
      payer: sub.payer,
      isSplit: false,
      subscriptionId: sub.id,
      tags: '',
      createdAt: serverTimestamp(),
    });

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