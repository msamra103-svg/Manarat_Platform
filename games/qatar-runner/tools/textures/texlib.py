"""عدّاء قطر — small library for tileable, photo-like PBR textures (numpy / OpenCV), all original procedural work.

Every generator is periodic (wraps seamlessly) so the maps can repeat on the GPU without seams.
"""
import numpy as np, cv2
from scipy.spatial import cKDTree

def rng(seed): return np.random.default_rng(seed)

def fnoise(h, w, beta=2.0, seed=0, fmin=1.0, aniso=(1.0, 1.0)):
    """Periodic fractal noise via spectral synthesis (1/f^beta power spectrum), normalised to 0..1."""
    r = rng(seed); wn = r.standard_normal((h, w))
    F = np.fft.fft2(wn)
    fy = np.fft.fftfreq(h)[:, None] * h / aniso[0]; fx = np.fft.fftfreq(w)[None, :] * w / aniso[1]
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    amp = 1.0 / np.maximum(f, fmin) ** (beta / 2); amp[0, 0] = 0
    n = np.real(np.fft.ifft2(F * amp))
    n -= n.min(); n /= n.max() + 1e-9; return n

def band(h, w, f0, f1, seed=0):
    """Periodic band-limited noise between integer frequencies f0..f1 (cycles per tile)."""
    r = rng(seed); F = np.fft.fft2(r.standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None] * h; fx = np.fft.fftfreq(w)[None, :] * w; f = np.sqrt(fx * fx + fy * fy)
    m = ((f >= f0) & (f <= f1)).astype(float)
    n = np.real(np.fft.ifft2(F * m)); n -= n.min(); n /= n.max() + 1e-9; return n

def worley(h, w, pts, k=2):
    """Periodic Worley distances (in pixels) to the k nearest of `pts` (N×2 array of (y, x) in pixels)."""
    tiles = np.concatenate([pts + [dy * h, dx * w] for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
    ids = np.tile(np.arange(len(pts)), 9)
    tree = cKDTree(tiles)
    yy, xx = np.mgrid[0:h, 0:w]
    d, i = tree.query(np.stack([yy.ravel() + 0.5, xx.ravel() + 0.5], 1), k=k, workers=-1)
    return d.reshape(h, w, k), ids[i].reshape(h, w, k)

def ss(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def blur(img, s):
    if s <= 0: return img
    return cv2.GaussianBlur(img.astype(np.float32), (0, 0), s, borderType=cv2.BORDER_WRAP if hasattr(cv2, 'BORDER_WRAP') else cv2.BORDER_REFLECT)

def wrapblur(img, s):
    """Gaussian blur with periodic boundaries."""
    if s <= 0: return img
    p = int(3 * s) + 2; img = img.astype(np.float32)
    big = np.pad(img, ((p, p), (p, p)) + ((0, 0),) * (img.ndim - 2), mode='wrap')
    big = cv2.GaussianBlur(big, (0, 0), s)
    return big[p:-p, p:-p]

def normal_from_height(hgt, strength=1.0):
    """Tangent-space normal map (OpenGL convention, +Y up in UV) from a periodic height field (0..1)."""
    dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5
    dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5
    nx = -dx * strength; ny = dy * strength; nz = np.ones_like(hgt)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5

def srgb(c):  # hex or tuple → linear-ish float colour in display space 0..1 (we paint in display space)
    if isinstance(c, str): c = c.lstrip('#'); return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255
    return np.array(c, np.float32) / 255

def lerp(a, b, t): return a + (b - a) * t

def mix(a, b, t):
    t = np.asarray(t, np.float32)
    if t.ndim == 2: t = t[..., None]
    return a * (1 - t) + b * t

def save(img, path, q=82, alpha=None, lossless=False):
    from PIL import Image
    a = np.clip(img, 0, 1)
    if a.ndim == 2: im = Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'L').convert('RGB')
    else: im = Image.fromarray((a[..., :3] * 255 + 0.5).astype(np.uint8), 'RGB')
    if alpha is not None:
        im = im.convert('RGBA'); im.putalpha(Image.fromarray((np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8), 'L'))
    im.save(path, 'WEBP', quality=q, method=6, lossless=lossless)
    import os; return os.path.getsize(path)

def stroke_lines(h, w, segs, width, img=None, value=1.0):
    """Draw anti-aliased line segments (list of (y0,x0,y1,x1)) with wrap-around (3×3 tiling)."""
    out = np.zeros((h, w), np.float32) if img is None else img
    big = np.zeros((h * 3, w * 3), np.float32)
    for (y0, x0, y1, x1) in segs:
        cv2.line(big, (int((x0 + w) * 16), int((y0 + h) * 16)), (int((x1 + w) * 16), int((y1 + h) * 16)), value, width, cv2.LINE_AA, 4)
    acc = np.zeros((h, w), np.float32)
    for dy in range(3):
        for dx in range(3): acc = np.maximum(acc, big[dy * h:(dy + 1) * h, dx * w:(dx + 1) * w])
    return np.maximum(out, acc)
