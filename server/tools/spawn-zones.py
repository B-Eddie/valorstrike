# Valorant buy-phase zones per navigation node (offline tool; writes server/tools/spawn-zones.json, which
# server/tools/spawn-barriers-gen.mjs reads to put the spawn walls where Valorant has them).
# Source: tracker.gg's Valorant map database overlays (patch 9.08), one PNG per map with the attackers' buy-phase area
# teal, the defenders' red / orange, the rest grey and the spawn barriers drawn on the boundaries:
#   https://trackercdn.com/cdn/tracker.gg/valorant/db/maps/9.08/<map>.png   (not committed; pass the folder)
# Registration: a similarity transform world (x, z) -> overlay pixel per map, started from four or five callouts
# (spawns + sites: map.json callout positions vs the overlay's labels) and refined by maximising the overlap of the
# playable navigation footprint with the overlay's drawn area (Nelder-Mead); residual ~1 overlay px = 0.13-0.17 m.
# Per node: the overlay class around it (0.7 m disc majority; 2 m disc for purity):
#   A / D / N = attackers' / defenders' / neutral, pure (97 %+ of the 2 m disc), a / d / n = near a boundary,
#   ? = off the overlay. The generator takes A (or D) as the spawn side and N + the other team's as the outside.
# usage: python3 server/tools/spawn-zones.py <overlay folder> [map ...]   (numpy, scipy, Pillow)
import json, sys, os, collections
import numpy as np
from PIL import Image
from scipy.optimize import minimize
from scipy.ndimage import binary_dilation
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.join(HERE, '..', 'public', 'worlds')
R = 1000
LBL = {  # overlay label centres at 900 px (approx.)
 'ascent': {'Attacker Side Spawn': (362, 719), 'Defender Side Spawn': (490, 72), 'A Site': (758, 294), 'B Site': (197, 234)},
 'split': {'Attacker Side Spawn': (408, 790), 'Defender Side Spawn': (423, 122), 'A Site': (763, 312), 'B Site': (145, 302)},
 'bind': {'Attacker Side Spawn': (535, 806), 'Defender Side Spawn': (468, 93), 'A Site': (646, 322), 'B Site': (261, 256)},
 'haven': {'Attacker Side Spawn': (430, 811), 'Defender Side Spawn': (539, 137), 'A Site': (756, 355), 'B Site': (454, 370), 'C Site': (167, 375)},
 'lotus': {'Attacker Side Spawn': (463, 732), 'Defender Side Spawn': (536, 162), 'A Site': (762, 361), 'B Site': (452, 416), 'C Site': (152, 372)},
 'breeze': {'Attacker Side Spawn': (385, 755), 'Defender Side Spawn': (505, 121), 'A Site': (737, 356), 'B Site': (130, 235)},
}

def lit(v):
  import ast
  return ast.literal_eval(v) if isinstance(v, str) else v

def playable(n):
  N, adj, v = n['nodes'], n['adj'], n['valid']
  U = [set() for _ in N]
  for i, l in enumerate(adj):
    for j in l: U[i].add(j); U[j].add(i)
  seen = np.zeros(len(N), bool); best = []
  for s in range(len(N)):
    if seen[s] or not v[s]: continue
    c = [s]; seen[s] = 1; i = 0
    while i < len(c):
      for j in U[c[i]]:
        if not seen[j] and v[j]: seen[j] = 1; c.append(j)
      i += 1
    if len(c) > len(best): best = c
  return best

def tf(p, X):
  s, th, tx, ty = p
  x, z = X[:, 0], X[:, 1]
  return np.stack([s * (np.cos(th) * x - np.sin(th) * z) + tx, s * (np.sin(th) * x + np.cos(th) * z) + ty], 1)

def register(k, A, n, m):
  mask = A[:, :, 3] > 0
  X = np.array(n['nodes'])[playable(n)][:, [0, 2]]
  P, Q = [], []
  for o in lit(m['callouts']):
    if o['name'] in LBL[k]: P.append([o['position'][0], o['position'][2]]); Q.append(np.array(LBL[k][o['name']]) * R / 900)
  P, Q = np.array(P), np.array(Q)
  pc, qc = P.mean(0), Q.mean(0); a, b = P - pc, Q - qc
  zc, wc = a[:, 0] + 1j * a[:, 1], b[:, 0] + 1j * b[:, 1]; g = (np.conj(zc) @ wc) / (np.conj(zc) @ zc)
  c0 = g * (pc[0] + 1j * pc[1]); p0 = [abs(g), np.angle(g), qc[0] - c0.real, qc[1] - c0.imag]
  ys, xs = np.nonzero(mask); idx = np.random.default_rng(0).choice(len(xs), min(20000, len(xs)), replace=False)
  MX, MY = xs[idx], ys[idx]
  def score(p):
    U = np.round(tf(p, X)).astype(int); ok = (U[:, 0] >= 0) & (U[:, 0] < R) & (U[:, 1] >= 0) & (U[:, 1] < R)
    f1 = mask[U[ok, 1], U[ok, 0]].sum() / len(U)
    img = np.zeros((R, R), bool); img[U[ok, 1], U[ok, 0]] = 1; img = binary_dilation(img, iterations=int(max(1, p[0] * .6)))
    return -(f1 + img[MY, MX].mean())
  best = None
  # the labels sit near (not on) the callouts: several starts around the label fit (scale, angle), best overlap wins
  for ds in (1, .9, 1.1):
    for da in (0, -.2, .2):
      q = [p0[0] * ds, p0[1] + da, p0[2], p0[3]]
      simplex = [q, [q[0] * 1.03] + q[1:], [q[0], q[1] + .03] + q[2:], [q[0], q[1], q[2] + 8, q[3]], [q[0], q[1], q[2], q[3] + 8]]
      r = minimize(score, q, method='Nelder-Mead', options={'xatol': 1e-3, 'fatol': 1e-5, 'maxiter': 800, 'initial_simplex': simplex})
      if best is None or r.fun < best.fun: best = r
  return list(map(float, best.x)), -best.fun

def classify(A, n, p):
  r, g, b, a = (A[..., i].astype(int) for i in range(4))
  mx = np.maximum(np.maximum(r, g), b); bright = (mx > 215) | (mx < 60)
  cls = np.full((R, R), -1)
  cls[(a > 0) & (g - r > 25) & ~bright] = 0
  cls[(a > 0) & (r - g > 20) & ~bright] = 1
  cls[(a > 0) & (abs(r - g) < 12) & (abs(g - b) < 12) & (r > 105) & (r < 150)] = 2
  N = np.array(n['nodes']); U = tf(p, N[:, [0, 2]]); s = p[0]
  def hist(rad):
    rp = int(np.ceil(rad * s)); H = np.zeros((len(N), 3))
    for dx in range(-rp, rp + 1):
      for dy in range(-rp, rp + 1):
        if dx * dx + dy * dy > rp * rp: continue
        X = np.clip(np.round(U[:, 0]).astype(int) + dx, 0, R - 1); Y = np.clip(np.round(U[:, 1]).astype(int) + dy, 0, R - 1); c = cls[Y, X]
        for q in range(3): H[:, q] += (c == q)
    return H
  h1, h2 = hist(.7), hist(2.0); out = []
  for i in range(len(N)):
    if h1[i].sum() == 0:
      out.append('?' if h2[i].sum() == 0 else 'adn'[int(h2[i].argmax())]); continue
    q = int(h1[i].argmax()); out.append(('ADN' if h2[i][q] >= .97 * h2[i].sum() else 'adn')[q])
  return ''.join(out)

if __name__ == '__main__':
  src = sys.argv[1]; maps = sys.argv[2:] or list(LBL)
  path = os.path.join(HERE, 'spawn-zones.json')
  data = json.load(open(path)) if os.path.exists(path) else {}
  data['_'] = 'Valorant buy-phase zone per navigation node index (server/tools/spawn-zones.py from tracker.gg map overlays 9.08): A/D/N attackers / defenders / neutral, lowercase within 2 m of a boundary, ? off the overlay. fit = world (x, z) -> 1000 px overlay similarity [scale, angle, tx, ty].'
  for k in maps:
    n = json.load(open(os.path.join(W, k, 'navigation.json'))); m = json.load(open(os.path.join(W, k, 'map.json')))
    A = np.array(Image.open(os.path.join(src, k + '.png')).convert('RGBA').resize((R, R), Image.NEAREST))
    p, sc = register(k, A, n, m); z = classify(A, n, p)
    data[k] = {'fit': [round(v, 5) for v in p], 'nodes': len(n['nodes']), 'zone': z}
    print(k, 'overlap', round(sc, 3), 'm/px', round(1 / p[0], 3), dict(collections.Counter(z)))
  json.dump(data, open(path, 'w'), separators=(',', ':'), sort_keys=True); open(path, 'a').write('\n')
