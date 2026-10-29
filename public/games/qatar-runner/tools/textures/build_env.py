#!/usr/bin/env python3
"""عدّاء قطر — builds the photo-like PBR texture set for the Doha world (original procedural work, no photos).

Usage: python3 tools/textures/build_env.py <out dir> [name ...]
Writes WebP maps (<name>_c colour, <name>_n normal, <name>_r roughness, <name>_e emissive …); tools/pack-tex.cjs packs
them into js/tex-data.js so the game stays a single offline bundle.
"""
import sys, os, math, time
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(__file__))
from texlib import *

OUT = sys.argv[1] if len(sys.argv) > 1 else 'build/tex'
ONLY = set(sys.argv[2:])
os.makedirs(OUT, exist_ok=True)
REPORT = []
def out(name, img, q=82, alpha=None, lossless=False):
    n = save(img, os.path.join(OUT, name + '.webp'), q=q, alpha=alpha, lossless=lossless); REPORT.append((name, img.shape[:2], n)); print(f'  {name:18s} {img.shape[1]}x{img.shape[0]}  {n/1024:7.1f} KB', flush=True)

# ------------------------------------------------------------------------------------------------ asphalt road
def road():
    """3-lane carriageway, 7.8 m (u) × 20 m (v), lane markings, wheel tracks, patches, sealed cracks."""
    W, H = 1024, 2048; mx = lambda m: (m + 3.9) / 7.8 * W; mz = lambda m: m / 20 * H
    r = rng(11); yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); xm = (xx + 0.5) / W * 7.8 - 3.9; zm = (yy + 0.5) / H * 20
    low = fnoise(H, W, 3.0, 1); mid = fnoise(H, W, 2.2, 2); fine = fnoise(H, W, 0.6, 3)
    # aggregate: individual stones of different greys poking out of the binder
    ag = r.random((H, W)).astype(np.float32); ag = wrapblur(ag, 0.6); ag = (ag - ag.mean()) / ag.std()
    stones = ss(0.35, 1.25, ag); tone = wrapblur(r.random((H, W)).astype(np.float32), 0.9); tone = (tone - tone.min()) / (tone.max() - tone.min())
    binder = srgb('#3d3f43'); aged = srgb('#56585b')
    c = mix(np.broadcast_to(binder, (H, W, 3)), np.broadcast_to(aged, (H, W, 3)), 0.25 + 0.55 * low)
    stone_col = mix(srgb('#4a4c50')[None, None], srgb('#8d8c88')[None, None], tone)
    stone_col = mix(stone_col, srgb('#9a8f80')[None, None], (tone > 0.8) * 0.5)
    c = mix(c, stone_col, stones * 0.75)
    c *= (0.92 + 0.16 * mid)[..., None]
    rough = 0.93 - 0.08 * stones
    # wheel tracks: darker, smoother (polished binder, oil) along each lane
    wt = np.zeros((H, W), np.float32)
    for lc in (-2.5, 0, 2.5):
        for o in (-0.78, 0.78): wt = np.maximum(wt, np.exp(-((xm - lc - o) / 0.33) ** 2))
    wt *= 0.75 + 0.25 * band(H, W, 2, 10, 4)
    c *= (1 - 0.13 * wt)[..., None]; rough -= 0.12 * wt
    # oil drips in lane centres
    oil = np.zeros((H, W), np.float32)
    for lc in (-2.5, 0, 2.5):
        oil = np.maximum(oil, np.exp(-((xm - lc) / 0.22) ** 2) * ss(0.55, 0.85, fnoise(H, W, 2.6, 50 + int(lc * 10))))
    c *= (1 - 0.22 * oil)[..., None]; rough -= 0.15 * oil
    # resurfacing patches (darker, fresher) with sealed seams
    hgt = 0.55 * stones + 0.25 * fine
    seams = np.zeros((H, W), np.float32)
    for (x0, w, z0, l) in ((-3.3, 2.6, 4.0, 3.2), (0.6, 1.7, 13.0, 1.6)):
        inside = (xm > x0) & (xm < x0 + w) & (zm > z0) & (zm < z0 + l)
        c[inside] = c[inside] * 0.88 + srgb('#323437') * 0.12 * (0.9 + 0.2 * mid[inside, None])
        e = np.zeros((H, W), np.uint8); cv2.rectangle(e, (int(mx(x0)), int(mz(z0))), (int(mx(x0 + w)), int(mz(z0 + l))), 255, 1)
        seams = np.maximum(seams, e.astype(np.float32) / 255 * 0.5)
    # sealed cracks: meandering tar lines
    segs = []
    for k in range(4):
        y = r.uniform(0, H); x = r.uniform(0, W); a = r.uniform(0, 2 * math.pi)
        for s in range(int(r.uniform(15, 40))):
            a += r.normal(0, 0.45); ny, nx = y + math.sin(a) * 7, x + math.cos(a) * 7; segs.append((y, x, ny, nx)); y, x = ny % H, nx % W
    cracks = stroke_lines(H, W, segs, 1)
    seams = np.maximum(seams, wrapblur(cracks, 0.6) * 0.8)
    c = mix(c, srgb('#26272a')[None, None], seams * 0.55); rough -= 0.25 * seams; hgt += 0.15 * seams
    # lane markings (thermoplastic paint, worn by tyres)
    paint = np.zeros((H, W), np.float32)
    for ex in (-3.62, 3.62): paint = np.maximum(paint, ss(0.085, 0.07, np.abs(xm - ex)))
    for lx in (-1.25, 1.25):
        d = np.maximum(np.abs(xm - lx) - 0.065, 0); along = ((zm - 1) % 10)
        paint = np.maximum(paint, ss(0.012, 0.0, d) * ss(0.0, 0.03, along) * ss(4.0, 3.97, along))
    wear = ss(0.25, 0.75, fnoise(H, W, 1.2, 30) * 0.6 + 0.4 * r.random((H, W)).astype(np.float32))
    pa = paint * (0.55 + 0.45 * wear) * (1 - 0.35 * wt)
    pc = mix(srgb('#e9e8e2')[None, None], srgb('#bdbbb4')[None, None], 1 - wear)
    c = mix(c, pc, pa); rough = rough * (1 - pa) + 0.62 * pa; hgt += 0.35 * pa
    # sand dust near the gutters
    dust = ss(3.2, 3.85, np.abs(xm)) * (0.5 + 0.5 * low)
    c = mix(c, srgb('#a99d86')[None, None], dust * 0.35)
    out('road_c', np.clip(c, 0, 1), q=72)
    n = normal_from_height(cv2.resize(hgt, (W // 2, H // 2), interpolation=cv2.INTER_AREA), 2.2)
    out('road_n', n, q=70)
    out('road_r', cv2.resize(np.clip(rough, 0.05, 1), (W // 4, H // 4), interpolation=cv2.INTER_AREA), q=85)

# ------------------------------------------------------------------------------------------------ concrete pavers
def pavers(name='paver', S=1024, tile=2.4, size=(0.6, 0.4), cols=('#d3c9b6', '#cbbfa9', '#d8d0bf', '#c6b9a2'), accent='#b9a189', seed=21):
    """Running-bond concrete pavers with bevels, sand joints and grime; one tile = `tile` metres."""
    r = rng(seed); px = S / tile; bw, bh = size[0] * px, size[1] * px
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    row = np.floor(yy / bh); off = (row % 2) * bw / 2; col = np.floor((xx + off) / bw)
    lx = (xx + off) - col * bw; ly = yy - row * bh
    nrows = int(round(S / bh)); ncols = int(round(S / bw)) + 1
    idx = (row % nrows) * 97 + (col % ncols)
    rnd_tab = r.random(nrows * 97 + ncols + 10)
    pick = rnd_tab[idx.astype(int)]
    edge = np.minimum(np.minimum(lx, bw - lx), np.minimum(ly, bh - ly))
    joint = 1.6 * S / 1024
    bevel = ss(joint, joint + 3.5 * S / 1024, edge)
    pal = np.stack([srgb(c) for c in cols])
    k = np.minimum((pick * len(cols)).astype(int), len(cols) - 1)
    base = pal[k]
    acc = (rng(seed + 1).random(nrows * 97 + ncols + 10)[idx.astype(int)] < 0.03)
    base = np.where(acc[..., None], srgb(accent), base)
    per = (rng(seed + 2).random(nrows * 97 + ncols + 10)[idx.astype(int)] - 0.5) * 0.05
    grain = fnoise(S, S, 0.8, seed + 3); spots = ss(0.72, 0.9, fnoise(S, S, 1.6, seed + 4))
    mott = fnoise(S, S, 2.6, seed + 5)
    c = base * (1 + per[..., None]) * (0.93 + 0.1 * grain[..., None]) * (0.95 + 0.08 * mott[..., None])
    c = mix(c, c * 0.82, spots * 0.4)
    agg = ss(0.62, 0.8, wrapblur(r.random((S, S)).astype(np.float32), 0.8) * 2.2 - 0.6)
    c = mix(c, c * 0.8, agg * 0.35)
    jc = srgb('#8a7f6c') * (0.8 + 0.3 * grain[..., None])
    c = mix(jc, c, bevel)
    grime = (1 - ss(joint, joint + 9 * S / 1024, edge)) * 0.25 * (0.4 + 0.6 * mott)
    c = c * (1 - grime[..., None] * 0.6)
    hgt = 0.6 * bevel + 0.08 * grain + 0.05 * agg
    rough = 0.86 - 0.06 * grain + 0.1 * (1 - bevel)
    out(name + '_c', np.clip(c, 0, 1), q=80); out(name + '_n', normal_from_height(cv2.resize(hgt, (S // 2, S // 2), interpolation=cv2.INTER_AREA), 2.5), q=82)
    out(name + '_r', cv2.resize(np.clip(rough, 0, 1), (S // 4, S // 4), interpolation=cv2.INTER_AREA), q=85)

# ------------------------------------------------------------------------------------------------ Souq Waqif floor stone
def souqstone():
    S = 1024; tile = 3.0; px = S / tile; r = rng(31)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    rows = [0, 0.55, 1.05, 1.62, 2.1, 2.55, 3.0]
    c = np.zeros((S, S, 3), np.float32); edge = np.full((S, S), 99.0, np.float32); pid = np.zeros((S, S), np.int32)
    k = 0
    for i in range(len(rows) - 1):
        y0, y1 = rows[i] * px, rows[i + 1] * px; x = -r.uniform(0, 0.8) * px
        while x < S:
            w = r.uniform(0.6, 1.2) * px
            m = (yy >= y0) & (yy < y1)
            for sh in (0, S):
                mm = m & (xx + sh >= x) & (xx + sh < x + w)
                if mm.any():
                    pid[mm] = k
                    e = np.minimum(np.minimum(xx + sh - x, x + w - xx - sh), np.minimum(yy - y0, y1 - yy)); edge[mm] = e[mm]
            x += w; k += 1
    tones = rng(32).random(k + 5)
    base = mix(srgb('#9ea2a3')[None, None], srgb('#b9b6ae')[None, None], tones[pid])
    grain = fnoise(S, S, 0.9, 33); vein = ss(0.6, 0.95, band(S, S, 6, 18, 34)); mott = fnoise(S, S, 2.5, 35)
    c = base * (0.92 + 0.12 * grain[..., None]) * (0.94 + 0.1 * mott[..., None])
    c = mix(c, c * 0.88, vein * 0.25)
    pits = ss(0.82, 0.95, wrapblur(r.random((S, S)).astype(np.float32), 0.7) * 3 - 1)
    c = mix(c, c * 0.7, pits * 0.5)
    bev = ss(1.0, 4.5, edge)
    c = mix(srgb('#6e6c66') * np.ones((S, S, 3)), c, bev)
    wear = (1 - ss(1.5, 14, edge)) * 0.12; c *= (1 - wear[..., None])
    hgt = 0.7 * bev + 0.05 * grain - 0.1 * pits
    rough = 0.55 + 0.15 * grain + 0.25 * (1 - bev)
    out('souqfloor_c', np.clip(c, 0, 1), q=80); out('souqfloor_n', normal_from_height(cv2.resize(hgt, (512, 512), interpolation=cv2.INTER_AREA), 2.0), q=82)
    out('souqfloor_r', cv2.resize(np.clip(rough, 0, 1), (256, 256), interpolation=cv2.INTER_AREA), q=85)

# ------------------------------------------------------------------------------------------------ mud plaster (Souq walls)
def plaster():
    S = 1024; r = rng(41)
    big = fnoise(S, S, 3.2, 42); mid = fnoise(S, S, 2.0, 43); fine = fnoise(S, S, 0.7, 44)
    trowel = band(S, S, 3, 9, 45)
    hgt = 0.45 * mid + 0.25 * big + 0.12 * fine + 0.18 * ss(0.3, 0.7, trowel)
    # straw fibres
    segs = []
    for k in range(2600):
        y, x = r.uniform(0, S, 2); a = r.uniform(0, math.pi); l = r.uniform(4, 13)
        segs.append((y, x, y + math.sin(a) * l, x + math.cos(a) * l))
    straw = stroke_lines(S, S, segs, 1)
    pebbles = ss(0.86, 0.97, wrapblur(r.random((S, S)).astype(np.float32), 1.3) * 4 - 1.5)
    base = mix(srgb('#b89a74')[None, None], srgb('#d2b993')[None, None], 0.35 + 0.65 * big)
    c = base * (0.9 + 0.16 * mid[..., None]) * (0.95 + 0.08 * fine[..., None])
    c = mix(c, srgb('#c9ad74')[None, None], straw * 0.55); c = mix(c, c * 0.8, pebbles * 0.5)
    # water streaks / dirt washing down
    streak = ss(0.55, 0.9, fnoise(S, S, 2.0, 46, aniso=(0.12, 1.0)))
    c = c * (1 - 0.12 * streak[..., None])
    hgt = hgt + 0.15 * straw + 0.2 * pebbles
    out('plaster_c', np.clip(c, 0, 1), q=80); out('plaster_n', normal_from_height(cv2.resize(hgt, (512, 512), interpolation=cv2.INTER_AREA), 5.0), q=82)

# ------------------------------------------------------------------------------------------------ grass median
def grass():
    S = 1024; r = rng(101)
    soil = mix(srgb('#4a4330')[None, None], srgb('#5d5338')[None, None], fnoise(S, S, 1.5, 102))
    c = soil * np.ones((S, S, 3)); hgt = np.zeros((S, S), np.float32)
    clump = fnoise(S, S, 2.6, 103); dry = ss(0.62, 0.85, fnoise(S, S, 3.0, 104))
    greens = [srgb(x) for x in ('#4f6e2c', '#5b7d33', '#688a3a', '#3f5d24', '#76924a', '#82995a')]
    big = np.zeros((S * 3, S * 3, 3), np.float32); bh = np.zeros((S * 3, S * 3), np.float32)
    n = 70000
    ys = r.uniform(0, S, n); xs = r.uniform(0, S, n)
    for i in range(n):
        y, x = ys[i], xs[i]; cl = clump[int(y) % S, int(x) % S]; d = dry[int(y) % S, int(x) % S]
        g = greens[r.integers(len(greens))] * (0.75 + 0.5 * cl)
        g = g * (1 - d * 0.5) + srgb('#a39a62') * d * 0.5
        a = r.normal(-math.pi / 2, 0.55); l = r.uniform(5, 13)
        p0 = (int((x + S) * 16), int((y + S) * 16)); p1 = (int((x + S + math.cos(a) * l) * 16), int((y + S + math.sin(a) * l) * 16))
        cv2.line(big, p0, p1, (float(g[0]), float(g[1]), float(g[2])), 1, cv2.LINE_AA, 4)
        cv2.line(bh, p0, p1, float(r.uniform(0.5, 1)), 1, cv2.LINE_AA, 4)
    acc = np.zeros((S, S, 3), np.float32); ah = np.zeros((S, S), np.float32); cov = np.zeros((S, S), np.float32)
    for dy in range(3):
        for dx in range(3):
            t = big[dy * S:(dy + 1) * S, dx * S:(dx + 1) * S]; m = t.max(-1) > 0
            acc[m] = t[m]; cov[m] = 1; ah = np.maximum(ah, bh[dy * S:(dy + 1) * S, dx * S:(dx + 1) * S])
    c = np.where(cov[..., None] > 0, acc, c)
    # mowing stripes + sun-bleach
    stripes = 0.5 + 0.5 * np.sin(np.mgrid[0:S, 0:S][1] / S * 2 * math.pi * 2)
    c = c * (0.94 + 0.1 * stripes[..., None])
    ao = 1 - 0.35 * (1 - wrapblur(ah, 1.5))
    c *= ao[..., None]
    out('grass_c', np.clip(c, 0, 1), q=78); out('grass_n', normal_from_height(cv2.resize(wrapblur(ah, 0.6), (512, 512), interpolation=cv2.INTER_AREA), 3.0), q=80)

# ------------------------------------------------------------------------------------------------ painted kerb
def curb():
    W, H = 128, 512; r = rng(111)
    v = (np.mgrid[0:H, 0:W][0] + 0.5) / H
    fine = fnoise(H, W, 0.8, 112); mott = fnoise(H, W, 2.4, 113)
    blk = np.where(v < 0.5, 1.0, 0.0)
    joint = ss(0.004, 0.0, np.minimum(np.abs(v - 0.5), np.minimum(v, 1 - v)))
    white = srgb('#e9e8e3') * (0.92 + 0.08 * fine[..., None]); black = srgb('#232426') * (0.9 + 0.25 * fine[..., None])
    c = mix(white, black, blk)
    chips = ss(0.8, 0.93, fnoise(H, W, 1.0, 114))
    c = mix(c, srgb('#a29c90') * (0.9 + 0.2 * mott[..., None]), chips * 0.8)
    c = mix(c, c * 0.75, (1 - mott) * 0.25)
    c = mix(c, srgb('#575550')[None, None] * np.ones_like(c), joint)
    out('curb_c', np.clip(c, 0, 1), q=85)

# ------------------------------------------------------------------------------------------------ palm trunk + frond
def trunk():
    W, H = 512, 1024; r = rng(121)   # u around, v along ~2.2 m
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rows = 16; cols = 6; bh = H / rows; bw = W / cols
    row = np.floor(yy / bh); off = (row % 2) * bw / 2; col = np.floor((xx + off) / bw) % cols
    lx = ((xx + off) % bw) / bw - 0.5; ly = (yy % bh) / bh
    # leaf-base "boot": rounded wedge, bulging at the bottom, fibrous
    shape = 1 - np.abs(lx) * 2.0 * (0.55 + 0.45 * ly)
    boot = ss(0.0, 0.25, shape) * ss(0.0, 0.12, ly) * ss(1.05, 0.65, ly)
    fib = band(H, W, 40, 160, 122)
    fib_v = fnoise(H, W, 1.0, 123, aniso=(1.0, 0.15))
    rid = r.random(int(rows * cols + 4)); tint = rid[(row * cols + col).astype(int) % len(rid)]
    base = mix(srgb('#6d5b45')[None, None], srgb('#8c7a62')[None, None], tint)
    c = base * (0.8 + 0.25 * fib_v[..., None])
    c = mix(srgb('#3a2e22') * np.ones((H, W, 3)), c, 0.25 + 0.75 * boot)
    c = mix(c, srgb('#a29680')[None, None], ss(0.7, 1.0, ly) * boot * 0.35)  # sun-bleached rims
    hgt = boot * (0.6 + 0.4 * ly) + 0.15 * fib_v + 0.05 * fib
    out('trunk_c', np.clip(c, 0, 1), q=80); out('trunk_n', normal_from_height(cv2.resize(hgt, (256, 512), interpolation=cv2.INTER_AREA), 6.0), q=82)

def frond():
    """Date-palm frond card: u across (−1..1 around the rachis), v from base (v=0) to tip (v=1); alpha-cut leaflets."""
    W, H = 512, 1024; r = rng(131)
    col = np.zeros((H, W, 3), np.float32); alpha = np.zeros((H, W), np.float32)
    big = np.zeros((H * 2, W * 2, 3), np.float32); ba = np.zeros((H * 2, W * 2), np.float32); sc = 2
    n = 118
    for i in range(n):
        v = 0.05 + 0.93 * i / n
        y = (1 - v) * H
        L = W * 0.49 * math.sin(math.pi * (0.12 + v * 0.82)) * r.uniform(0.85, 1.05)
        for s in (-1, 1):
            if v < 0.16 and r.random() < 0.5: continue   # spines near the base
            ang = math.radians(r.uniform(28, 40)); bend = r.uniform(0.02, 0.08)
            tone = r.uniform(0.85, 1.12)
            g = np.array([0.30, 0.40, 0.25]) * tone; g2 = np.array([0.48, 0.56, 0.40]) * tone
            pts = []
            for t in np.linspace(0, 1, 14):
                x = W / 2 + s * t * L * math.sin(ang + bend * t)
                yy = y - t * L * math.cos(ang + bend * t) + t * t * L * 0.08
                pts.append((x, yy, t))
            wmax = 11.0 * (1 - 0.35 * v)
            for (x0, y0, t0), (x1, y1, t1) in zip(pts[:-1], pts[1:]):
                wdt = max(1, int(wmax * math.sin(math.pi * min(1, (t0 + 0.06) * 1.0)) * (1 - t0 * 0.6)))
                cc = g * (1 - t0) + g2 * t0 * 0.5 + g * t0 * 0.5
                cv2.line(big, (int(x0 * sc), int(y0 * sc)), (int(x1 * sc), int(y1 * sc)), tuple(float(q) for q in cc), wdt * sc, cv2.LINE_AA)
                cv2.line(ba, (int(x0 * sc), int(y0 * sc)), (int(x1 * sc), int(y1 * sc)), 1.0, wdt * sc, cv2.LINE_AA)
                cv2.line(big, (int(x0 * sc), int(y0 * sc)), (int(x1 * sc), int(y1 * sc)), tuple(float(q) * 1.25 for q in cc), max(1, sc // 2), cv2.LINE_AA)
    # rachis
    for t in np.linspace(0, 1, 60)[:-1]:
        w = int((10 - 7 * t) * sc); y0 = (1 - t) * H * sc; y1 = (1 - t - 1 / 60) * H * sc
        cv2.line(big, (W * sc // 2, int(y0)), (W * sc // 2, int(y1)), (0.55, 0.52, 0.36), w, cv2.LINE_AA); cv2.line(ba, (W * sc // 2, int(y0)), (W * sc // 2, int(y1)), 1.0, w, cv2.LINE_AA)
    col = cv2.resize(big, (W, H), interpolation=cv2.INTER_AREA); alpha = cv2.resize(ba, (W, H), interpolation=cv2.INTER_AREA)
    col = np.where(alpha[..., None] > 0.01, col / np.maximum(alpha[..., None], 1e-3), 0)
    # bleed colour into transparent texels (no dark fringes when mip-mapped)
    m = (alpha > 0.02).astype(np.uint8); fill = col.copy()
    for _ in range(12):
        dil = cv2.dilate(fill, np.ones((3, 3), np.uint8)); fill = np.where(m[..., None] > 0, fill, dil); m = cv2.dilate(m, np.ones((3, 3), np.uint8))
    out('frond_c', np.clip(fill, 0, 1), q=84, alpha=alpha)

# ------------------------------------------------------------------------------------------------ building facades
def facade_glass(name='glassfac', tint=('#5f7f93', '#2d4a5f'), seed=151):
    """Curtain wall module: 2 panes × 1 floor (3.0 × 3.8 m) — pane-to-pane tint/tilt variation, mullions, spandrel."""
    S = 512; r = rng(seed); yy, xx = np.mgrid[0:S, 0:S].astype(np.float32); u = (xx + 0.5) / S; v = 1 - (yy + 0.5) / S
    pane = np.floor(u * 2); spand = v < 0.2
    mull = (np.minimum(np.abs(u - 0.5), np.minimum(u, 1 - u)) < 0.012) | (np.minimum(v, 1 - v) < 0.012) | (np.abs(v - 0.2) < 0.008)
    t0, t1 = srgb(tint[0]), srgb(tint[1])
    g = mix(t0[None, None], t1[None, None], v[..., None] * 0.6 + 0.2)
    c = np.where(spand[..., None], g * 0.7, g)
    c = np.where(mull[..., None], srgb('#9aa3a8')[None, None], c)
    hgt = np.where(mull, 1.0, 0.0).astype(np.float32); hgt = wrapblur(hgt, 1.0)
    n = normal_from_height(hgt, 3.0)
    # each pane slightly tilted (reflections break up like real glass)
    tilt = np.stack([np.where(pane == 0, 0.03, -0.02), np.where(spand, 0.02, -0.015)], -1)
    n[..., 0] += tilt[..., 0] * 0.5 * ~mull; n[..., 1] += tilt[..., 1] * 0.5 * ~mull
    rough = np.where(mull, 0.45, np.where(spand, 0.25, 0.06)).astype(np.float32)
    e = np.zeros((S, S, 3), np.float32)
    lit = (~mull) & (~spand)
    e[lit] = srgb('#fff0d0') * 0.9
    interior = fnoise(S, S, 2.0, seed + 1)
    e = e * (0.6 + 0.6 * interior[..., None])
    out(name + '_c', np.clip(c, 0, 1), q=82); out(name + '_n', np.clip(n, 0, 1), q=85); out(name + '_r', rough, q=90); out(name + '_e', np.clip(e, 0, 1), q=80)

def facade_stone(name='stonefac', base='#e3d8c3', seed=161):
    """Precast stone module (2.6 × 3.8 m) with a deep recessed window, sill, joints and grime."""
    S = 512; r = rng(seed); yy, xx = np.mgrid[0:S, 0:S].astype(np.float32); u = (xx + 0.5) / S; v = 1 - (yy + 0.5) / S
    win = (u > 0.28) & (u < 0.72) & (v > 0.18) & (v < 0.86)
    reveal = (u > 0.25) & (u < 0.75) & (v > 0.15) & (v < 0.89) & ~win
    grain = fnoise(S, S, 1.0, seed + 1); mott = fnoise(S, S, 2.6, seed + 2)
    c = srgb(base)[None, None] * (0.93 + 0.1 * grain[..., None]) * (0.95 + 0.07 * mott[..., None])
    joints = (np.abs(v - 0.5) < 0.003) | (np.minimum(u, 1 - u) < 0.003) | (np.minimum(v, 1 - v) < 0.004)
    c = np.where(joints[..., None], c * 0.78, c)
    streak = ss(0.15, 0.0, np.abs(u - 0.5) - 0.22) * (v < 0.17) * (v > 0.0) * 0.18
    c = c * (1 - streak[..., None])
    c = np.where(reveal[..., None], c * 0.72, c)
    gl = mix(srgb('#3b4b57')[None, None], srgb('#6f8796')[None, None], v[..., None])
    frame = win & ((np.abs(u - 0.5) < 0.01) | (np.abs(u - 0.28) < 0.012) | (np.abs(u - 0.72) < 0.012) | (np.abs(v - 0.86) < 0.012) | (np.abs(v - 0.18) < 0.012) | (np.abs(v - 0.62) < 0.008))
    c = np.where(win[..., None], gl, c); c = np.where(frame[..., None], srgb('#5a5f63')[None, None], c)
    sill = (u > 0.24) & (u < 0.76) & (v > 0.13) & (v < 0.155); c = np.where(sill[..., None], srgb(base)[None, None] * 1.05, c)
    hgt = np.where(win | reveal, 0.0, 1.0).astype(np.float32); hgt = np.where(sill, 1.2, hgt); hgt = wrapblur(hgt, 1.2) + 0.03 * grain
    n = normal_from_height(hgt, 6.0)
    rough = np.where(win & ~frame, 0.07, 0.82).astype(np.float32)
    e = np.zeros((S, S, 3), np.float32); e[win & ~frame] = srgb('#ffd9a0'); e = e * (0.5 + 0.7 * fnoise(S, S, 2.0, seed + 3)[..., None])
    out(name + '_c', np.clip(c, 0, 1), q=82); out(name + '_n', np.clip(n, 0, 1), q=85); out(name + '_r', rough, q=90); out(name + '_e', np.clip(e, 0, 1), q=80)

def facade_mash(name='mashfac', seed=171):
    """Beige wall with an Arabesque screen (mashrabiya) over dark glazing (3.4 × 4.2 m)."""
    S = 512; yy, xx = np.mgrid[0:S, 0:S].astype(np.float32); u = (xx + 0.5) / S; v = 1 - (yy + 0.5) / S
    grain = fnoise(S, S, 1.0, seed + 1)
    c = srgb('#d6c4a2')[None, None] * (0.93 + 0.1 * grain[..., None]) * np.ones((S, S, 3))
    scr = (u > 0.16) & (u < 0.84) & (v > 0.12) & (v < 0.86)
    # 8-point star lattice
    q = 64; gx = (xx % q) / q - 0.5; gy = (yy % q) / q - 0.5
    a = np.arctan2(gy, gx); rr = np.sqrt(gx * gx + gy * gy)
    star = 0.36 * (0.78 + 0.22 * np.cos(8 * a))
    line = (np.abs(rr - star) < 0.035) | (np.abs(np.abs(gx) - 0.5) < 0.03) | (np.abs(np.abs(gy) - 0.5) < 0.03) | (np.abs(np.abs(gx) - np.abs(gy)) < 0.025)
    holes = scr & ~line
    c = np.where(holes[..., None], srgb('#2c2a26')[None, None], c)
    c = np.where((scr & line)[..., None], srgb('#c9b086')[None, None] * (0.9 + 0.1 * grain[..., None]), c)
    hgt = np.where(holes, 0.0, 1.0).astype(np.float32); hgt = np.where(scr, hgt, 1.3); hgt = wrapblur(hgt, 0.8)
    rough = np.where(holes, 0.2, 0.85).astype(np.float32)
    e = np.zeros((S, S, 3), np.float32); e[holes] = srgb('#ffc77a'); e *= (0.5 + 0.6 * fnoise(S, S, 2.0, seed + 2))[..., None]
    out(name + '_c', np.clip(c, 0, 1), q=82); out(name + '_n', normal_from_height(hgt, 4.0), q=85); out(name + '_r', rough, q=90); out(name + '_e', np.clip(e, 0, 1), q=80)

# ------------------------------------------------------------------------------------------------ water, sand, hedge, wood
def water():
    S = 512; r = rng(181); yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    h = np.zeros((S, S), np.float32)
    for i in range(48):
        kx, ky = r.integers(-14, 15), r.integers(-14, 15)
        if kx == 0 and ky == 0: continue
        k = math.hypot(kx, ky); a = 1.0 / k ** 1.25
        h += a * np.sin(2 * math.pi * (kx * xx + ky * yy) / S + r.uniform(0, 6.28))
    h += 0.25 * band(S, S, 20, 60, 182)
    h = (h - h.min()) / (h.max() - h.min())
    out('water_n', normal_from_height(h, 6.0), q=88)

def sand():
    S = 512; r = rng(191)
    big = fnoise(S, S, 2.8, 192); fine = fnoise(S, S, 0.5, 193); rip = band(S, S, 10, 20, 194)
    c = mix(srgb('#c4ab83')[None, None], srgb('#d8c4a0')[None, None], 0.3 + 0.7 * big) * (0.92 + 0.12 * fine[..., None])
    stones = ss(0.9, 0.98, wrapblur(r.random((S, S)).astype(np.float32), 1.0) * 4 - 1.5)
    c = mix(c, srgb('#8b7a62')[None, None], stones * 0.6)
    out('sand_c', np.clip(c, 0, 1), q=80)

def hedge():
    """Clipped ficus hedge: dense small leaves, light from above, darker gaps."""
    S = 512; r = rng(201)
    big = np.zeros((S * 3, S * 3, 3), np.float32); hb = np.zeros((S * 3, S * 3), np.float32)
    c = np.ones((S, S, 3), np.float32) * srgb('#1d2a14')
    n = 16000
    for i in range(n):
        y, x = r.uniform(0, S, 2); a = r.uniform(0, 180); l = r.uniform(5, 9); w = l * r.uniform(0.45, 0.6)
        tone = r.uniform(0.7, 1.2); col = np.array([0.22, 0.31, 0.15]) * tone
        if r.random() < 0.25: col = col * 1.3 + np.array([0.04, 0.05, 0.0])
        lum = 0.75 + 0.5 * r.random()
        cv2.ellipse(big, (int((x + S) * 4), int((y + S) * 4)), (int(l * 4), int(w * 4)), a, 0, 360, tuple(float(q * lum) for q in col), -1, cv2.LINE_AA, 2)
        cv2.ellipse(hb, (int((x + S) * 4), int((y + S) * 4)), (int(l * 4), int(w * 4)), a, 0, 360, float(i / n), -1, cv2.LINE_AA, 2)
    for dy in range(3):
        for dx in range(3):
            t = big[dy * S:(dy + 1) * S, dx * S:(dx + 1) * S]; m = t.max(-1) > 0; c[m] = t[m]
    h = np.zeros((S, S), np.float32)
    for dy in range(3):
        for dx in range(3): h = np.maximum(h, hb[dy * S:(dy + 1) * S, dx * S:(dx + 1) * S])
    ao = 0.65 + 0.35 * fnoise(S, S, 2.0, 202)
    c *= ao[..., None]
    out('hedge_c', np.clip(c, 0, 1), q=80); out('hedge_n', normal_from_height(wrapblur((h > 0).astype(np.float32) * (0.5 + 0.5 * fnoise(S, S, 1.0, 203)), 0.8), 3.0), q=80)

def wood():
    W, H = 256, 512; r = rng(211)
    gr = fnoise(H, W, 1.2, 212, aniso=(1.0, 0.08)); knots = ss(0.8, 0.95, fnoise(H, W, 2.5, 213))
    c = mix(srgb('#3d2a1a')[None, None], srgb('#6b4c31')[None, None], 0.2 + 0.8 * gr) * (1 - 0.3 * knots[..., None])
    weather = fnoise(H, W, 2.0, 214); c = mix(c, srgb('#8a7a66')[None, None], ss(0.6, 0.9, weather) * 0.35)
    out('wood_c', np.clip(c, 0, 1), q=80); out('wood_n', normal_from_height(gr * 0.8 + knots * 0.3, 4.0), q=82)

def facade_shop(name='shopfac', seed=231):
    """Street-level podium module (4.0 × 4.5 m): storefront glazing with mullions, interior glow, sign band, stone base/lintel."""
    S = 512; yy, xx = np.mgrid[0:S, 0:S].astype(np.float32); u = (xx + 0.5) / S; v = 1 - (yy + 0.5) / S
    grain = fnoise(S, S, 1.0, seed + 1)
    stone = srgb('#d9cdb6')[None, None] * (0.93 + 0.1 * grain[..., None]) * np.ones((S, S, 3))
    glass = (v > 0.03) & (v < 0.70) & (u > 0.04) & (u < 0.96)
    mull = glass & ((np.abs(u - 0.5) < 0.008) | (np.abs(u - 0.04) < 0.01) | (np.abs(u - 0.96) < 0.01) | (np.abs(v - 0.55) < 0.006))
    band = (v > 0.72) & (v < 0.87) & (u > 0.06) & (u < 0.94)
    interior = fnoise(S, S, 2.2, seed + 2)
    gl = mix(srgb('#1f2a30')[None, None], srgb('#4c5f68')[None, None], (v[..., None] * 0.9) + 0.1 * interior[..., None])
    # shelves / people silhouettes inside (dim)
    shelves = (np.sin(v * 2 * math.pi * 9) > 0.85) & (v < 0.45)
    gl = np.where(shelves[..., None], gl * 1.25, gl)
    c = np.where(glass[..., None], gl, stone)
    c = np.where(mull[..., None], srgb('#3c4144')[None, None], c)
    c = np.where(band[..., None], srgb('#2f3336')[None, None] * (0.95 + 0.1 * grain[..., None]), c)
    hgt = np.where(glass, 0.0, 1.0).astype(np.float32); hgt = np.where(band, 0.6, hgt); hgt = wrapblur(hgt, 1.0)
    rough = np.where(glass & ~mull, 0.05, np.where(band, 0.4, 0.8)).astype(np.float32)
    e = np.zeros((S, S, 3), np.float32); e[glass & ~mull] = srgb('#ffd9a8'); e = e * (0.35 + 0.75 * interior[..., None])
    e[band] = srgb('#f6e7c8') * 0.5
    out(name + '_c', np.clip(c, 0, 1), q=82); out(name + '_n', normal_from_height(hgt, 5.0), q=85); out(name + '_r', rough, q=90); out(name + '_e', np.clip(e, 0, 1), q=80)

def cloth():
    """cotton (thobe skirt / ghutra) detail normal: fine twill weave + soft random creases; tile ≈ 0.3 m."""
    S = 512; r = rng(221); yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    weave = 0.5 + 0.5 * np.sin((xx + yy * 0.5) * 2 * math.pi / 3.0) * 0.5 + 0.25 * np.sin(yy * 2 * math.pi / 4.0)
    creases = fnoise(S, S, 3.2, 222, aniso=(1.0, 0.35)); creases2 = band(S, S, 2, 7, 223)
    h = 0.05 * weave + 0.7 * creases + 0.25 * creases2
    out('cloth_n', normal_from_height(wrapblur(h, 0.6), 10.0), q=86)

JOBS = dict(cloth=cloth, shopfac=lambda: facade_shop(), road=road, paver=lambda: pavers(), souqfloor=souqstone, plaster=plaster, grass=grass, curb=curb, trunk=trunk, frond=frond,
            glassfac=lambda: facade_glass(), glassfac2=lambda: facade_glass('glassfac2', ('#7d9fb8', '#3a5f7d'), 155), stonefac=lambda: facade_stone(),
            mashfac=lambda: facade_mash(), water=water, sand=sand, hedge=hedge, wood=wood)
for name, fn in JOBS.items():
    if ONLY and name not in ONLY: continue
    t0 = time.time(); print(name, flush=True); fn(); print(f'  ({time.time() - t0:.1f}s)')
print('total %.1f KB' % (sum(n for _, _, n in REPORT) / 1024))
