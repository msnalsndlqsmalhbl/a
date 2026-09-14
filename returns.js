/* ═══════════════════════════════════════════════════════════════
   نظام إدارة قسم الحبل - مصنع الصندل
   returns.js - إدارة المرتجعات (المبيعات)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   شاشة المرتجعات الرئيسية
   ═══════════════════════════════════════════════════════════════ */

async function renderReturns(container) {
  try {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>المرتجعات</h2>
          <p>إدارة مرتجعات المبيعات</p>
        </div>
        <div class="page-header-actions">
          ${window.App.hasPermission('returns', 'add') ? `
            <button class="btn btn-primary" id="new-return-btn">
              ${window.App.icons.plus} مرتجع جديد
            </button>
          ` : ''}
          <button class="btn btn-ghost" id="returns-export-btn">
            ${window.App.icons.download} Excel
          </button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="input-group">
          <label>من تاريخ</label>
          <input type="date" id="ret-from" value="${window.App.monthStartISO()}">
        </div>
        <div class="input-group">
          <label>إلى تاريخ</label>
          <input type="date" id="ret-to" value="${window.App.todayISO()}">
        </div>
        <div class="input-group">
          <label>الحالة</label>
          <select id="ret-status">
            <option value="">الكل</option>
            <option value="pending">معلّقة</option>
            <option value="approved">معتمدة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </div>
        <button class="btn btn-ghost" id="returns-filter-btn">${window.App.icons.search} تصفية</button>
      </div>

      <div id="returns-kpis" class="kpi-grid"></div>
      <div id="returns-list"></div>
    `;

    await loadReturnsList();

    document.getElementById('new-return-btn')?.addEventListener('click', () => openNewReturnModal());
    document.getElementById('returns-filter-btn')?.addEventListener('click', loadReturnsList);
    document.getElementById('returns-export-btn')?.addEventListener('click', exportReturnsExcel);
  } catch (err) {
    console.error('❌ renderReturns:', err);
    container.innerHTML = `<div class="empty-state"><h3>خطأ</h3><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

/* ─────────── قائمة المرتجعات ─────────── */
async function loadReturnsList() {
  try {
    const listEl = document.getElementById('returns-list');
    listEl.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

    const from = document.getElementById('ret-from').value;
    const to = document.getElementById('ret-to').value;
    const status = document.getElementById('ret-status').value;

    const opts = {
      select: '*, customers(name), sales(invoice_number)',
      order: { column: 'created_at', ascending: false }
    };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };
    if (status) opts.eq = { status };

    const { data } = await window.SB.select('returns', opts);

    // KPI
    const totalAmount = data.reduce((s, r) => s + Number(r.total), 0);
    const approvedAmount = data.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.total), 0);

    document.getElementById('returns-kpis').innerHTML = `
      ${window.Modules.kpiCard('إجمالي المرتجعات', window.App.formatCurrency(totalAmount), 'rotate', 'gold')}
      ${window.Modules.kpiCard('المرتجعات المعتمدة', window.App.formatCurrency(approvedAmount), 'check', 'green')}
      ${window.Modules.kpiCard('عدد المرتجعات', window.App.formatNumber(data.length), 'activity', 'blue')}
    `;

    if (!data.length) {
      listEl.innerHTML = window.Modules.emptyState('لا توجد مرتجعات في هذه الفترة');
      return;
    }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="responsive">
          <thead>
            <tr>
              <th>رقم المرتجع</th>
              <th>الفاتورة</th>
              <th>العميل</th>
              <th>المبلغ</th>
              <th>طريقة الاسترداد</th>
              <th>السبب</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(r => `
              <tr>
                <td data-label="رقم المرتجع"><strong>${window.App.escapeHtml(r.return_number || '—')}</strong></td>
                <td data-label="الفاتورة">${window.App.escapeHtml(r.sales?.invoice_number || '—')}</td>
                <td data-label="العميل">${window.App.escapeHtml(r.customers?.name || '—')}</td>
                <td data-label="المبلغ">${window.App.formatCurrency(r.total)}</td>
                <td data-label="طريقة الاسترداد">${refundTypeBadge(r.refund_type)}</td>
                <td data-label="السبب">${window.App.escapeHtml((r.reason || '—').slice(0, 40))}</td>
                <td data-label="الحالة">${window.Modules.statusBadge(r.status)}</td>
                <td data-label="التاريخ">${window.App.formatDate(r.created_at)}</td>
                <td data-label="إجراءات">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-ghost" onclick="viewReturnDetails('${r.id}')" title="عرض">${window.App.icons.edit}</button>
                    ${r.status === 'pending' && window.App.hasPermission('returns', 'approve') ? `
                      <button class="btn btn-sm btn-success" onclick="approveReturnConfirm('${r.id}')" title="اعتماد">${window.App.icons.check}</button>
                    ` : ''}
                    ${r.status === 'pending' && window.App.hasPermission('returns', 'delete') ? `
                      <button class="btn btn-sm btn-danger" onclick="deleteReturnConfirm('${r.id}')" title="حذف">${window.App.icons.trash}</button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    document.getElementById('returns-list').innerHTML = `<div class="empty-state"><p>${window.App.escapeHtml(err.message)}</p></div>`;
  }
}

function refundTypeBadge(type) {
  const map = {
    'cash': '<span class="badge badge-success">كاش</span>',
    'bank': '<span class="badge badge-info">بنك</span>',
    'customer_credit': '<span class="badge badge-warning">رصيد للعميل</span>',
    'none': '<span class="badge badge-gray">بدون استرداد</span>'
  };
  return map[type] || '<span class="badge badge-gray">—</span>';
}

/* ═══════════════════════════════════════════════════════════════
   Modal مرتجع جديد
   ═══════════════════════════════════════════════════════════════ */

async function openNewReturnModal() {
  try {
    if (!window.App.hasPermission('returns', 'add')) {
      window.App.showToast('ليس لديك صلاحية إضافة مرتجعات', 'error');
      return;
    }

    // جلب الفواتير المعتمدة فقط
    const { data: sales } = await window.SB.select('sales', {
      select: 'id, invoice_number, total, customer_id, customers(name), created_at',
      eq: { status: 'approved' },
      order: { column: 'created_at', ascending: false },
      limit: 200
    });

    if (!sales.length) {
      window.App.showToast('لا توجد فواتير معتمدة لعمل مرتجع منها', 'warning');
      return;
    }

    const bodyHtml = `
      <div id="return-form">
        <div class="input-group">
          <label>الفاتورة الأصلية *</label>
          <select id="ret-sale">
            <option value="">— اختر الفاتورة —</option>
            ${sales.map(s => `
              <option value="${s.id}" data-customer="${s.customer_id || ''}" data-customer-name="${window.App.escapeHtml(s.customers?.name || 'عميل نقدي')}">
                ${window.App.escapeHtml(s.invoice_number)} - ${window.App.escapeHtml(s.customers?.name || 'عميل نقدي')} - ${window.App.formatCurrency(s.total)}
              </option>
            `).join('')}
          </select>
        </div>

        <div id="sale-info" style="padding:12px;background:rgba(59,130,246,0.08);border-radius:10px;margin-bottom:12px;display:none;">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;">
            <span>العميل:</span>
            <strong id="ret-cust-name">—</strong>
          </div>
        </div>

        <div style="margin:16px 0;display:flex;justify-content:space-between;align-items:center;">
          <h4 style="font-size:14px;font-weight:700;">المنتجات المرتجعة</h4>
          <button class="btn btn-sm btn-outline" id="ret-add-item-btn" disabled>${window.App.icons.plus} إضافة منتج</button>
        </div>

        <div id="ret-items" style="display:flex;flex-direction:column;gap:10px;">
          <p style="text-align:center;color:var(--text-3);font-size:13px;padding:20px;">اختر الفاتورة أولاً</p>
        </div>

        <div style="margin-top:16px;padding:16px;background:rgba(245,158,11,0.08);border-radius:12px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="font-weight:700;">إجمالي المرتجع:</span>
            <strong id="ret-total" style="font-size:18px;color:var(--accent);">0 ج.س</strong>
          </div>
        </div>

        <div class="input-group" style="margin-top:16px;">
          <label>طريقة الاسترداد *</label>
          <select id="ret-refund-type">
            <option value="cash">كاش (من خزنة الكاش)</option>
            <option value="bank">بنك (من خزنة البنك)</option>
            <option value="customer_credit">رصيد للعميل (خصم من الدين)</option>
            <option value="none">بدون استرداد (استبدال فقط)</option>
          </select>
        </div>

        <div class="input-group">
          <label>سبب الإرجاع *</label>
          <textarea id="ret-reason" rows="2" placeholder="مثال: عيب صناعة، عميل غير راضٍ..."></textarea>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-ghost" onclick="window.App.closeModal()">إلغاء</button>
      <button class="btn btn-primary" id="save-ret-btn">${window.App.icons.check} حفظ المرتجع</button>
    `;

    window.App.openModal('مرتجع جديد', bodyHtml, footerHtml);

    const saleSelect = document.getElementById('ret-sale');
    const itemsContainer = document.getElementById('ret-items');
    const addItemBtn = document.getElementById('ret-add-item-btn');

    let currentSaleItems = [];

    saleSelect.addEventListener('change', async () => {
      const saleId = saleSelect.value;
      if (!saleId) {
        itemsContainer.innerHTML = '<p style="text-align:center;color:var(--text-3);font-size:13px;padding:20px;">اختر الفاتورة أولاً</p>';
        addItemBtn.disabled = true;
        document.getElementById('sale-info').style.display = 'none';
        document.getElementById('ret-total').textContent = '0 ج.س';
        return;
      }

      const opt = saleSelect.selectedOptions[0];
      document.getElementById('ret-cust-name').textContent = opt.dataset.customerName || 'عميل نقدي';
      document.getElementById('sale-info').style.display = 'block';

      // جلب بنود الفاتورة
      const { data: items } = await window.SB.select('sale_items', {
        select: '*, products(name, unit)',
        eq: { sale_id: saleId }
      });

      currentSaleItems = items || [];
      itemsContainer.innerHTML = '';
      addItemBtn.disabled = false;

      if (!currentSaleItems.length) {
        itemsContainer.innerHTML = '<p style="text-align:center;color:var(--text-3);font-size:13px;padding:20px;">لا توجد بنود في الفاتورة</p>';
        return;
      }

      // إضافة أول بند تلقائياً
      addReturnItemRow(itemsContainer, currentSaleItems);
      updateReturnTotal();
    });

    addItemBtn.addEventListener('click', () => {
      if (currentSaleItems.length) addReturnItemRow(itemsContainer, currentSaleItems);
    });

    document.getElementById('save-ret-btn').addEventListener('click', saveNewReturn);
  } catch (err) {
    window.App.showToast(err.message, 'error');
  }
}

/* ─────────── سطر منتج مرتجع ─────────── */
function addReturnItemRow(container, saleItems) {
  const row = document.createElement('div');
  row.className = 'return-item-row';
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:8px;align-items:end;padding:10px;background:rgba(255,255,255,0.03);border-radius:10px;';

  row.innerHTML = `
    <div class="input-group" style="margin:0;">
      <label style="font-size:10.5px;">المنتج</label>
      <select class="ret-product">
        <option value="">— اختر —</option>
        ${saleItems.map(it => `
          <option value="${it.product_id}" data-max="${it.quantity}" data-price="${it.price}" data-name="${window.App.escapeHtml(it.products?.name || '')}" data-unit="${it.products?.unit || ''}">
            ${window.App.escapeHtml(it.products?.name || '')} (${it.quantity} ${it.products?.unit || ''} - ${window.App.formatCurrency(it.price)})
          </option>
        `).join('')}
      </select>
    </div>
    <div class="input-group" style="margin:0;">
      <label style="font-size:10.5px;">الكمية</label>
      <input type="number" class="ret-qty" min="0.01" step="0.01" value="1">
    </div>
    <div class="input-group" style="margin:0;">
      <label style="font-size:10.5px;">السعر</label>
      <input type="number" class="ret-price" min="0" step="0.01" value="0" readonly>
    </div>
    <button class="btn btn-sm btn-danger" style="padding:8px;" onclick="this.parentElement.remove(); updateReturnTotal();">${window.App.icons.trash}</button>
  `;

  container.appendChild(row);

  const productSel = row.querySelector('.ret-product');
  const qtyInput = row.querySelector('.ret-qty');
  const priceInput = row.querySelector('.ret-price');

  productSel.addEventListener('change', () => {
    const opt = productSel.selectedOptions[0];
    if (opt && opt.value) {
      priceInput.value = opt.dataset.price || 0;
      qtyInput.max = opt.dataset.max || 999999;
      qtyInput.value = Math.min(qtyInput.value || 1, Number(opt.dataset.max) || 1);
    }
    updateReturnTotal();
  });

  qtyInput.addEventListener('input', updateReturnTotal);
}

/* ─────────── حساب الإجمالي ─────────── */
function updateReturnTotal() {
  const rows = document.querySelectorAll('.return-item-row');
  let total = 0;
  rows.forEach(r => {
    const qty = Number(r.querySelector('.ret-qty').value) || 0;
    const price = Number(r.querySelector('.ret-price').value) || 0;
    total += qty * price;
  });
  const el = document.getElementById('ret-total');
  if (el) el.textContent = window.App.formatCurrency(total);
  return total;
}

/* ─────────── حفظ المرتجع ─────────── */
async function saveNewReturn() {
  const btn = document.getElementById('save-ret-btn');
  if (!btn || btn.dataset.processing === 'true') return;
  const unlock = window.App.lockProcessing(btn, 'جاري الحفظ...');

  try {
    const saleId = document.getElementById('ret-sale').value;
    const refundType = document.getElementById('ret-refund-type').value;
    const reason = document.getElementById('ret-reason').value.trim();

    if (!saleId) throw new Error('اختر الفاتورة الأصلية');
    if (!reason) throw new Error('يجب إدخال سبب الإرجاع');

    const rows = document.querySelectorAll('.return-item-row');
    const items = [];
    for (const row of rows) {
      const productId = row.querySelector('.ret-product').value;
      const qty = Number(row.querySelector('.ret-qty').value);
      const price = Number(row.querySelector('.ret-price').value);
      const maxQty = Number(row.querySelector('.ret-product').selectedOptions[0]?.dataset.max || 0);

      if (!productId) continue;
      if (qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من 0');
      if (maxQty && qty > maxQty) {
        throw new Error(`الكمية المرتجعة أكبر من المسموح (${maxQty})`);
      }

      items.push({ product_id: productId, quantity: qty, price });
    }

    if (items.length === 0) throw new Error('يجب اختيار منتج واحد على الأقل');

    const { data: ret, error } = await window.SB.createReturn(saleId, items, refundType, reason);
    if (error) throw new Error(error);

    // اعتماد مباشر
    const { error: apprErr } = await window.SB.approveReturn(ret.id);
    if (apprErr) throw new Error(apprErr);

    window.App.showToast('تم حفظ واعتماد المرتجع بنجاح', 'success');
    window.App.closeModal();
    if (window.App.state.currentRoute === 'returns') await loadReturnsList();
  } catch (err) {
    console.error('❌ saveNewReturn:', err);
    window.App.showToast(err.message, 'error');
  } finally {
    unlock();
  }
}

/* ═══════════════════════════════════════════════════════════════
   فتح مرتجع من فاتورة مباشرة
   ═══════════════════════════════════════════════════════════════ */

async function openReturnFromSale(saleId) {
  try {
    // تحويل لشاشة المرتجعات + فتح النافذة مع الفاتورة المختارة مسبقاً
    window.App.navigateTo('returns');
    setTimeout(async () => {
      await openNewReturnModal();
      setTimeout(() => {
        const sel = document.getElementById('ret-sale');
        if (sel) {
          sel.value = saleId;
          sel.dispatchEvent(new Event('change'));
        }
      }, 200);
    }, 300);
  } catch (err) {
    window.App.showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   عرض تفاصيل مرتجع
   ═══════════════════════════════════════════════════════════════ */

async function viewReturnDetails(returnId) {
  try {
    const { data: ret } = await window.SB.getById('returns', returnId);
    if (!ret) throw new Error('المرتجع غير موجود');

    const { data: items } = await window.SB.select('return_items', {
      select: '*, products(name, unit)',
      eq: { return_id: returnId }
    });

    const { data: sale } = ret.sale_id ? await window.SB.getById('sales', ret.sale_id) : { data: null };
    const { data: customer } = ret.customer_id ? await window.SB.getById('customers', ret.customer_id) : { data: null };

    const bodyHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div><span style="color:var(--text-3);font-size:12px;">رقم المرتجع:</span><br><strong>${window.App.escapeHtml(ret.return_number)}</strong></div>
        <div><span style="color:var(--text-3);font-size:12px;">التاريخ:</span><br>${window.App.formatDateTime(ret.created_at)}</div>
        <div><span style="color:var(--text-3);font-size:12px;">الفاتورة الأصلية:</span><br>${window.App.escapeHtml(sale?.invoice_number || '—')}</div>
        <div><span style="color:var(--text-3);font-size:12px;">العميل:</span><br>${window.App.escapeHtml(customer?.name || 'عميل نقدي')}</div>
        <div><span style="color:var(--text-3);font-size:12px;">طريقة الاسترداد:</span><br>${refundTypeBadge(ret.refund_type)}</div>
        <div><span style="color:var(--text-3);font-size:12px;">الحالة:</span><br>${window.Modules.statusBadge(ret.status)}</div>
      </div>

      <h4 style="font-size:14px;font-weight:700;margin:16px 0 8px;">المنتجات المرتجعة</h4>
      <div class="table-wrap" style="background:transparent;border:none;">
        <table>
          <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${window.App.escapeHtml(i.products?.name || '—')}</td>
                <td>${i.quantity} ${i.products?.unit || ''}</td>
                <td>${window.App.formatCurrency(i.price)}</td>
                <td>${window.App.formatCurrency(i.subtotal || i.quantity * i.price)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:16px;padding:16px;background:rgba(245,158,11,0.08);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="font-weight:700;">إجمالي المرتجع:</span>
          <strong style="font-size:18px;color:var(--accent);">${window.App.formatCurrency(ret.total)}</strong>
        </div>
      </div>

      ${ret.reason ? `<div style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:12.5px;color:var(--text-2);">📝 السبب: ${window.App.escapeHtml(ret.reason)}</div>` : ''}
    `;

    window.App.openModal('تفاصيل المرتجع', bodyHtml, `
      <button class="btn btn-ghost" onclick="window.print()">${window.App.icons.print} طباعة</button>
      <button class="btn btn-primary" onclick="window.App.closeModal()">إغلاق</button>
    `);
  } catch (err) {
    window.App.showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   اعتماد وحذف
   ═══════════════════════════════════════════════════════════════ */

async function approveReturnConfirm(returnId) {
  const ok = await window.App.confirmDialog(
    'اعتماد المرتجع؟ سيتم إرجاع الكميات للمخزن ومعالجة الاسترداد',
    { title: 'اعتماد مرتجع', type: 'info', okText: 'اعتماد' }
  );
  if (!ok) return;

  const { error } = await window.SB.approveReturn(returnId);
  if (error) {
    window.App.showToast(error, 'error');
    return;
  }
  window.App.showToast('تم اعتماد المرتجع', 'success');
  await loadReturnsList();
}

async function deleteReturnConfirm(returnId) {
  const ok = await window.App.confirmDialog(
    'حذف المرتجع؟ لا يمكن التراجع عن هذا الإجراء',
    { title: 'حذف مرتجع', type: 'danger', okText: 'حذف' }
  );
  if (!ok) return;

  try {
    // حذف البنود ثم المرتجع
    await window.SB.client.from('return_items').delete().eq('return_id', returnId);
    const { error } = await window.SB.delete('returns', returnId);
    if (error) throw new Error(error);
    await window.SB.logAudit('delete', 'returns', returnId);
    window.App.showToast('تم حذف المرتجع', 'success');
    await loadReturnsList();
  } catch (err) {
    window.App.showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   تصدير Excel
   ═══════════════════════════════════════════════════════════════ */

async function exportReturnsExcel() {
  try {
    const from = document.getElementById('ret-from').value;
    const to = document.getElementById('ret-to').value;
    const status = document.getElementById('ret-status').value;

    const opts = {
      select: '*, customers(name), sales(invoice_number)',
      order: { column: 'created_at', ascending: false }
    };
    if (from) opts.gte = { created_at: from };
    if (to) opts.lte = { created_at: to + 'T23:59:59' };
    if (status) opts.eq = { status };

    const { data } = await window.SB.select('returns', opts);

    const rows = [
      ['رقم المرتجع', 'الفاتورة الأصلية', 'العميل', 'المبلغ', 'طريقة الاسترداد', 'السبب', 'الحالة', 'التاريخ'],
      ...data.map(r => [
        r.return_number || '',
        r.sales?.invoice_number || '',
        r.customers?.name || '',
        r.total,
        r.refund_type,
        r.reason || '',
        r.status,
        window.App.formatDateTime(r.created_at)
      ])
    ];
    window.Modules.downloadCSV(rows, 'returns-report');
    window.App.showToast('تم التصدير', 'success');
  } catch (err) {
    window.App.showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   التصدير العام
   ═══════════════════════════════════════════════════════════════ */

window.Returns = {
  renderReturns,
  openNewReturnModal,
  openReturnFromSale,
  viewReturnDetails,
  approveReturnConfirm,
  deleteReturnConfirm
};

console.log('✅ returns.js جاهز');