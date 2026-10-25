"""Content revisions for persistent character/weapon/animation caching; maps stay lazy."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1];base=root/'models/valorant'
files=sorted([*base.glob('*.glb'),*base.glob('*-locomotion.json'),*(base/'animations').glob('*.glb')])
entries={p.relative_to(root).as_posix():{'hash':hashlib.sha256(p.read_bytes()).hexdigest()[:16],'bytes':p.stat().st_size} for p in files}
(base/'asset-cache.json').write_text(json.dumps(entries,separators=(',',':'))+'\n')
print(len(entries),'versioned assets;',round(sum(v['bytes'] for v in entries.values())/1e6,1),'MB; original maps excluded')
