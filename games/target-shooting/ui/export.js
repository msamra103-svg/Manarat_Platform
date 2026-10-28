/* Target Shooting 3D — self-contained offline HTML assembly (browser + Node build tool).
 * Output: ONE .html file with every script inline, the CSS inline (fonts as data: URIs), the 3D model and
 * textures in window.TS_BUNDLE (base64) and the teacher's configuration in <script id="ts-preset">.
 * No CDN, no remote font, no network request, no API key, no Supabase — it runs from file://.
 */
(function (root) {
  'use strict';
  const FONTS = ['fonts/Tajawal-Regular.woff2', 'fonts/Tajawal-Bold.woff2', 'fonts/Tajawal-ExtraBold.woff2'];
  const safeScript = s => String(s).replace(/<\/(script)/gi, '<\\/$1');
  const LS = new RegExp('\\u2028', 'g'), PS = new RegExp('\\u2029', 'g');
  const safeJson = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(LS, '\\u2028').replace(PS, '\\u2029');

  function assemble({ css, markup, scripts, bundle, preset, title = 'التصويب على الهدف', role = 'student' }) {
    const fontCss = css.replace(/url\((['"]?)assets\/(fonts\/[^'")]+)\1\)/g, (m, q, name) => bundle[name] ? `url(data:font/woff2;base64,${bundle[name]})` : m);
    const assets = {}; for (const [k, v] of Object.entries(bundle)) if (!k.startsWith('fonts/')) assets[k] = v;
    return '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
      + '<meta name="theme-color" content="#5b0d24">\n<meta name="generator" content="Target Shooting 3D offline export">\n<title>' + title.replace(/</g, '&lt;') + '</title>\n'
      + '<style>\n' + fontCss + '\n</style>\n</head>\n<body data-role="' + role + '" data-phase="loading">\n'
      + '<template id="app-markup">' + markup + '</template>\n'
      + '<script id="ts-preset" type="application/json">' + safeJson(preset) + '</script>\n'
      + '<script>window.TS_BUNDLE=' + safeJson(assets) + ';</script>\n'
      + scripts.map(s => '<script>\n' + safeScript(s) + '\n</script>').join('\n')
      + '\n</body>\n</html>\n';
  }

  // ---------------------------------------------------------------- browser side
  async function fetchText(u) { const r = await fetch(u); if (!r.ok) throw new Error('missing ' + u); return r.text(); }
  async function fetchB64(u) {
    const r = await fetch(u); if (!r.ok) throw new Error('missing ' + u);
    const buf = new Uint8Array(await r.arrayBuffer()); let s = ''; const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    return btoa(s);
  }
  async function student(config) {
    const doc = document, TS = root.TS;
    // CSS: inline <style> (offline file) or the linked stylesheet (online)
    let css = '';
    for (const st of doc.querySelectorAll('style')) if (!st.id || st.id !== 'pn-style') css += st.textContent + '\n';
    const link = doc.querySelector('link[rel=stylesheet]');
    if (link && !css.includes('--accent')) css = await fetchText(link.href);
    const markup = doc.getElementById('app-markup').innerHTML;
    const scripts = [];
    for (const s of doc.querySelectorAll('script')) {
      if (s.id === 'ts-preset' || s.type === 'application/json') continue;
      if (s.textContent.trim().startsWith('window.TS_BUNDLE')) continue;
      if (s.src) { if (/platform-nav\.js/.test(s.src)) continue; scripts.push(await fetchText(s.src)); }
      else if (s.textContent.trim()) scripts.push(s.textContent);
    }
    let bundle = {};
    if (root.TS_BUNDLE) { bundle = Object.assign({}, root.TS_BUNDLE); }
    else for (const name of TS.assets.MANIFEST) bundle[name] = await fetchB64(TS.assets.base + name);
    // online: fetch the font files; offline: they are already inline in the CSS as data: URIs
    if (!root.TS_BUNDLE) for (const f of FONTS) if (!bundle[f]) { try { bundle[f] = await fetchB64(TS.assets.base + f); } catch (e) { /* font optional: system fallback */ } }
    if (root.TS_FONTS) Object.assign(bundle, root.TS_FONTS);
    return assemble({ css, markup, scripts, bundle, preset: { role: 'student', config }, role: 'student', title: TS.config.GAME_NAME + ' — ' + (config.lesson || config.school) });
  }

  const API = { assemble, student, FONTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else { root.TS = root.TS || {}; root.TS.Export = API; }
})(typeof window !== 'undefined' ? window : globalThis);
