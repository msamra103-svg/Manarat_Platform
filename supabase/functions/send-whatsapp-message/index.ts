// Supabase Edge Function: send-whatsapp-message
// Purpose: Send contact-form messages directly to WhatsApp using WhatsApp Business Cloud API.
// Recommended setting in Supabase Dashboard:
// - Function name: send-whatsapp-message
// - Verify JWT: OFF, because public visitors need to submit the contact form.
//
// Required Secrets:
// - WHATSAPP_ACCESS_TOKEN
// - WHATSAPP_PHONE_NUMBER_ID
// - WHATSAPP_TO_NUMBER
//
// Optional Secrets:
// - WHATSAPP_API_VERSION (default: v20.0)
// - WHATSAPP_USE_TEMPLATE=true
// - WHATSAPP_TEMPLATE_NAME
// - WHATSAPP_TEMPLATE_LANG (default: ar)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(v: unknown, max = 500) {
  return String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizePhone(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot: silently accept bot submissions without sending.
    if (clean(body.honeypot, 80)) return json({ ok: true, skipped: true });

    const name = clean(body.name, 120) || "غير مذكور";
    const visitorPhone = clean(body.phone, 80) || "غير مذكور";
    const message = clean(body.message, 1800);
    const page = clean(body.page, 400);

    if (!message || message.length < 2) {
      return json({ ok: false, error: "نص الرسالة مطلوب" }, 400);
    }

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
    const toNumber = normalizePhone(Deno.env.get("WHATSAPP_TO_NUMBER") || "");
    const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v20.0";

    if (!accessToken || !phoneNumberId || !toNumber) {
      return json({
        ok: false,
        error: "إعدادات واتساب غير مكتملة. أضف WHATSAPP_ACCESS_TOKEN و WHATSAPP_PHONE_NUMBER_ID و WHATSAPP_TO_NUMBER في Supabase Secrets.",
      }, 500);
    }

    const text =
`رسالة جديدة من موقع منارة التعلم الرقمي

الاسم: ${name}
رقم التواصل: ${visitorPhone}

الرسالة:
${message}

الصفحة:
${page || "غير محددة"}`;

    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`;

    const useTemplate = String(Deno.env.get("WHATSAPP_USE_TEMPLATE") || "").toLowerCase() === "true";
    const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "";
    const templateLang = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "ar";

    let payload: Record<string, unknown>;

    if (useTemplate) {
      if (!templateName) return json({ ok: false, error: "WHATSAPP_TEMPLATE_NAME مطلوب عند تفعيل القالب" }, 500);
      payload = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: name },
                { type: "text", text: visitorPhone },
                { type: "text", text: message.slice(0, 900) },
              ],
            },
          ],
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "text",
        text: { preview_url: false, body: text },
      };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({
        ok: false,
        error: out?.error?.message || "فشل إرسال رسالة واتساب",
        details: out?.error || out,
      }, res.status);
    }

    return json({ ok: true, provider: "whatsapp-cloud-api", result: out });
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
});
