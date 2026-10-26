#!/usr/bin/env python3
# Top-down render of a spawn neighbourhood: map geometry sliced at floor+1 m (black), nav nodes coloured by
# geodesic distance from the spawn anchor, the old buy plane (grey dashed), and barrier segments (cyan) from
# vendor/spawn-barriers.cjs data passed as JSON on argv[3] (optional).
import json, sys, heapq, math, os
import numpy as np
from PIL import Image, ImageDraw
root = os.path.join(os.path.dirname(__file__), '../../../server/public/worlds')
key, side = sys.argv[1], sys.argv[2]
segs = json.loads(sys.argv[3]) if len(sys.argv) > 3 else []
R = float(os.environ.get('R', 40)); PX = int(os.environ.get('PX', 10))
M = json.load(open(f'{root}/{key}/map.json')); N = json.load(open(f'{root}/{key}/navigation.json'))
a = M['attacker' if side == 'atk' else 'defender']
cx, cz = a[0], a[2]
if os.environ.get('CX'): cx = float(os.environ['CX'])
if os.environ.get('CZ'): cz = float(os.environ['CZ'])
pos = np.fromfile(f'{root}/{key}/position.bin', dtype=np.float32).reshape(-1, 3)
idx = np.fromfile(f'{root}/{key}/index.bin', dtype=np.uint32).reshape(-1, 3)
W = int(2 * R * PX); img = Image.new('RGB', (W, W), (255, 255, 255)); d = ImageDraw.Draw(img)
def P(x, z): return ((x - cx + R) * PX, (z - cz + R) * PX)
nodes = N['nodes']; adj = N['adj']; valid = N.get('valid')
# geodesic distance
s0 = min((i for i in range(len(nodes)) if not valid or valid[i]), key=lambda i: (nodes[i][0]-a[0])**2+(nodes[i][2]-a[2])**2+2*(nodes[i][1]-a[1])**2)
dist = {s0: 0}; H = [(0, s0)]
while H:
    g, i = heapq.heappop(H)
    if g > dist.get(i, 1e9) or g > 80: continue
    for j in adj[i]:
        if valid and not valid[j]: continue
        c = g + math.hypot(nodes[i][0]-nodes[j][0], nodes[i][2]-nodes[j][2])
        if c < dist.get(j, 1e9): dist[j] = c; heapq.heappush(H, (c, j))
for i, n in enumerate(nodes):
    if abs(n[0]-cx) > R or abs(n[2]-cz) > R: continue
    if os.environ.get('YB') and abs(n[1]-a[1]) > float(os.environ['YB']): continue
    x, y = P(n[0], n[2]); g = dist.get(i)
    if g is None: col = (230, 230, 230)
    else:
        t = min(1, g / 50); col = (int(255*t), int(200*(1-t))+30, int(255*(1-t)))
    r = PX * 0.3
    d.ellipse([x-r, y-r, x+r, y+r], fill=col)
# geometry slices
for hy, colr in ((1.0, (0, 0, 0)), (2.2, (150, 0, 150))):
    Y = a[1] + hy
    tri = pos[idx]  # (T,3,3)
    sel = (tri[:, :, 1].min(1) <= Y) & (tri[:, :, 1].max(1) >= Y) & (np.abs(tri[:, :, 0].mean(1) - cx) < R + 5) & (np.abs(tri[:, :, 2].mean(1) - cz) < R + 5)
    T = tri[sel]
    for t in T:
        pts = []
        for k in range(3):
            p, q = t[k], t[(k+1) % 3]
            if (p[1]-Y)*(q[1]-Y) < 0:
                u = (Y-p[1])/(q[1]-p[1]); pts.append((p[0]+(q[0]-p[0])*u, p[2]+(q[2]-p[2])*u))
        if len(pts) >= 2: d.line([P(*pts[0]), P(*pts[1])], fill=colr, width=2 if hy == 1.0 else 1)
e = min(abs(M['attacker'][2]), abs(M['defender'][2])) - 7
for z in (e, -e):
    if abs(z - cz) < R:
        for x0 in np.arange(cx-R, cx+R, 1.0): d.line([P(x0, z), P(x0+0.5, z)], fill=(120, 120, 120), width=2)
for s in segs:
    for q in s.get('pts',[]):
        X,Y=P(q[0],q[1]); d.rectangle([X-3,Y-3,X+3,Y+3],fill=(255,0,255))
    pl=s['p'] if 'p' in s else [s['a'],s['b']]
    d.line([P(*q) for q in pl], fill=(0, 220, 255), width=4)
    for q in s.get('pts',[]):
        X,Y=P(q[0],q[1]); d.rectangle([X-2,Y-2,X+2,Y+2],fill=(255,0,255))
x, y = P(a[0], a[2]); d.ellipse([x-6, y-6, x+6, y+6], outline=(255, 0, 0), width=3)
# grid every 5 m with labels
for gx in range(int(cx-R)//5*5, int(cx+R)+1, 5):
    X, _ = P(gx, cz); d.line([X, 0, X, 6], fill=(0, 0, 0)); d.text((X+1, 8), str(gx), fill=(0, 0, 0))
for gz in range(int(cz-R)//5*5, int(cz+R)+1, 5):
    _, Y2 = P(cx, gz); d.line([0, Y2, 6, Y2], fill=(0, 0, 0)); d.text((8, Y2-5), str(gz), fill=(0, 0, 0))
out = os.environ.get('OUT', f'{os.path.dirname(__file__)}/{key}-{side}.png'); img.save(out); print(out)
