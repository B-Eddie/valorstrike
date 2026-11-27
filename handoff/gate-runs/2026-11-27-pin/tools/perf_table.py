import json,statistics as st
G='/workspace/work/qa/gates5/perf/'; K=['ftMean','loop','render:main','umw']; side={'base':[],'lane':[]}
for t in ['base1','lane1','base2','lane2']:
    d=json.load(open(G+'perf_%s.json'%t)); rc=[l for l in open(G+'perf_%s.a0.stdout'%t) if l.startswith('RC ')]
    print(t,'root',d['root'],'fail',d.get('fail'),'errors',len(d.get('errors',[])),(rc[-1].strip() if rc else 'RC ?'))
    M=d['meas']
    for i,m in enumerate(M): print(f"  meas{i}: frames {m['frames']} ftMean {m['ftMean']} loop {m['loop']} render:main {m['render:main']} umw {m['umw']} xSimRun {m['xSimRun']} calls {m['calls']} tris {m['tris']}")
    mean={k:round(sum(m[k] for m in M)/len(M),3) for k in K}; ft=[m['ftMean'] for m in M]
    print(f"  mean of {len(M)}: "+' '.join(f'{k} {mean[k]}' for k in K)+f"  | ftMean min {min(ft)} max {max(ft)} sd {st.stdev(ft):.3f}")
    side[t[:4]].append(mean)
print()
for s,L in side.items():
    print(f"{s} (2 runs): "+' '.join(f"{k} {round(sum(x[k] for x in L)/len(L),3)} [{min(x[k] for x in L)}..{max(x[k] for x in L)}]" for k in K))
b={k:sum(x[k] for x in side['base'])/2 for k in K}; l={k:sum(x[k] for x in side['lane'])/2 for k in K}
print('lane - base: '+' '.join(f"{k} {l[k]-b[k]:+.3f} ({(l[k]-b[k])/b[k]*100:+.1f}%)" for k in K))
