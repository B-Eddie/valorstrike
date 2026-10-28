# Runs every requested suite even after failures. No install, network, git, or deploy commands.
import subprocess,pathlib,json,time,sys,re
root=pathlib.Path(__file__).resolve().parents[2];out=root/('qa/lagopt/all-tests' if '--all' in sys.argv else 'qa/lagopt/tests');out.mkdir(exist_ok=True)
server=['test-release-gate.cjs','test.js','test-network.js','test-reconnect.js','test-netdrop.js','test-bug-lanes.js','test-bot-tactics.js','test-bot-brain.js','test-bot-perception.js','test-bot-shoot-utility.js','test-two-player.js','test-perf.js','test-bvh-fast.js','test-tick-alloc.js','test-bundle.cjs','test-soak.js']
client=['test_net_transport.cjs','test_net_drop.cjs','test_net_stall.cjs','test_net_clean_alloc.cjs','test_net_clean_rs.cjs','test_net_reconcile.cjs','test_network_smoothing.cjs','test_remote_interp.cjs','test_frame_perf.cjs','test_hypot.cjs','test_agent_preload.cjs','test_map_load_stall.cjs','test_round_start_perf.cjs','test_client_online.cjs','test_bug_lanes.cjs']
if '--all' in sys.argv:
 server=re.findall(r'node (test[^ &]+)',json.loads((root/'server/package.json').read_text())['scripts']['test'])
 client=sorted(p.name for p in (root/'work').glob('test_*.cjs') if p.name not in ['test_all.cjs','test_slice.cjs'])+['test_feel.js']
results=[]
for folder,files in [('server',server),('work',client)]:
 for f in files:
  key=('server-' if folder=='server' else 'client-')+f;start=time.monotonic()
  try:
   p=subprocess.run(['node',f if folder=='server' else str(root/'work'/f)],cwd=root/'server' if folder=='server' else root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90,text=True)
   text=p.stdout;code=p.returncode
  except subprocess.TimeoutExpired as e:text=str(e.stdout);code=124
  (out/(key+'.log')).write_text(text);row={'suite':key,'exit':code,'seconds':round(time.monotonic()-start,3)};results.append(row);print(row,flush=True)
(root/('qa/lagopt/all-test-results.json' if '--all' in sys.argv else 'qa/lagopt/test-results.json')).write_text(json.dumps(results,indent=2)+'\n')
