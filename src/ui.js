import {
  CATS_EXPENSE,
  CATS_INCOME,
  PAYMENTS,
  PAYERS,
  PAYERS_SPLIT
} from './constants.js';

// =========================
// Toast
// =========================
let toastEl = null;
let toastTimer = null;

export function showToast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = msg;
  toastEl.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2500);
}

// =========================
// Overlay
// =========================
export function openOverlay(id) {
  document.getElementById(id)?.classList.add('open');
}

export function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('open');
}

// =========================
// Chips
// =========================
export function renderChips(
  containerId,
  items,
  selectedId,
  onSelect,
  wideMode = false
) {
  const container = document.getElementById(containerId);

  if (!container) return;

  container.innerHTML = items.map(item => `
    <div
      class="chip ${wideMode ? 'wide' : ''} ${item.id === selectedId ? 'active' : ''}"
      data-id="${item.id}"
    >
      <span>${item.icon}</span>
      <span>${item.name}</span>
    </div>
  `).join('');

  container.querySelectorAll('.chip').forEach(el => {
    el.addEventListener('click', () => {

      container
        .querySelectorAll('.chip')
        .forEach(c => c.classList.remove('active'));

      el.classList.add('active');

      onSelect(el.dataset.id);
    });
  });
}

// =========================
// Entry Modal
// =========================
let entryState = {
  type: 'expense',
  cat: 'food',
  pay: 'credit',
  payer: 'keisuke',
  isSplit: false,
};

export function initEntryModal(onSave) {

  const overlay = document.getElementById('entryOverlay');

  // 閉じる
  document
    .getElementById('entryOverlayClose')
    ?.addEventListener('click', () => {
      closeOverlay('entryOverlay');
    });

  overlay?.addEventListener('click', e => {
    if (e.target === overlay) {
      closeOverlay('entryOverlay');
    }
  });

  // type toggle
  document
    .getElementById('btnExpense')
    ?.addEventListener('click', () => {
      setEntryType('expense');
    });

  document
    .getElementById('btnIncome')
    ?.addEventListener('click', () => {
      setEntryType('income');
    });

  // split toggle
  document
    .getElementById('splitNoBtn')
    ?.addEventListener('click', () => {

      entryState.isSplit = false;

      document
        .getElementById('splitShareSection')
        .style.display = 'none';

      document
        .getElementById('splitNoBtn')
        .classList.add('active');

      document
        .getElementById('splitYesBtn')
        .classList.remove('active');
    });

  document
    .getElementById('splitYesBtn')
    ?.addEventListener('click', () => {

      entryState.isSplit = true;

      document
        .getElementById('splitShareSection')
        .style.display = 'block';

      document
        .getElementById('splitYesBtn')
        .classList.add('active');

      document
        .getElementById('splitNoBtn')
        .classList.remove('active');
    });

  // 保存
  document
    .getElementById('saveEntryBtn')
    ?.addEventListener('click', async () => {

      const amount = Number(
        document.getElementById('inputAmount').value || 0
      );

      if (amount <= 0) {
        showToast('金額を入力してください');
        return;
      }

      // 割り勘チェック
      let shares = null;

      if (entryState.isSplit) {

        const k = Number(
          document.getElementById('entryShareKeisuke').value || 0
        );

        const n = Number(
          document.getElementById('entryShareNene').value || 0
        );

        const sum = k + n;

        if (sum !== amount) {
          showToast('負担額の合計が一致しません');
          return;
        }

        shares = {
          keisuke: k,
          nene: n,
        };
      }

      const btn = document.getElementById('saveEntryBtn');

      btn.disabled = true;
      btn.textContent = '保存中…';

      try {

        await onSave({
          type: entryState.type,
          amount,
          memo: document.getElementById('inputMemo').value.trim(),
          date: document.getElementById('inputDate').value,
          cat: entryState.cat,
          pay: entryState.pay,
          payer: entryState.payer,
          tags: document.getElementById('inputTags').value.trim(),
          isSplit: entryState.isSplit,
          shares,
        });

        closeOverlay('entryOverlay');

        showToast('✅ 保存しました');

      } catch (e) {

        console.error(e);

        showToast('エラーが発生しました');

      } finally {

        btn.disabled = false;
        btn.textContent = '保存する';
      }
    });
}

function setEntryType(type) {

  entryState.type = type;

  document
    .getElementById('btnExpense')
    .classList.toggle('active', type === 'expense');

  document
    .getElementById('btnIncome')
    .classList.toggle('active', type === 'income');

  renderEntryChips();
}

function renderEntryChips() {

  const cats =
    entryState.type === 'expense'
      ? CATS_EXPENSE
      : CATS_INCOME;

  entryState.cat = cats[0].id;

  renderChips(
    'catGrid',
    cats,
    entryState.cat,
    id => {
      entryState.cat = id;
    }
  );

  renderChips(
    'payGrid',
    PAYMENTS,
    entryState.pay,
    id => {
      entryState.pay = id;
    },
    true
  );

  renderChips(
    'payerGrid',
    PAYERS_SPLIT,
    entryState.payer,
    id => {
      entryState.payer = id;
    },
    true
  );
}

export function openEntryModal() {

  document.getElementById('inputDate').value = todayStr();

  document.getElementById('inputAmount').value = '';

  document.getElementById('inputMemo').value = '';

  document.getElementById('inputTags').value = '';

  document.getElementById('entryShareKeisuke').value = '';
  
  document.getElementById('entryShareNene').value = '';

  entryState = {
    type: 'expense',
    cat: 'food',
    pay: 'credit',
    payer: 'keisuke',
    isSplit: false,
  };

  document
    .getElementById('splitShareSection')
    .style.display = 'none';

  document
    .getElementById('btnExpense')
    .classList.add('active');

  document
    .getElementById('btnIncome')
    .classList.remove('active');

  renderEntryChips();

  openOverlay('entryOverlay');
}

// =========================
// Split Modal
// =========================
let splitState = {
  paidBy: 'keisuke',
};

export function initSplitModal(onSave) {

  const overlay = document.getElementById('splitOverlay');

  document
    .getElementById('splitOverlayClose')
    ?.addEventListener('click', () => {
      closeOverlay('splitOverlay');
    });

  overlay?.addEventListener('click', e => {
    if (e.target === overlay) {
      closeOverlay('splitOverlay');
    }
  });

  document
    .getElementById('saveSplitBtn')
    ?.addEventListener('click', async () => {

      const title =
        document.getElementById('splitTitle').value.trim();

      if (!title) {
        showToast('タイトルを入力してください');
        return;
      }

      const total = Number(
        document.getElementById('splitTotal').value || 0
      );

      if (total <= 0) {
        showToast('支払総額を入力してください');
        return;
      }

      const shares = {
        keisuke: Number(
          document.getElementById('splitShareKeisuke').value || 0
        ),
        nene: Number(
          document.getElementById('splitShareNene').value || 0
        ),
      };

      if (shares.keisuke + shares.nene !== total) {
        showToast('負担額の合計が一致しません');
        return;
      }

      const btn = document.getElementById('saveSplitBtn');

      btn.disabled = true;
      btn.textContent = '保存中…';

      try {

        await onSave({
          title,
          date: document.getElementById('splitDate').value,
          totalAmount: total,
          paidBy: splitState.paidBy,
          shares,
          note: document.getElementById('splitNote').value.trim(),
        });

        closeOverlay('splitOverlay');

        showToast('✅ 割り勘を記録しました');

      } catch (e) {

        console.error(e);

        showToast('エラーが発生しました');

      } finally {

        btn.disabled = false;
        btn.textContent = '保存する';
      }
    });
}

export function openSplitModal() {

  document.getElementById('splitTitle').value = '';

  document.getElementById('splitDate').value = todayStr();

  document.getElementById('splitTotal').value = '';

  document.getElementById('splitShareKeisuke').value = '';

  document.getElementById('splitShareNene').value = '';

  document.getElementById('splitNote').value = '';

  splitState.paidBy = 'keisuke';

  renderChips(
    'splitPaidByGrid',
    PAYERS_SPLIT,
    'keisuke',
    id => {
      splitState.paidBy = id;
    },
    true
  );

  openOverlay('splitOverlay');
}

// =========================
// Subscription Modal
// =========================
let subState = {
  cat: 'other',
  pay: 'credit',
  payer: 'keisuke',
};

export function initSubModal(onSave) {

  const overlay = document.getElementById('subOverlay');

  document
    .getElementById('subOverlayClose')
    ?.addEventListener('click', () => {
      closeOverlay('subOverlay');
    });

  overlay?.addEventListener('click', e => {
    if (e.target === overlay) {
      closeOverlay('subOverlay');
    }
  });

  document
    .getElementById('saveSubBtn')
    ?.addEventListener('click', async () => {

      const name =
        document.getElementById('subName').value.trim();

      const amount = Number(
        document.getElementById('subAmount').value || 0
      );

      const billingDay = Number(
        document.getElementById('subBillingDay').value || 0
      );

      if (!name) {
        showToast('サービス名を入力してください');
        return;
      }

      if (amount <= 0) {
        showToast('金額を入力してください');
        return;
      }

      if (billingDay < 1 || billingDay > 31) {
        showToast('引き落とし日を入力してください');
        return;
      }

      try {

        await onSave({
          name,
          amount,
          billingDay,
          cat: subState.cat,
          pay: subState.pay,
          payer: subState.payer,
        });

        closeOverlay('subOverlay');

        showToast('✅ サブスクを追加しました');

      } catch (e) {

        console.error(e);

        showToast('エラーが発生しました');
      }
    });
}

export function openSubModal() {

  document.getElementById('subName').value = '';

  document.getElementById('subAmount').value = '';

  document.getElementById('subBillingDay').value = '';

  subState = {
    cat: 'other',
    pay: 'credit',
    payer: 'keisuke',
  };

  renderChips(
    'subCatGrid',
    CATS_EXPENSE,
    subState.cat,
    id => {
      subState.cat = id;
    }
  );

  renderChips(
    'subPayGrid',
    PAYMENTS,
    subState.pay,
    id => {
      subState.pay = id;
    },
    true
  );

  renderChips(
    'subPayerGrid',
    PAYERS_SPLIT,
    subState.payer,
    id => {
      subState.payer = id;
    },
    true
  );

  openOverlay('subOverlay');
}

// =========================
// Utils
// =========================
export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function filterByViewer(list, viewer) {

  if (viewer === 'all') {
    return list;
  }

  return list
    .map(e => {

      // 割り勘
      if (e.isSplit && e.shares) {

        return {
          ...e,
          amount: Number(e.shares[viewer] || 0),
        };
      }

      // 通常明細
      if (e.payer === viewer) {
        return e;
      }

      return null;
    })
    .filter(Boolean);
}