# إنشاء حزمة التسليم: python3 tools/package.py OUT_DIR
# تتضمن المصدر + نسخة التشغيل + محاكي المنصة + الوثائق واللقطات، دون node_modules.
import os, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else ROOT
NAME = 'Horse-Jumping-Race-RETURN-FOR-REVIEW.zip'
SKIP_DIRS = {'node_modules', '.git', '__pycache__'}
SKIP_FILES = {'viewer.bundle.js', 'stand.bundle.js', 'export-glb.bundle.js'}

path = os.path.join(OUT, NAME)
with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES or f.endswith('.zip'):
                continue
            full = os.path.join(base, f)
            rel = os.path.relpath(full, ROOT)
            z.write(full, os.path.join('horse-jumping-race', rel))
print(path, os.path.getsize(path))
