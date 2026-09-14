/* ═══════════════════════════════════════════════════════════════
   نظام إدارة قسم الحبل - مصنع الصندل
   reports.js - كل التقارير + القوائم المالية (يومي/أسبوعي/شهري)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   الصفحة الرئيسية للتقارير
   ═══════════════════════════════════════════════════════════════ */

const REPORTS_LIST = [
  { key: 'sales',           title: 'تقرير المبيعات',        desc: 'فواتير المبيعات حسب الفترة', icon: 'cart',     color: 'blue' },
  { key: 'returns',         title: 'تقرير المرتجعات',       desc: 'مرتجعات المبيعات',           icon: 'rotate',   color: 'gold' },
  { key: 'customers',       title: 'تقرير العملاء',         desc: 'أرصدة العملاء والمبيعات',    icon: 'users',    color: 'green' },
  { key: 'suppliers',       title: 'تقرير الموردين',        desc: 'بيانات الموردين والأرصدة',   icon: 'truck',    color: 'cyan' },
  { key: 'warehouse',       title: 'تقرير المخزن',          desc: 'الأرصدة والحركات',           icon: 'box',      color: 'purple' },
  { key: 'treasury',        title: 'تقرير الخزنة',          desc: 'حركات الكاش والبنك',         icon: 'wallet',   color: 'gold' },
  { key: 'expenses',        title: 'تقرير المصروفات',       desc: 'المصروفات حسب الفئة',        icon: 'receipt',  color: 'red' },
  { key: 'journal',         title: 'تقرير القيود',          desc: 'دفتر اليومية',               icon: 'book',     color: 'blue' },
  { key: 'audit',           title: 'تقرير التدقيق',         desc: 'سجل عمليات النظام',          icon: 'activity', color: 'purple' },
  { key: 'reconciliations', title: 'تقرير التسويات',        desc: 'تسويات الكاش والبنك',        icon: 'scale',    color: 'gold' },
  { key: 'financial',       title: 'التقارير المالية',      desc: 'قائمة الدخل والمركز المالي', icon: 'chart',    color: 'green' }
];

async function renderReportsHome(container) {
  try {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>التقارير</h2>
          <p>اختر التقرير الذي تريد عرضه</p>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));">
        ${REPORTS_LIST.map(r => `
          <div class="kpi-card" style="cursor:pointer;flex-direction:column;align-items:flex-start;gap:12px;padding:20px;" onclick="window.Reports.openReport('${r.key}')">
            <div class="kpi-icon ${r.color}" style="width:48px;height:48px;border-radius:14px;">
              ${window.App.icons[r.icon] || window.App.icons.info}
            </div>
            <div>
              <div style="font-size:14.5px;font-weight:800;color:var(--text);margin-bottom:4px;">${r.title}</div>
              <div style="font-size:12px;color:var(--text-3);">${r.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function openReport(key) {
  try {
    const container = document.getElementById('content');
    const r = REPORTS_LIST.find(x => x.key === key);
    if (r) {
      document.getElementById('page-title').textContent = r.title;
      document.getElementById('page-subtitle').textContent = r.desc;
    }

    container.innerHTML = '<div class="skeleton-wrap"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>';

    const renderers = {
      sales:           renderSalesReport,
      returns:         renderReturnsReport,
      customers:       renderCustomersReport,
      suppliers:       renderSuppliersReport,
      warehouse:       renderWarehouseReport,
      treasury:        renderTreasuryReport,
      expenses:        renderExpensesReport,
      journal:         renderJournalReport,
      audit:           renderAuditReport,
      reconciliations: renderReconciliationsReport,
      financial:       renderFinancialReport
    };

    const fn = renderers[key];
    if (fn) await fn(container);
    else container.innerHTML = `<div class="empty-state"><h3>التقرير قيد التطوير</h3></div>`;
  } catch (err) {
    window.App.showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   مكونات التقارير - نظام اليومي/الأسبوعي/الشهري
   ═══════════════════════════════════════════════════════════════ */

/**
 * توليد شريط اختيار الفترة (يومي / أسبوعي / شهري / مخصص)
 */
function periodSelector(idPrefix, defaultMode = 'month') {
  return `
    <div class="report-mode-tabs" data-prefix="${idPrefix}">
      <button class="report-mode-tab ${defaultMode === 'day' ? 'active' : ''}" data-mode="day">يومي</button>
      <button class="report-mode-tab ${defaultMode === 'week' ? 'active' : ''}" data-mode="week">أسبوعي</button>
      <button class="report-mode-tab ${defaultMode === 'month' ? 'active' : ''}" data-mode="month">شهري</button>
      <button class="report-mode-tab ${defaultMode === 'custom' ? 'active' : ''}" data-mode="custom">مخصص</button>
    </div>

    <div class="filter-bar" id="${idPrefix}-filters">
      <div class="input-group" id="${idPrefix}-day-wrap">
        <label>اليوم</label>
        <input type="date" id="${idPrefix}-day" value="${window.App.todayISO()}">
      </div>

      <div class="input-group hidden" id="${idPrefix}-week-wrap">
        <label>الأسبوع (اختر أي يوم فيه)</label>
        <input type="date" id="${idPrefix}-week" value="${window.App.todayISO()}">
      </div>

      <div class="input-group hidden" id="${idPrefix}-month-wrap">
        <label>الشهر</label>
        <input type="month" id="${idPrefix}-month" value="${window.App.todayISO().slice(0, 7)}">
      </div>

      <div class="input-group hidden" id="${idPrefix}-from-wrap">
        <label>من تاريخ</label>
        <input type="date" id="${idPrefix}-from" value="${window.App.monthStartISO()}">
      </div>

      <div class="input-group hidden" id="${idPrefix}-to-wrap">
        <label>إلى تاريخ</label>
        <input type="date" id="${idPrefix}-to" value="${window.App.todayISO()}">
      </div>

      <button class="btn btn-primary" id="${idPrefix}-filter">${window.App.icons.search} عرض</button>
      <button class="btn btn-ghost" id="${idPrefix}-print">${window.App.icons.print} طباعة</button>
      <button class="btn btn-ghost" id="${idPrefix}-excel">${window.App.icons.download} Excel</button>
      <button class="btn btn-ghost" onclick="window.Reports.back()">رجوع</button>
    </div>
  `;
}

/**
 * تهيئة شريط الفترة (يُستدعى بعد إدخال HTML)
 */
function initPeriodSelector(idPrefix, onFilter) {
  const tabs = document.querySelectorAll(`.report-mode-tabs[data-prefix="${idPrefix}"] .report-mode-tab`);
  const state = { mode: 'month' };

  const updateVisibility = () => {
    ['day', 'week', 'month'].forEach(m => {
      document.getElementById(`${idPrefix}-${m}-wrap`)?.classList.toggle('hidden', state.mode !== m);
    });
    document.getElementById(`${idPrefix}-from-wrap`)?.classList.toggle('hidden', state.mode !== 'custom');
    document.getElementById(`${idPrefix}-to-wrap`)?.classList.toggle('hidden', state.mode !== 'custom');
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.mode = tab.dataset.mode;
      updateVisibility();
    });
  });

  updateVisibility();

  document.getElementById(`${idPrefix}-filter`)?.addEventListener('click', () => onFilter(state.mode));
  document.getElementById(`${idPrefix}-print`)?.addEventListener('click', () => window.print());

  return state;
}

/**
 * حساب نطاق التواريخ من الوضع المحدد
 */
function getDateRange(idPrefix, mode) {
  let from, to;
  const today = window.App.todayISO();

  if (mode === 'day') {
    const day = document.getElementById(`${idPrefix}-day`)?.value || today;
    from = day;
    to = day;
  } else if (mode === 'week') {
    const chosen = document.getElementById(`${idPrefix}-week`)?.value || today;
    const d = new Date(chosen);
    const dayOfWeek = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    from = start.toISOString().split('T')[0];
    to = end.toISOString().split('T')[0];
  } else if (mode === 'month') {
    const monthStr = document.getElementById(`${idPrefix}-month`)?.value || today.slice(0, 7);
    const [y, m] = monthStr.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    from = start.toISOString().split('T')[0];
    to = end.toISOString().split('T')[0];
  } else {
    from = document.getElementById(`${idPrefix}-from`)?.value;
    to = document.getElementById(`${idPrefix}-to`)?.value;
  }

  return { from, to, label: getRangeLabel(from, to, mode) };
}

function getRangeLabel(from, to, mode) {
  const labels = { day: 'اليوم', week: 'الأسبوع', month: 'الشهر', custom: 'الفترة المخصصة' };
  if (mode === 'custom') return `${from || '—'} إلى ${to || '—'}`;
  return `${labels[mode]}: ${from} إلى ${to}`;
}

function backToReports() {
  document.getElementById('page-title').textContent = 'التقارير';
  document.getElementById('page-subtitle').textContent = 'كل التقارير التفصيلية';
  renderReportsHome(document.getElementById('content'));
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 1: المبيعات
   ═══════════════════════════════════════════════════════════════ */

async function renderSalesReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-sales')}
    <div id="rep-sales-body"></div>
  `;

  const state = initPeriodSelector('rep-sales', loadSalesReport);
  document.getElementById('rep-sales-excel')?.addEventListener('click', exportSalesReport);

  await loadSalesReport(state.mode);
}

async function loadSalesReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-sales-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-sales', mode);

    const opts = { select: '*, customers(name)', order: { column: 'created_at', ascending: false } };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };

    const { data } = await window.SB.select('sales', opts);

    const total = data.reduce((s, r) => s + Number(r.total), 0);
    const paidCash = data.reduce((s, r) => s + Number(r.paid_cash), 0);
    const paidBank = data.reduce((s, r) => s + Number(r.paid_bank), 0);
    const remaining = data.reduce((s, r) => s + Number(r.remaining), 0);
    const totalDiscount = data.reduce((s, r) => s + Number(r.discount_amount || 0), 0);

    // تجميع حسب العميل
    const byCustomer = {};
    data.forEach(s => {
      const name = s.customers?.name || 'عميل نقدي';
      if (!byCustomer[name]) byCustomer[name] = { total: 0, count: 0, remaining: 0 };
      byCustomer[name].total += Number(s.total);
      byCustomer[name].count++;
      byCustomer[name].remaining += Number(s.remaining);
    });

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(59,130,246,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('إجمالي المبيعات', window.App.formatCurrency(total), 'cart', 'blue')}
        ${window.Modules.kpiCard('المحصّل كاش', window.App.formatCurrency(paidCash), 'wallet', 'gold')}
        ${window.Modules.kpiCard('المحصّل بنك', window.App.formatCurrency(paidBank), 'money', 'cyan')}
        ${window.Modules.kpiCard('المتبقي (آجل)', window.App.formatCurrency(remaining), 'alert', remaining > 0 ? 'red' : 'green')}
        ${window.Modules.kpiCard('إجمالي الخصومات', window.App.formatCurrency(totalDiscount), 'activity', 'purple')}
        ${window.Modules.kpiCard('عدد الفواتير', window.App.formatNumber(data.length), 'receipt', 'green')}
      </div>

      ${Object.keys(byCustomer).length > 0 ? `
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><div class="card-title">${window.App.icons.users} تفاصيل حسب العميل</div></div>
          <div class="table-wrap" style="background:transparent;border:none;">
            <table class="responsive">
              <thead><tr><th>العميل</th><th>عدد الفواتير</th><th>إجمالي المبيعات</th><th>المتبقي</th></tr></thead>
              <tbody>
                ${Object.entries(byCustomer).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => `
                  <tr>
                    <td data-label="العميل"><strong>${window.App.escapeHtml(name)}</strong></td>
                    <td data-label="عدد الفواتير">${d.count}</td>
                    <td data-label="الإجمالي">${window.App.formatCurrency(d.total)}</td>
                    <td data-label="المتبقي" class="${d.remaining > 0 ? 'text-danger' : ''}">${window.App.formatCurrency(d.remaining)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.receipt} الفواتير التفصيلية</div></div>
        <div class="table-wrap" style="background:transparent;border:none;">
          <table class="responsive">
            <thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>الإجمالي</th><th>الخصم</th><th>كاش</th><th>بنك</th><th>متبقي</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>
              ${data.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-3);">لا توجد بيانات</td></tr>' :
                data.map(s => `
                  <tr>
                    <td data-label="الفاتورة"><strong>${window.App.escapeHtml(s.invoice_number)}</strong></td>
                    <td data-label="العميل">${window.App.escapeHtml(s.customers?.name || 'عميل نقدي')}</td>
                    <td data-label="الإجمالي">${window.App.formatCurrency(s.total)}</td>
                    <td data-label="الخصم" class="${s.discount_amount > 0 ? 'text-warning' : ''}">${s.discount_amount > 0 ? window.App.formatCurrency(s.discount_amount) : '—'}</td>
                    <td data-label="كاش" class="text-success">${window.App.formatCurrency(s.paid_cash)}</td>
                    <td data-label="بنك" class="text-success">${window.App.formatCurrency(s.paid_bank)}</td>
                    <td data-label="متبقي" class="${s.remaining > 0 ? 'text-danger' : ''}">${window.App.formatCurrency(s.remaining)}</td>
                    <td data-label="الحالة">${window.Modules.statusBadge(s.status)}</td>
                    <td data-label="التاريخ">${window.App.formatDate(s.created_at)}</td>
                  </tr>`).join('')}
            </tbody>
            ${data.length > 0 ? `
              <tfoot>
                <tr style="background:rgba(59,130,246,0.1);font-weight:700;">
                  <td colspan="2">الإجمالي</td>
                  <td>${window.App.formatCurrency(total)}</td>
                  <td>${window.App.formatCurrency(totalDiscount)}</td>
                  <td>${window.App.formatCurrency(paidCash)}</td>
                  <td>${window.App.formatCurrency(paidBank)}</td>
                  <td>${window.App.formatCurrency(remaining)}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('rep-sales-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function exportSalesReport() {
  const { from, to } = getDateRange('rep-sales', 'month');
  const opts = { select: '*, customers(name)', order: { column: 'created_at', ascending: false } };
  if (from) opts.gte = { created_at: from };
  if (to) opts.lte = { created_at: to + 'T23:59:59' };

  const { data } = await window.SB.select('sales', opts);
  const rows = [
    ['رقم الفاتورة', 'العميل', 'المجموع الفرعي', 'الخصم', 'الإجمالي', 'كاش', 'بنك', 'متبقي', 'الطريقة', 'الحالة', 'التاريخ'],
    ...data.map(s => [
      s.invoice_number, s.customers?.name || 'عميل نقدي',
      s.subtotal || '', s.discount_amount || 0, s.total, s.paid_cash, s.paid_bank, s.remaining,
      s.payment_method, s.status, window.App.formatDateTime(s.created_at)
    ])
  ];
  window.Modules.downloadCSV(rows, 'sales-report');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 2: المرتجعات
   ═══════════════════════════════════════════════════════════════ */

async function renderReturnsReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-ret')}
    <div id="rep-ret-body"></div>
  `;

  const state = initPeriodSelector('rep-ret', loadReturnsReport);
  document.getElementById('rep-ret-excel')?.addEventListener('click', exportReturnsReport);

  await loadReturnsReport(state.mode);
}

async function loadReturnsReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-ret-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-ret', mode);
    const opts = { select: '*, customers(name), sales(invoice_number)', order: { column: 'created_at', ascending: false } };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };

    const { data } = await window.SB.select('returns', opts);

    const total = data.reduce((s, r) => s + Number(r.total), 0);
    const approved = data.filter(r => r.status === 'approved');
    const approvedTotal = approved.reduce((s, r) => s + Number(r.total), 0);

    const byType = {};
    data.forEach(r => {
      byType[r.refund_type] = (byType[r.refund_type] || 0) + Number(r.total);
    });

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(245,158,11,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('إجمالي المرتجعات', window.App.formatCurrency(total), 'rotate', 'gold')}
        ${window.Modules.kpiCard('المعتمدة', window.App.formatCurrency(approvedTotal), 'check', 'green')}
        ${window.Modules.kpiCard('عدد المرتجعات', window.App.formatNumber(data.length), 'activity', 'blue')}
        ${window.Modules.kpiCard('قيد الانتظار', window.App.formatNumber(data.filter(r => r.status === 'pending').length), 'clock', 'red')}
      </div>

      ${Object.keys(byType).length > 0 ? `
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><div class="card-title">${window.App.icons.money} توزيع حسب طريقة الاسترداد</div></div>
          <div class="table-wrap" style="background:transparent;border:none;">
            <table>
              <thead><tr><th>الطريقة</th><th>المبلغ</th><th>النسبة</th></tr></thead>
              <tbody>
                ${Object.entries(byType).map(([type, amt]) => {
                  const labels = { cash: 'كاش', bank: 'بنك', customer_credit: 'رصيد للعميل', none: 'بدون استرداد' };
                  return `
                    <tr>
                      <td>${labels[type] || type}</td>
                      <td>${window.App.formatCurrency(amt)}</td>
                      <td>${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.rotate} المرتجعات التفصيلية</div></div>
        <div class="table-wrap" style="background:transparent;border:none;">
          <table class="responsive">
            <thead><tr><th>رقم المرتجع</th><th>الفاتورة</th><th>العميل</th><th>المبلغ</th><th>طريقة الاسترداد</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>
              ${data.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-3);">لا توجد بيانات</td></tr>' :
                data.map(r => `
                  <tr>
                    <td data-label="رقم المرتجع"><strong>${window.App.escapeHtml(r.return_number || '—')}</strong></td>
                    <td data-label="الفاتورة">${window.App.escapeHtml(r.sales?.invoice_number || '—')}</td>
                    <td data-label="العميل">${window.App.escapeHtml(r.customers?.name || '—')}</td>
                    <td data-label="المبلغ">${window.App.formatCurrency(r.total)}</td>
                    <td data-label="طريقة الاسترداد">${r.refund_type === 'cash' ? 'كاش' : r.refund_type === 'bank' ? 'بنك' : r.refund_type === 'customer_credit' ? 'رصيد للعميل' : 'بدون'}</td>
                    <td data-label="الحالة">${window.Modules.statusBadge(r.status)}</td>
                    <td data-label="التاريخ">${window.App.formatDate(r.created_at)}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('rep-ret-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function exportReturnsReport() {
  const { from, to } = getDateRange('rep-ret', 'month');
  const opts = { select: '*, customers(name), sales(invoice_number)' };
  if (from) opts.gte = { created_at: from };
  if (to) opts.lte = { created_at: to + 'T23:59:59' };

  const { data } = await window.SB.select('returns', opts);
  const rows = [['رقم المرتجع', 'الفاتورة', 'العميل', 'المبلغ', 'الاسترداد', 'الحالة', 'التاريخ'],
    ...data.map(r => [r.return_number || '', r.sales?.invoice_number || '', r.customers?.name || '', r.total, r.refund_type, r.status, window.App.formatDateTime(r.created_at)])];
  window.Modules.downloadCSV(rows, 'returns-report');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 3: العملاء
   ═══════════════════════════════════════════════════════════════ */

async function renderCustomersReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-cust')}
    <div id="rep-cust-body"></div>
  `;

  const state = initPeriodSelector('rep-cust', loadCustomersReport);
  document.getElementById('rep-cust-excel')?.addEventListener('click', () => {
    window.SB.select('customers', { order: { column: 'name' } }).then(({ data }) => {
      const rows = [['الاسم', 'الهاتف', 'العنوان', 'الرصيد'],
        ...data.map(c => [c.name, c.phone || '', c.address || '', c.balance])];
      window.Modules.downloadCSV(rows, 'customers-report');
      window.App.showToast('تم التصدير', 'success');
    });
  });

  await loadCustomersReport(state.mode);
}

async function loadCustomersReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-cust-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-cust', mode);

    const { data: customers } = await window.SB.select('customers', { order: { column: 'name' } });

    const results = [];
    for (const c of customers) {
      const opts = { eq: { customer_id: c.id, status: 'approved' } };
      if (from) opts.gte = { created_at: from };
      if (to) opts.lte = { created_at: to + 'T23:59:59' };
      const { data: sales } = await window.SB.select('sales', opts);
      const total = sales.reduce((s, r) => s + Number(r.total), 0);
      const paid = sales.reduce((s, r) => s + Number(r.paid_cash) + Number(r.paid_bank), 0);
      const remaining = sales.reduce((s, r) => s + Number(r.remaining), 0);

      // سدادات في نفس الفترة
      const payOpts = { eq: { customer_id: c.id } };
      if (from) payOpts.gte = { created_at: from };
      if (to) payOpts.lte = { created_at: to + 'T23:59:59' };
      const { data: payments } = await window.SB.select('customer_payments', payOpts);
      const paidViaPayments = (payments || []).reduce((s, p) => s + Number(p.amount), 0);

      results.push({ customer: c, total, paid: paid + paidViaPayments, remaining, count: sales.length });
    }

    const grandTotal = results.reduce((s, r) => s + r.total, 0);
    const grandRemaining = results.reduce((s, r) => s + r.remaining, 0);
    const grandPaid = results.reduce((s, r) => s + r.paid, 0);

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(59,130,246,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('إجمالي العملاء', window.App.formatNumber(customers.length), 'users', 'blue')}
        ${window.Modules.kpiCard('إجمالي المبيعات', window.App.formatCurrency(grandTotal), 'cart', 'green')}
        ${window.Modules.kpiCard('إجمالي المحصّل', window.App.formatCurrency(grandPaid), 'money', 'gold')}
        ${window.Modules.kpiCard('إجمالي المتبقي', window.App.formatCurrency(grandRemaining), 'alert', grandRemaining > 0 ? 'red' : 'green')}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.users} تفاصيل العملاء</div></div>
        <div class="table-wrap" style="background:transparent;border:none;">
          <table class="responsive">
            <thead><tr><th>العميل</th><th>الهاتف</th><th>عدد الفواتير</th><th>المبيعات</th><th>المحصّل</th><th>المتبقي (الفترة)</th><th>الرصيد الحالي</th></tr></thead>
            <tbody>
              ${results.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-3);">لا توجد بيانات</td></tr>' :
                results.map(r => `
                  <tr>
                    <td data-label="العميل"><strong>${window.App.escapeHtml(r.customer.name)}</strong></td>
                    <td data-label="الهاتف">${window.App.escapeHtml(r.customer.phone || '—')}</td>
                    <td data-label="عدد الفواتير">${r.count}</td>
                    <td data-label="المبيعات">${window.App.formatCurrency(r.total)}</td>
                    <td data-label="المحصّل" class="text-success">${window.App.formatCurrency(r.paid)}</td>
                    <td data-label="المتبقي" class="${r.remaining > 0 ? 'text-danger' : ''}">${window.App.formatCurrency(r.remaining)}</td>
                    <td data-label="الرصيد الحالي"><strong>${window.App.formatCurrency(r.customer.balance)}</strong></td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('rep-cust-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 4: الموردين
   ═══════════════════════════════════════════════════════════════ */

async function renderSuppliersReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-sup')}
    <div id="rep-sup-body"></div>
  `;

  const state = initPeriodSelector('rep-sup', loadSuppliersReport);
  document.getElementById('rep-sup-excel')?.addEventListener('click', () => {
    window.SB.select('suppliers', { order: { column: 'name' } }).then(({ data }) => {
      const rows = [['الاسم', 'الهاتف', 'العنوان', 'الرصيد'],
        ...data.map(s => [s.name, s.phone || '', s.address || '', s.balance])];
      window.Modules.downloadCSV(rows, 'suppliers-report');
      window.App.showToast('تم التصدير', 'success');
    });
  });

  await loadSuppliersReport(state.mode);
}

async function loadSuppliersReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-sup-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-sup', mode);

    const { data: suppliers } = await window.SB.select('suppliers', { order: { column: 'name' } });

    // سدادات في الفترة
    const payOpts = {};
    if (from) payOpts.gte = { created_at: from };
    if (to) payOpts.lte = { created_at: to + 'T23:59:59' };
    const { data: payments } = await window.SB.select('supplier_payments', payOpts);

    const totalBalance = suppliers.reduce((s, r) => s + Number(r.balance), 0);
    const totalPaidInPeriod = (payments || []).reduce((s, p) => s + Number(p.amount), 0);

    // دمج السدادات لكل مورد
    const paidBySupplier = {};
    (payments || []).forEach(p => {
      paidBySupplier[p.supplier_id] = (paidBySupplier[p.supplier_id] || 0) + Number(p.amount);
    });

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(6,182,212,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('عدد الموردين', window.App.formatNumber(suppliers.length), 'truck', 'cyan')}
        ${window.Modules.kpiCard('إجمالي الأرصدة', window.App.formatCurrency(totalBalance), 'money', 'blue')}
        ${window.Modules.kpiCard('سدادات الفترة', window.App.formatCurrency(totalPaidInPeriod), 'check', 'green')}
        ${window.Modules.kpiCard('عدد السدادات', window.App.formatNumber(payments.length), 'activity', 'purple')}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.truck} تفاصيل الموردين</div></div>
        <div class="table-wrap" style="background:transparent;border:none;">
          <table class="responsive">
            <thead><tr><th>المورد</th><th>الهاتف</th><th>العنوان</th><th>الرصيد الحالي</th><th>مدفوع في الفترة</th></tr></thead>
            <tbody>
              ${suppliers.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-3);">لا توجد بيانات</td></tr>' :
                suppliers.map(s => `
                  <tr>
                    <td data-label="المورد"><strong>${window.App.escapeHtml(s.name)}</strong></td>
                    <td data-label="الهاتف">${window.App.escapeHtml(s.phone || '—')}</td>
                    <td data-label="العنوان">${window.App.escapeHtml(s.address || '—')}</td>
                    <td data-label="الرصيد" class="${s.balance > 0 ? 'text-danger' : ''}">${window.App.formatCurrency(s.balance)}</td>
                    <td data-label="مدفوع" class="text-success">${window.App.formatCurrency(paidBySupplier[s.id] || 0)}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('rep-sup-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 5: المخزن
   ═══════════════════════════════════════════════════════════════ */

async function renderWarehouseReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-wh')}
    <div id="rep-wh-body"></div>
  `;

  const state = initPeriodSelector('rep-wh', loadWarehouseReport);
  document.getElementById('rep-wh-excel')?.addEventListener('click', () => {
    window.SB.select('products', { order: { column: 'name' } }).then(({ data }) => {
      const rows = [['الاسم', 'النوع', 'الوحدة', 'الكمية', 'الحد الأدنى', 'التكلفة', 'سعر البيع', 'القيمة'],
        ...data.map(p => [p.name, p.type || '', p.unit || '', p.quantity, p.min_quantity, p.cost_price, p.sale_price, p.quantity * p.cost_price])];
      window.Modules.downloadCSV(rows, 'warehouse-report');
      window.App.showToast('تم التصدير', 'success');
    });
  });

  await loadWarehouseReport(state.mode);
}

async function loadWarehouseReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-wh-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-wh', mode);

    const { data: products } = await window.SB.select('products', { order: { column: 'name' } });

    const movOpts = {};
    if (from) movOpts.gte = { created_at: from };
    if (to) movOpts.lte = { created_at: to + 'T23:59:59' };
    const { data: movements } = await window.SB.select('warehouse_transactions', movOpts);

    const totalIn = movements.filter(m => m.type === 'in').reduce((s, m) => s + Number(m.quantity), 0);
    const totalOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + Number(m.quantity), 0);
    const totalValue = products.reduce((s, p) => s + Number(p.quantity) * Number(p.cost_price || 0), 0);
    const lowStock = products.filter(p => Number(p.quantity) <= Number(p.min_quantity));

    // حركات لكل منتج
    const movByProduct = {};
    movements.forEach(m => {
      if (!movByProduct[m.product_id]) movByProduct[m.product_id] = { in: 0, out: 0 };
      if (m.type === 'in') movByProduct[m.product_id].in += Number(m.quantity);
      if (m.type === 'out') movByProduct[m.product_id].out += Number(m.quantity);
    });

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(139,92,246,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('عدد المنتجات', window.App.formatNumber(products.length), 'box', 'blue')}
        ${window.Modules.kpiCard('قيمة المخزون', window.App.formatCurrency(totalValue), 'money', 'gold')}
        ${window.Modules.kpiCard('إجمالي الوارد', window.App.formatNumber(totalIn), 'upload', 'green')}
        ${window.Modules.kpiCard('إجمالي الصادر', window.App.formatNumber(totalOut), 'download', 'red')}
        ${window.Modules.kpiCard('منتجات منخفضة', window.App.formatNumber(lowStock.length), 'alert', lowStock.length > 0 ? 'red' : 'green')}
      </div>

      ${lowStock.length > 0 ? `
        <div class="card" style="margin-bottom:20px;border-color:rgba(239,68,68,0.3);">
          <div class="card-header"><div class="card-title" style="color:var(--danger);">${window.App.icons.alert} تنبيهات المخزون</div></div>
          <div class="table-wrap" style="background:transparent;border:none;">
            <table>
              <thead><tr><th>المنتج</th><th>الكمية</th><th>الحد الأدنى</th><th>النقص</th></tr></thead>
              <tbody>${lowStock.map(p => `
                <tr>
                  <td>${window.App.escapeHtml(p.name)}</td>
                  <td class="text-danger">${window.App.formatNumber(p.quantity)}</td>
                  <td>${window.App.formatNumber(p.min_quantity)}</td>
                  <td class="text-danger">${window.App.formatNumber(Number(p.min_quantity) - Number(p.quantity))}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.box} أرصدة المنتجات</div></div>
        <div class="table-wrap" style="background:transparent;border:none;">
          <table class="responsive">
            <thead><tr><th>المنتج</th><th>الوحدة</th><th>الكمية الحالية</th><th>وارد الفترة</th><th>صادر الفترة</th><th>الحد الأدنى</th><th>القيمة</th></tr></thead>
            <tbody>
              ${products.map(p => {
                const low = Number(p.quantity) <= Number(p.min_quantity);
                const mov = movByProduct[p.id] || { in: 0, out: 0 };
                return `
                  <tr>
                    <td data-label="المنتج"><strong>${window.App.escapeHtml(p.name)}</strong>${low ? ' <span class="badge badge-danger" style="font-size:9px;">منخفض</span>' : ''}</td>
                    <td data-label="الوحدة">${window.App.escapeHtml(p.unit || '—')}</td>
                    <td data-label="الكمية" class="${low ? 'text-danger' : ''}"><strong>${window.App.formatNumber(p.quantity)}</strong></td>
                    <td data-label="وارد" class="text-success">+${window.App.formatNumber(mov.in)}</td>
                    <td data-label="صادر" class="text-danger">-${window.App.formatNumber(mov.out)}</td>
                    <td data-label="الحد الأدنى">${window.App.formatNumber(p.min_quantity)}</td>
                    <td data-label="القيمة">${window.App.formatCurrency(p.quantity * p.cost_price)}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${movements.length > 0 ? `
        <div class="card" style="margin-top:20px;">
          <div class="card-header"><div class="card-title">${window.App.icons.activity} حركات الفترة (${movements.length})</div></div>
          <div class="table-wrap" style="background:transparent;border:none;max-height:400px;overflow-y:auto;">
            <table class="responsive">
              <thead><tr><th>النوع</th><th>الكمية</th><th>السبب</th><th>التاريخ</th></tr></thead>
              <tbody>${movements.slice(0, 100).map(m => `
                <tr>
                  <td data-label="النوع">${m.type === 'in' ? '<span class="badge badge-success">إدخال</span>' : '<span class="badge badge-danger">إخراج</span>'}</td>
                  <td data-label="الكمية">${window.App.formatNumber(m.quantity)}</td>
                  <td data-label="السبب">${window.App.escapeHtml(m.reason || '—')}</td>
                  <td data-label="التاريخ">${window.App.formatDateTime(m.created_at)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;
  } catch (err) {
    document.getElementById('rep-wh-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 6: الخزنة
   ═══════════════════════════════════════════════════════════════ */

async function renderTreasuryReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-tre')}
    <div id="rep-tre-body"></div>
  `;

  const state = initPeriodSelector('rep-tre', loadTreasuryReport);
  document.getElementById('rep-tre-excel')?.addEventListener('click', exportTreasuryReport);

  await loadTreasuryReport(state.mode);
}

async function loadTreasuryReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-tre-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-tre', mode);

    const opts = { order: { column: 'created_at', ascending: false } };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };

    const { data: cashData } = await window.SB.select('cash_transactions', opts);
    const { data: bankData } = await window.SB.select('bank_transactions', opts);

    const cashIn = cashData.filter(t => t.type === 'in').reduce((s, t) => s + Number(t.amount), 0);
    const cashOut = cashData.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);
    const bankIn = bankData.filter(t => t.type === 'in').reduce((s, t) => s + Number(t.amount), 0);
    const bankOut = bankData.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);

    const currentCash = await window.SB.getCashBalance();
    const currentBank = await window.SB.getBankBalance();
    const currentExtra = await window.SB.getExtraBoxesBalance();

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(245,158,11,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('إيداعات كاش', window.App.formatCurrency(cashIn), 'upload', 'green')}
        ${window.Modules.kpiCard('سحوبات كاش', window.App.formatCurrency(cashOut), 'download', 'red')}
        ${window.Modules.kpiCard('صافي كاش', window.App.formatCurrency(cashIn - cashOut), 'wallet', cashIn - cashOut >= 0 ? 'gold' : 'red')}
        ${window.Modules.kpiCard('إيداعات بنك', window.App.formatCurrency(bankIn), 'upload', 'cyan')}
        ${window.Modules.kpiCard('سحوبات بنك', window.App.formatCurrency(bankOut), 'download', 'red')}
        ${window.Modules.kpiCard('صافي بنك', window.App.formatCurrency(bankIn - bankOut), 'money', bankIn - bankOut >= 0 ? 'blue' : 'red')}
      </div>

      <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(245,158,11,0.1));">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;">
          <div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:4px;">رصيد الكاش الحالي</div>
            <div style="font-size:20px;font-weight:800;color:#f59e0b;">${window.App.formatCurrency(currentCash)}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:4px;">رصيد البنك الحالي</div>
            <div style="font-size:20px;font-weight:800;color:#3b82f6;">${window.App.formatCurrency(currentBank)}</div>
          </div>
          ${currentExtra > 0 ? `
            <div>
              <div style="font-size:12px;color:var(--text-3);margin-bottom:4px;">خزائن أخرى</div>
              <div style="font-size:20px;font-weight:800;color:#06b6d4;">${window.App.formatCurrency(currentExtra)}</div>
            </div>
          ` : ''}
          <div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:4px;">الإجمالي</div>
            <div style="font-size:20px;font-weight:800;color:#10b981;">${window.App.formatCurrency(currentCash + currentBank + currentExtra)}</div>
          </div>
        </div>
      </div>

      ${cashData.length > 0 ? `
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><div class="card-title">${window.App.icons.wallet} حركات الكاش (${cashData.length})</div></div>
          <div class="table-wrap" style="background:transparent;border:none;max-height:400px;overflow-y:auto;">
            <table class="responsive">
              <thead><tr><th>النوع</th><th>المبلغ</th><th>البيان</th><th>التاريخ</th></tr></thead>
              <tbody>${cashData.slice(0, 100).map(t => `
                <tr>
                  <td data-label="النوع">${t.type === 'in' ? '<span class="badge badge-success">إيداع</span>' : '<span class="badge badge-danger">سحب</span>'}</td>
                  <td data-label="المبلغ" class="${t.type === 'in' ? 'text-success' : 'text-danger'}">${window.App.formatCurrency(t.amount)}</td>
                  <td data-label="البيان">${window.App.escapeHtml(t.description || '—')}</td>
                  <td data-label="التاريخ">${window.App.formatDateTime(t.created_at)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${bankData.length > 0 ? `
        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.money} حركات البنك (${bankData.length})</div></div>
          <div class="table-wrap" style="background:transparent;border:none;max-height:400px;overflow-y:auto;">
            <table class="responsive">
              <thead><tr><th>النوع</th><th>المبلغ</th><th>المرجع</th><th>البيان</th><th>التاريخ</th></tr></thead>
              <tbody>${bankData.slice(0, 100).map(t => `
                <tr>
                  <td data-label="النوع">${t.type === 'in' ? '<span class="badge badge-success">إيداع</span>' : '<span class="badge badge-danger">سحب</span>'}</td>
                  <td data-label="المبلغ" class="${t.type === 'in' ? 'text-success' : 'text-danger'}">${window.App.formatCurrency(t.amount)}</td>
                  <td data-label="المرجع">${window.App.escapeHtml(t.bank_ref || '—')}</td>
                  <td data-label="البيان">${window.App.escapeHtml(t.description || '—')}</td>
                  <td data-label="التاريخ">${window.App.formatDateTime(t.created_at)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;
  } catch (err) {
    document.getElementById('rep-tre-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function exportTreasuryReport() {
  const { from, to } = getDateRange('rep-tre', 'month');
  const opts = { order: { column: 'created_at', ascending: false } };
  if (from) opts.gte = { created_at: from };
  if (to) opts.lte = { created_at: to + 'T23:59:59' };

  const { data: cash } = await window.SB.select('cash_transactions', opts);
  const { data: bank } = await window.SB.select('bank_transactions', opts);

  const rows = [['حركات الكاش'], ['النوع', 'المبلغ', 'البيان', 'التاريخ']];
  cash.forEach(t => rows.push([t.type === 'in' ? 'إيداع' : 'سحب', t.amount, t.description || '', window.App.formatDateTime(t.created_at)]));
  rows.push([]);
  rows.push(['حركات البنك']);
  rows.push(['النوع', 'المبلغ', 'المرجع', 'التاريخ']);
  bank.forEach(t => rows.push([t.type === 'in' ? 'إيداع' : 'سحب', t.amount, t.bank_ref || '', window.App.formatDateTime(t.created_at)]));

  window.Modules.downloadCSV(rows, 'treasury-report');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 7: المصروفات
   ═══════════════════════════════════════════════════════════════ */

async function renderExpensesReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-exp')}
    <div id="rep-exp-body"></div>
  `;

  const state = initPeriodSelector('rep-exp', loadExpensesReport);
  document.getElementById('rep-exp-excel')?.addEventListener('click', exportExpensesReport);

  await loadExpensesReport(state.mode);
}

async function loadExpensesReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-exp-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-exp', mode);

    const opts = { order: { column: 'created_at', ascending: false } };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };

    const { data } = await window.SB.select('expenses', opts);
    const approved = data.filter(e => e.status === 'approved');

    const byCategory = {};
    approved.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    });

    const total = approved.reduce((s, e) => s + Number(e.amount), 0);
    const opTotal = approved.filter(e => e.type === 'operational').reduce((s, e) => s + Number(e.amount), 0);
    const nonOpTotal = approved.filter(e => e.type === 'non_operational').reduce((s, e) => s + Number(e.amount), 0);

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(239,68,68,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('إجمالي المصروفات', window.App.formatCurrency(total), 'receipt', 'red')}
        ${window.Modules.kpiCard('تشغيلي', window.App.formatCurrency(opTotal), 'activity', 'blue')}
        ${window.Modules.kpiCard('غير تشغيلي', window.App.formatCurrency(nonOpTotal), 'alert', 'gold')}
        ${window.Modules.kpiCard('عدد المصروفات', window.App.formatNumber(approved.length), 'check', 'green')}
      </div>

      ${Object.keys(byCategory).length > 0 ? `
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><div class="card-title">${window.App.icons.chart} تجميع حسب الفئة</div></div>
          <div class="table-wrap" style="background:transparent;border:none;">
            <table>
              <thead><tr><th>الفئة</th><th>الإجمالي</th><th>النسبة</th></tr></thead>
              <tbody>
                ${Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `
                  <tr>
                    <td>${window.App.escapeHtml(cat)}</td>
                    <td>${window.App.formatCurrency(amt)}</td>
                    <td>${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.receipt} كل المصروفات</div></div>
        <div class="table-wrap" style="background:transparent;border:none;">
          <table class="responsive">
            <thead><tr><th>الفئة</th><th>النوع</th><th>البيان</th><th>المبلغ</th><th>الخزنة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>
              ${data.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-3);">لا توجد بيانات</td></tr>' :
                data.map(e => `
                  <tr>
                    <td data-label="الفئة"><strong>${window.App.escapeHtml(e.category)}</strong></td>
                    <td data-label="النوع">${e.type === 'operational' ? 'تشغيلي' : 'غير تشغيلي'}</td>
                    <td data-label="البيان">${window.App.escapeHtml(e.description || '—')}</td>
                    <td data-label="المبلغ" class="text-danger">${window.App.formatCurrency(e.amount)}</td>
                    <td data-label="الخزنة">${e.cashbox_type === 'cash' ? 'كاش' : 'بنك'}</td>
                    <td data-label="الحالة">${window.Modules.statusBadge(e.status)}</td>
                    <td data-label="التاريخ">${window.App.formatDate(e.created_at)}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('rep-exp-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function exportExpensesReport() {
  const { from, to } = getDateRange('rep-exp', 'month');
  const opts = {};
  if (from) opts.gte = { created_at: from };
  if (to) opts.lte = { created_at: to + 'T23:59:59' };

  const { data } = await window.SB.select('expenses', opts);
  const rows = [['الفئة', 'النوع', 'البيان', 'المبلغ', 'الخزنة', 'الحالة', 'التاريخ'],
    ...data.map(e => [e.category, e.type === 'operational' ? 'تشغيلي' : 'غير تشغيلي', e.description || '',
      e.amount, e.cashbox_type === 'cash' ? 'كاش' : 'بنك', e.status, window.App.formatDateTime(e.created_at)])];
  window.Modules.downloadCSV(rows, 'expenses-report');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 8: القيود
   ═══════════════════════════════════════════════════════════════ */

async function renderJournalReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-jv')}
    <div id="rep-jv-body"></div>
  `;

  const state = initPeriodSelector('rep-jv', loadJournalReport);
  document.getElementById('rep-jv-excel')?.addEventListener('click', exportJournalReport);

  await loadJournalReport(state.mode);
}

async function loadJournalReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-jv-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-jv', mode);

    const opts = { order: { column: 'date', ascending: false }, limit: 200 };
    if (from) opts.gte = { date: from };
    if (to) opts.lte = { date: to };

    const { data: entries } = await window.SB.select('journal_entries', opts);

    let totalDebit = 0, totalCredit = 0;
    const enriched = [];

    for (const e of entries) {
      const { data: lines } = await window.SB.select('journal_lines', {
        select: '*, accounts(code, name)', eq: { entry_id: e.id }
      });
      const d = (lines || []).reduce((s, l) => s + Number(l.debit), 0);
      const c = (lines || []).reduce((s, l) => s + Number(l.credit), 0);
      totalDebit += d;
      totalCredit += c;
      enriched.push({ ...e, lines: lines || [], totalDebit: d, totalCredit: c });
    }

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(59,130,246,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('عدد القيود', window.App.formatNumber(entries.length), 'book', 'blue')}
        ${window.Modules.kpiCard('إجمالي المدين', window.App.formatCurrency(totalDebit), 'upload', 'green')}
        ${window.Modules.kpiCard('إجمالي الدائن', window.App.formatCurrency(totalCredit), 'download', 'red')}
        ${window.Modules.kpiCard('الفرق', window.App.formatCurrency(totalDebit - totalCredit), 'scale',
          Math.abs(totalDebit - totalCredit) < 0.01 ? 'green' : 'red')}
      </div>

      ${enriched.length === 0 ? '<div class="empty-state"><p>لا توجد قيود في هذه الفترة</p></div>' :
        enriched.map(e => `
          <div class="card" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
              <div>
                <strong style="color:var(--accent);">${window.App.escapeHtml(e.entry_number)}</strong>
                <span style="color:var(--text-3);font-size:12px;margin-right:8px;">${window.App.formatDate(e.date)}</span>
              </div>
              <span style="color:var(--text-2);font-size:12.5px;">${window.App.escapeHtml(e.description || '—')}</span>
            </div>
            <div class="table-wrap" style="background:transparent;border:none;">
              <table style="font-size:12.5px;">
                <thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
                <tbody>
                  ${e.lines.map(l => `
                    <tr>
                      <td>${window.App.escapeHtml((l.accounts?.code || '') + ' - ' + (l.accounts?.name || ''))}</td>
                      <td class="${l.debit > 0 ? 'text-success' : ''}">${l.debit > 0 ? window.App.formatCurrency(l.debit) : '—'}</td>
                      <td class="${l.credit > 0 ? 'text-danger' : ''}">${l.credit > 0 ? window.App.formatCurrency(l.credit) : '—'}</td>
                    </tr>`).join('')}
                  <tr style="background:rgba(59,130,246,0.08);">
                    <td><strong>الإجمالي</strong></td>
                    <td><strong>${window.App.formatCurrency(e.totalDebit)}</strong></td>
                    <td><strong>${window.App.formatCurrency(e.totalCredit)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>`).join('')}
    `;
  } catch (err) {
    document.getElementById('rep-jv-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function exportJournalReport() {
  const { from, to } = getDateRange('rep-jv', 'month');
  const opts = { order: { column: 'date', ascending: false } };
  if (from) opts.gte = { date: from };
  if (to) opts.lte = { date: to };

  const { data: entries } = await window.SB.select('journal_entries', opts);
  const rows = [['رقم القيد', 'التاريخ', 'البيان', 'الحساب', 'مدين', 'دائن']];

  for (const e of entries) {
    const { data: lines } = await window.SB.select('journal_lines', {
      select: '*, accounts(code, name)', eq: { entry_id: e.id }
    });
    lines.forEach(l => rows.push([
      e.entry_number, e.date, e.description || '',
      `${l.accounts?.code} - ${l.accounts?.name}`, l.debit, l.credit
    ]));
  }
  window.Modules.downloadCSV(rows, 'journal-report');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 9: التدقيق
   ═══════════════════════════════════════════════════════════════ */

async function renderAuditReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-aud')}
    <div id="rep-aud-body"></div>
  `;

  const state = initPeriodSelector('rep-aud', loadAuditReport);
  document.getElementById('rep-aud-excel')?.addEventListener('click', exportAuditReport);

  await loadAuditReport(state.mode);
}

async function loadAuditReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-aud-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-aud', mode);
    const opts = { order: { column: 'created_at', ascending: false }, limit: 500 };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };

    const { data } = await window.SB.select('audit_logs', opts);

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(139,92,246,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('إجمالي السجلات', window.App.formatNumber(data.length), 'activity', 'blue')}
        ${window.Modules.kpiCard('عمليات الإضافة', window.App.formatNumber(data.filter(l => l.action === 'create').length), 'plus', 'green')}
        ${window.Modules.kpiCard('عمليات التعديل', window.App.formatNumber(data.filter(l => l.action === 'update').length), 'edit', 'gold')}
        ${window.Modules.kpiCard('عمليات الحذف', window.App.formatNumber(data.filter(l => l.action === 'delete').length), 'trash', 'red')}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.activity} سجل التدقيق</div></div>
        <div class="table-wrap" style="background:transparent;border:none;max-height:600px;overflow-y:auto;">
          <table class="responsive">
            <thead><tr><th>المستخدم</th><th>العملية</th><th>الوحدة</th><th>التفاصيل</th><th>التاريخ</th></tr></thead>
            <tbody>
              ${data.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-3);">لا توجد بيانات</td></tr>' :
                data.map(l => `
                  <tr>
                    <td data-label="المستخدم">${window.App.escapeHtml(l.user_email || '—')}</td>
                    <td data-label="العملية">${window.Advanced.actionBadge(l.action)}</td>
                    <td data-label="الوحدة"><span class="badge badge-primary">${window.App.escapeHtml(l.module)}</span></td>
                    <td data-label="التفاصيل" style="font-size:11.5px;color:var(--text-3);max-width:280px;word-break:break-word;">
                      ${l.details ? window.App.escapeHtml(JSON.stringify(l.details).slice(0, 100)) : '—'}
                    </td>
                    <td data-label="التاريخ">${window.App.formatDateTime(l.created_at)}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('rep-aud-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function exportAuditReport() {
  const { from, to } = getDateRange('rep-aud', 'month');
  const opts = {};
  if (from) opts.gte = { created_at: from };
  if (to) opts.lte = { created_at: to + 'T23:59:59' };

  const { data } = await window.SB.select('audit_logs', opts);
  const rows = [['المستخدم', 'العملية', 'الوحدة', 'معرف السجل', 'التفاصيل', 'التاريخ'],
    ...data.map(l => [l.user_email || '', l.action, l.module, l.record_id || '',
      l.details ? JSON.stringify(l.details) : '', window.App.formatDateTime(l.created_at)])];
  window.Modules.downloadCSV(rows, 'audit-report');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 10: التسويات
   ═══════════════════════════════════════════════════════════════ */

async function renderReconciliationsReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-rec')}
    <div id="rep-rec-body"></div>
  `;

  const state = initPeriodSelector('rep-rec', loadReconciliationsReport);
  document.getElementById('rep-rec-excel')?.addEventListener('click', () => {
    window.SB.select('reconciliations', { order: { column: 'created_at', ascending: false } }).then(({ data }) => {
      const rows = [['النوع', 'المتوقع', 'الفعلي', 'الفرق', 'السبب', 'التاريخ'],
        ...data.map(r => [r.type, r.expected, r.actual, r.difference, r.reason || '', window.App.formatDateTime(r.created_at)])];
      window.Modules.downloadCSV(rows, 'reconciliations-report');
      window.App.showToast('تم التصدير', 'success');
    });
  });

  await loadReconciliationsReport(state.mode);
}

async function loadReconciliationsReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-rec-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-rec', mode);

    const opts = { order: { column: 'created_at', ascending: false } };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };

    const { data } = await window.SB.select('reconciliations', opts);
    const totalDiff = data.reduce((s, r) => s + Number(r.difference), 0);

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(245,158,11,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('عدد التسويات', window.App.formatNumber(data.length), 'scale', 'blue')}
        ${window.Modules.kpiCard('إجمالي الفروقات', window.App.formatCurrency(totalDiff), 'activity', totalDiff >= 0 ? 'green' : 'red')}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.scale} سجل التسويات</div></div>
        <div class="table-wrap" style="background:transparent;border:none;">
          <table class="responsive">
            <thead><tr><th>النوع</th><th>المتوقع</th><th>الفعلي</th><th>الفرق</th><th>السبب</th><th>التاريخ</th></tr></thead>
            <tbody>
              ${data.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-3);">لا توجد بيانات</td></tr>' :
                data.map(r => `
                  <tr>
                    <td data-label="النوع">${r.type === 'cash' ? 'كاش' : 'بنك'}</td>
                    <td data-label="المتوقع">${window.App.formatCurrency(r.expected)}</td>
                    <td data-label="الفعلي">${window.App.formatCurrency(r.actual)}</td>
                    <td data-label="الفرق" class="${r.difference > 0 ? 'text-success' : r.difference < 0 ? 'text-danger' : ''}">${window.App.formatCurrency(r.difference)}</td>
                    <td data-label="السبب">${window.App.escapeHtml(r.reason || '—')}</td>
                    <td data-label="التاريخ">${window.App.formatDateTime(r.created_at)}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('rep-rec-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   تقرير 11: التقارير المالية الشاملة
   ═══════════════════════════════════════════════════════════════ */

async function renderFinancialReport(container) {
  container.innerHTML = `
    ${periodSelector('rep-fin')}
    <div id="rep-fin-body"></div>
  `;

  const state = initPeriodSelector('rep-fin', loadFinancialReport);
  document.getElementById('rep-fin-excel')?.addEventListener('click', exportFinancialReport);

  await loadFinancialReport(state.mode);
}

async function loadFinancialReport(mode = 'month') {
  try {
    const body = document.getElementById('rep-fin-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const { from, to, label } = getDateRange('rep-fin', mode);

    // المبيعات
    const salesOpts = { eq: { status: 'approved' } };
    if (from) salesOpts.gte = { created_at: from };
    if (to) salesOpts.lte = { created_at: to + 'T23:59:59' };
    const { data: sales } = await window.SB.select('sales', salesOpts);
    const revenue = sales.reduce((s, r) => s + Number(r.total), 0);

    // مرتجعات
    const retOpts = { eq: { status: 'approved' } };
    if (from) retOpts.gte = { created_at: from };
    if (to) retOpts.lte = { created_at: to + 'T23:59:59' };
    const { data: returns } = await window.SB.select('returns', retOpts);
    const returnsTotal = returns.reduce((s, r) => s + Number(r.total), 0);

    // تكلفة المبيعات
    let costOfSales = 0;
    for (const sale of sales) {
      const { data: items } = await window.SB.select('sale_items', {
        select: '*, products(cost_price)', eq: { sale_id: sale.id }
      });
      (items || []).forEach(i => {
        costOfSales += Number(i.products?.cost_price || 0) * Number(i.quantity);
      });
    }

    const netRevenue = revenue - returnsTotal;
    const grossProfit = netRevenue - costOfSales;

    // المصروفات
    const expOpts = { eq: { status: 'approved' } };
    if (from) expOpts.gte = { created_at: from };
    if (to) expOpts.lte = { created_at: to + 'T23:59:59' };
    const { data: expenses } = await window.SB.select('expenses', expOpts);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const netProfit = grossProfit - totalExpenses;

    // الأرصدة الحالية
    const cash = await window.SB.getCashBalance();
    const bank = await window.SB.getBankBalance();
    const extra = await window.SB.getExtraBoxesBalance();

    const { data: customers } = await window.SB.select('customers');
    const receivables = customers.reduce((s, c) => s + Math.max(0, Number(c.balance)), 0);

    const { data: products } = await window.SB.select('products');
    const inventory = products.reduce((s, p) => s + Number(p.quantity) * Number(p.cost_price || 0), 0);

    const { data: suppliers } = await window.SB.select('suppliers');
    const payables = suppliers.reduce((s, sp) => s + Math.max(0, Number(sp.balance)), 0);

    const totalAssets = cash + bank + extra + receivables + inventory;
    const equity = totalAssets - payables;

    body.innerHTML = `
      <div style="margin-bottom:12px;padding:8px 14px;background:rgba(16,185,129,0.1);border-radius:10px;font-size:13px;color:var(--text-2);text-align:center;">
        📅 ${label}
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('الإيرادات', window.App.formatCurrency(netRevenue), 'money', 'green')}
        ${window.Modules.kpiCard('الربح الإجمالي', window.App.formatCurrency(grossProfit), 'chart', grossProfit >= 0 ? 'blue' : 'red')}
        ${window.Modules.kpiCard('المصروفات', window.App.formatCurrency(totalExpenses), 'receipt', 'red')}
        ${window.Modules.kpiCard('صافي الربح', window.App.formatCurrency(netProfit), 'check', netProfit >= 0 ? 'green' : 'red')}
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">${window.App.icons.chart} قائمة الدخل</div></div>
        <div style="padding:12px 0;">
          ${finRow('الإيرادات', revenue, 'success')}
          ${returnsTotal > 0 ? finRow('(-) المرتجعات', -returnsTotal, 'danger') : ''}
          ${finRow('(-) تكلفة المبيعات', -costOfSales, 'danger')}
          <div style="height:1px;background:var(--border);margin:8px 0;"></div>
          ${finRow('الربح الإجمالي', grossProfit, grossProfit >= 0 ? 'success' : 'danger', true)}
          <div style="height:12px;"></div>
          ${finRow('(-) المصروفات', -totalExpenses, 'danger')}
          <div style="height:1px;background:var(--border);margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;padding:14px;background:${netProfit >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'};border-radius:10px;margin-top:8px;">
            <strong style="font-size:15px;">صافي الربح</strong>
            <strong style="font-size:18px;color:${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${window.App.formatCurrency(netProfit)}</strong>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.scale} المركز المالي</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;" class="dashboard-grid">
          <div>
            <h4 style="font-size:13px;font-weight:700;color:var(--primary-2);margin-bottom:10px;">الأصول</h4>
            ${finRow('النقدية (كاش)', cash, 'info')}
            ${finRow('النقدية (بنك)', bank, 'info')}
            ${extra > 0 ? finRow('خزائن أخرى', extra, 'info') : ''}
            ${finRow('العملاء (ذمم مدينة)', receivables, 'info')}
            ${finRow('المخزون', inventory, 'info')}
            <div style="height:1px;background:var(--border);margin:8px 0;"></div>
            <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(59,130,246,0.12);border-radius:10px;">
              <strong>إجمالي الأصول</strong>
              <strong style="color:var(--primary-2);">${window.App.formatCurrency(totalAssets)}</strong>
            </div>
          </div>
          <div>
            <h4 style="font-size:13px;font-weight:700;color:var(--warning);margin-bottom:10px;">الخصوم وحقوق الملكية</h4>
            ${finRow('الموردون (ذمم دائنة)', payables, 'danger')}
            <div style="height:1px;background:var(--border);margin:8px 0;"></div>
            ${finRow('حقوق الملكية', equity, 'success', true)}
            <div style="height:1px;background:var(--border);margin:8px 0;"></div>
            <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(245,158,11,0.12);border-radius:10px;">
              <strong>إجمالي الخصوم + الحقوق</strong>
              <strong style="color:var(--accent);">${window.App.formatCurrency(payables + equity)}</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.innerWidth < 900) {
      document.querySelectorAll('.dashboard-grid').forEach(g => g.style.gridTemplateColumns = '1fr');
    }
  } catch (err) {
    document.getElementById('rep-fin-body').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

function finRow(label, value, color, bold = false) {
  const colorMap = { success: 'var(--success)', danger: 'var(--danger)', info: 'var(--info)' };
  return `
    <div style="display:flex;justify-content:space-between;padding:7px 0;">
      <span style="color:var(--text-2);${bold ? 'font-weight:700;' : ''}font-size:13px;">${label}</span>
      <span style="color:${colorMap[color] || 'var(--text)'};${bold ? 'font-weight:800;' : 'font-weight:600'};">${window.App.formatCurrency(value)}</span>
    </div>
  `;
}

async function exportFinancialReport() {
  const { from, to } = getDateRange('rep-fin', 'month');

  const salesOpts = { eq: { status: 'approved' } };
  if (from) salesOpts.gte = { created_at: from };
  if (to) salesOpts.lte = { created_at: to + 'T23:59:59' };
  const { data: sales } = await window.SB.select('sales', salesOpts);
  const revenue = sales.reduce((s, r) => s + Number(r.total), 0);

  const expOpts = { eq: { status: 'approved' } };
  if (from) expOpts.gte = { created_at: from };
  if (to) expOpts.lte = { created_at: to + 'T23:59:59' };
  const { data: expenses } = await window.SB.select('expenses', expOpts);
  const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const cash = await window.SB.getCashBalance();
  const bank = await window.SB.getBankBalance();

  const rows = [
    ['التقرير المالي الشامل'],
    ['الفترة', `من ${from} إلى ${to}`],
    [],
    ['قائمة الدخل'],
    ['البند', 'المبلغ'],
    ['الإيرادات', revenue],
    ['المصروفات', totalExp],
    ['صافي الربح', revenue - totalExp],
    [],
    ['المركز المالي'],
    ['كاش', cash],
    ['بنك', bank],
    ['إجمالي النقدية', cash + bank]
  ];
  window.Modules.downloadCSV(rows, 'financial-report');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   التصدير العام
   ═══════════════════════════════════════════════════════════════ */

window.Reports = {
  renderReportsHome,
  openReport,
  back: backToReports
};

console.log('✅ reports.js جاهز (محدّث)');
console.log('🎉 اكتمل تحميل جميع ملفات النظام بنجاح');