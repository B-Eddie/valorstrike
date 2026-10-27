# leash stops: how deep inside the official minimap footprint (distance to the footprint edge, sampled)
import json,sys,math
from PIL import Image
key=sys.argv[1];D=f'/workspace/work/vs-lane-invis/models/valorant/maps/{key}/';mp=json.load(open(D+'map.json'));t=mp['transform'];pj=mp['apiProjection']
im=Image.open(D+'minimap.png').convert('RGBA');W,H=im.size;A=im.load();ca,sa=math.cos(t['angle']),math.sin(t['angle'])
def inm(x,z):
    sx=ca*x-sa*z+t['cx'];sz=sa*x+ca*z+t['cz'];u=int((sx*100*pj['xMultiplier']+pj['xScalarToAdd'])*W);v=int((-sz*100*pj['yMultiplier']+pj['yScalarToAdd'])*H)
    return 0<=u<W and 0<=v<H and A[u,v][3]>0
def depth(x,z):
    if not inm(x,z):return 0
    for r in [.25,.5,.75,1,1.5,2,3]:
        if any(not inm(x+r*math.cos(a/16*6.283),z+r*math.sin(a/16*6.283)) for a in range(16)):return r
    return 9
C=json.load(open(f'leash_{key}{sys.argv[2] if len(sys.argv)>2 else ""}.json'))
import collections;h=collections.Counter();out=[]
for c in C:
    d=depth(c['rep'][0],c['rep'][2]);h[d]+=c['pushes'];c['fpdepth']=d
    if d>=1:out.append(c)
print(key,'pushes by footprint depth (m):',dict(sorted(h.items())))
for c in sorted(out,key=lambda c:-c['pushes'])[:int(sys.argv[3]) if len(sys.argv)>3 else 20]:print(' ',c['pushes'],c['fpdepth'],c['rep'],c['node'],c['callout'],'grass' if c['plant'] else '')
json.dump(C,open(f'leashfp_{key}.json','w'))
