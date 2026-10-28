# صيد الأسماك — V24 Change log

**Base:** `msamra103-svg/Manarat_Platform` @ `7828f379927dd857d8c33a40a072859a75d2b3aa` (entry `games/fishing/index.html`).
**Status:** review package — not merged, not deployed.

## V24.1 — جولة الواقعية (استجابة لملاحظة: «الشخصية وطريقة الصيد وشكل السمك والمياه»)

- **الشخصية:** استُبدل الصياد المكوَّن من قطع صلبة بإنسان واقعي بجلد متصل (Skinned mesh، ‏32 ألف مثلث، 66 عظمة) مبني من بيانات MakeHuman المفتوحة CC0 (الجسم، الهيكل العظمي، العيون) بمعالجة أداة المشروع `tools/makehuman/build_fisherman.py`: وجه بعيون حقيقية وقرنية لامعة، شعر قصير ولحية مرسومان، قميص بأكمام طويلة، سترة نجاة بأحزمة، بنطال، حذاء قارب. الوجه متوسط بارامتري لا يشبه شخصًا حقيقيًا.
- **الحركة:** محرّك IK جديد للهيكل الجلدي (`js/angler-rig.js`): اليد اليمنى تقبض المقبض حول قاعدة البكرة، واليسرى على ذراع البكرة أثناء الانتظار واللف، وعلى مؤخرة القصبة في الرمي، وعلى مقبض الشبكة عند الإنزال؛ الأصابع تنطوي حول ما تمسكه، الكتف يتقدم (Protraction) حين تبعد اليد، الجذع يلتف نحو القصبة، والركبتان للأمام والقدمان ثابتتان. مؤخرة القصبة صارت بمحاذاة الساعد والورك بدل اختراق الجسم.
- **طريقة الصيد:** عوّامة منزلقة حقيقية: خارج الماء تستقر العوّامة على الثقل (تجهيزة قصيرة متدلية من الطرف)، وبعد سقوطها في الماء يسحب الثقل الخيط عبرها حتى عقدة التوقف (1.5 م) فتنتصب العوّامة. الرمي العلوي: القصبة تعود خلف الكتف ثم تندفع للأمام ويتبعها الخيط.
- **السمك:** أجسام الأنواع الثلاثة مأخوذة من نموذج سمكة باراموندي الواقعي (Khronos glTF Sample، ‏CC0) — حراشف وزعانف شعاعية وخرائط Normal/Roughness — ثم أُعيد تشكيل نسبها ورُسمت ألوان كل نوع (الهامور بني زيتوني ببقع برتقالية وأشرطة داكنة، الشعري فضي مصفر ببقع زرقاء وخطوط الخد، الصافي زيتوني ببقع بيضاء). أُصلح اتجاه الرأس/الذيل (كان معكوسًا في البناء السابق). الأوزان تُحسب من حجم النموذج الجديد.
- **المياه:** خريطة Normal لمحيط حقيقي مولّدة بتحويل فورييه لطيف أمواج رياح (Phillips) تُقرأ بثلاثة مقاييس متحركة مع الريح، وانعكاس مستوٍ حقيقي (Planar reflection) للقارب والصياد والساحل على سطح متموّج (عالية/متوسطة)، ألوان خليجية أعمق وأزرق، إضاءة تحت سطحية في قمم الأمواج، إزالة «رغوة القمم» الاصطناعية، رغوة متقطّعة فقاعية حول السمكة، سماء أزرق أصفى وضباب أخف، وتوحيد لون الماء البعيد تحت السطح.
- **القارب:** إصلاح اتجاه وجوه الهيكل الخارجي (كان يُرى الوجه الداخلي فلا تظهر الخطوط)، فظهر الآن خط الزينة العنابي وخط الماء والطلاء السفلي، مع آثار تعرية وسيلان خفيفة، ومحرك بغطاء واقعي الشكل بدل الكرة.

### V24.1 files
Added: `js/angler-rig.js`, `js/models/fisherman-skinned.js`, `assets/textures/water-normals.png|.js`, `tools/gen_water_normals.py`, `tools/makehuman/` (builder, build data, CC0 licence text, dev viewer), `tools/source-assets/` (CC0 Barramundi + README), `tools/glb-viewer.html`.
Changed: `js/water.js`, `js/view.js`, `js/fishing-physics.js` (sliding float), `js/fishing-sim.js` (grip poses, rod carriage), `js/fishing-fish.js` (model-volume weights, length ranges), `js/assets.js`, `js/game.js` (adaptive resolution paused during QA stepping), `js/models/boat-model.js`, `tools/export.html`, `tools/build-assets.cjs`, `index.html`, `tests/fishing-assets.cjs` (licence check now includes `assets/textures`).

## ملخّص بالعربية

- لعبة «صيد الأسماك» أصبحت تعمل بمحرّك مستقل بالكامل داخل `games/fishing/`، ولم تعد تحمّل ملفات `games/experiences/*` أو `games/sports/*` المشتركة. الملفات المشتركة لم تُعدَّل (مثبت باختبار بصمات SHA).
- مشهد بحري خليجي ثلاثي الأبعاد: أمواج Gerstner متحركة بانعكاس Fresnel ولمعان الشمس ورغوة حول القارب، شفافية تحت سطح الماء، قاع رملي بصخور ومرجان وأعشاب بحرية، كاوستكس (انكسارات ضوء) وأشعة ضوء تحت الماء، ساحل بكثبان وأفق مدينة عام وقوارب تقليدية بعيدة وعوّامات إرشاد.
- قارب صيد مفصّل يتمايل فيزيائيًا مع الأمواج (أخذ عينات من سطح الماء + نوابض مخمّدة)، مع صندوق ثلج بغطاء يُفتح، صندوق عُدّة، دلو طُعم، محرّك، حامل سنارة، مصدّات، طوق نجاة.
- صياد ثلاثي الأبعاد أصلي (≈1.76 م) بوجه ولحية وقبعة وسترة نجاة؛ يداه مثبّتتان على السنارة والبكرة والشبكة بحلّ IK ثنائي العظام، والقدمان ثابتتان على الأرضية والركبتان تنثنيان للأمام دائمًا، ويعوّض ميلان القارب ليبقى منتصبًا. تعابير وجه ورمش ونظر نحو العوّامة/السمكة.
- عُدّة صيد عاملة: قصبة تنحني حسب الشد مع تأخّر ديناميكي، حلقات توجيه، بكرة دوّارة (الذراع والدوّار يدوران بمقدار الخيط المسحوب فعليًا، والبيل يُفتح عند الرمي)، خيط Verlet متصل دائمًا من البكرة عبر الحلقات إلى الطرف ثم العوّامة والثقل والخطاف والطُّعم (روبيان).
- ثلاثة أنواع خليجية: هامور، شعري، صافي — نماذج GLB بأجسام مبنية من مقاطع نسب الجسم، زعانف، عيون، ألوان ونقوش النوع، وسباحة بتموّج الذيل والانعطاف والتسارع وسلوك سرب وتجنّب للقارب والصخور والقاع والسطح.
- تسلسل صيد كامل: اختيار الاتجاه/النقر على الماء وقوة الرمي ← تهيئة ← رمي بمسار مقذوف دقيق ← رشّة وتموّجات ← استقرار العوّامة ونزول الخطاف ← اقتراب السمكة وتفحّصها ونقرات تُغطس العوّامة ← العضّة (جرس + اهتزاز القصبة) ← تجميد اللحظة وعرض السؤال ← نتيجة المنصة:
  - صحيحة: غرز الخطاف، صراع مع شدّ ومؤشر توتر وبكرة (الضغط المطوّل يسرّع فقط)، صعود السمكة، التقاطها بالشبكة، وضعها في صندوق الثلج، احتفال — صيد واحد بالضبط.
  - خاطئة: الضربة تفشل، السمكة تهزّ رأسها وتُفلت الخطاف وتهرب، يضيع الطُّعم — صفر.
  - مقالية قيد المراجعة: السمكة تترك الطُّعم بهدوء وتبتعد، بطاقة محايدة «قيد مراجعة المعلم» — لا صيد ولا خطأ.
- كاميرات سينمائية تلقائية + أوضاع: واسعة، خلف الكتف، العوّامة، تحت الماء، مع قطع ناعم عند عبور سطح الماء ووضع «حركة كاميرا هادئة».
- صوت أصلي مُركّب: بحر، رياح، صرير القارب، ارتطام الماء بالهيكل، طقطقة البكرة بحسب سرعة اللف، صفير السحب، رشّات، فقاعات، أجواء تحت الماء، جرس العضّة، نغمة السؤال، نغمة نجاح، نغمة إفلات لطيفة، نغمة محايدة، وموسيقى نصر ختامية. تحكم منفصل بالموسيقى والمؤثرات والأجواء والكتم. لا يبدأ قبل تفاعل المستخدم.
- واجهة عربية RTL جديدة بالاسم «صيد الأسماك» واسم «مدرسة أبو عبيدة الإعدادية للبنين»، بلا تمرير في ملء الشاشة (مختبرة على 7 مقاسات)، أزرار كبيرة، لوحة مفاتيح ولمس.
- الالتزام الكامل ببروتوكول المنصة `school-fishing-*` دون أي تغيير في `js/school.js`.

## Added (all new files are inside `games/fishing/` unless noted)

| Area | Files |
|---|---|
| Entry & UI | `index.html` (rewritten), `fishing.css`, `teacher.html` (offline practice editor) |
| Deterministic core (Node-testable) | `js/fishing-physics.js` (vectors, Gerstner sea, seabed, boat motion, rod bending, Verlet line, ballistics), `js/fishing-fish.js` (species, swimming AI, fight model), `js/fishing-sim.js` (whole fishing action at fixed 120 Hz) |
| Rendering | `js/water.js` (sky, sea shader, underwater optics patch, caustics, seabed, light shafts, particles), `js/environment.js` (coast, skyline, dhows, buoys, static-mesh merging), `js/actors.js` (angler IK rig, rod/reel/line/float/hook/net, fish instances, boat), `js/camera.js` (director), `js/view.js` (scene, quality presets) |
| Models | `js/models/boat-model.js`, `fisherman-model.js`, `tackle-model.js`, `fish-model.js` → `assets/models/*.glb` (+ `embedded-models.js`, `manifest.json`), loaded by `js/assets.js` with `vendor/GLTFLoader.js` |
| Audio | `js/audio-dsp.js` (original synthesis), `js/audio.js` (engine) → `assets/audio/*.wav` |
| Flow & platform | `js/game.js` |
| Tools | `tools/serve.cjs`, `tools/build-assets.cjs` (+ `export.html`, `GLTFExporter.js`), `tools/build-audio.cjs`, `tools/build-offline.cjs`, `tools/host-harness.html`, `tools/model-viewer.html`, `tools/make-manifest.cjs` |
| Tests (repo `tests/`) | `fishing-physics.cjs`, `fishing-flow.cjs`, `fishing-assets.cjs`, `fishing-browser.cjs` |
| Docs | `docs/CHANGELOG_V24.md`, `INTEGRATION_V24.md`, `LICENCES_V24.md`, `TEST_RESULTS_V24.md`, `FILE_MANIFEST_V24.md`, `docs/screenshots/*.jpg` |
| Patch for approval (outside `games/fishing/`) | `patches/0001-package-json-fishing-scripts.patch` (adds `test:fishing`, `test:fishing:browser`, `build:fishing-assets`; **not applied**) |

## Changed
- `games/fishing/index.html` — now loads only `../vendor/three.min.js` (shared, unchanged), the fishing engine, and `../../js/platform-nav.js` (shared, unchanged).

## Unchanged (verified byte-identical against `SOURCE_MANIFEST.json`)
`games/experiences/*`, `games/sports/*`, `games/vendor/three.min.js`, `js/school.js`, `js/platform-nav.js`, `package.json`, `scripts/sync-public.js`, `assets/game-covers/fishing.svg`, existing tests.

## Known limitations (honest disclosure)
- **Pier / shoreline variant:** not implemented. The game offers boat fishing only.
- **Fisherman (V24.1):** skinned MakeHuman-based character driven by procedural IK — no motion capture, no facial animation (blink/expressions of the old rigid model are not ported to the skinned face), clothing is painted onto body-fitted shells (no cloth simulation). The procedural rigid model remains only as an automatic fallback.
- **Fish (V24.1):** all three species share the CC0 barramundi body (reshaped + repainted). Hamour and shaari read convincingly; the rabbitfish (صافي) keeps a perch-like outline rather than its true oval, compressed body. Fins are part of the mesh and bend with the body wave only.
- **Water (V24.1):** reflections are planar (exact for the boat/angler/coast, approximate on steep waves) and disabled on the power-saving preset; no screen-space refraction of the hull below the waterline.
- **Performance:** measured only on software WebGL (SwiftShader) in a headless container — not representative of classroom GPUs. Real-device FPS at 30/60/120 Hz was **not measured**. The simulation is frame-rate independent (identical state at 30/60/120 fps — tested).
- **Question countdown:** not added (the host has no timeout contract; nothing is auto-submitted).
- **Regression of volleyball / puzzle / classic** is covered by the existing Node tests (pass). Their browser entry pages are not part of this source package, so they were not opened in a browser.
- `S.images` from the host config is stored but not displayed in the 3D scene (the host's question modal shows question images, as before).
