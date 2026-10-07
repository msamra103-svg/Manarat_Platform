// Supabase Edge Function: generate-questions-from-pdf
// هدفها قراءة PDF والملفات عبر Gemini File API بدل الاعتماد على قراءة المتصفح.
// Deploy:
//   supabase functions deploy generate-questions-from-pdf
// Secret:
//   supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
}

function strictPrompt(rawPrompt: string) {
  return `${rawPrompt}\n\nتعليمات نهائية صارمة:\n- أعد JSON فقط دون Markdown ودون شرح خارجي.\n- لا تكتب أي سؤال عام أو قالب فارغ.\n- إذا لم تستطع قراءة الملف فارجع {"questions":[]} فقط.\n- لا تذكر: النص المستخرج، الملف المرفق، شكل السؤال، صيغة JSON، اختيار 1، اختيار 2، شرح قصير.`;
}

function modelName(raw: string) {
  const v = String(raw || 'gemini-2.5-flash').trim();
  return v.includes('/') ? v.split('/').pop()! : v;
}

function mimeOf(file: File) {
  const name = (file.name || '').toLowerCase();
  let mime = file.type || '';
  if (!mime && name.endsWith('.pdf')) mime = 'application/pdf';
  if (!mime && name.endsWith('.txt')) mime = 'text/plain';
  if (!mime && name.endsWith('.md')) mime = 'text/markdown';
  if (!mime && name.endsWith('.json')) mime = 'application/json';
  if (!mime && name.endsWith('.html')) mime = 'text/html';
  return mime || 'application/octet-stream';
}

async function uploadGeminiFile(apiKey: string, file: File) {
  const mime = mimeOf(file);
  const displayName = (file.name || 'uploaded-file').replace(/[\r\n]/g, ' ').slice(0, 120);
  if ((file.size || 0) > 50 * 1024 * 1024) {
    throw new Error(`حجم الملف ${displayName} أكبر من 50MB. يرجى تقسيم الملف أو رفع نسخة أصغر.`);
  }

  const startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size || 0),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ file: { display_name: displayName } })
  });

  if (!startRes.ok) {
    const err = await startRes.text().catch(() => '');
    throw new Error(`فشل بدء رفع الملف إلى Gemini: ${err || startRes.status}`);
  }

  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('لم يرجع Gemini رابط رفع الملف.');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(file.size || 0),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mime
    },
    body: await file.arrayBuffer()
  });

  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    throw new Error(uploadJson?.error?.message || `فشل رفع الملف إلى Gemini (${uploadRes.status}).`);
  }

  let uploaded = uploadJson.file || uploadJson;
  const name = uploaded?.name;
  if (!name) throw new Error('تم رفع الملف لكن لم يرجع Gemini معرف الملف.');

  // بعض ملفات PDF تحتاج لحظات حتى تصبح ACTIVE.
  for (let i = 0; i < 12; i++) {
    if ((uploaded?.state || '').toUpperCase() === 'ACTIVE' || !uploaded?.state) return uploaded;
    await new Promise((resolve) => setTimeout(resolve, 900));
    const poll = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${encodeURIComponent(apiKey)}`);
    const pollJson = await poll.json().catch(() => ({}));
    if (poll.ok && pollJson) uploaded = pollJson;
  }
  return uploaded;
}

async function inlinePart(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { inlineData: { mimeType: mimeOf(file), data: btoa(binary) } };
}

async function filePart(apiKey: string, file: File) {
  // نستخدم Gemini File API أساسًا للـ PDF والملفات الأكبر؛ وinline احتياطيًا للملفات الصغيرة إذا فشل الرفع.
  try {
    const uploaded = await uploadGeminiFile(apiKey, file);
    const uri = uploaded?.uri;
    if (!uri) throw new Error('لم يرجع Gemini fileUri صالحًا.');
    return { fileData: { mimeType: uploaded.mimeType || mimeOf(file), fileUri: uri } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if ((file.size || 0) <= 12 * 1024 * 1024) {
      console.warn('Gemini File API upload failed; falling back to inlineData:', msg);
      return await inlinePart(file);
    }
    throw e;
  }
}

function extractGeminiText(geminiJson: any) {
  return geminiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('\n') || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY غير موجود في Supabase Secrets.' }, 500);

    const form = await req.formData();
    const prompt = String(form.get('prompt') || '').trim();
    const model = modelName(String(form.get('model') || 'gemini-2.5-flash'));
    const temperature = Number(form.get('temperature') || 0.12);
    const files = form.getAll('files').filter((x): x is File => x instanceof File);

    if (!prompt) return json({ error: 'Prompt is required' }, 400);

    const parts: any[] = [{ text: strictPrompt(prompt) }];
    for (const f of files) {
      if (!f || !f.size) continue;
      parts.push(await filePart(apiKey, f));
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature, responseMimeType: 'application/json' }
      })
    });

    const geminiJson = await geminiRes.json().catch(() => ({}));
    if (!geminiRes.ok) {
      return json({ error: geminiJson?.error?.message || 'Gemini request failed', details: geminiJson }, geminiRes.status);
    }

    const content = extractGeminiText(geminiJson);
    if (!content) {
      return json({ content: '{"questions":[]}', warning: geminiJson?.candidates?.[0]?.finishReason || geminiJson?.promptFeedback?.blockReason || 'Empty Gemini response' });
    }
    return json({ content });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
