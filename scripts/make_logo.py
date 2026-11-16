"""Draws the W Play mark: a fine-line W monogram with a play triangle set inside it."""
import sys
from PIL import Image, ImageDraw

RES, ASSETS = sys.argv[1], sys.argv[2]
SS = 8  # supersampling factor
W_PTS = [(31, 38), (42, 70), (54, 44), (66, 70), (77, 38)]
TRI = [(52, 58.5), (52, 66.5), (58.5, 62.5)]
TOP, BOTTOM = (251, 245, 236), (220, 203, 182)  # ivory
BG_EDGE, BG_CENTRE = (58, 6, 14), (138, 26, 43)  # oxblood
TRI_INAPP = (208, 80, 95)


def mark_mask(px, stroke=3.2, ring=True, scale=1.0, parts=('w', 'tri')):
    """Alpha mask of the mark on a 108-unit canvas rendered at px pixels."""
    n = px * SS
    k = n / 108.0
    def pt(p):
        return ((p[0] - 54) * scale + 54) * k, ((p[1] - 54) * scale + 54) * k
    m = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(m)
    w = stroke * scale * k
    pts = [pt(p) for p in W_PTS]
    if 'w' in parts:
        d.line(pts, fill=255, width=round(w), joint="curve")
        for x, y in pts:
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)
    if 'tri' in parts:
        d.polygon([pt(p) for p in TRI], fill=255)
    if ring:
        r, rw = 31 * scale * k, 0.9 * scale * k
        ring_layer = Image.new("L", (n, n), 0)
        ImageDraw.Draw(ring_layer).ellipse(
            [n / 2 - r, n / 2 - r, n / 2 + r, n / 2 + r], outline=90, width=max(1, round(rw)))
        m = Image.composite(m, ring_layer, m)
    return m.resize((px, px), Image.LANCZOS)


def gold(px):
    g = Image.new("RGB", (px, px))
    d = ImageDraw.Draw(g)
    for y in range(px):
        t = min(1.0, max(0.0, (y / px - 0.33) / 0.34))
        d.line([(0, y), (px, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)))
    return g


def background(px):
    n = px * 2
    bg = Image.new("RGB", (n, n), BG_EDGE)
    d = ImageDraw.Draw(bg)
    steps = 60
    for i in range(steps):
        t = i / steps
        r = n * 0.75 * (1 - t)
        c = tuple(round(a + (b - a) * t) for a, b in zip(BG_EDGE, BG_CENTRE))
        d.ellipse([n / 2 - r, n * 0.42 - r, n / 2 + r, n * 0.42 + r], fill=c)
    return bg.resize((px, px), Image.LANCZOS)


def launcher(px, round_shape):
    # Legacy (pre-Android 8) icons: the mark is enlarged since there is no adaptive-icon margin.
    icon = background(px).convert("RGBA")
    icon.paste(gold(px), (0, 0), mark_mask(px, scale=1.35))
    shape = Image.new("L", (px * SS, px * SS), 0)
    d = ImageDraw.Draw(shape)
    if round_shape:
        d.ellipse([0, 0, px * SS - 1, px * SS - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, px * SS - 1, px * SS - 1], radius=px * SS * 0.22, fill=255)
    icon.putalpha(shape.resize((px, px), Image.LANCZOS))
    return icon


for name, px in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    launcher(px, False).save(f"{RES}/mipmap-{name}/ic_launcher.png")
    launcher(px, True).save(f"{RES}/mipmap-{name}/ic_launcher_round.png")

# In-app mark: transparent background, no ring, slightly heavier line for small sizes.
px = 288
# In the app the mark sits on black, so the W is ivory and the play triangle carries the oxblood.
mark = gold(px).convert("RGBA")
mark.putalpha(mark_mask(px, stroke=3.8, ring=False, scale=1.75, parts=('w',)))
tri = Image.new("RGBA", (px, px), TRI_INAPP + (255,))
tri.putalpha(mark_mask(px, stroke=3.8, ring=False, scale=1.75, parts=('tri',)))
mark = Image.alpha_composite(mark, tri)
mark.save(f"{ASSETS}/logo.png")

# Preview sheet for review.
sheet = Image.new("RGB", (700, 320), (3, 3, 3))
sheet.paste(launcher(256, False), (32, 32), launcher(256, False))
sheet.paste(launcher(96, True), (330, 32), launcher(96, True))
sheet.paste(launcher(48, True), (450, 32), launcher(48, True))
sheet.paste(mark.resize((144, 144), Image.LANCZOS), (330, 150), mark.resize((144, 144), Image.LANCZOS))
sheet.save(sys.argv[3])
