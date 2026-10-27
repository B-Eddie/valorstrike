import json,sys,math,numpy as np
from PIL import Image,ImageDraw
key=sys.argv[1];cx0,cz0,R=float(sys.argv[2]),float(sys.argv[3]),float(sys.argv[4])
D=f'/workspace/work/vs-lane-invis/models/valorant/maps/{key}/';mp=json.load(open(D+'map.json'));t=mp['transform'];pj=mp['apiProjection']
im=Image.open(D+'minimap.png').convert('RGBA');W,H=im.size;ca,sa=math.cos(t['angle']),math.sin(t['angle'])
def uv(x,z):
    sx=ca*x-sa*z+t['cx'];sz=sa*x+ca*z+t['cz'];return ((sx*100*pj['xMultiplier']+pj['xScalarToAdd'])*W,(-sz*100*pj['yMultiplier']+pj['yScalarToAdd'])*H)
bg=Image.new('RGBA',im.size,(40,40,40,255));bg.alpha_composite(im);dr=ImageDraw.Draw(bg)
nav=json.load(open(D+'navigation.json'))
for p,v in zip(nav['nodes'],nav['valid']):
    if v and abs(p[0]-cx0)<R and abs(p[2]-cz0)<R:u,w=uv(p[0],p[2]);dr.point((u,w),fill=(0,160,255,255))
for c in json.load(open(f'leash_{key}.json')):
    x,y,z=c['rep']
    if abs(x-cx0)<R and abs(z-cz0)<R:u,w=uv(x,z);dr.ellipse((u-2,w-2,u+2,w+2),fill=(255,0,0,255) if c['plant'] else (255,200,0,255))
G=json.load(open(f'grass_{key}.json'))
for g in G:
    x,z=(g[0]+.5)*.5,(g[2]+.5)*.5
    if abs(x-cx0)<R and abs(z-cz0)<R and 'Vista' not in g[3]:u,w=uv(x,z);dr.point((u,w),fill=(0,255,0,255))
a=uv(cx0-R,cz0-R);b=uv(cx0+R,cz0+R);c2=uv(cx0-R,cz0+R);d=uv(cx0+R,cz0-R)
us=[a[0],b[0],c2[0],d[0]];ws=[a[1],b[1],c2[1],d[1]]
crop=bg.crop((int(min(us)),int(min(ws)),int(max(us)),int(max(ws)))).resize((600,600),Image.NEAREST);crop.save(sys.argv[5])
