import subprocess,time,os,signal,json
try:os.unlink('/tmp/prepared-page-stage.json')
except FileNotFoundError:pass
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));log='/tmp/prepared-fullpage.log'
with open(log,'w') as out:
 p=subprocess.Popen(['node','--max-old-space-size=256','work/experiments/test-prepared-fullpage.cjs'],cwd=root,stdout=out,stderr=out,start_new_session=True);start=time.time();low=100000;reason=None;stages={}
 while p.poll() is None:
  av=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))//1024;low=min(low,av)
  try:stage=json.load(open('/tmp/prepared-page-stage.json'))['name'];stages[stage]=min(stages.get(stage,100000),av)
  except (FileNotFoundError,KeyError,json.JSONDecodeError):pass
  if av<450:reason='reserve';break
  if time.time()-start>60:reason='timeout';break
  time.sleep(.1)
 if reason:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=3)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
result={'exit':p.returncode,'minimumMemAvailableMB':low,'seconds':round(time.time()-start,2),'stop':reason,'stages':stages};
for line in open(log):
 try:
  parsed=json.loads(line)
  if isinstance(parsed,dict):result['result']=parsed
 except json.JSONDecodeError:pass
print(json.dumps(result));print(open(log).read()[-5000:]);open('/tmp/prepared-fullpage-guard.json','w').write(json.dumps(result));raise SystemExit(0 if p.returncode==0 and not reason else 1)
