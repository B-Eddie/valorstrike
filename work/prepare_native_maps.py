"""Fetch official callouts/minimaps and derive a rigid, metre-preserving game transform."""
from pathlib import Path
import json,math,urllib.request
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'models/valorant/maps';OUT.mkdir(exist_ok=True)
data=json.load(urllib.request.urlopen('https://valorant-api.com/v1/maps'))['data']
for m in data:
 key=m['displayName'].lower()
 if key not in ['ascent','bind','haven','split','lotus','breeze']:continue
 calls=m['callouts'];at=next(c for c in calls if c['regionName']=='Spawn' and c['superRegionName']=='Attacker Side')['location'];de=next(c for c in calls if c['regionName']=='Spawn' and c['superRegionName']=='Defender Side')['location'];cx=(at['y']+de['y'])/200;cz=-(at['x']+de['x'])/200;ang=-math.atan2(at['y']/100-cx,-at['x']/100-cz);yoff=4-min(c['location']['z']/100 for c in calls)
 def pos(p):
  x=p['y']/100-cx;z=-p['x']/100-cz
  return [round(x*math.cos(ang)+z*math.sin(ang),5),round(p['z']/100+yoff,5),round(-x*math.sin(ang)+z*math.cos(ang),5)]
 meta={'key':key,'name':m['displayName'],'uuid':m['uuid'],'source':'https://www.reddit.com/r/VALORANT/comments/1uueh6s/most_of_the_maps_ported_for_use_in_blender/','sourceDate':'2024-11','calloutSource':'https://valorant-api.com/v1/maps/'+m['uuid'],'transform':{'cx':cx,'cz':cz,'angle':ang,'yOffset':yoff},'apiProjection':{k:m[k] for k in ['xMultiplier','yMultiplier','xScalarToAdd','yScalarToAdd']},'attacker':pos(at),'defender':pos(de),'sites':{c['superRegionName']:pos(c['location']) for c in calls if c['regionName']=='Site'},'callouts':[{'name':c['superRegionName']+' '+c['regionName'],'position':pos(c['location']),'game':c['location']} for c in calls]}
 dest=OUT/key;dest.mkdir(exist_ok=True);(dest/'source.json').write_text(json.dumps(meta,indent=2));(dest/'minimap.png').write_bytes(urllib.request.urlopen(m['displayIcon']).read());print(key)
