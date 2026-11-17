// بناء نسخة التشغيل: node tools/build.mjs
// الناتج dist/ يعمل من مجلد فرعي بمسارات نسبية، وبالنقر المزدوج على index.html (file://) أو من خادم.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const dev = process.argv.includes('--dev');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: { game: join(root, 'src/main.js') },
  bundle: true,
  format: 'iife',
  target: ['es2020', 'chrome90', 'safari15', 'firefox90', 'edge90'],
  outdir: out,
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  loader: { '.woff2': 'dataurl' },
  legalComments: 'eof',
  metafile: true,
  logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' },
});
cpSync(join(root, 'index.html'), join(out, 'index.html'));
cpSync(join(root, 'public/game.config.js'), join(out, 'game.config.js'));
cpSync(join(root, 'public/questions.sample.js'), join(out, 'questions.sample.js'));
// محاكي المنصة مع اللعبة داخل مجلد فرعي (لاختبار المسارات النسبية والربط)
const sim = join(root, 'dist-platform-sim');
rmSync(sim, { recursive: true, force: true });
mkdirSync(join(sim, 'games'), { recursive: true });
cpSync(join(root, 'simulator/index.html'), join(sim, 'index.html'));
cpSync(join(root, 'simulator/host.js'), join(sim, 'host.js'));
cpSync(out, join(sim, 'games/horse-jumping-race'), { recursive: true });
const bytes = Object.values(result.metafile.outputs).reduce((a, o) => a + o.bytes, 0);
writeFileSync(join(out, 'BUILD_INFO.txt'), `سباق الخيل — قفز الحواجز — horse-jumping-race\nbuilt: ${new Date().toISOString()}\nbundle bytes: ${bytes}\n`);
console.log('dist built:', (bytes / 1024 / 1024).toFixed(2), 'MB');
