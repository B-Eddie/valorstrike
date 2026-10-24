"""Fetch the public 2024 Blender map ports by Cracker646. Caches are never committed."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import gdown
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/map-source';OUT.mkdir(exist_ok=True)
FILES={'ascent':'1n9Z3-kMqzaqETP1lxGvQpfQSBrX5zChB','bind':'1kAY2m05wdDnU9_3aOgrL_4b-p66AuLnK','breeze':'1QpiCKTIJgzU735HzNH84Io5eYeoPhDdd','haven':'1e1wFXD2iBrYMPFNBwUgDnE9GpPTwt9rJ','lotus':'1J_FcYU3iRcvZIGRvxvdM8s7sRm5OAPTN','split':'1yTkqrAbinK1PyAFNZoyUfjvd5vA0ZMMd'}
def run(item):
 k,i=item;p=OUT/(k+'.blend')
 if not p.exists():gdown.download('https://drive.google.com/uc?id='+i,str(p),quiet=True)
 print(k,p.stat().st_size,flush=True)
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=3) as ex:list(ex.map(run,FILES.items()))
