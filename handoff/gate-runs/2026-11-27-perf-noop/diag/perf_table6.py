import json,statistics as S,sys
P='/workspace/work/qa/gates6/perf/'; K=['ftMean','loop','render:main','umw','xSimRun']; side={'base':[],'lane':[]}
out=[]
for t in ['base1','lane1','base2','lane2']:
    try: r=json.load(open(P+'perf_%s.json'%t))
    except Exception as e: out.append('%s missing %s'%(t,e)); continue
    js=r.get('js',{}); g=lambda n: json.loads(js.get(P+n,'{}'))
    pre,post,end=g('md_check_pre.js'),g('md_check_post.js'),g('md_check_end.js')
    rc=open(P+'perf_%s.a0.stdout'%t).read().strip().splitlines()[-1]
    out.append('%s root %s noop %s fail %s errors %d %s | multi_draw attached: pre(before diag)=%s post(after diag)=%s end(after meas)=%s cached_mDE_end=%r'%(t,r['root'],r.get('noop'),r.get('fail'),len(r['errors']),rc,pre.get('attached'),post.get('attached'),end.get('attached'),end.get('cached_mDE')))
    M=r['meas']
    for i,m in enumerate(M): out.append('  meas%d: frames %d '%(i,m['frames'])+' '.join('%s %s'%(k,m.get(k)) for k in K)+' calls %d tris %d'%(m['calls'],m['tris']))
    mean={k:sum(m[k] for m in M)/len(M) for k in K}; ft=[m['ftMean'] for m in M]
    out.append('  mean of %d: '%len(M)+' '.join('%s %.3f'%(k,mean[k]) for k in K)+' | ftMean min %.2f max %.2f sd %.3f'%(min(ft),max(ft),S.stdev(ft)))
    side[t[:4]].append(mean)
out.append('')
for s,L in side.items():
    if L: out.append('%s (%d runs): '%(s,len(L))+' '.join('%s %.3f [%.3f..%.3f]'%(k,sum(x[k] for x in L)/len(L),min(x[k] for x in L),max(x[k] for x in L)) for k in K))
if side['base'] and side['lane']:
    b={k:sum(x[k] for x in side['base'])/len(side['base']) for k in K}; l={k:sum(x[k] for x in side['lane'])/len(side['lane']) for k in K}
    out.append('lane - base: '+' '.join('%s %+.3f (%+.1f%%)'%(k,l[k]-b[k],100*(l[k]-b[k])/b[k]) for k in K))
print('\n'.join(out))
