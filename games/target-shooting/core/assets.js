/* Target Shooting 3D — asset access.
 * Online the files are fetched next to the page (assets/...). The offline package defines
 * window.TS_BUNDLE = { 'models/archer.glb': '<base64>', ... } in a <script>, so nothing is fetched and the
 * game runs from file:// without any network, CDN, remote font or API.
 */
(function (root) {
  'use strict';
  const TS = root.TS = root.TS || {};
  const MANIFEST = [
    'models/archer.glb',
    'textures/archer_kit.jpg', 'textures/body_normal.jpg', 'textures/body_rough.jpg',
    'textures/head_a.jpg', 'textures/head_a_normal.jpg', 'textures/head_a_rough.jpg'
  ];
  const MIME = { glb: 'model/gltf-binary', jpg: 'image/jpeg', png: 'image/png', woff2: 'font/woff2' };
  let base = 'assets/';
  const bundled = name => root.TS_BUNDLE && typeof root.TS_BUNDLE[name] === 'string';
  function b64ToBuffer(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function url(name) {
    if (bundled(name)) return 'data:' + (MIME[name.split('.').pop()] || 'application/octet-stream') + ';base64,' + root.TS_BUNDLE[name];
    return base + name;
  }
  async function buffer(name) {
    if (bundled(name)) return b64ToBuffer(root.TS_BUNDLE[name]);
    const r = await fetch(base + name);
    if (!r.ok) throw new Error('missing asset: ' + name + ' (' + r.status + ')');
    return r.arrayBuffer();
  }
  function texture(name, { srgb = true, anisotropy = 4 } = {}) {
    const T = root.THREE;
    return new Promise((res, rej) => {
      const t = new T.TextureLoader().load(url(name), () => res(t), undefined, () => rej(new Error('missing texture: ' + name)));
      t.flipY = false; if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = anisotropy;
    });
  }
  TS.assets = { MANIFEST, url, buffer, texture, setBase(b) { base = b; }, get base() { return base; }, bundled: () => !!root.TS_BUNDLE };
})(typeof window !== 'undefined' ? window : globalThis);
