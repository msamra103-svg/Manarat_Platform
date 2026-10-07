// Supabase Edge Function: fetch-youtube-videos
// Purpose: Fetch latest public YouTube videos from a channel URL/handle/channel ID.
// Recommended setting: Verify JWT = OFF or ON. It only reads public YouTube data.
// No secrets required.

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

function clean(v: unknown, max = 600) {
  return String(v || "").trim().slice(0, max);
}

function decodeXML(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractChannelId(v: string) {
  v = clean(v, 800);
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(v)) return v;
  let m = v.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  m = v.match(/[?&]channel_id=(UC[A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  return "";
}

async function resolveChannelId(channelUrl: string) {
  let id = extractChannelId(channelUrl);
  if (id) return id;

  let url = clean(channelUrl, 800);
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("@")) url = `https://www.youtube.com/${url}`;
    else url = `https://www.youtube.com/@${url.replace(/^@/, "")}`;
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 ManaratPlatform/16.2",
      "Accept-Language": "ar,en;q=0.9",
    },
  });
  const html = await res.text();

  const patterns = [
    /"channelId":"(UC[A-Za-z0-9_-]{20,})"/,
    /"externalId":"(UC[A-Za-z0-9_-]{20,})"/,
    /<meta itemprop="channelId" content="(UC[A-Za-z0-9_-]{20,})"/,
    /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  throw new Error("تعذر معرفة Channel ID من رابط القناة. جرّب رابطًا يبدأ بـ /channel/UC...");
}

function parseFeed(xml: string, limit: number) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1]);
  return entries.slice(0, limit).map(entry => {
    const vid = (entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1] || "";
    const title = decodeXML((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "فيديو من القناة").trim();
    const published = (entry.match(/<published>(.*?)<\/published>/) || [])[1] || "";
    return {
      id: vid,
      title,
      url: vid ? `https://www.youtube.com/watch?v=${vid}` : "",
      thumbnail: vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : "",
      published,
    };
  }).filter(v => v.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const channelUrl = clean(body.channelUrl || body.url || body.channelId, 800);
    const limit = Math.max(1, Math.min(Number(body.limit || 5), 8));
    if (!channelUrl) return json({ ok: false, error: "رابط القناة مطلوب" }, 400);

    const channelId = await resolveChannelId(channelUrl);
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const feed = await fetch(feedUrl, { headers: { "User-Agent": "Mozilla/5.0 ManaratPlatform/16.2" } });
    const xml = await feed.text();
    if (!feed.ok) throw new Error(`تعذر قراءة RSS من يوتيوب: ${feed.status}`);

    const videos = parseFeed(xml, limit);
    return json({ ok: true, channelId, videos });
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
});
