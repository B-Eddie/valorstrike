// #10: agent asset pipeline. Lobby preload fetches the picked agent first, then everything else in parallel; the shared
// locomotion files download once for all agents; Cache Storage serves repeat visits with zero network; only hash-verified
// bytes are stored; stale versions are pruned; failures retry; progress is monotonic and completes.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const s=fs.readFileSync(__dirname+'/valorant_runtime.js','utf8'),a=s.indexOf('// Agent assets (#10)'),b=s.indexOf('// Progress label over',a);assert(a>0&&b>a);
const AG=['Jett','Phoenix','Sova','Sage','Reyna','Raze','Killjoy','Omen','Skye','Chamber','Breach','Cypher'];
const body=(f)=>Buffer.from('bytes of '+f+' '.repeat(f.length*7));const sha=(x)=>crypto.createHash('sha256').update(x).digest('hex');
const names=AG.map(x=>x.toLowerCase()+'.glb').concat(['locomotion.json','locomotion.bin']),files={};names.forEach(f=>files[f]={bytes:body(f).length,sha256:sha(body(f))});
function makeStore(){const m=new Map(),abs=(u)=>new URL(u,'https://game.test/').href;return {m,open:async()=>({match:async(u)=>m.has(abs(u))?{arrayBuffer:async()=>m.get(abs(u)).slice(0)}:undefined,put:async(u,r)=>{m.set(abs(u),await r.arrayBuffer());},keys:async()=>[...m.keys()].map(url=>({url})),delete:async(k)=>m.delete(k.url)})};}
function boot(store,opts={}){const log=[],gate={};const ctx={console:{warn(){}},TextDecoder,Response,URL,crypto:crypto.webcrypto,location:{href:'https://game.test/'},navigator:{},setTimeout:(f)=>setImmediate(f),
  window:{VALORANT_AGENT_FILES:{files}},caches:store,XV:{agents:{},failures:{}},XUB_AG:Object.fromEntries(AG.map(x=>[x,1])),xvAgentName:(n)=>n,
  fetch:async(u)=>{const f=u.split('/').pop().split('?')[0];log.push(f);if(opts.hold&&opts.hold(f))await new Promise(r=>gate[f]=r);if(opts.fail&&opts.fail(f))return {ok:false,status:503};const d=opts.tamper&&opts.tamper(f)?Buffer.from('tampered'):body(f);return {ok:true,body:null,arrayBuffer:async()=>d.buffer.slice(d.byteOffset,d.byteOffset+d.length)};}};
  vm.createContext(ctx);vm.runInContext(s.slice(a,b)+';xvaParse=(buf)=>Promise.resolve({bytes:buf.byteLength});xvaLoco=function(){return XVA.loco||(XVA.loco=Promise.all([xvaFetch("locomotion.json"),xvaFetch("locomotion.bin")]).then(()=>({})).catch(e=>{XVA.loco=null;throw e;}));};xvaKit=(gl,L,slug)=>({slug,gl});XVA.wait=1;',ctx);return {ctx,log,gate};}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
  const store=makeStore();store.m.set('https://game.test/models/valorant/agents/jett.glb?v=0000000000000000',new ArrayBuffer(4)); // a superseded version
  const {ctx,log,gate}=boot(store,{hold:(f)=>f==='sage.glb'});
  ctx.xvPreloadAgents('Sage');await flush();await flush();
  assert.deepEqual(log.slice().sort(),['locomotion.bin','locomotion.json','sage.glb'],'picked agent and shared locomotion go first, alone');
  const prog=[];const all=ctx.xvAgentsReady(null,(p)=>prog.push(p.frac));gate['sage.glb']();await all;
  assert.equal(log.length,14,'every file fetched exactly once: '+log.join());assert.equal(log.filter(f=>/^locomotion/.test(f)).length,2,'shared locomotion downloaded once for twelve agents');
  assert.equal(Object.keys(ctx.XVA.kits).length,12);for(let i=1;i<prog.length;i++)assert(prog[i]>=prog[i-1],'monotonic progress');assert.equal(prog[prog.length-1],1);
  await flush();await flush();const keys=[...store.m.keys()];assert.equal(keys.length,14,'all verified files stored, stale version pruned');assert(keys.every(k=>/\?v=[0-9a-f]{16}$/.test(k)&&!k.includes('v=0000')));
  // repeat visit: zero network
  const second=boot(store);await second.ctx.xvAgentsReady();assert.equal(second.log.length,0,'repeat visit served from Cache Storage');assert.equal(Object.keys(second.ctx.XVA.kits).length,12);
  // integrity: tampered bytes are used but never cached
  const st3=makeStore(),third=boot(st3,{tamper:(f)=>f==='omen.glb'});await third.ctx.xvAgentsReady(['Omen']);await flush();await flush();assert(![...st3.m.keys()].some(k=>k.includes('omen.glb')),'hash mismatch not cached');assert([...st3.m.keys()].some(k=>k.includes('locomotion.bin')));
  // transient failures retry; no Cache Storage (insecure origin) still works
  let n=0;const fourth=boot(undefined,{fail:(f)=>f==='raze.glb'&&n++<2});await fourth.ctx.xvAgentsReady(['Raze']);assert.equal(fourth.log.filter(f=>f==='raze.glb').length,3,'two failures then success');
  const fifth=boot(undefined,{fail:(f)=>f==='skye.glb'});await assert.rejects(fifth.ctx.xvAgentsReady(['Skye']));assert.equal(fifth.log.filter(f=>f==='skye.glb').length,4,'gives up after 4 attempts');assert(fifth.ctx.XV.failures.Skye);
  console.log('Agent preload: lead agent first, 14 files once (shared locomotion once), repeat visit 0 requests, hash-gated caching, stale pruning, retries, monotonic progress');
})().catch(e=>{console.error(e);process.exit(1)});
