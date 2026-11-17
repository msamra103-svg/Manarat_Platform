#!/usr/bin/env python3
"""
تجهيز خامات «مهمّة المعرفة».
يحوّل الخامات الأصلية (CC0) إلى WebP بمقاسين (1024 و512)، ويولّد إجرائيًا
الخامات التي لم يتوفر لها مصدر ممسوح (الخشب، سعف النخيل، الزخرفة الجصية).

الاستعمال:  python3 tools/prepare_assets.py <مجلد_الخامات_الأصلية> public/assets/textures
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(7)


def load(path, mode="RGB", size=1024):
    im = Image.open(os.path.join(SRC, path)).convert(mode)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0


def save(name, arr, quality=84, alpha=False):
    arr = np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr, "RGBA" if alpha else "RGB")
    for folder, size in (("1k", 1024), ("512", 512)):
        os.makedirs(os.path.join(OUT, folder), exist_ok=True)
        out = im if im.size[0] == size else im.resize((size, size * im.size[1] // im.size[0]), Image.LANCZOS)
        out.save(os.path.join(OUT, folder, name + ".webp"), "WEBP", quality=quality, method=6)


def orm(ao=None, rough=None, metal=None, n=1024):
    one = np.ones((n, n), np.float32)
    ch = [ao if ao is not None else one, rough if rough is not None else one * 0.9, metal if metal is not None else one * 0.0]
    return np.stack(ch, axis=-1)


def gray(a):
    return a.mean(axis=-1) if a.ndim == 3 else a


def tile_noise(n, cells, octaves=4, seed=0):
    """ضجيج كسري قابل للتكرار."""
    r = np.random.default_rng(seed)
    out = np.zeros((n, n), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        g = r.random((c, c)).astype(np.float32)
        g = np.tile(g, (3, 3))
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((n * 3, n * 3), Image.BICUBIC)
        out += amp * np.asarray(im)[n:2 * n, n:2 * n].astype(np.float32) / 255.0
        total += amp
        amp *= 0.5
    return out / total


def normal_from_height(h, strength=2.0):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + nz * nz)
    return np.stack([(-dx / l) * 0.5 + 0.5, (dy / l) * 0.5 + 0.5, (nz / l) * 0.5 + 0.5], -1)


# ---------- خامات ممسوحة (CC0) ----------
# الرمل: ambientCG Ground092C (عبر مستودع playcanvas/engine)
c = load("pc/ground092c_color.webp")
m = c.mean(axis=(0, 1), keepdims=True)
c = m + (c - m) * 0.82                     # تخفيف تباين التموّجات قليلًا حتى لا يبدو الرمل مبتلًّا
c = c * np.array([1.03, 0.985, 0.93])      # دفء خفيف
save("sand_color", c)
save("sand_normal", load("pc/ground092c_normal.webp"), 90)
save("sand_orm", orm(gray(load("pc/ground092c_ao.webp")), np.clip(gray(load("pc/ground092c_roughness.webp")) * 0.9 + 0.1, 0, 1)), 80)

# الجص: ambientCG (عبر مستودع itz019/tls-textures)
c = load("tls/wall_plaster_dirty_Color.png")
save("plaster_color", np.clip(c * 1.04, 0, 1))
save("plaster_normal", load("tls/wall_plaster_dirty_NormalGL.jpg"), 90)
save("plaster_orm", orm(None, gray(load("tls/wall_plaster_dirty_Roughness.jpg"))), 80)

# الخرسانة
c = load("tls/sidewalk_concrete_Color.png")
save("concrete_color", np.clip(c * 1.45 + 0.04, 0, 1))
save("concrete_normal", load("tls/sidewalk_concrete_NormalGL.jpg"), 90)
save("concrete_orm", orm(None, gray(load("tls/sidewalk_concrete_Roughness.jpg"))), 80)

# المعدن المطلي المتآكل
save("metal_color", load("tls/metal_rusty_paint_Color.png"))
save("metal_normal", load("tls/metal_rusty_paint_NormalGL.jpg"), 90)
save("metal_orm", orm(None, gray(load("tls/metal_rusty_paint_Roughness.jpg")), gray(load("tls/metal_rusty_paint_Metalness.jpg"))), 80)

# الحجر: Poly Haven rock_face_03 (عبر playcanvas/engine)
save("rock_color", load("pc/rock_face_03_diff_1k.jpg"))
save("rock_normal", load("pc/rock_face_03_nor_1k.jpg"), 90)

# القماش: Poly Haven fabric_pattern_07 (عبر godot-demo-projects)
save("fabric_color", load("ph/fabric_pattern_07_col_1_1k.jpg"))
save("fabric_normal", load("ph/fabric_pattern_07_nor_gl_1k.jpg"), 90)
save("fabric_orm", load("ph/fabric_pattern_07_arm_1k.jpg"), 80)

# ---------- خامات مولّدة إجرائيًا ----------
N = 1024
# خشب ساج داكن بألواح رأسية
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32) / N
planks = 8
pid = np.floor(xx * planks).astype(int)
tone = rng.random(planks).astype(np.float32)[pid]
grain = tile_noise(N, 4, 5, seed=3)
stretched = np.asarray(Image.fromarray((grain * 255).astype(np.uint8)).resize((N * 6, N), Image.BICUBIC))[:, :N].astype(np.float32) / 255.0
rings = 0.5 + 0.5 * np.sin((xx * 90 + stretched * 9 + tone * 20) * 2 * np.pi * 0.35)
edge = np.abs((xx * planks) % 1.0 - 0.5) * 2
gap = np.clip((edge - 0.94) / 0.06, 0, 1)
h = 0.55 + 0.25 * rings * 0.4 + 0.2 * stretched - gap * 0.9
base = np.array([0.33, 0.21, 0.125])
col = base[None, None, :] * (0.72 + 0.4 * tone[..., None] * 0.5 + 0.28 * rings[..., None] * 0.6 + 0.25 * stretched[..., None])
col *= (1 - gap[..., None] * 0.85)
save("wood_color", col)
save("wood_normal", normal_from_height(h, 5.0), 90)
save("wood_orm", orm(1 - gap * 0.6, np.clip(0.62 + 0.2 * stretched - 0.1 * rings, 0, 1)), 80)

# سعفة نخيل (RGBA)
W, H = 1024, 256
S = 2
im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
cy = H * S // 2
for i in range(74):
    t = i / 73.0
    x = int((0.05 + 0.93 * t) * W * S)
    length = (0.46 * (1 - (2 * t - 1) ** 2 * 0.55) * (1 - t * 0.35)) * H * S * (0.85 + 0.3 * rng.random())
    lean = 0.55 + 0.25 * t
    g = 0.45 + 0.25 * rng.random()
    colr = (int(70 + 60 * g), int(105 + 55 * g), int(40 + 30 * g), 255)
    for sgn in (-1, 1):
        tipx = x + int(length * lean)
        tipy = cy + sgn * int(length)
        wd = 7 * S
        d.polygon([(x - wd, cy), (x + wd, cy), (tipx, tipy)], fill=colr)
d.rectangle([int(0.0 * W * S), cy - 4 * S, int(0.98 * W * S), cy + 4 * S], fill=(120, 128, 70, 255))
im = im.resize((W, H), Image.LANCZOS)
a = np.asarray(im).astype(np.float32) / 255.0
rgb = a[..., :3]
mask = a[..., 3:4]
fill = np.array([0.36, 0.45, 0.2])[None, None, :]
rgb = rgb * mask + fill * (1 - mask)           # منع الهالات الداكنة عند الحواف
frond = np.concatenate([rgb, mask], -1)
arr = np.clip(frond * 255 + 0.5, 0, 255).astype(np.uint8)
for folder, w in (("1k", 1024), ("512", 512)):
    Image.fromarray(arr, "RGBA").resize((w, w // 4), Image.LANCZOS).save(os.path.join(OUT, folder, "frond.webp"), "WEBP", quality=88, method=6)

# مشبّك جصّي بنجمة ثمانية (RGBA) للنوافذ
L = 512 * 2
im = Image.new("L", (L, L), 255)
d = ImageDraw.Draw(im)
cells = 4
cs = L // cells
for gy in range(cells):
    for gx in range(cells):
        cx, cyy = gx * cs + cs // 2, gy * cs + cs // 2
        r = cs * 0.33
        for rot in (0, 45):
            pts = []
            for k in range(4):
                ang = np.deg2rad(rot + 45 + 90 * k)
                pts.append((cx + r * np.cos(ang) * 1.18, cyy + r * np.sin(ang) * 1.18))
            d.polygon(pts, fill=0)
        d.ellipse([cx - cs * 0.09, cyy - cs * 0.09, cx + cs * 0.09, cyy + cs * 0.09], fill=255)
for gy in range(cells + 1):
    for gx in range(cells + 1):
        cx, cyy = gx * cs, gy * cs
        r = cs * 0.12
        d.polygon([(cx, cyy - r), (cx + r, cyy), (cx, cyy + r), (cx - r, cyy)], fill=0)
im = im.filter(ImageFilter.GaussianBlur(1.2)).resize((512, 512), Image.LANCZOS)
al = np.asarray(im).astype(np.float32) / 255.0
pl = load("tls/wall_plaster_dirty_Color.png", size=512)
lat = np.concatenate([np.clip(pl * 1.05, 0, 1), al[..., None]], -1)
arr = np.clip(lat * 255 + 0.5, 0, 255).astype(np.uint8)
for folder, w in (("1k", 512), ("512", 256)):
    Image.fromarray(arr, "RGBA").resize((w, w), Image.LANCZOS).save(os.path.join(OUT, folder, "lattice.webp"), "WEBP", quality=90, method=6)

# ---------- خامات بيئة الغابة ----------
# أرض الغابة: Poly Haven sparse_grass (عبر playcanvas/engine)
# الخامة الأصلية داكنة وقليلة التباين فتبدو مسطّحة في الظل؛ نرفع تباين النصال ونلوّنها بين تربة بنية وعشب أخضر
def wrap_blur(a, r):
    n = a.shape[0]
    im = Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8))
    big = Image.new("RGB" if a.ndim == 3 else "L", (n * 3, n * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * n, j * n))
    return np.asarray(big.filter(ImageFilter.GaussianBlur(r)).crop((n, n, 2 * n, 2 * n))).astype(np.float32) / 255.0


g = load("forest/sparse_grass_diff_1k.jpg")
L = g.mean(axis=-1)
lo = wrap_blur(L, 26)
Ln = np.clip(1 + (L / np.maximum(lo, 1e-3) - 1) * 1.55, 0.5, 1.75) * (lo / lo.mean()) ** 1.25
d = wrap_blur(g[..., 1] - g[..., 0] + 0.5, 1.1) - 0.5          # مقدار الخضرة في الأصل
k = np.clip((d - np.percentile(d, 12)) / (np.percentile(d, 80) - np.percentile(d, 12)), 0, 1) ** 0.8
soil, blade = np.array([0.40, 0.31, 0.19], np.float32), np.array([0.33, 0.46, 0.17], np.float32)
save("grass_color", np.clip(Ln[..., None] * (soil + (blade - soil) * k[..., None]), 0.02, 1))
save("grass_normal", load("forest/sparse_grass_nor_1k.jpg"), 90)
# لحاء الأشجار: من حزمة ez-tree (البلوط = Poly Haven bark_brown_02، الصنوبر = TextureCan)
save("bark_oak_color", load("forest/oak_color_1k.jpg"))
save("bark_oak_normal", load("forest/oak_normal_1k.jpg"), 90)
save("bark_pine_color", load("forest/pine_color_1k.jpg"))
save("bark_pine_normal", load("forest/pine_normal_1k.jpg"), 90)
# أوراق الأشجار (RGBA) من حزمة ez-tree
for leaf in ("oak", "ash", "pine"):
    a = load(f"forest/{leaf}_color.png", "RGBA")
    rgb, al = a[..., :3], a[..., 3:4]
    mean = (rgb * al).sum(axis=(0, 1)) / max(al.sum(), 1e-6)
    rgb = rgb * al + mean[None, None, :] * (1 - al)      # تعبئة ما حول الأوراق بلونها لمنع الهالات الداكنة
    arr = np.clip(np.concatenate([rgb, al], -1) * 255 + 0.5, 0, 255).astype(np.uint8)
    for folder, w in (("1k", 1024), ("512", 512)):
        Image.fromarray(arr, "RGBA").resize((w, w), Image.LANCZOS).save(os.path.join(OUT, folder, f"leaves_{leaf}.webp"), "WEBP", quality=88, method=6)

print("تم تجهيز الخامات في", OUT)
