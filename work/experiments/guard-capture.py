# Bounded foreground capture/cold load guard. MemAvailable is headroom, not per-process proof.
import os,sys,subprocess,time,signal,json
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
count=int(sys.argv[1]) if len(sys.argv)>1 else 24
env=os.environ|{'COUNT':str(count),'PRODUCTION':'1','CAPTURE':'/tmp/lotus-prepared-'+str(count)}
results=[]
for script in ['capture-prepared-subset.cjs','load-captured-subset-gpu.cjs']:
 log='/tmp/'+script+'.log'
 with open(log,'w') as out:
  p=subprocess.Popen(['node','--max-old-space-size=256','work/experiments/'+script],cwd=root,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
  start=time.time();low=100000;reason=None
  while p.poll() is None:
   available=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))//1024;low=min(low,available)
   if available<450:reason='reserve guard';break
   if time.time()-start>60:reason='foreground timeout';break
   time.sleep(.1)
  if reason:
   os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=3)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  row={'script':script,'count':count,'exit':p.returncode,'seconds':round(time.time()-start,2),'minimumMemAvailableMB':low,'stop':reason}
  try:row['stage']=json.load(open(env['CAPTURE']+'/stage.json'))['stage']
  except (FileNotFoundError,KeyError):pass
  results.append(row);print(json.dumps(row),flush=True)
 print(open(log).read()[-2500:],flush=True)
 if p.returncode or reason:break
open('/tmp/lotus-guard-'+str(count)+'.json','w').write(json.dumps(results,indent=1))
sys.exit(0 if len(results)==2 and all(r['exit']==0 and not r['stop'] for r in results) else 1)
