import subprocess,time,os,signal,json
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));log='/tmp/prepared-fullpage.log'
with open(log,'w') as out:
 p=subprocess.Popen(['node','--max-old-space-size=256','work/experiments/test-prepared-fullpage.cjs'],cwd=root,stdout=out,stderr=out,start_new_session=True);start=time.time();low=100000;reason=None
 while p.poll() is None:
  av=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))//1024;low=min(low,av)
  if av<450:reason='reserve';break
  if time.time()-start>60:reason='timeout';break
  time.sleep(.1)
 if reason:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=3)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
result={'exit':p.returncode,'minimumMemAvailableMB':low,'seconds':round(time.time()-start,2),'stop':reason};print(json.dumps(result));print(open(log).read()[-5000:]);open('/tmp/prepared-fullpage-guard.json','w').write(json.dumps(result));raise SystemExit(0 if p.returncode==0 and not reason else 1)
