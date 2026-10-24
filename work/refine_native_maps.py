"""Bind plant zones to Riot's minimap areas and choose reachable source-mesh floor anchors."""
from pathlib import Path
import json,math
import numpy as np
from PIL import Image
from scipy.ndimage import label
ROOT=Path(__file__).resolve().parents[1]
for dest in (ROOT/'models/valorant/maps').iterdir():
 if not (dest/'map.json').exists():continue
 m=json.loads((dest/'map.json').read_text());n=json.loads((dest/'navigation.json').read_text());im=np.asarray(Image.open(dest/'minimap.png').convert('RGBA')).astype(float);r,g,b,a=[im[:,:,i] for i in range(4)];mask=(abs(r-g)<25)&(r>60)&(g>60)&((r+g)*.5-b>15)&(a>20);labels,count=label(mask);P=m['apiProjection'];T=m['transform'];ca,sa=math.cos(T['angle']),math.sin(T['angle']);sites=m['sourceAnchors']['sites']
 def pixel(p):
  x,y,z=p;sx=ca*x-sa*z+T['cx'];sz=sa*x+ca*z+T['cz'];return (int((sx*100*P['xMultiplier']+P['xScalarToAdd'])*1024),int((-sz*100*P['yMultiplier']+P['yScalarToAdd'])*1024))
 sitepixels={k:pixel(p) for k,p in sites.items()};classmap={}
 for i in range(1,count+1):
  yy,xx=np.where(labels==i)
  if len(xx)<80:continue
  cx,cy=xx.mean(),yy.mean();classmap[i]=min(sitepixels,key=lambda k:(sitepixels[k][0]-cx)**2+(sitepixels[k][1]-cy)**2)
 rows={}
 for y in range(1024):
  segments=[];x=0
  while x<1024:
   c=classmap.get(int(labels[y,x]))
   if not c:x+=1;continue
   end=x+1
   while end<1024 and classmap.get(int(labels[y,end]))==c:end+=1
   segments.append([x,end,c]);x=end
  if segments:rows[str(y)]=segments
 (dest/'plants.json').write_text(json.dumps({'rows':rows,'source':'Riot minimap site shading'},separators=(',',':')))
 seen=set([n['spawnNodes'][0]]);q=list(seen)
 while q:
  i=q.pop()
  for j in n['adj'][i]:
   if j not in seen:seen.add(j);q.append(j)
 valid={k:[] for k in sites}
 for i in seen:
  x,y=pixel(n['nodes'][i]);k=classmap.get(int(labels[y,x])) if 0<=x<1024 and 0<=y<1024 else None
  if k:valid[k].append(i)
 for k,p in sites.items():
  if not valid[k]:raise RuntimeError(dest.name+' '+k+' has no reachable plant-zone floor')
  i=min(valid[k],key=lambda i:(n['nodes'][i][0]-p[0])**2+(n['nodes'][i][2]-p[2])**2+.01*(n['nodes'][i][1]-p[1])**2);n['siteNodes'][k]=i;m['sites'][k]=n['nodes'][i];n['validation']['attackerToSites'][k]=True;m['navigationValidation']['attackerToSites'][k]=True
 (dest/'map.json').write_text(json.dumps(m,separators=(',',':')));(dest/'navigation.json').write_text(json.dumps(n,separators=(',',':')));print(dest.name,'zones',classmap,'anchors',m['sites'])
