import sys,struct,numpy as np,collections
from census import load
key=sys.argv[1];pts=[tuple(map(float,p.split(','))) for p in sys.argv[2:]]
g,CP,T,cm,ex=load(key)
eb=open(f'/workspace/work/vs-lane-foliage/models/valorant/maps/{key}/collision-exclude.bin','rb').read();old=np.zeros(len(ex),bool);n=struct.unpack_from('<I',eb)[0]
for r in range(n):s,l=struct.unpack_from('<II',eb,4+r*8);old[s:s+l]=True
new=ex&~old;back=old&~ex;print('newly excluded',new.sum(),'newly kept',back.sum())
tri=CP[T];c=tri.mean(1)
print(collections.Counter(g['materials'][m]['name'] for m in cm[new]).most_common(12))
for (x,y,z) in pts:
    sel=np.nonzero(new&(abs(c[:,0]-x)<2.5)&(abs(c[:,2]-z)<2.5)&(c[:,1]>y-3)&(c[:,1]<y+3))[0]
    print((x,y,z),collections.Counter((g['materials'][cm[t]]['name'],round(float(c[t,1]),1)) for t in sel).most_common(6))
