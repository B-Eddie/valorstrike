#!/usr/bin/env python3
# Top-down render per map: navigation nodes coloured by Valorant's buy-phase zone (server/tools/spawn-zones.json: teal =
# attackers', red = defenders', grey = neutral, pale = within 2 m of a boundary) and the committed spawn walls
# (vendor/spawn-barriers.cjs: attackers' blue, defenders' yellow). A wall belongs on a teal / grey or red / grey border.
# usage: python3 work/validation/spawn-barriers/zones_render.py [map ...]  -> work/validation/spawn-barriers/<map>-zones.png
import json, os, sys, subprocess
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(H, '../../..')
SB = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./vendor/spawn-barriers.cjs').DATA))"], cwd=ROOT))
Z = json.load(open(os.path.join(ROOT, 'server/tools/spawn-zones.json')))
COL = {'A': (70, 160, 140), 'a': (150, 205, 195), 'D': (175, 95, 100), 'd': (220, 170, 172), 'N': (120, 120, 120), 'n': (175, 175, 175), '?': (60, 60, 60)}
for key in sys.argv[1:] or ['ascent', 'bind', 'breeze', 'haven', 'lotus', 'split']:
  N = json.load(open(os.path.join(ROOT, 'server/public/worlds', key, 'navigation.json')))
  nodes = [p for p, v in zip(N['nodes'], N['valid']) if v]; zone = [z for z, v in zip(Z[key]['zone'], N['valid']) if v]
  x0 = min(p[0] for p in nodes) - 3; x1 = max(p[0] for p in nodes) + 3; z0 = min(p[2] for p in nodes) - 3; z1 = max(p[2] for p in nodes) + 3
  S = 8; img = Image.new('RGB', (int((x1 - x0) * S), int((z1 - z0) * S)), (25, 25, 25)); d = ImageDraw.Draw(img)
  P = lambda x, z: ((x - x0) * S, (z - z0) * S)
  for p, z in sorted(zip(nodes, zone), key=lambda t: t[0][1]):
    x, y = P(p[0], p[2]); d.rectangle([x - 3, y - 3, x + 3, y + 3], fill=COL[z])
  for side, c in (('atk', (0, 90, 255)), ('def', (255, 215, 0))):
    for pc in SB[key][side]: d.line([P(*q) for q in pc['p']], fill=c, width=6)
  d.text((8, 8), key + ': teal / red / grey = Valorant attacker / defender / neutral buy-phase zone; blue / yellow = our walls', fill=(255, 255, 255))
  out = os.path.join(H, key + '-zones.png'); img.save(out); print(out)
