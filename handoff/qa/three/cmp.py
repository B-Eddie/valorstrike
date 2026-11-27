# usage: venv/bin/python cmp.py MAP GQ TAGA TAGB [names...]  (names default: every <a>-*.rgba shot)
# Per shot: pixels differing (any RGB channel), max delta, SSIM (Wang et al., gaussian 11x11 sigma 1.5, on RGB, mean of
# channels), mean abs diff; writes a diff heatmap PNG (amplified x8, red) for every shot with differences to heat/.
import numpy as np, sys, os, glob, json
from scipy.ndimage import gaussian_filter
from PIL import Image
S = os.environ.get('OUTD', '/workspace/work/qa/three/shots/')
m, g, ta, tb = sys.argv[1:5]; names = sys.argv[5:]
A0 = S + f'{m}-{g}-{ta}'; B0 = S + f'{m}-{g}-{tb}'
info = json.load(open(A0 + '.json')); W, H = info['size']
if not names: names = sorted([os.path.basename(p)[len(os.path.basename(A0)) + 1:-5] for p in glob.glob(A0 + '-*.rgba')], key=lambda s: (len(s), s))
def ssim(a, b):
    a = a.astype(np.float64); b = b.astype(np.float64); C1 = (0.01 * 255) ** 2; C2 = (0.03 * 255) ** 2; out = []
    for c in range(3):
        x = a[..., c]; y = b[..., c]; f = lambda z: gaussian_filter(z, 1.5, truncate=3.5)
        mx, my = f(x), f(y); sxx = f(x * x) - mx * mx; syy = f(y * y) - my * my; sxy = f(x * y) - mx * my
        out.append((((2 * mx * my + C1) * (2 * sxy + C2)) / ((mx * mx + my * my + C1) * (sxx + syy + C2))).mean())
    return float(np.mean(out))
os.makedirs(S + 'heat', exist_ok=True); tot = 0; worst = 1.0; rows = []
for n in names:
    a = A0 + '-' + n + '.rgba'; b = B0 + '-' + n + '.rgba'
    if not (os.path.exists(a) and os.path.exists(b)): rows.append((n, 'missing')); continue
    A = np.fromfile(a, np.uint8); B = np.fromfile(b, np.uint8)
    w = h = None
    sh = info.get('shots', {}).get(n, {})
    for (ww, hh) in [(sh.get('w', W), sh.get('h', H)), (W, H)]:
        if A.size == ww * hh * 4: w, h = ww, hh
    if w is None: rows.append((n, 'size', A.size)); continue
    A = A.reshape(h, w, 4)[::-1, :, :3]; B = B.reshape(h, w, 4)[::-1, :, :3]
    d = np.abs(A.astype(int) - B.astype(int)).max(2); k = int((d > 0).sum()); tot += k
    s = ssim(A, B); worst = min(worst, s)
    rows.append((n, k, int(d.max()), round(s, 6), round(float(np.abs(A.astype(int) - B.astype(int)).mean()), 4)))
    if k:
        hm = np.zeros((h, w, 3), np.uint8); hm[..., 0] = np.clip(d * 8, 0, 255); hm[..., 1] = (A.mean(2) * 0.25).astype(np.uint8); hm[..., 2] = hm[..., 1]
        Image.fromarray(hm).save(S + f'heat/{m}-{g}-{ta}-vs-{tb}-{n}.png')
print(m, g, ta, 'vs', tb, 'shots', len(rows), 'total px differ', tot, 'min SSIM', round(worst, 6))
for r in rows: print('  ', r)
