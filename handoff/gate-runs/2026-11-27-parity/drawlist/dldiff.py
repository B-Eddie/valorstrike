#!/usr/bin/env python3
# Diff DL=1 draw-list dumps base vs lane per shot. Group key: object name | object type | material type | material name | top-level owner (2nd-from-root chain entry).
import json, sys, collections, csv
O = '/workspace/work/qa/gates4/dl/out/'
B, L = sys.argv[1], sys.argv[2]
shots = sys.argv[3].split(',') if len(sys.argv) > 3 else ['vandal_a0', 'abil_a0', 'abil_a1', 'abil_a2']
def owner(ch):
    p = [x for x in ch.split(' > ') if x]
    return ' > '.join(p[-3:-1][::-1]) if len(p) >= 2 else (p[0] if p else '')
def key(r): return (r['obj'], r['otype'], r['mat'], r['mname'], owner(r['chain']))
def load(t, s): return json.load(open(f'{O}bind-low-{t}-dl-{s}.json'))
out = []
for s in shots:
    b, l = load(B, s), load(L, s)
    gb, gl = collections.defaultdict(lambda: [0, 0, set()]), collections.defaultdict(lambda: [0, 0, set()])
    for g, d in ((gb, b), (gl, l)):
        for r in d['rows']:
            k = key(r); g[k][0] += r['calls']; g[k][1] += r['tris']; g[k][2].add((r['icount'], r['vcount'], tuple(r['dr'] or []), r['inst'], r['ginst'], r['mtr'], r['mop'], r['rt'], r['pass']))
    out.append(f"== {s}: base {b['info']['calls']}/{b['info']['tris']} (sum {b['sum']['calls']}/{b['sum']['tris']}, gl {b['glTot']}) rev{b['rev']}  lane {l['info']['calls']}/{l['info']['tris']} (sum {l['sum']['calls']}/{l['sum']['tris']}, gl {l['glTot']}) rev{l['rev']}  delta calls {l['info']['calls']-b['info']['calls']} tris {l['info']['tris']-b['info']['tris']}")
    dc = dt = 0
    for k in sorted(set(gb) | set(gl), key=lambda k: (gl.get(k, [0, 0])[0] - gb.get(k, [0, 0])[0], k)):
        cb, tb = gb[k][0] if k in gb else 0, gb[k][1] if k in gb else 0
        cl, tl = gl[k][0] if k in gl else 0, gl[k][1] if k in gl else 0
        if cb == cl and tb == tl: continue
        tag = 'BASE-ONLY' if k not in gl else ('LANE-ONLY' if k not in gb else 'CHANGED')
        dc += cl - cb; dt += tl - tb
        out.append(f"  {tag:9s} obj={k[0]!r} type={k[1]} mat={k[2]} mname={k[3]!r} owner={k[4]!r}: base {cb} calls/{tb} tris, lane {cl}/{tl} -> d {cl-cb} calls / {tl-tb} tris")
        out.append(f"            base geo {sorted(gb[k][2], key=str) if k in gb else '-'}  lane geo {sorted(gl[k][2], key=str) if k in gl else '-'}")
    out.append(f"  SUM of listed deltas: calls {dc}, tris {dt}  (must equal shot delta)")
    # CSV of rows
    for t, d in ((B, b), (L, l)):
        with open(f'{O}rows-{t}-{s}.csv', 'w', newline='') as f:
            w = csv.writer(f); cols = ['seq', 'obj', 'otype', 'oid', 'chain', 'mat', 'mname', 'mvis', 'mtr', 'mop', 'mside', 'gtype', 'gname', 'dr', 'icount', 'vcount', 'ginst', 'grp', 'inst', 'sk', 'fc', 'ro', 'pass', 'cam', 'rt', 'draws', 'calls', 'tris', 'upd', 'gl']
            w.writerow(cols); [w.writerow([json.dumps(r.get(c)) if isinstance(r.get(c), (list, dict)) else r.get(c) for c in cols]) for r in d['rows']]
print('\n'.join(out))
