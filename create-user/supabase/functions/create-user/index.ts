import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "غير مصرح - يجب تسجيل الدخول" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "جلسة غير صالحة" }, 401);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await adminClient
      .from("users").select("role").eq("id", user.id).single();

    if (!profile || profile.role !== "admin") {
      return json({ error: "غير مصرح - مدير النظام فقط" }, 403);
    }

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
      return json({ error: msg }, 400);
    }

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
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return json({ error: "فشل حفظ البيانات: " + profileError.message }, 500);
    }

    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      user_email: user.email,
      action: "create",
      module: "users",
      record_id: authData.user.id,
      details: { new_user_email: email, role, full_name: fullName }
    });

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
    return json({ error: "خطأ في السيرفر: " + (error?.message || String(error)) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}