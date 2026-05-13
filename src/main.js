import {
  fetchEntries, addEntry, removeEntry,
  fetchSplits, settleSplit,
  fetchDebts, settleDebt,
  fetchSubscriptions, addSubscription, updateSubscription, removeSubscription,
  checkAndGenerateSubscriptions,
  fetchReport, saveReport,
} from './store.js';

import {
  fmt, fmtSigned,
  getCat, getPay, getPayer,
  CAT_COLORS,
} from './constants.js';

import {
  showToast, openOverlay, closeOverlay,
  initEntryModal, openEntryModal,
  initSubModal, openSubModal,
  filterByViewer,
} from './ui.js';

// ===== グローバル状態 =====
let allEntries    = [];
let allSplits     = [];
let allDebts      = [];
let allSubs       = [];
let currentYear   = new Date().getFullYear();
let currentMonth  = new Date().getMonth(); // 0-indexed
let currentViewer = 'all';

// ===== 初期化 =====
async function init() {
  setupNav();
  setupViewerSwitches();
  setupMonthNavs();
  setupAnalysisTabs();

  // 明細入力モーダル
  // data.isSplit===true のとき store.js 側で splits/debts も自動作成する
  initEntryModal(async (data) => {
    await addEntry(data);
    await reload();
  });

  // サブスクモーダル
  initSubModal(async (data) => {
    await addSubscription(data);
    await reloadSubs();
  });

  // FAB（ホーム画面の＋ボタン）
  document.getElementById('fabBtn')
    ?.addEventListener('click', openEntryModal);

  // サブスク追加ボタン
  document.getElementById('addSubBtn')
    ?.addEventListener('click', openSubModal);

  // AIレポートボタン
  document.getElementById('generateReportBtn')
    ?.addEventListener('click', onGenerateReport);

  // 全データ読み込み
  await reload();

  // サブスク自動記録チェック（起動時）
  const generated = await checkAndGenerateSubscriptions();
  if (generated > 0) {
    showToast(`🔁 ${generated}件のサブスクを自動記録しました`);
    await reload();
  }
}

// ===== データ一括リロード =====
async function reload() {
  [allEntries, allSplits, allDebts, allSubs] = await Promise.all([
    fetchEntries(),
    fetchSplits(),
    fetchDebts(),
    fetchSubscriptions(),
  ]);
  renderAll();
}

async function reloadSettle() {
  [allSplits, allDebts] = await Promise.all([fetchSplits(), fetchDebts()]);
  renderSettle();
}

async function reloadSubs() {
  allSubs = await fetchSubscriptions();
  renderSubs();
}

// ===== ナビゲーション =====
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`screen-${screen}`)?.classList.add('active');
    });
  });
}

// ===== 表示者フィルタ =====
function setupViewerSwitches() {
  ['homeViewerSwitch', 'listViewerSwitch'].forEach(switchId => {
    document.getElementById(switchId)?.querySelectorAll('.viewer-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById(switchId)
          .querySelectorAll('.viewer-chip')
          .forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentViewer = chip.dataset.viewer;
        renderAll();
      });
    });
  });
}

// ===== 月ナビ =====
function setupMonthNavs() {
  const pairs = [
    ['prevMonth',        'nextMonth',        'homeMonthLabel'],
    ['listPrevMonth',    'listNextMonth',    'listMonthLabel'],
    ['analysisPrevMonth','analysisNextMonth','analysisMonthLabel'],
  ];
  pairs.forEach(([prevId, nextId]) => {
    document.getElementById(prevId)?.addEventListener('click', () => changeMonth(-1));
    document.getElementById(nextId)?.addEventListener('click', () => changeMonth(1));
  });
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0;  currentYear++; }
  updateMonthLabels();
  renderAll();
}

function updateMonthLabels() {
  const label = `${currentYear}年${currentMonth + 1}月`;
  ['homeMonthLabel', 'listMonthLabel', 'analysisMonthLabel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

// ===== 分析タブ =====
function setupAnalysisTabs() {
  document.querySelectorAll('#screen-analysis .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#screen-analysis .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#screen-analysis .tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
    });
  });
}

// ===== データフィルタ =====
function monthEntries() {
  return allEntries.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
}

function filteredMonthEntries() {
  return filterByViewer(monthEntries(), currentViewer);
}

// ===== 全画面レンダリング =====
function renderAll() {
  updateMonthLabels();
  const list = filteredMonthEntries();
  renderSummary(list);
  renderHomeRecent(list);
  renderList(list);
  renderCatChart(list);
  renderPaymentCF(list);
  renderSettle();
  renderSubs();
}

// ===== サマリー =====
function renderSummary(list) {
  const expense = list.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const income  = list.filter(e => e.type === 'income' ).reduce((s, e) => s + e.amount, 0);
  const balance = income - expense;
  setEl('homeTotalExpense', fmt(expense));
  setEl('homeTotalIncome',  fmt(income));
  setEl('homeTotalBalance', fmtSigned(balance));
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ===== ホーム：直近5件 =====
function renderHomeRecent(list) {
  const container = document.getElementById('homeRecentList');
  if (!container) return;
  const recent = list.slice(0, 5);
  container.innerHTML = recent.length
    ? recent.map(e => entryHTML(e)).join('')
    : emptyState('今月の記録がありません');
  bindDeleteButtons(container);
}

// ===== 明細リスト =====
function renderList(list) {
  const panel = document.getElementById('listPanel');
  if (!panel) return;
  if (!list.length) {
    panel.innerHTML = emptyState('今月の記録がありません');
    return;
  }

  // 日付でグループ化
  const byDate = {};
  list.forEach(e => {
    const d = e.date || '不明';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  });

  panel.innerHTML = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => {
      const dayTotal = items
        .filter(e => e.type === 'expense')
        .reduce((s, e) => s + e.amount, 0);
      const d = new Date(date + 'T00:00:00');
      const dayLabel = `${d.getMonth() + 1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）`;
      return `
        <div class="day-label">
          <span>${dayLabel}</span>
          ${dayTotal > 0 ? `<span class="day-total">-${fmt(dayTotal)}</span>` : ''}
        </div>
        ${items.map(e => entryHTML(e)).join('')}
      `;
    }).join('');

  bindDeleteButtons(panel);
}

function entryHTML(e) {
  const cat = getCat(e.cat);
  const pay = getPay(e.pay);
  const splitBadge = e.isSplit
    ? '<span class="badge split-badge">🤝 割り勘</span>'
    : '';
  const subBadge = e.subscriptionId
    ? '<span class="badge">🔁 サブスク</span>'
    : '';
  return `
    <div class="entry">
      <div class="entry-main">
        <div class="entry-name">${e.memo || '（メモなし）'}</div>
        <div class="entry-meta">
          <span class="badge">${cat.icon} ${cat.name}</span>
          <span class="badge">${pay.icon} ${pay.name}</span>
          ${splitBadge}${subBadge}
        </div>
      </div>
      <div class="entry-right">
        <div class="entry-amount ${e.type}">
          ${e.type === 'expense' ? '-' : '+'}${fmt(e.amount)}
        </div>
      </div>
      <button class="delete-btn" data-id="${e.id}">×</button>
    </div>`;
}

function bindDeleteButtons(container) {
  container.querySelectorAll('.delete-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const entry = allEntries.find(e => e.id === btn.dataset.id);
      const msg = entry?.isSplit
        ? '削除すると精算データ（割り勘記録・負債）も同時に削除されます。よろしいですか？'
        : '削除しますか？';
      if (!confirm(msg)) return;
      await removeEntry(btn.dataset.id);
      showToast('削除しました');
      await reload();
    });
  });
}

function emptyState(text) {
  return `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">${text}</div></div>`;
}

// ===== 分析：カテゴリ別 =====
function renderCatChart(list) {
  const totals = {};
  list.filter(e => e.type === 'expense').forEach(e => {
    totals[e.cat] = (totals[e.cat] || 0) + e.amount;
  });
  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const el = document.getElementById('catBars');
  if (!el) return;
  el.innerHTML = sorted.length
    ? sorted.map(([id, amt]) => {
        const cat = getCat(id);
        const pct = total ? Math.round(amt / total * 100) : 0;
        return `
          <div class="cat-row">
            <div class="cat-icon">${cat.icon}</div>
            <div class="cat-info">
              <div class="cat-name">${cat.name}</div>
              <div class="cat-bar-wrap">
                <div class="cat-bar" style="width:${pct}%;background:${CAT_COLORS[id] || '#888'}"></div>
              </div>
            </div>
            <div class="cat-amount">${fmt(amt)}</div>
          </div>`;
      }).join('')
    : emptyState('今月の支出データがありません');
}

// ===== 分析：支払方法別CF =====
function renderPaymentCF(list) {
  const totals = {}, counts = {};
  list.filter(e => e.type === 'expense').forEach(e => {
    totals[e.pay] = (totals[e.pay] || 0) + e.amount;
    counts[e.pay] = (counts[e.pay] || 0) + 1;
  });
  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const el = document.getElementById('paymentCFList');
  if (!el) return;
  el.innerHTML = sorted.length
    ? sorted.map(([id, amt]) => {
        const pay = getPay(id);
        const pct = total ? Math.round(amt / total * 100) : 0;
        return `
          <div class="payment-card">
            <div class="payment-left">
              <div class="payment-icon">${pay.icon}</div>
              <div>
                <div class="payment-name">${pay.name}</div>
                <div class="payment-count">${counts[id]}件</div>
              </div>
            </div>
            <div class="payment-right">
              <div class="payment-amount">${fmt(amt)}</div>
              <div class="payment-pct">${pct}%</div>
            </div>
          </div>`;
      }).join('')
    : emptyState('今月の支出データがありません');
}

// ===== AIレポート =====
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

async function onGenerateReport() {
  const btn = document.getElementById('generateReportBtn');
  const contentEl = document.getElementById('reportContent');
  if (!contentEl) return;

  const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const cached = await fetchReport(yearMonth);
  if (cached) {
    contentEl.innerHTML = markdownToHTML(cached.content);
    showToast('📄 キャッシュから読み込みました');
    return;
  }

  btn.disabled = true;
  btn.textContent = '生成中…';
  contentEl.innerHTML = '<div class="report-loading">✨ AIがレポートを生成しています…</div>';

  try {
    const list = filteredMonthEntries();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0.7,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: buildReportPrompt(list) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json();
    const content = data.choices[0].message.content;
    await saveReport(yearMonth, content, data.usage);
    contentEl.innerHTML = markdownToHTML(content);
    showToast('✅ レポートを生成しました');
  } catch (e) {
    console.error(e);
    contentEl.innerHTML = emptyState('レポートの生成に失敗しました。APIキーを確認してください。');
    showToast('❌ レポート生成に失敗しました');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ 再生成する';
  }
}

function buildSystemPrompt() {
  return `あなたは家計管理アドバイザーです。
慶佑・寧子のカップルの月次家計データを分析し、以下の観点で日本語のレポートをMarkdown形式で作成してください：
1. 今月の収支サマリー（収入・支出・収支バランス）
2. カテゴリ別支出の傾向
3. 支払方法の使い方の特徴
4. 来月に向けたアドバイス（具体的に1〜2点）
レポートは読みやすく、数字を活用して具体的に記述すること。`;
}

function buildReportPrompt(list) {
  const expense = list.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const income  = list.filter(e => e.type === 'income' ).reduce((s, e) => s + e.amount, 0);
  const balance = income - expense;

  const catTotals = {};
  list.filter(e => e.type === 'expense').forEach(e => {
    catTotals[e.cat] = (catTotals[e.cat] || 0) + e.amount;
  });
  const catBreakdown = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([id, amt]) => `${getCat(id).name}: ${fmt(amt)}`)
    .join(', ') || 'データなし';

  const payTotals = {};
  list.filter(e => e.type === 'expense').forEach(e => {
    payTotals[e.pay] = (payTotals[e.pay] || 0) + e.amount;
  });
  const payBreakdown = Object.entries(payTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([id, amt]) => `${getPay(id).name}: ${fmt(amt)}`)
    .join(', ') || 'データなし';

  const debtSummary = allDebts
    .filter(d => d.amount > 0)
    .map(d => `${getPayer(d.from).name} → ${getPayer(d.to).name}: ${fmt(d.amount)} 未精算`)
    .join(', ') || 'なし';

  return `【対象月】${currentYear}年${currentMonth + 1}月
【収支サマリー】
- 総支出: ${fmt(expense)}
- 総収入: ${fmt(income)}
- 収支バランス: ${fmtSigned(balance)}

【カテゴリ別支出】
${catBreakdown}

【支払方法別支出】
${payBreakdown}

【割り勘・精算状況】
${debtSummary}`;
}

function markdownToHTML(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// ===== 精算画面 =====
function renderSettle() {
  renderDebtDashboard();
  renderSplitList();
}

function renderDebtDashboard() {
  const container = document.getElementById('debtDashboard');
  if (!container) return;

  const activeDebts = allDebts.filter(d => d.amount > 0);
  if (!activeDebts.length) {
    container.innerHTML = `
      <div class="debt-card">
        <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:14px">
          ✅ 未精算の負債はありません
        </div>
      </div>`;
    return;
  }

  container.innerHTML = activeDebts.map(debt => {
    const fromIcon = getPayer(debt.from).icon;
    const fromName = getPayer(debt.from).name;
    const toIcon   = getPayer(debt.to).icon;
    const toName   = getPayer(debt.to).name;
    return `
      <div class="debt-card has-debt">
        <div class="debt-row">
          <div class="debt-direction">${fromIcon} ${fromName} → ${toIcon} ${toName}</div>
          <div class="debt-amount">${fmt(debt.amount)}</div>
        </div>
        <div class="debt-actions">
          <button class="debt-action-btn" data-debt-detail="${debt.from}_${debt.to}">内訳を見る</button>
          <button class="debt-action-btn paypay" data-paypay-amount="${Math.round(debt.amount)}">📱 PayPayで送る</button>
          <button class="debt-action-btn settle" data-debt-settle="${debt.id}">✅ 精算済みに</button>
        </div>
      </div>`;
  }).join('');

  // PayPay
  container.querySelectorAll('[data-paypay-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = btn.dataset.paypayAmount;
      window.location.href = `paypay://p2p?amount=${amount}`;
      setTimeout(() => window.open('https://paypay.ne.jp/', '_blank'), 1500);
    });
  });

  // 精算済みに
  container.querySelectorAll('[data-debt-settle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('精算済みにしますか？')) return;
      await settleDebt(btn.dataset.debtSettle);
      showToast('✅ 精算しました');
      await reloadSettle();
    });
  });

  // 内訳
  container.querySelectorAll('[data-debt-detail]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [from, to] = btn.dataset.debtDetail.split('_');
      openDebtDetail(from, to);
    });
  });
}

function openDebtDetail(from, to) {
  document.getElementById('debtDetailTitle').textContent =
    `${getPayer(from).name} → ${getPayer(to).name} の内訳`;

  const related = allSplits.filter(s =>
    !s.settled && s.paidBy === to && (s.shares?.[from] || 0) > 0
  );

  document.getElementById('debtDetailList').innerHTML = related.length
    ? related.map(s => `
        <div class="split-item">
          <div class="split-main">
            <div class="split-title-text">${s.title}</div>
            <div class="split-meta">${s.date}　立替: ${getPayer(s.paidBy).name}</div>
          </div>
          <div class="split-amount-col">
            <div class="split-total">${fmt(s.shares?.[from] || 0)}</div>
            <div class="split-sub">負担分</div>
          </div>
        </div>`)
      .join('')
    : emptyState('内訳データがありません');

  openOverlay('debtDetailOverlay');

  document.getElementById('debtDetailClose')
    ?.addEventListener('click', () => closeOverlay('debtDetailOverlay'), { once: true });
  document.getElementById('debtDetailOverlay')
    ?.addEventListener('click', e => {
      if (e.target.id === 'debtDetailOverlay') closeOverlay('debtDetailOverlay');
    }, { once: true });
}

function renderSplitList() {
  const container = document.getElementById('splitList');
  if (!container) return;

  if (!allSplits.length) {
    container.innerHTML = emptyState('割り勘・立替の記録がありません');
    return;
  }

  container.innerHTML = allSplits.map(s => {
    const kShare = s.shares?.keisuke || 0;
    const nShare = s.shares?.nene    || 0;
    // 紐づく明細のID（削除ボタン用）
    const entryId = s.entryId || '';
    return `
      <div class="split-item ${s.settled ? 'settled' : ''}">
        <div class="split-main">
          <div class="split-title-text">${s.title}</div>
          <div class="split-meta">
            ${s.date}　払: ${getPayer(s.paidBy).name}
            　👨${fmt(kShare)} / 👩${fmt(nShare)}
          </div>
        </div>
        <div class="split-amount-col">
          <div class="split-total">${fmt(s.totalAmount)}</div>
          ${s.settled
            ? '<span class="settled-badge">精算済み</span>'
            : `<button class="split-settle-btn" data-split-id="${s.id}">精算</button>`}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-split-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('この項目を精算済みにしますか？')) return;
      await settleSplit(btn.dataset.splitId);
      showToast('✅ 精算しました');
      await reloadSettle();
    });
  });
}

// ===== サブスク =====
function renderSubs() {
  const container = document.getElementById('subList');
  if (!container) return;

  if (!allSubs.length) {
    container.innerHTML = emptyState('サブスクが登録されていません');
    return;
  }

  container.innerHTML = allSubs.map(s => {
    const pay   = getPay(s.pay);
    const payer = getPayer(s.payer);
    return `
      <div class="sub-card ${s.active ? '' : 'inactive'}">
        <div class="sub-left">
          <div class="sub-name">${s.name}</div>
          <div class="sub-meta">毎月${s.billingDay}日 ･ ${pay.icon}${pay.name} ･ ${payer.icon}${payer.name}</div>
        </div>
        <div class="sub-right">
          <div class="sub-amount">${fmt(s.amount)}</div>
          <label class="sub-toggle">
            <input type="checkbox" ${s.active ? 'checked' : ''} data-sub-toggle="${s.id}">
            <span class="toggle-slider"></span>
          </label>
          <button class="sub-delete-btn" data-sub-delete="${s.id}">🗑</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-sub-toggle]').forEach(input => {
    input.addEventListener('change', async () => {
      await updateSubscription(input.dataset.subToggle, { active: input.checked });
      showToast(input.checked ? '✅ 有効にしました' : '⏸ 停止しました');
      await reloadSubs();
    });
  });

  container.querySelectorAll('[data-sub-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('削除しますか？')) return;
      await removeSubscription(btn.dataset.subDelete);
      showToast('削除しました');
      await reloadSubs();
    });
  });
}

// ===== 起動 =====
init();