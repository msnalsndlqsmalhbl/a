/* ═══════════════════════════════════════════════════════════════
   نظام إدارة قسم الحبل - مصنع الصندل
   supabase.js - CRUD + Auth + Realtime + عمليات مركبة
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────── إعداد الاتصال ─────────────── */
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

let sb = null;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    },
    realtime: { params: { eventsPerSecond: 5 } }
  });
  console.log('✅ تم الاتصال بـ Supabase');
} catch (err) {
  console.error('❌ فشل الاتصال:', err);
}

/* ═══════════════════════════════════════════════════════════════
   1. دوال CRUD عامة
   ═══════════════════════════════════════════════════════════════ */

async function dbSelect(table, options = {}) {
  try {
    let query = sb.from(table).select(options.select || '*');
    if (options.eq) Object.entries(options.eq).forEach(([k, v]) => query = query.eq(k, v));
    if (options.neq) Object.entries(options.neq).forEach(([k, v]) => query = query.neq(k, v));
    if (options.gte) Object.entries(options.gte).forEach(([k, v]) => query = query.gte(k, v));
    if (options.lte) Object.entries(options.lte).forEach(([k, v]) => query = query.lte(k, v));
    if (options.gt) Object.entries(options.gt).forEach(([k, v]) => query = query.gt(k, v));
    if (options.lt) Object.entries(options.lt).forEach(([k, v]) => query = query.lt(k, v));
    if (options.like) Object.entries(options.like).forEach(([k, v]) => query = query.ilike(k, `%${v}%`));
    if (options.in) Object.entries(options.in).forEach(([k, v]) => query = query.in(k, v));
    if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending !== false });
    if (options.limit) query = query.limit(options.limit);
    if (options.range) query = query.range(options.range.from, options.range.to);

    const { data, error } = await query;
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err) {
    console.error(`❌ dbSelect(${table}):`, err.message);
    return { data: [], error: err.message };
  }
}

async function dbGetById(table, id) {
  try {
    const { data, error } = await sb.from(table).select('*').eq('id', id).single();
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

async function dbInsert(table, payload) {
  try {
    const { data, error } = await sb.from(table).insert(payload).select();
    if (error) throw error;
    return { data: data ? data[0] : null, error: null };
  } catch (err) {
    console.error(`❌ dbInsert(${table}):`, err.message);
    return { data: null, error: err.message };
  }
}

async function dbInsertMany(table, payloads) {
  try {
    const { data, error } = await sb.from(table).insert(payloads).select();
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

async function dbUpdate(table, id, payload) {
  try {
    const { data, error } = await sb.from(table).update(payload).eq('id', id).select();
    if (error) throw error;
    return { data: data ? data[0] : null, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

async function dbDelete(table, id) {
  try {
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

async function dbCount(table, filters = {}) {
  try {
    let query = sb.from(table).select('*', { count: 'exact', head: true });
    Object.entries(filters).forEach(([k, v]) => query = query.eq(k, v));
    const { count, error } = await query;
    if (error) throw error;
    return { count: count || 0, error: null };
  } catch (err) {
    return { count: 0, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   2. المصادقة
   ═══════════════════════════════════════════════════════════════ */

async function authLogin(email, password) {
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

async function authLogout() {
  try {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

async function authGetSession() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return { session: data.session, error: null };
  } catch (err) {
    return { session: null, error: err.message };
  }
}

async function authGetUser() {
  try {
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return { user: data.user, error: null };
  } catch (err) {
    return { user: null, error: err.message };
  }
}

async function getUserProfile(userId) {
  try {
    const { data, error } = await sb.from('users').select('*').eq('id', userId).single();
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

async function getUserPermissions(userId) {
  try {
    const { data, error } = await sb.from('permissions').select('*').eq('user_id', userId);
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   3. Audit Log
   ═══════════════════════════════════════════════════════════════ */

async function logAudit(action, module, recordId = null, details = null) {
  try {
    const { user } = await authGetUser();
    if (!user) return;
    await sb.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      module,
      record_id: recordId,
      details: details || {}
    });
  } catch (err) {
    console.warn('⚠️ فشل تسجيل التدقيق:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   4. توليد الأرقام
   ═══════════════════════════════════════════════════════════════ */

async function generateInvoiceNumber() {
  try {
    const today = new Date();
    const prefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const { count } = await sb.from('sales').select('*', { count: 'exact', head: true }).like('invoice_number', `${prefix}%`);
    return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
  } catch { return `INV-${Date.now()}`; }
}

async function generateEntryNumber() {
  try {
    const today = new Date();
    const prefix = `JV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const { count } = await sb.from('journal_entries').select('*', { count: 'exact', head: true }).like('entry_number', `${prefix}%`);
    return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
  } catch { return `JV-${Date.now()}`; }
}

async function generateReturnNumber() {
  try {
    const today = new Date();
    const prefix = `RET-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const { count } = await sb.from('returns').select('*', { count: 'exact', head: true }).like('return_number', `${prefix}%`);
    return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
  } catch { return `RET-${Date.now()}`; }
}

/* ═══════════════════════════════════════════════════════════════
   5. القيود التلقائية
   ═══════════════════════════════════════════════════════════════ */

async function autoJournalForSale(sale, items) {
  try {
    const { user } = await authGetUser();
    if (!user) return;

    const entryNumber = await generateEntryNumber();
    const { data: entry, error: eErr } = await sb.from('journal_entries').insert({
      entry_number: entryNumber,
      date: new Date().toISOString().split('T')[0],
      description: `فاتورة مبيعات ${sale.invoice_number}`,
      ref_type: 'sale',
      ref_id: sale.id,
      created_by: user.id
    }).select().single();
    if (eErr) throw eErr;

    const { data: accounts } = await sb.from('accounts').select('*');
    const findAcc = (code) => accounts?.find(a => a.code === code);

    const cashAcc = findAcc('1100');
    const bankAcc = findAcc('1200');
    const custAcc = findAcc('1300');
    const revAcc = findAcc('4100');

    const lines = [];
    if (sale.paid_cash > 0 && cashAcc) {
      lines.push({ entry_id: entry.id, account_id: cashAcc.id, debit: sale.paid_cash, credit: 0, description: 'تحصيل كاش' });
    }
    if (sale.paid_bank > 0 && bankAcc) {
      lines.push({ entry_id: entry.id, account_id: bankAcc.id, debit: sale.paid_bank, credit: 0, description: 'تحصيل بنك' });
    }
    if (sale.remaining > 0 && custAcc) {
      lines.push({ entry_id: entry.id, account_id: custAcc.id, debit: sale.remaining, credit: 0, description: 'دين على العميل' });
    }
    if (revAcc) {
      lines.push({ entry_id: entry.id, account_id: revAcc.id, debit: 0, credit: sale.total, description: 'إيراد مبيعات' });
    }

    if (lines.length > 0) await sb.from('journal_lines').insert(lines);
  } catch (err) {
    console.warn('⚠️ فشل القيد التلقائي:', err.message);
  }
}

async function autoJournalForExpense(expense) {
  try {
    const { user } = await authGetUser();
    if (!user) return;

    const entryNumber = await generateEntryNumber();
    const { data: entry } = await sb.from('journal_entries').insert({
      entry_number: entryNumber,
      date: new Date().toISOString().split('T')[0],
      description: `مصروف: ${expense.category}`,
      ref_type: 'expense',
      ref_id: expense.id,
      created_by: user.id
    }).select().single();

    const { data: accounts } = await sb.from('accounts').select('*');
    const findAcc = (code) => accounts?.find(a => a.code === code);

    const cashAcc = findAcc('1100');
    const bankAcc = findAcc('1200');
    const expAcc = findAcc(expense.type === 'operational' ? '5200' : '5300');

    const lines = [];
    if (expAcc) lines.push({ entry_id: entry.id, account_id: expAcc.id, debit: expense.amount, credit: 0, description: expense.description });
    if (expense.cashbox_type === 'cash' && cashAcc) {
      lines.push({ entry_id: entry.id, account_id: cashAcc.id, debit: 0, credit: expense.amount, description: 'دفع كاش' });
    } else if (expense.cashbox_type === 'bank' && bankAcc) {
      lines.push({ entry_id: entry.id, account_id: bankAcc.id, debit: 0, credit: expense.amount, description: 'دفع بنك' });
    }

    if (lines.length > 0) await sb.from('journal_lines').insert(lines);
  } catch (err) {
    console.warn('⚠️ فشل قيد المصروف:', err.message);
  }
}

async function autoJournalForCustomerPayment(payment, customer) {
  try {
    const { user } = await authGetUser();
    if (!user) return;

    const entryNumber = await generateEntryNumber();
    const { data: entry } = await sb.from('journal_entries').insert({
      entry_number: entryNumber,
      date: new Date().toISOString().split('T')[0],
      description: `سداد من العميل ${customer.name}`,
      ref_type: 'customer_payment',
      ref_id: payment.id,
      created_by: user.id
    }).select().single();

    const { data: accounts } = await sb.from('accounts').select('*');
    const findAcc = (code) => accounts?.find(a => a.code === code);

    const cashAcc = findAcc('1100');
    const bankAcc = findAcc('1200');
    const extraAcc = findAcc('1500');
    const custAcc = findAcc('1300');

    const lines = [];
    if (payment.payment_type === 'cash' && cashAcc) {
      lines.push({ entry_id: entry.id, account_id: cashAcc.id, debit: payment.amount, credit: 0, description: 'استلام كاش' });
    } else if (payment.payment_type === 'bank' && bankAcc) {
      lines.push({ entry_id: entry.id, account_id: bankAcc.id, debit: payment.amount, credit: 0, description: 'استلام بنك' });
    } else if (payment.payment_type === 'extra_box' && extraAcc) {
      lines.push({ entry_id: entry.id, account_id: extraAcc.id, debit: payment.amount, credit: 0, description: 'خزنة أخرى' });
    }
    if (custAcc) {
      lines.push({ entry_id: entry.id, account_id: custAcc.id, debit: 0, credit: payment.amount, description: 'تخفيض ذمة العميل' });
    }

    if (lines.length > 0) await sb.from('journal_lines').insert(lines);
  } catch (err) {
    console.warn('⚠️ فشل قيد السداد:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   6. إنشاء فاتورة مبيعات
   ═══════════════════════════════════════════════════════════════ */

async function createSale(saleData, items, payments = []) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    if (saleData.client_uuid) {
      const { data: existing } = await sb.from('sales').select('id, invoice_number').eq('client_uuid', saleData.client_uuid).maybeSingle();
      if (existing) {
        return { data: existing, error: null, duplicate: true };
      }
    }

    const invoiceNumber = await generateInvoiceNumber();

    const salePayload = {
      invoice_number: invoiceNumber,
      customer_id: saleData.customer_id || null,
      subtotal: saleData.subtotal || 0,
      discount_type: saleData.discount_type || 'none',
      discount_value: saleData.discount_value || 0,
      discount_amount: saleData.discount_amount || 0,
      total: saleData.total,
      paid_cash: saleData.paid_cash || 0,
      paid_bank: saleData.paid_bank || 0,
      remaining: saleData.remaining || 0,
      payment_method: saleData.payment_method,
      status: 'pending',
      warehouse_approved: false,
      notes: saleData.notes || '',
      client_uuid: saleData.client_uuid || null,
      user_id: user.id
    };

    const { data: sale, error: saleErr } = await sb.from('sales').insert(salePayload).select().single();
    if (saleErr) {
      if (saleErr.code === '23505' && saleData.client_uuid) {
        const { data: existing } = await sb.from('sales').select('id, invoice_number').eq('client_uuid', saleData.client_uuid).single();
        return { data: existing, error: null, duplicate: true };
      }
      throw saleErr;
    }

    const itemsPayload = items.map(it => ({
      sale_id: sale.id,
      product_id: it.product_id,
      quantity: it.quantity,
      price: it.price,
      subtotal: it.quantity * it.price,
      source_type: it.source_type || 'warehouse',
      source_name: it.source_name || null
    }));
    const { error: itemsErr } = await sb.from('sale_items').insert(itemsPayload);
    if (itemsErr) throw itemsErr;

    if (payments.length > 0) {
      const paymentsPayload = payments.map(p => ({
        sale_id: sale.id,
        method: p.method,
        amount: p.amount,
        bank_ref: p.bank_ref || null
      }));
      await sb.from('sale_payments').insert(paymentsPayload);
    }

    await logAudit('create', 'sales', sale.id, { invoice_number: invoiceNumber, total: sale.total });
    return { data: sale, error: null };
  } catch (err) {
    console.error('❌ createSale:', err.message);
    return { data: null, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   7. موافقة أمين المخزن
   ═══════════════════════════════════════════════════════════════ */

async function approveWarehouseOrder(saleId, notes = '') {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: sale, error: sErr } = await sb.from('sales').select('*').eq('id', saleId).single();
    if (sErr) throw sErr;
    if (sale.status === 'approved') throw new Error('الفاتورة معتمدة مسبقاً');
    if (sale.status === 'rejected') throw new Error('الفاتورة مرفوضة');
    if (sale.warehouse_approved) throw new Error('الفاتورة موافق عليها من المخزن مسبقاً');

    // التحقق من الكميات
    const { data: items } = await sb.from('sale_items').select('*').eq('sale_id', saleId);
    for (const item of items) {
      if (item.source_type !== 'warehouse') continue;
      const { data: product } = await sb.from('products').select('*').eq('id', item.product_id).single();
      if (product.quantity < item.quantity) {
        throw new Error(`الكمية المتاحة من "${product.name}" غير كافية (المطلوب: ${item.quantity}, المتاح: ${product.quantity})`);
      }
    }

    await sb.from('sales').update({
      warehouse_approved: true,
      warehouse_approved_by: user.id,
      warehouse_approved_at: new Date().toISOString(),
      warehouse_notes: notes
    }).eq('id', saleId);

    await logAudit('approve', 'sales', saleId, {
      action: 'warehouse_approval',
      invoice_number: sale.invoice_number,
      notes
    });

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

async function rejectWarehouseOrder(saleId, reason) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');
    if (!reason || !reason.trim()) throw new Error('سبب الرفض مطلوب');

    const { data: sale } = await sb.from('sales').select('*').eq('id', saleId).single();
    if (!sale) throw new Error('الفاتورة غير موجودة');

    await sb.from('sales').update({
      status: 'rejected',
      warehouse_approved: false,
      warehouse_approved_by: user.id,
      warehouse_approved_at: new Date().toISOString(),
      warehouse_rejection_reason: reason.trim()
    }).eq('id', saleId);

    await logAudit('reject', 'sales', saleId, {
      action: 'warehouse_rejection',
      invoice_number: sale.invoice_number,
      reason
    });

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

async function getPendingWarehouseOrders() {
  try {
    const { data, error } = await sb
      .from('sales')
      .select('*, customers(name)')
      .in('status', ['pending', 'awaiting_warehouse'])
      .eq('warehouse_approved', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   8. اعتماد فاتورة مبيعات
   ═══════════════════════════════════════════════════════════════ */

async function approveSale(saleId) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: sale, error: sErr } = await sb.from('sales').select('*').eq('id', saleId).single();
    if (sErr) throw sErr;
    if (sale.status === 'approved') throw new Error('الفاتورة معتمدة مسبقاً');
    if (sale.status === 'rejected') throw new Error('الفاتورة مرفوضة - يجب تعديلها أولاً');

    const { data: items, error: iErr } = await sb.from('sale_items').select('*').eq('sale_id', saleId);
    if (iErr) throw iErr;

    // خصم من المخزن
    for (const item of items) {
      if (item.source_type !== 'warehouse') continue;

      const { data: product, error: pErr } = await sb.from('products').select('*').eq('id', item.product_id).single();
      if (pErr) throw pErr;
      if (product.quantity < item.quantity) {
        throw new Error(`الكمية المتاحة من "${product.name}" غير كافية (المتاح: ${product.quantity})`);
      }

      await sb.from('products').update({ quantity: product.quantity - item.quantity }).eq('id', product.id);

      await sb.from('warehouse_transactions').insert({
        product_id: product.id,
        type: 'out',
        quantity: item.quantity,
        reason: `فاتورة مبيعات ${sale.invoice_number}`,
        ref_id: sale.id,
        user_id: user.id
      });
    }

    // حركات الخزنة
    if (sale.paid_cash > 0) {
      await sb.from('cash_transactions').insert({
        type: 'in',
        amount: sale.paid_cash,
        description: `مبيعات كاش - فاتورة ${sale.invoice_number}`,
        ref_id: sale.id,
        user_id: user.id
      });
    }
    if (sale.paid_bank > 0) {
      await sb.from('bank_transactions').insert({
        type: 'in',
        amount: sale.paid_bank,
        description: `مبيعات بنك - فاتورة ${sale.invoice_number}`,
        ref_id: sale.id,
        user_id: user.id
      });
    }

    // دين العميل
    if (sale.remaining > 0 && sale.customer_id) {
      const { data: customer } = await sb.from('customers').select('*').eq('id', sale.customer_id).single();
      if (customer) {
        await sb.from('customers').update({ balance: (customer.balance || 0) + sale.remaining }).eq('id', customer.id);
      }
    }

    await autoJournalForSale(sale, items);

    await sb.from('sales').update({
      status: 'approved',
      warehouse_approved: true
    }).eq('id', saleId);

    await logAudit('approve', 'sales', sale.id, { invoice_number: sale.invoice_number });

    return { error: null };
  } catch (err) {
    console.error('❌ approveSale:', err.message);
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   9. إدارة المستخدمين
   ═══════════════════════════════════════════════════════════════ */

async function createUserAccount(email, password, fullName, role) {
  try {
    const { data, error } = await sb.functions.invoke('create-user', {
      body: { email, password, fullName, role }
    });
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   10. سداد العملاء
   ═══════════════════════════════════════════════════════════════ */

async function createCustomerPayment(customerId, amount, paymentType, options = {}) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: customer, error: cErr } = await sb.from('customers').select('*').eq('id', customerId).single();
    if (cErr) throw cErr;

    if (amount > customer.balance) {
      throw new Error(`المبلغ أكبر من الدين (${customer.balance})`);
    }

    const { data: payment, error: pErr } = await sb.from('customer_payments').insert({
      customer_id: customerId,
      amount: Number(amount),
      payment_type: paymentType,
      extra_box_id: options.extra_box_id || null,
      bank_ref: options.bank_ref || null,
      description: options.description || '',
      user_id: user.id
    }).select().single();
    if (pErr) throw pErr;

    // حركة الخزنة
    if (paymentType === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'in',
        amount: Number(amount),
        description: `سداد من العميل: ${customer.name}`,
        ref_id: payment.id,
        user_id: user.id
      });
    } else if (paymentType === 'bank') {
      await sb.from('bank_transactions').insert({
        type: 'in',
        amount: Number(amount),
        description: `سداد من العميل: ${customer.name}`,
        bank_ref: options.bank_ref || null,
        ref_id: payment.id,
        user_id: user.id
      });
    } else if (paymentType === 'extra_box' && options.extra_box_id) {
      await sb.from('extra_cashbox_transactions').insert({
        cashbox_id: options.extra_box_id,
        type: 'in',
        amount: Number(amount),
        description: `سداد من العميل: ${customer.name}`,
        ref_id: payment.id,
        user_id: user.id
      });
      const { data: box } = await sb.from('extra_cashboxes').select('*').eq('id', options.extra_box_id).single();
      if (box) {
        await sb.from('extra_cashboxes').update({ balance: Number(box.balance || 0) + Number(amount) }).eq('id', box.id);
      }
    }

    await sb.from('customers').update({ balance: Number(customer.balance) - Number(amount) }).eq('id', customerId);
    await autoJournalForCustomerPayment(payment, customer);
    await logAudit('create', 'customer_payments', payment.id, { customer_id: customerId, amount });

    return { data: payment, error: null };
  } catch (err) {
    console.error('❌ createCustomerPayment:', err.message);
    return { data: null, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   11. سداد الموردين
   ═══════════════════════════════════════════════════════════════ */

async function createSupplierPayment(supplierId, amount, paymentType, options = {}) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: supplier, error: sErr } = await sb.from('suppliers').select('*').eq('id', supplierId).single();
    if (sErr) throw sErr;

    if (amount > supplier.balance) {
      throw new Error(`المبلغ أكبر من المستحق (${supplier.balance})`);
    }

    const { data: payment, error: pErr } = await sb.from('supplier_payments').insert({
      supplier_id: supplierId,
      amount: Number(amount),
      payment_type: paymentType,
      extra_box_id: options.extra_box_id || null,
      bank_ref: options.bank_ref || null,
      description: options.description || '',
      user_id: user.id
    }).select().single();
    if (pErr) throw pErr;

    if (paymentType === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'out',
        amount: Number(amount),
        description: `سداد إلى المورد: ${supplier.name}`,
        ref_id: payment.id,
        user_id: user.id
      });
    } else if (paymentType === 'bank') {
      await sb.from('bank_transactions').insert({
        type: 'out',
        amount: Number(amount),
        description: `سداد إلى المورد: ${supplier.name}`,
        bank_ref: options.bank_ref || null,
        ref_id: payment.id,
        user_id: user.id
      });
    } else if (paymentType === 'extra_box' && options.extra_box_id) {
      await sb.from('extra_cashbox_transactions').insert({
        cashbox_id: options.extra_box_id,
        type: 'out',
        amount: Number(amount),
        description: `سداد للمورد: ${supplier.name}`,
        ref_id: payment.id,
        user_id: user.id
      });
      const { data: box } = await sb.from('extra_cashboxes').select('*').eq('id', options.extra_box_id).single();
      if (box) {
        await sb.from('extra_cashboxes').update({ balance: Number(box.balance || 0) - Number(amount) }).eq('id', box.id);
      }
    }

    await sb.from('suppliers').update({ balance: Number(supplier.balance) - Number(amount) }).eq('id', supplierId);
    await logAudit('create', 'supplier_payments', payment.id, { supplier_id: supplierId, amount });

    return { data: payment, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   12. إخراج من المخزن
   ═══════════════════════════════════════════════════════════════ */

async function stockOut(productId, quantity, reason, options = {}) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: product, error: pErr } = await sb.from('products').select('*').eq('id', productId).single();
    if (pErr) throw pErr;
    if (product.quantity < quantity) {
      throw new Error(`الكمية المتاحة ${product.quantity} فقط`);
    }

    await sb.from('products').update({ quantity: Number(product.quantity) - Number(quantity) }).eq('id', productId);

    await sb.from('warehouse_transactions').insert({
      product_id: productId,
      type: 'out',
      quantity: Number(quantity),
      reason: options.notes || reason,
      user_id: user.id
    });

    await sb.from('stock_out_log').insert({
      product_id: productId,
      quantity: Number(quantity),
      reason,
      destination_type: options.destination_type || 'other',
      destination_id: options.destination_id || null,
      destination_name: options.destination_name || '',
      notes: options.notes || '',
      user_id: user.id
    });

    await logAudit('create', 'stock_out_log', null, { product_id: productId, quantity, reason });
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   13. المرتجعات
   ═══════════════════════════════════════════════════════════════ */

async function createReturn(saleId, items, refundType, reason) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: sale } = await sb.from('sales').select('*').eq('id', saleId).single();
    if (!sale) throw new Error('الفاتورة غير موجودة');

    const total = items.reduce((s, it) => s + it.quantity * it.price, 0);
    const returnNumber = await generateReturnNumber();

    const { data: ret, error: rErr } = await sb.from('returns').insert({
      return_number: returnNumber,
      sale_id: saleId,
      customer_id: sale.customer_id,
      total,
      refund_type: refundType,
      refund_amount: total,
      reason,
      status: 'pending',
      user_id: user.id
    }).select().single();
    if (rErr) throw rErr;

    const itemsPayload = items.map(it => ({
      return_id: ret.id,
      product_id: it.product_id,
      quantity: it.quantity,
      price: it.price,
      subtotal: it.quantity * it.price
    }));
    await sb.from('return_items').insert(itemsPayload);

    await logAudit('create', 'returns', ret.id, { return_number: returnNumber, total });
    return { data: ret, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

async function approveReturn(returnId) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: ret, error: rErr } = await sb.from('returns').select('*').eq('id', returnId).single();
    if (rErr) throw rErr;
    if (ret.status === 'approved') throw new Error('المرتجع معتمد مسبقاً');

    const { data: items } = await sb.from('return_items').select('*').eq('return_id', returnId);

    for (const item of items) {
      const { data: product } = await sb.from('products').select('*').eq('id', item.product_id).single();
      if (product) {
        await sb.from('products').update({ quantity: Number(product.quantity) + Number(item.quantity) }).eq('id', product.id);
        await sb.from('warehouse_transactions').insert({
          product_id: product.id,
          type: 'in',
          quantity: item.quantity,
          reason: `مرتجع - ${ret.return_number}`,
          ref_id: ret.id,
          user_id: user.id
        });
      }
    }

    if (ret.refund_type === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'out',
        amount: ret.total,
        description: `مرتجع كاش - ${ret.return_number}`,
        ref_id: ret.id,
        user_id: user.id
      });
    } else if (ret.refund_type === 'bank') {
      await sb.from('bank_transactions').insert({
        type: 'out',
        amount: ret.total,
        description: `مرتجع بنك - ${ret.return_number}`,
        ref_id: ret.id,
        user_id: user.id
      });
    } else if (ret.refund_type === 'customer_credit' && ret.customer_id) {
      const { data: customer } = await sb.from('customers').select('*').eq('id', ret.customer_id).single();
      if (customer) {
        await sb.from('customers').update({ balance: Number(customer.balance || 0) - Number(ret.total) }).eq('id', customer.id);
      }
    }

    await sb.from('returns').update({ status: 'approved' }).eq('id', returnId);
    await logAudit('approve', 'returns', ret.id, { return_number: ret.return_number });
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   14. أرصدة الخزائن
   ═══════════════════════════════════════════════════════════════ */

async function getCashBalance() {
  try {
    const { data } = await sb.from('cash_transactions').select('type, amount');
    let balance = 0;
    (data || []).forEach(t => {
      balance += t.type === 'in' ? Number(t.amount) : -Number(t.amount);
    });
    const { data: setting } = await sb.from('settings').select('value').eq('key', 'default_cash_balance').single();
    if (setting) balance += Number(setting.value || 0);
    return balance;
  } catch { return 0; }
}

async function getBankBalance() {
  try {
    const { data } = await sb.from('bank_transactions').select('type, amount');
    let balance = 0;
    (data || []).forEach(t => {
      balance += t.type === 'in' ? Number(t.amount) : -Number(t.amount);
    });
    const { data: setting } = await sb.from('settings').select('value').eq('key', 'default_bank_balance').single();
    if (setting) balance += Number(setting.value || 0);
    return balance;
  } catch { return 0; }
}

async function getExtraBoxesBalance() {
  try {
    const { data } = await sb.from('extra_cashboxes').select('*').eq('is_active', true);
    return (data || []).reduce((s, b) => s + Number(b.balance || 0), 0);
  } catch { return 0; }
}

async function getTotalTreasury() {
  const [cash, bank, extra] = await Promise.all([getCashBalance(), getBankBalance(), getExtraBoxesBalance()]);
  return cash + bank + extra;
}

/* ═══════════════════════════════════════════════════════════════
   15. التحويلات
   ═══════════════════════════════════════════════════════════════ */

async function createTransfer(fromType, toType, amount, toName, description) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');
    if (fromType === toType) throw new Error('لا يمكن التحويل لنفس الخزنة');

    const balance = fromType === 'cash' ? await getCashBalance() : await getBankBalance();
    if (balance < amount) throw new Error(`رصيد ${fromType === 'cash' ? 'الكاش' : 'البنك'} غير كافٍ (المتاح: ${balance})`);

    const { data: transfer, error } = await sb.from('transfers').insert({
      from_type: fromType,
      to_type: toType,
      to_name: toName,
      amount: Number(amount),
      description,
      user_id: user.id
    }).select().single();
    if (error) throw error;

    if (fromType === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'out', amount, description: `تحويل إلى ${toType === 'cash' ? 'كاش' : 'بنك'} - ${toName || ''}`, ref_id: transfer.id, user_id: user.id
      });
    } else {
      await sb.from('bank_transactions').insert({
        type: 'out', amount, description: `تحويل إلى ${toType === 'cash' ? 'كاش' : 'بنك'} - ${toName || ''}`, ref_id: transfer.id, user_id: user.id
      });
    }

    if (toType === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'in', amount, description: `تحويل من ${fromType === 'cash' ? 'كاش' : 'بنك'}`, ref_id: transfer.id, user_id: user.id
      });
    } else {
      await sb.from('bank_transactions').insert({
        type: 'in', amount, description: `تحويل من ${fromType === 'cash' ? 'كاش' : 'بنك'}`, ref_id: transfer.id, user_id: user.id
      });
    }

    await logAudit('create', 'transfers', transfer.id, { fromType, toType, amount });
    return { data: transfer, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   16. المصروفات
   ═══════════════════════════════════════════════════════════════ */

async function approveExpense(expenseId) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: expense } = await sb.from('expenses').select('*').eq('id', expenseId).single();
    if (!expense) throw new Error('المصروف غير موجود');
    if (expense.status === 'approved') throw new Error('معتمد مسبقاً');

    if (expense.cashbox_type === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'out', amount: expense.amount, description: expense.description || expense.category, ref_id: expense.id, user_id: user.id
      });
    } else if (expense.cashbox_type === 'bank') {
      await sb.from('bank_transactions').insert({
        type: 'out', amount: expense.amount, description: expense.description || expense.category, ref_id: expense.id, user_id: user.id
      });
    }

    await autoJournalForExpense(expense);
    await sb.from('expenses').update({ status: 'approved' }).eq('id', expenseId);
    await logAudit('approve', 'expenses', expense.id, { amount: expense.amount });
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   17. القيد اليدوي
   ═══════════════════════════════════════════════════════════════ */

async function createManualJournal(entryData, lines) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`القيد غير متوازن: مدين ${totalDebit} ≠ دائن ${totalCredit}`);
    }

    const entryNumber = await generateEntryNumber();
    const { data: entry, error: eErr } = await sb.from('journal_entries').insert({
      entry_number: entryNumber,
      date: entryData.date || new Date().toISOString().split('T')[0],
      description: entryData.description,
      ref_type: 'manual',
      created_by: user.id
    }).select().single();
    if (eErr) throw eErr;

    const linesPayload = lines.map(l => ({
      entry_id: entry.id,
      account_id: l.account_id,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      description: l.description || ''
    }));

    await sb.from('journal_lines').insert(linesPayload);
    await logAudit('create', 'journal_entries', entry.id, { entry_number: entryNumber });
    return { data: entry, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   18. التسويات
   ═══════════════════════════════════════════════════════════════ */

async function createReconciliation(type, actual, reason) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const expected = type === 'cash' ? await getCashBalance() : await getBankBalance();
    const difference = Number(actual) - expected;

    const { data: rec, error } = await sb.from('reconciliations').insert({
      type, expected, actual: Number(actual), difference, reason, user_id: user.id
    }).select().single();
    if (error) throw error;

    if (Math.abs(difference) > 0.01) {
      const entryNumber = await generateEntryNumber();
      const { data: entry } = await sb.from('journal_entries').insert({
        entry_number: entryNumber,
        date: new Date().toISOString().split('T')[0],
        description: `تسوية ${type === 'cash' ? 'كاش' : 'بنك'}`,
        ref_type: 'reconciliation',
        ref_id: rec.id,
        created_by: user.id
      }).select().single();

      const { data: accounts } = await sb.from('accounts').select('*');
      const acc = accounts?.find(a => a.code === (type === 'cash' ? '1100' : '1200'));
      const diffAcc = accounts?.find(a => a.code === '5300');

      const lines = [];
      if (difference > 0 && acc && diffAcc) {
        lines.push({ entry_id: entry.id, account_id: acc.id, debit: difference, credit: 0, description: 'زيادة فعلية' });
        lines.push({ entry_id: entry.id, account_id: diffAcc.id, debit: 0, credit: difference, description: 'فرق تسوية' });
      } else if (difference < 0 && acc && diffAcc) {
        const abs = Math.abs(difference);
        lines.push({ entry_id: entry.id, account_id: diffAcc.id, debit: abs, credit: 0, description: 'فرق تسوية' });
        lines.push({ entry_id: entry.id, account_id: acc.id, debit: 0, credit: abs, description: 'نقص فعلي' });
      }
      if (lines.length > 0) await sb.from('journal_lines').insert(lines);
    }

    await logAudit('create', 'reconciliations', rec.id, { type, difference });
    return { data: rec, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   19. Storage
   ═══════════════════════════════════════════════════════════════ */

async function uploadAttachment(file, folder = 'general') {
  try {
    const ext = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await sb.storage.from('attachments').upload(fileName, file);
    if (error) throw error;
    const { data: urlData } = sb.storage.from('attachments').getPublicUrl(data.path);
    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    return { url: null, error: err.message };
  }
}

async function clearAllAttachments() {
  try {
    const { data } = await sb.storage.from('attachments').list();
    if (data && data.length > 0) {
      await sb.storage.from('attachments').remove(data.map(f => f.name));
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   20. Realtime
   ═══════════════════════════════════════════════════════════════ */

const realtimeChannels = {};

function subscribeToTable(table, callback) {
  try {
    if (realtimeChannels[table]) {
      sb.removeChannel(realtimeChannels[table]);
    }
    const channel = sb
      .channel(`realtime-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
    realtimeChannels[table] = channel;
    return channel;
  } catch (err) {
    console.warn(`⚠️ فشل الاشتراك في ${table}:`, err.message);
    return null;
  }
}

function unsubscribeAll() {
  Object.keys(realtimeChannels).forEach(table => {
    try { sb.removeChannel(realtimeChannels[table]); } catch {}
    delete realtimeChannels[table];
  });
}

/* ═══════════════════════════════════════════════════════════════
   21. حذف جميع البيانات
   ═══════════════════════════════════════════════════════════════ */

async function deleteAllData() {
  const results = { success: [], failed: [] };

  const tables = [
    'journal_lines',
    'journal_entries',
    'sale_payments',
    'sale_items',
    'return_items',
    'purchase_items',
    'warehouse_transactions',
    'extra_cashbox_transactions',
    'customer_payments',
    'supplier_payments',
    'stock_out_log',
    'permissions',
    'returns',
    'sales',
    'purchases',
    'expenses',
    'cash_transactions',
    'bank_transactions',
    'transfers',
    'reconciliations',
    'extra_cashboxes',
    'external_locations',
    'products',
    'customers',
    'suppliers',
    'accounts',
    'audit_logs',
  ];

  for (const table of tables) {
    try {
      let query = sb.from(table).delete();
      if (table === 'settings') {
        query = query.neq('key', '___never___');
      } else {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error } = await query;
      if (error) {
        results.failed.push({ table, error: error.message });
      } else {
        results.success.push(table);
      }
    } catch (err) {
      results.failed.push({ table, error: err.message });
    }
  }

  try { await clearAllAttachments(); } catch {}

  try {
    const keysToKeep = [];
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-') && k.includes('auth-token')) keysToKeep.push(k);
    });
    const backup = {};
    keysToKeep.forEach(k => backup[k] = localStorage.getItem(k));
    localStorage.clear();
    Object.entries(backup).forEach(([k, v]) => localStorage.setItem(k, v));
  } catch {}

  return results;
}

/* ═══════════════════════════════════════════════════════════════
   22. دوال مساعدة
   ═══════════════════════════════════════════════════════════════ */

async function getDashboardKPIs() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const { data: sales } = await sb.from('sales').select('total').eq('status', 'approved');
    const totalSales = (sales || []).reduce((s, r) => s + Number(r.total), 0);

    const { count: productCount } = await sb.from('products').select('*', { count: 'exact', head: true });
    const { count: customerCount } = await sb.from('customers').select('*', { count: 'exact', head: true });
    const { count: supplierCount } = await sb.from('suppliers').select('*', { count: 'exact', head: true });

    const cashBalance = await getCashBalance();
    const bankBalance = await getBankBalance();
    const extraBalance = await getExtraBoxesBalance();

    const { data: expenses } = await sb.from('expenses').select('amount').eq('status', 'approved').gte('created_at', monthStart);
    const monthExpenses = (expenses || []).reduce((s, r) => s + Number(r.amount), 0);

    const { data: products } = await sb.from('products').select('id, name, quantity, min_quantity');
    const lowStock = (products || []).filter(p => Number(p.quantity) <= Number(p.min_quantity));

    return {
      totalSales,
      productCount: productCount || 0,
      customerCount: customerCount || 0,
      supplierCount: supplierCount || 0,
      cashBalance,
      bankBalance,
      extraBalance,
      totalTreasury: cashBalance + bankBalance + extraBalance,
      monthExpenses,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock
    };
  } catch (err) {
    return {
      totalSales: 0, productCount: 0, customerCount: 0, supplierCount: 0,
      cashBalance: 0, bankBalance: 0, extraBalance: 0, totalTreasury: 0,
      monthExpenses: 0, lowStockCount: 0, lowStockItems: []
    };
  }
}

async function getCustomerStatement(customerId, fromDate = null, toDate = null) {
  try {
    let query = sb.from('sales')
      .select('id, invoice_number, total, paid_cash, paid_bank, remaining, status, created_at')
      .eq('customer_id', customerId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true });
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data: sales } = await query;

    let payQuery = sb.from('customer_payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });
    if (fromDate) payQuery = payQuery.gte('created_at', fromDate);
    if (toDate) payQuery = payQuery.lte('created_at', toDate);
    const { data: payments } = await payQuery;

    const all = [];
    (sales || []).forEach(s => all.push({
      type: 'sale',
      date: s.created_at,
      ref: s.invoice_number,
      amount: s.total,
      paid: Number(s.paid_cash) + Number(s.paid_bank),
      remaining: s.remaining
    }));
    (payments || []).forEach(p => all.push({
      type: 'payment',
      date: p.created_at,
      ref: 'سداد',
      amount: 0,
      paid: p.amount,
      remaining: 0
    }));

    all.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    const statement = all.map(x => {
      if (x.type === 'sale') balance += Number(x.remaining);
      else balance -= Number(x.paid);
      return { ...x, running_balance: balance };
    });

    return { data: statement, finalBalance: balance, error: null };
  } catch (err) {
    return { data: [], finalBalance: 0, error: err.message };
  }
}

async function getProductMovements(productId, fromDate = null, toDate = null) {
  try {
    let query = sb.from('warehouse_transactions')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data } = await query;

    let running = 0;
    const movements = (data || []).map(m => {
      running += m.type === 'in' ? Number(m.quantity) : -Number(m.quantity);
      return { ...m, running_balance: running };
    });
    return { data: movements, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   23. التصدير العام
   ═══════════════════════════════════════════════════════════════ */

window.SB = {
  client: sb,
  // CRUD
  select: dbSelect,
  getById: dbGetById,
  insert: dbInsert,
  insertMany: dbInsertMany,
  update: dbUpdate,
  delete: dbDelete,
  count: dbCount,
  // Auth
  login: authLogin,
  logout: authLogout,
  getSession: authGetSession,
  getUser: authGetUser,
  getUserProfile,
  getUserPermissions,
  createUserAccount,
  // Audit
  logAudit,
  // Numbers
  generateInvoiceNumber,
  generateEntryNumber,
  generateReturnNumber,
  // Composite
  createSale,
  approveSale,
  approveWarehouseOrder,
  rejectWarehouseOrder,
  getPendingWarehouseOrders,
  createCustomerPayment,
  createSupplierPayment,
  stockOut,
  createReturn,
  approveReturn,
  approveExpense,
  createManualJournal,
  createReconciliation,
  createTransfer,
  // Balances
  getCashBalance,
  getBankBalance,
  getExtraBoxesBalance,
  getTotalTreasury,
  // Storage
  uploadAttachment,
  clearAllAttachments,
  // Realtime
  subscribeToTable,
  unsubscribeAll,
  // Data
  deleteAllData,
  // Helpers
  getDashboardKPIs,
  getCustomerStatement,
  getProductMovements
};

console.log('✅ supabase.js جاهز (محدّث - موافقة مزدوجة)');
