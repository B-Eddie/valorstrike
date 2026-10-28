// Local CPU/serialization fixture, never a network/FPS measurement. Run from repo root.
import fs from 'node:fs';import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
import v8 from 'node:v8';
import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
let baselineRoot=null;
if(process.argv.includes('--baseline')){
 baselineRoot=fs.mkdtempSync(path.join(os.tmpdir(),'lagopt-baseline-'));
 fs.cpSync('server/src',path.join(baselineRoot,'server/src'),{recursive:true});
 fs.symlinkSync(path.resolve('vendor'),path.join(baselineRoot,'vendor'),'dir');
 for(const file of ['worker','tdm','tdmrooms'])fs.copyFileSync(`qa/lagopt/fixtures/${file}-before.js`,path.join(baselineRoot,'server/src',file+'.js'));
 fs.writeFileSync(path.join(baselineRoot,'server/package.json'),' {"type":"module"} ');
}
const modulePath=file=>pathToFileURL(path.resolve(baselineRoot?path.join(baselineRoot,'server/src',file):'server/src/'+file)).href;
const {Simulation}=await import(modulePath('simulation.js'));
const {TdmSimulation}=await import(modulePath('tdm.js'));
const {SpikeSimulation}=await import(modulePath('spike.js'));
const {fogView,fogCast}=await import(modulePath('fog.js'));
const label=process.argv[2]||'current';
const rng=()=>{let n=7;return ()=>((n=n*16807%2147483647)/2147483647);};
const nodes=[],adj=[];
for(let x=0;x<31;x++)for(let z=0;z<31;z++){const i=x*31+z;nodes.push([x*2-30,0,z*2-30]);adj.push([...(x?[i-31]:[]),...(x<30?[i+31]:[]),...(z?[i-1]:[]),...(z<30?[i+1]:[])]);}
function world(nav={nodes,adj}){return {map:{key:'fixture',attacker:[-20,0,-20],defender:[20,0,20],sites:{A:[-10,0,0],B:[10,0,0]}},nav,playable:nav.nodes.map((_,i)=>i),near(x,z){let d=Infinity,j=0;for(let i=0;i<nav.nodes.length;i++){const p=nav.nodes[i],dd=(p[0]-x)**2+(p[2]-z)**2;if(dd<d){d=dd;j=i;}}return j;},ground:()=>0,blocked:()=>false,ray:()=>Infinity};}
const summarize=a=>{a.sort((a,b)=>a-b);return {mean:a.reduce((a,b)=>a+b,0)/a.length,p50:a[a.length>>1],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)};};
const alloc=f=>{for(let i=0;i<200;i++)f(i);const gc=new v8.GCProfiler();gc.start();const h=v8.getHeapStatistics().used_heap_size,t=performance.now();for(let i=0;i<2000;i++)f(i);const ms=performance.now()-t,h1=v8.getHeapStatistics().used_heap_size,g=gc.stop();return {bytesPerCall:Math.max(0,h1-h+g.statistics.reduce((s,e)=>s+e.beforeGC.heapStatistics.usedHeapSize-e.afterGC.heapStatistics.usedHeapSize,0))/2000,msPerCall:ms/2000,gcs:g.statistics.length};};
let now=1e6;
const C={DurableObject:class{constructor(c,e){this.ctx=c;this.env=e;}},Date:class extends Date{static now(){return now;}},crypto:globalThis.crypto,performance,console,setInterval:()=>1,clearInterval(){},fogView,fogCast};
const source=fs.readFileSync(baselineRoot?path.join(baselineRoot,'server/src/worker.js'):'server/src/worker.js','utf8');
// Optional shared codec is loaded only after it exists; baseline uses the unchanged worker.
if(fs.existsSync('server/src/snapshot-codec.js'))Object.assign(C,await import('../../server/src/snapshot-codec.js'));
vm.createContext(C);vm.runInContext(source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.Room=GameRoom;',C);
const result={label,node:process.version,fixture:'synthetic flat collision, 961 nav nodes; real simulation/worker/fog/wire. Timers inclusive; wall time on shared sandbox.'};
for(const [mode,Cls] of [['dm',Simulation],['tdm',TdmSimulation],['five',SpikeSimulation]]){
 const r=new C.Room({},{});r.advertise=()=>{};r.saveResults=()=>{};r.last=now;r.sim=new Cls(world(),mode,'fixture',rng());
 for(let i=0;i<10;i++)r.sim.add('Player '+i,'Jett',i<5,i%2);
 r.sim.start(false);if(mode==='five')r.sim.buy=0;r.sim.maxKills=1e9;r.sim.roundWin=1e9;r.sim.remaining=1e9;
 const cost={},orig={};for(const k of ['step','bot','motor','fireTick','snapshot','roundState']){if(typeof r.sim[k]!=='function')continue;orig[k]=r.sim[k];cost[k]=[];r.sim[k]=function(...a){const t=performance.now();try{return orig[k].apply(this,a);}finally{cost[k].push(performance.now()-t);}};}
 const sent=[],bytes=[],messages=[];
 for(const u of r.sim.units.filter(u=>u.human)){const s={id:u.name,u,ready:true,last:now,batch:true,ackMode:true,sent:0,acked:0,delta:true};const w={bufferedAmount:0,send(d){sent.push(d);s.acked=s.sent+1;},close(){}};r.sessions.set(w,s);}
 const tick=[],traces=[];let traceBases=[];for(let i=0;i<700;i++){
  now+=50;for(const s of r.sessions.values()){s.last=now;s.u.input={forward:1,side:Math.sin(i/20)};s.u.inputAt=r.sim.time;s.u.lastSeq=i;s.pingAt=now;}
  if(i%90===0&&r.sim.effects)r.sim.effects.push({kind:'smoke',id:1000+i,p:[0,0,0],until:r.sim.time+5,radius:4,owner:r.sim.units[0].id,team:0});
  // Synthetic respawn burst: keep the fixture alive without changing the production game.
  if(i%100===0)for(const u of r.sim.units){u.alive=false;u.respawnAt=r.sim.time;}
  if(i===100&&process.argv.includes('--capture'))traceBases=[...r.sessions.values()].map(s=>s.deltaBase?Object.fromEntries(Object.entries(s.deltaBase.fields).map(([k,v])=>[k,JSON.parse(v)])):null);
  const t=performance.now();r.tickBody();const ms=performance.now()-t;
  if(i>=100){tick.push(ms);bytes.push(sent.reduce((s,d)=>s+Buffer.byteLength(d),0));messages.push(sent.length);}
  if(i>=100&&i<300)for(const d of sent){const m=JSON.parse(d);if(m.t==='s'||m.t==='sd')traces.push(m);}
  sent.length=0;
 }
 result[mode]={tickMs:summarize(tick),bytesPerTick:summarize(bytes),messagesPerTick:summarize(messages),methods:Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,summarize(v)])),errors:r.metrics.errors||0};
 if(process.argv.includes('--capture')){fs.writeFileSync(`qa/lagopt/${label}-${mode}-frames.json.gz`,gzipSync(JSON.stringify(traces)));fs.writeFileSync(`qa/lagopt/${label}-${mode}-bases.json.gz`,gzipSync(JSON.stringify(traceBases)));}
}
// Actual Ascent navigation, synthetic always-open collision. Isolates full-scan respawn cost.
{
 const nav=JSON.parse(fs.readFileSync('models/valorant/maps/ascent/navigation.json')),w=world(nav);w.map=JSON.parse(fs.readFileSync('models/valorant/maps/ascent/map.json'));let blocks=0;w.blocked=()=>{blocks++;return false;};
 const s=new TdmSimulation(w,'tdm','ascent',rng()),u=s.add('Spawn');const a=[];blocks=0;
 for(let i=0;i<200;i++){const t=performance.now();s.teamSpawnPoint(u);a.push(performance.now()-t);}
 result.spawn={nodes:nav.nodes.length,ms:summarize(a),collisionQueries:blocks,allocation:alloc(()=>s.teamSpawnPoint(u))};
}
fs.writeFileSync(`qa/lagopt/${label}.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));

if(baselineRoot)fs.rmSync(baselineRoot,{recursive:true,force:true});
