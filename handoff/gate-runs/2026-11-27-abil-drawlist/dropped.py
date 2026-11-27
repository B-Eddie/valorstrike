#!/usr/bin/env python3
# Per-object dropped draws (base minus lane), weapon-model rows excluded and reported separately. Objects matched by
# (name, parent chain, material type/name, index count, vertex count) in draw order, since object ids differ between builds.
import json, collections
O = '/workspace/work/qa/gates3/out/'
WEAP = ('Bullet_', 'GN_')
def per_obj(t, s):
    d = json.load(open(f'{O}bind-low-{t}-dl-{s}.json')); g = collections.OrderedDict()
    for r in d['rows']:
        k = (r['oid'],); g.setdefault(k, {'r': r, 'calls': 0, 'tris': 0, 'sides': []}); g[k]['calls'] += r['calls']; g[k]['tris'] += r['tris']; g[k]['sides'].append(r['mside'])
    return d, list(g.values())
for s in ['abil_a0', 'abil_a1', 'abil_a2']:
    (b, B), (l, L) = per_obj('mbaseDL', s), per_obj('mlaneDL', s)
    sig = lambda x: (x['r']['obj'], x['r']['chain'], x['r']['mat'], x['r']['mname'], x['r']['icount'], x['r']['vcount'])
    pool = collections.defaultdict(list)
    for x in L: pool[sig(x)].append(x)
    print(f"== {s}: base {b['info']['calls']}/{b['info']['tris']}  lane {l['info']['calls']}/{l['info']['tris']}")
    tc = tt = wc = wt = 0
    for x in B:
        y = pool[sig(x)].pop(0) if pool[sig(x)] else None
        dc = x['calls'] - (y['calls'] if y else 0); dt = x['tris'] - (y['tris'] if y else 0)
        if not dc and not dt: continue
        r = x['r']
        if r['obj'].startswith(WEAP): wc -= dc; wt -= dt; continue
        tc -= dc; tt -= dt
        print(f"  DROPPED obj={r['obj']} chain='{r['chain']}' mat={r['mat']} mname='{r['mname']}' transparent={r['mtr']} idx={r['icount']} verts={r['vcount']}: base {x['calls']} calls/{x['tris']} tris (sides {x['sides']}), lane {y['calls'] if y else 0}/{y['tris'] if y else 0} (sides {y['sides'] if y else '-'}) -> -{dc} calls / -{dt} tris")
    extra = [y for v in pool.values() for y in v]
    for y in extra:
        r = y['r']
        if r['obj'].startswith(WEAP): wc += y['calls']; wt += y['tris']; continue
        tc += y['calls']; tt += y['tris']; print(f"  LANE-ONLY obj={r['obj']} chain='{r['chain']}' mat={r['mat']} idx={r['icount']}: +{y['calls']}/{y['tris']}")
    print(f"  ability/non-weapon delta: calls {tc}, tris {tt}")
    print(f"  weapon-model swap (bot holding AK vs Luger+Silencer, run nondeterminism; see vandal_a0): calls {wc}, tris {wt}")
    print(f"  total {tc+wc} / {tt+wt}  == shot delta {l['info']['calls']-b['info']['calls']} / {l['info']['tris']-b['info']['tris']}: {(tc+wc, tt+wt) == (l['info']['calls']-b['info']['calls'], l['info']['tris']-b['info']['tris'])}")
