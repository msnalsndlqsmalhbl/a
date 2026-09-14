-- ═══════════════════════════════════════════════════════════════
-- نظام إدارة قسم الحبل - مصنع الصندل للأوعية البلاستيكية
-- SQL Schema الكامل - يُنفذ مرة واحدة في SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─────────────── 1. تفعيل UUID Extension ───────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
-- 2. جدول المستخدمين والأدوار والصلاحيات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_add BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module)
);

-- ═══════════════════════════════════════════════════════════════
-- 3. الإعدادات العامة
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 4. المخزن (المنتجات)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT,
  unit TEXT DEFAULT 'قطعة',
  quantity NUMERIC(15,2) DEFAULT 0,
  min_quantity NUMERIC(15,2) DEFAULT 0,
  cost_price NUMERIC(15,2) DEFAULT 0,
  sale_price NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out','adjust')),
  quantity NUMERIC(15,2) NOT NULL,
  reason TEXT,
  ref_id UUID,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 5. العملاء والموردين
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  tax_number TEXT,
  balance NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  tax_number TEXT,
  balance NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 6. المبيعات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  total NUMERIC(15,2) DEFAULT 0,
  paid_cash NUMERIC(15,2) DEFAULT 0,
  paid_bank NUMERIC(15,2) DEFAULT 0,
  remaining NUMERIC(15,2) DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('cash','bank','mixed','credit')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','cancelled')),
  notes TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity NUMERIC(15,2) NOT NULL,
  price NUMERIC(15,2) NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT CHECK (method IN ('cash','bank')),
  amount NUMERIC(15,2) NOT NULL,
  bank_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 7. المشتريات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id),
  total NUMERIC(15,2) DEFAULT 0,
  paid NUMERIC(15,2) DEFAULT 0,
  remaining NUMERIC(15,2) DEFAULT 0,
  payment_method TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity NUMERIC(15,2) NOT NULL,
  price NUMERIC(15,2) NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- 8. المرتجعات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id),
  customer_id UUID REFERENCES customers(id),
  total NUMERIC(15,2) DEFAULT 0,
  refund_method TEXT,
  reason TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity NUMERIC(15,2) NOT NULL,
  price NUMERIC(15,2) NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- 9. المصروفات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  type TEXT CHECK (type IN ('operational','non_operational')),
  description TEXT,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash','bank')),
  cashbox_type TEXT CHECK (cashbox_type IN ('cash','bank')),
  attachment_url TEXT,
  user_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 10. الخزائن والبنوك والتحويلات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT CHECK (type IN ('in','out')),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  ref_id UUID,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT CHECK (type IN ('in','out')),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  bank_ref TEXT,
  ref_id UUID,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_type TEXT CHECK (from_type IN ('cash','bank')),
  to_type TEXT CHECK (to_type IN ('cash','bank')),
  to_name TEXT,
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 11. القيود المحاسبية
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number TEXT UNIQUE,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  ref_type TEXT,
  ref_id UUID,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  description TEXT
);

-- ═══════════════════════════════════════════════════════════════
-- 12. التسويات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT CHECK (type IN ('cash','bank')),
  expected NUMERIC(15,2) NOT NULL,
  actual NUMERIC(15,2) NOT NULL,
  difference NUMERIC(15,2) NOT NULL,
  reason TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 13. سجل التدقيق
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 14. الفهارس (Indexes)
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_wh_trans_product ON warehouse_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_wh_trans_created ON warehouse_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_cash_trans_created ON cash_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_trans_created ON bank_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC);

-- ═══════════════════════════════════════════════════════════════
-- 15. البيانات الافتراضية
-- ═══════════════════════════════════════════════════════════════

-- الأدوار
INSERT INTO roles (name, name_ar, description) VALUES
  ('admin', 'مدير النظام', 'صلاحيات كاملة على جميع الوحدات'),
  ('manager', 'مدير', 'إدارة العمليات والتقارير'),
  ('accountant', 'محاسب', 'القيود والتقارير المالية'),
  ('cashier', 'كاشير', 'المبيعات والخزنة'),
  ('viewer', 'مشاهد', 'عرض فقط')
ON CONFLICT (name) DO NOTHING;

-- دليل الحسابات الأساسي
INSERT INTO accounts (code, name, type) VALUES
  ('1000', 'الأصول', 'asset'),
  ('1100', 'الصندوق (كاش)', 'asset'),
  ('1200', 'البنك', 'asset'),
  ('1300', 'العملاء (المدينون)', 'asset'),
  ('1400', 'المخزون', 'asset'),
  ('2000', 'الخصوم', 'liability'),
  ('2100', 'الموردون (الدائنون)', 'liability'),
  ('3000', 'حقوق الملكية', 'equity'),
  ('3100', 'رأس المال', 'equity'),
  ('3200', 'الأرباح المحتجزة', 'equity'),
  ('4000', 'الإيرادات', 'revenue'),
  ('4100', 'إيرادات المبيعات', 'revenue'),
  ('5000', 'المصروفات', 'expense'),
  ('5100', 'تكلفة المبيعات', 'expense'),
  ('5200', 'مصروفات تشغيلية', 'expense'),
  ('5300', 'مصروفات غير تشغيلية', 'expense')
ON CONFLICT (code) DO NOTHING;

-- الإعدادات الافتراضية
INSERT INTO settings (key, value) VALUES
  ('company_name', 'مصنع الصندل للأوعية البلاستيكية'),
  ('department_name', 'قسم الحبل'),
  ('currency', 'SDG'),
  ('currency_symbol', 'ج.س'),
  ('default_cash_balance', '0'),
  ('default_bank_balance', '0')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 16. تفعيل Row Level Security
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 17. سياسات RLS للمستخدمين المصادق عليهم
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_all_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "auth_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 18. Storage Buckets (للمرفقات)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) VALUES
  ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_attachments" ON storage.objects;
CREATE POLICY "auth_upload_attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "public_read_attachments" ON storage.objects;
CREATE POLICY "public_read_attachments" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "auth_delete_attachments" ON storage.objects;
CREATE POLICY "auth_delete_attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'attachments');

-- ═══════════════════════════════════════════════════════════════
-- 19. تفعيل Realtime للجداول الحيوية
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

-- ═══════════════════════════════════════════════════════════════
-- ✅ تم إنشاء السكيما بنجاح
-- ═══════════════════════════════════════════════════════════════