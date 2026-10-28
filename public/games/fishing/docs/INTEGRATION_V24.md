# صيد الأسماك V24.1 — Integration & installation

> Integrated into the current platform at the owner's request on 2026-10-27. See `PLATFORM_INTEGRATION.md` for integration fixes and verification.

## 1. Copy into the repository
1. Unzip the package at the repository root (it has the same layout as the repo).
2. New / replaced paths:
   - `games/fishing/**` (the whole folder; `index.html` is replaced)
   - `tests/fishing-physics.cjs`, `tests/fishing-flow.cjs`, `tests/fishing-assets.cjs`, `tests/fishing-browser.cjs`
3. Nothing else is modified. Optional, for approval: `patches/0001-package-json-fishing-scripts.patch` adds npm scripts:
   ```bash
   git apply patches/0001-package-json-fishing-scripts.patch
   ```
4. Mirror to `public/` with the existing script (do not edit `public/` by hand):
   ```bash
   npm run sync        # node scripts/sync-public.js → copies games/ into public/games/
   ```

Note: `npm run sync` copies the whole `games/` tree, so `games/fishing/docs/` (≈3 MB of screenshots) and `games/fishing/tools/` would also be mirrored. They are harmless but not needed at runtime; delete them from `public/games/fishing/` after syncing if you want the smallest deployment.

## 2. Platform contract (unchanged)
`js/school.js` already treats `fishing` as an iframe sport (`games/fishing/index.html`, id `fishingGame`). V24 keeps exactly:

| Direction | Message | Fields | Game-side guard |
|---|---|---|---|
| game → host | `school-fishing-ready` | token, index | sent once on load |
| host → game | `school-fishing-config` | token, count, title, images | parent window + same origin, accepted once while loading |
| game → host | `school-fishing-question` | token, index | once per bite; "عرض السؤال" re-posts it |
| host → game | `school-fishing-result` | token, index, correct, pending, feedback | parent + origin + token + index, only in the question phase, first one wins |
| game → host | `school-fishing-outcome` | token, index | once, after the catch / escape / review animation |
| game → host | `school-fishing-next` | token, index | once (re-enabled by `retry`) |
| host → game | `school-fishing-advance` | token, index | only in the outcome phase, index must match |
| host → game | `school-fishing-retry` | token, index | re-enables the next button |
| game → host | `school-fishing-fullscreen` | token, index | host toggles fullscreen |

Grading stays on the server: the game never contacts the API, Supabase or student data. `correct=true` ⇒ one fish is landed (guaranteed by the fight model); `correct=false` ⇒ escape, no catch; `pending=true` ⇒ neutral review card, no catch and no miss.

## 3. Assets
- Models load from `games/fishing/assets/models/*.glb` (≈6 MB total in V24.1: realistic skinned angler 2.6 MB, boat 1.3 MB, three fish ≈0.55 MB each, tackle 0.24 MB). If a GLB cannot be fetched or parsed, a simplified model is rebuilt from `js/models/*.js`; `FishingGame.view.assets.report` tells which source was used.
- Ocean normal map: `assets/textures/water-normals.js` (data-URI script, 0.25 MB; the PNG next to it is the same image). Loaded by `index.html` before `js/water.js`.
- Sounds load from `assets/audio/*.wav` (≈3 MB) after the first user gesture; if unavailable they are synthesised locally by `js/audio-dsp.js`.
- `assets/models/embedded-models.js` (≈8 MB, base64) is only loaded when the page is opened from `file://` (offline exports). Over HTTP it is never requested.
- Rebuild after editing any builder (needs the repo's `playwright` dev-dependency):
  ```bash
  # only if the angler body/clothes change — needs a local MakeHuman 1.x checkout (CC0 data folder):
  python3 games/fishing/tools/makehuman/build_fisherman.py <makehuman>/makehuman/data games/fishing/tools/makehuman/build
  python3 games/fishing/tools/gen_water_normals.py games/fishing/assets/textures/water-normals.png   # numpy + Pillow
  node games/fishing/tools/build-assets.cjs     # boat, tackle, angler, 3 fish → GLB + embedded-models.js
  node games/fishing/tools/build-audio.cjs
  ```
- Graphics presets: `high` / `medium` add a half/third-resolution planar reflection pass (one extra scene render per frame); `low` (power saving) skips it. Auto picks `high` on desktop ≥1000 px and `medium` on touch devices, and lowers the pixel ratio automatically when the frame rate stays under 28 fps.

## 4. Running locally
```bash
node games/fishing/tools/serve.cjs            # http://localhost:8724/games/fishing/
# embedded protocol demo (scripted host that mirrors school.js):
#   http://localhost:8724/games/fishing/tools/host-harness.html?answers=correct,wrong,pending
```
Standalone mode shows 3 labelled demo questions (2 multiple-choice, 1 essay → neutral review). Through the platform demo (`index.html?demo=fishing`) the host's own demo questions are used.

## 5. Tests
```bash
node tests/fishing-physics.cjs   # physics + simulation contract
node tests/fishing-flow.cjs      # platform bridge, security guards, catches
node tests/fishing-assets.cjs    # GLB/WAV/licences/offline/shared files untouched
node games/fishing/tools/build-offline.cjs dist && node tests/fishing-browser.cjs --dist="$PWD/dist"   # Chromium suite (~10 min on software WebGL)
node tests/experiences-motion.cjs && node tests/experiences-flow.cjs && node tests/experiences-scene.cjs && node tests/game-session.cjs && node tests/game-modes.cjs
```

## 6. Offline exports
`node games/fishing/tools/build-offline.cjs <dir>` creates `fishing-v24-offline-student/` and `fishing-v24-offline-teacher/`. Open `index.html` by double-click. Limitations: no access to the school platform, question banks, grades or official reports; the teacher page only builds local practice links.

## 7. QA hooks
`?qa=1` exposes `FishingGame.qa` (pause, step, until, cast, answer for standalone demo only). Without `qa` these hooks are `null`. `?quality=low|medium|high` overrides the stored quality choice.

## 8. Rollback
Restore `games/fishing/index.html` from the base commit and delete the new files; no other file was touched.
