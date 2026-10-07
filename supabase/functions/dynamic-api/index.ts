// Supabase Edge Function: delete-user-admin
// Required secrets:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
//
// Purpose:
// Securely delete a teacher/user from Supabase Auth by admin request.
// The caller must be authenticated and must be an admin/owner in profiles
// or the configured owner email.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OWNER_EMAIL = "m.samra103@gmail.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sbFetch(path: string, opts: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) {
    throw new Error("SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير مضبوط داخل Supabase Secrets");
  }
  return fetch(`${url}${path}`, {
    ...opts,
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

async function getCaller(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw new Error("Unauthorized: missing user token");
  const token = auth.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) throw new Error("SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير مضبوط");
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: service, Authorization: `Bearer ${token}` },
  });
  const user = await res.json().catch(() => null);
  if (!res.ok || !user?.email) throw new Error("Unauthorized: invalid user token");
  return user;
}

async function isAdmin(user: any) {
  const email = String(user?.email || "").toLowerCase();
  if (email === OWNER_EMAIL) return true;
  const res = await sbFetch(`/rest/v1/profiles?select=role,status,email&id=eq.${encodeURIComponent(user.id)}&limit=1`, {
    headers: { Accept: "application/json" },
  });
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  const role = String(row?.role || "").toLowerCase();
  const status = String(row?.status || "نشط");
  return ["admin", "owner", "super_admin"].includes(role) && status !== "موقوف";
}

async function findUserIdByEmail(email: string) {
  // GoTrue Admin list users endpoint. This is only used as fallback when the caller sends email without id.
  const res = await sbFetch(`/auth/v1/admin/users?page=1&per_page=1000`, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  const users = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
  const hit = users.find((u: any) => String(u.email || "").toLowerCase() === email.toLowerCase());
  return hit?.id || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (!(await isAdmin(caller))) return json({ error: "غير مسموح: الحساب الحالي ليس أدمن" }, 403);

    const body = await req.json().catch(() => ({}));
    let id = String(body.id || body.user_id || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!id && email) id = await findUserIdByEmail(email);
    if (!id) return json({ error: "لم يتم العثور على معرف المستخدم في Supabase Auth" }, 404);
    if (id === caller.id) return json({ error: "لا يمكن للأدمن حذف حسابه الحالي من داخل المنصة" }, 400);

    const del = await sbFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
    const delBody = await del.text();
    if (!del.ok) {
      return json({ error: delBody || `فشل حذف حساب Auth (${del.status})` }, del.status);
    }
    return json({ ok: true, deleted_user_id: id, email });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
});
