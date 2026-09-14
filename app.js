/* ═══════════════════════════════════════════════════════════════
   نظام إدارة قسم الحبل - مصنع الصندل
   app.js - Router + State + Auth + Permissions + Utilities
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. الحالة العامة
   ═══════════════════════════════════════════════════════════════ */
const AppState = {
  user: null,
  profile: null,
  permissions: {},
  role: 'viewer',
  currentRoute: 'dashboard',
  cache: {},
  realtimeSubs: [],
  currentPage: 1,
  pageSize: 20,
  processingLock: false,
  routeLoading: false  // ← منع التنقل المزدوج
};

/* ═══════════════════════════════════════════════════════════════
   2. المسارات
   ═══════════════════════════════════════════════════════════════ */
const ROUTES = {
  dashboard:       { title: 'لوحة التحكم',     subtitle: 'نظرة عامة على النظام',         icon: 'home',     module: 'dashboard' },
  sales:           { title: 'المبيعات',         subtitle: 'إدارة الفواتير والمبيعات',      icon: 'cart',     module: 'sales' },
  returns:         { title: 'المرتجعات',        subtitle: 'إدارة مرتجعات المبيعات',        icon: 'rotate',   module: 'returns' },
  customers:       { title: 'العملاء',          subtitle: 'إدارة العملاء وكشوف الحسابات',  icon: 'users',    module: 'customers' },
  suppliers:       { title: 'الموردين',         subtitle: 'إدارة الموردين والتعاملات',     icon: 'truck',    module: 'suppliers' },
  warehouse:       { title: 'المخزن',           subtitle: 'المنتجات والحركات',             icon: 'box',      module: 'warehouse' },
  treasury:        { title: 'الخزائن والبنوك',  subtitle: 'الكاش والبنك والتحويلات',       icon: 'wallet',   module: 'treasury' },
  expenses:        { title: 'المصروفات',        subtitle: 'المصروفات التشغيلية وغيرها',    icon: 'receipt',  module: 'expenses' },
  journal:         { title: 'القيود والقوائم',  subtitle: 'القيود اليومية والقوائم المالية', icon: 'book',   module: 'journal' },
  reconciliations: { title: 'التسويات',         subtitle: 'تسويات الكاش والبنك',           icon: 'scale',    module: 'reconciliations' },
  reports:         { title: 'التقارير',         subtitle: 'كل التقارير التفصيلية',         icon: 'chart',    module: 'reports' },
  permissions:     { title: 'الصلاحيات',        subtitle: 'المستخدمون والصلاحيات',         icon: 'shield',   module: 'permissions' },
  audit:           { title: 'التدقيق',          subtitle: 'سجل العمليات',                  icon: 'activity', module: 'audit' },
  settings:        { title: 'الإعدادات',        subtitle: 'إعدادات النظام',                icon: 'settings', module: 'settings' }
};

/* ═══════════════════════════════════════════════════════════════
   3. الأيقونات
   ═══════════════════════════════════════════════════════════════ */
const ICONS = {
  home:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  cart:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  rotate:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
  users:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  truck:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  box:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  wallet:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>`,
  receipt:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>`,
  book:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  scale:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 6h6z"/><path d="M19 7l3 6h-6z"/><circle cx="12" cy="3" r="1"/></svg>`,
  chart:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  shield:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  activity: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  check:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  plus:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  edit:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  print:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  upload:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  search:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  close:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  alert:    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:     `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  money:    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  clock:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
};

/* ═══════════════════════════════════════════════════════════════
   4. دوال مساعدة
   ═══════════════════════════════════════════════════════════════ */

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  const absNum = Math.abs(num);
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(absNum);
  
  if (num < 0) return '− ' + formatted + ' ج.س';
  return formatted + ' ج.س';
}

function money(amount) {
  const num = Number(amount) || 0;
  const formatted = formatCurrency(num);
  
  let color = 'var(--text)';
  if (num < 0) color = 'var(--danger)';
  else if (num > 0) color = 'var(--success)';
  
  return `<span style="color:${color};font-weight:700;direction:ltr;unicode-bidi:embed;display:inline-block;">${formatted}</span>`;
}

function formatNumber(n) {
  return new Intl.NumberFormat('ar-SD').format(Number(n) || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SD', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch { return dateStr; }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SD', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' - ' + d.toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

function todayISO() { return new Date().toISOString().split('T')[0]; }
function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function weekStartISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function debounce(fn, delay = 250) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** قفل العمليات لمنع النقر المزدوج */
function lockProcessing(btn, text = 'جاري المعالجة...') {
  if (!btn) return () => {};
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.dataset.processing = 'true';
  btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> ${text}`;
  return () => {
    btn.disabled = false;
    btn.innerHTML = originalText;
    delete btn.dataset.processing;
  };
}

/** حماية DOM - التأكد من وجود العنصر قبل الكتابة */
function safeSetHTML(elementId, html) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = html;
    return true;
  }
  return false;
}

/** انتظار حتى تصبح عناصر DOM جاهزة */
async function waitForDOM(timeout = 500) {
  return new Promise(resolve => {
    const start = Date.now();
    const check = () => {
      if (document.getElementById('content')) {
        resolve(true);
      } else if (Date.now() - start > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 20);
      }
    };
    check();
  });
}

/* ═══════════════════════════════════════════════════════════════
   5. Toast
   ═══════════════════════════════════════════════════════════════ */
function showToast(message, type = 'info', title = null, duration = 4000) {
  try {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const titles = { success: 'تم بنجاح', error: 'خطأ', warning: 'تنبيه', info: 'معلومة' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${ICONS[type === 'success' ? 'check' : type === 'error' ? 'close' : type === 'warning' ? 'alert' : 'info']}</div>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title || titles[type])}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 260);
    }, duration);
  } catch (err) { console.error('❌ showToast:', err); }
}

/* ═══════════════════════════════════════════════════════════════
   6. Modal
   ═══════════════════════════════════════════════════════════════ */
function openModal(title, bodyHtml, footerHtml = '') {
  try {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } catch (err) { console.error('❌ openModal:', err); }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   7. Confirm
   ═══════════════════════════════════════════════════════════════ */
function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    const icon = document.getElementById('confirm-icon');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');

    const type = options.type || 'warning';
    const emoji = { danger: '⚠️', warning: '⚡', info: 'ℹ️', success: '✅' }[type];
    icon.className = `confirm-icon ${type}`;
    icon.textContent = emoji;
    titleEl.textContent = options.title || 'تأكيد العملية';
    msgEl.textContent = message;
    okBtn.className = `btn btn-${type === 'danger' ? 'danger' : type === 'info' ? 'primary' : 'danger'}`;
    okBtn.textContent = options.okText || 'تأكيد';
    cancelBtn.textContent = options.cancelText || 'إلغاء';

    const cleanup = () => {
      overlay.classList.add('hidden');
      cancelBtn.removeEventListener('click', onCancel);
      okBtn.removeEventListener('click', onOk);
    };
    const onCancel = () => { cleanup(); resolve(false); };
    const onOk = () => { cleanup(); resolve(true); };

    cancelBtn.addEventListener('click', onCancel);
    okBtn.addEventListener('click', onOk);
    overlay.classList.remove('hidden');
  });
}

/* ═══════════════════════════════════════════════════════════════
   8. الصلاحيات
   ═══════════════════════════════════════════════════════════════ */
function hasPermission(module, action = 'view') {
  try {
    if (AppState.role === 'admin') return true;
    const perm = AppState.permissions[module];
    if (!perm) return false;
    return !!perm[`can_${action}`];
  } catch { return false; }
}

/* ═══════════════════════════════════════════════════════════════
   9. Router
   ═══════════════════════════════════════════════════════════════ */
function renderNavigation() {
  const nav = document.getElementById('sidebar-nav');
  const mobileNav = document.getElementById('mobile-nav');
  if (!nav || !mobileNav) return;

  const allowedRoutes = Object.entries(ROUTES).filter(([key, r]) => {
    if (AppState.role === 'admin') return true;
    return hasPermission(r.module, 'view');
  });

  nav.innerHTML = allowedRoutes.map(([key, r]) => `
    <a class="nav-item ${AppState.currentRoute === key ? 'active' : ''}" data-route="${key}">
      ${ICONS[r.icon]}
      <span>${r.title}</span>
    </a>
  `).join('');

  mobileNav.innerHTML = allowedRoutes.slice(0, 8).map(([key, r]) => `
    <a class="mobile-nav-item ${AppState.currentRoute === key ? 'active' : ''}" data-route="${key}">
      ${ICONS[r.icon]}
      <span>${r.title}</span>
    </a>
  `).join('');

  document.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.route);
      document.getElementById('sidebar')?.classList.remove('open');
    });
  });
}

function navigateTo(route) {
  try {
    if (!ROUTES[route]) route = 'dashboard';
    const routeInfo = ROUTES[route];

    if (AppState.role !== 'admin' && !hasPermission(routeInfo.module, 'view')) {
      showToast('لا تملك صلاحية الوصول لهذه الشاشة', 'warning');
      route = 'dashboard';
    }

    AppState.currentRoute = route;
    window.location.hash = `#${route}`;

    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = ROUTES[route].title;
    if (subtitleEl) subtitleEl.textContent = ROUTES[route].subtitle;

    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    renderRoute(route);
  } catch (err) { console.error('❌ navigateTo:', err); }
}

/**
 * ✅ renderRoute محدّث - يحل مشكلة "Cannot set properties of null"
 */
async function renderRoute(route) {
  // منع التنقل المزدوج
  if (AppState.routeLoading) {
    console.log('⏳ جاري تحميل شاشة أخرى... انتظر');
    return;
  }
  AppState.routeLoading = true;

  try {
    const container = document.getElementById('content');
    if (!container) {
      AppState.routeLoading = false;
      return;
    }

    // ✅ 1. عرض Skeleton أولاً
    container.innerHTML = `
      <div class="skeleton-wrap">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>`;

    // ✅ 2. انتظر حتى يبني المتصفح الـ DOM
    await new Promise(r => setTimeout(r, 80));

    const renderers = {
      dashboard:       () => window.Modules?.renderDashboard(container),
      sales:           () => window.Modules?.renderSales(container),
      returns:         () => window.Returns?.renderReturns(container),
      customers:       () => window.Modules?.renderCustomers(container),
      suppliers:       () => window.Modules?.renderSuppliers(container),
      warehouse:       () => window.Modules?.renderWarehouse(container),
      treasury:        () => window.Modules?.renderTreasury(container),
      expenses:        () => window.Modules?.renderExpenses(container),
      journal:         () => window.Advanced?.renderJournal(container),
      reconciliations: () => window.Advanced?.renderReconciliations(container),
      audit:           () => window.Advanced?.renderAudit(container),
      permissions:     () => window.Advanced?.renderPermissions(container),
      settings:        () => window.Advanced?.renderSettings(container),
      reports:         () => window.Reports?.renderReportsHome(container)
    };

    const fn = renderers[route];
    if (fn) {
      // ✅ 3. انتظر انتهاء الدالة بالكامل
      await fn();
    } else {
      container.innerHTML = `<div class="empty-state"><h3>الشاشة قيد التطوير</h3></div>`;
    }

    // ✅ 4. انتظر إضافي ليستقر DOM
    await new Promise(r => setTimeout(r, 50));

  } catch (err) {
    console.error('❌ renderRoute:', err);
    const container = document.getElementById('content');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>حدث خطأ في تحميل الشاشة</h3>
          <p>${escapeHtml(err.message)}</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="window.App.navigateTo('dashboard')">
            العودة للوحة التحكم
          </button>
        </div>`;
    }
  } finally {
    AppState.routeLoading = false;
  }
}

function showSkeleton() {
  const container = document.getElementById('content');
  if (!container) return;
  container.innerHTML = `
    <div class="skeleton-wrap">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </div>`;
}

function hideSkeleton() {}

/* ═══════════════════════════════════════════════════════════════
   10. Auth
   ═══════════════════════════════════════════════════════════════ */

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    errorEl.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'جاري الدخول...';
    btn.querySelector('.btn-loader').classList.remove('hidden');
    errorEl.classList.add('hidden');

    const { data, error } = await window.SB.login(email, password);
    if (error) throw new Error(translateAuthError(error));

    const { data: profile } = await window.SB.getUserProfile(data.user.id);
    if (!profile) throw new Error('المستخدم غير مسجل في النظام');

    AppState.user = data.user;
    AppState.profile = profile;
    AppState.role = profile.role;

    const { data: perms } = await window.SB.getUserPermissions(profile.id);
    AppState.permissions = {};
    (perms || []).forEach(p => { AppState.permissions[p.module] = p; });

    await window.SB.logAudit('login', 'auth', null, { email });
    await enterApp();
  } catch (err) {
    console.error('❌ Login:', err);
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'تسجيل الدخول';
    btn.querySelector('.btn-loader').classList.add('hidden');
  }
}

function translateAuthError(msg) {
  const map = {
    'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'Email not confirmed': 'البريد الإلكتروني غير مُفعّل',
    'Too many requests': 'محاولات كثيرة، حاول بعد قليل',
    'User not found': 'المستخدم غير موجود',
    'Invalid email': 'البريد الإلكتروني غير صحيح'
  };
  for (const k in map) if (msg.includes(k)) return map[k];
  return msg;
}

async function enterApp() {
  // ✅ 1. أخفِ شاشة الدخول وأظهر التطبيق فوراً
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // ✅ 2. بيانات المستخدم (سريعة)
  const initial = (AppState.profile.full_name || 'م').trim().charAt(0);
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-name').textContent = AppState.profile.full_name || 'مستخدم';
  document.getElementById('user-role').textContent = 
    AppState.profile.role === 'admin' ? 'مدير النظام' : AppState.profile.role;

  // ✅ 3. بناء القائمة
  renderNavigation();

  // ✅ 4. التنقل للصفحة المطلوبة
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);

  // ✅ 5. Realtime في الخلفية (لا يوقف شيء)
  setTimeout(() => setupRealtime(), 1000);
}

function setupRealtime() {
  try {
    const tables = ['sales', 'products', 'cash_transactions', 'bank_transactions', 'expenses', 'customers', 'returns'];
    tables.forEach(t => {
      window.SB.subscribeToTable(t, () => {
        // ✅ فقط لو على لوحة التحكم
        if (AppState.currentRoute === 'dashboard' && !AppState.routeLoading) {
          window.Modules?.refreshDashboard?.();
        }
      });
    });
  } catch (err) { console.warn('⚠️ Realtime:', err); }
}

async function handleLogout() {
  const ok = await confirmDialog('هل تريد تسجيل الخروج؟', {
    title: 'تسجيل الخروج', type: 'warning', okText: 'تسجيل الخروج'
  });
  if (!ok) return;
  try {
    await window.SB.logAudit('logout', 'auth');
    await window.SB.unsubscribeAll();
    await window.SB.logout();
    location.reload();
  } catch (err) { showToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════
   11. Global Search
   ═══════════════════════════════════════════════════════════════ */
function openGlobalSearch() {
  document.getElementById('search-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('global-search-input')?.focus(), 100);
}

function closeGlobalSearch() {
  document.getElementById('search-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  document.getElementById('global-search-input').value = '';
  document.getElementById('search-results').innerHTML = '<div class="search-empty">اكتب للبحث في: المنتجات، العملاء، الموردين، الفواتير...</div>';
}

const performGlobalSearch = debounce(async (query) => {
  const resultsEl = document.getElementById('search-results');
  if (!query || query.length < 2) {
    resultsEl.innerHTML = '<div class="search-empty">اكتب للبحث في: المنتجات، العملاء، الموردين، الفواتير...</div>';
    return;
  }

  resultsEl.innerHTML = '<div class="search-empty">جاري البحث...</div>';
  const results = [];

  try {
    const { data: products } = await window.SB.select('products', { like: { name: query }, limit: 5 });
    products.forEach(p => results.push({ type: 'منتج', title: p.name, sub: `الكمية: ${p.quantity} ${p.unit}`, route: 'warehouse', icon: 'box' }));

    const { data: customers } = await window.SB.select('customers', { like: { name: query }, limit: 5 });
    customers.forEach(c => results.push({ type: 'عميل', title: c.name, sub: c.phone || '', route: 'customers', icon: 'users' }));

    const { data: suppliers } = await window.SB.select('suppliers', { like: { name: query }, limit: 5 });
    suppliers.forEach(s => results.push({ type: 'مورد', title: s.name, sub: s.phone || '', route: 'suppliers', icon: 'truck' }));

    const { data: sales } = await window.SB.select('sales', { like: { invoice_number: query }, limit: 5 });
    sales.forEach(s => results.push({ type: 'فاتورة', title: s.invoice_number, sub: formatCurrency(s.total), route: 'sales', icon: 'cart' }));

    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="search-empty">لا توجد نتائج مطابقة</div>';
      return;
    }

    resultsEl.innerHTML = results.map(r => `
      <div class="search-item" data-route="${r.route}">
        <div class="search-item-icon">${ICONS[r.icon]}</div>
        <div class="search-item-info">
          <div class="search-item-title">${escapeHtml(r.title)}</div>
          <div class="search-item-sub">${r.type} • ${escapeHtml(r.sub)}</div>
        </div>
      </div>
    `).join('');

    resultsEl.querySelectorAll('.search-item').forEach(el => {
      el.addEventListener('click', () => {
        closeGlobalSearch();
        navigateTo(el.dataset.route);
      });
    });
  } catch (err) {
    resultsEl.innerHTML = `<div class="search-empty">خطأ: ${escapeHtml(err.message)}</div>`;
  }
}, 250);

/* ═══════════════════════════════════════════════════════════════
   12. Keyboard Shortcuts
   ═══════════════════════════════════════════════════════════════ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeGlobalSearch();
      document.getElementById('confirm-overlay')?.classList.add('hidden');
      document.getElementById('sheet-overlay')?.classList.add('hidden');
      document.getElementById('sidebar')?.classList.remove('open');
      document.body.style.overflow = '';
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openGlobalSearch();
      return;
    }

    if (e.target.matches('input, textarea, select')) return;

    const routes = ['dashboard', 'sales', 'returns', 'customers', 'suppliers', 'warehouse', 'treasury', 'expenses', 'journal', 'reconciliations', 'reports', 'permissions', 'audit'];
    const match = e.key.match(/^F(\d{1,2})$/);
    if (match) {
      const num = parseInt(match[1]);
      if (num >= 1 && num <= 13) {
        e.preventDefault();
        navigateTo(routes[num - 1]);
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   13. Event Listeners
   ═══════════════════════════════════════════════════════════════ */
function setupEventListeners() {
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  document.getElementById('toggle-password')?.addEventListener('click', () => {
    const input = document.getElementById('login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.getElementById('global-search-btn')?.addEventListener('click', openGlobalSearch);
  document.getElementById('search-close')?.addEventListener('click', closeGlobalSearch);
  document.getElementById('search-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'search-overlay') closeGlobalSearch();
  });
  document.getElementById('global-search-input')?.addEventListener('input', (e) => {
    performGlobalSearch(e.target.value.trim());
  });

  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    showToast('جاري تحديث البيانات...', 'info', 'تحديث', 1500);
    if (!AppState.routeLoading) renderRoute(AppState.currentRoute);
  });

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  });

  window.addEventListener('hashchange', () => {
    const route = window.location.hash.replace('#', '') || 'dashboard';
    if (route !== AppState.currentRoute) navigateTo(route);
  });
}

/* ═══════════════════════════════════════════════════════════════
   14. معالج الأخطاء العام
   ═══════════════════════════════════════════════════════════════ */
function setupGlobalErrorHandler() {
  // تجاهل أخطاء DOM المؤقتة (Cannot set innerHTML of null)
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (msg.includes('innerHTML') || msg.includes('Cannot set properties of null')) {
      console.warn('⚠️ تم تجاهل خطأ DOM مؤقت:', msg);
      event.preventDefault();
      return true;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || '';
    if (msg.includes('innerHTML') || msg.includes('Cannot set properties of null')) {
      console.warn('⚠️ تم تجاهل خطأ Promise مؤقت:', msg);
      event.preventDefault();
    }
  });
}









/* ═══════════════════════════════════════════════════════════════
   15. Init
   ═══════════════════════════════════════════════════════════════ */
async function initApp() {
  try {
    console.log('🚀 بدء تشغيل النظام...');
    const startTime = performance.now();

    // ✅ 1. حمّل المظهر فوراً
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') document.body.classList.add('light-mode');

    // ✅ 2. جهّز الأحداث
    setupEventListeners();
    setupKeyboardShortcuts();
    setupGlobalErrorHandler();

    // ✅ 3. جلب الجلسة (بالتوازي مع إخفاء Splash)
    const sessionPromise = window.SB.getSession();

    // ✅ 4. أخفِ Splash بسرعة (1.2 ثانية بدل 1.9)
    setTimeout(() => {
      document.getElementById('splash')?.classList.add('fade-out');
      setTimeout(() => document.getElementById('splash')?.remove(), 400);
    }, 1200);

    await new Promise(r => setTimeout(r, 1300));

    // ✅ 5. الجلسة
    const { session } = await sessionPromise;

    if (session) {
      // ✅ 6. جلب profile + permissions بالتوازي
      const [profileResult, permsResult] = await Promise.all([
        window.SB.getUserProfile(session.user.id),
        window.SB.getUserPermissions(session.user.id)
      ]);

      const profile = profileResult.data;
      const perms = permsResult.data;

      if (profile && profile.is_active !== false) {
        AppState.user = session.user;
        AppState.profile = profile;
        AppState.role = profile.role;

        AppState.permissions = {};
        (perms || []).forEach(p => { AppState.permissions[p.module] = p; });

        await enterApp();

        const loadTime = Math.round(performance.now() - startTime);
        console.log(`⚡ النظام جاهز في ${loadTime}ms`);
        return;
      }
    }

    document.getElementById('login-screen').classList.remove('hidden');
    console.log(`⚡ شاشة الدخول جاهزة في ${Math.round(performance.now() - startTime)}ms`);
  } catch (err) {
    console.error('❌ Init error:', err);
    showToast('حدث خطأ أثناء بدء التشغيل', 'error');
    document.getElementById('splash')?.classList.add('fade-out');
    setTimeout(() => document.getElementById('login-screen')?.classList.remove('hidden'), 300);
  }
}
/* ═══════════════════════════════════════════════════════════════
   16. Export
   ═══════════════════════════════════════════════════════════════ */
window.App = {
  state: AppState,
  routes: ROUTES,
  icons: ICONS,
  formatCurrency,
  money,                    // ← أضف هذا السطر
  formatNumber,
  formatDate,
  formatDateTime,
  todayISO,
  monthStartISO,
  weekStartISO,
  debounce,
  escapeHtml,
  uid,
  lockProcessing,
  safeSetHTML,
  waitForDOM,
  showToast,
  openModal,
  closeModal,
  confirmDialog,
  showSkeleton,
  navigateTo,
  renderRoute,
  renderNavigation,
  hasPermission,
  handleLogin,
  handleLogout,
  openGlobalSearch,
  closeGlobalSearch
};

document.addEventListener('DOMContentLoaded', initApp);
console.log('✅ app.js جاهز (محدّث - معالج أخطاء DOM)');
