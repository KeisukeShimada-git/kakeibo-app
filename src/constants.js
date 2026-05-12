// ===== マスタデータ =====

export const CATS_EXPENSE = [
  { id: 'food',      icon: '🍜', name: '食費' },
  { id: 'transport', icon: '🚃', name: '交通' },
  { id: 'daily',     icon: '🛍', name: '日用品' },
  { id: 'social',    icon: '🍺', name: '交際費' },
  { id: 'house',     icon: '🏠', name: '住居' },
  { id: 'medical',   icon: '💊', name: '医療' },
  { id: 'edu',       icon: '📚', name: '教育' },
  { id: 'other',     icon: '📦', name: 'その他' },
];

export const CATS_INCOME = [
  { id: 'salary', icon: '💰', name: '給料' },
  { id: 'bonus',  icon: '🎁', name: 'ボーナス' },
  { id: 'side',   icon: '💻', name: '副業' },
  { id: 'other',  icon: '📦', name: 'その他' },
];

export const PAYMENTS = [
  { id: 'credit',   icon: '💳', name: 'クレカ' },
  { id: 'paypay',   icon: '📱', name: 'PayPay' },
  { id: 'cash',     icon: '💴', name: '現金' },
  { id: 'suica',    icon: '🚃', name: 'Suica/IC' },
  { id: 'transfer', icon: '🏦', name: '振込' },
  { id: 'other',    icon: '💸', name: 'その他' },
];

export const PAYERS = [
  { id: 'keisuke', icon: '👨', name: '慶佑' },
  { id: 'nene',    icon: '👩', name: '寧子' },
];

export const PAYERS_SPLIT = [
  { id: 'keisuke', icon: '👨', name: '慶佑' },
  { id: 'nene',    icon: '👩', name: '寧子' },
];

export const CAT_COLORS = {
  food:      '#E24B4A',
  transport: '#378ADD',
  daily:     '#D4537E',
  social:    '#EF9F27',
  house:     '#1D9E75',
  medical:   '#7F77DD',
  edu:       '#5DCAA5',
  salary:    '#1D9E75',
  bonus:     '#63C922',
  side:      '#378ADD',
  other:     '#888780',
};

export const ALL_CATS = [...CATS_EXPENSE, ...CATS_INCOME];

export function getCat(id) { return ALL_CATS.find(c => c.id === id) || { icon: '📦', name: id }; }
export function getPay(id) { return PAYMENTS.find(p => p.id === id) || { icon: '💸', name: id }; }
export function getPayer(id) { return PAYERS.find(p => p.id === id) || { icon: '👤', name: id }; }

export function fmt(n) { return '¥' + Math.abs(Math.round(n)).toLocaleString('ja-JP'); }
export function fmtSigned(n) { return (n >= 0 ? '+' : '-') + fmt(n); }