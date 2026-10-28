"""Run test files directly: node spawnSync is EPERM in this sandbox, even for node -e.
Python subprocess works; each real stdout/stderr and exit status is retained.
Usage: python3 qa/buglanes/run-suites.py server|client
"""
from pathlib import Path
import json,re,subprocess,sys,time
root=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parent
kind=sys.argv[1]
if kind=='server':
 cwd=root/'server';names=re.findall(r'node (\S+)',json.loads((cwd/'package.json').read_text())['scripts']['test'])
else:
 cwd=root;names=['work/'+p.name for p in sorted((root/'work').glob('test_*.cjs')) if p.name not in ['test_all.cjs','test_slice.cjs']]+['work/test_feel.js']
rows=[]
for n in names:
 t=time.monotonic()
 try:
  r=subprocess.run(['node',n],cwd=cwd,capture_output=True,text=True,timeout=120)
  status=r.returncode;log=r.stdout+r.stderr;ok=status==0
 except subprocess.TimeoutExpired as e:
  status='TIMEOUT';log=str(e.stdout or '')+str(e.stderr or '');ok=False
 (out/(kind+'-'+Path(n).name+'.log')).write_text(log)
 # Nested Node runners may return EPERM; retain it as blocked, even if they return 0.
 if 'spawnSync' in log and 'EPERM' in log:ok=False
 rows.append(dict(name=n,ok=ok,status=status,seconds=round(time.monotonic()-t,2)))
 print(('PASS ' if ok else 'FAILED ')+n+' ('+str(status)+')',flush=True)
 (out/(kind+'-results.json')).write_text(json.dumps(rows,indent=2))
print(str(sum(r['ok'] for r in rows))+'/'+str(len(rows))+' passed',flush=True)
sys.exit(0 if all(r['ok'] for r in rows) else 1)
