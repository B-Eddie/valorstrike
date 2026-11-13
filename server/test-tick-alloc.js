// perf3 step 2 (user: "keep iterating lag in BOTH offline and online games, focus online first"): what is left of the online
// 5v5 server tick's garbage after the world queries (test-bvh-fast.js). An online profile (work/perf_online_profile.cjs, heap
// sampling) still put these on every tick, each answer must stay exactly what it was:
//  - path.js searchFast (every bot re-route, the scripted human's route): two closures per search (heap push / pop) and one
//    Math.hypot per pushed node - V8's builtin copies its arguments into a fresh array (~84 B a call);
//  - bots.js variedPath: Math.hypot on the cached-route check every bot runs every tick;
//  - spike.js world.blocked (every unit's motor step, several calls per unit per tick): an effects.some(e => ...) closure per call;
//  - worker.js wireRoundState (every human, every batched snapshot): a closure plus an Object.entries array of [key, value]
//    pairs per object in the round state.
// Checked on the real collision worlds (ascent + split):
import cp from 'node:child_process';
if(!process.execArgv.some(a=>/semi-space/.test(a))){const r=cp.spawnSync(process.execPath,['--max-semi-space-size=256',...process.argv.slice(1)],{stdio:'inherit'});process.exit(r.status==null?1:r.status);}
import fs from 'node:fs';import fsp from 'node:fs/promises';import vm from 'node:vm';import assert from 'node:assert/strict';import v8 from 'node:v8';
import {loadWorld} from './src/world.js';import {hyp2,hyp3} from './src/hyp.js';import {path,search} from './src/path.js';import {variedPath} from './src/bots.js';import {SpikeSimulation} from './src/spike.js';import {barrierBlocked} from './src/abilities.js';import SpawnBarriers from '../vendor/spawn-barriers.cjs';
const assets={async fetch(r){try{return new Response(await fsp.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;const out=[];
// bytes per call: warmed up first; allocated = heap growth + whatever the GCs during the run freed (v8.GCProfiler)
const alloc=(f,n,warm=n)=>{for(let i=0;i<warm;i++)f(i);const g=new v8.GCProfiler();g.start();const h0=v8.getHeapStatistics().used_heap_size;for(let i=0;i<n;i++)f(i);const h1=v8.getHeapStatistics().used_heap_size,st=g.stop();let freed=0;for(const e of st.statistics)freed+=e.beforeGC.heapStatistics.usedHeapSize-e.afterGC.heapStatistics.usedHeapSize;return Math.max(0,h1-h0+freed)/n;};
// Math.hypot calls made while f runs (each one is ~84 B of garbage in V8)
const H0=Math.hypot;let hyN=0;const countHypot=f=>{hyN=0;Math.hypot=function(...a){hyN++;return H0.apply(Math,a);};try{f();}finally{Math.hypot=H0;}return hyN;};
// the worker's wireRoundState as it was (5456dcd), the reference for the wire bytes
const cleanRef=v=>typeof v==='number'?Math.round(v*1000)/1000:Array.isArray(v)?v.map(cleanRef):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,n])=>[k,cleanRef(n)])):v;
const src=fs.readFileSync('src/worker.js','utf8'),ctx={DurableObject:class{},crypto:globalThis.crypto,Date,URL,performance,setInterval:()=>1,clearInterval(){},Map,JSON,Number,Object,Math,Array,console,kits:{}};vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;',ctx);const wire=ctx.GameRoom.prototype.wireRoundState;
vm.runInContext('globalThis.cleanRef='+cleanRef.toString().replace(/cleanRef/g,'cleanRefX')+';function cleanRefX(v){return cleanRef(v);}',ctx);const cleanRefVm=ctx.cleanRef;/* the reference in the same realm as the worker code, for the allocation comparison */

// hyp.js == Math.hypot bit for bit, edge values included (zeros, signed zeros, NaN, infinities, subnormals, huge)
{const v=[0,-0,NaN,Infinity,-Infinity,1,-2.5,3,4,1e-320,5e-324,1e308,-1e308,1/3];for(const x of v)for(const y of v){assert(Object.is(hyp2(x,y),Math.hypot(x,y)),`hyp2(${x},${y})`);for(const z of v)assert(Object.is(hyp3(x,y,z),Math.hypot(x,y,z)),`hyp3(${x},${y},${z})`);}
 for(let k=0;k<100000;k++){const x=(rnd()-.5)*10**(rnd()*8-4),y=(rnd()-.5)*10**(rnd()*8-4),z=k%7?(rnd()-.5)*3:0;assert(Object.is(hyp2(x,y),Math.hypot(x,y))&&Object.is(hyp3(x,y,z),Math.hypot(x,y,z)),`hyp ${x} ${y} ${z}`);}}
for(const map of ['ascent','split']){const W=await loadWorld(assets,map),P=W.playable,pick=()=>P[Math.floor(rnd()*P.length)];
 // 1) A*: identical routes; no Math.hypot; per search only the route it returns (p, reverse, the caller's copy, the cache entry)
 {const pairs=[];for(let k=0;k<900;k++)pairs.push([pick(),pick()]);let len=0;
  for(const [s,e] of pairs.slice(0,150)){const a=path(W,s,e);assert.deepEqual(a,search(W,s,e),`${map} path ${s}->${e} == reference`);}
  const fresh=pairs.slice(150,300);const hy=countHypot(()=>{for(const [s,e] of fresh)len+=path(W,s,e).length;});
  assert.equal(hy,0,`${map}: A* (path.js searchFast) calls Math.hypot ${hy} times for ${fresh.length} searches (V8's builtin allocates ~84 B a call)`);
  const miss=pairs.slice(300,900);let lenM=0;for(const [s,e] of miss.slice(0,300))lenM+=search(W,s,e).length;const avg=lenM/300;
  const b=alloc(i=>path(W,miss[300+i][0],miss[300+i][1]),300,0);/* misses only: every pair is new to the cache */
  const bound=48*avg+400;out.push(`${map}: A* miss ${b.toFixed(0)} B/search (route ~${avg.toFixed(0)} nodes, bound ${bound.toFixed(0)})`);
  assert(b<bound,`${map}: A* (path.js searchFast) allocates ${b.toFixed(0)} B per search, bound ${bound.toFixed(0)} (the route arrays and cache entry only)`);}
 // 2) variedPath's cached-route check: no Math.hypot, same answer
 {const sim={world:W,round:3,time:1,units:[],map};let calls=0,hy=0,checked=0;
  for(let k=0;k<200;k++){const s=pick(),e=pick(),r=search(W,s,e);if(r.length<12)continue;const u={team:0,vroute:{goal:e,round:3,team:0,path:r.slice(),i:0}};const start=k%2?r[5]:(W.nav.adj[r[6]].find(n=>!r.includes(n))??r[6]);
   const find=()=>{calls++;return [start];};let got;hy+=countHypot(()=>{got=variedPath(sim,u,start,e,find);});
   const j=r.indexOf(start);if(j>=0){assert.deepEqual(got,r.slice(j),`${map}: variedPath follows its cached route`);checked++;}}
  assert(checked>20,'variedPath cases ran');assert.equal(hy,0,`${map}: variedPath's cached-route check calls Math.hypot ${hy} times (V8's builtin allocates ~84 B a call)`);}
 // 3) SpikeSimulation world.blocked == base || spawn walls || live barriers, and the barrier check allocates nothing
 {const sim=new SpikeSimulation(W,'five',map,()=>.5),B=sim.baseWorld,wb=sim.world.blocked;sim.phase='game';sim.buy=0;sim.time=10;
  const n0=W.nav.nodes[P[0]],far=[n0[0],n0[1],n0[2]];sim.effects=[{kind:'smoke',p:far,until:99},{kind:'barrier',hp:0,until:99,p:far,yaw:0},{kind:'barrier',hp:800,until:5,p:far,yaw:0},{kind:'barrier',hp:800,until:99,p:far,yaw:.7}];
  const Q=[];for(let k=0;k<4000;k++){const n=W.nav.nodes[k%3?pick():P[0]];Q.push([n[0]+(rnd()-.5)*3,n[2]+(rnd()-.5)*3,.4,n[1]+(rnd()-.3)*.6]);}
  let hits=0;for(const [x,z,r,y] of Q){const ref=B.blocked(x,z,r,y,1.8)||sim.spawnWalls()&&SpawnBarriers.blocked(B.map.key,x,z,r,y,1.8)||sim.effects.some(e=>e.kind==='barrier'&&e.hp>0&&e.until>sim.time&&barrierBlocked(e,x,z,r,y,1.8));assert.equal(wb(x,z,r,y,1.8),ref,`${map}: world.blocked(${x},${z},${r},${y})`);if(ref)hits++;}
  assert(hits>50&&hits<3900,`blocked cases mixed (${hits})`);
  sim.effects=[{kind:'smoke',p:far,until:99},{kind:'barrier',hp:0,until:99,p:far,yaw:0},{kind:'barrier',hp:800,until:5,p:far,yaw:0}];/* none live: every call walks the whole list */
  const free=Q.filter(([x,z,r,y])=>!B.blocked(x,z,r,y,1.8));const qa=free.map(q=>q.slice());
  const mw=()=>alloc(i=>wb(...qa[i%qa.length],1.8),20000,20000),bw0=mw(),bb=alloc(i=>B.blocked(...qa[i%qa.length],1.8),20000,20000),bw=Math.min(bw0,mw()),d=bw-bb;/* the wrapper is measured before and after the map query and the lower one counts: the first window can still carry ~13 B a call of warm-up (seen on Split once world.blocked remembered its answers); a real per-call closure shows in both */
  out.push(`${map}: world.blocked barrier check ${d.toFixed(1)} B/call`);assert(d<8,`${map}: SpikeSimulation world.blocked allocates ${d.toFixed(1)} B per call on top of the map query (the effects.some closure), bound 8`);}
 // 4) wireRoundState: the same wire JSON, without the per-object closures / entries arrays
 {const sim=new SpikeSimulation(W,'five',map,()=>.5);for(const n of ['a','b','c','d','e','f','g','h','i','j'])sim.add(n);sim.start(false);for(let k=0;k<40;k++)sim.step(.05);
  const us=sim.units;for(const u of us){u.credits=1234.56789;u.concussUntil=sim.time+1.23456;u.roundCr=800;}us[1].alive=false;
  const room={sim};for(const u of us)assert.equal(JSON.stringify(wire.call(room,u)),JSON.stringify(cleanRef(sim.roundState(u))),`${map}: wireRoundState wire bytes for ${u.name}`);
  const rsA=us.map(u=>sim.roundState(u)),rooms=rsA.map(r=>({sim:{roundState:()=>r}}));const bn=alloc(i=>wire.call(rooms[i%rooms.length],us[i%us.length]),4000,4000),br=alloc(i=>cleanRefVm(rsA[i%rsA.length]),4000,4000),bs=JSON.stringify(cleanRef(rsA[0])).length;
  out.push(`${map}: wireRoundState ${bn.toFixed(0)} B vs ${br.toFixed(0)} B reference (${bs} B JSON)`);assert(bn<br*.6,`${map}: wireRoundState allocates ${bn.toFixed(0)} B per call, reference ${br.toFixed(0)} B (bound 60 %)`);}
}
console.log('Tick alloc: '+out.join('; '));
