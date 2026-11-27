# usage: mkimg.py OUTDIR MAP GQ TAGA TAGB   -> lossless PNGs from .rgba (bottom-up, flip-Y as cmp.py), diff heatmap as cmp.py
# writes OUTDIR/<map>-<gq>-<tagA>-<shot>.png always (unless present), <tagB> png + diff png only when shot differs;
# appends 0-px shots to OUTDIR/EMPTY_DIFF.txt
import numpy as np, sys, os, glob, json
from PIL import Image
S = '/workspace/work/qa/three/shots/'
out, m, g, ta, tb = sys.argv[1:6]; os.makedirs(out, exist_ok=True)
A0 = S + f'{m}-{g}-{ta}'; B0 = S + f'{m}-{g}-{tb}'
info = json.load(open(A0 + '.json')); W, H = info['size']
names = sorted([os.path.basename(p)[len(os.path.basename(A0)) + 1:-5] for p in glob.glob(A0 + '-*.rgba')], key=lambda s: (len(s), s))
def load(p, n):
    a = np.fromfile(p, np.uint8); sh = info.get('shots', {}).get(n, {})
    for (w, h) in [(sh.get('w', W), sh.get('h', H)), (W, H)]:
        if a.size == w * h * 4: return a.reshape(h, w, 4)[::-1, :, :3]
    raise SystemExit('size mismatch ' + p)
empty = []
for n in names:
    a = A0 + '-' + n + '.rgba'; b = B0 + '-' + n + '.rgba'
    A = load(a, n); pa = f'{out}/{m}-{g}-{ta}-{n}.png'
    if not os.path.exists(pa): Image.fromarray(np.ascontiguousarray(A)).save(pa, optimize=True)
    if not os.path.exists(b): print(n, 'missing', b); continue
    B = load(b, n); d = np.abs(A.astype(int) - B.astype(int)).max(2); k = int((d > 0).sum())
    if k == 0: empty.append(f'{m}-{g}-{ta}-vs-{tb}-{n}: 0 px differ (lane/B PNG and diff omitted; identical to {os.path.basename(pa)})'); continue
    Image.fromarray(np.ascontiguousarray(B)).save(f'{out}/{m}-{g}-{tb}-{n}.png', optimize=True)
    h, w = d.shape; hm = np.zeros((h, w, 3), np.uint8); hm[..., 0] = np.clip(d * 8, 0, 255); hm[..., 1] = (A.mean(2) * 0.25).astype(np.uint8); hm[..., 2] = hm[..., 1]
    Image.fromarray(hm).save(f'{out}/{m}-{g}-{ta}-vs-{tb}-{n}-diff.png', optimize=True); print(n, k, 'px')
with open(out + '/EMPTY_DIFF.txt', 'a') as f:
    for e in empty: f.write(e + '\n')
print('pngs done', m, g, ta, tb, 'empty', len(empty), 'of', len(names))
