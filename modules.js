/* ═══════════════════════════════════════════════════════════════
   نظام إدارة قسم الحبل - مصنع الصندل
   modules.js - Dashboard + Sales + Customers + Suppliers
                + Warehouse (مع موافقة) + Treasury + Expenses
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   أدوات مساعدة مشتركة
   ═══════════════════════════════════════════════════════════════ */

function kpiCard(label, value, icon, color) {
  return `
    <div class="kpi-card">
      <div class="kpi-icon ${color}">${window.App.icons[icon] || window.App.icons.info}</div>
      <div class="kpi-info">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
      </div>
    </div>`;
}

function statusBadge(status) {
  const map = {
    'pending': '<span class="badge badge-warning">بانتظار المخزن</span>',
    'approved': '<span class="badge badge-success">معتمدة</span>',
    'cancelled': '<span class="badge badge-danger">ملغاة</span>',
    'rejected': '<span class="badge badge-danger">مرفوضة</span>',
    'returned': '<span class="badge badge-info">مرتجعة</span>'
  };
  return map[status] || '<span class="badge badge-gray">—</span>';
}

function emptyState(msg) {
  return `<div class="empty-state" style="padding:30px 20px;"><p>${window.App.escapeHtml(msg)}</p></div>`;
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => {
    const v = c === null || c === undefined ? '' : String(c);
    return `"${v.replace(/"/g, '""')}"`;
  }).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${window.App.todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatCompact(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function adjustDashboardGrid() {
  if (window.innerWidth < 900) {
    document.querySelectorAll('.dashboard-grid').forEach(g => {
      g.style.gridTemplateColumns = '1fr';
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 1: لوحة التحكم
   ═══════════════════════════════════════════════════════════════ */

async function renderDashboard(container) {
  try {
    if (!container) return;
    container.innerHTML = '<div class="skeleton-wrap"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>';

    const kpi = await window.SB.getDashboardKPIs();
    const { data: recentSales } = await window.SB.select('sales', {
      order: { column: 'created_at', ascending: false }, limit: 5
    });
    const { data: recentCash } = await window.SB.select('cash_transactions', {
      order: { column: 'created_at', ascending: false }, limit: 5
    });

    const chartData = await getSalesChartData();

    container.innerHTML = `
      <div class="kpi-grid">
        ${kpiCard('إجمالي المبيعات', window.App.formatCurrency(kpi.totalSales), 'money', 'blue')}
        ${kpiCard('عدد المنتجات', window.App.formatNumber(kpi.productCount), 'box', 'purple')}
        ${kpiCard('عدد العملاء', window.App.formatNumber(kpi.customerCount), 'users', 'green')}
        ${kpiCard('عدد الموردين', window.App.formatNumber(kpi.supplierCount), 'truck', 'cyan')}
        ${kpiCard('خزنة الكاش', window.App.formatCurrency(kpi.cashBalance), 'wallet', 'gold')}
        ${kpiCard('خزنة البنك', window.App.formatCurrency(kpi.bankBalance), 'money', 'blue')}
        ${kpiCard('خزائن أخرى', window.App.formatCurrency(kpi.extraBalance || 0), 'wallet', 'cyan')}
        ${kpiCard('إجمالي الخزنة', window.App.formatCurrency(kpi.totalTreasury), 'wallet', 'green')}
        ${kpiCard('مصروفات الشهر', window.App.formatCurrency(kpi.monthExpenses), 'receipt', 'red')}
        ${kpiCard('تنبيهات المخزون', window.App.formatNumber(kpi.lowStockCount), 'alert', kpi.lowStockCount > 0 ? 'red' : 'green')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" class="dashboard-grid">
        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.chart} مبيعات آخر 7 أيام</div></div>
          <div class="chart-wrap">${renderSVGBarChart(chartData)}</div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.wallet} توزيع الخزنة</div></div>
          <div style="padding:12px 0;">${renderTreasuryPie(kpi.cashBalance, kpi.bankBalance, kpi.extraBalance || 0)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;" class="dashboard-grid">
        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.cart} آخر الفواتير</div></div>
          ${recentSales.length === 0 ? emptyState('لا توجد فواتير') : `
            <div class="table-wrap" style="background:transparent;border:none;">
              <table class="responsive">
                <thead><tr><th>الفاتورة</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
                <tbody>${recentSales.map(s => `
                  <tr>
                    <td data-label="الفاتورة">${window.App.escapeHtml(s.invoice_number || '—')}</td>
                    <td data-label="الإجمالي">${window.App.formatCurrency(s.total)}</td>
                    <td data-label="الحالة">${statusBadge(s.status)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.activity} آخر حركات الخزنة</div></div>
          ${recentCash.length === 0 ? emptyState('لا توجد حركات') : `
            <div class="table-wrap" style="background:transparent;border:none;">
              <table class="responsive">
                <thead><tr><th>النوع</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
                <tbody>${recentCash.map(c => `
                  <tr>
                    <td data-label="النوع">${c.type === 'in' ? '<span class="badge badge-success">إيداع</span>' : '<span class="badge badge-danger">سحب</span>'}</td>
                    <td data-label="المبلغ" class="${c.type === 'in' ? 'text-success' : 'text-danger'}">${window.App.formatCurrency(c.amount)}</td>
                    <td data-label="التاريخ">${window.App.formatDate(c.created_at)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>

      ${kpi.lowStockCount > 0 ? `
        <div class="card" style="margin-top:20px;border-color:rgba(239,68,68,0.3);">
          <div class="card-header"><div class="card-title" style="color:var(--danger);">${window.App.icons.alert} تنبيهات المخزون (${kpi.lowStockCount})</div></div>
          <div class="table-wrap" style="background:transparent;border:none;">
            <table class="responsive">
              <thead><tr><th>المنتج</th><th>الكمية</th><th>الحد الأدنى</th></tr></thead>
              <tbody>${kpi.lowStockItems.map(p => `
                <tr>
                  <td data-label="المنتج">${window.App.escapeHtml(p.name)}</td>
                  <td data-label="الكمية" class="text-danger">${window.App.formatNumber(p.quantity)}</td>
                  <td data-label="الحد الأدنى">${window.App.formatNumber(p.min_quantity)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
    `;

    adjustDashboardGrid();
  } catch (err) {
    console.error('❌ renderDashboard:', err);
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function getSalesChartData() {
  try {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        label: d.toLocaleDateString('ar-SD', { weekday: 'short' }),
        date: d.toISOString().split('T')[0],
        total: 0
      });
    }
    const fromDate = days[0].date;
    const { data } = await window.SB.select('sales', { eq: { status: 'approved' }, gte: { created_at: fromDate } });
    (data || []).forEach(s => {
      const d = s.created_at.split('T')[0];
      const day = days.find(x => x.date === d);
      if (day) day.total += Number(s.total);
    });
    return days;
  } catch { return []; }
}

function renderSVGBarChart(data) {
  if (!data || data.length === 0) return emptyState('لا توجد بيانات');
  const W = 500, H = 220, padding = { top: 20, right: 20, bottom: 40, left: 20 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const barW = chartW / data.length - 10;
  const barGap = 10;

  let bars = '';
  data.forEach((d, i) => {
    const barH = (d.total / maxVal) * chartH;
    const x = padding.left + i * (barW + barGap) + 5;
    const y = padding.top + chartH - barH;
    bars += `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" fill="url(#barGrad)" opacity="0.9"/>
      <text x="${x + barW / 2}" y="${H - 15}" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="Cairo">${d.label}</text>
      <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" fill="#f8fafc" font-size="10" font-family="Cairo">
        ${d.total > 0 ? formatCompact(d.total) : ''}
      </text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:220px;">
    <defs><linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient></defs>${bars}</svg>`;
}

function renderTreasuryPie(cash, bank, extra = 0) {
  const total = cash + bank + extra;
  if (total === 0) return emptyState('لا توجد أرصدة');
  const cashPct = (cash / total) * 100;
  const bankPct = (bank / total) * 100;
  const extraPct = 100 - cashPct - bankPct;
  const radius = 60, cx = 100, cy = 100;
  const circ = 2 * Math.PI * radius;
  const cashDash = (cashPct / 100) * circ;
  const bankDash = (bankPct / 100) * circ;
  const extraDash = (extraPct / 100) * circ;

  return `<div style="display:flex;align-items:center;justify-content:space-around;flex-wrap:wrap;gap:16px;padding:10px;">
    <svg viewBox="0 0 200 200" style="width:160px;height:160px;">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#1e293b" stroke-width="28"/>
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#3b82f6" stroke-width="28" stroke-dasharray="${cashDash} ${circ}" transform="rotate(-90 ${cx} ${cy})"/>
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#f59e0b" stroke-width="28" stroke-dasharray="${bankDash} ${circ}" stroke-dashoffset="-${cashDash}" transform="rotate(-90 ${cx} ${cy})"/>
      ${extra > 0 ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#06b6d4" stroke-width="28" stroke-dasharray="${extraDash} ${circ}" stroke-dashoffset="-${cashDash + bankDash}" transform="rotate(-90 ${cx} ${cy})"/>` : ''}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="Cairo">الإجمالي</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#f8fafc" font-size="13" font-weight="700" font-family="Cairo">${formatCompact(total)}</text>
    </svg>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:12px;height:12px;background:#3b82f6;border-radius:4px;"></div>
        <div><div style="font-size:11px;color:var(--text-3);">كاش</div><div style="font-size:14px;font-weight:700;">${window.App.formatCurrency(cash)}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:12px;height:12px;background:#f59e0b;border-radius:4px;"></div>
        <div><div style="font-size:11px;color:var(--text-3);">بنك</div><div style="font-size:14px;font-weight:700;">${window.App.formatCurrency(bank)}</div></div>
      </div>
      ${extra > 0 ? `
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:12px;height:12px;background:#06b6d4;border-radius:4px;"></div>
          <div><div style="font-size:11px;color:var(--text-3);">خزائن أخرى</div><div style="font-size:14px;font-weight:700;">${window.App.formatCurrency(extra)}</div></div>
        </div>` : ''}
    </div>
  </div>`;
}

async function refreshDashboard() {
  if (window.App.state.currentRoute === 'dashboard' && !window.App.state.routeLoading) {
    const container = document.getElementById('content');
    if (container) await renderDashboard(container);
  }
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 2: المبيعات
   ═══════════════════════════════════════════════════════════════ */

async function renderSales(container) {
  try {
    if (!container) return;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>المبيعات</h2><p>إدارة فواتير البيع والمدفوعات</p></div>
        <div class="page-header-actions">
          ${window.App.hasPermission('sales', 'add') ? `
            <button class="btn btn-primary" id="new-sale-btn">${window.App.icons.plus} فاتورة جديدة</button>
          ` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <div class="input-group"><label>من تاريخ</label><input type="date" id="sales-from" value="${window.App.monthStartISO()}"></div>
        <div class="input-group"><label>إلى تاريخ</label><input type="date" id="sales-to" value="${window.App.todayISO()}"></div>
        <div class="input-group"><label>الحالة</label>
          <select id="sales-status">
            <option value="">الكل</option>
            <option value="pending">بانتظار المخزن</option>
            <option value="approved">معتمدة</option>
            <option value="rejected">مرفوضة</option>
          </select>
        </div>
        <button class="btn btn-ghost" id="sales-filter-btn">${window.App.icons.search} تصفية</button>
        <button class="btn btn-ghost" id="sales-export-btn">${window.App.icons.download} Excel</button>
      </div>

      <div id="sales-list"></div>
    `;

    await loadSalesList();
    document.getElementById('new-sale-btn')?.addEventListener('click', openNewSaleModal);
    document.getElementById('sales-filter-btn')?.addEventListener('click', loadSalesList);
    document.getElementById('sales-export-btn')?.addEventListener('click', exportSalesExcel);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadSalesList() {
  try {
    const listEl = document.getElementById('sales-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const from = document.getElementById('sales-from')?.value;
    const to = document.getElementById('sales-to')?.value;
    const status = document.getElementById('sales-status')?.value;

    const opts = { select: '*, customers(name)', order: { column: 'created_at', ascending: false } };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };
    if (status) opts.eq = { status };

    const { data: sales, error } = await window.SB.select('sales', opts);
    if (error) throw new Error(error);

    if (!listEl) return;

    if (!sales.length) { listEl.innerHTML = emptyState('لا توجد فواتير في هذه الفترة'); return; }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="responsive">
          <thead>
            <tr>
              <th>رقم الفاتورة</th><th>العميل</th><th>الإجمالي</th><th>الخصم</th>
              <th>المدفوع</th><th>المتبقي</th><th>الطريقة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${sales.map(s => `
              <tr>
                <td data-label="الفاتورة"><strong>${window.App.escapeHtml(s.invoice_number || '—')}</strong></td>
                <td data-label="العميل">${window.App.escapeHtml(s.customers?.name || 'عميل نقدي')}</td>
                <td data-label="الإجمالي">${window.App.formatCurrency(s.total)}</td>
                <td data-label="الخصم" class="${s.discount_amount > 0 ? 'text-warning' : ''}">${s.discount_amount > 0 ? window.App.formatCurrency(s.discount_amount) : '—'}</td>
                <td data-label="المدفوع" class="text-success">${window.App.formatCurrency(Number(s.paid_cash) + Number(s.paid_bank))}</td>
                <td data-label="المتبقي" >${window.App.money(s.remaining)}</td>
                <td data-label="طريقة الدفع">${paymentMethodLabel(s.payment_method)}</td>
                <td data-label="الحالة">${statusBadge(s.status)}</td>
                <td data-label="التاريخ">${window.App.formatDate(s.created_at)}</td>
                <td data-label="إجراءات">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-ghost" onclick="viewSaleDetails('${s.id}')" title="عرض">${window.App.icons.edit}</button>
                    ${s.status === 'approved' ? `
                      <button class="btn btn-sm btn-warning" onclick="openReturnFromSale('${s.id}')" title="مرتجع">${window.App.icons.rotate}</button>
                    ` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    const listEl = document.getElementById('sales-list');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><p>خطأ: ${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

function paymentMethodLabel(method) {
  const map = {
    'cash': '<span class="badge badge-success">كاش</span>',
    'bank': '<span class="badge badge-info">بنك</span>',
    'mixed': '<span class="badge badge-primary">مختلط</span>',
    'credit': '<span class="badge badge-danger">آجل</span>'
  };
  return map[method] || '<span class="badge badge-gray">—</span>';
}

async function openNewSaleModal() {
  try {
    if (!window.App.hasPermission('sales', 'add')) {
      window.App.showToast('ليس لديك صلاحية إضافة فواتير', 'error');
      return;
    }

    const { data: customers } = await window.SB.select('customers', { order: { column: 'name' } });
    const { data: products } = await window.SB.select('products', { order: { column: 'name' } });

    const clientUuid = window.App.uid();

    const bodyHtml = `
      <div id="sale-form">
        <div class="input-group">
          <label>العميل</label>
          <select id="sale-customer">
            <option value="">— عميل نقدي —</option>
            ${customers.map(c => `<option value="${c.id}">${window.App.escapeHtml(c.name)} ${c.phone ? ' - ' + c.phone : ''}</option>`).join('')}
          </select>
        </div>

        <div style="margin:16px 0;display:flex;justify-content:space-between;align-items:center;">
          <h4 style="font-size:14px;font-weight:700;">المنتجات</h4>
          <button class="btn btn-sm btn-outline" id="add-item-btn">${window.App.icons.plus} إضافة منتج</button>
        </div>

        <div id="sale-items" style="display:flex;flex-direction:column;gap:10px;"></div>

        <div class="discount-row">
          <div class="input-group" style="margin:0;">
            <label>نوع الخصم</label>
            <select id="discount-type">
              <option value="none">لا يوجد خصم</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="percent">نسبة مئوية</option>
            </select>
          </div>
          <div class="input-group" style="margin:0;">
            <label>قيمة الخصم</label>
            <input type="number" id="discount-value" min="0" step="0.01" value="0" disabled>
          </div>
        </div>

        <div style="margin-top:16px;padding:16px;background:rgba(59,130,246,0.08);border-radius:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:var(--text-2);">المجموع الفرعي:</span>
            <strong id="sale-subtotal">0 ج.س</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:var(--text-2);">الخصم:</span>
            <strong id="sale-discount-amount" style="color:var(--warning);">0 ج.س</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);">
            <span style="font-weight:700;">الإجمالي النهائي:</span>
            <strong id="sale-total" style="font-size:18px;color:var(--accent);">0 ج.س</strong>
          </div>
        </div>

        <div class="input-group" style="margin-top:16px;">
          <label>طريقة الدفع</label>
          <select id="sale-payment-method">
            <option value="cash">كاش</option>
            <option value="bank">بنك</option>
            <option value="mixed">مختلط (كاش + بنك)</option>
            <option value="credit">آجل (دين)</option>
          </select>
        </div>

        <div id="payment-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>

        <div class="input-group" style="margin-top:16px;">
          <label>ملاحظات</label>
          <textarea id="sale-notes" rows="2" placeholder="ملاحظات إضافية..."></textarea>
        </div>

        <div style="margin-top:16px;padding:12px;background:rgba(245,158,11,0.08);border-radius:10px;font-size:12px;color:var(--text-2);">
          ℹ️ بعد الحفظ، سيتم إرسال الفاتورة لأمين المخزن للموافقة قبل الاعتماد النهائي.
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-primary" id="save-sale-btn" data-client-uuid="${clientUuid}">${window.App.icons.check} حفظ وإرسال للمخزن</button>
    `;

    window.App.openModal('فاتورة مبيعات جديدة', bodyHtml, footerHtml);

    const itemsContainer = document.getElementById('sale-items');
    addSaleItemRow(itemsContainer, products);

    document.getElementById('add-item-btn')?.addEventListener('click', () => {
      addSaleItemRow(itemsContainer, products);
    });

    document.getElementById('discount-type')?.addEventListener('change', (e) => {
      const input = document.getElementById('discount-value');
      input.disabled = e.target.value === 'none';
      if (e.target.value === 'none') input.value = 0;
      updateSaleTotal();
    });

    document.getElementById('discount-value')?.addEventListener('input', updateSaleTotal);
    document.getElementById('sale-payment-method')?.addEventListener('change', updatePaymentFields);
    updatePaymentFields();

    document.getElementById('save-sale-btn')?.addEventListener('click', saveSale);
  } catch (err) {
    window.App.showToast(err.message, 'error');
  }
}

function addSaleItemRow(container, products) {
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'sale-item-row';

  row.innerHTML = `
    <div class="input-group" style="margin:0;">
      <label>المنتج</label>
      <select class="item-product">
        <option value="">— اختر —</option>
        ${products.map(p => `<option value="${p.id}" data-available="${p.quantity}" data-price="${p.sale_price || 0}" data-unit="${p.unit || 'قطعة'}" data-name="${window.App.escapeHtml(p.name)}">${window.App.escapeHtml(p.name)} (متاح: ${p.quantity} ${p.unit || ''})</option>`).join('')}
      </select>
    </div>
    <div class="input-group" style="margin:0;">
      <label>الكمية</label>
      <input type="number" class="item-qty" min="0.01" step="0.01" value="1">
    </div>
    <div class="input-group" style="margin:0;">
      <label>السعر</label>
      <input type="number" class="item-price" min="0" step="0.01" value="0">
    </div>
    <div class="input-group" style="margin:0;">
      <label>المصدر</label>
      <select class="item-source">
        <option value="warehouse">من المخزن</option>
        <option value="external">خارجي</option>
      </select>
    </div>
    <button class="btn btn-sm btn-danger" style="padding:8px;" onclick="this.parentElement.remove(); updateSaleTotal();">${window.App.icons.trash}</button>
  `;

  container.appendChild(row);

  const productSel = row.querySelector('.item-product');
  const qtyInput = row.querySelector('.item-qty');
  const priceInput = row.querySelector('.item-price');

  productSel.addEventListener('change', () => {
    const opt = productSel.selectedOptions[0];
    if (opt && opt.value) priceInput.value = opt.dataset.price || 0;
    updateSaleTotal();
  });

  qtyInput.addEventListener('input', updateSaleTotal);
  priceInput.addEventListener('input', updateSaleTotal);
}

function updateSaleTotal() {
  const rows = document.querySelectorAll('.sale-item-row');
  let subtotal = 0;
  rows.forEach(r => {
    const qty = Number(r.querySelector('.item-qty').value) || 0;
    const price = Number(r.querySelector('.item-price').value) || 0;
    subtotal += qty * price;
  });

  const dType = document.getElementById('discount-type')?.value || 'none';
  const dValue = Number(document.getElementById('discount-value')?.value) || 0;
  let discountAmount = 0;
  if (dType === 'fixed') discountAmount = Math.min(dValue, subtotal);
  else if (dType === 'percent') discountAmount = (dValue / 100) * subtotal;

  const total = Math.max(0, subtotal - discountAmount);

  const subEl = document.getElementById('sale-subtotal');
  const discEl = document.getElementById('sale-discount-amount');
  const totEl = document.getElementById('sale-total');
  if (subEl) subEl.textContent = window.App.formatCurrency(subtotal);
  if (discEl) discEl.textContent = window.App.formatCurrency(discountAmount);
  if (totEl) totEl.textContent = window.App.formatCurrency(total);

  return { subtotal, discountAmount, total };
}

function updatePaymentFields() {
  const method = document.getElementById('sale-payment-method')?.value;
  const fields = document.getElementById('payment-fields');
  if (!fields || !method) return;
  const { total } = updateSaleTotal();

  if (method === 'cash') {
    fields.innerHTML = `
      <div class="input-group" style="grid-column:1/-1;margin:0;">
        <label>المبلغ المدفوع كاش</label>
        <input type="number" id="paid-cash" value="${total}" min="0" step="0.01">
      </div>`;
  } else if (method === 'bank') {
    fields.innerHTML = `
      <div class="input-group" style="grid-column:1/-1;margin:0;">
        <label>المبلغ المدفوع (الإجمالي)</label>
        <input type="number" id="paid-bank" value="${total}" min="0" step="0.01" readonly style="background:rgba(59,130,246,0.1);cursor:not-allowed;">
      </div>
      
      <div style="grid-column:1/-1;padding:14px;background:rgba(6,182,212,0.06);border-radius:10px;margin-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h4 style="font-size:13px;font-weight:700;color:var(--info);">العمليات البنكية</h4>
          <button type="button" class="btn btn-sm btn-outline" id="add-bank-op-btn">
            ${window.App.icons.plus} إضافة عملية
          </button>
        </div>
        <div id="bank-operations-list" style="display:flex;flex-direction:column;gap:10px;"></div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:12.5px;">
          <span style="color:var(--text-2);">إجمالي العمليات:</span>
          <strong id="bank-ops-total" style="color:var(--success);">0 ج.س</strong>
        </div>
        <p id="bank-ops-remaining" style="margin-top:6px;font-size:12px;text-align:center;"></p>
      </div>`;

    addBankOperation(0);
    document.getElementById('add-bank-op-btn').addEventListener('click', () => {
      const count = document.querySelectorAll('.bank-op-row').length;
      addBankOperation(count);
    });
  } else if (method === 'mixed') {
    fields.innerHTML = `
      <div class="input-group" style="margin:0;">
        <label>المبلغ كاش</label>
        <input type="number" id="paid-cash" value="0" min="0" step="0.01">
      </div>
      <div class="input-group" style="margin:0;">
        <label>المبلغ بنك (الإجمالي)</label>
        <input type="number" id="paid-bank" value="0" min="0" step="0.01" readonly style="background:rgba(59,130,246,0.1);cursor:not-allowed;">
      </div>
      
      <div style="grid-column:1/-1;padding:14px;background:rgba(6,182,212,0.06);border-radius:10px;margin-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h4 style="font-size:13px;font-weight:700;color:var(--info);">العمليات البنكية</h4>
          <button type="button" class="btn btn-sm btn-outline" id="add-bank-op-btn">
            ${window.App.icons.plus} إضافة عملية
          </button>
        </div>
        <div id="bank-operations-list" style="display:flex;flex-direction:column;gap:10px;"></div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:12.5px;">
          <span style="color:var(--text-2);">إجمالي العمليات:</span>
          <strong id="bank-ops-total" style="color:var(--success);">0 ج.س</strong>
        </div>
        <p id="bank-ops-remaining" style="margin-top:6px;font-size:12px;text-align:center;"></p>
      </div>`;

    addBankOperation(0);
    document.getElementById('add-bank-op-btn').addEventListener('click', () => {
      const count = document.querySelectorAll('.bank-op-row').length;
      addBankOperation(count);
    });
    document.getElementById('paid-cash').addEventListener('input', updateBankTotal);
  } else if (method === 'credit') {
    fields.innerHTML = `
      <div class="input-group" style="grid-column:1/-1;margin:0;">
        <label>المبلغ المدفوع مقدماً (اختياري)</label>
        <input type="number" id="paid-cash" value="0" min="0" step="0.01">
      </div>`;
  }
}

function addBankOperation(index) {
  const container = document.getElementById('bank-operations-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'bank-op-row';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 36px;gap:8px;align-items:end;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;';

  row.innerHTML = `
    <div class="input-group" style="margin:0;">
      <label style="font-size:11px;">المبلغ *</label>
      <input type="number" class="bank-op-amount" min="0" step="0.01" value="0" placeholder="0">
    </div>
    <div class="input-group" style="margin:0;">
      <label style="font-size:11px;">رقم العملية</label>
      <input type="text" class="bank-op-ref" placeholder="اختياري">
    </div>
    <button type="button" class="btn btn-sm btn-danger" style="padding:8px;" 
      onclick="removeBankOperation(this)">${window.App.icons.trash}</button>
  `;

  container.appendChild(row);

  row.querySelectorAll('.bank-op-amount, .bank-op-ref').forEach(inp => {
    inp.addEventListener('input', updateBankTotal);
  });

  if (index === 0) {
    const { total } = updateSaleTotal();
    row.querySelector('.bank-op-amount').value = total;
  }

  updateBankTotal();
  setTimeout(() => updateBankTotal(), 50);
}

function removeBankOperation(btn) {
  const row = btn.closest('.bank-op-row');
  if (!row) return;

  const container = document.getElementById('bank-operations-list');
  if (container.querySelectorAll('.bank-op-row').length <= 1) {
    window.App.showToast('يجب أن توجد عملية واحدة على الأقل', 'warning');
    return;
  }

  row.remove();
  updateBankTotal();
}

function updateBankTotal() {
  const { total } = updateSaleTotal();
  const rows = document.querySelectorAll('.bank-op-row');

  let bankTotal = 0;
  rows.forEach(row => {
    const amt = Number(row.querySelector('.bank-op-amount').value) || 0;
    bankTotal += amt;
  });

  const totalEl = document.getElementById('bank-ops-total');
  if (totalEl) totalEl.textContent = window.App.formatCurrency(bankTotal);

  const method = document.getElementById('sale-payment-method')?.value;
  let paidCash = 0;
  if (method === 'mixed') {
    paidCash = Number(document.getElementById('paid-cash')?.value) || 0;
  }

  const remaining = total - bankTotal - paidCash;
  const remainEl = document.getElementById('bank-ops-remaining');

  if (remainEl) {
    if (Math.abs(remaining) < 0.01) {
      remainEl.innerHTML = '<span class="badge badge-success">✓ المبالغ مطابقة للإجمالي</span>';
    } else if (remaining > 0) {
      remainEl.innerHTML = `<span class="badge badge-warning">⚠️ متبقي: ${window.App.formatCurrency(remaining)}</span>`;
    } else {
      remainEl.innerHTML = `<span class="badge badge-danger">⚠️ زيادة: ${window.App.formatCurrency(Math.abs(remaining))}</span>`;
    }
  }

  const paidBankInput = document.getElementById('paid-bank');
  if (paidBankInput) paidBankInput.value = bankTotal;

  return bankTotal;
}

async function saveSale() {
  const btn = document.getElementById('save-sale-btn');
  if (!btn || btn.dataset.processing === 'true') return;

  const clientUuid = btn.dataset.clientUuid;
  const unlock = window.App.lockProcessing(btn, 'جاري الحفظ...');

  try {
    const customerId = document.getElementById('sale-customer').value || null;
    const method = document.getElementById('sale-payment-method').value;
    const notes = document.getElementById('sale-notes').value.trim();
    const dType = document.getElementById('discount-type').value;
    const dValue = Number(document.getElementById('discount-value').value) || 0;

    const rows = document.querySelectorAll('.sale-item-row');
    const items = [];
    for (const row of rows) {
      const productId = row.querySelector('.item-product').value;
      const qty = Number(row.querySelector('.item-qty').value);
      const price = Number(row.querySelector('.item-price').value);
      const sourceType = row.querySelector('.item-source').value;

      if (!productId) continue;
      if (qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من 0');
      if (price < 0) throw new Error('السعر لا يمكن أن يكون سالباً');

      const opt = row.querySelector('.item-product').selectedOptions[0];
      const available = Number(opt.dataset.available);

      if (sourceType === 'warehouse' && qty > available) {
        throw new Error(`الكمية المتاحة من "${opt.dataset.name}" هي ${available} فقط`);
      }

      items.push({
        product_id: productId,
        quantity: qty,
        price,
        source_type: sourceType,
        source_name: sourceType === 'external' ? 'خارجي' : null
      });
    }

    if (items.length === 0) throw new Error('يجب إضافة منتج واحد على الأقل');

    const calc = updateSaleTotal();
    const total = calc.total;
    const subtotal = calc.subtotal;
    const discountAmount = calc.discountAmount;

    let paidCash = 0;
    let paidBank = 0;
    const payments = [];

    if (method === 'cash') {
      paidCash = Number(document.getElementById('paid-cash').value) || 0;
      if (paidCash > 0) payments.push({ method: 'cash', amount: paidCash });
    } else if (method === 'bank') {
      const bankRows = document.querySelectorAll('.bank-op-row');
      for (const row of bankRows) {
        const amt = Number(row.querySelector('.bank-op-amount').value) || 0;
        const ref = row.querySelector('.bank-op-ref').value.trim();
        if (amt > 0) {
          paidBank += amt;
          payments.push({ method: 'bank', amount: amt, bank_ref: ref || null });
        }
      }
      if (paidBank === 0) throw new Error('يجب إدخال عملية بنكية واحدة على الأقل');
    } else if (method === 'mixed') {
      paidCash = Number(document.getElementById('paid-cash').value) || 0;
      if (paidCash > 0) payments.push({ method: 'cash', amount: paidCash });

      const bankRows = document.querySelectorAll('.bank-op-row');
      for (const row of bankRows) {
        const amt = Number(row.querySelector('.bank-op-amount').value) || 0;
        const ref = row.querySelector('.bank-op-ref').value.trim();
        if (amt > 0) {
          paidBank += amt;
          payments.push({ method: 'bank', amount: amt, bank_ref: ref || null });
        }
      }
    } else if (method === 'credit') {
      paidCash = Number(document.getElementById('paid-cash').value) || 0;
      if (paidCash > 0) payments.push({ method: 'cash', amount: paidCash });
    }

    if (paidCash + paidBank > total) throw new Error('المبلغ المدفوع أكبر من الإجمالي');

    const remaining = total - paidCash - paidBank;
    if (remaining > 0 && !customerId) throw new Error('يجب اختيار عميل عند وجود مبلغ آجل');

    const { data: sale, error } = await window.SB.createSale({
      customer_id: customerId,
      subtotal,
      discount_type: dType,
      discount_value: dValue,
      discount_amount: discountAmount,
      total,
      paid_cash: paidCash,
      paid_bank: paidBank,
      remaining,
      payment_method: method,
      notes,
      client_uuid: clientUuid
    }, items, payments);

    if (error) throw new Error(error);

    if (!sale.duplicate) {
      // ✅ لا اعتماد مباشر — بانتظار موافقة المخزن
      window.App.showToast(
        'تم حفظ الفاتورة — بانتظار موافقة أمين المخزن',
        'info',
        'في انتظار الموافقة',
        5000
      );
    } else {
      window.App.showToast('الفاتورة محفوظة مسبقاً', 'info');
    }

    window.App.closeModal();
    if (window.App.state.currentRoute === 'sales') await loadSalesList();
  } catch (err) {
    console.error('❌ saveSale:', err);
    window.App.showToast(err.message, 'error');
  } finally {
    unlock();
  }
}

async function viewSaleDetails(saleId) {
  try {
    const { data: sale } = await window.SB.getById('sales', saleId);
    if (!sale) throw new Error('الفاتورة غير موجودة');

    const { data: items } = await window.SB.select('sale_items', {
      select: '*, products(name, unit)', eq: { sale_id: saleId }
    });
    const { data: customer } = sale.customer_id ? await window.SB.getById('customers', sale.customer_id) : { data: null };

    const bodyHtml = `
      <div id="printable-invoice">
        <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid var(--primary-2);margin-bottom:20px;">
          <h2 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:4px;">
            مصنع الصندل للأوعية البلاستيكية
          </h2>
          <p style="color:var(--text-2);font-size:13px;margin:0;">قسم الحبل</p>
          <h3 style="font-size:16px;font-weight:700;color:var(--accent);margin-top:8px;">فاتورة مبيعات</h3>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;padding:12px;background:rgba(59,130,246,0.06);border-radius:10px;">
          <div><span style="color:var(--text-3);font-size:12px;">رقم الفاتورة:</span><br><strong>${window.App.escapeHtml(sale.invoice_number)}</strong></div>
          <div><span style="color:var(--text-3);font-size:12px;">التاريخ:</span><br>${window.App.formatDateTime(sale.created_at)}</div>
          <div><span style="color:var(--text-3);font-size:12px;">العميل:</span><br>${window.App.escapeHtml(customer?.name || 'عميل نقدي')}</div>
          <div><span style="color:var(--text-3);font-size:12px;">رقم الهاتف:</span><br>${window.App.escapeHtml(customer?.phone || '—')}</div>
          <div><span style="color:var(--text-3);font-size:12px;">الحالة:</span><br>${statusBadge(sale.status)}</div>
          <div><span style="color:var(--text-3);font-size:12px;">طريقة الدفع:</span><br>${paymentMethodLabel(sale.payment_method)}</div>
        </div>

        ${sale.status === 'rejected' && sale.warehouse_rejection_reason ? `
          <div style="padding:14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;margin-bottom:16px;">
            <div style="font-weight:700;color:var(--danger);margin-bottom:4px;">❌ سبب الرفض:</div>
            <div style="color:var(--text-2);font-size:13px;">${window.App.escapeHtml(sale.warehouse_rejection_reason)}</div>
          </div>
        ` : ''}

        ${sale.status === 'pending' ? `
          <div style="padding:12px;background:rgba(245,158,11,0.1);border-radius:10px;margin-bottom:16px;text-align:center;">
            <span class="badge badge-warning" style="font-size:12px;">⏳ بانتظار موافقة أمين المخزن</span>
          </div>
        ` : ''}

        <h4 style="font-size:14px;font-weight:700;margin:16px 0 8px;">المنتجات</h4>
        <div class="table-wrap" style="background:transparent;border:none;overflow:visible;">
          <table style="font-size:12.5px;">
            <thead>
              <tr>
                <th style="text-align:right;">#</th>
                <th style="text-align:right;">المنتج</th>
                <th style="text-align:center;">الكمية</th>
                <th style="text-align:center;">الوحدة</th>
                <th style="text-align:left;">السعر</th>
                <th style="text-align:left;">المجموع</th>
                <th style="text-align:center;">المصدر</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((i, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${window.App.escapeHtml(i.products?.name || '—')}</td>
                  <td style="text-align:center;">${window.App.formatNumber(i.quantity)}</td>
                  <td style="text-align:center;">${window.App.escapeHtml(i.products?.unit || '')}</td>
                  <td style="text-align:left;">${window.App.formatCurrency(i.price)}</td>
                  <td style="text-align:left;"><strong>${window.App.formatCurrency(i.subtotal)}</strong></td>
                  <td style="text-align:center;">
                    ${i.source_type === 'external' ? '<span style="color:#f59e0b;font-size:10px;">خارجي</span>' : '<span style="color:#3b82f6;font-size:10px;">مخزن</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top:20px;padding:16px;background:rgba(59,130,246,0.08);border-radius:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span>المجموع الفرعي:</span>
            <strong>${window.App.formatCurrency(sale.subtotal || sale.total)}</strong>
          </div>
          ${sale.discount_amount > 0 ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:var(--warning);">
              <span>الخصم ${sale.discount_type === 'percent' ? `(${sale.discount_value}%)` : ''}:</span>
              <strong>- ${window.App.formatCurrency(sale.discount_amount)}</strong>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-top:6px;border-top:1px solid var(--border);">
            <span style="font-weight:700;">الإجمالي النهائي:</span>
            <strong style="font-size:16px;color:var(--accent);">${window.App.formatCurrency(sale.total)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span>المدفوع كاش:</span>
            <span class="text-success">${window.App.formatCurrency(sale.paid_cash)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span>المدفوع بنك:</span>
            <span class="text-success">${window.App.formatCurrency(sale.paid_bank)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:2px solid var(--border);margin-top:6px;">
            <strong>المتبقي:</strong>
            <strong class="${sale.remaining > 0 ? 'text-danger' : 'text-success'}" style="font-size:15px;">${window.App.formatCurrency(sale.remaining)}</strong>
          </div>
        </div>

        ${sale.notes ? `
          <div style="margin-top:16px;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:12px;color:var(--text-2);">
            📝 ملاحظات: ${window.App.escapeHtml(sale.notes)}
          </div>
        ` : ''}

        <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px dashed var(--border);color:var(--text-3);font-size:11px;">
          <p>شكراً لتعاملكم معنا</p>
          <p>© 2026 مصنع الصندل للأوعية البلاستيكية</p>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إغلاق</button>
      ${sale.status === 'approved' ? `
        <button class="btn btn-primary" onclick="printSingleInvoice()">${window.App.icons.print} طباعة الفاتورة</button>
      ` : ''}
    `;

    window.App.openModal('تفاصيل الفاتورة', bodyHtml, footerHtml);
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

function printSingleInvoice() {
  try {
    const invoiceHtml = document.getElementById('printable-invoice');
    if (!invoiceHtml) {
      window.App.showToast('لم يتم العثور على الفاتورة', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.App.showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'warning');
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة - مصنع الصندل</title>
        ${styles}
        <style>
          body { background: white !important; color: black !important; padding: 20px; font-family: 'Cairo', sans-serif; }
          * { color: black !important; background: white !important; border-color: #ddd !important; }
          h2, h3, h4, strong { color: black !important; }
          .text-success { color: #10b981 !important; }
          .text-danger { color: #ef4444 !important; }
          .text-warning { color: #f59e0b !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #ddd !important; }
          th { background: #f1f5f9 !important; font-weight: 700; text-align: right; }
          @media print { @page { margin: 15mm; size: A4; } body { padding: 0; } }
        </style>
      </head>
      <body>${invoiceHtml.outerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  } catch (err) {
    console.error('❌ printSingleInvoice:', err);
    window.App.showToast('خطأ في الطباعة: ' + err.message, 'error');
  }
}

async function exportSalesExcel() {
  try {
    const from = document.getElementById('sales-from').value;
    const to = document.getElementById('sales-to').value;
    const status = document.getElementById('sales-status').value;
    const opts = { select: '*, customers(name)', order: { column: 'created_at', ascending: false } };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };
    if (status) opts.eq = { status };

    const { data } = await window.SB.select('sales', opts);
    const rows = [
      ['رقم الفاتورة', 'العميل', 'المجموع الفرعي', 'الخصم', 'الإجمالي', 'كاش', 'بنك', 'المتبقي', 'الطريقة', 'الحالة', 'التاريخ'],
      ...data.map(s => [
        s.invoice_number || '', s.customers?.name || 'عميل نقدي',
        s.subtotal || '', s.discount_amount || 0, s.total,
        s.paid_cash, s.paid_bank, s.remaining,
        s.payment_method, s.status, window.App.formatDateTime(s.created_at)
      ])
    ];
    downloadCSV(rows, 'sales-report');
    window.App.showToast('تم تصدير التقرير', 'success');
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 3: العملاء
   ═══════════════════════════════════════════════════════════════ */

async function renderCustomers(container) {
  try {
    if (!container) return;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>العملاء</h2><p>إدارة العملاء وكشوف الحسابات</p></div>
        <div class="page-header-actions">
          ${window.App.hasPermission('customers', 'add') ? `<button class="btn btn-primary" id="add-customer-btn">${window.App.icons.plus} عميل جديد</button>` : ''}
        </div>
      </div>
      <div class="filter-bar">
        <div class="input-group" style="flex:2;"><label>بحث</label><input type="text" id="customers-search" placeholder="ابحث باسم العميل أو الهاتف..."></div>
        <button class="btn btn-ghost" id="customers-export-btn">${window.App.icons.download} Excel</button>
      </div>
      <div id="customers-list"></div>
    `;

    await loadCustomersList();
    document.getElementById('add-customer-btn')?.addEventListener('click', () => openCustomerModal());
    document.getElementById('customers-search')?.addEventListener('input', window.App.debounce((e) => loadCustomersList(e.target.value), 250));
    document.getElementById('customers-export-btn')?.addEventListener('click', exportCustomersExcel);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadCustomersList(search = '') {
  try {
    const listEl = document.getElementById('customers-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="skeleton skeleton-card" style="height:150px;"></div>';

    const opts = { order: { column: 'name' } };
    if (search) opts.like = { name: search };
    const { data: customers } = await window.SB.select('customers', opts);

    if (!listEl) return;
    if (!customers.length) { listEl.innerHTML = emptyState('لا يوجد عملاء'); return; }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="responsive">
          <thead><tr><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th>الرصيد (الدين)</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${customers.map(c => `
              <tr>
                <td data-label="الاسم"><strong>${window.App.escapeHtml(c.name)}</strong></td>
                <td data-label="الهاتف">${window.App.escapeHtml(c.phone || '—')}</td>
                <td data-label="العنوان">${window.App.escapeHtml(c.address || '—')}</td>
                <td data-label="الرصيد" >${window.App.money(c.balance)}</td>
                <td data-label="إجراءات">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${c.balance > 0 && window.App.hasPermission('customers', 'approve') ? `
                      <button class="btn btn-sm btn-success" onclick="openCustomerPayment('${c.id}')" title="سداد دفعة">💰 سداد</button>
                    ` : ''}
                    <button class="btn btn-sm btn-ghost" onclick="viewCustomerStatement('${c.id}')" title="كشف حساب">${window.App.icons.book}</button>
                    ${window.App.hasPermission('customers', 'edit') ? `<button class="btn btn-sm btn-ghost" onclick="openCustomerModal('${c.id}')" title="تعديل">${window.App.icons.edit}</button>` : ''}
                    ${window.App.hasPermission('customers', 'delete') ? `<button class="btn btn-sm btn-danger" onclick="deleteCustomer('${c.id}')" title="حذف">${window.App.icons.trash}</button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    const listEl = document.getElementById('customers-list');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function openCustomerModal(id = null) {
  try {
    let customer = { name: '', phone: '', address: '', tax_number: '', balance: 0 };
    if (id) {
      const { data } = await window.SB.getById('customers', id);
      if (data) customer = data;
    }

    const bodyHtml = `
      <div class="input-group"><label>الاسم *</label><input type="text" id="cust-name" value="${window.App.escapeHtml(customer.name)}" required></div>
      <div class="input-group"><label>الهاتف</label><input type="text" id="cust-phone" value="${window.App.escapeHtml(customer.phone || '')}"></div>
      <div class="input-group"><label>العنوان</label><input type="text" id="cust-address" value="${window.App.escapeHtml(customer.address || '')}"></div>
      <div class="input-group"><label>الرقم الضريبي</label><input type="text" id="cust-tax" value="${window.App.escapeHtml(customer.tax_number || '')}"></div>
      ${id ? `<div class="input-group"><label>الرصيد الحالي</label><input type="number" id="cust-balance" value="${customer.balance}" step="0.01"></div>` : ''}
    `;

    window.App.openModal(id ? 'تعديل عميل' : 'عميل جديد', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-primary" id="save-cust-btn">${window.App.icons.check} حفظ</button>
    `);

    document.getElementById('save-cust-btn').addEventListener('click', async () => {
      const btn = document.getElementById('save-cust-btn');
      if (btn.dataset.processing === 'true') return;
      const unlock = window.App.lockProcessing(btn);
      try {
        const payload = {
          name: document.getElementById('cust-name').value.trim(),
          phone: document.getElementById('cust-phone').value.trim(),
          address: document.getElementById('cust-address').value.trim(),
          tax_number: document.getElementById('cust-tax').value.trim()
        };
        if (!payload.name) throw new Error('الاسم مطلوب');
        if (id) payload.balance = Number(document.getElementById('cust-balance').value) || 0;

        const res = id
          ? await window.SB.update('customers', id, payload)
          : await window.SB.insert('customers', payload);
        if (res.error) throw new Error(res.error);

        await window.SB.logAudit(id ? 'update' : 'create', 'customers', id || res.data?.id, payload);
        window.App.showToast('تم الحفظ بنجاح', 'success');
        window.App.closeModal();
        await loadCustomersList();
      } catch (err) { window.App.showToast(err.message, 'error'); }
      finally { unlock(); }
    });
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function deleteCustomer(id) {
  const ok = await window.App.confirmDialog('هل تريد حذف هذا العميل؟ لا يمكن التراجع', { title: 'حذف عميل', type: 'danger', okText: 'حذف' });
  if (!ok) return;
  const { error } = await window.SB.delete('customers', id);
  if (error) return window.App.showToast(error, 'error');
  await window.SB.logAudit('delete', 'customers', id);
  window.App.showToast('تم الحذف', 'success');
  await loadCustomersList();
}

async function viewCustomerStatement(id) {
  try {
    const { data: customer } = await window.SB.getById('customers', id);
    const { data: statement, finalBalance } = await window.SB.getCustomerStatement(id);

    const bodyHtml = `
      <div id="printable-customer-statement">
        <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid var(--primary-2);margin-bottom:20px;">
          <h2 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:4px;">
            مصنع الصندل للأوعية البلاستيكية
          </h2>
          <p style="color:var(--text-2);font-size:13px;margin:0;">قسم الحبل</p>
          <h3 style="font-size:16px;font-weight:700;color:var(--accent);margin-top:8px;">كشف حساب عميل</h3>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;padding:12px;background:rgba(59,130,246,0.06);border-radius:10px;">
          <div><span style="color:var(--text-3);font-size:12px;">اسم العميل:</span><br><strong>${window.App.escapeHtml(customer.name)}</strong></div>
          <div><span style="color:var(--text-3);font-size:12px;">الهاتف:</span><br>${window.App.escapeHtml(customer.phone || '—')}</div>
          <div><span style="color:var(--text-3);font-size:12px;">العنوان:</span><br>${window.App.escapeHtml(customer.address || '—')}</div>
          <div><span style="color:var(--text-3);font-size:12px;">تاريخ الطباعة:</span><br>${window.App.formatDate(new Date().toISOString())}</div>
        </div>

        <h4 style="font-size:14px;font-weight:700;margin:16px 0 8px;">حركات الحساب</h4>
        <div class="table-wrap" style="background:transparent;border:none;overflow:visible;">
          <table style="font-size:12.5px;">
            <thead>
              <tr>
                <th style="text-align:right;">النوع</th>
                <th style="text-align:right;">المرجع</th>
                <th style="text-align:right;">التاريخ</th>
                <th style="text-align:left;">الإجمالي</th>
                <th style="text-align:left;">مدفوع</th>
                <th style="text-align:left;">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              ${statement.length === 0 ? `
                <tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-3);">لا توجد حركات</td></tr>
              ` : statement.map(s => `
                <tr>
                  <td>${s.type === 'sale' ? 'فاتورة' : 'سداد'}</td>
                  <td>${window.App.escapeHtml(s.ref || '—')}</td>
                  <td>${window.App.formatDate(s.date)}</td>
                  <td>${s.type === 'sale' ? window.App.formatCurrency(s.amount) : '—'}</td>
                  <td class="text-success">${window.App.formatCurrency(s.paid)}</td>
                  <td><strong>${window.App.formatCurrency(s.running_balance)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top:20px;padding:16px;background:${finalBalance > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)'};border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;font-size:14px;">الرصيد النهائي:</span>
          <strong style="font-size:20px;color:${finalBalance > 0 ? 'var(--danger)' : 'var(--success)'};">
            ${window.App.formatCurrency(finalBalance)}
          </strong>
        </div>

        <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px dashed var(--border);color:var(--text-3);font-size:11px;">
          <p>شكراً لتعاملكم معنا</p>
          <p>© 2026 مصنع الصندل للأوعية البلاستيكية</p>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إغلاق</button>
      <button class="btn btn-primary" onclick="printCustomerStatement()">${window.App.icons.print} طباعة الكشف</button>
    `;

    window.App.openModal('كشف حساب العميل', bodyHtml, footerHtml);
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

function printCustomerStatement() {
  try {
    const statementHtml = document.getElementById('printable-customer-statement');
    if (!statementHtml) {
      window.App.showToast('لم يتم العثور على الكشف', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.App.showToast('يرجى السماح بالنوافذ المنبثقة', 'warning');
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب - مصنع الصندل</title>
        ${styles}
        <style>
          body { background: white !important; color: black !important; padding: 20px; font-family: 'Cairo', sans-serif; }
          * { color: black !important; background: white !important; border-color: #ddd !important; }
          h2, h3, h4, strong { color: black !important; }
          .text-success { color: #10b981 !important; }
          .text-danger { color: #ef4444 !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #ddd !important; }
          th { background: #f1f5f9 !important; font-weight: 700; text-align: right; }
          @media print { @page { margin: 15mm; size: A4; } body { padding: 0; } }
        </style>
      </head>
      <body>${statementHtml.outerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  } catch (err) {
    console.error('❌ printCustomerStatement:', err);
    window.App.showToast('خطأ في الطباعة: ' + err.message, 'error');
  }
}

async function openCustomerPayment(customerId) {
  try {
    const { data: customer } = await window.SB.getById('customers', customerId);
    if (!customer) throw new Error('العميل غير موجود');

    const { data: extraBoxes } = await window.SB.select('extra_cashboxes', { eq: { is_active: true }, order: { column: 'name' } });

    const bodyHtml = `
      <div style="padding:12px;background:rgba(239,68,68,0.08);border-radius:10px;margin-bottom:12px;display:flex;justify-content:space-between;">
        <span>الدين الحالي:</span>
        <strong style="color:var(--danger);">${window.App.formatCurrency(customer.balance)}</strong>
      </div>

      <div class="input-group">
        <label>المبلغ المستلم *</label>
        <input type="number" id="pay-amount" min="0.01" max="${customer.balance}" step="0.01" value="${customer.balance}">
      </div>

      <div class="input-group">
        <label>طريقة الاستلام *</label>
        <select id="pay-type">
          <option value="cash">كاش (خزنة الكاش)</option>
          <option value="bank">بنك (خزنة البنك)</option>
          ${extraBoxes.length > 0 ? `<option value="extra_box">خزنة أخرى</option>` : ''}
        </select>
      </div>

      <div class="input-group hidden" id="extra-box-wrap">
        <label>اختر الخزنة</label>
        <select id="pay-extra-box">
          ${extraBoxes.map(b => `<option value="${b.id}">${window.App.escapeHtml(b.name)} (${window.App.formatCurrency(b.balance)})</option>`).join('')}
        </select>
      </div>

      <div class="input-group hidden" id="bank-ref-wrap">
        <label>رقم العملية البنكية</label>
        <input type="text" id="pay-bank-ref" placeholder="اختياري">
      </div>

      <div class="input-group">
        <label>ملاحظات</label>
        <textarea id="pay-desc" rows="2" placeholder="ملاحظات..."></textarea>
      </div>
    `;

    window.App.openModal(`سداد دفعة - ${window.App.escapeHtml(customer.name)}`, bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-success" id="confirm-pay-btn" data-customer-id="${customerId}">${window.App.icons.check} تأكيد السداد</button>
    `);

    const typeSel = document.getElementById('pay-type');
    typeSel.addEventListener('change', () => {
      document.getElementById('extra-box-wrap').classList.toggle('hidden', typeSel.value !== 'extra_box');
      document.getElementById('bank-ref-wrap').classList.toggle('hidden', typeSel.value !== 'bank');
    });

    document.getElementById('confirm-pay-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.processing === 'true') return;
      const unlock = window.App.lockProcessing(btn, 'جاري السداد...');

      try {
        const amount = Number(document.getElementById('pay-amount').value);
        const type = typeSel.value;
        const desc = document.getElementById('pay-desc').value.trim();
        const bankRef = document.getElementById('pay-bank-ref')?.value.trim();
        const extraBoxId = document.getElementById('pay-extra-box')?.value;

        if (!amount || amount <= 0) throw new Error('المبلغ غير صحيح');

        const { error } = await window.SB.createCustomerPayment(customerId, amount, type, {
          description: desc, bank_ref: bankRef, extra_box_id: extraBoxId
        });
        if (error) throw new Error(error);

        window.App.showToast('تم تسجيل السداد بنجاح', 'success');
        window.App.closeModal();
        await loadCustomersList();
      } catch (err) { window.App.showToast(err.message, 'error'); }
      finally { unlock(); }
    });
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function exportCustomersExcel() {
  const { data } = await window.SB.select('customers', { order: { column: 'name' } });
  const rows = [['الاسم', 'الهاتف', 'العنوان', 'الرقم الضريبي', 'الرصيد'],
    ...data.map(c => [c.name, c.phone || '', c.address || '', c.tax_number || '', c.balance])];
  downloadCSV(rows, 'customers');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 4: الموردين
   ═══════════════════════════════════════════════════════════════ */

async function renderSuppliers(container) {
  try {
    if (!container) return;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>الموردين</h2><p>إدارة بيانات الموردين</p></div>
        <div class="page-header-actions">
          ${window.App.hasPermission('suppliers', 'add') ? `<button class="btn btn-primary" id="add-supplier-btn">${window.App.icons.plus} مورد جديد</button>` : ''}
        </div>
      </div>
      <div class="filter-bar">
        <div class="input-group" style="flex:2;"><label>بحث</label><input type="text" id="suppliers-search" placeholder="ابحث باسم المورد..."></div>
        <button class="btn btn-ghost" id="suppliers-export-btn">${window.App.icons.download} Excel</button>
      </div>
      <div id="suppliers-list"></div>
    `;

    await loadSuppliersList();
    document.getElementById('add-supplier-btn')?.addEventListener('click', () => openSupplierModal());
    document.getElementById('suppliers-search')?.addEventListener('input', window.App.debounce((e) => loadSuppliersList(e.target.value), 250));
    document.getElementById('suppliers-export-btn')?.addEventListener('click', exportSuppliersExcel);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadSuppliersList(search = '') {
  try {
    const listEl = document.getElementById('suppliers-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="skeleton skeleton-card" style="height:150px;"></div>';

    const opts = { order: { column: 'name' } };
    if (search) opts.like = { name: search };
    const { data: suppliers } = await window.SB.select('suppliers', opts);

    if (!listEl) return;
    if (!suppliers.length) { listEl.innerHTML = emptyState('لا يوجد موردين'); return; }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="responsive">
          <thead><tr><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th>الرصيد</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${suppliers.map(s => `
              <tr>
                <td data-label="الاسم"><strong>${window.App.escapeHtml(s.name)}</strong></td>
                <td data-label="الهاتف">${window.App.escapeHtml(s.phone || '—')}</td>
                <td data-label="العنوان">${window.App.escapeHtml(s.address || '—')}</td>
                <td data-label="الرصيد">${window.App.formatCurrency(s.balance)}</td>
                <td data-label="إجراءات">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${s.balance > 0 && window.App.hasPermission('suppliers', 'approve') ? `
                      <button class="btn btn-sm btn-warning" onclick="openSupplierPayment('${s.id}')" title="سداد">💰 سداد</button>
                    ` : ''}
                    <button class="btn btn-sm btn-ghost" onclick="viewSupplierStatement('${s.id}')">${window.App.icons.book}</button>
                    ${window.App.hasPermission('suppliers', 'edit') ? `<button class="btn btn-sm btn-ghost" onclick="openSupplierModal('${s.id}')">${window.App.icons.edit}</button>` : ''}
                    ${window.App.hasPermission('suppliers', 'delete') ? `<button class="btn btn-sm btn-danger" onclick="deleteSupplier('${s.id}')">${window.App.icons.trash}</button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    const listEl = document.getElementById('suppliers-list');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function openSupplierModal(id = null) {
  try {
    let supplier = { name: '', phone: '', address: '', tax_number: '', balance: 0 };
    if (id) {
      const { data } = await window.SB.getById('suppliers', id);
      if (data) supplier = data;
    }

    const bodyHtml = `
      <div class="input-group"><label>الاسم *</label><input type="text" id="sup-name" value="${window.App.escapeHtml(supplier.name)}"></div>
      <div class="input-group"><label>الهاتف</label><input type="text" id="sup-phone" value="${window.App.escapeHtml(supplier.phone || '')}"></div>
      <div class="input-group"><label>العنوان</label><input type="text" id="sup-address" value="${window.App.escapeHtml(supplier.address || '')}"></div>
      <div class="input-group"><label>الرقم الضريبي</label><input type="text" id="sup-tax" value="${window.App.escapeHtml(supplier.tax_number || '')}"></div>
      ${id ? `<div class="input-group"><label>الرصيد</label><input type="number" id="sup-balance" value="${supplier.balance}" step="0.01"></div>` : ''}
    `;

    window.App.openModal(id ? 'تعديل مورد' : 'مورد جديد', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-primary" id="save-sup-btn">${window.App.icons.check} حفظ</button>
    `);

    document.getElementById('save-sup-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.processing === 'true') return;
      const unlock = window.App.lockProcessing(btn);
      try {
        const payload = {
          name: document.getElementById('sup-name').value.trim(),
          phone: document.getElementById('sup-phone').value.trim(),
          address: document.getElementById('sup-address').value.trim(),
          tax_number: document.getElementById('sup-tax').value.trim()
        };
        if (!payload.name) throw new Error('الاسم مطلوب');
        if (id) payload.balance = Number(document.getElementById('sup-balance').value) || 0;

        const res = id
          ? await window.SB.update('suppliers', id, payload)
          : await window.SB.insert('suppliers', payload);
        if (res.error) throw new Error(res.error);
        await window.SB.logAudit(id ? 'update' : 'create', 'suppliers', id || res.data?.id, payload);
        window.App.showToast('تم الحفظ', 'success');
        window.App.closeModal();
        await loadSuppliersList();
      } catch (err) { window.App.showToast(err.message, 'error'); }
      finally { unlock(); }
    });
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function deleteSupplier(id) {
  const ok = await window.App.confirmDialog('حذف المورد؟', { type: 'danger', okText: 'حذف' });
  if (!ok) return;
  const { error } = await window.SB.delete('suppliers', id);
  if (error) return window.App.showToast(error, 'error');
  await window.SB.logAudit('delete', 'suppliers', id);
  window.App.showToast('تم الحذف', 'success');
  await loadSuppliersList();
}

async function viewSupplierStatement(id) {
  const { data: supplier } = await window.SB.getById('suppliers', id);
  const { data: payments } = await window.SB.select('supplier_payments', { eq: { supplier_id: id }, order: { column: 'created_at' } });

  const bodyHtml = `
    <h3 style="font-size:16px;font-weight:800;margin-bottom:8px;">${window.App.escapeHtml(supplier.name)}</h3>
    <div style="padding:12px;background:rgba(245,158,11,0.08);border-radius:10px;margin-bottom:12px;display:flex;justify-content:space-between;">
      <span>الرصيد الحالي:</span>
      <strong style="color:var(--accent);">${window.App.formatCurrency(supplier.balance)}</strong>
    </div>

    ${payments.length === 0 ? emptyState('لا توجد سدادات') : `
      <h4 style="font-size:13px;font-weight:700;margin:12px 0 8px;">سجل السدادات</h4>
      <div class="table-wrap" style="background:transparent;border:none;">
        <table>
          <thead><tr><th>المبلغ</th><th>الطريقة</th><th>البيان</th><th>التاريخ</th></tr></thead>
          <tbody>${payments.map(p => `
            <tr>
              <td>${window.App.formatCurrency(p.amount)}</td>
              <td>${p.payment_type === 'cash' ? 'كاش' : p.payment_type === 'bank' ? 'بنك' : 'خزنة أخرى'}</td>
              <td>${window.App.escapeHtml(p.description || '—')}</td>
              <td>${window.App.formatDate(p.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
  `;

  window.App.openModal('كشف حساب المورد', bodyHtml, `
    <button class="btn btn-primary" onclick="window.App.closeModal()">إغلاق</button>
  `);
}

async function openSupplierPayment(supplierId) {
  try {
    const { data: supplier } = await window.SB.getById('suppliers', supplierId);
    if (!supplier) throw new Error('المورد غير موجود');

    const { data: extraBoxes } = await window.SB.select('extra_cashboxes', { eq: { is_active: true }, order: { column: 'name' } });

    const bodyHtml = `
      <div style="padding:12px;background:rgba(245,158,11,0.08);border-radius:10px;margin-bottom:12px;display:flex;justify-content:space-between;">
        <span>الرصيد المستحق:</span>
        <strong style="color:var(--accent);">${window.App.formatCurrency(supplier.balance)}</strong>
      </div>

      <div class="input-group">
        <label>المبلغ المدفوع *</label>
        <input type="number" id="sup-pay-amount" min="0.01" max="${supplier.balance}" step="0.01" value="${supplier.balance}">
      </div>

      <div class="input-group">
        <label>طريقة الدفع *</label>
        <select id="sup-pay-type">
          <option value="cash">كاش</option>
          <option value="bank">بنك</option>
          ${extraBoxes.length > 0 ? `<option value="extra_box">خزنة أخرى</option>` : ''}
        </select>
      </div>

      <div class="input-group hidden" id="sup-extra-box-wrap">
        <label>اختر الخزنة</label>
        <select id="sup-pay-extra-box">
          ${extraBoxes.map(b => `<option value="${b.id}">${window.App.escapeHtml(b.name)} (${window.App.formatCurrency(b.balance)})</option>`).join('')}
        </select>
      </div>

      <div class="input-group hidden" id="sup-bank-ref-wrap">
        <label>رقم العملية البنكية</label>
        <input type="text" id="sup-pay-bank-ref" placeholder="اختياري">
      </div>

      <div class="input-group">
        <label>ملاحظات</label>
        <textarea id="sup-pay-desc" rows="2"></textarea>
      </div>
    `;

    window.App.openModal(`سداد إلى المورد - ${window.App.escapeHtml(supplier.name)}`, bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-warning" id="confirm-sup-pay-btn">${window.App.icons.check} تأكيد السداد</button>
    `);

    const typeSel = document.getElementById('sup-pay-type');
    typeSel.addEventListener('change', () => {
      document.getElementById('sup-extra-box-wrap').classList.toggle('hidden', typeSel.value !== 'extra_box');
      document.getElementById('sup-bank-ref-wrap').classList.toggle('hidden', typeSel.value !== 'bank');
    });

    document.getElementById('confirm-sup-pay-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.processing === 'true') return;
      const unlock = window.App.lockProcessing(btn, 'جاري السداد...');

      try {
        const amount = Number(document.getElementById('sup-pay-amount').value);
        const type = typeSel.value;
        const desc = document.getElementById('sup-pay-desc').value.trim();
        const bankRef = document.getElementById('sup-pay-bank-ref')?.value.trim();
        const extraBoxId = document.getElementById('sup-pay-extra-box')?.value;

        if (!amount || amount <= 0) throw new Error('المبلغ غير صحيح');

        const { error } = await window.SB.createSupplierPayment(supplierId, amount, type, {
          description: desc, bank_ref: bankRef, extra_box_id: extraBoxId
        });
        if (error) throw new Error(error);

        window.App.showToast('تم تسجيل السداد بنجاح', 'success');
        window.App.closeModal();
        await loadSuppliersList();
      } catch (err) { window.App.showToast(err.message, 'error'); }
      finally { unlock(); }
    });
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function exportSuppliersExcel() {
  const { data } = await window.SB.select('suppliers', { order: { column: 'name' } });
  const rows = [['الاسم', 'الهاتف', 'العنوان', 'الرصيد'],
    ...data.map(s => [s.name, s.phone || '', s.address || '', s.balance])];
  downloadCSV(rows, 'suppliers');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 5: المخزن (مع موافقة مزدوجة)
   ═══════════════════════════════════════════════════════════════ */

async function renderWarehouse(container) {
  try {
    if (!container) return;

    const { data: pendingOrders } = await window.SB.getPendingWarehouseOrders();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>المخزن</h2><p>المنتجات وحركات المخزون</p></div>
        <div class="page-header-actions">
          ${window.App.hasPermission('warehouse', 'add') ? `
            <button class="btn btn-primary" id="add-product-btn">${window.App.icons.plus} منتج جديد</button>
            <button class="btn btn-success" id="wh-in-btn">${window.App.icons.upload} إدخال</button>
            <button class="btn btn-danger" id="wh-out-btn">${window.App.icons.download} إخراج</button>
          ` : ''}
          <button class="btn btn-ghost" id="wh-export-btn">${window.App.icons.download} Excel</button>
        </div>
      </div>

      ${pendingOrders.length > 0 ? `
        <div class="card" style="margin-bottom:20px;border-color:rgba(245,158,11,0.4);background:rgba(245,158,11,0.05);">
          <div class="card-header">
            <div class="card-title" style="color:var(--warning);">
              ${window.App.icons.alert} طلبات صرف معلقة (${pendingOrders.length})
            </div>
          </div>
          
          <div id="pending-orders-list">
            ${pendingOrders.map(order => `
              <div class="pending-order-card" id="order-${order.id}" style="margin-bottom:12px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
                  <div>
                    <div style="font-weight:800;color:var(--accent);font-size:15px;">
                      ${window.App.escapeHtml(order.invoice_number)}
                    </div>
                    <div style="color:var(--text-3);font-size:12px;margin-top:4px;">
                      العميل: <strong>${window.App.escapeHtml(order.customers?.name || 'عميل نقدي')}</strong>
                    </div>
                    <div style="color:var(--text-3);font-size:11px;margin-top:2px;">
                      ${window.App.formatDateTime(order.created_at)}
                    </div>
                  </div>
                  <div style="text-align:left;">
                    <div style="font-size:18px;font-weight:800;color:var(--text);">
                      ${window.App.formatCurrency(order.total)}
                    </div>
                    <span class="badge badge-warning">بانتظار الموافقة</span>
                  </div>
                </div>

                <div id="order-items-${order.id}" style="margin-bottom:12px;">
                  <div style="text-align:center;color:var(--text-3);font-size:12px;padding:8px;">
                    <span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> جاري تحميل المنتجات...
                  </div>
                </div>

                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <button class="btn btn-success" onclick="openApproveWarehouseOrder('${order.id}', '${window.App.escapeHtml(order.invoice_number)}')">
                    ${window.App.icons.check} موافقة
                  </button>
                  <button class="btn btn-danger" onclick="openRejectWarehouseOrder('${order.id}', '${window.App.escapeHtml(order.invoice_number)}')">
                    ${window.App.icons.close} رفض
                  </button>
                  <button class="btn btn-ghost" onclick="viewSaleDetails('${order.id}')">
                    عرض التفاصيل
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="kpi-grid" id="wh-kpis"></div>

      <div class="filter-bar">
        <div class="input-group" style="flex:2;"><label>بحث</label><input type="text" id="wh-search" placeholder="ابحث باسم المنتج..."></div>
      </div>

      <div id="products-list"></div>
    `;

    await Promise.all([loadWarehouseKPIs(), loadProductsList()]);

    // تحميل بنود كل طلب
    for (const order of pendingOrders) {
      loadOrderItems(order.id);
    }

    document.getElementById('add-product-btn')?.addEventListener('click', () => openProductModal());
    document.getElementById('wh-in-btn')?.addEventListener('click', openStockInModal);
    document.getElementById('wh-out-btn')?.addEventListener('click', openStockOutModal);
    document.getElementById('wh-export-btn')?.addEventListener('click', exportWarehouseExcel);
    document.getElementById('wh-search')?.addEventListener('input', window.App.debounce((e) => loadProductsList(e.target.value), 250));
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadOrderItems(saleId) {
  try {
    const container = document.getElementById(`order-items-${saleId}`);
    if (!container) return;

    const { data: items } = await window.SB.select('sale_items', {
      select: '*, products(name, unit, quantity)',
      eq: { sale_id: saleId }
    });

    if (!items || items.length === 0) {
      container.innerHTML = '<p style="color:var(--text-3);font-size:12px;">لا توجد بنود</p>';
      return;
    }

    container.innerHTML = `
      <div style="background:rgba(59,130,246,0.06);border-radius:10px;padding:10px;overflow-x:auto;">
        <table style="width:100%;font-size:12px;">
          <thead>
            <tr style="color:var(--text-3);text-align:right;">
              <th style="padding:6px;">المنتج</th>
              <th style="padding:6px;">المطلوب</th>
              <th style="padding:6px;">المتاح</th>
              <th style="padding:6px;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => {
              const available = Number(item.products?.quantity || 0);
              const needed = Number(item.quantity);
              const enough = available >= needed;
              return `
                <tr style="border-top:1px solid var(--border);">
                  <td style="padding:6px;">${window.App.escapeHtml(item.products?.name || '—')}</td>
                  <td style="padding:6px;"><strong>${needed}</strong> ${item.products?.unit || ''}</td>
                  <td style="padding:6px;color:${enough ? 'var(--success)' : 'var(--danger)'};">
                    ${available}
                  </td>
                  <td style="padding:6px;">
                    ${enough 
                      ? '<span class="badge badge-success" style="font-size:10px;">متوفر</span>' 
                      : '<span class="badge badge-danger" style="font-size:10px;">غير كافٍ</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('loadOrderItems:', err);
  }
}

async function openApproveWarehouseOrder(saleId, invoiceNumber) {
  const bodyHtml = `
    <div style="padding:16px;background:rgba(16,185,129,0.08);border-radius:12px;margin-bottom:16px;">
      <div style="font-size:14px;color:var(--text-2);">
        الموافقة على صرف الفاتورة:
        <strong style="color:var(--success);font-size:16px;display:block;margin-top:4px;">
          ${window.App.escapeHtml(invoiceNumber)}
        </strong>
      </div>
    </div>

    <div class="input-group">
      <label>ملاحظات (اختياري)</label>
      <textarea id="wh-approve-notes" rows="2" placeholder="ملاحظات إضافية..."></textarea>
    </div>

    <div style="padding:12px;background:rgba(245,158,11,0.08);border-radius:10px;font-size:12.5px;color:var(--text-2);">
      ⚠️ بعد الموافقة سيتم خصم الكميات من المخزن مباشرة.
    </div>
  `;

  window.App.openModal('موافقة على الصرف', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-success" id="confirm-wh-approve">${window.App.icons.check} موافقة واعتماد</button>
  `);

  document.getElementById('confirm-wh-approve').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn, 'جاري الموافقة...');

    try {
      const notes = document.getElementById('wh-approve-notes').value.trim();

      const { error: whErr } = await window.SB.approveWarehouseOrder(saleId, notes);
      if (whErr) throw new Error(whErr);

      const { error: apprErr } = await window.SB.approveSale(saleId);
      if (apprErr) throw new Error(apprErr);

      window.App.showToast('تمت الموافقة على الصرف واعتماد الفاتورة', 'success');
      window.App.closeModal();
      await renderWarehouse(document.getElementById('content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    } finally {
      unlock();
    }
  });
}

async function openRejectWarehouseOrder(saleId, invoiceNumber) {
  const bodyHtml = `
    <div style="padding:16px;background:rgba(239,68,68,0.08);border-radius:12px;margin-bottom:16px;">
      <div style="font-size:14px;color:var(--text-2);">
        رفض صرف الفاتورة:
        <strong style="color:var(--danger);font-size:16px;display:block;margin-top:4px;">
          ${window.App.escapeHtml(invoiceNumber)}
        </strong>
      </div>
    </div>

    <div class="input-group">
      <label>سبب الرفض *</label>
      <textarea id="wh-reject-reason" rows="3" placeholder="مثال: الكمية غير متوفرة، المنتج محجوز..."></textarea>
    </div>

    <div style="padding:12px;background:rgba(239,68,68,0.08);border-radius:10px;font-size:12.5px;color:var(--text-2);">
      ⚠️ سيتم إشعار الكاشير بسبب الرفض.
    </div>
  `;

  window.App.openModal('رفض الصرف', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-danger" id="confirm-wh-reject">${window.App.icons.close} تأكيد الرفض</button>
  `);

  document.getElementById('confirm-wh-reject').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn);

    try {
      const reason = document.getElementById('wh-reject-reason').value.trim();
      if (!reason) throw new Error('سبب الرفض مطلوب');

      const { error } = await window.SB.rejectWarehouseOrder(saleId, reason);
      if (error) throw new Error(error);

      window.App.showToast('تم رفض الفاتورة', 'success');
      window.App.closeModal();
      await renderWarehouse(document.getElementById('content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    } finally {
      unlock();
    }
  });
}

async function loadWarehouseKPIs() {
  try {
    const kpisEl = document.getElementById('wh-kpis');
    if (!kpisEl) return;

    const { data: products } = await window.SB.select('products');
    const totalProducts = products.length;
    const totalValue = products.reduce((s, p) => s + (Number(p.quantity) * Number(p.cost_price || 0)), 0);
    const lowStock = products.filter(p => Number(p.quantity) <= Number(p.min_quantity)).length;
    const totalQuantity = products.reduce((s, p) => s + Number(p.quantity), 0);

    kpisEl.innerHTML = `
      ${kpiCard('عدد المنتجات', window.App.formatNumber(totalProducts), 'box', 'blue')}
      ${kpiCard('إجمالي الكميات', window.App.formatNumber(totalQuantity), 'activity', 'cyan')}
      ${kpiCard('قيمة المخزون', window.App.formatCurrency(totalValue), 'money', 'gold')}
      ${kpiCard('منتجات منخفضة', window.App.formatNumber(lowStock), 'alert', lowStock > 0 ? 'red' : 'green')}
    `;
  } catch (err) { console.warn('KPI error:', err); }
}

async function loadProductsList(search = '') {
  try {
    const listEl = document.getElementById('products-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="skeleton skeleton-card" style="height:150px;"></div>';

    const opts = { order: { column: 'name' } };
    if (search) opts.like = { name: search };
    const { data: products } = await window.SB.select('products', opts);

    if (!listEl) return;
    if (!products.length) { listEl.innerHTML = emptyState('لا توجد منتجات'); return; }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="responsive">
          <thead><tr><th>الاسم</th><th>النوع</th><th>الوحدة</th><th>الكمية</th><th>الحد الأدنى</th><th>تكلفة</th><th>سعر البيع</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${products.map(p => {
              const low = Number(p.quantity) <= Number(p.min_quantity);
              return `
                <tr>
                  <td data-label="الاسم"><strong>${window.App.escapeHtml(p.name)}</strong>${low ? ' <span class="badge badge-danger" style="font-size:9px;">منخفض</span>' : ''}</td>
                  <td data-label="النوع">${window.App.escapeHtml(p.type || '—')}</td>
                  <td data-label="الوحدة">${window.App.escapeHtml(p.unit || '—')}</td>
                  <td data-label="الكمية" class="${low ? 'text-danger' : ''}"><strong>${window.App.formatNumber(p.quantity)}</strong></td>
                  <td data-label="الحد الأدنى">${window.App.formatNumber(p.min_quantity)}</td>
                  <td data-label="تكلفة">${window.App.formatCurrency(p.cost_price)}</td>
                  <td data-label="سعر البيع">${window.App.formatCurrency(p.sale_price)}</td>
                  <td data-label="إجراءات">
                    <div style="display:flex;gap:6px;">
                      <button class="btn btn-sm btn-ghost" onclick="viewProductMovements('${p.id}')">${window.App.icons.activity}</button>
                      ${window.App.hasPermission('warehouse', 'edit') ? `<button class="btn btn-sm btn-ghost" onclick="openProductModal('${p.id}')">${window.App.icons.edit}</button>` : ''}
                      ${window.App.hasPermission('warehouse', 'delete') ? `<button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">${window.App.icons.trash}</button>` : ''}
                    </div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    const listEl = document.getElementById('products-list');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function openProductModal(id = null) {
  try {
    let product = { name: '', type: '', unit: 'قطعة', quantity: 0, min_quantity: 0, cost_price: 0, sale_price: 0 };
    if (id) {
      const { data } = await window.SB.getById('products', id);
      if (data) product = data;
    }

    const bodyHtml = `
      <div class="input-group"><label>الاسم *</label><input type="text" id="prod-name" value="${window.App.escapeHtml(product.name)}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="input-group"><label>النوع</label><input type="text" id="prod-type" value="${window.App.escapeHtml(product.type || '')}"></div>
        <div class="input-group"><label>الوحدة</label><input type="text" id="prod-unit" value="${window.App.escapeHtml(product.unit || '')}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="input-group"><label>الكمية ${id ? 'الحالية' : 'الافتتاحية'}</label><input type="number" id="prod-qty" value="${product.quantity}" step="0.01" ${id ? 'readonly' : ''}></div>
        <div class="input-group"><label>الحد الأدنى</label><input type="number" id="prod-min" value="${product.min_quantity}" step="0.01"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="input-group"><label>سعر التكلفة</label><input type="number" id="prod-cost" value="${product.cost_price}" step="0.01"></div>
        <div class="input-group"><label>سعر البيع</label><input type="number" id="prod-sale" value="${product.sale_price}" step="0.01"></div>
      </div>
    `;

    window.App.openModal(id ? 'تعديل منتج' : 'منتج جديد', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-primary" id="save-prod-btn">${window.App.icons.check} حفظ</button>
    `);

    document.getElementById('save-prod-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.processing === 'true') return;
      const unlock = window.App.lockProcessing(btn);
      try {
        const payload = {
          name: document.getElementById('prod-name').value.trim(),
          type: document.getElementById('prod-type').value.trim(),
          unit: document.getElementById('prod-unit').value.trim() || 'قطعة',
          min_quantity: Number(document.getElementById('prod-min').value) || 0,
          cost_price: Number(document.getElementById('prod-cost').value) || 0,
          sale_price: Number(document.getElementById('prod-sale').value) || 0
        };
        if (!payload.name) throw new Error('الاسم مطلوب');

        if (id) {
          const res = await window.SB.update('products', id, payload);
          if (res.error) throw new Error(res.error);
          await window.SB.logAudit('update', 'products', id, payload);
        } else {
          payload.quantity = Number(document.getElementById('prod-qty').value) || 0;
          const res = await window.SB.insert('products', payload);
          if (res.error) throw new Error(res.error);
          await window.SB.logAudit('create', 'products', res.data?.id, payload);
          if (payload.quantity > 0) {
            await window.SB.insert('warehouse_transactions', {
              product_id: res.data.id, type: 'in', quantity: payload.quantity, reason: 'رصيد افتتاحي'
            });
          }
        }

        window.App.showToast('تم الحفظ', 'success');
        window.App.closeModal();
        await loadProductsList();
        await loadWarehouseKPIs();
      } catch (err) { window.App.showToast(err.message, 'error'); }
      finally { unlock(); }
    });
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function deleteProduct(id) {
  const ok = await window.App.confirmDialog('حذف المنتج؟ سيتم حذف كل حركاته', { type: 'danger', okText: 'حذف' });
  if (!ok) return;
  const { error } = await window.SB.delete('products', id);
  if (error) return window.App.showToast(error, 'error');
  await window.SB.logAudit('delete', 'products', id);
  window.App.showToast('تم الحذف', 'success');
  await loadProductsList();
  await loadWarehouseKPIs();
}

async function openStockInModal() {
  try {
    const { data: products } = await window.SB.select('products', { order: { column: 'name' } });

    const bodyHtml = `
      <div class="input-group">
        <label>المنتج</label>
        <select id="wh-prod">
          <option value="">— اختر —</option>
          ${products.map(p => `<option value="${p.id}">${window.App.escapeHtml(p.name)} (متاح: ${p.quantity})</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>الكمية *</label><input type="number" id="wh-qty" min="0.01" step="0.01" value="1"></div>
      <div class="input-group"><label>السبب / البيان</label><input type="text" id="wh-reason" placeholder="مثال: إنتاج جديد"></div>
    `;

    window.App.openModal('إدخال مخزون', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-success" id="save-wh-in">${window.App.icons.check} إدخال</button>
    `);

    document.getElementById('save-wh-in').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.processing === 'true') return;
      const unlock = window.App.lockProcessing(btn);
      try {
        const productId = document.getElementById('wh-prod').value;
        const qty = Number(document.getElementById('wh-qty').value);
        const reason = document.getElementById('wh-reason').value.trim();
        if (!productId) throw new Error('اختر منتجاً');
        if (qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');

        const { data: product } = await window.SB.getById('products', productId);
        await window.SB.update('products', productId, { quantity: Number(product.quantity) + qty });
        await window.SB.insert('warehouse_transactions', {
          product_id: productId, type: 'in', quantity: qty, reason: reason || 'إدخال يدوي'
        });
        await window.SB.logAudit('create', 'warehouse_transactions', null, { productId, qty, reason });

        window.App.showToast('تم الإدخال', 'success');
        window.App.closeModal();
        await loadProductsList();
        await loadWarehouseKPIs();
      } catch (err) { window.App.showToast(err.message, 'error'); }
      finally { unlock(); }
    });
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function openStockOutModal() {
  try {
    const { data: products } = await window.SB.select('products', { order: { column: 'name' }, gt: { quantity: 0 } });
    const { data: customers } = await window.SB.select('customers', { order: { column: 'name' } });
    const { data: suppliers } = await window.SB.select('suppliers', { order: { column: 'name' } });
    const { data: externalLocs } = await window.SB.select('external_locations', { eq: { is_active: true } });

    const bodyHtml = `
      <div class="input-group">
        <label>المنتج *</label>
        <select id="so-prod">
          <option value="">— اختر —</option>
          ${products.map(p => `<option value="${p.id}" data-available="${p.quantity}">${window.App.escapeHtml(p.name)} (متاح: ${p.quantity} ${p.unit || ''})</option>`).join('')}
        </select>
      </div>

      <div class="input-group">
        <label>الكمية *</label>
        <input type="number" id="so-qty" min="0.01" step="0.01" value="1">
      </div>

      <div class="input-group">
        <label>السبب *</label>
        <select id="so-reason">
          <option value="sale">بيع</option>
          <option value="return">مرتجع لمورد</option>
          <option value="transfer">نقل إلى فرع آخر</option>
          <option value="damage">تلف</option>
          <option value="gift">هدية / تبرع</option>
          <option value="other">أخرى</option>
        </select>
      </div>

      <div class="input-group">
        <label>الجهة المستقبلة *</label>
        <select id="so-dest-type">
          <option value="customer">عميل</option>
          <option value="supplier">مورد</option>
          <option value="external">جهة خارجية</option>
          <option value="other">أخرى</option>
        </select>
      </div>

      <div class="input-group hidden" id="so-customer-wrap">
        <label>اختر العميل</label>
        <select id="so-customer">
          <option value="">— اختر —</option>
          ${customers.map(c => `<option value="${c.id}">${window.App.escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>

      <div class="input-group hidden" id="so-supplier-wrap">
        <label>اختر المورد</label>
        <select id="so-supplier">
          <option value="">— اختر —</option>
          ${suppliers.map(s => `<option value="${s.id}">${window.App.escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>

      <div class="input-group hidden" id="so-external-wrap">
        <label>اختر الجهة</label>
        <select id="so-external">
          <option value="">— اختر —</option>
          ${externalLocs.map(e => `<option value="${e.id}">${window.App.escapeHtml(e.name)}</option>`).join('')}
        </select>
      </div>

      <div class="input-group hidden" id="so-other-wrap">
        <label>اسم الجهة</label>
        <input type="text" id="so-other-name" placeholder="اكتب اسم الجهة">
      </div>

      <div class="input-group">
        <label>ملاحظات</label>
        <textarea id="so-notes" rows="2" placeholder="ملاحظات إضافية..."></textarea>
      </div>
    `;

    window.App.openModal('إخراج من المخزن', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-danger" id="save-so-btn">${window.App.icons.check} تأكيد الإخراج</button>
    `);

    const destType = document.getElementById('so-dest-type');
    const toggleDest = () => {
      const v = destType.value;
      document.getElementById('so-customer-wrap').classList.toggle('hidden', v !== 'customer');
      document.getElementById('so-supplier-wrap').classList.toggle('hidden', v !== 'supplier');
      document.getElementById('so-external-wrap').classList.toggle('hidden', v !== 'external');
      document.getElementById('so-other-wrap').classList.toggle('hidden', v !== 'other');
    };
    destType.addEventListener('change', toggleDest);
    toggleDest();

    document.getElementById('save-so-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.processing === 'true') return;
      const unlock = window.App.lockProcessing(btn, 'جاري الإخراج...');

      try {
        const productId = document.getElementById('so-prod').value;
        const qty = Number(document.getElementById('so-qty').value);
        const reason = document.getElementById('so-reason').value;
        const dType = destType.value;
        const notes = document.getElementById('so-notes').value.trim();

        if (!productId) throw new Error('اختر منتجاً');
        if (qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');

        let destId = null, destName = '';
        if (dType === 'customer') {
          destId = document.getElementById('so-customer').value;
          if (!destId) throw new Error('اختر العميل');
          destName = customers.find(x => x.id === destId)?.name || '';
        } else if (dType === 'supplier') {
          destId = document.getElementById('so-supplier').value;
          if (!destId) throw new Error('اختر المورد');
          destName = suppliers.find(x => x.id === destId)?.name || '';
        } else if (dType === 'external') {
          destId = document.getElementById('so-external').value;
          if (!destId) throw new Error('اختر الجهة');
          destName = externalLocs.find(x => x.id === destId)?.name || '';
        } else {
          destName = document.getElementById('so-other-name').value.trim();
          if (!destName) throw new Error('اكتب اسم الجهة');
        }

        const { error } = await window.SB.stockOut(productId, qty, reason, {
          destination_type: dType,
          destination_id: destId,
          destination_name: destName,
          notes
        });
        if (error) throw new Error(error);

        window.App.showToast('تم الإخراج بنجاح', 'success');
        window.App.closeModal();
        await loadProductsList();
        await loadWarehouseKPIs();
      } catch (err) { window.App.showToast(err.message, 'error'); }
      finally { unlock(); }
    });
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function viewProductMovements(productId) {
  try {
    const { data: product } = await window.SB.getById('products', productId);
    const { data: movements } = await window.SB.getProductMovements(productId);

    const bodyHtml = `
      <h3 style="font-size:15px;font-weight:700;margin-bottom:8px;">${window.App.escapeHtml(product.name)}</h3>
      <p style="color:var(--text-3);font-size:12px;margin-bottom:12px;">الكمية الحالية: ${window.App.formatNumber(product.quantity)} ${product.unit || ''}</p>

      ${movements.length === 0 ? emptyState('لا توجد حركات') : `
        <div class="table-wrap" style="background:transparent;border:none;">
          <table>
            <thead><tr><th>النوع</th><th>الكمية</th><th>الرصيد</th><th>السبب</th><th>التاريخ</th></tr></thead>
            <tbody>${movements.map(m => `
              <tr>
                <td>${m.type === 'in' ? '<span class="badge badge-success">إدخال</span>' : m.type === 'out' ? '<span class="badge badge-danger">إخراج</span>' : '<span class="badge badge-warning">تعديل</span>'}</td>
                <td>${window.App.formatNumber(m.quantity)}</td>
                <td><strong>${window.App.formatNumber(m.running_balance)}</strong></td>
                <td>${window.App.escapeHtml(m.reason || '—')}</td>
                <td>${window.App.formatDate(m.created_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
    `;

    window.App.openModal('حركة المنتج', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.print()">${window.App.icons.print} طباعة</button>
      <button class="btn btn-primary" onclick="window.App.closeModal()">إغلاق</button>
    `);
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function exportWarehouseExcel() {
  const { data } = await window.SB.select('products', { order: { column: 'name' } });
  const rows = [['الاسم', 'النوع', 'الوحدة', 'الكمية', 'الحد الأدنى', 'التكلفة', 'سعر البيع', 'القيمة'],
    ...data.map(p => [p.name, p.type || '', p.unit || '', p.quantity, p.min_quantity, p.cost_price, p.sale_price, p.quantity * p.cost_price])];
  downloadCSV(rows, 'warehouse');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 6: الخزائن والبنوك
   ═══════════════════════════════════════════════════════════════ */

async function renderTreasury(container) {
  try {
    if (!container) return;
    const [cash, bank, extra] = await Promise.all([
      window.SB.getCashBalance(),
      window.SB.getBankBalance(),
      window.SB.getExtraBoxesBalance()
    ]);

    const { data: extraBoxes } = await window.SB.select('extra_cashboxes', { eq: { is_active: true } });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>الخزائن والبنوك</h2><p>الكاش والبنك والتحويلات</p></div>
        <div class="page-header-actions">
          ${window.App.hasPermission('treasury', 'add') ? `
            <button class="btn btn-accent" id="transfer-btn">${window.App.icons.plus} تحويل</button>
            <button class="btn btn-primary" id="add-extra-box-btn">${window.App.icons.plus} خزنة جديدة</button>
          ` : ''}
          <button class="btn btn-ghost" id="treasury-export-btn">${window.App.icons.download} Excel</button>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpiCard('خزنة الكاش', window.App.formatCurrency(cash), 'wallet', 'gold')}
        ${kpiCard('خزنة البنك', window.App.formatCurrency(bank), 'money', 'blue')}
        ${kpiCard('خزائن أخرى', window.App.formatCurrency(extra), 'wallet', 'cyan')}
        ${kpiCard('الرصيد الكلي', window.App.formatCurrency(cash + bank + extra), 'wallet', 'green')}
      </div>

      ${extraBoxes.length > 0 ? `
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><div class="card-title">${window.App.icons.wallet} الخزائن الإضافية</div></div>
          <div class="table-wrap" style="background:transparent;border:none;">
            <table class="responsive">
              <thead><tr><th>الاسم</th><th>النوع</th><th>الرصيد</th><th>ملاحظات</th></tr></thead>
              <tbody>${extraBoxes.map(b => `
                <tr>
                  <td data-label="الاسم"><strong>${window.App.escapeHtml(b.name)}</strong></td>
                  <td data-label="النوع">${b.type === 'cash' ? 'كاش' : b.type === 'bank' ? 'بنك' : 'أخرى'}</td>
                  <td data-label="الرصيد">${window.App.formatCurrency(b.balance)}</td>
                  <td data-label="ملاحظات">${window.App.escapeHtml(b.notes || '—')}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;" class="dashboard-grid">
        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.wallet} حركات الكاش</div></div>
          <div id="cash-trans-list"></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.money} حركات البنك</div></div>
          <div id="bank-trans-list"></div>
        </div>
      </div>

      <div class="card" style="margin-top:20px;">
        <div class="card-header"><div class="card-title">${window.App.icons.activity} التحويلات</div></div>
        <div id="transfers-list"></div>
      </div>
    `;

    adjustDashboardGrid();

    await Promise.all([loadCashTransactions(), loadBankTransactions(), loadTransfers()]);

    document.getElementById('transfer-btn')?.addEventListener('click', openTransferModal);
    document.getElementById('add-extra-box-btn')?.addEventListener('click', openAddExtraBoxModal);
    document.getElementById('treasury-export-btn')?.addEventListener('click', exportTreasuryExcel);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadCashTransactions() {
  try {
    const { data } = await window.SB.select('cash_transactions', { order: { column: 'created_at', ascending: false }, limit: 20 });
    const el = document.getElementById('cash-trans-list');
    if (!el) return;
    if (!data.length) { el.innerHTML = emptyState('لا توجد حركات'); return; }
    el.innerHTML = `
      <div class="table-wrap" style="background:transparent;border:none;">
        <table class="responsive">
          <thead><tr><th>النوع</th><th>المبلغ</th><th>البيان</th><th>التاريخ</th></tr></thead>
          <tbody>${data.map(t => `
            <tr>
              <td data-label="النوع">${t.type === 'in' ? '<span class="badge badge-success">إيداع</span>' : '<span class="badge badge-danger">سحب</span>'}</td>
              <td data-label="المبلغ" class="${t.type === 'in' ? 'text-success' : 'text-danger'}">${window.App.formatCurrency(t.amount)}</td>
              <td data-label="البيان">${window.App.escapeHtml(t.description || '—')}</td>
              <td data-label="التاريخ">${window.App.formatDate(t.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { console.warn('cash trans:', err); }
}

async function loadBankTransactions() {
  try {
    const { data } = await window.SB.select('bank_transactions', { order: { column: 'created_at', ascending: false }, limit: 20 });
    const el = document.getElementById('bank-trans-list');
    if (!el) return;
    if (!data.length) { el.innerHTML = emptyState('لا توجد حركات'); return; }
    el.innerHTML = `
      <div class="table-wrap" style="background:transparent;border:none;">
        <table class="responsive">
          <thead><tr><th>النوع</th><th>المبلغ</th><th>المرجع</th><th>التاريخ</th></tr></thead>
          <tbody>${data.map(t => `
            <tr>
              <td data-label="النوع">${t.type === 'in' ? '<span class="badge badge-success">إيداع</span>' : '<span class="badge badge-danger">سحب</span>'}</td>
              <td data-label="المبلغ" class="${t.type === 'in' ? 'text-success' : 'text-danger'}">${window.App.formatCurrency(t.amount)}</td>
              <td data-label="المرجع">${window.App.escapeHtml(t.bank_ref || t.description || '—')}</td>
              <td data-label="التاريخ">${window.App.formatDate(t.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { console.warn('bank trans:', err); }
}

async function loadTransfers() {
  try {
    const { data } = await window.SB.select('transfers', { order: { column: 'created_at', ascending: false }, limit: 20 });
    const el = document.getElementById('transfers-list');
    if (!el) return;
    if (!data.length) { el.innerHTML = emptyState('لا توجد تحويلات'); return; }
    el.innerHTML = `
      <div class="table-wrap" style="background:transparent;border:none;">
        <table class="responsive">
          <thead><tr><th>من</th><th>إلى</th><th>المستفيد</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
          <tbody>${data.map(t => `
            <tr>
              <td data-label="من">${t.from_type === 'cash' ? 'كاش' : 'بنك'}</td>
              <td data-label="إلى">${t.to_type === 'cash' ? 'كاش' : 'بنك'}</td>
              <td data-label="المستفيد">${window.App.escapeHtml(t.to_name || '—')}</td>
              <td data-label="المبلغ">${window.App.formatCurrency(t.amount)}</td>
              <td data-label="التاريخ">${window.App.formatDate(t.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { console.warn('transfers:', err); }
}

async function openTransferModal() {
  const [cash, bank] = await Promise.all([window.SB.getCashBalance(), window.SB.getBankBalance()]);

  const bodyHtml = `
    <div style="padding:10px;background:rgba(59,130,246,0.08);border-radius:8px;margin-bottom:12px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>رصيد الكاش:</span><strong>${window.App.formatCurrency(cash)}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span>رصيد البنك:</span><strong>${window.App.formatCurrency(bank)}</strong></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="input-group"><label>من</label>
        <select id="tr-from"><option value="cash">كاش</option><option value="bank">بنك</option></select>
      </div>
      <div class="input-group"><label>إلى</label>
        <select id="tr-to"><option value="bank">بنك</option><option value="cash">كاش</option></select>
      </div>
    </div>
    <div class="input-group"><label>المبلغ *</label><input type="number" id="tr-amount" min="0.01" step="0.01" value="0"></div>
    <div class="input-group"><label>المستفيد (لمن التحويل)</label><input type="text" id="tr-name" placeholder="اسم المستفيد"></div>
    <div class="input-group"><label>البيان</label><input type="text" id="tr-desc"></div>
  `;

  window.App.openModal('تحويل بين الخزائن', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-primary" id="save-tr-btn">${window.App.icons.check} تحويل</button>
  `);

  document.getElementById('save-tr-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn);
    try {
      const from = document.getElementById('tr-from').value;
      const to = document.getElementById('tr-to').value;
      const amount = Number(document.getElementById('tr-amount').value);
      const toName = document.getElementById('tr-name').value.trim();
      const desc = document.getElementById('tr-desc').value.trim();

      if (from === to) throw new Error('لا يمكن التحويل لنفس الخزنة');
      if (amount <= 0) throw new Error('المبلغ غير صحيح');

      const { error } = await window.SB.createTransfer(from, to, amount, toName, desc);
      if (error) throw new Error(error);

      window.App.showToast('تم التحويل بنجاح', 'success');
      window.App.closeModal();
      await renderTreasury(document.getElementById('content'));
    } catch (err) { window.App.showToast(err.message, 'error'); }
    finally { unlock(); }
  });
}

async function openAddExtraBoxModal() {
  const bodyHtml = `
    <div class="input-group"><label>اسم الخزنة *</label><input type="text" id="eb-name" placeholder="مثال: خزنة الفرع الثاني"></div>
    <div class="input-group"><label>النوع *</label>
      <select id="eb-type">
        <option value="cash">كاش</option>
        <option value="bank">بنك</option>
        <option value="other">أخرى</option>
      </select>
    </div>
    <div class="input-group"><label>الرصيد الافتتاحي</label><input type="number" id="eb-balance" value="0" step="0.01"></div>
    <div class="input-group"><label>ملاحظات</label><textarea id="eb-notes" rows="2"></textarea></div>
  `;

  window.App.openModal('إضافة خزنة جديدة', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-primary" id="save-eb-btn">${window.App.icons.check} حفظ</button>
  `);

  document.getElementById('save-eb-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn);
    try {
      const payload = {
        name: document.getElementById('eb-name').value.trim(),
        type: document.getElementById('eb-type').value,
        balance: Number(document.getElementById('eb-balance').value) || 0,
        notes: document.getElementById('eb-notes').value.trim()
      };
      if (!payload.name) throw new Error('الاسم مطلوب');

      const { error } = await window.SB.insert('extra_cashboxes', payload);
      if (error) throw new Error(error);
      await window.SB.logAudit('create', 'extra_cashboxes', null, payload);

      window.App.showToast('تم الحفظ', 'success');
      window.App.closeModal();
      await renderTreasury(document.getElementById('content'));
    } catch (err) { window.App.showToast(err.message, 'error'); }
    finally { unlock(); }
  });
}

async function exportTreasuryExcel() {
  const [cash, bank, extra] = await Promise.all([
    window.SB.getCashBalance(), window.SB.getBankBalance(), window.SB.getExtraBoxesBalance()
  ]);
  const { data: cashTrans } = await window.SB.select('cash_transactions', { order: { column: 'created_at', ascending: false } });
  const { data: bankTrans } = await window.SB.select('bank_transactions', { order: { column: 'created_at', ascending: false } });

  const rows = [
    ['الأرصدة'],
    ['خزنة الكاش', cash],
    ['خزنة البنك', bank],
    ['خزائن أخرى', extra],
    ['الإجمالي', cash + bank + extra],
    [],
    ['حركات الكاش'],
    ['النوع', 'المبلغ', 'البيان', 'التاريخ'],
    ...cashTrans.map(t => [t.type === 'in' ? 'إيداع' : 'سحب', t.amount, t.description || '', window.App.formatDateTime(t.created_at)]),
    [],
    ['حركات البنك'],
    ['النوع', 'المبلغ', 'المرجع', 'التاريخ'],
    ...bankTrans.map(t => [t.type === 'in' ? 'إيداع' : 'سحب', t.amount, t.bank_ref || '', window.App.formatDateTime(t.created_at)])
  ];
  downloadCSV(rows, 'treasury');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 7: المصروفات
   ═══════════════════════════════════════════════════════════════ */

async function renderExpenses(container) {
  try {
    if (!container) return;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>المصروفات</h2><p>المصروفات التشغيلية وغير التشغيلية</p></div>
        <div class="page-header-actions">
          ${window.App.hasPermission('expenses', 'add') ? `<button class="btn btn-primary" id="add-expense-btn">${window.App.icons.plus} مصروف جديد</button>` : ''}
          <button class="btn btn-ghost" id="expenses-export-btn">${window.App.icons.download} Excel</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="input-group"><label>من تاريخ</label><input type="date" id="exp-from" value="${window.App.monthStartISO()}"></div>
        <div class="input-group"><label>إلى تاريخ</label><input type="date" id="exp-to" value="${window.App.todayISO()}"></div>
        <div class="input-group"><label>النوع</label>
          <select id="exp-type">
            <option value="">الكل</option>
            <option value="operational">تشغيلي</option>
            <option value="non_operational">غير تشغيلي</option>
          </select>
        </div>
        <button class="btn btn-ghost" id="exp-filter-btn">${window.App.icons.search} تصفية</button>
      </div>

      <div id="expenses-kpis" class="kpi-grid"></div>
      <div id="expenses-list"></div>
    `;

    await loadExpensesList();
    document.getElementById('add-expense-btn')?.addEventListener('click', openExpenseModal);
    document.getElementById('exp-filter-btn')?.addEventListener('click', loadExpensesList);
    document.getElementById('expenses-export-btn')?.addEventListener('click', exportExpensesExcel);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadExpensesList() {
  try {
    const listEl = document.getElementById('expenses-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const from = document.getElementById('exp-from')?.value;
    const to = document.getElementById('exp-to')?.value;
    const type = document.getElementById('exp-type')?.value;

    const opts = { order: { column: 'created_at', ascending: false } };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };
    if (type) opts.eq = { type };

    const { data } = await window.SB.select('expenses', opts);
    const total = data.reduce((s, e) => s + Number(e.amount), 0);
    const approved = data.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0);

    const kpisEl = document.getElementById('expenses-kpis');
    if (kpisEl) {
      kpisEl.innerHTML = `
        ${kpiCard('إجمالي المصروفات', window.App.formatCurrency(total), 'receipt', 'red')}
        ${kpiCard('المعتمدة فقط', window.App.formatCurrency(approved), 'check', 'green')}
        ${kpiCard('عدد المصروفات', window.App.formatNumber(data.length), 'activity', 'blue')}
      `;
    }

    if (!listEl) return;
    if (!data.length) { listEl.innerHTML = emptyState('لا توجد مصروفات'); return; }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="responsive">
          <thead><tr><th>الفئة</th><th>النوع</th><th>البيان</th><th>المبلغ</th><th>الخزنة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
          <tbody>${data.map(e => `
            <tr>
              <td data-label="الفئة"><strong>${window.App.escapeHtml(e.category)}</strong></td>
              <td data-label="النوع">${e.type === 'operational' ? 'تشغيلي' : 'غير تشغيلي'}</td>
              <td data-label="البيان">${window.App.escapeHtml(e.description || '—')}</td>
              <td data-label="المبلغ" class="text-danger">${window.App.formatCurrency(e.amount)}</td>
              <td data-label="الخزنة">${e.cashbox_type === 'cash' ? 'كاش' : 'بنك'}</td>
              <td data-label="الحالة">${statusBadge(e.status)}</td>
              <td data-label="التاريخ">${window.App.formatDate(e.created_at)}</td>
              <td data-label="إجراءات">
                ${e.status === 'pending' && window.App.hasPermission('expenses', 'approve') ? `
                  <button class="btn btn-sm btn-success" onclick="approveExpenseConfirm('${e.id}')">${window.App.icons.check} اعتماد</button>
                ` : '—'}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    const listEl = document.getElementById('expenses-list');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function openExpenseModal() {
  const [cash, bank] = await Promise.all([window.SB.getCashBalance(), window.SB.getBankBalance()]);

  const bodyHtml = `
    <div class="input-group"><label>الفئة *</label>
      <input type="text" id="exp-cat" list="exp-cats" placeholder="مثال: رواتب، كهرباء، إيجار">
      <datalist id="exp-cats">
        <option value="رواتب"><option value="كهرباء"><option value="ماء"><option value="إيجار">
        <option value="صيانة"><option value="نقل"><option value="مصاريف بنكية">
      </datalist>
    </div>
    <div class="input-group"><label>النوع *</label>
      <select id="exp-type-input">
        <option value="operational">تشغيلي</option>
        <option value="non_operational">غير تشغيلي</option>
      </select>
    </div>
    <div class="input-group"><label>البيان / السبب</label><textarea id="exp-desc" rows="2"></textarea></div>
    <div class="input-group"><label>المبلغ *</label><input type="number" id="exp-amount" min="0.01" step="0.01" value="0"></div>
    <div class="input-group"><label>الخزنة *</label>
      <select id="exp-box">
        <option value="cash">كاش (رصيد: ${window.App.formatCurrency(cash)})</option>
        <option value="bank">بنك (رصيد: ${window.App.formatCurrency(bank)})</option>
      </select>
    </div>
  `;

  window.App.openModal('مصروف جديد', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-primary" id="save-exp-btn">${window.App.icons.check} حفظ واعتماد</button>
  `);

  document.getElementById('save-exp-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn, 'جاري الحفظ...');
    try {
      const payload = {
        category: document.getElementById('exp-cat').value.trim(),
        type: document.getElementById('exp-type-input').value,
        description: document.getElementById('exp-desc').value.trim(),
        amount: Number(document.getElementById('exp-amount').value),
        cashbox_type: document.getElementById('exp-box').value,
        payment_method: document.getElementById('exp-box').value,
        status: 'pending'
      };
      if (!payload.category) throw new Error('الفئة مطلوبة');
      if (payload.amount <= 0) throw new Error('المبلغ غير صحيح');

      const res = await window.SB.insert('expenses', payload);
      if (res.error) throw new Error(res.error);

      const { error: apprErr } = await window.SB.approveExpense(res.data.id);
      if (apprErr) throw new Error(apprErr);

      window.App.showToast('تم حفظ واعتماد المصروف', 'success');
      window.App.closeModal();
      await loadExpensesList();
    } catch (err) { window.App.showToast(err.message, 'error'); }
    finally { unlock(); }
  });
}

async function approveExpenseConfirm(id) {
  const ok = await window.App.confirmDialog('اعتماد المصروف؟ سيتم خصمه من الخزنة', { type: 'info', okText: 'اعتماد' });
  if (!ok) return;
  const { error } = await window.SB.approveExpense(id);
  if (error) return window.App.showToast(error, 'error');
  window.App.showToast('تم الاعتماد', 'success');
  await loadExpensesList();
}

async function exportExpensesExcel() {
  const from = document.getElementById('exp-from').value;
  const to = document.getElementById('exp-to').value;
  const opts = {};
  if (from) opts.gte = { created_at: from };
  if (to) opts.lte = { created_at: to + 'T23:59:59' };
  const { data } = await window.SB.select('expenses', opts);

  const rows = [['الفئة', 'النوع', 'البيان', 'المبلغ', 'الخزنة', 'الحالة', 'التاريخ'],
    ...data.map(e => [e.category, e.type === 'operational' ? 'تشغيلي' : 'غير تشغيلي', e.description || '',
      e.amount, e.cashbox_type === 'cash' ? 'كاش' : 'بنك', e.status, window.App.formatDateTime(e.created_at)])];
  downloadCSV(rows, 'expenses');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   التصدير العام
   ═══════════════════════════════════════════════════════════════ */

window.Modules = {
  renderDashboard,
  refreshDashboard,
  renderSales,
  renderCustomers,
  renderSuppliers,
  renderWarehouse,
  renderTreasury,
  renderExpenses,
  kpiCard,
  statusBadge,
  emptyState,
  downloadCSV,
  loadExpensesList,
  // دوال الموافقة
  loadOrderItems,
  openApproveWarehouseOrder,
  openRejectWarehouseOrder
};

console.log('✅ modules.js جاهز (محدّث - نظام موافقة مزدوجة)');
