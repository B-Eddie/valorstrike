import subprocess,os,time,signal,json
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));jobs=[]
def launch(args,log,env=None):
 p=subprocess.Popen(args,cwd=root,stdout=open(log,'w'),stderr=subprocess.STDOUT,env=env,start_new_session=True);jobs.append(p);return p
try:
 launch(['node','--max-old-space-size=256','server/tools/browser-bridge.mjs'],'/tmp/mesh-bridge.log')
 launch(['python3','-m','http.server','8876','--bind','127.0.0.1'],'/tmp/mesh-static.log')
 time.sleep(.7)
 env=os.environ|{'PW':'/usr/share/code/resources/app/node_modules/playwright-core','ROOT':root,'QA':root+'/work/two-browser/qa/','SOLO':'1','REDUCED':'1','MAP':'lotus','AGENT_A':'Deadlock','SCEN':root+'/work/two-browser/scen_mesh_live.cjs','SHOT':'/downloads/'}
 p=launch(['node','work/two-browser/tb.cjs','/tmp/mesh-live.json'],'/tmp/mesh-live.log',env)
 start=time.time();low=2000
 while p.poll() is None and time.time()-start<90:
  av=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))//1024;low=min(low,av)
  if av<450:print('RESERVE STOP',av);break
  time.sleep(.25)
 print('exit',p.poll(),'elapsed',time.time()-start,'minimum available MB',low)
finally:
 for p in jobs:
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
 for p in jobs:
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL)
