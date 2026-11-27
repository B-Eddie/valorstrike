import numpy as np,sys,json
S='/workspace/work/qa/three/shots/bind-low-'
a,b=sys.argv[1:3]; W,H=960,540
for n in ['vandal_a%d'%i for i in range(8)]+['vandal_vm','abil_a0','abil_a1','abil_a2']:
    A=np.fromfile(S+a+'-'+n+'.rgba',np.uint8).reshape(H,W,4)[::-1,:,:3].astype(int);B=np.fromfile(S+b+'-'+n+'.rgba',np.uint8).reshape(H,W,4)[::-1,:,:3].astype(int)
    d=np.abs(A-B).max(2);ys,xs=np.nonzero(d)
    print(f"{a} vs {b} {n}: {len(xs)} px" + (f" bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()}" if len(xs) else ''))
