# Basketball V23.1 — asset and licence inventory

V23.1 (reconstruction of `scene.js`, `motion.js`, `index.html`, `basketball.css`) adds **no new external files**: the ball texture, ball bump map, pending halo and net are generated in code at runtime. Everything below is unchanged from V23.

Every runtime file added by this upgrade is listed here. Nothing is hot-linked: all assets ship inside `games/basketball/`.
"Modifications" describes what was done to the original material.

## 1. Human characters, animations and spectators — Microsoft Rocketbox Avatar Library

| | |
|---|---|
| Source | https://github.com/microsoft/Microsoft-Rocketbox (commit `0943055db6ec570bcef9f2c8b41c9e5467c808f9`, 2 Oct 2022) |
| Author / provider | Microsoft (original avatar creation: Rocketbox Studios; see repository contributors) |
| Licence | MIT — `LICENSE.md` of the repository: "Copyright (c) 2020 Microsoft" |
| Required attribution | Keep the MIT copyright and permission notice (reproduced in `games/basketball/assets/LICENSES/Rocketbox-MIT.txt`). Citing Gonzalez-Franco et al., *"The Rocketbox library and the utility of freely available rigged avatars"*, Frontiers in Virtual Reality (2020), DOI 10.3389/frvir.2020.561558 is requested by the authors for research use. |
| Redistribution | Permitted by MIT with the notice. Note: Microsoft's original 2020 announcement described the library as "for research and academic use"; the repository licence was changed to MIT in Nov/Dec 2020 (README "November 2020 License Update"). No other restriction was found in the repository. The school may wish to keep this note on file. |
| Real-person likeness | Generic, unnamed avatars. No famous athletes, no team branding. The "FYA" sponsor print of the original football kits is not used (only the heads of those avatars are used). |

### Files derived from Rocketbox

| File(s) | Original | Modifications |
|---|---|---|
| `assets/models/athlete_a.glb` | `Professions/Sports_Male_04` (tank top, shorts, trainers) | Armature/mesh transforms applied, vertex colours removed, weights limited to 4, exported to glTF, meshopt-compressed (gltfpack 1.3.0). |
| `assets/models/athlete_b.glb` | Body of `Sports_Male_04` + head of `Professions/Sports_Male_02` | Head grafted at the 22-vertex neck seam (seam snapped ≤ 2.2 cm, smooth falloff, welded); then as above. |
| `assets/models/athlete_c.glb` | Body of `Sports_Male_04` + head and hair cards of `Professions/Sports_Male_03` | Same graft procedure (seam ≤ 1.7 cm). |
| `assets/models/clips.glb`, `clips.json` | Rocketbox animations (`Assets/Animations/…`): `m_idle_breathe_01`, `m_idle_neutral_01`, `m_idle_look_around_01`, `m_cheer_04`, `m_cheer_02`, `m_cheer_05`, `m_claphands_01`, `m_claphands_02`, `m_gestic_shrug_02`, `m_gestic_listen_sad_01`, `m_run_slow_01`, `m_walk_neutral_01` | Retargeted to the athlete skeleton by armature-space rotation transfer (keeps each avatar's proportions); facial channels, bone scale and non-root translation removed; run/walk made in-place; resampled at 30 fps; meshopt-compressed. |
| `assets/textures/kit_home_*.jpg`, `kit_away_*.jpg` | `Sports_Male_04/Textures/m026_body_color.tga` | Tank top and shorts recoloured (maroon home kit, white away kit) preserving the original fabric shading; trims and jersey numbers drawn (DejaVu Sans Bold glyphs rasterised at build time); resized to 1024 px JPEG. |
| `assets/textures/body_normal.jpg`, `body_rough.jpg` | `m026_body_normal.tga`, `m026_body_specular.tga` | Resized; roughness derived from specular (inverted/remapped). |
| `assets/textures/head_a*.jpg`, `head_b*.jpg`, `head_c*.jpg`, `hair_c.png` | head colour/normal/specular of `Sports_Male_04`, `_02`, `_03`; `m300_opacity_color.tga` | Resized to 1024 px (hair 512 px PNG with alpha); roughness from specular. |
| `assets/crowd/crowd_a15/19/21/17/20/01/06/10/04.*` | `Adults/Male_Adult_15, 19, 21, 17, 20, 01, 06, 10, 04` | Decimated to ~1,300 triangles, hair cards removed, weights folded to 20 body bones (2 influences), conformed to a shared canonical skeleton, packed to a binary vertex format; 512 px texture atlas (body/head/keffiyeh). |
| `assets/crowd/crowd_c01/c02.*` | `Children/Male_Child_01, 02` | Same as above (child canonical skeleton). |
| `assets/crowd/crowd_anim.bin`, `crowd.json` | Animations `m_sit_chair_breathe_01`, `m_sit_chair_idle_look_around`, `m_sit_chair_idle_nervous_01`, `m_sit_chair_gestic_shrug_01`, `m_sit_chair_idle_touch_face`, `m_sit_stand_up_chair_01`, `m_sit_down_chair_01`, `m_cheer_02`, `m_cheer_04`, `m_claphands_01`, `m_claphands_02` | Retargeted to both canonical skeletons; seated clapping/cheering composed from seated lower body + clapping/cheering upper body; baked to int16 3×4 skin matrices at 12 fps. |

The full, repeatable pipeline is in `tools/basketball-assets/` (Blender 5.2 Python module + gltfpack). Original FBX/TGA files are **not** redistributed in this package.

## 2. Three.js add-ons (r128, matching the existing `games/vendor/three.min.js`)

| File | Source | Author | Licence | Modifications |
|---|---|---|---|---|
| `games/basketball/vendor/GLTFLoader.js` | npm `three@0.128.0` `examples/js/loaders/` | three.js authors | MIT | none |
| `games/basketball/vendor/SkeletonUtils.js` | npm `three@0.128.0` `examples/js/utils/` | three.js authors | MIT | none |
| `games/basketball/vendor/RoomEnvironment.js` | npm `three@0.128.0` `examples/js/environments/` | three.js authors (port of Google model-viewer's EnvironmentScene) | MIT (three.js distribution) | none |

The shared `games/vendor/three.min.js` (r128, MIT) is unchanged.

## 3. meshoptimizer decoder

| File | Source | Author | Licence | Modifications |
|---|---|---|---|---|
| `games/basketball/vendor/meshopt_decoder.js` | npm `meshoptimizer@0.22.0` | Arseny Kapoulkine | MIT (notice in file header) | none |

## 4. Font

| File | Source | Author | Licence | Modifications |
|---|---|---|---|---|
| `assets/fonts/Tajawal-Regular/Bold/ExtraBold.woff2` | https://github.com/google/fonts/tree/main/ofl/tajawal | Boutros International | SIL Open Font License 1.1 (`assets/LICENSES/Tajawal-OFL.txt`) | Subset to Arabic + Latin ranges and converted to WOFF2 (fontTools). Reserved Font Name rules of the OFL apply to modified versions. |

## 5. Audio

| Sound | Origin | Licence / status |
|---|---|---|
| Ball bounces, rim, backboard, net, shoe squeaks, hand slaps, whoosh, whistle, applause, room tone, reverb | Synthesised at runtime in `games/basketball/audio.js` (written for this upgrade) | Original code, no third-party recording. |
| Crowd murmur bed and reaction layers | **Existing platform files** `games/football/assets/crowd-cheer.mp3`, `crowd-miss.mp3` (already used by the previous basketball/football versions) | **Provenance not verified** — the package does not document their source or licence. They are optional: the game runs and keeps all contact sounds if they are absent. Verify their licence before any redistribution outside the school platform, or replace them with a licensed recording at the same paths. |

## 6. Procedural content (no external files)

Maple floor, roughness variation, court markings, stands, seats, LED boards, scoreboard and centre-court text (`arena.js`), and the basketball's eight-panel leather/seam colour and pebble bump textures, the verlet net and the pending-answer halo (`scene.js`) are generated in code at runtime. Arabic identity text is drawn by the browser's own text engine onto canvases (correct shaping), not baked into images. No ministry artwork or official logo is used.

## 7. Build-only tools (not shipped)

Blender `bpy` 5.2.3 (GPL; used as a tool only), gltfpack 1.3.0 (MIT), fontTools (MIT), Pillow (HPND), NumPy/SciPy (BSD).
