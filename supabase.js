/* ═══════════════════════════════════════════════════════════════
   نظام إدارة قسم الحبل - مصنع الصندل
   supabase.js - CRUD + Auth + Realtime + عمليات مركبة
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────── إعداد الاتصال ─────────────── */
const SUPABASE_URL = 'https://xejrpjunlgbwkfrklmha.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlanJwanVubGdid2tmcmtsbWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDY5OTcsImV4cCI6MjEwNDg4Mjk5N30.iFSQDLEVlAV_-sXhPGdo15Li3vGECoFrinWI6OVGRj4';
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
   4م. أدوات الحماية المالية (جديدة)
   ═══════════════════════════════════════════════════════════════ */

const VALID_PAYMENT_TYPES = ['cash', 'bank', 'extra_box'];

/** إدراج إلزامي: يرمي خطأ بدل تجاهل الفشل بصمت */
async function mustInsert(table, payload) {
  const { data, error } = await sb.from(table).insert(payload).select().maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

/**
 * ✅ حفظ بنود القيد مع ضمان التوازن.
 * إذا فشل الحفظ أو كان القيد غير متوازن/فارغ، يُحذف رأس القيد الذي
 * أُنشئ للتو حتى لا يتراكم قيود فارغة أو غير متوازنة في دفتر الأستاذ.
 */
async function commitJournalLines(entry, lines) {
  if (!entry || !entry.id) throw new Error('تعذّر إنشاء رأس القيد');

  const cleanup = async (msg) => {
    try { await sb.from('journal_entries').delete().eq('id', entry.id); } catch {}
    throw new Error(msg);
  };

  if (!Array.isArray(lines) || lines.length === 0) {
    await cleanup('القيد لم يُنشأ: حسابات مطلوبة غير موجودة في دليل الحسابات');
  }

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    await cleanup(`القيد غير متوازن: مدين ${totalDebit} ≠ دائن ${totalCredit}`);
  }

  const { error } = await sb.from('journal_lines').insert(lines);
  if (error) await cleanup('فشل حفظ بنود القيد: ' + error.message);

  return true;
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
      date: localISO(),
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

    // ✅ قيد تكلفة المبيعات (COGS) — بموافقة محاسبية صريحة (2026-10-15):
    //    مدين 5100 تكلفة المبيعات / دائن 1400 المخزون
    //    القيمة = التكلفة المجمَّدة عند البيع إن توفّرت، وإلا تكلفة المنتج الحالية.
    let cogsAmount = 0;
    try {
      cogsAmount = await getCostOfSales([sale.id], { warehouseOnly: true });
    } catch (cogsErr) {
      console.error('🛑 حساب تكلفة المبيعات فشل:', cogsErr.message);
    }

    if (cogsAmount > 0) {
      const cogsAcc = findAcc('5100');
      const invAcc = findAcc('1400');
      if (cogsAcc && invAcc) {
        lines.push({ entry_id: entry.id, account_id: cogsAcc.id, debit: cogsAmount, credit: 0, description: 'تكلفة المبيعات' });
        lines.push({ entry_id: entry.id, account_id: invAcc.id, debit: 0, credit: cogsAmount, description: 'صرف مخزون - تكلفة المبيعات' });
      } else {
        console.error('🛑 لم يُسجَّل قيد التكلفة: الحساب 5100 (تكلفة المبيعات) و/أو 1400 (المخزون) غير موجود — راجع دليل الحسابات');
      }
    }

    await commitJournalLines(entry, lines);
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
      date: localISO(),
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

    await commitJournalLines(entry, lines);
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
      date: localISO(),
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

    await commitJournalLines(entry, lines);
  } catch (err) {
    console.warn('⚠️ فشل قيد السداد:', err.message);
  }
}

/* ✅ قيد الدفعة المقدمة */
async function autoJournalForCustomerAdvancePayment(payment, customer) {
  try {
    const { user } = await authGetUser();
    if (!user) return;

    const entryNumber = await generateEntryNumber();
    const { data: entry } = await sb.from('journal_entries').insert({
      entry_number: entryNumber,
      date: localISO(),
      description: `دفعة مقدمة من العميل ${customer.name}`,
      ref_type: 'customer_advance_payment',
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

    // مدين: الخزنة (دخلت فلوس)
    if (payment.payment_type === 'cash' && cashAcc) {
      lines.push({ entry_id: entry.id, account_id: cashAcc.id, debit: payment.amount, credit: 0, description: 'استلام كاش' });
    } else if (payment.payment_type === 'bank' && bankAcc) {
      lines.push({ entry_id: entry.id, account_id: bankAcc.id, debit: payment.amount, credit: 0, description: 'استلام بنك' });
    } else if (payment.payment_type === 'extra_box' && extraAcc) {
      lines.push({ entry_id: entry.id, account_id: extraAcc.id, debit: payment.amount, credit: 0, description: 'استلام خزنة أخرى' });
    }

    // دائن: العميل (رصيده دائن)
    if (custAcc) {
      lines.push({ entry_id: entry.id, account_id: custAcc.id, debit: 0, credit: payment.amount, description: 'دفعة مقدمة من العميل' });
    }

    await commitJournalLines(entry, lines);
  } catch (err) {
    console.warn('⚠️ فشل قيد الدفعة المقدمة:', err.message);
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

    // ✅ انتقال ذري (CAS): يمنع اعتماد الفاتورة مرتين عند تزامن طلبين،
    //    وكان قراءة-ثم-تعديلاً فقط في النسخة القديمة (تضاعف خصم المخزون).
    const { data: claimed, error: clErr } = await sb.from('sales')
      .update({ status: 'approved', warehouse_approved: true })
      .eq('id', saleId)
      .in('status', ['pending', 'awaiting_warehouse'])
      .select('id');
    if (clErr) throw clErr;
    if (!claimed || claimed.length === 0) throw new Error('الفاتورة معتمدة مسبقاً');

    const undo = [];   // سجل عمليات التراجع عند فشل أي خطوة
    let items = [];

    try {
      const { data: saleItems, error: iErr } = await sb.from('sale_items').select('*').eq('sale_id', saleId);
      if (iErr) throw iErr;
      items = saleItems;

      for (const item of items) {
        if (item.source_type !== 'warehouse') continue;

        const { data: product, error: pErr } = await sb.from('products').select('*').eq('id', item.product_id).single();
        if (pErr) throw pErr;
        if (!product) throw new Error('منتج الفاتورة غير موجود');
        if (Number(product.quantity) < Number(item.quantity)) {
          throw new Error(`الكمية المتاحة من "${product.name}" غير كافية (المتاح: ${product.quantity})`);
        }

        // ✅ تحديث بشروط (CAS) حتى لا يُخصم مرتين عند تزامن عمليتين
        const { data: upd, error: uErr } = await sb.from('products')
          .update({ quantity: Number(product.quantity) - Number(item.quantity) })
          .eq('id', product.id)
          .eq('quantity', product.quantity)
          .select('id');
        if (uErr) throw uErr;
        if (!upd || upd.length === 0) {
          throw new Error(`تعذّر خصم كمية "${product.name}" (تغيّرت الكمية أثناء العملية) — أعد المحاولة`);
        }
        undo.push(async () => {
          await sb.from('products').update({ quantity: Number(product.quantity) }).eq('id', product.id);
        });

        const { data: mov, error: mErr } = await sb.from('warehouse_transactions').insert({
          product_id: product.id,
          type: 'out',
          quantity: item.quantity,
          reason: `فاتورة مبيعات ${sale.invoice_number}`,
          ref_id: sale.id,
          user_id: user.id
        }).select('id');
        if (mErr) throw new Error('تعذّر تسجيل حركة المخزن: ' + mErr.message);
        undo.push(async () => { await sb.from('warehouse_transactions').delete().eq('id', mov.id); });
      }

      if (sale.paid_cash > 0) {
        const { data: tx, error: tErr } = await sb.from('cash_transactions').insert({
          type: 'in',
          amount: sale.paid_cash,
          description: `مبيعات كاش - فاتورة ${sale.invoice_number}`,
          ref_id: sale.id,
          user_id: user.id
        }).select('id');
        if (tErr) throw new Error('تعذّر تسجيل حركة الصندوق: ' + tErr.message);
        undo.push(async () => { await sb.from('cash_transactions').delete().eq('id', tx.id); });
      }
      if (sale.paid_bank > 0) {
        const { data: tx, error: tErr } = await sb.from('bank_transactions').insert({
          type: 'in',
          amount: sale.paid_bank,
          description: `مبيعات بنك - فاتورة ${sale.invoice_number}`,
          ref_id: sale.id,
          user_id: user.id
        }).select('id');
        if (tErr) throw new Error('تعذّر تسجيل حركة البنك: ' + tErr.message);
        undo.push(async () => { await sb.from('bank_transactions').delete().eq('id', tx.id); });
      }

      // ✅ دين العميل (مع مراعاة الدفعات المقدمة)
      if (sale.remaining > 0 && sale.customer_id) {
        const { data: customer, error: cuErr } = await sb.from('customers').select('*').eq('id', sale.customer_id).single();
        if (cuErr) throw cuErr;
        if (customer) {
          const prevBalance = Number(customer.balance || 0);
          const { data: updC, error: bErr } = await sb.from('customers')
            .update({ balance: prevBalance + Number(sale.remaining) })
            .eq('id', customer.id)
            .eq('balance', customer.balance)
            .select('id');
          if (bErr) throw bErr;
          if (!updC || updC.length === 0) {
            throw new Error('تعذّر تحديث رصيد العميل (تغيّر الرصيد أثناء العملية)');
          }
          undo.push(async () => {
            await sb.from('customers').update({ balance: prevBalance }).eq('id', customer.id);
          });
        }
      }
    } catch (sideErr) {
      // تراجع كامل: إعادة الكمية والحركات والأرصدة ثم إعادة الحالة السابقة
      for (let i = undo.length - 1; i >= 0; i--) {
        try { await undo[i](); } catch (undoErr) { console.error('⚠️ فشل التراجع:', undoErr.message); }
      }
      await sb.from('sales')
        .update({ status: sale.status, warehouse_approved: sale.warehouse_approved })
        .eq('id', saleId);
      console.error('❌ approveSale (تم التراجع):', sideErr.message);
      return { error: sideErr.message };
    }

    await autoJournalForSale(sale, items || []);

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
   10. سداد العملاء (دفعة دين)
   ═══════════════════════════════════════════════════════════════ */

async function createCustomerPayment(customerId, amount, paymentType, options = {}) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    // ✅ تحقّق من المبلغ وطريقة الاستلام قبل أي عملية مالية
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('المبلغ غير صحيح');
    if (!VALID_PAYMENT_TYPES.includes(paymentType)) throw new Error('طريقة الاستلام غير مدعومة');
    if (paymentType === 'extra_box' && !options.extra_box_id) throw new Error('الرجاء اختيار الخزنة');

    const { data: customer, error: cErr } = await sb.from('customers').select('*').eq('id', customerId).single();
    if (cErr) throw cErr;

    const owed = Number(customer.balance || 0);
    if (amt > owed) {
      throw new Error(`المبلغ (${amt}) أكبر من الدين (${owed})`);
    }

    const { data: payment, error: pErr } = await sb.from('customer_payments').insert({
      customer_id: customerId,
      amount: amt,
      payment_type: paymentType,
      extra_box_id: options.extra_box_id || null,
      bank_ref: options.bank_ref || null,
      description: options.description || '',
      user_id: user.id
    }).select().single();
    if (pErr) throw pErr;

    // 1️⃣ رصيد العميل (الحقيقة المحاسبية الأساسية) — مع التحقق
    const { data: balRows, error: balErr } = await sb.from('customers')
      .update({ balance: owed - amt })
      .eq('id', customerId)
      .select('id');
    if (balErr || !balRows || balRows.length === 0) {
      await sb.from('customer_payments').delete().eq('id', payment.id);
      throw new Error('تعذّر تحديث رصيد العميل: ' + (balErr ? balErr.message : 'لا يوجد صف متأثر'));
    }

    // 2️⃣ حركة الخزنة — مع تراجع كامل إذا فشلت
    try {
      if (paymentType === 'cash') {
        await mustInsert('cash_transactions', {
          type: 'in', amount: amt,
          description: `سداد من العميل: ${customer.name}`,
          ref_id: payment.id, user_id: user.id
        });
      } else if (paymentType === 'bank') {
        await mustInsert('bank_transactions', {
          type: 'in', amount: amt,
          description: `سداد من العميل: ${customer.name}`,
          bank_ref: options.bank_ref || null,
          ref_id: payment.id, user_id: user.id
        });
      } else if (paymentType === 'extra_box') {
        await mustInsert('extra_cashbox_transactions', {
          cashbox_id: options.extra_box_id, type: 'in', amount: amt,
          description: `سداد من العميل: ${customer.name}`,
          ref_id: payment.id, user_id: user.id
        });
        const { data: box } = await sb.from('extra_cashboxes').select('*').eq('id', options.extra_box_id).single();
        if (box) {
          const { error: boxErr } = await sb.from('extra_cashboxes')
            .update({ balance: Number(box.balance || 0) + amt })
            .eq('id', box.id);
          if (boxErr) throw boxErr;
        }
      }
    } catch (treasuryErr) {
      await sb.from('customers').update({ balance: owed }).eq('id', customerId);
      await sb.from('customer_payments').delete().eq('id', payment.id);
      throw new Error('تعذّر تسجيل حركة الخزنة — تم التراجع الكامل عن العملية: ' + (treasuryErr.message || treasuryErr));
    }

    await autoJournalForCustomerPayment(payment, customer);
    await logAudit('create', 'customer_payments', payment.id, { customer_id: customerId, amount });

    return { data: payment, error: null };
  } catch (err) {
    console.error('❌ createCustomerPayment:', err.message);
    return { data: null, error: err.message };
  }
}

/* ✅ دفعة مقدمة من عميل */
async function createCustomerAdvancePayment(customerId, amount, paymentType, options = {}) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: customer, error: cErr } = await sb.from('customers').select('*').eq('id', customerId).single();
    if (cErr) throw cErr;

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) throw new Error('المبلغ غير صحيح');
    if (!VALID_PAYMENT_TYPES.includes(paymentType)) throw new Error('طريقة الاستلام غير مدعومة');
    if (paymentType === 'extra_box' && !options.extra_box_id) throw new Error('الرجاء اختيار الخزنة');

    const { data: payment, error: pErr } = await sb.from('customer_payments').insert({
      customer_id: customerId,
      amount: payAmount,
      payment_type: paymentType,
      extra_box_id: options.extra_box_id || null,
      bank_ref: options.bank_ref || null,
      description: `دفعة مقدمة من العميل: ${customer.name}${options.description ? ' - ' + options.description : ''}`,
      user_id: user.id
    }).select().single();
    if (pErr) throw pErr;

    if (paymentType === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'in',
        amount: payAmount,
        description: `دفعة مقدمة من العميل: ${customer.name}`,
        ref_id: payment.id,
        user_id: user.id
      });
    } else if (paymentType === 'bank') {
      await sb.from('bank_transactions').insert({
        type: 'in',
        amount: payAmount,
        description: `دفعة مقدمة من العميل: ${customer.name}`,
        bank_ref: options.bank_ref || null,
        ref_id: payment.id,
        user_id: user.id
      });
    } else if (paymentType === 'extra_box' && options.extra_box_id) {
      await sb.from('extra_cashbox_transactions').insert({
        cashbox_id: options.extra_box_id,
        type: 'in',
        amount: payAmount,
        description: `دفعة مقدمة من العميل: ${customer.name}`,
        ref_id: payment.id,
        user_id: user.id
      });
      const { data: box } = await sb.from('extra_cashboxes').select('*').eq('id', options.extra_box_id).single();
      if (box) {
        await sb.from('extra_cashboxes').update({ balance: Number(box.balance || 0) + payAmount }).eq('id', box.id);
      }
    }

    // ✅ رصيد العميل ينقص (يصبح سالب = دائن)
    await sb.from('customers').update({
      balance: Number(customer.balance || 0) - payAmount
    }).eq('id', customerId);

    await autoJournalForCustomerAdvancePayment(payment, customer);
    await logAudit('create', 'customer_payments', payment.id, {
      customer_id: customerId,
      amount: payAmount,
      type: 'advance_payment'
    });

    return { data: payment, error: null };
  } catch (err) {
    console.error('❌ createCustomerAdvancePayment:', err.message);
    return { data: null, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   ✅ سحب من رصيد العميل (Customer Withdrawal)
   ═══════════════════════════════════════════════════════════════ */

async function createCustomerWithdrawal(customerId, amount, paymentType, options = {}) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: customer, error: cErr } = await sb.from('customers')
      .select('*').eq('id', customerId).single();
    if (cErr) throw cErr;

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      throw new Error('المبلغ غير صحيح');
    }

        // ✅ التحقق: الرصيد المتاح (يقبل الموجب والسالب)
    const available = Math.abs(Number(customer.balance));
if (withdrawAmount > available) {
  throw new Error(`الرصيد المتاح ${available} فقط، لا يمكن سحب ${withdrawAmount}`);
}

    // 1️⃣ تسجيل السحب في customer_payments مع direction = 'out'
    const { data: payment, error: pErr } = await sb.from('customer_payments').insert({
      customer_id: customerId,
      amount: withdrawAmount,
      payment_type: paymentType,
      payment_direction: 'out',
      extra_box_id: options.extra_box_id || null,
      bank_ref: options.bank_ref || null,
      description: options.reason || 'سحب من الرصيد',
      user_id: user.id
    }).select().single();
    if (pErr) throw pErr;

    // 2️⃣ خصم من الخزنة (كاش/بنك/خزنة أخرى)
    if (paymentType === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'out',
        amount: withdrawAmount,
        description: `سحب من رصيد العميل: ${customer.name} - ${options.reason || ''}`,
        ref_id: payment.id,
        user_id: user.id
      });
    } else if (paymentType === 'bank') {
      await sb.from('bank_transactions').insert({
        type: 'out',
        amount: withdrawAmount,
        description: `سحب من رصيد العميل: ${customer.name} - ${options.reason || ''}`,
        bank_ref: options.bank_ref || null,
        ref_id: payment.id,
        user_id: user.id
      });
    } else if (paymentType === 'extra_box' && options.extra_box_id) {
      await sb.from('extra_cashbox_transactions').insert({
        cashbox_id: options.extra_box_id,
        type: 'out',
        amount: withdrawAmount,
        description: `سحب من رصيد العميل: ${customer.name}`,
        ref_id: payment.id,
        user_id: user.id
      });
      const { data: box } = await sb.from('extra_cashboxes').select('*').eq('id', options.extra_box_id).single();
      if (box) {
        await sb.from('extra_cashboxes').update({
          balance: Number(box.balance || 0) - withdrawAmount
        }).eq('id', box.id);
      }
    }

        // 3️⃣ تعديل رصيد العميل (يتعامل مع الموجب والسالب)
    const currentBal = Number(customer.balance || 0);
    const newBal = currentBal < 0 
      ? currentBal + withdrawAmount  // سالب: نرجعله فلوسه
      : currentBal - withdrawAmount; // موجب: نستلم منه
    await sb.from('customers').update({
      balance: newBal
    }).eq('id', customerId);

    // 4️⃣ قيد محاسبي
    await autoJournalForCustomerWithdrawal(payment, customer, options.reason);

    await logAudit('create', 'customer_payments', payment.id, {
      customer_id: customerId,
      amount: withdrawAmount,
      type: 'withdrawal',
      reason: options.reason
    });

    return { data: payment, error: null };
  } catch (err) {
    console.error('❌ createCustomerWithdrawal:', err.message);
    return { data: null, error: err.message };
  }
}

/* ✅ قيد محاسبي للسحب */
async function autoJournalForCustomerWithdrawal(payment, customer, reason) {
  try {
    const { user } = await authGetUser();
    if (!user) return;

    const entryNumber = await generateEntryNumber();
    const { data: entry } = await sb.from('journal_entries').insert({
      entry_number: entryNumber,
      date: localISO(),
      description: `سحب من رصيد العميل ${customer.name} - ${reason || ''}`,
      ref_type: 'customer_withdrawal',
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

    // مدين: العميل (رصيده يقل)
    if (custAcc) {
      lines.push({
        entry_id: entry.id, account_id: custAcc.id,
        debit: payment.amount, credit: 0,
        description: 'سحب من رصيد العميل'
      });
    }

    // دائن: الخزنة (نقصت)
    if (payment.payment_type === 'cash' && cashAcc) {
      lines.push({ entry_id: entry.id, account_id: cashAcc.id, debit: 0, credit: payment.amount, description: 'صرف كاش' });
    } else if (payment.payment_type === 'bank' && bankAcc) {
      lines.push({ entry_id: entry.id, account_id: bankAcc.id, debit: 0, credit: payment.amount, description: 'صرف بنك' });
    } else if (payment.payment_type === 'extra_box' && extraAcc) {
      lines.push({ entry_id: entry.id, account_id: extraAcc.id, debit: 0, credit: payment.amount, description: 'صرف خزنة أخرى' });
    }

    await commitJournalLines(entry, lines);
  } catch (err) {
    console.warn('⚠️ فشل قيد السحب:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ✅ خدمات العملاء (Customer Services)
   ═══════════════════════════════════════════════════════════════ */

async function createCustomerService(customerId, amount, serviceType, options = {}) {
  try {
    const { user } = await authGetUser();
    if (!user) throw new Error('يجب تسجيل الدخول');

    const { data: customer, error: cErr } = await sb.from('customers')
      .select('*').eq('id', customerId).single();
    if (cErr) throw cErr;

    const serviceAmount = Number(amount);
    if (!Number.isFinite(serviceAmount) || serviceAmount <= 0) {
      throw new Error('المبلغ غير صحيح');
    }
    if (!VALID_PAYMENT_TYPES.includes(cashboxType)) throw new Error('نوع الخزنة غير مدعوم');
    if (cashboxType === 'extra_box' && !cashboxId) throw new Error('الرجاء اختيار الخزنة');

    if (!serviceType || !serviceType.trim()) {
      throw new Error('نوع الخدمة مطلوب');
    }

    const cashboxType = options.cashbox_type || 'cash';
    const serviceDate = options.service_date || localISO();
    const notes = options.notes || '';
    const cashboxId = options.cashbox_id || null;

    // ✅ حفظ الرصيد قبل التعديل
    const balanceBefore = Number(customer.balance || 0);
    
    // ✅ حساب الرصيد بعد التعديل
    // القاعدة: في الحالتين، balance + amount
    // (موجب: دينه يزيد) - (سالب: رصيده لنا يقل)
    const balanceAfter = balanceBefore + serviceAmount;

    // 1️⃣ تسجيل الخدمة في customer_services
    const { data: service, error: sErr } = await sb.from('customer_services').insert({
      customer_id: customerId,
      amount: serviceAmount,
      service_type: serviceType.trim(),
      cashbox_type: cashboxType,
      cashbox_id: cashboxId,
      service_date: serviceDate,
      notes: notes,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      user_id: user.id
    }).select().single();
    if (sErr) throw sErr;

    // 2️⃣ خصم من الخزنة
    if (cashboxType === 'cash') {
      await sb.from('cash_transactions').insert({
        type: 'out',
        amount: serviceAmount,
        description: `خدمة: ${serviceType.trim()} - ${customer.name}`,
        ref_id: service.id,
        user_id: user.id
      });
    } else if (cashboxType === 'bank') {
      await sb.from('bank_transactions').insert({
        type: 'out',
        amount: serviceAmount,
        description: `خدمة: ${serviceType.trim()} - ${customer.name}`,
        ref_id: service.id,
        user_id: user.id
      });
    } else if (cashboxType === 'extra_box' && cashboxId) {
      await sb.from('extra_cashbox_transactions').insert({
        cashbox_id: cashboxId,
        type: 'out',
        amount: serviceAmount,
        description: `خدمة: ${serviceType.trim()} - ${customer.name}`,
        ref_id: service.id,
        user_id: user.id
      });
      const { data: box } = await sb.from('extra_cashboxes').select('*').eq('id', cashboxId).single();
      if (box) {
        await sb.from('extra_cashboxes').update({
          balance: Number(box.balance || 0) - serviceAmount
        }).eq('id', cashboxId);
      }
    }

    // 3️⃣ تحديث رصيد العميل
    await sb.from('customers').update({
      balance: balanceAfter
    }).eq('id', customerId);

    // 4️⃣ القيد المحاسبي
    await autoJournalForService(service, customer, serviceType);

    // 5️⃣ تسجيل في Audit Log
    await logAudit('create', 'customer_services', service.id, {
      customer_id: customerId,
      amount: serviceAmount,
      service_type: serviceType,
      cashbox_type: cashboxType
    });

    return { data: service, error: null };
  } catch (err) {
    console.error('❌ createCustomerService:', err.message);
    return { data: null, error: err.message };
  }
}

/* ✅ القيد المحاسبي للخدمة */
async function autoJournalForService(service, customer, serviceType) {
  try {
    const { user } = await authGetUser();
    if (!user) return;

    const entryNumber = await generateEntryNumber();
    const { data: entry } = await sb.from('journal_entries').insert({
      entry_number: entryNumber,
      date: service.service_date || localISO(),
      description: `خدمة ${serviceType} - ${customer.name}`,
      ref_type: 'customer_service',
      ref_id: service.id,
      created_by: user.id
    }).select().single();

    const { data: accounts } = await sb.from('accounts').select('*');
    const findAcc = (code) => accounts?.find(a => a.code === code);

    const cashAcc = findAcc('1100');
    const bankAcc = findAcc('1200');
    const extraAcc = findAcc('1500');
    const custAcc = findAcc('1300');
    const revenueAcc = findAcc('4100');

    const lines = [];

    // مدين: العميل (رصيده يزيد - سلباً أو إيجاباً)
    if (custAcc) {
      lines.push({
        entry_id: entry.id,
        account_id: custAcc.id,
        debit: service.amount,
        credit: 0,
        description: `خدمة ${serviceType}`
      });
    }

    // دائن: الخزنة
    if (service.cashbox_type === 'cash' && cashAcc) {
      lines.push({ entry_id: entry.id, account_id: cashAcc.id, debit: 0, credit: service.amount, description: 'صرف كاش' });
    } else if (service.cashbox_type === 'bank' && bankAcc) {
      lines.push({ entry_id: entry.id, account_id: bankAcc.id, debit: 0, credit: service.amount, description: 'صرف بنك' });
    } else if (service.cashbox_type === 'extra_box' && extraAcc) {
      lines.push({ entry_id: entry.id, account_id: extraAcc.id, debit: 0, credit: service.amount, description: 'صرف خزنة أخرى' });
    }

    await commitJournalLines(entry, lines);
  } catch (err) {
    console.warn('⚠️ فشل قيد الخدمة:', err.message);
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

    // ✅ تحقّق من المبلغ وطريقة السداد
    const supAmt = Number(amount);
    if (!Number.isFinite(supAmt) || supAmt <= 0) throw new Error('المبلغ غير صحيح');
    if (!VALID_PAYMENT_TYPES.includes(paymentType)) throw new Error('طريقة السداد غير مدعومة');
    if (paymentType === 'extra_box' && !options.extra_box_id) throw new Error('الرجاء اختيار الخزنة');

    if (supAmt > Number(supplier.balance || 0)) {
      throw new Error(`المبلغ (${supAmt}) أكبر من المستحق (${Number(supplier.balance || 0)})`);
    }

    const { data: payment, error: pErr } = await sb.from('supplier_payments').insert({
      supplier_id: supplierId,
      amount: supAmt,
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

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من 0');
    if (Number(product.quantity) < qty) {
      throw new Error(`الكمية المتاحة ${product.quantity} فقط`);
    }

    // ✅ نسجّل السجلين أولاً ثم نعدّل الكمية أخيراً (مع تراجع عند الفشل)
    // ✅ B-08: لا تُستبدل فئة الصرف بالملاحظات — الفئة أولاً ثم الملاحظة (كانت الفئة تختفي)
    const movReason = options.notes ? `${reason} - ${options.notes}` : reason;
    const { data: movRow, error: movErr } = await sb.from('warehouse_transactions').insert({
      product_id: productId,
      type: 'out',
      quantity: qty,
      reason: movReason,
      user_id: user.id
    }).select().single();
    if (movErr) throw new Error('تعذّر تسجيل حركة المخزن: ' + movErr.message);

    const { data: logRow, error: logErr } = await sb.from('stock_out_log').insert({
      product_id: productId,
      quantity: qty,
      reason,
      destination_type: options.destination_type || 'other',
      destination_id: options.destination_id || null,
      destination_name: options.destination_name || '',
      notes: options.notes || '',
      user_id: user.id
    }).select().single();
    if (logErr) {
      await sb.from('warehouse_transactions').delete().eq('id', movRow.id);
      throw new Error('تعذّر تسجيل سجل الإخراج: ' + logErr.message);
    }

    const { data: upd, error: updErr } = await sb.from('products')
      .update({ quantity: Number(product.quantity) - qty })
      .eq('id', productId)
      .eq('quantity', product.quantity)
      .select('id');
    if (updErr || !upd || upd.length === 0) {
      await sb.from('stock_out_log').delete().eq('id', logRow.id);
      await sb.from('warehouse_transactions').delete().eq('id', movRow.id);
      throw new Error(updErr ? 'تعذّر تحديث كمية المنتج: ' + updErr.message
        : 'تعذّر تحديث كمية المنتج (تغيّرت الكمية أثناء العملية)');
    }

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
    if (!Array.isArray(items) || items.length === 0) throw new Error('يجب اختيار منتج واحد على الأقل');
    if (!Number.isFinite(total) || total < 0) throw new Error('قيمة المرتجع غير صحيحة');
    if (items.some(it => !Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0)) {
      throw new Error('كمية المرتجع يجب أن تكون أكبر من 0');
    }
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
    const { error: itErr } = await sb.from('return_items').insert(itemsPayload);
    if (itErr) {
      // تراجع حتى لا يبقى مرتجع بلا بنود
      await sb.from('returns').delete().eq('id', ret.id);
      throw new Error('تعذّر حفظ بنود المرتجع: ' + itErr.message);
    }

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

    // ✅ انتقال ذري pending → approved: يمنع اعتماد المرتجع مرتين عند تزامن طلبين
    const { data: claimed, error: cErr } = await sb
      .from('returns')
      .update({ status: 'approved' })
      .eq('id', returnId)
      .eq('status', 'pending')
      .select('id');
    if (cErr) throw cErr;
    if (!claimed || claimed.length === 0) throw new Error('المرتجع معتمد مسبقاً');

    // إذا فشلت أي خطوة يتم التراجع عن الحالة حتى لا يتكرر أثر مالي/مخزني
    try {
      const { data: items, error: iErr } = await sb.from('return_items').select('*').eq('return_id', returnId);
      if (iErr) throw iErr;

      for (const item of items || []) {
        const { data: product, error: prErr } = await sb.from('products').select('*').eq('id', item.product_id).single();
        if (prErr) throw prErr;
        if (!product) throw new Error('منتج المرتجع غير موجود');

        // ✅ استُردت هذه البنود مسبقاً؟ (حماية من التكرار)
        const { data: done } = await sb.from('warehouse_transactions')
          .select('id').eq('ref_id', ret.id).eq('product_id', product.id).eq('type', 'in');
        if (done && done.length > 0) continue;

        const newQty = Number(product.quantity) + Number(item.quantity);
        const { data: upd, error: qErr } = await sb.from('products')
          .update({ quantity: newQty })
          .eq('id', product.id)
          .eq('quantity', product.quantity)
          .select('id');
        if (qErr) throw qErr;
        if (!upd || upd.length === 0) {
          throw new Error(`تعذّر تحديث كمية المنتج ${product.name} (تغيّرت الكمية أثناء العملية)`);
        }

        const { error: wErr } = await sb.from('warehouse_transactions').insert({
          product_id: product.id,
          type: 'in',
          quantity: item.quantity,
          reason: `مرتجع - ${ret.return_number}`,
          ref_id: ret.id,
          user_id: user.id
        });
        if (wErr) throw new Error('تعذّر تسجيل حركة المخزن: ' + wErr.message);
      }

      if (ret.refund_type === 'cash') {
        const { data: done } = await sb.from('cash_transactions').select('id').eq('ref_id', ret.id).eq('type', 'out');
        if (!done || done.length === 0) {
          await mustInsert('cash_transactions', {
            type: 'out', amount: ret.total,
            description: `مرتجع كاش - ${ret.return_number}`,
            ref_id: ret.id, user_id: user.id
          });
        }
      } else if (ret.refund_type === 'bank') {
        const { data: done } = await sb.from('bank_transactions').select('id').eq('ref_id', ret.id).eq('type', 'out');
        if (!done || done.length === 0) {
          await mustInsert('bank_transactions', {
            type: 'out', amount: ret.total,
            description: `مرتجع بنك - ${ret.return_number}`,
            ref_id: ret.id, user_id: user.id
          });
        }
      } else if (ret.refund_type === 'customer_credit' && ret.customer_id) {
        // آخر خطوة: تعديل رصيد العميل (لا تكرار لأن الحالة انتقلت للتو approved)
        const { data: customer, error: cuErr } = await sb.from('customers').select('*').eq('id', ret.customer_id).single();
        if (cuErr) throw cuErr;
        if (customer) {
          const { data: updC, error: be } = await sb.from('customers')
            .update({ balance: Number(customer.balance || 0) - Number(ret.total) })
            .eq('id', ret.customer_id)
            .eq('balance', customer.balance)
            .select('id');
          if (be) throw be;
          if (!updC || updC.length === 0) throw new Error('تعذّر تحديث رصيد العميل (تغيّر الرصيد أثناء العملية)');
        }
      }
    } catch (sideErr) {
      // تراجع: إعادة الحالة pending حتى لا يبقى المرتجع "معتمداً" بلا أثره
      try {
        await sb.from('returns').update({ status: 'pending' }).eq('id', returnId).eq('status', 'approved');
      } catch {}
      throw sideErr;
    }

    await logAudit('approve', 'returns', ret.id, { return_number: ret.return_number });
    return { error: null };
  } catch (err) {
    console.error('❌ approveReturn:', err.message);
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
      date: entryData.date || localISO(),
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

    await commitJournalLines(entry, linesPayload);
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
        date: localISO(),
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
      try {
        await commitJournalLines(entry, lines);
      } catch (jErr) {
        // التسوية محفوظة أصلاً — نُسجّل المشكلة ولا نُفشل العملية
        console.error('🛑 قيد التسوية:', jErr.message);
      }
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
    const bucket = sb.storage.from('attachments');
    let removed = 0;

    // ✅ حذف متكرر: الملفات محفوظة داخل مجلدات (folder/name)، و list() بدون
    //    صعود للمجلدات كان يترك الملفات داخلها كما هي.
    const walk = async (prefix) => {
      let offset = 0;
      for (;;) {
        const { data, error } = await bucket.list(prefix, { limit: 100, offset });
        if (error) throw error;
        if (!data || data.length === 0) return;

        const folders = data.filter(e => !e.id).map(e => (e.name.endsWith('/') ? e.name : e.name + '/'));
        const files = data.filter(e => e.id).map(e => prefix + e.name);

        if (files.length > 0) {
          const { error: rErr } = await bucket.remove(files);
          if (rErr) throw rErr;
          removed += files.length;
        }

        for (const folder of folders) await walk(folder);
        if (data.length < 100) return;
        offset += 100;
      }
    };

    await walk('');
    return { error: null, removed };
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
    'journal_lines', 'journal_entries',
    'sale_payments', 'sale_items', 'return_items', 'purchase_items',
    'warehouse_transactions', 'extra_cashbox_transactions',
    'customer_payments', 'supplier_payments', 'stock_out_log',
    'permissions',
    'returns', 'sales', 'purchases', 'expenses',
    'cash_transactions', 'bank_transactions', 'transfers', 'reconciliations',
    'extra_cashboxes', 'external_locations',
    'products', 'customers', 'suppliers', 'accounts',
    'audit_logs'
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
    const monthStart = localISO(new Date(now.getFullYear(), now.getMonth(), 1));

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

/* ✅ كشف حساب العميل — يدعم السداد + المقدم */
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
      remaining: s.remaining,
      isAdvance: false
    }));

    (payments || []).forEach(p => {
      // ✅ التمييز: هل هي دفعة مقدمة أم سداد؟ وهل هي سحب (out) أم استلام (in)؟
      const isAdvancePayment = (p.description || '').includes('دفعة مقدمة');
      const isWithdrawal = p.payment_direction === 'out';

      all.push({
        type: isAdvancePayment ? 'advance_payment' : 'payment',
        date: p.created_at,
        ref: isWithdrawal ? 'سحب' : (isAdvancePayment ? 'مقدم' : 'سداد'),
        amount: 0,
        paid: p.amount,
        remaining: 0,
        isAdvance: false,
        isWithdrawal
      });
    });

    all.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    const statement = all.map(x => {
      if (x.type === 'sale') {
        balance += Number(x.remaining);
      } else if (x.isWithdrawal) {
        // ✅ سحب من رصيد العميل يزيد ذمته (عكس السداد)
        balance += Number(x.paid);
      } else {
        // سداد أو مقدم → كلاهما ينقص الرصيد
        balance -= Number(x.paid);
      }
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
   22.5 حساب تكلفة المبيعات — استعلام واحد بدل N+1
   ═══════════════════════════════════════════════════════════════ */

/**
 * ✅ هل يوجد العمود sale_items.cost_price (التكلفة المجمّدة عند البيع)؟
 * يُفحص مرة واحدة ويُحفظ النتيجة، حتى لا تنكسر التقارير إذا لم تُطبَّق الهجرة بعد.
 */
let _hasFrozenCost = null;
async function hasFrozenCostColumn() {
  if (_hasFrozenCost !== null) return _hasFrozenCost;
  try {
    const { error } = await sb.from('sale_items').select('cost_price').limit(0);
    _hasFrozenCost = !error;
  } catch { _hasFrozenCost = false; }
  return _hasFrozenCost;
}

/**
 * ✅ تكلفة المبيعات لقائمة فواتير — تُحلّ في استعلامات مُجمَّعة (chunks)
 *    بدل الاستعلام لكل فاتورة (كان N+1: 500 فاتورة = 500 طلب).
 *
 * القاعدة المحاسبية المتفق عليها:
 *   تُستخدم التكلفة المجمَّدة عند البيع (sale_items.cost_price) إن وُجدت،
 *   وإلا تُرجع آمنًا إلى products.cost_price (السلوك القديم).
 *
 * @param {string[]} saleIds
 * @param {{warehouseOnly?: boolean}} [opts] warehouseOnly=true يستبعد بنود
 *        مصدرها خارجي (لا تُخصم من المخزون) — يُستخدم في قيد COGS.
 * @returns {Promise<number>}
 */
async function getCostOfSales(saleIds, opts = {}) {
  if (!Array.isArray(saleIds) || saleIds.length === 0) return 0;

  const useFrozen = await hasFrozenCostColumn();
  const select = useFrozen
    ? 'quantity, sale_id, cost_price, source_type, products(cost_price)'
    : 'quantity, sale_id, source_type, products(cost_price)';

  let total = 0;
  const CHUNK = 200;
  for (let i = 0; i < saleIds.length; i += CHUNK) {
    const chunk = saleIds.slice(i, i + CHUNK);
    const { data, error } = await dbSelect('sale_items', {
      select,
      in: { sale_id: chunk }
    });
    if (error) {
      console.error('❌ getCostOfSales:', error);
      throw new Error(error);
    }
    (data || []).forEach(it => {
      if (opts.warehouseOnly && it.source_type && it.source_type !== 'warehouse') return;
      const frozen = useFrozen && it.cost_price !== null && it.cost_price !== undefined;
      const unitCost = frozen ? Number(it.cost_price) : Number(it.products?.cost_price || 0);
      total += unitCost * Number(it.quantity || 0);
    });
  }
  return total;
}

/* ═══════════════════════════════════════════════════════════════
   22.6 قراءة كاملة لجدول — تتجاوز حد max-rows في PostgREST
   ═══════════════════════════════════════════════════════════════ */

/**
 * ✅ يقرأ الجدول كاملاً عبر صفحات، ويخبرك صراحةً إذا كانت القراءة ناقصة.
 * الاستعلام العادي بدون limit يُقتطع عند إعداد max-rows في المشروع
 * (عادة 1000 صف) دون أي رسالة خطأ — وهذا ما جعل النسخ الاحتياطي القديم
 * يُبلّغ عن نجاح وهو ناقص.
 *
 * @returns {Promise<{data: Array, complete: boolean, error: string|null}>}
 */
async function selectAll(table, options = {}) {
  const pageSize = Math.min(Number(options.page_size) || 1000, 1000);
  const rows = [];
  let from = 0;
  const MAX_ROWS = 500000;

  try {
    for (;;) {
      const { data, error } = await dbSelect(table, {
        ...options,
        range: { from, to: from + pageSize - 1 }
      });
      if (error) return { data: rows, complete: false, error };

      const batch = data || [];
      rows.push(...batch);

      if (batch.length < pageSize) return { data: rows, complete: true, error: null };
      if (rows.length >= MAX_ROWS) {
        return { data: rows, complete: false, error: `تجاوز الحد الأقصى (${MAX_ROWS})` };
      }
      from += pageSize;
    }
  } catch (err) {
    return { data: rows, complete: false, error: err.message || String(err) };
  }
}

/* ═══════════════════════════════════════════════════════════════
   23. التصدير العام
   ═══════════════════════════════════════════════════════════════ */

window.SB = {
  client: sb,
  select: dbSelect,
  getById: dbGetById,
  insert: dbInsert,
  insertMany: dbInsertMany,
  update: dbUpdate,
  delete: dbDelete,
  count: dbCount,
  login: authLogin,
  logout: authLogout,
  getSession: authGetSession,
  getUser: authGetUser,
  getUserProfile,
  getUserPermissions,
  createUserAccount,
  logAudit,
  generateInvoiceNumber,
  generateEntryNumber,
  generateReturnNumber,
  createSale,
  approveSale,
  approveWarehouseOrder,
  rejectWarehouseOrder,
  getPendingWarehouseOrders,
  createCustomerPayment,
  createCustomerAdvancePayment,  // ✅ جديد
    createCustomerWithdrawal,  // ✅ سحب من رصيد العميل
      createCustomerService,
  createSupplierPayment,
  stockOut,
  createReturn,
  approveReturn,
  approveExpense,
  createManualJournal,
  createReconciliation,
  createTransfer,
  getCashBalance,
  getBankBalance,
  getExtraBoxesBalance,
  getTotalTreasury,
  uploadAttachment,
  clearAllAttachments,
  subscribeToTable,
  unsubscribeAll,
  deleteAllData,
  getDashboardKPIs,
  getCustomerStatement,
  getProductMovements,
  getCostOfSales,
  selectAll,
  hasFrozenCostColumn
};

console.log('✅ supabase.js جاهز (محدّث - دفعة مقدمة)');
