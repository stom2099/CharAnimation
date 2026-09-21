"""Draws the bundled sample sprites.

They ship with the app so a visitor can try the animation step without
uploading anything, and so the end-to-end test has a deterministic input with a
real alpha channel.
"""
from PIL import Image, ImageDraw
import math, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'samples')
os.makedirs(OUT, exist_ok=True)
S = 4  # supersampling factor for smooth edges


def new(w, h):
    img = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def save(img, w, h, name):
    img = img.resize((w, h), Image.LANCZOS)
    img.save(os.path.join(OUT, name))
    print('wrote', name, img.size)


def e(d, box, fill, outline=None, width=3):
    d.ellipse([v * S for v in box], fill=fill, outline=outline,
              width=width * S if outline else 0)


def r(d, box, fill, radius=0, outline=None, width=3):
    if radius:
        d.rounded_rectangle([v * S for v in box], radius=radius * S, fill=fill,
                            outline=outline, width=width * S if outline else 0)
    else:
        d.rectangle([v * S for v in box], fill=fill, outline=outline,
                    width=width * S if outline else 0)


def poly(d, pts, fill, outline=None, width=3):
    d.polygon([(x * S, y * S) for x, y in pts], fill=fill, outline=outline,
              width=width * S if outline else 0)


# ---------------------------------------------------------------- cat
W, H = 320, 400
img, d = new(W, H)
INK = (36, 42, 52, 255)
FUR = (247, 178, 103, 255)
FUR2 = (232, 150, 72, 255)
# tail: a filled tapered ribbon. Stroking a polyline would leave faint bands
# where the segments overlap once the supersampled image is downscaled.
def bezier(p0, p1, p2, p3, steps=90):
    out = []
    for i in range(steps + 1):
        tt = i / steps
        m = 1 - tt
        out.append((
            m ** 3 * p0[0] + 3 * m * m * tt * p1[0] + 3 * m * tt * tt * p2[0] + tt ** 3 * p3[0],
            m ** 3 * p0[1] + 3 * m * m * tt * p1[1] + 3 * m * tt * tt * p2[1] + tt ** 3 * p3[1],
        ))
    return out


def ribbon(points, w0, w1):
    left, right = [], []
    n = len(points) - 1
    for i, (x, y) in enumerate(points):
        px, py = points[max(0, i - 1)]
        nx, ny = points[min(n, i + 1)]
        dx, dy = nx - px, ny - py
        length = math.hypot(dx, dy) or 1
        ox, oy = -dy / length, dx / length
        half = (w0 + (w1 - w0) * (i / n)) / 2
        left.append((x + ox * half, y + oy * half))
        right.append((x - ox * half, y - oy * half))
    return left + right[::-1]


tail = bezier((224, 340), (298, 342), (302, 266), (244, 248))
poly(d, ribbon(tail, 20, 13), FUR2, INK, width=3)
e(d, (236, 240, 256, 258), FUR2, INK, width=3)

# body
e(d, (96, 214, 232, 372), FUR, INK)
# legs
e(d, (118, 330, 152, 374), FUR, INK)
e(d, (178, 330, 212, 374), FUR, INK)
# head
e(d, (104, 128, 226, 250), FUR, INK)
# ears
poly(d, [(112, 158), (122, 104), (158, 140)], FUR, INK)
poly(d, [(218, 158), (208, 104), (172, 140)], FUR, INK)
poly(d, [(122, 152), (128, 122), (148, 142)], (250, 160, 170, 255))
poly(d, [(208, 152), (202, 122), (182, 142)], (250, 160, 170, 255))
# face
e(d, (134, 172, 152, 200), INK)
e(d, (178, 172, 196, 200), INK)
e(d, (139, 177, 146, 187), (255, 255, 255, 255))
e(d, (183, 177, 190, 187), (255, 255, 255, 255))
poly(d, [(157, 206), (173, 206), (165, 217)], (240, 120, 130, 255))
d.arc([148 * S, 210 * S, 166 * S, 226 * S], 0, 150, fill=INK, width=3 * S)
d.arc([164 * S, 210 * S, 182 * S, 226 * S], 30, 180, fill=INK, width=3 * S)
for dy, x0 in ((-6, 0), (2, 0), (10, 0)):
    d.line([(118 * S, (198 + dy) * S), (78 * S, (192 + dy * 2) * S)], fill=INK, width=2 * S)
    d.line([(212 * S, (198 + dy) * S), (252 * S, (192 + dy * 2) * S)], fill=INK, width=2 * S)
# belly
e(d, (130, 262, 198, 344), (255, 226, 190, 255))
save(img, W, H, 'cat.png')

# ---------------------------------------------------------------- plant
W, H = 300, 420
img, d = new(W, H)
POT = (198, 106, 78, 255)
LEAF = (70, 170, 120, 255)
LEAF2 = (46, 140, 98, 255)
STEM = (58, 130, 92, 255)
for angle, length, leaf in ((-52, 150, LEAF2), (-20, 196, LEAF), (14, 186, LEAF2), (46, 142, LEAF)):
    a = math.radians(angle - 90)
    x0, y0 = 150, 300
    x1, y1 = x0 + math.cos(a) * length, y0 + math.sin(a) * length
    d.line([(x0 * S, y0 * S), (x1 * S, y1 * S)], fill=STEM, width=7 * S)
    lw, lh = 44, 74
    leafimg = Image.new('RGBA', (lw * S, lh * S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(leafimg)
    ld.ellipse([0, 0, lw * S - 1, lh * S - 1], fill=leaf, outline=(28, 92, 66, 255), width=3 * S)
    ld.line([(lw * S // 2, 6 * S), (lw * S // 2, lh * S - 6 * S)], fill=(28, 92, 66, 160), width=2 * S)
    leafimg = leafimg.rotate(-(angle), expand=True, resample=Image.BICUBIC)
    img.alpha_composite(leafimg, (int(x1 * S - leafimg.width / 2), int(y1 * S - leafimg.height / 2)))
poly(d, [(104, 300), (196, 300), (182, 392), (118, 392)], POT, (140, 68, 48, 255))
r(d, (98, 288, 202, 312), (222, 126, 96, 255), radius=8, outline=(140, 68, 48, 255))
save(img, W, H, 'plant.png')

# ---------------------------------------------------------------- balloon
W, H = 280, 420
img, d = new(W, H)
RED = (236, 92, 104, 255)
e(d, (48, 30, 232, 250), RED, (170, 52, 66, 255))
e(d, (84, 62, 132, 118), (255, 255, 255, 90))
poly(d, [(128, 244), (152, 244), (140, 272)], (196, 66, 80, 255))
pts = []
for i in range(41):
    tt = i / 40
    pts.append((140 + math.sin(tt * math.pi * 3) * 16 * tt, 268 + tt * 132))
d.line([(x * S, y * S) for x, y in pts], fill=(120, 128, 140, 255), width=3 * S, joint='curve')
save(img, W, H, 'balloon.png')

# ------------------------------------------------- test fixture (tiny, sharp)
W, H = 96, 128
img, d = new(W, H)
r(d, (28, 8, 68, 48), (90, 200, 250, 255), radius=8)
r(d, (36, 48, 60, 96), (250, 200, 90, 255), radius=6)
r(d, (20, 96, 76, 118), (140, 220, 160, 255), radius=6)
save(img, W, H, 'test-figure.png')
