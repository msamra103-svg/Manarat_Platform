"""Basketball kits + web textures from Microsoft Rocketbox (MIT) source maps.

Recolours the Sports_Male_04 tank top / shorts into a maroon home kit and a white
away kit while keeping the original fabric shading (folds come from the luminance
of the source). Adds front/back numbers. Converts colour/normal/specular maps to
web JPEG/PNG at 1024 px (roughness = inverted, remapped specular).
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = os.path.join(os.environ.get('ROCKETBOX', 'Microsoft-Rocketbox'), 'Assets/Avatars/Professions/')
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
N = 1024


def load(p):
    return np.asarray(Image.open(SRC + p).convert('RGB')).astype(np.float32) / 255


def save(a, name, q=86, size=N):
    im = Image.fromarray(np.clip(a * 255 + .5, 0, 255).astype(np.uint8))
    if size and im.size[0] != size: im = im.resize((size, size), Image.LANCZOS)
    im.save(OUT + name, quality=q, optimize=True, progressive=True)


def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def srgb2lin(c): return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
def lin2srgb(c): return np.where(c <= .0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - .055)


body = load('Sports_Male_04/Textures/m026_body_color.tga')
H, W = body.shape[:2]
r, g, b = body[..., 0], body[..., 1], body[..., 2]
lum = .2126 * srgb2lin(r) + .7152 * srgb2lin(g) + .0722 * srgb2lin(b)
yy, xx = np.mgrid[0:H, 0:W]

blue = (b > r + .1) & (b > g + .04)
blue = np.asarray(Image.fromarray((blue * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
blue &= (xx > 640) & (xx < 1410)
dark_panel = blue & (lum < .035)          # navy centre panels
trim = blue & (lum > .12)                 # light-blue piping
whiteish = (r > .55) & (g > .55) & (b > .55) & (np.abs(r - b) < .14)
shorts = whiteish & (yy > 40) & (yy < 400) & ((xx < 640) | (xx > 1410))
shorts = np.asarray(Image.fromarray((shorts * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))) > 0


def shade(mask, colour, ref=None, strength=1.0):
    """colour * (luminance/region-median) keeps folds; works in linear light."""
    m = ref if ref is not None else mask
    med = np.median(lum[m]) + 1e-4
    f = np.clip((lum / med - 1) * strength + 1, .35, 1.6)[..., None]
    c = srgb2lin(colour)[None, None, :] * f
    return lin2srgb(c)


def soft(mask, rad=1.2):
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rad))
    return (np.asarray(im).astype(np.float32) / 255)[..., None]


def number_layer(text, colour, outline):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # front (lower half of the strip, upright). Centre x ~1024 in 2048 space.
    f1 = ImageFont.truetype(FONT, 230)
    d.text((1024, 1235), text, font=f1, fill=colour, anchor='mm', stroke_width=10, stroke_fill=outline)
    # back (upper half, rotated 180 degrees)
    back = Image.new('RGBA', (700, 520), (0, 0, 0, 0))
    db = ImageDraw.Draw(back)
    f2 = ImageFont.truetype(FONT, 330)
    db.text((350, 260), text, font=f2, fill=colour, anchor='mm', stroke_width=12, stroke_fill=outline)
    back = back.rotate(180)
    layer.alpha_composite(back, (1024 - 350, 560 - 260))
    a = np.asarray(layer).astype(np.float32) / 255
    return a[..., :3], a[..., 3:4]


def kit(name, jersey, panel, piping, shorts_col, num_col, num_outline, numbers):
    base = body.copy()
    jc = shade(blue & ~dark_panel, hexrgb(jersey), blue & ~dark_panel & ~trim, .9)
    pc = shade(dark_panel, hexrgb(panel), dark_panel, .9)
    tc = shade(trim, hexrgb(piping), trim, .5)
    m_j = soft(blue); m_p = soft(dark_panel); m_t = soft(trim)
    out = base * (1 - m_j) + jc * m_j
    out = out * (1 - m_p) + pc * m_p
    out = out * (1 - m_t) + tc * m_t
    sc = shade(shorts, hexrgb(shorts_col), shorts, 1.0)
    m_s = soft(shorts)
    out = out * (1 - m_s) + sc * m_s
    # thin hem trim on the shorts (bottom band of the shorts region)
    hem = shorts & (yy > 330) & (yy < 372)
    m_h = soft(hem, 1.5)
    out = out * (1 - m_h) + shade(hem, hexrgb(piping), shorts, .6) * m_h
    for n in numbers:
        rgb, a = number_layer(str(n), num_col, num_outline)
        # print follows fabric shading (lighter than the base cloth)
        f = np.clip(lum / (np.median(lum[blue]) + 1e-4), .55, 1.35)[..., None] ** .5
        printed = rgb * f
        res = out * (1 - a * m_j) + printed * a * m_j
        save(res, f'kit_{name}_{n}.jpg', q=88)
    return out


kit('home', '#8a1538', '#6a0f2a', '#f4efe6', '#7c1333', (250, 247, 240), (196, 160, 98), [4, 7, 10, 12])
kit('away', '#eeebe4', '#dcd8cf', '#1d2b3b', '#22303f', (29, 43, 59), (210, 205, 195), [5, 8, 14])

# shared body maps
nrm = load('Sports_Male_04/Textures/m026_body_normal.tga'); save(nrm, 'body_normal.jpg', q=90)
spec = load('Sports_Male_04/Textures/m026_body_specular.tga')[..., 0]
rough = np.clip(.92 - spec * .75, .32, .95)
save(np.repeat(rough[..., None], 3, 2), 'body_rough.jpg', q=85)

for tag, folder, code in [('a', 'Sports_Male_04', 'm026'), ('b', 'Sports_Male_02', 'm301'), ('c', 'Sports_Male_03', 'm300')]:
    save(load(f'{folder}/Textures/{code}_head_color.tga'), f'head_{tag}.jpg', q=88)
    save(load(f'{folder}/Textures/{code}_head_normal.tga'), f'head_{tag}_normal.jpg', q=90)
    s = load(f'{folder}/Textures/{code}_head_specular.tga')[..., 0]
    save(np.repeat(np.clip(.85 - s * .7, .3, .95)[..., None], 3, 2), f'head_{tag}_rough.jpg', q=85)
hair = Image.open(SRC + 'Sports_Male_03/Textures/m300_opacity_color.tga').convert('RGBA').resize((512, 512), Image.LANCZOS)
hair.save(OUT + 'hair_c.png', optimize=True)
print('ok', sorted(os.listdir(OUT)))
