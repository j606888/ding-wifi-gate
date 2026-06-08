#!/usr/bin/env python3
"""Generate vintage circular button-style LINE Bot rich menu."""

from PIL import Image, ImageDraw, ImageFont
import numpy as np
import math

np.random.seed(42)

W, H = 2500, 843

# ─── Background: warm cream with subtle vertical gradient + paper noise ────────
top_col = np.array([235, 224, 198], dtype=np.float32)
bot_col = np.array([214, 200, 168], dtype=np.float32)

arr = np.zeros((H, W, 3), dtype=np.float32)
for row in range(H):
    t = row / H
    arr[row] = top_col * (1 - t) + bot_col * t
arr += np.random.normal(0, 6, arr.shape)
arr = np.clip(arr, 0, 255).astype(np.uint8)
img = Image.fromarray(arr)
draw = ImageDraw.Draw(img)

# ─── Decorative compass/gear element (upper right, very subtle) ───────────────
dc_cx, dc_cy = 2230, 290
dc_col = (200, 190, 163)

for r in [82, 132, 195, 258, 315]:
    draw.ellipse(
        [(dc_cx - r, dc_cy - r), (dc_cx + r, dc_cy + r)],
        outline=dc_col, width=3,
    )
for deg in range(0, 360, 10):
    rad = math.radians(deg)
    r_in = 258 if deg % 30 == 0 else 280
    draw.line(
        [
            (int(dc_cx + r_in * math.cos(rad)), int(dc_cy + r_in * math.sin(rad))),
            (int(dc_cx + 315 * math.cos(rad)), int(dc_cy + 315 * math.sin(rad))),
        ],
        fill=dc_col, width=3 if deg % 30 == 0 else 2,
    )
for deg in range(0, 360, 30):
    rad = math.radians(deg)
    draw.line(
        [
            (int(dc_cx + 82 * math.cos(rad)), int(dc_cy + 82 * math.sin(rad))),
            (int(dc_cx + 195 * math.cos(rad)), int(dc_cy + 195 * math.sin(rad))),
        ],
        fill=dc_col, width=3,
    )

# ─── Button renderer ──────────────────────────────────────────────────────────

def render_button(arr, cx, cy, radius, body_rgb):
    """
    Draw onto arr (float32 H×W×3):
      1. Drop shadow
      2. Dark warm-grey bezel ring
      3. Spherical-shaded colored body with rim darkening
    """
    H_a, W_a = arr.shape[:2]
    ys, xs = np.ogrid[0:H_a, 0:W_a]
    dx = xs.astype(float) - cx
    dy = ys.astype(float) - cy
    dist = np.sqrt(dx**2 + dy**2)

    # ── drop shadow (offset down-right) ──
    sdx = xs.astype(float) - (cx + 14)
    sdy = ys.astype(float) - (cy + 18)
    sdist = np.sqrt(sdx**2 + sdy**2)
    sh_mask = (sdist <= radius + 12) & (dist > radius - 10)
    sh_t = np.clip(1 - (sdist - radius) / 16, 0, 1) * 0.38
    for c in range(3):
        arr[:, :, c] = np.where(sh_mask,
            arr[:, :, c] * (1 - sh_t) + 28 * sh_t,
            arr[:, :, c])

    # ── bezel ring (warm dark grey, top brighter / bottom darker) ──
    ring_base = np.array([70, 65, 58], dtype=np.float32)
    ring_mask = dist <= radius
    ring_t = np.clip((ys - (cy - radius)) / (2.0 * radius), 0, 1)  # 0=top 1=bot
    ring_lum = 1.18 - ring_t * 0.36
    for c in range(3):
        val = np.clip(ring_base[c] * ring_lum, 0, 255)
        arr[:, :, c] = np.where(ring_mask, val, arr[:, :, c])

    # ── spherical button body ──
    body_r = radius * 0.80
    body_mask = dist <= body_r

    ndx = np.clip(dx / body_r, -1, 1)
    ndy = np.clip(dy / body_r, -1, 1)
    ndz = np.sqrt(np.clip(1 - ndx**2 - ndy**2, 0, 1))

    # Light from upper-left
    lx, ly, lz = -0.38, -0.52, 0.76

    diffuse = np.clip(ndx * lx + ndy * ly + ndz * lz, 0, 1)
    specular = diffuse ** 24

    b = np.array(body_rgb, dtype=np.float32)
    for c in range(3):
        val = b[c] * (0.33 + 0.67 * diffuse) + 255 * specular * 0.22
        arr[:, :, c] = np.where(body_mask, np.clip(val, 0, 255), arr[:, :, c])

    # ── rim darkening (inner edge) ──
    rim_start = body_r * 0.78
    rim_t = np.clip((dist - rim_start) / (body_r - rim_start), 0, 1)
    rim_mask = body_mask & (dist > rim_start)
    for c in range(3):
        arr[:, :, c] = np.where(rim_mask,
            arr[:, :, c] * (1 - rim_t * 0.28),
            arr[:, :, c])

    return arr


# ─── Button config: (body_rgb, icon_fill, icon_outline, icon_type, label) ─────
btn_configs = [
    ((90, 148, 102),  (48, 88, 56),   (25, 55, 32),   'tri_up',   '開門'),
    ((192, 64, 64),   (120, 30, 30),  (72, 15, 15),   'tri_down', '關門'),
    ((178, 142, 52),  (200, 168, 88), (95, 74, 18),   'square',   '停止'),
]

x_pos = [W // 6, W // 2, 5 * W // 6]
y_ctr = H // 2 - 52
btn_r = 250
label_y = y_ctr + btn_r + 42

arr = np.array(img, dtype=np.float32)
for cx, (body_rgb, *_) in zip(x_pos, btn_configs):
    arr = render_button(arr, cx, y_ctr, btn_r, body_rgb)

arr = np.clip(arr, 0, 255).astype(np.uint8)
img = Image.fromarray(arr)
draw = ImageDraw.Draw(img)

# ─── Icon drawing helpers ─────────────────────────────────────────────────────

def tri_up(draw, cx, cy, sz, fill, line):
    pts = [
        (cx, cy - sz),
        (cx - int(sz * 0.82), cy + int(sz * 0.58)),
        (cx + int(sz * 0.82), cy + int(sz * 0.58)),
    ]
    draw.polygon([(x + 7, y + 7) for x, y in pts], fill=line)
    draw.polygon(pts, fill=fill)
    draw.polygon(pts, outline=line, width=9)

def tri_down(draw, cx, cy, sz, fill, line):
    pts = [
        (cx, cy + sz),
        (cx - int(sz * 0.82), cy - int(sz * 0.58)),
        (cx + int(sz * 0.82), cy - int(sz * 0.58)),
    ]
    draw.polygon([(x + 7, y + 7) for x, y in pts], fill=line)
    draw.polygon(pts, fill=fill)
    draw.polygon(pts, outline=line, width=9)

def square(draw, cx, cy, sz, fill, line):
    h = int(sz * 0.70)
    draw.rectangle([(cx - h + 7, cy - h + 7), (cx + h + 7, cy + h + 7)], fill=line)
    draw.rectangle([(cx - h, cy - h), (cx + h, cy + h)], fill=fill)
    draw.rectangle([(cx - h, cy - h), (cx + h, cy + h)], outline=line, width=9)

icon_sz = 82
icon_y = y_ctr - 12

icon_fns = {'tri_up': tri_up, 'tri_down': tri_down, 'square': square}

for cx, (_, fill_col, line_col, itype, _) in zip(x_pos, btn_configs):
    icon_fns[itype](draw, cx, icon_y, icon_sz, fill_col, line_col)

# ─── Text labels ──────────────────────────────────────────────────────────────
text_col = (72, 58, 38)
font = None
for fp in [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
]:
    try:
        font = ImageFont.truetype(fp, 88)
        break
    except Exception:
        pass
if font is None:
    font = ImageFont.load_default()

for cx, (*_, label) in zip(x_pos, btn_configs):
    bb = draw.textbbox((0, 0), label, font=font)
    tw = bb[2] - bb[0]
    draw.text((cx - tw // 2, label_y), label, fill=text_col, font=font)

# ─── Save ─────────────────────────────────────────────────────────────────────
out = '/Users/dingding/projects/ding-wifi-gate/public/rich_menu.png'
img.save(out, 'PNG')
print(f'Saved: {out}  ({W}x{H}px)')
