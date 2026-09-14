// ═══════════════════════════════════════════════════════════════
// Edge Function: إنشاء مستخدم جديد من داخل النظام
// المسار: supabase/functions/create-user/index.ts
// ═══════════════════════════════════════════════════════════════

/// <reference lib="deno.window" />

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // التعامل مع OPTIONS (CORS preflight)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. التحقق من وجود التوكن
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "غير مصرح - يجب تسجيل الدخول" }, 401);
    }

    // 2. إعداد العملاء
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 3. جلب المستخدم الحالي
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "جلسة غير صالحة" }, 401);
    }

    // 4. Admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 5. التحقق من أن المستخدم admin
    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return json({ error: "غير مصرح - مدير النظام فقط" }, 403);
    }

    // 6. قراءة البيانات
    const { email, password, fullName, role } = await req.json();

    if (!email || !password || !fullName || !role) {
      return json({ error: "جميع الحقول مطلوبة" }, 400);
    }

    if (password.length < 6) {
      return json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, 400);
    }

    const validRoles = ["admin", "manager", "accountant", "cashier", "viewer"];
    if (!validRoles.includes(role)) {
      return json({ error: "الدور غير صالح" }, 400);
    }

    // 7. إنشاء المستخدم في Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) {
      let msg = authError.message;
      if (msg.includes("already registered") || msg.includes("already been registered")) {
        msg = "البريد الإلكتروني مسجل مسبقاً";
      }
      if (msg.includes("invalid email") || msg.includes("Invalid email")) {
        msg = "البريد الإلكتروني غير صحيح";
      }
      if (msg.includes("password")) {
        msg = "كلمة المرور غير صالحة (6 أحرف على الأقل)";
      }
      return json({ error: msg }, 400);
    }

    // 8. إضافة المستخدم في جدول users
    const { error: profileError } = await adminClient
      .from("users")
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role,
        is_active: true
      });

    if (profileError) {
      // حذف المستخدم من Auth لعدم وجوده في جدول users
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return json({ error: "فشل حفظ بيانات المستخدم: " + profileError.message }, 500);
    }

    // 9. تسجيل في التدقيق
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      user_email: user.email,
      action: "create",
      module: "users",
      record_id: authData.user.id,
      details: { new_user_email: email, role, full_name: fullName }
    });

    // 10. إرجاع النتيجة
    return json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName,
        role
      }
    }, 200);

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return json({ error: "خطأ في السيرفر: " + errorMessage }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}