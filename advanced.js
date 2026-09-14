/* ═══════════════════════════════════════════════════════════════
   نظام إدارة قسم الحبل - مصنع الصندل
   advanced.js - القيود + التسويات + التدقيق + الصلاحيات
                 + الإعدادات + إدارة المستخدمين + النسخ الاحتياطي
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   الوحدة 8: القيود والقوائم المالية
   ═══════════════════════════════════════════════════════════════ */

async function renderJournal(container) {
  try {
    if (!container) return;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>القيود والقوائم المالية</h2><p>دفتر اليومية والقوائم المالية</p></div>
        <div class="page-header-actions">
          ${window.App.hasPermission('journal', 'add') ? `
            <button class="btn btn-primary" id="add-entry-btn">${window.App.icons.plus} قيد يدوي</button>
          ` : ''}
          <button class="btn btn-ghost" id="journal-export-btn">${window.App.icons.download} Excel</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="input-group"><label>من تاريخ</label><input type="date" id="jv-from" value="${window.App.monthStartISO()}"></div>
        <div class="input-group"><label>إلى تاريخ</label><input type="date" id="jv-to" value="${window.App.todayISO()}"></div>
        <button class="btn btn-ghost" id="jv-filter-btn">${window.App.icons.search} تصفية</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" class="dashboard-grid">
        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.chart} قائمة الدخل</div></div>
          <div id="income-statement"></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">${window.App.icons.activity} التدفقات النقدية</div></div>
          <div id="cash-flow"></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">${window.App.icons.scale} قائمة المركز المالي</div></div>
        <div id="balance-sheet"></div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.book} دفتر اليومية</div></div>
        <div id="journal-entries"></div>
      </div>
    `;

    adjustAdvancedGrid();

    await Promise.all([
      loadIncomeStatement(),
      loadCashFlow(),
      loadBalanceSheet(),
      loadJournalEntries()
    ]);

    document.getElementById('add-entry-btn')?.addEventListener('click', openManualEntryModal);
    document.getElementById('jv-filter-btn')?.addEventListener('click', () => {
      loadIncomeStatement();
      loadCashFlow();
      loadJournalEntries();
    });
    document.getElementById('journal-export-btn')?.addEventListener('click', exportJournalExcel);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

function adjustAdvancedGrid() {
  if (window.innerWidth < 900) {
    document.querySelectorAll('.dashboard-grid').forEach(g => g.style.gridTemplateColumns = '1fr');
  }
}

async function loadIncomeStatement() {
  try {
    const from = document.getElementById('jv-from')?.value;
    const to = document.getElementById('jv-to')?.value;

    const salesOpts = { eq: { status: 'approved' } };
    if (from) salesOpts.gte = { created_at: from };
    if (to) salesOpts.lte = { created_at: to + 'T23:59:59' };
    const { data: sales } = await window.SB.select('sales', salesOpts);
    const revenue = sales.reduce((s, r) => s + Number(r.total), 0);

    let costOfSales = 0;
    for (const sale of sales) {
      const { data: items } = await window.SB.select('sale_items', {
        select: '*, products(cost_price)', eq: { sale_id: sale.id }
      });
      (items || []).forEach(i => {
        costOfSales += Number(i.products?.cost_price || 0) * Number(i.quantity);
      });
    }

    const grossProfit = revenue - costOfSales;

    const expOpts = { eq: { status: 'approved' } };
    if (from) expOpts.gte = { created_at: from };
    if (to) expOpts.lte = { created_at: to + 'T23:59:59' };
    const { data: expenses } = await window.SB.select('expenses', expOpts);
    const operatingExp = expenses.filter(e => e.type === 'operational').reduce((s, e) => s + Number(e.amount), 0);
    const nonOperatingExp = expenses.filter(e => e.type === 'non_operational').reduce((s, e) => s + Number(e.amount), 0);
    const totalExpenses = operatingExp + nonOperatingExp;

    const retOpts = { eq: { status: 'approved' } };
    if (from) retOpts.gte = { created_at: from };
    if (to) retOpts.lte = { created_at: to + 'T23:59:59' };
    const { data: returns } = await window.SB.select('returns', retOpts);
    const returnsTotal = returns.reduce((s, r) => s + Number(r.total), 0);

    const netRevenue = revenue - returnsTotal;
    const netProfit = netRevenue - costOfSales - totalExpenses;

    const el = document.getElementById('income-statement');
    if (!el) return;

    el.innerHTML = `
      <div style="padding:10px 0;">
        ${incomeRow('الإيرادات', revenue, 'success')}
        ${returnsTotal > 0 ? incomeRow('(-) المرتجعات', -returnsTotal, 'danger') : ''}
        ${incomeRow('(-) تكلفة المبيعات', -costOfSales, 'danger')}
        <div style="height:1px;background:var(--border);margin:8px 0;"></div>
        ${incomeRow('الربح الإجمالي', grossProfit, grossProfit >= 0 ? 'success' : 'danger', true)}
        <div style="height:12px;"></div>
        ${incomeRow('(-) مصروفات تشغيلية', -operatingExp, 'danger')}
        ${incomeRow('(-) مصروفات غير تشغيلية', -nonOperatingExp, 'danger')}
        <div style="height:1px;background:var(--border);margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;padding:12px;background:${netProfit >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'};border-radius:10px;margin-top:8px;">
          <strong style="font-size:15px;">صافي الربح</strong>
          <strong style="font-size:17px;color:${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${window.App.formatCurrency(netProfit)}</strong>
        </div>
      </div>
    `;
  } catch (err) {
    const el = document.getElementById('income-statement');
    if (el) el.innerHTML = `<p style="color:var(--danger);padding:20px;">خطأ: ${window.App.escapeHtml(err.message)}</p>`;
  }
}

function incomeRow(label, value, color, bold = false) {
  const colorMap = { success: 'var(--success)', danger: 'var(--danger)', info: 'var(--info)' };
  return `
    <div style="display:flex;justify-content:space-between;padding:8px 0;">
      <span style="color:var(--text-2);${bold ? 'font-weight:700;' : ''}">${label}</span>
      <span style="color:${colorMap[color] || 'var(--text)'};${bold ? 'font-weight:800;' : 'font-weight:600'};">${window.App.formatCurrency(value)}</span>
    </div>
  `;
}

async function loadCashFlow() {
  try {
    const from = document.getElementById('jv-from')?.value;
    const to = document.getElementById('jv-to')?.value;

    const opts = {};
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };

    const { data: sales } = await window.SB.select('sales', { ...opts, eq: { status: 'approved' } });
    const cashIn = sales.reduce((s, r) => s + Number(r.paid_cash), 0);
    const bankIn = sales.reduce((s, r) => s + Number(r.paid_bank), 0);

    const { data: expenses } = await window.SB.select('expenses', { ...opts, eq: { status: 'approved' } });
    const cashOut = expenses.filter(e => e.cashbox_type === 'cash').reduce((s, e) => s + Number(e.amount), 0);
    const bankOut = expenses.filter(e => e.cashbox_type === 'bank').reduce((s, e) => s + Number(e.amount), 0);

    const { data: custPays } = await window.SB.select('customer_payments', opts);
    const custPaysIn = (custPays || []).filter(p => p.payment_type !== 'extra_box').reduce((s, p) => s + Number(p.amount), 0);

    const { data: supPays } = await window.SB.select('supplier_payments', opts);
    const supPaysOut = (supPays || []).filter(p => p.payment_type !== 'extra_box').reduce((s, p) => s + Number(p.amount), 0);

    const { data: returns } = await window.SB.select('returns', { ...opts, eq: { status: 'approved' } });
    const returnsOut = (returns || []).filter(r => r.refund_type === 'cash' || r.refund_type === 'bank').reduce((s, r) => s + Number(r.total), 0);

    const totalIn = cashIn + bankIn + custPaysIn;
    const totalOut = cashOut + bankOut + supPaysOut + returnsOut;
    const operatingFlow = totalIn - totalOut;

    const currentCash = await window.SB.getCashBalance();
    const currentBank = await window.SB.getBankBalance();
    const currentExtra = await window.SB.getExtraBoxesBalance();
    const currentTotal = currentCash + currentBank + currentExtra;

    const closingBalance = currentTotal;
    const openingBalance = closingBalance - operatingFlow;

    const el = document.getElementById('cash-flow');
    if (!el) return;

    el.innerHTML = `
      <div style="padding:10px 0;">
        ${incomeRow('تدفقات داخلة', totalIn, 'success')}
        ${incomeRow('(-) تدفقات خارجة', -totalOut, 'danger')}
        <div style="height:1px;background:var(--border);margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;">
          <strong>صافي التدفق التشغيلي</strong>
          <strong style="color:${operatingFlow >= 0 ? 'var(--success)' : 'var(--danger)'};">${window.App.formatCurrency(operatingFlow)}</strong>
        </div>
        <div style="height:12px;"></div>
        ${incomeRow('التدفقات الاستثمارية', 0, 'info')}
        ${incomeRow('التدفقات التمويلية', 0, 'info')}
        <div style="height:1px;background:var(--border);margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;">
          <span style="color:var(--text-2);">رصيد أول الفترة</span>
          <span>${window.App.formatCurrency(openingBalance)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(59,130,246,0.12);border-radius:10px;margin-top:8px;">
          <strong>رصيد آخر الفترة</strong>
          <strong style="color:var(--accent);font-size:16px;">${window.App.formatCurrency(closingBalance)}</strong>
        </div>
      </div>
    `;
  } catch (err) {
    const el = document.getElementById('cash-flow');
    if (el) el.innerHTML = `<p style="color:var(--danger);padding:20px;">خطأ: ${window.App.escapeHtml(err.message)}</p>`;
  }
}

async function loadBalanceSheet() {
  try {
    const cash = await window.SB.getCashBalance();
    const bank = await window.SB.getBankBalance();
    const extra = await window.SB.getExtraBoxesBalance();

    const { data: customers } = await window.SB.select('customers');
    const receivables = customers.reduce((s, c) => s + Math.max(0, Number(c.balance)), 0);

    const { data: products } = await window.SB.select('products');
    const inventory = products.reduce((s, p) => s + Number(p.quantity) * Number(p.cost_price || 0), 0);

    const totalAssets = cash + bank + extra + receivables + inventory;

    const { data: suppliers } = await window.SB.select('suppliers');
    const payables = suppliers.reduce((s, sp) => s + Math.max(0, Number(sp.balance)), 0);

    const equity = totalAssets - payables;

    const el = document.getElementById('balance-sheet');
    if (!el) return;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;" class="dashboard-grid">
        <div>
          <h4 style="font-size:14px;font-weight:700;color:var(--primary-2);margin-bottom:12px;">الأصول</h4>
          ${incomeRow('النقدية (كاش)', cash, 'info')}
          ${incomeRow('النقدية (بنك)', bank, 'info')}
          ${extra > 0 ? incomeRow('خزائن أخرى', extra, 'info') : ''}
          ${incomeRow('العملاء (ذمم مدينة)', receivables, 'info')}
          ${incomeRow('المخزون', inventory, 'info')}
          <div style="height:1px;background:var(--border);margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(59,130,246,0.12);border-radius:10px;">
            <strong>إجمالي الأصول</strong>
            <strong style="color:var(--primary-2);">${window.App.formatCurrency(totalAssets)}</strong>
          </div>
        </div>
        <div>
          <h4 style="font-size:14px;font-weight:700;color:var(--warning);margin-bottom:12px;">الخصوم وحقوق الملكية</h4>
          ${incomeRow('الموردون (ذمم دائنة)', payables, 'danger')}
          <div style="height:1px;background:var(--border);margin:8px 0;"></div>
          ${incomeRow('حقوق الملكية', equity, 'success', true)}
          <div style="height:1px;background:var(--border);margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(245,158,11,0.12);border-radius:10px;">
            <strong>إجمالي الخصوم + الحقوق</strong>
            <strong style="color:var(--accent);">${window.App.formatCurrency(payables + equity)}</strong>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    const el = document.getElementById('balance-sheet');
    if (el) el.innerHTML = `<p style="color:var(--danger);padding:20px;">خطأ: ${window.App.escapeHtml(err.message)}</p>`;
  }
}

async function loadJournalEntries() {
  try {
    const listEl = document.getElementById('journal-entries');
    if (!listEl) return;
    listEl.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const from = document.getElementById('jv-from')?.value;
    const to = document.getElementById('jv-to')?.value;

    const opts = { order: { column: 'created_at', ascending: false }, limit: 100 };
    if (from) opts.gte = { date: from };
    if (to) opts.lte = { date: to };

    const { data: entries } = await window.SB.select('journal_entries', opts);

    if (!listEl) return;
    if (!entries.length) { listEl.innerHTML = window.Modules.emptyState('لا توجد قيود في هذه الفترة'); return; }

    const entriesWithLines = await Promise.all(entries.map(async (e) => {
      const { data: lines } = await window.SB.select('journal_lines', {
        select: '*, accounts(code, name)', eq: { entry_id: e.id }
      });
      const totalDebit = (lines || []).reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = (lines || []).reduce((s, l) => s + Number(l.credit), 0);
      return { ...e, lines: lines || [], totalDebit, totalCredit };
    }));

    if (!listEl) return;

    listEl.innerHTML = entriesWithLines.map(e => `
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div>
            <strong style="color:var(--accent);font-size:13.5px;">${window.App.escapeHtml(e.entry_number)}</strong>
            <span style="color:var(--text-3);font-size:11px;margin-right:8px;">${window.App.formatDate(e.date)}</span>
          </div>
          <span style="color:var(--text-2);font-size:12.5px;">${window.App.escapeHtml(e.description || '—')}</span>
        </div>
        <div class="table-wrap" style="background:transparent;border:none;">
          <table style="font-size:12.5px;">
            <thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>البيان</th></tr></thead>
            <tbody>
              ${e.lines.length === 0 ? '<tr><td colspan="4" style="text-align:center;padding:10px;color:var(--text-3);">لا توجد سطور</td></tr>' :
                e.lines.map(l => `
                  <tr>
                    <td>${window.App.escapeHtml((l.accounts?.code || '') + ' - ' + (l.accounts?.name || ''))}</td>
                    <td class="${l.debit > 0 ? 'text-success' : ''}">${l.debit > 0 ? window.App.formatCurrency(l.debit) : '—'}</td>
                    <td class="${l.credit > 0 ? 'text-danger' : ''}">${l.credit > 0 ? window.App.formatCurrency(l.credit) : '—'}</td>
                    <td style="color:var(--text-3);">${window.App.escapeHtml(l.description || '')}</td>
                  </tr>`).join('')}
              <tr style="background:rgba(59,130,246,0.08);">
                <td><strong>الإجمالي</strong></td>
                <td><strong>${window.App.formatCurrency(e.totalDebit)}</strong></td>
                <td><strong>${window.App.formatCurrency(e.totalCredit)}</strong></td>
                <td>${e.totalDebit === e.totalCredit ? '<span class="badge badge-success">متوازن</span>' : '<span class="badge badge-danger">غير متوازن</span>'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `).join('');
  } catch (err) {
    const listEl = document.getElementById('journal-entries');
    if (listEl) listEl.innerHTML = `<p style="color:var(--danger);padding:20px;">خطأ: ${window.App.escapeHtml(err.message)}</p>`;
  }
}

async function openManualEntryModal() {
  try {
    const { data: accounts } = await window.SB.select('accounts', { order: { column: 'code' } });

    const bodyHtml = `
      <div class="input-group"><label>التاريخ</label><input type="date" id="jv-date" value="${window.App.todayISO()}"></div>
      <div class="input-group"><label>البيان *</label><input type="text" id="jv-desc" placeholder="وصف القيد"></div>

      <div style="margin:16px 0;display:flex;justify-content:space-between;align-items:center;">
        <h4 style="font-size:14px;font-weight:700;">السطور</h4>
        <button class="btn btn-sm btn-outline" id="add-line-btn">${window.App.icons.plus} إضافة سطر</button>
      </div>

      <div id="jv-lines" style="display:flex;flex-direction:column;gap:8px;"></div>

      <div style="margin-top:16px;padding:12px;background:rgba(59,130,246,0.08);border-radius:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="color:var(--text-2);font-size:12px;">إجمالي المدين:</span>
          <strong id="jv-debit-total">0 ج.س</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--text-2);font-size:12px;">إجمالي الدائن:</span>
          <strong id="jv-credit-total">0 ج.س</strong>
        </div>
        <div id="jv-balance-status" style="margin-top:8px;font-size:12px;text-align:center;"></div>
      </div>
    `;

    window.App.openModal('قيد يدوي', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-primary" id="save-jv-btn">${window.App.icons.check} حفظ</button>
    `);

    const linesContainer = document.getElementById('jv-lines');
    addJournalLine(linesContainer, accounts);
    addJournalLine(linesContainer, accounts);

    document.getElementById('add-line-btn').addEventListener('click', () => addJournalLine(linesContainer, accounts));
    document.getElementById('save-jv-btn').addEventListener('click', saveManualEntry);
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

function addJournalLine(container, accounts) {
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'jv-line';
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 36px;gap:8px;align-items:end;padding:8px;background:rgba(255,255,255,0.03);border-radius:8px;';
  row.innerHTML = `
    <div class="input-group" style="margin:0;">
      <label style="font-size:11px;">الحساب</label>
      <select class="jv-account">
        <option value="">— اختر —</option>
        ${accounts.map(a => `<option value="${a.id}">${a.code} - ${window.App.escapeHtml(a.name)}</option>`).join('')}
      </select>
    </div>
    <div class="input-group" style="margin:0;">
      <label style="font-size:11px;">مدين</label>
      <input type="number" class="jv-debit" min="0" step="0.01" value="0">
    </div>
    <div class="input-group" style="margin:0;">
      <label style="font-size:11px;">دائن</label>
      <input type="number" class="jv-credit" min="0" step="0.01" value="0">
    </div>
    <button class="btn btn-sm btn-danger" style="padding:6px;" onclick="this.parentElement.remove(); recalcJournalTotals();">${window.App.icons.trash}</button>
  `;
  container.appendChild(row);

  row.querySelectorAll('.jv-debit, .jv-credit').forEach(inp => {
    inp.addEventListener('input', recalcJournalTotals);
  });
}

function recalcJournalTotals() {
  let totalDebit = 0, totalCredit = 0;
  document.querySelectorAll('.jv-line').forEach(l => {
    totalDebit += Number(l.querySelector('.jv-debit').value) || 0;
    totalCredit += Number(l.querySelector('.jv-credit').value) || 0;
  });
  const dEl = document.getElementById('jv-debit-total');
  const cEl = document.getElementById('jv-credit-total');
  if (dEl) dEl.textContent = window.App.formatCurrency(totalDebit);
  if (cEl) cEl.textContent = window.App.formatCurrency(totalCredit);

  const status = document.getElementById('jv-balance-status');
  if (status) {
    if (Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0) {
      status.innerHTML = '<span class="badge badge-success">متوازن ✓</span>';
    } else {
      status.innerHTML = `<span class="badge badge-danger">غير متوازن (فرق: ${window.App.formatCurrency(Math.abs(totalDebit - totalCredit))})</span>`;
    }
  }
}

async function saveManualEntry() {
  const btn = document.getElementById('save-jv-btn');
  if (!btn || btn.dataset.processing === 'true') return;
  const unlock = window.App.lockProcessing(btn, 'جاري الحفظ...');

  try {
    const date = document.getElementById('jv-date').value;
    const description = document.getElementById('jv-desc').value.trim();
    if (!description) throw new Error('البيان مطلوب');

    const lines = [];
    document.querySelectorAll('.jv-line').forEach(l => {
      const acc = l.querySelector('.jv-account').value;
      const debit = Number(l.querySelector('.jv-debit').value) || 0;
      const credit = Number(l.querySelector('.jv-credit').value) || 0;
      if (acc && (debit > 0 || credit > 0)) {
        lines.push({ account_id: acc, debit, credit, description });
      }
    });

    if (lines.length < 2) throw new Error('القيد يجب أن يحتوي على سطرين على الأقل');

    const { error } = await window.SB.createManualJournal({ date, description }, lines);
    if (error) throw new Error(error);

    window.App.showToast('تم حفظ القيد', 'success');
    window.App.closeModal();
    await loadJournalEntries();
  } catch (err) { window.App.showToast(err.message, 'error'); }
  finally { unlock(); }
}

async function exportJournalExcel() {
  try {
    const from = document.getElementById('jv-from').value;
    const to = document.getElementById('jv-to').value;
    const opts = { order: { column: 'date', ascending: false } };
    if (from) opts.gte = { date: from };
    if (to) opts.lte = { date: to };

    const { data: entries } = await window.SB.select('journal_entries', opts);
    const rows = [['رقم القيد', 'التاريخ', 'البيان', 'الحساب', 'مدين', 'دائن']];

    for (const e of entries) {
      const { data: lines } = await window.SB.select('journal_lines', {
        select: '*, accounts(code, name)', eq: { entry_id: e.id }
      });
      lines.forEach(l => {
        rows.push([e.entry_number, e.date, e.description || '', `${l.accounts?.code} - ${l.accounts?.name}`, l.debit, l.credit]);
      });
    }

    window.Modules.downloadCSV(rows, 'journal');
    window.App.showToast('تم التصدير', 'success');
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 9: التسويات
   ═══════════════════════════════════════════════════════════════ */

async function renderReconciliations(container) {
  try {
    if (!container) return;
    const [cash, bank] = await Promise.all([window.SB.getCashBalance(), window.SB.getBankBalance()]);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>التسويات</h2><p>تسوية الكاش والبنك</p></div>
        <div class="page-header-actions">
          ${window.App.hasPermission('reconciliations', 'add') ? `
            <button class="btn btn-primary" id="new-rec-btn">${window.App.icons.plus} تسوية جديدة</button>
          ` : ''}
        </div>
      </div>

      <div class="kpi-grid">
        ${window.Modules.kpiCard('رصيد الكاش المتوقع', window.App.formatCurrency(cash), 'wallet', 'gold')}
        ${window.Modules.kpiCard('رصيد البنك المتوقع', window.App.formatCurrency(bank), 'money', 'blue')}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">${window.App.icons.activity} سجل التسويات</div></div>
        <div id="rec-list"></div>
      </div>
    `;

    await loadReconciliationsList();
    document.getElementById('new-rec-btn')?.addEventListener('click', openReconciliationModal);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadReconciliationsList() {
  try {
    const { data } = await window.SB.select('reconciliations', { order: { column: 'created_at', ascending: false }, limit: 50 });
    const el = document.getElementById('rec-list');
    if (!el) return;

    if (!data.length) { el.innerHTML = window.Modules.emptyState('لا توجد تسويات'); return; }

    el.innerHTML = `
      <div class="table-wrap" style="background:transparent;border:none;">
        <table class="responsive">
          <thead><tr><th>النوع</th><th>المتوقع</th><th>الفعلي</th><th>الفرق</th><th>السبب</th><th>التاريخ</th></tr></thead>
          <tbody>${data.map(r => `
            <tr>
              <td data-label="النوع">${r.type === 'cash' ? 'كاش' : 'بنك'}</td>
              <td data-label="المتوقع">${window.App.formatCurrency(r.expected)}</td>
              <td data-label="الفعلي">${window.App.formatCurrency(r.actual)}</td>
              <td data-label="الفرق" class="${r.difference > 0 ? 'text-success' : r.difference < 0 ? 'text-danger' : ''}">${window.App.formatCurrency(r.difference)}</td>
              <td data-label="السبب">${window.App.escapeHtml(r.reason || '—')}</td>
              <td data-label="التاريخ">${window.App.formatDate(r.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { console.warn('rec list:', err); }
}

async function openReconciliationModal() {
  const [cash, bank] = await Promise.all([window.SB.getCashBalance(), window.SB.getBankBalance()]);

  const bodyHtml = `
    <div class="input-group"><label>النوع *</label>
      <select id="rec-type">
        <option value="cash">كاش (متوقع: ${window.App.formatCurrency(cash)})</option>
        <option value="bank">بنك (متوقع: ${window.App.formatCurrency(bank)})</option>
      </select>
    </div>
    <div class="input-group"><label>الرصيد الفعلي *</label><input type="number" id="rec-actual" step="0.01" value="0"></div>
    <div class="input-group"><label>سبب الفرق</label><textarea id="rec-reason" rows="2"></textarea></div>
    <div id="rec-diff-preview" style="padding:12px;background:rgba(59,130,246,0.08);border-radius:10px;margin-top:8px;text-align:center;">
      <span style="color:var(--text-2);font-size:12px;">الفرق المتوقع:</span>
      <strong id="rec-diff-val" style="color:var(--accent);font-size:16px;display:block;margin-top:4px;">—</strong>
    </div>
  `;

  window.App.openModal('تسوية جديدة', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-primary" id="save-rec-btn">${window.App.icons.check} اعتماد التسوية</button>
  `);

  const typeSelect = document.getElementById('rec-type');
  const actualInput = document.getElementById('rec-actual');

  const updateDiff = () => {
    const expected = typeSelect.value === 'cash' ? cash : bank;
    const actual = Number(actualInput.value) || 0;
    const diff = actual - expected;
    const el = document.getElementById('rec-diff-val');
    if (el) {
      el.textContent = window.App.formatCurrency(diff);
      el.style.color = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-2)';
    }
  };

  typeSelect.addEventListener('change', updateDiff);
  actualInput.addEventListener('input', updateDiff);
  updateDiff();

  document.getElementById('save-rec-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn);
    try {
      const type = typeSelect.value;
      const actual = Number(actualInput.value);
      const reason = document.getElementById('rec-reason').value.trim();

      const { error } = await window.SB.createReconciliation(type, actual, reason);
      if (error) throw new Error(error);

      window.App.showToast('تم اعتماد التسوية', 'success');
      window.App.closeModal();
      await renderReconciliations(document.getElementById('content'));
    } catch (err) { window.App.showToast(err.message, 'error'); }
    finally { unlock(); }
  });
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 10: التدقيق
   ═══════════════════════════════════════════════════════════════ */

async function renderAudit(container) {
  try {
    if (!container) return;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>سجل التدقيق</h2><p>كل عمليات النظام</p></div>
        <div class="page-header-actions">
          <button class="btn btn-ghost" id="audit-export-btn">${window.App.icons.download} Excel</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="input-group"><label>من تاريخ</label><input type="date" id="audit-from" value="${window.App.monthStartISO()}"></div>
        <div class="input-group"><label>إلى تاريخ</label><input type="date" id="audit-to" value="${window.App.todayISO()}"></div>
        <div class="input-group"><label>العملية</label>
          <select id="audit-action">
            <option value="">الكل</option>
            <option value="create">إضافة</option>
            <option value="update">تعديل</option>
            <option value="delete">حذف</option>
            <option value="approve">اعتماد</option>
            <option value="reject">رفض</option>
            <option value="login">دخول</option>
            <option value="logout">خروج</option>
          </select>
        </div>
        <div class="input-group"><label>الوحدة</label><input type="text" id="audit-module" placeholder="مثال: sales"></div>
        <button class="btn btn-ghost" id="audit-filter-btn">${window.App.icons.search} بحث</button>
      </div>

      <div id="audit-list"></div>
    `;

    await loadAuditList();
    document.getElementById('audit-filter-btn')?.addEventListener('click', loadAuditList);
    document.getElementById('audit-export-btn')?.addEventListener('click', exportAuditExcel);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadAuditList() {
  try {
    const listEl = document.getElementById('audit-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const from = document.getElementById('audit-from')?.value;
    const to = document.getElementById('audit-to')?.value;
    const action = document.getElementById('audit-action')?.value;
    const module = document.getElementById('audit-module')?.value.trim();

    const opts = { order: { column: 'created_at', ascending: false }, limit: 200 };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };
    if (action) opts.eq = { action };
    if (module) opts.like = { module };

    const { data } = await window.SB.select('audit_logs', opts);

    if (!listEl) return;
    if (!data.length) { listEl.innerHTML = window.Modules.emptyState('لا توجد سجلات'); return; }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="responsive">
          <thead><tr><th>المستخدم</th><th>العملية</th><th>الوحدة</th><th>التفاصيل</th><th>التاريخ والوقت</th></tr></thead>
          <tbody>${data.map(l => `
            <tr>
              <td data-label="المستخدم">${window.App.escapeHtml(l.user_email || '—')}</td>
              <td data-label="العملية">${actionBadge(l.action)}</td>
              <td data-label="الوحدة"><span class="badge badge-primary">${window.App.escapeHtml(l.module)}</span></td>
              <td data-label="التفاصيل" style="max-width:280px;word-break:break-word;font-size:11.5px;color:var(--text-3);">
                ${l.details ? window.App.escapeHtml(JSON.stringify(l.details).slice(0, 120)) : '—'}
              </td>
              <td data-label="التاريخ">${window.App.formatDateTime(l.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    const listEl = document.getElementById('audit-list');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

function actionBadge(action) {
  const map = {
    create: '<span class="badge badge-success">إضافة</span>',
    update: '<span class="badge badge-info">تعديل</span>',
    delete: '<span class="badge badge-danger">حذف</span>',
    approve: '<span class="badge badge-primary">اعتماد</span>',
    reject: '<span class="badge badge-danger">رفض</span>',
    login: '<span class="badge badge-gray">دخول</span>',
    logout: '<span class="badge badge-gray">خروج</span>'
  };
  return map[action] || `<span class="badge badge-gray">${window.App.escapeHtml(action)}</span>`;
}

async function exportAuditExcel() {
  const from = document.getElementById('audit-from').value;
  const to = document.getElementById('audit-to').value;
  const opts = { order: { column: 'created_at', ascending: false } };
  if (from) opts.gte = { created_at: from };
  if (to) opts.lte = { created_at: to + 'T23:59:59' };

  const { data } = await window.SB.select('audit_logs', opts);
  const rows = [
    ['المستخدم', 'العملية', 'الوحدة', 'معرف السجل', 'التفاصيل', 'التاريخ'],
    ...data.map(l => [l.user_email || '', l.action, l.module, l.record_id || '', l.details ? JSON.stringify(l.details) : '', window.App.formatDateTime(l.created_at)])
  ];
  window.Modules.downloadCSV(rows, 'audit-log');
  window.App.showToast('تم التصدير', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 11: الصلاحيات وإدارة المستخدمين
   ═══════════════════════════════════════════════════════════════ */

const MODULES_LIST = [
  { key: 'dashboard', name: 'لوحة التحكم' },
  { key: 'sales', name: 'المبيعات' },
  { key: 'returns', name: 'المرتجعات' },
  { key: 'customers', name: 'العملاء' },
  { key: 'suppliers', name: 'الموردين' },
  { key: 'warehouse', name: 'المخزن' },
  { key: 'treasury', name: 'الخزائن' },
  { key: 'expenses', name: 'المصروفات' },
  { key: 'journal', name: 'القيود' },
  { key: 'reconciliations', name: 'التسويات' },
  { key: 'reports', name: 'التقارير' },
  { key: 'audit', name: 'التدقيق' },
  { key: 'settings', name: 'الإعدادات' }
];

async function renderPermissions(container) {
  try {
    if (!container) return;

    const isAdmin = window.App.state.role === 'admin';

    // ═══════════════════════════════════════════════════════════
    // للمستخدم العادي: عرض صلاحياته فقط
    // ═══════════════════════════════════════════════════════════
    if (!isAdmin) {
      const perms = window.App.state.permissions || {};
      const myProfile = window.App.state.profile;

      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-info">
            <h2>صلاحياتي</h2>
            <p>عرض صلاحيات حسابك في النظام</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg,rgba(30,58,138,0.15),rgba(59,130,246,0.1));">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="width:70px;height:70px;border-radius:50%;background:var(--primary-grad);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:white;">
              ${(myProfile.full_name || 'م').charAt(0)}
            </div>
            <div style="flex:1;">
              <h3 style="font-size:18px;font-weight:800;margin-bottom:4px;">
                ${window.App.escapeHtml(myProfile.full_name)}
              </h3>
              <p style="color:var(--text-3);font-size:13px;margin-bottom:8px;">
                ${window.App.escapeHtml(myProfile.email)}
              </p>
              <span class="badge badge-primary">${roleLabel(myProfile.role)}</span>
              <span class="badge badge-success" style="margin-right:6px;">نشط</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">🛡️ صلاحيات الوصول</div>
          </div>
          
          <div class="table-wrap" style="background:transparent;border:none;">
            <table class="responsive">
              <thead>
                <tr>
                  <th>الوحدة</th>
                  <th>عرض</th>
                  <th>إضافة</th>
                  <th>تعديل</th>
                  <th>حذف</th>
                  <th>اعتماد</th>
                </tr>
              </thead>
              <tbody>
                ${MODULES_LIST.map(m => {
                  const p = perms[m.key] || {};
                  const hasAny = p.can_view || p.can_add || p.can_edit || p.can_delete || p.can_approve;
                  
                  return `
                    <tr style="${!hasAny ? 'opacity:0.4;' : ''}">
                      <td data-label="الوحدة" style="font-weight:600;">
                        ${m.name}
                        ${!hasAny ? ' <span class="badge badge-gray" style="font-size:9px;">غير مصرح</span>' : ''}
                      </td>
                      <td data-label="عرض">${permIcon(p.can_view)}</td>
                      <td data-label="إضافة">${permIcon(p.can_add)}</td>
                      <td data-label="تعديل">${permIcon(p.can_edit)}</td>
                      <td data-label="حذف">${permIcon(p.can_delete)}</td>
                      <td data-label="اعتماد">${permIcon(p.can_approve)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="margin-top:16px;background:rgba(59,130,246,0.05);border-color:rgba(59,130,246,0.2);">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="font-size:20px;">ℹ️</div>
            <div style="font-size:12.5px;color:var(--text-2);line-height:1.7;">
              لتغيير صلاحياتك، تواصل مع <strong>مدير النظام</strong>.
            </div>
          </div>
        </div>
      `;
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // للمدير: عرض كل المستخدمين
    // ═══════════════════════════════════════════════════════════
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>الصلاحيات</h2><p>إدارة المستخدمين والصلاحيات</p></div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="add-user-btn">${window.App.icons.plus} مستخدم جديد</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;border-color:rgba(16,185,129,0.3);background:rgba(16,185,129,0.05);">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="font-size:20px;">✅</div>
          <div style="font-size:12.5px;color:var(--text-2);line-height:1.7;">
            <strong style="color:var(--success);">ميزة:</strong> 
            يمكنك إنشاء المستخدمين وإدارة صلاحياتهم من هنا. 
            <br>كل مستخدم سيرى <strong>صلاحياته فقط</strong> عند فتح شاشة الصلاحيات.
          </div>
        </div>
      </div>

      <div id="users-list"></div>
    `;

    await loadUsersList();
    document.getElementById('add-user-btn')?.addEventListener('click', openAddUserModal);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

function permIcon(allowed) {
  if (allowed) {
    return '<span style="color:#10b981;font-weight:700;font-size:14px;">✓</span>';
  }
  return '<span style="color:#64748b;font-size:14px;">—</span>';
}

async function loadUsersList() {
  try {
    const el = document.getElementById('users-list');
    if (!el) return;

    const { data: users } = await window.SB.select('users', { order: { column: 'created_at', ascending: false } });

    if (!users.length) { el.innerHTML = window.Modules.emptyState('لا يوجد مستخدمون'); return; }

    el.innerHTML = users.map(u => `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:14px;">${window.App.escapeHtml(u.full_name)}</div>
            <div style="color:var(--text-3);font-size:12px;">${window.App.escapeHtml(u.email)}</div>
            <div style="margin-top:6px;">
              <span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}">${roleLabel(u.role)}</span>
              ${u.is_active === false ? '<span class="badge badge-gray">معطّل</span>' : '<span class="badge badge-success">نشط</span>'}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${u.role !== 'admin' ? `
              <button class="btn btn-sm btn-ghost" onclick="openEditPermissions('${u.id}', '${window.App.escapeHtml(u.full_name)}')">
                ${window.App.icons.shield} الصلاحيات
              </button>
            ` : '<span class="badge badge-danger">كل الصلاحيات</span>'}
            <button class="btn btn-sm btn-ghost" onclick="openEditUser('${u.id}')">${window.App.icons.edit}</button>
            ${u.id !== window.App.state.user?.id ? `
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}', '${window.App.escapeHtml(u.full_name)}')">${window.App.icons.trash}</button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) { console.warn('load users:', err); }
}

function roleLabel(role) {
  const map = { admin: 'مدير النظام', manager: 'مدير', accountant: 'محاسب', cashier: 'كاشير', viewer: 'مشاهد' };
  return map[role] || role;
}

async function openAddUserModal() {
  const bodyHtml = `
    <div class="input-group">
      <label>الاسم الكامل *</label>
      <input type="text" id="usr-name" placeholder="مثال: أحمد محمد">
    </div>
    <div class="input-group">
      <label>البريد الإلكتروني *</label>
      <input type="email" id="usr-email" placeholder="user@example.com">
    </div>
    <div class="input-group">
      <label>كلمة المرور *</label>
      <div class="password-wrap">
        <input type="password" id="usr-password" placeholder="6 أحرف على الأقل">
        <button type="button" class="toggle-password" id="usr-toggle-pwd">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="input-group">
      <label>تأكيد كلمة المرور *</label>
      <input type="password" id="usr-password2" placeholder="أعد كتابة كلمة المرور">
    </div>
    <div class="input-group">
      <label>الدور *</label>
      <select id="usr-role">
        <option value="manager">مدير</option>
        <option value="accountant">محاسب</option>
        <option value="cashier">كاشير</option>
        <option value="viewer">مشاهد</option>
        <option value="admin">مدير النظام (كل الصلاحيات)</option>
      </select>
    </div>
    <div style="padding:10px;background:rgba(16,185,129,0.08);border-radius:8px;font-size:12px;color:var(--text-2);">
      ℹ️ سيتم إنشاء المستخدم مباشرة وتفعيل الحساب تلقائياً.
    </div>
  `;

  window.App.openModal('إضافة مستخدم جديد', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-primary" id="create-user-btn">${window.App.icons.check} إنشاء المستخدم</button>
  `);

  document.getElementById('usr-toggle-pwd')?.addEventListener('click', () => {
    const inp = document.getElementById('usr-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('create-user-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn, 'جاري الإنشاء...');

    try {
      const fullName = document.getElementById('usr-name').value.trim();
      const email = document.getElementById('usr-email').value.trim();
      const password = document.getElementById('usr-password').value;
      const password2 = document.getElementById('usr-password2').value;
      const role = document.getElementById('usr-role').value;

      if (!fullName) throw new Error('الاسم مطلوب');
      if (!email) throw new Error('البريد الإلكتروني مطلوب');
      if (!email.includes('@')) throw new Error('البريد الإلكتروني غير صحيح');
      if (!password) throw new Error('كلمة المرور مطلوبة');
      if (password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      if (password !== password2) throw new Error('كلمتا المرور غير متطابقتين');

      const { data, error } = await window.SB.client.functions.invoke('create-user', {
        body: { email, password, fullName, role }
      });

      if (error) {
        let msg = error.message || 'فشل الاتصال بالسيرفر';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errBody = await error.context.json();
            if (errBody?.error) msg = errBody.error;
          }
        } catch (_) {}
        throw new Error(msg);
      }

      if (data?.error) throw new Error(data.error);

      window.App.showToast(`تم إنشاء المستخدم: ${fullName}`, 'success', 'نجاح');
      window.App.closeModal();
      await loadUsersList();
    } catch (err) {
      console.error('❌ createUser:', err);
      window.App.showToast(err.message, 'error');
    } finally {
      unlock();
    }
  });
}

async function openEditUser(userId) {
  try {
    const { data: user } = await window.SB.getById('users', userId);
    if (!user) throw new Error('المستخدم غير موجود');

    const bodyHtml = `
      <div class="input-group"><label>الاسم</label><input type="text" id="eu-name" value="${window.App.escapeHtml(user.full_name)}"></div>
      <div class="input-group"><label>الدور</label>
        <select id="eu-role">
          ${['admin', 'manager', 'accountant', 'cashier', 'viewer'].map(r =>
            `<option value="${r}" ${user.role === r ? 'selected' : ''}>${roleLabel(r)}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>الحالة</label>
        <select id="eu-active">
          <option value="true" ${user.is_active !== false ? 'selected' : ''}>نشط</option>
          <option value="false" ${user.is_active === false ? 'selected' : ''}>معطّل</option>
        </select>
      </div>
    `;

    window.App.openModal('تعديل المستخدم', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-primary" id="save-eu-btn">${window.App.icons.check} حفظ</button>
    `);

    document.getElementById('save-eu-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.processing === 'true') return;
      const unlock = window.App.lockProcessing(btn);
      try {
        const payload = {
          full_name: document.getElementById('eu-name').value.trim(),
          role: document.getElementById('eu-role').value,
          is_active: document.getElementById('eu-active').value === 'true'
        };
        const { error } = await window.SB.update('users', userId, payload);
        if (error) throw new Error(error);
        await window.SB.logAudit('update', 'users', userId, payload);
        window.App.showToast('تم الحفظ', 'success');
        window.App.closeModal();
        await loadUsersList();
      } catch (err) { window.App.showToast(err.message, 'error'); }
      finally { unlock(); }
    });
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function deleteUser(userId, userName) {
  const ok = await window.App.confirmDialog(
    `هل تريد حذف المستخدم "${userName}"؟ سيتم حذف الحساب نهائياً من Supabase (لا يمكن التراجع)`,
    { title: 'حذف نهائي', type: 'danger', okText: 'حذف نهائي' }
  );
  if (!ok) return;

  try {
    const { data, error } = await window.SB.client.functions.invoke('delete-user', {
      body: { userId }
    });

    if (error) {
      let msg = error.message || 'فشل الاتصال بالسيرفر';
      try {
        if (error.context && typeof error.context.json === 'function') {
          const errBody = await error.context.json();
          if (errBody?.error) msg = errBody.error;
        }
      } catch (_) {}
      throw new Error(msg);
    }

    if (data?.error) throw new Error(data.error);

    window.App.showToast('تم حذف المستخدم بنجاح', 'success');
    await loadUsersList();
  } catch (err) {
    console.error('❌ deleteUser:', err);
    window.App.showToast(err.message, 'error');
  }
}

async function openEditPermissions(userId, userName) {
  try {
    const { data: perms } = await window.SB.getUserPermissions(userId);
    const permsMap = {};
    (perms || []).forEach(p => { permsMap[p.module] = p; });

    const rows = MODULES_LIST.map(m => {
      const p = permsMap[m.key] || {};
      return `
        <tr>
          <td style="font-weight:600;">${m.name}</td>
          <td><input type="checkbox" class="perm-chk" data-module="${m.key}" data-action="view" ${p.can_view ? 'checked' : ''}></td>
          <td><input type="checkbox" class="perm-chk" data-module="${m.key}" data-action="add" ${p.can_add ? 'checked' : ''}></td>
          <td><input type="checkbox" class="perm-chk" data-module="${m.key}" data-action="edit" ${p.can_edit ? 'checked' : ''}></td>
          <td><input type="checkbox" class="perm-chk" data-module="${m.key}" data-action="delete" ${p.can_delete ? 'checked' : ''}></td>
          <td><input type="checkbox" class="perm-chk" data-module="${m.key}" data-action="approve" ${p.can_approve ? 'checked' : ''}></td>
        </tr>
      `;
    }).join('');

    const bodyHtml = `
      <p style="margin-bottom:12px;color:var(--text-2);font-size:13px;">المستخدم: <strong>${window.App.escapeHtml(userName)}</strong></p>
      <div style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline" onclick="toggleAllPerms(true)">تحديد الكل</button>
        <button class="btn btn-sm btn-ghost" onclick="toggleAllPerms(false)">إلغاء الكل</button>
      </div>
      <div class="table-wrap" style="background:transparent;border:none;">
        <table>
          <thead><tr><th>الوحدة</th><th>عرض</th><th>إضافة</th><th>تعديل</th><th>حذف</th><th>اعتماد</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <style>input[type=checkbox]{width:18px;height:18px;cursor:pointer;accent-color:#3b82f6;}</style>
    `;

    window.App.openModal('تعديل الصلاحيات', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="savePermissions('${userId}')">${window.App.icons.check} حفظ</button>
    `);

    window.toggleAllPerms = (checked) => {
      document.querySelectorAll('.perm-chk').forEach(chk => chk.checked = checked);
    };
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function savePermissions(userId) {
  try {
    const grouped = {};
    document.querySelectorAll('.perm-chk').forEach(chk => {
      const mod = chk.dataset.module;
      const act = chk.dataset.action;
      if (!grouped[mod]) grouped[mod] = { user_id: userId, module: mod };
      grouped[mod][`can_${act}`] = chk.checked;
    });

    await window.SB.client.from('permissions').delete().eq('user_id', userId);

    const payloads = Object.values(grouped);
    if (payloads.length) {
      const { error } = await window.SB.insertMany('permissions', payloads);
      if (error) throw new Error(error);
    }

    await window.SB.logAudit('update', 'permissions', userId, { count: payloads.length });
    window.App.showToast('تم حفظ الصلاحيات', 'success');
    window.App.closeModal();
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════
   الوحدة 12: الإعدادات
   ═══════════════════════════════════════════════════════════════ */

async function renderSettings(container) {
  try {
    if (!container) return;
    const { data: settings } = await window.SB.select('settings');
    const map = {};
    (settings || []).forEach(s => { map[s.key] = s.value; });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info"><h2>الإعدادات</h2><p>إعدادات النظام العامة</p></div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">${window.App.icons.settings} الإعدادات العامة</div></div>
        <div class="input-group"><label>اسم الشركة</label><input type="text" id="set-company" value="${window.App.escapeHtml(map.company_name || '')}"></div>
        <div class="input-group"><label>اسم القسم</label><input type="text" id="set-department" value="${window.App.escapeHtml(map.department_name || '')}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="input-group"><label>العملة</label><input type="text" id="set-currency" value="${window.App.escapeHtml(map.currency || 'SDG')}"></div>
          <div class="input-group"><label>رمز العملة</label><input type="text" id="set-symbol" value="${window.App.escapeHtml(map.currency_symbol || 'ج.س')}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="input-group"><label>الرصيد الافتتاحي للكاش</label><input type="number" id="set-cash-open" value="${map.default_cash_balance || 0}" step="0.01"></div>
          <div class="input-group"><label>الرصيد الافتتاحي للبنك</label><input type="number" id="set-bank-open" value="${map.default_bank_balance || 0}" step="0.01"></div>
        </div>
        <button class="btn btn-primary" id="save-settings-btn">${window.App.icons.check} حفظ الإعدادات</button>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">${window.App.icons.box} المخازن الخارجية (الجهات)</div></div>
        <div id="external-list" style="margin-bottom:12px;"></div>
        <button class="btn btn-ghost" id="add-external-btn">${window.App.icons.plus} إضافة جهة جديدة</button>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">${window.App.icons.wallet} الخزائن الإضافية</div></div>
        <div id="cashboxes-list" style="margin-bottom:12px;"></div>
      </div>

      <div class="card backup-section" style="margin-bottom:20px;">
        <div class="card-header">
          <div class="card-title">💾 النسخ الاحتياطي والاستعادة</div>
        </div>
        
        <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">
          احفظ نسخة كاملة من بياناتك أو استعدها عند الحاجة. تُنصح بعمل نسخة احتياطية أسبوعياً على الأقل.
        </p>

        <div class="backup-grid">
          <div class="backup-card" id="backup-download-btn">
            <div class="backup-icon cyan">📥</div>
            <div class="backup-title">تنزيل نسخة احتياطية</div>
            <div class="backup-desc">ملف JSON يحتوي كل البيانات</div>
          </div>

          <div class="backup-card" id="backup-import-btn">
            <div class="backup-icon green">📤</div>
            <div class="backup-title">استيراد نسخة احتياطية</div>
            <div class="backup-desc">استعد البيانات من ملف JSON</div>
          </div>

          <div class="backup-card" id="backup-excel-btn">
            <div class="backup-icon gold">📊</div>
            <div class="backup-title">تصدير Excel شامل</div>
            <div class="backup-desc">كل الجداول في ملف واحد</div>
          </div>
        </div>

        <div class="backup-progress" id="backup-progress">
          <div class="backup-progress-text">
            <span id="backup-progress-label">جاري المعالجة...</span>
            <span id="backup-progress-percent">0%</span>
          </div>
          <div class="backup-progress-bar">
            <div class="backup-progress-fill" id="backup-progress-fill"></div>
          </div>
        </div>
      </div>

      <div class="card" style="border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.05);">
        <div class="card-header"><div class="card-title" style="color:var(--danger);">${window.App.icons.alert} منطقة الخطر</div></div>
        <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">
          حذف جميع البيانات نهائياً (لا يمكن التراجع): المبيعات، العملاء، الموردين، المخزن، الخزائن، المصروفات، القيود، التسويات، السجلات.
        </p>
        <button class="btn btn-danger" id="delete-all-btn">${window.App.icons.trash} حذف جميع البيانات نهائياً</button>
      </div>
    `;

    await Promise.all([loadExternalLocations(), loadExtraCashboxes()]);

    document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
    document.getElementById('add-external-btn')?.addEventListener('click', openAddExternalModal);
    document.getElementById('delete-all-btn')?.addEventListener('click', handleDeleteAllData);
    document.getElementById('backup-download-btn')?.addEventListener('click', downloadBackup);
    document.getElementById('backup-import-btn')?.addEventListener('click', openImportModal);
    document.getElementById('backup-excel-btn')?.addEventListener('click', exportAllToExcel);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

async function loadExternalLocations() {
  try {
    const { data } = await window.SB.select('external_locations', { order: { column: 'name' } });
    const el = document.getElementById('external-list');
    if (!el) return;
    if (!data.length) { el.innerHTML = '<p style="color:var(--text-3);font-size:13px;">لا توجد جهات</p>'; return; }
    el.innerHTML = `
      <div class="table-wrap" style="background:transparent;border:none;">
        <table>
          <thead><tr><th>الاسم</th><th>النوع</th><th>الحالة</th><th></th></tr></thead>
          <tbody>${data.map(e => `
            <tr>
              <td>${window.App.escapeHtml(e.name)}</td>
              <td>${e.type === 'customer' ? 'عميل' : e.type === 'supplier' ? 'مورد' : e.type === 'warehouse' ? 'مخزن' : 'أخرى'}</td>
              <td>${e.is_active ? '<span class="badge badge-success">نشط</span>' : '<span class="badge badge-gray">معطّل</span>'}</td>
              <td><button class="btn btn-sm btn-danger" onclick="deleteExternalLocation('${e.id}')">${window.App.icons.trash}</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { console.warn('ext locations:', err); }
}

async function loadExtraCashboxes() {
  try {
    const { data } = await window.SB.select('extra_cashboxes', { order: { column: 'name' } });
    const el = document.getElementById('cashboxes-list');
    if (!el) return;
    if (!data.length) { el.innerHTML = '<p style="color:var(--text-3);font-size:13px;">لا توجد خزائن إضافية</p>'; return; }
    el.innerHTML = `
      <div class="table-wrap" style="background:transparent;border:none;">
        <table>
          <thead><tr><th>الاسم</th><th>النوع</th><th>الرصيد</th><th></th></tr></thead>
          <tbody>${data.map(b => `
            <tr>
              <td>${window.App.escapeHtml(b.name)}</td>
              <td>${b.type === 'cash' ? 'كاش' : b.type === 'bank' ? 'بنك' : 'أخرى'}</td>
              <td>${window.App.formatCurrency(b.balance)}</td>
              <td><button class="btn btn-sm btn-danger" onclick="deleteExtraBox('${b.id}')">${window.App.icons.trash}</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { console.warn('extra cashboxes:', err); }
}

async function openAddExternalModal() {
  const bodyHtml = `
    <div class="input-group"><label>الاسم *</label><input type="text" id="ext-name" placeholder="مثال: عميل أحمد"></div>
    <div class="input-group"><label>النوع</label>
      <select id="ext-type">
        <option value="customer">عميل</option>
        <option value="supplier">مورد</option>
        <option value="warehouse">مخزن</option>
        <option value="other">أخرى</option>
      </select>
    </div>
    <div class="input-group"><label>ملاحظات</label><textarea id="ext-notes" rows="2"></textarea></div>
  `;

  window.App.openModal('إضافة جهة خارجية', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-primary" id="save-ext-btn">${window.App.icons.check} حفظ</button>
  `);

  document.getElementById('save-ext-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn);
    try {
      const payload = {
        name: document.getElementById('ext-name').value.trim(),
        type: document.getElementById('ext-type').value,
        notes: document.getElementById('ext-notes').value.trim(),
        is_active: true
      };
      if (!payload.name) throw new Error('الاسم مطلوب');
      const { error } = await window.SB.insert('external_locations', payload);
      if (error) throw new Error(error);
      window.App.showToast('تم الحفظ', 'success');
      window.App.closeModal();
      await loadExternalLocations();
    } catch (err) { window.App.showToast(err.message, 'error'); }
    finally { unlock(); }
  });
}

async function deleteExternalLocation(id) {
  const ok = await window.App.confirmDialog('حذف الجهة؟', { type: 'danger', okText: 'حذف' });
  if (!ok) return;
  const { error } = await window.SB.delete('external_locations', id);
  if (error) return window.App.showToast(error, 'error');
  await loadExternalLocations();
  window.App.showToast('تم الحذف', 'success');
}

async function deleteExtraBox(id) {
  const ok = await window.App.confirmDialog('حذف الخزنة؟ سيتم حذف كل حركاتها', { type: 'danger', okText: 'حذف' });
  if (!ok) return;
  const { error } = await window.SB.delete('extra_cashboxes', id);
  if (error) return window.App.showToast(error, 'error');
  await loadExtraCashboxes();
  window.App.showToast('تم الحذف', 'success');
}

async function saveSettings() {
  try {
    const updates = [
      { key: 'company_name', value: document.getElementById('set-company').value.trim() },
      { key: 'department_name', value: document.getElementById('set-department').value.trim() },
      { key: 'currency', value: document.getElementById('set-currency').value.trim() },
      { key: 'currency_symbol', value: document.getElementById('set-symbol').value.trim() },
      { key: 'default_cash_balance', value: document.getElementById('set-cash-open').value },
      { key: 'default_bank_balance', value: document.getElementById('set-bank-open').value }
    ];

    for (const u of updates) {
      await window.SB.client.from('settings').upsert(
        { key: u.key, value: u.value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    }

    await window.SB.logAudit('update', 'settings', null, updates);
    window.App.showToast('تم حفظ الإعدادات', 'success');
  } catch (err) { window.App.showToast(err.message, 'error'); }
}

async function handleDeleteAllData() {
  const step1 = await window.App.confirmDialog(
    '⚠️ تحذير: سيتم حذف جميع البيانات نهائياً. هل أنت متأكد؟',
    { title: 'تأكيد أول', type: 'danger', okText: 'نعم، متأكد', cancelText: 'إلغاء' }
  );
  if (!step1) return;

  openDeleteConfirmModal();
}

function openDeleteConfirmModal() {
  const bodyHtml = `
    <div style="text-align:center;padding:12px 0;">
      <div style="font-size:44px;margin-bottom:12px;">🗑️</div>
      <p style="color:var(--danger);font-weight:700;font-size:15px;margin-bottom:8px;">تأكيد نهائي</p>
      <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">
        لتأكيد الحذف النهائي، اكتب العبارة التالية بالضبط:
      </p>
      <div style="display:inline-block;padding:8px 16px;background:rgba(239,68,68,0.15);border:1px dashed var(--danger);border-radius:8px;color:var(--danger);font-weight:800;margin-bottom:16px;font-family:monospace;">
        حذف نهائي
      </div>
      <div class="input-group"><input type="text" id="delete-confirm-input" placeholder="اكتب هنا..." autocomplete="off"></div>
      <p id="delete-status" style="font-size:12.5px;color:var(--text-3);"></p>
    </div>
  `;

  window.App.openModal('تأكيد الحذف النهائي', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-danger" id="do-delete-btn" disabled>${window.App.icons.trash} حذف نهائي</button>
  `);

  const input = document.getElementById('delete-confirm-input');
  const btn = document.getElementById('do-delete-btn');
  const status = document.getElementById('delete-status');

  input.addEventListener('input', () => {
    const ok = input.value.trim() === 'حذف نهائي';
    btn.disabled = !ok;
    status.textContent = ok ? '✓ جاهز للحذف' : '';
    status.style.color = ok ? 'var(--success)' : 'var(--text-3)';
  });

  btn.addEventListener('click', async () => {
    if (input.value.trim() !== 'حذف نهائي') return;
    btn.disabled = true;
    btn.innerHTML = 'جاري الحذف...';

    try {
      const result = await window.SB.deleteAllData();
      console.log('نتيجة الحذف:', result);
      if (result.failed && result.failed.length > 0) console.warn('جداول فشلت:', result.failed);

      await window.SB.logAudit('delete', 'system', null, { action: 'deleteAllData' });
      window.App.showToast('تم حذف جميع البيانات بنجاح', 'success', 'حذف نهائي');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      window.App.showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `${window.App.icons.trash} حذف نهائي`;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   النسخ الاحتياطي والاستعادة
   ═══════════════════════════════════════════════════════════════ */

const BACKUP_TABLES = [
  'products', 'warehouse_transactions', 'stock_out_log',
  'customers', 'suppliers',
  'sales', 'sale_items', 'sale_payments',
  'purchases', 'purchase_items',
  'returns', 'return_items',
  'expenses',
  'cash_transactions', 'bank_transactions', 'transfers',
  'extra_cashboxes', 'extra_cashbox_transactions',
  'customer_payments', 'supplier_payments',
  'accounts', 'journal_entries', 'journal_lines',
  'reconciliations',
  'external_locations',
  'audit_logs',
  'settings'
];

function updateBackupProgress(percent, label) {
  const progress = document.getElementById('backup-progress');
  const fill = document.getElementById('backup-progress-fill');
  const percentEl = document.getElementById('backup-progress-percent');
  const labelEl = document.getElementById('backup-progress-label');

  if (progress) progress.classList.add('active');
  if (fill) fill.style.width = percent + '%';
  if (percentEl) percentEl.textContent = Math.round(percent) + '%';
  if (labelEl && label) labelEl.textContent = label;
}

function hideBackupProgress() {
  setTimeout(() => {
    const progress = document.getElementById('backup-progress');
    if (progress) progress.classList.remove('active');
    const fill = document.getElementById('backup-progress-fill');
    if (fill) fill.style.width = '0%';
  }, 800);
}

async function downloadBackup() {
  const confirmed = await window.App.confirmDialog(
    'سيتم تنزيل نسخة كاملة من جميع البيانات. هل تريد المتابعة؟',
    { title: 'نسخة احتياطية', type: 'info', okText: 'تنزيل' }
  );
  if (!confirmed) return;

  try {
    updateBackupProgress(0, 'جاري التحضير...');

    const backup = {
      version: '2.0',
      export_date: new Date().toISOString(),
      export_date_local: new Date().toLocaleString('ar-SD'),
      company: 'مصنع الصندل للأوعية البلاستيكية',
      tables: {},
      counts: {},
      total_records: 0
    };

    let totalRecords = 0;
    const totalTables = BACKUP_TABLES.length;

    for (let i = 0; i < BACKUP_TABLES.length; i++) {
      const table = BACKUP_TABLES[i];
      const percent = (i / totalTables) * 100;
      updateBackupProgress(percent, `جاري قراءة: ${table}`);

      try {
        const { data, error } = await window.SB.select(table, {});
        if (error) {
          backup.tables[table] = [];
          backup.counts[table] = 0;
        } else {
          backup.tables[table] = data || [];
          backup.counts[table] = (data || []).length;
          totalRecords += (data || []).length;
        }
      } catch (err) {
        backup.tables[table] = [];
        backup.counts[table] = 0;
      }
    }

    backup.total_records = totalRecords;
    updateBackupProgress(95, 'جاري التجهيز...');

    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

    const now = new Date();
    const filename = `backup-sandal-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    updateBackupProgress(100, '✅ تم بنجاح');
    hideBackupProgress();

    await window.SB.logAudit('create', 'backup', null, {
      file: filename,
      records: totalRecords,
      size_kb: Math.round(blob.size / 1024)
    });

    window.App.showToast(
      `تم تنزيل ${totalRecords.toLocaleString('ar-SD')} سجل من ${totalTables} جدول`,
      'success',
      'نسخة احتياطية'
    );
  } catch (err) {
    console.error('❌ downloadBackup:', err);
    window.App.showToast('فشل النسخ الاحتياطي: ' + err.message, 'error');
    hideBackupProgress();
  }
}

function openImportModal() {
  const bodyHtml = `
    <div class="input-group">
      <div class="import-dropzone" id="import-dropzone">
        <div class="import-dropzone-icon">📁</div>
        <p style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">
          اسحب ملف النسخة الاحتياطية هنا
        </p>
        <p style="font-size:12px;color:var(--text-3);margin:0;">
          أو اضغط لاختيار ملف (.json)
        </p>
        <input type="file" id="import-file-input" accept=".json" style="display:none;">
      </div>
    </div>

    <div id="import-file-info" style="display:none;padding:14px;background:rgba(16,185,129,0.08);border-radius:12px;margin-top:12px;">
      <div style="font-size:13px;color:var(--text);">
        <div><strong>الملف:</strong> <span id="import-file-name">—</span></div>
        <div style="margin-top:4px;"><strong>الحجم:</strong> <span id="import-file-size">—</span></div>
        <div style="margin-top:4px;"><strong>عدد السجلات:</strong> <span id="import-file-records">—</span></div>
        <div style="margin-top:4px;"><strong>تاريخ النسخة:</strong> <span id="import-file-date">—</span></div>
      </div>
    </div>

    <div id="import-summary" style="display:none;margin-top:16px;padding:14px;background:rgba(59,130,246,0.08);border-radius:12px;">
      <h4 style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--primary-2);">📊 ملخص المحتوى</h4>
      <div id="import-tables-list" style="max-height:250px;overflow-y:auto;font-size:12.5px;"></div>
    </div>

    <div style="margin-top:16px;padding:12px;background:rgba(239,68,68,0.08);border-radius:10px;font-size:12px;color:var(--text-2);">
      ⚠️ <strong>تحذير:</strong> الاستيراد <strong>سيحذف كل البيانات الحالية</strong> ويستبدلها بالبيانات من الملف.
    </div>
  `;

  window.App.openModal('استيراد نسخة احتياطية', bodyHtml, `
    <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
    <button class="btn btn-primary" id="do-import-btn" disabled>${window.App.icons.upload} استيراد البيانات</button>
  `);

  let backupData = null;
  const dropzone = document.getElementById('import-dropzone');
  const fileInput = document.getElementById('import-file-input');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
  });

  async function handleImportFile(file) {
    if (!file.name.endsWith('.json')) {
      window.App.showToast('يجب اختيار ملف JSON', 'error');
      return;
    }

    try {
      const text = await file.text();
      backupData = JSON.parse(text);

      if (!backupData.tables || typeof backupData.tables !== 'object') {
        throw new Error('الملف غير صالح - لا يحتوي على جداول');
      }

      document.getElementById('import-file-info').style.display = 'block';
      document.getElementById('import-file-name').textContent = file.name;
      document.getElementById('import-file-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
      document.getElementById('import-file-records').textContent = (backupData.total_records || 0).toLocaleString('ar-SD');
      document.getElementById('import-file-date').textContent = backupData.export_date_local || backupData.export_date || '—';

      const tablesList = document.getElementById('import-tables-list');
      const counts = backupData.counts || {};
      const sortedTables = Object.entries(counts).sort((a, b) => b[1] - a[1]);

      tablesList.innerHTML = sortedTables.map(([table, count]) => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--text-2);">${table}</span>
          <strong style="color:${count > 0 ? 'var(--success)' : 'var(--text-3)'};">${count.toLocaleString('ar-SD')}</strong>
        </div>
      `).join('');

      document.getElementById('import-summary').style.display = 'block';
      document.getElementById('do-import-btn').disabled = false;

      window.App.showToast('الملف صالح ✓', 'success');
    } catch (err) {
      console.error('❌ handleImportFile:', err);
      window.App.showToast('فشل قراءة الملف: ' + err.message, 'error');
      backupData = null;
      document.getElementById('do-import-btn').disabled = true;
    }
  }

  document.getElementById('do-import-btn').addEventListener('click', async (e) => {
    if (!backupData) {
      window.App.showToast('الرجاء اختيار ملف أولاً', 'warning');
      return;
    }

    const btn = e.currentTarget;
    if (btn.dataset.processing === 'true') return;
    const unlock = window.App.lockProcessing(btn, 'جاري الاستيراد...');

    try {
      const confirmed = await window.App.confirmDialog(
        `سيتم حذف كل البيانات الحالية واستبدالها بـ ${(backupData.total_records || 0).toLocaleString('ar-SD')} سجل.\n\nهل أنت متأكد؟`,
        { title: 'تأكيد الاستيراد', type: 'danger', okText: 'استيراد' }
      );

      if (!confirmed) { unlock(); return; }
      window.App.closeModal();

      const progressCard = document.querySelector('.backup-progress');
      if (progressCard) progressCard.classList.add('active');

      const totalTables = BACKUP_TABLES.length;
      let restoredRecords = 0;

      // حذف البيانات الحالية
      const reversedTables = [...BACKUP_TABLES].reverse();
      for (const table of reversedTables) {
        try {
          await window.SB.client
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        } catch (err) {
          console.warn(`⚠️ حذف ${table}:`, err.message);
        }
      }

      // استيراد البيانات
      for (let i = 0; i < BACKUP_TABLES.length; i++) {
        const table = BACKUP_TABLES[i];
        const percent = (i / totalTables) * 100;
        updateBackupProgress(percent, `جاري استعادة: ${table}`);

        const rows = backupData.tables[table] || [];
        if (rows.length === 0) continue;

        try {
          const batchSize = 100;
          for (let j = 0; j < rows.length; j += batchSize) {
            const batch = rows.slice(j, j + batchSize);
            const { error } = await window.SB.insertMany(table, batch);
            if (!error) restoredRecords += batch.length;
          }
        } catch (err) {
          console.warn(`⚠️ استيراد ${table}:`, err);
        }
      }

      updateBackupProgress(100, '✅ تم بنجاح');
      hideBackupProgress();

      await window.SB.logAudit('create', 'restore', null, {
        restored_records: restoredRecords,
        tables_count: totalTables
      });

      window.App.showToast(
        `تم استعادة ${restoredRecords.toLocaleString('ar-SD')} سجل بنجاح`,
        'success',
        'الاستيراد'
      );

      setTimeout(() => location.reload(), 2000);
    } catch (err) {
      console.error('❌ import error:', err);
      window.App.showToast('فشل الاستيراد: ' + err.message, 'error');
      unlock();
    }
  });
}

async function exportAllToExcel() {
  try {
    updateBackupProgress(0, 'جاري التحضير...');

    const allData = {};
    const totalTables = BACKUP_TABLES.length;

    for (let i = 0; i < BACKUP_TABLES.length; i++) {
      const table = BACKUP_TABLES[i];
      updateBackupProgress((i / totalTables) * 90, `جاري قراءة: ${table}`);

      try {
        const { data } = await window.SB.select(table, {});
        allData[table] = data || [];
      } catch {
        allData[table] = [];
      }
    }

    updateBackupProgress(95, 'جاري إنشاء الملف...');

    const rows = [];
    const now = new Date();
    const dateStr = now.toLocaleString('ar-SD');

    rows.push(['مصنع الصندل للأوعية البلاستيكية - قسم الحبل']);
    rows.push(['تقرير شامل - ' + dateStr]);
    rows.push([]);

    for (const table of BACKUP_TABLES) {
      const data = allData[table] || [];
      if (data.length === 0) continue;

      rows.push([]);
      rows.push([`◆ ${getTableNameAr(table)} (${data.length} سجل)`]);

      const columns = Object.keys(data[0]);
      rows.push(columns);

      data.forEach(row => {
        rows.push(columns.map(col => {
          let val = row[col];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return val;
        }));
      });
    }

    updateBackupProgress(100, '✅ تم');

    const csv = rows.map(r => r.map(c => {
      const v = c === null || c === undefined ? '' : String(c);
      return `"${v.replace(/"/g, '""')}"`;
    }).join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full-export-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    hideBackupProgress();

    await window.SB.logAudit('create', 'export_excel', null, {
      tables: BACKUP_TABLES.length,
      date: dateStr
    });

    window.App.showToast('تم تصدير كل البيانات بنجاح', 'success');
  } catch (err) {
    console.error('❌ exportAllToExcel:', err);
    window.App.showToast('فشل التصدير: ' + err.message, 'error');
    hideBackupProgress();
  }
}

function getTableNameAr(table) {
  const names = {
    products: 'المنتجات',
    warehouse_transactions: 'حركات المخزن',
    stock_out_log: 'سجل الإخراج',
    customers: 'العملاء',
    suppliers: 'الموردين',
    sales: 'المبيعات',
    sale_items: 'بنود المبيعات',
    sale_payments: 'دفعات المبيعات',
    purchases: 'المشتريات',
    purchase_items: 'بنود المشتريات',
    returns: 'المرتجعات',
    return_items: 'بنود المرتجعات',
    expenses: 'المصروفات',
    cash_transactions: 'حركات الكاش',
    bank_transactions: 'حركات البنك',
    transfers: 'التحويلات',
    extra_cashboxes: 'الخزائن الإضافية',
    extra_cashbox_transactions: 'حركات الخزائن الإضافية',
    customer_payments: 'سدادات العملاء',
    supplier_payments: 'سدادات الموردين',
    accounts: 'دليل الحسابات',
    journal_entries: 'القيود',
    journal_lines: 'سطور القيود',
    reconciliations: 'التسويات',
    external_locations: 'المخازن الخارجية',
    audit_logs: 'سجل التدقيق',
    settings: 'الإعدادات'
  };
  return names[table] || table;
}

/* ═══════════════════════════════════════════════════════════════
   التصدير العام
   ═══════════════════════════════════════════════════════════════ */

window.Advanced = {
  renderJournal,
  renderReconciliations,
  renderAudit,
  renderPermissions,
  renderSettings,
  actionBadge,
  openEditPermissions,
  savePermissions,
  openEditUser,
  openAddUserModal,
  deleteUser,
  permIcon,
  downloadBackup,
  openImportModal,
  exportAllToExcel
};

console.log('✅ advanced.js جاهز (محدّث + صلاحيات شخصية + موافقة مزدوجة)');
