"""Builds assets/textures/archer_kit.jpg from the Rocketbox-derived bowling kit atlas (MIT).
Removes the bowling emblem, adds a charcoal shoulder yoke (front and back) with white piping lines
(sports archery shirt) and slightly darkens the trousers. Run: python3 tools/make_archer_kit.py"""
from PIL import Image, ImageDraw, ImageFilter
import random, os
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, '..', '..', 'bowling', 'assets', 'textures', 'bowler_kit.jpg')
out = os.path.join(here, '..', 'assets', 'textures', 'archer_kit.jpg')
im = Image.open(src).convert('RGB')
px = im.load()
W, H = im.size
random.seed(7)
# 1) erase the chest emblem with surrounding fabric (copy a clean patch from below it)
patch = im.crop((430, 560, 566, 696))
im.paste(patch, (430, 400))
# 2) yoke: torso column x 330..670, top region y 45..250 -> charcoal fabric, keep original luminance noise
def fabric(base, x, y):
    r, g, b = px[x, y]
    l = (r * 0.3 + g * 0.59 + b * 0.11) / 255.0
    k = 0.75 + 0.5 * l
    return tuple(int(min(255, c * k)) for c in base)
for y in range(345, 545):
    for x in range(330, 672):
        r, g, b = px[x, y]
        if r > 90 and g < 80:   # maroon fabric only (keeps white edges)
            px[x, y] = fabric((46, 50, 58), x, y)
d = ImageDraw.Draw(im)
d.line([(338, 343), (664, 343)], fill=(236, 232, 226), width=4)
d.line([(338, 547), (664, 547)], fill=(236, 232, 226), width=4)
# 3) trousers/tights: slightly deeper charcoal
for y in range(0, 470):
    for x in list(range(0, 300)) + list(range(700, 1024)):
        r, g, b = px[x, y]
        if abs(r - g) < 18 and b > r and r < 90:
            px[x, y] = (int(r * 0.82), int(g * 0.84), int(b * 0.9))
im = im.filter(ImageFilter.SMOOTH_MORE) if False else im
im.save(out, quality=90)
print('wrote', out)
