// Asset pipeline: persistent Cache Storage fetch, GLB load dedupe, and the
// lobby background preload that removes the ~40 s agent-load stall at match start.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const src=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8');
 const a=src.indexOf('var XV = '),b=src.indexOf('function xvFind(');
 assert(a>=0&&b>a,'asset pipeline source found');
 const slice=src.slice(a,b);
 const mk=(env)=>new Function('window','caches','fetch','THREE','navigator','matchMedia','requestIdleCallback','setTimeout','XUB_AG','XGM','xvAgentLoad',
   slice+';return {XV,xvFetch,xvLoad,xvJson,xvPreload,xvReadyAgents};')(
   env.window,env.caches,env.fetch,env.THREE,env.navigator,env.matchMedia,undefined,setTimeout,env.XUB_AG,env.XGM,env.xvAgentLoad);
 const THREE={GLTFLoader:class{parse(buf,path,ok,err){ok({scene:{bytes:buf.byteLength},animations:[]});}}};
 const AG={Jett:['f'],Phoenix:['m'],Sova:['m'],Sage:['f'],Reyna:['f'],Raze:['f'],Cypher:['m'],Omen:['m'],Brimstone:['m'],Viper:['f'],Killjoy:['f'],Skye:['f']};
 const GUN={F:{Classic:'valorant/classic',Vandal:'valorant/vandal',Operator:'valorant/operator'}};
 const resp=(body)=>({ok:true,status:200,arrayBuffer:async()=>body,clone(){return resp(body);},json:async()=>JSON.parse(new TextDecoder().decode(body))});
 // 1. Cache Storage hit: second fetch of the same URL never touches the network.
 {
  let net=0;const store=new Map();
  const caches={open:async()=>({match:async(u)=>store.get(u),put:async(u,r)=>store.set(u,r)})};
  const fetch=async()=>{net++;return resp(new TextEncoder().encode('glb-bytes').buffer);};
  const api=mk({window:{caches},caches,fetch,THREE,navigator:{},matchMedia:()=>({matches:false}),XUB_AG:AG,XGM:GUN});
  const b1=await api.xvFetch('models/valorant/jett.glb');
  const b2=await api.xvFetch('models/valorant/jett.glb');
  assert.equal(net,1,'persistent cache: one network fetch for repeated URL, got '+net);
  assert.equal(new TextDecoder().decode(b2),'glb-bytes','cached bytes returned');
 }
 // 2. No Cache API: plain fetch, and GLB load dedupes concurrent callers.
 {
  let net=0,parse=0;
  const THREE2={GLTFLoader:class{parse(buf,p,ok){parse++;ok({scene:{},animations:[]});}}};
  const fetch=async()=>{net++;await new Promise(r=>setTimeout(r,5));return resp(new ArrayBuffer(8));};
  const api=mk({window:{},caches:undefined,fetch,THREE:THREE2,navigator:{},matchMedia:()=>({matches:false}),XUB_AG:AG,XGM:GUN});
  const [g1,g2]=await Promise.all([api.xvLoad('jett'),api.xvLoad('jett')]);
  assert.equal(net,1,'dedupe: one fetch for concurrent loads, got '+net);
  assert.equal(parse,1,'dedupe: one parse for concurrent loads, got '+parse);
  assert(g1&&g2,'both callers resolved');
 }
 // 3. xvJson parses through the same cache path.
 {
  const store=new Map();
  const caches={open:async()=>({match:async(u)=>store.get(u),put:async(u,r)=>store.set(u,r)})};
  const fetch=async()=>resp(new TextEncoder().encode('[{"name":"Idle"}]').buffer);
  const api=mk({window:{caches},caches,fetch,THREE,navigator:{},matchMedia:()=>({matches:false}),XUB_AG:AG,XGM:GUN});
  const j=await api.xvJson('models/valorant/jett-locomotion.json');
  assert.equal(j[0].name,'Idle','locomotion JSON decoded');
 }
 // 4. Preload walks every agent and weapon, chosen agent first; skips on coarse pointers.
 {
  const agents=[],guns=[];
  const api=mk({window:{J:{pick:'Raze'}},caches:undefined,fetch:async()=>resp(new ArrayBuffer(4)),THREE,
    navigator:{connection:{saveData:false,effectiveType:'4g'}},matchMedia:()=>({matches:false}),XUB_AG:AG,XGM:GUN,
    xvAgentLoad:async(ag)=>{agents.push(ag);}});
  const origLoad=api.xvLoad;
  // xvLoad is captured by closure inside xvPreload; re-run with a counting wrapper via XGM values.
  const api2=mk({window:{J:{pick:'Raze'}},caches:undefined,fetch:async()=>{guns.push('f');return resp(new ArrayBuffer(4));},THREE,
    navigator:{connection:{saveData:false,effectiveType:'4g'}},matchMedia:()=>({matches:false}),XUB_AG:AG,XGM:GUN,
    xvAgentLoad:async(ag)=>{agents.push(ag);}});
  await api2.xvPreload();
  assert.equal(agents.length,12,'all 12 agents preloaded, got '+agents.length);
  assert.equal(agents[0],'Raze','chosen agent preloads first');
  assert(guns.length>=3,'weapons fetched, got '+guns.length);
  const agents2=[];
  const api3=mk({window:{},caches:undefined,fetch:async()=>resp(new ArrayBuffer(4)),THREE,
    navigator:{connection:{saveData:false,effectiveType:'4g'}},matchMedia:()=>({matches:true}),XUB_AG:AG,XGM:GUN,
    xvAgentLoad:async(ag)=>{agents2.push(ag);}});
  await api3.xvPreload();
  assert.equal(agents2.length,0,'coarse pointer skips preload');
 }
 // 5. Match start aborts the background trickle; readiness gate retries once then rejects.
 {
  const agents=[];
  let release;const gate=new Promise(r=>release=r);
  const api=mk({window:{J:{}},caches:undefined,fetch:async()=>resp(new ArrayBuffer(4)),THREE,
    navigator:{connection:{}},matchMedia:()=>({matches:false}),XUB_AG:AG,XGM:GUN,
    xvAgentLoad:async(ag)=>{agents.push(ag);await gate;}});
  const p=api.xvPreload();
  await new Promise(r=>setTimeout(r,10));
  api.XV.preloading='abort';release();
  await p;
  assert.equal(agents.length,1,'abort stops the preload loop after the in-flight item, got '+agents.length);
  let calls=0;
  const flaky=mk({window:{},caches:undefined,fetch:async()=>resp(new ArrayBuffer(4)),THREE,
    navigator:{},matchMedia:()=>({matches:false}),XUB_AG:{Jett:['f']},XGM:GUN,
    xvAgentLoad:async()=>{calls++;if(calls<2)throw new Error('flaky');}});
  assert(flaky.xvReadyAgents,'readiness gate exposed');
  await flaky.xvReadyAgents();
  assert.equal(calls,2,'one retry per failing kit, got '+calls);
  calls=0;
  const broken=mk({window:{},caches:undefined,fetch:async()=>resp(new ArrayBuffer(4)),THREE,
    navigator:{},matchMedia:()=>({matches:false}),XUB_AG:{Jett:['f']},XGM:GUN,
    xvAgentLoad:async()=>{calls++;throw new Error('down');}});
  await assert.rejects(broken.xvReadyAgents(),'persistent failure rejects so the match start aborts');
  assert.equal(calls,2,'exactly initial + one retry, got '+calls);
 }
 console.log('asset pipeline: cache hit, fetch fallback, load dedupe, full preload order, mobile skip, match-start abort, readiness retry');
})().catch(e=>{console.error(e);process.exit(1)});
