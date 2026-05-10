import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "firebase/firestore";

// ===== Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyAx-He9tpBZ40wVnkmkktzevWthKm27AJI",
  authDomain: "my-kakeibo-poc.firebaseapp.com",
  projectId: "my-kakeibo-poc",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== マスタ =====
const CATS_EXPENSE = [
  {id:'food', icon:'🍜', name:'食費'},
  {id:'transport', icon:'🚃', name:'交通'},
  {id:'daily', icon:'🛍', name:'日用品'},
  {id:'social', icon:'🍺', name:'交際費'},
  {id:'house', icon:'🏠', name:'住居'},
  {id:'medical', icon:'💊', name:'医療'},
  {id:'edu', icon:'📚', name:'教育'},
  {id:'other', icon:'📦', name:'その他'},
];
const CATS_INCOME = [
  {id:'salary', icon:'💰', name:'給料'},
  {id:'bonus', icon:'🎁', name:'ボーナス'},
  {id:'side', icon:'💻', name:'副業'},
  {id:'other', icon:'📦', name:'その他'},
];
const PAYMENTS = [
  {id:'credit', icon:'💳', name:'クレカ'},
  {id:'paypay', icon:'📱', name:'PayPay'},
  {id:'cash', icon:'💴', name:'現金・割り勘'},
  {id:'suica', icon:'🚃', name:'Suica / IC'},
  {id:'transfer', icon:'🏦', name:'振込'},
  {id:'other', icon:'💸', name:'その他'},
];

const PAYERS = [
  {id:'keisuke', icon:'👨', name:'慶佑'},
  {id:'nene', icon:'👩', name:'寧子'},
  {id:'split', icon:'🤝', name:'割り勘'},
];

const CAT_COLORS = {
  food:'#E24B4A', transport:'#378ADD', daily:'#D4537E',
  social:'#EF9F27', house:'#1D9E75', medical:'#7F77DD',
  edu:'#5DCAA5', salary:'#1D9E75', bonus:'#63C922',
  side:'#378ADD', other:'#888780'
};

// ===== 状態 =====
let entries = [];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedType = 'expense';
let selectedCat = 'food';
let selectedPay = 'credit';
let selectedPayer = 'keisuke';
let currentViewer = 'all';

// ===== Firebase読み込み =====
async function loadEntries() {
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  entries = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  render();
}

// ===== 保存 =====
window.saveEntry = async function () {
  const amount = parseFloat(document.getElementById('inputAmount').value);
  if (!amount || amount <= 0) {
    alert('金額を入力してください');
    return;
  }

  await addDoc(collection(db, "entries"), {
    type: selectedType,
    amount: amount,
    memo: document.getElementById('inputMemo').value.trim(),
    date: document.getElementById('inputDate').value,
    cat: selectedCat,
    pay: selectedPay,
    tags: document.getElementById('inputTags').value.trim(),
    payer: selectedPayer,
    createdAt: new Date()
  });

  closeModal();
  await loadEntries();
};

// ===== 削除 =====
window.deleteEntry = async function (id) {
  if (!confirm('削除しますか？')) return;
  await deleteDoc(doc(db, "entries", id));
  await loadEntries();
};

// ===== UI操作 =====
window.openModal = function () {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('inputDate').value = today;
  document.getElementById('inputAmount').value = '';
  document.getElementById('inputMemo').value = '';
  document.getElementById('inputTags').value = '';
  setType('expense');
  document.getElementById('overlay').classList.add('open');
};

window.closeModal = function () {
  document.getElementById('overlay').classList.remove('open');
};

window.overlayClick = function(e) {
  if (e.target.id === 'overlay') closeModal();
};

window.changeMonth = function (dir) {
  currentMonth += dir;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  render();
};

window.switchTab = function (name, el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-'+name).classList.add('active');
};

window.setType = function(type) {
  selectedType = type;
  document.getElementById('btn-expense').classList.toggle('active', type==='expense');
  document.getElementById('btn-income').classList.toggle('active', type==='income');
  renderCatGrid();
};

window.setViewer = function(viewer, el){
  currentViewer = viewer;

  document.querySelectorAll('.viewer-chip')
    .forEach(c=>c.classList.remove('active'));

  el.classList.add('active');

  render();
};

window.selectCat = function(id, el) {
  selectedCat = id;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
};

window.selectPay = function(id, el) {
  selectedPay = id;
  document.querySelectorAll('.pay-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
};

window.selectPayer = function(id, el) {
  selectedPayer = id;
  document.querySelectorAll('.payer-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
};




// ===== 描画 =====
function fmt(n){return '¥'+Math.abs(Math.round(n)).toLocaleString();}
function monthEntries(){
  return entries.filter(e=>{
    const d=new Date(e.date);
    return d.getFullYear()===currentYear&&d.getMonth()===currentMonth;
  });
}

function render(){
  const rawList = monthEntries();
  const list = filterByViewer(rawList);
  const expense=list.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);
  const income=list.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0);
  const balance=income-expense;

  document.getElementById('monthLabel').textContent=`${currentYear}年${currentMonth+1}月`;
  document.getElementById('totalExpense').textContent=fmt(expense);
  document.getElementById('totalIncome').textContent=fmt(income);
  document.getElementById('totalBalance').textContent=(balance>=0?'+':'-')+fmt(balance);

  renderList(list);
  renderChart(list);
  renderPayment(list);

}

function renderList(list){
  const panel=document.getElementById('panel-list');
  if(!list.length){
    panel.innerHTML=`<div class="empty">データなし</div>`;
    return;
  }

  panel.innerHTML=list.map(e=>{
    const cat=[...CATS_EXPENSE,...CATS_INCOME].find(c=>c.id===e.cat)||{};
    const pay=PAYMENTS.find(p=>p.id===e.pay)||{};
    return `
    <div class="entry">
      <div class="entry-main">
        <div>${e.memo||'（メモなし）'}</div>
        <div class="entry-meta">
          <span class="badge">${cat.name||''}</span>
          <span class="badge">${pay.name||''}</span>
        </div>
      </div>
      <div class="entry-right">
        <div class="entry-amount ${e.type}">
          ${e.type==='expense'?'-':'+'}${fmt(e.amount)}
        </div>
      </div>
      <button onclick="deleteEntry('${e.id}')">×</button>
    </div>`;
  }).join('');
}

function renderChart(list) {
  const expense = list.filter(e => e.type === 'expense');

  const totals = {};
  expense.forEach(e => {
    totals[e.cat] = (totals[e.cat] || 0) + e.amount;
  });

  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const allCats = [...CATS_EXPENSE, ...CATS_INCOME];

  document.getElementById('catBars').innerHTML = sorted.length
    ? sorted.map(([id, amt]) => {
        const cat = allCats.find(c => c.id === id) || { icon: '📦', name: id };
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
    : '<div style="text-align:center;padding:20px;color:#999;">データなし</div>';
}

function renderPayment(list) {
  const expense = list.filter(e => e.type === 'expense');

  const totals = {};
  const counts = {};

  expense.forEach(e => {
    totals[e.pay] = (totals[e.pay] || 0) + e.amount;
    counts[e.pay] = (counts[e.pay] || 0) + 1;
  });

  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  document.getElementById('paymentList').innerHTML = sorted.length
    ? sorted.map(([id, amt]) => {
        const pay = PAYMENTS.find(p => p.id === id) || { icon: '💸', name: id };
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
    : '<div style="text-align:center;padding:20px;color:#999;">データなし</div>';
}

function renderCatGrid(){
  const cats=selectedType==='expense'?CATS_EXPENSE:CATS_INCOME;
  selectedCat=cats[0].id;
  document.getElementById('catGrid').innerHTML=cats.map(c=>
    `<div class="chip ${c.id===selectedCat?'active':''}" onclick="selectCat('${c.id}',this)">
      <span>${c.icon}</span><span>${c.name}</span>
    </div>`
  ).join('');
}

function renderPayerGrid(){
  const container = document.getElementById('payerGrid');

  container.innerHTML = PAYERS.map(p => `
    <div class="payer-chip" data-id="${p.id}">
      <span>${p.icon}</span>
      <span>${p.name}</span>
    </div>
  `).join('');

  // 👇ここが重要（クリックイベント付与）
  container.querySelectorAll('.payer-chip').forEach(el => {
    el.addEventListener('click', () => {
      selectedPayer = el.dataset.id;

      container.querySelectorAll('.payer-chip')
        .forEach(c => c.classList.remove('active'));

      el.classList.add('active');
    });
  });

}
function renderPayGrid(){
  document.getElementById('payGrid').innerHTML=PAYMENTS.map(p=>
    `<div class="pay-chip ${p.id===selectedPay?'active':''}" onclick="selectPay('${p.id}',this)">
      <span>${p.icon}</span><span>${p.name}</span>
    </div>`
  ).join('');
}

function filterByViewer(list) {
  if (currentViewer === 'all') return list;

  return list
    .filter(e =>
      e.payer === currentViewer ||
      e.payer === 'split'
    )
    .map(e => ({
      ...e,
      amount:
        e.payer === 'split'
          ? e.amount * 0.5
          : e.amount
    }));
}