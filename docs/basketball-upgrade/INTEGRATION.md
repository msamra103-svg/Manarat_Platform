# Integrating Basketball V23.1 into the Manarat repository

This package is a source drop for `games/basketball/` plus tests and tools. It is **not** a replacement for the platform and must not be deployed as-is. Work on a branch and go through the normal preview/review flow; do not deploy directly to production.

## 1. Branch and copy

```sh
git checkout -b feature/basketball-v23-1
# from the unzipped package root:
rsync -a --delete games/basketball/  <repo>/games/basketball/
cp tests/basketball-motion-v23.cjs tests/basketball-flow-v23.cjs tests/basketball-rig-v23.cjs <repo>/tests/
mkdir -p <repo>/tests/browser && cp tests/browser/* <repo>/tests/browser/
mkdir -p <repo>/tools/basketball-assets && cp tools/basketball-assets/* <repo>/tools/basketball-assets/
git rm <repo>/tests/basketball-motion-v22.cjs <repo>/tests/basketball-scene-v22.cjs   # replaced by v23 suites
cp ASSETS_AND_LICENSES.md CHANGELOG_BASKETBALL.md QA_RESULTS_BASKETBALL.md <repo>/docs/basketball/   # or wherever docs live
```

Do **not** copy the package's root `index.html` (development launcher only), `README_AR.md` or `SHA256.json` over platform files.

Unchanged and therefore not to be copied/edited: `games/sports/*` (shared with football), `games/football/*`, `games/vendor/three.min.js`, `js/platform-nav.js`, `js/school.js`.

Note: the new `games/basketball/index.html` no longer loads `games/sports/athlete.js`, `games/sports/game.js` or `games/football/football.css`. Football still uses them; do **not** delete them. The basketball page still reads `games/football/assets/crowd-*.mp3` as optional crowd layers.

## 2. Public mirror

The production app serves a `public/` mirror. After copying, regenerate it with the existing process (`node scripts/sync-public.js` or `npm run build`, as in the repository) — never hand-edit only one copy. Then verify:

```sh
diff -r games/basketball public/games/basketball && echo mirror-ok
```

If the sync script filters by extension, make sure it copies the new binary asset types: `.glb`, `.bin`, `.json`, `.woff2`, `.jpg`, `.png`, `.txt` (licence files). `tests/` and `tools/` must not be published.

## 3. Host page (`js/school.js`)

No change is required: the iframe URL (`games/basketball/index.html`), the `school-basketball-*` messages, the token/index fields and the parent-controlled `answer()` / `finish()` flow are the same.

Optional (display only, ignored if absent):
- add `subject` and `teacher` strings to the `school-basketball-config` message to show them under the assignment title;
- add the awarded `points` number to `school-basketball-result` to show "النقاط التعليمية" next to the basketball points.

## 4. Hosting notes

- MIME types: `.glb` → `model/gltf-binary`, `.woff2` → `font/woff2`, `.bin` → `application/octet-stream` (Vercel defaults are fine).
- Content-Security-Policy (only if the platform sets one): the meshopt decoder instantiates WebAssembly, which needs `'wasm-unsafe-eval'` in `script-src`. All other files are same-origin `fetch`/`<script>`/`<img>`.
- Download size of the new basketball assets ≈ 4.5 MB (models 0.6 MB, textures 2.5 MB, crowd 1.4 MB, fonts 64 KB) plus ≈ 0.25 MB of new scripts; the shared `three.min.js` is already cached by the platform. Script URLs carry `?v=23.1`; bump it on future changes or add cache-busting for assets.
- Audio: the game still reads `games/football/assets/crowd-cheer.mp3` and `crowd-miss.mp3` as optional crowd layers (see licence note in `ASSETS_AND_LICENSES.md`).

## 5. Tests in the repository

Add to `package.json` (keeping existing scripts):

```json
"test:basketball": "node tests/basketball-motion-v23.cjs && node tests/basketball-flow-v23.cjs && node tests/basketball-rig-v23.cjs"
```

`npm run test:sports` (football + shared files) must keep passing unchanged. The browser suite (`tests/browser/basketball-e2e.cjs`) needs Playwright/Chromium and a static server; it is optional in CI.

## 6. Running the browser QA locally (optional)

```sh
npm i -D playwright && npx playwright install chromium     # once, in a scratch checkout
python3 -m http.server 8099                                 # repository or package root
(cd tests/browser/attacker && python3 -m http.server 8098 --bind 127.0.0.1)
node tests/browser/basketball-e2e.cjs qa-out                # 21 checks
node tests/browser/pose-check.cjs                           # prints "0 <seconds>" when clean
node tests/browser/perf.cjs qa-out/perf.json                # measure on the school's own devices
```

## 7. Review checklist before merging

1. Standalone `games/basketball/index.html`: loads, three practice questions, restart/end via the platform bar.
2. Real assignment through the platform: title, question rendering by the host, correct → basket, wrong → miss, essay/pending → neutral, last question → platform result page with the assignment title.
3. Football assignment still behaves exactly as before.
4. Phones/tablets: portrait and landscape, touch.
5. Licence review of the optional crowd recordings.
