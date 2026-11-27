import json,sys
T='/workspace/work/qa/three/shots/bind-low-'
tags=sys.argv[1:]; D={t:json.load(open(T+t+'.json'))['shots'] for t in tags}
names=sorted(D[tags[0]],key=lambda s:(s.startswith('abil'),len(s),s))
ref=tags[0]
# loadout swap marker: Ghost (Luger+Silencer) vs Vandal (AK) = 0 calls / 3550 tris vs the base reference
print('shot'.ljust(11)+''.join(t.rjust(20) for t in tags)+'   flags (vs '+ref+')')
for n in names:
    row=n.ljust(11)+''.join(f"{D[t][n]['calls']}/{D[t][n]['tris']}".rjust(20) for t in tags)
    fl=[]
    for t in tags:
        if t==ref: continue
        dc=D[t][n]['calls']-D[ref][n]['calls']; dt=D[t][n]['tris']-D[ref][n]['tris']
        if dc or dt:
            sw=' LOADOUT-SWAP(+3550)' if dt==3550 else ' LOADOUT-SWAP(-3550)' if dt==-3550 else ''
            fl.append(f"{t}:{dc:+d}c/{dt:+d}t{sw}")
    print(row+'   '+('; '.join(fl) if fl else 'all = ref'))
