// Online (trusted server) player prediction against other units' bodies (work/collide_runtime.js xcPlayer / xcLiveP / xcAt).
// mpsweep probe (online TDM, 75 s): 1-2 reconcile snaps (~1 m) per run that vanish with character collision off. Every unit
// the page draws online is a server unit, flagged nt (mpMkUnit: online-driven, no AI), and xcLive skipped nt units, so the
// page's prediction walked straight through units the server's step (simulation.js step / spike.js motor: Motor.bodies
// against every living unit's CURRENT x z) stopped the player at / slid it around. Making them solid where the page DRAWS
// them is not enough either: mpInterp replays the snapshots ~100-220 ms in the past, a unit crossing at run speed is
// 0.5-1.4 m off its drawn spot. The page now collides its player with each server unit at its newest snapshot carried
// forward by that snapshot's velocity to the server time that input is stepped at (page clock - snap clock offset + ping),
// capped; the unit is still DRAWN where mpInterp puts it. P2P (no server) keeps skipping its online-driven puppets.
//  1. a human walking across the player's path (real Simulation, both humans, 20 Hz snapshots, 100 ms render delay; each
//     acknowledged input's prediction vs the server, the error then taken out as the reconcile does): the page prediction ==
//     the server, tick by tick (walking through it, as on 7cdfdad: 0.26-0.30 m off in one tick; solid where it is drawn:
//     0.26-0.33 m).
//     Also with the other unit moved before the player in the server's step (lower id: the state after this step).
//  2. same with 80 ms ping: the newest snapshot is carried forward to the state the server steps the input against (one
//     ping later less a 10 ms jitter margin, whole 50 ms steps) - within 0.08 m of the server in any tick (walk-through / drawn: 0.26-0.33 m).
//  0. a server unit (nt) standing in the player's path stops the prediction at the contact (it walked through); P2P puppets
//     (nt, no server socket) still do not.
//  3. the drawn mesh is not moved; offline / no snapshot buffer / a stale buffer (> 400 ms) / a teleport-speed segment fall
//     back to the drawn position; the motor pair is untouched.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),src=fs.readFileSync(path.join(__dirname,'collide_runtime.js'),'utf8');
const A='// ---- CHARACTER COLLISION ----',Z='// ---- END CHARACTER COLLISION ----',i0=html.indexOf(A),i1=html.indexOf(Z,i0);assert(i0>0&&i1>i0,'character collision block in index.html');
const block=html.slice(i0,i1+Z.length);assert.equal(block,src.trimEnd(),'generated block == work/collide_runtime.js');
assert.equal(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'motor pair identical');
const fn=name=>{const a=html.indexOf('function '+name+'(');assert(a>=0,name);const lines=html.slice(a).split('\n'),out=[];let d=0;for(const l of lines){out.push(l);for(const ch of l){if(ch==='{')d++;else if(ch==='}')d--;}if(d<=0)break;}return out.join('\n');};
const Motor=require(path.join(root,'vendor/valorant-feel.js'));
const mk=()=>{const clock={t:0};const ctx={window:{},console,Math,Number,Array,Object,performance:{now:()=>clock.t}};ctx.clock=clock;ctx.window.ValorantFeel=Motor;ctx.window.window=ctx.window;vm.createContext(ctx);
 vm.runInContext(`var running=true,mode='five',paused=false,player=null,bots=[],allies=[],J={dis:0},MP={on:false,role:null,ping:0,snapClock:null},NET={socket:null},WALL=null,steps=[];const XS_V=[0,0];
 function blocked(x,z,r,y){return WALL?WALL(x,z,r):false;}function botRun(){return 5.4;}
 function tick(dt){for(const f of steps)f(dt);}function fiveTick(dt){for(const f of steps)f(dt);}function duelTick(dt){for(const f of steps)f(dt);}
 ${fn('xSmV')}
 ${block}`,ctx);return ctx;};
const W0={ground:()=>0,blocked:()=>false,leash:null,ceiling:null,ropes:null};
const pl=(x,z)=>({x,y:0,z,vx:0,vy:0,vz:0,ch:0,hp:100,air:false});
// render position the way mpInterp does (linear between the two samples around now - offset - delay)
const drawAt=(B,t)=>{let a=B[0],b=B[0];for(let i=0;i<B.length;i++){if(B[i].t<=t){a=B[i];b=B[i+1]||B[i];}}const span=b.t-a.t,k=span>0?Math.max(0,Math.min(1,(t-a.t)/span)):1;return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,z:a.z+(b.z-a.z)*k};};
(async()=>{
const {Simulation,weapons}=await import(path.join(root,'server/src/simulation.js'));
// One crossing: page player a walks +x, human b walks -z across its path. ping = round trip (ms) between the page and the server.
const cross=(ping,zB,bFirst)=>{const world={map:{attacker:[0,0,0],defender:[0,0,-10]},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const s=new Simulation(world,'tdm','ascent',()=>.5);let a,b;if(bFirst){b=s.add('b');a=s.add('a');}else{a=s.add('a');b=s.add('b');}s.start(false);s.spawnRooms=null;const put=(u,x,z)=>Object.assign(u,{x,y:0,z,vx:0,vy:0,vz:0,ch:0,air:false,input:{}});put(a,0,.1);put(b,2.4,zB);
 const c=mk(),P=pl(0,.1),U={g:{position:{x:2.4,y:0,z:zB}},alive:true,hp:100,cr:false,nb:[],hum:1,nt:1,nid:b.id};/* as mpMkUnit */
 vm.runInContext(`player=globalThis.__p;bots=globalThis.__b;MP.on=true;MP.role='client';MP.me=${a.id};NET.socket={};`,Object.assign(c,{__p:P,__b:[U]}));
 // Timing as the worker: the step at wall time W takes the inputs that arrived by W and sends its state stamped W (serverTime),
 // arriving half a ping later; the page acts mid-tick (W + 25), on a clock `off` ms ahead of the server's (snap clock offset =
 // off + the one-way delay), and its input arrives half a ping later. Within a step the server moves its units in id order.
 const off=5000,half=ping/2,inflight=[],up=[],hist={};let worst=0,seq=1,acked=0,minD=1e9;const speed=6.75*weapons[a.weapon].runSpeedMultiplier;
 for(let k=0;k<60;k++){const W=50*k;
  while(up.length&&up[0].at<=W)s.command(a,up.shift().m);s.command(b,{t:'in',seq:k+1,r:0,p:0,f:1});s.step(.05);inflight.push({at:W+half,t:W,x:b.x,y:b.y,z:b.z});
  const pw=W+25,now=pw+off;c.clock.t=now;
  while(inflight.length&&inflight[0].at<=pw){const q=inflight.shift();U.nb.push({t:q.t,clock:true,x:q.x,y:q.y,z:q.z,r:0,p:0});if(U.nb.length>32)U.nb.shift();}
  vm.runInContext(`MP.ping=${ping};MP.snapClock={offset:${off+half},delay:100,last:0,at:0,jitter:0};`,c);
  if(U.nb.length){const d=drawAt(U.nb,now-(off+half)-100);U.g.position.x=d.x;U.g.position.y=d.y;U.g.position.z=d.z;}
  const g0=[U.g.position.x,U.g.position.y,U.g.position.z];
  // page: one predicted step with this input, the input goes up
  const ox=P.x,oz=P.z;Motor.step(P,{x:1,z:0,speed},.05,W0);c.xcPlayer(P,.05,W0,ox,oz);up.push({at:pw+half,m:{t:'in',seq:seq++,r:-Math.PI/2,p:0,f:1}});
  assert.deepEqual([U.g.position.x,U.g.position.y,U.g.position.z],g0,'the drawn unit is never moved by the prediction');
  hist[seq-1]=[P.x,P.z];minD=Math.min(minD,Math.hypot(a.x-b.x,a.z-b.z));
  // the acknowledged input: its predicted position vs the server's right after it applied it; the error is then taken out of
  // the prediction (netReconcile / netShiftPath), so each acknowledgement measures only the error that tick's prediction added
  const n=a.lastSeq;if(n>0&&hist[n]&&n>acked){acked=n;const h=hist[n],ex=a.x-h[0],ez=a.z-h[1];worst=Math.max(worst,Math.hypot(ex,ez));P.x+=ex;P.z+=ez;for(const q in hist)if(+q>=n){hist[q][0]+=ex;hist[q][1]+=ez;}}}
 return {worst,touched:minD<2*Motor.C.bodyR+.02};};
// 0. a server unit standing in the path
{const c=mk(),P=pl(0,0),U={g:{position:{x:3,y:0,z:0}},alive:true,hp:100,cr:false,nb:[],hum:1,nt:1};vm.runInContext("player=globalThis.__p;bots=globalThis.__b;MP.on=true;MP.role='client';NET.socket={};",Object.assign(c,{__p:P,__b:[U]}));
 const walk=()=>{Object.assign(P,pl(0,0));let min=1e9;for(let k=0;k<120;k++){const ox=P.x,oz=P.z;Motor.step(P,{x:1,z:0,speed:5.4},1/60,W0);c.xcPlayer(P,1/60,W0,ox,oz);min=Math.min(min,Math.hypot(P.x-3,P.z));}return min;};
 const m0=walk();assert(m0>=2*Motor.C.bodyR-1e-6,`0. online (trusted server): a server unit (nt) is solid for the prediction, as on the server (min ${m0.toFixed(3)})`);
 vm.runInContext('NET.socket=null;',c);const m1=walk();assert(m1<.1,`0. P2P (no server socket): an online-driven puppet is still not (min ${m1.toFixed(3)})`);}
const R={};for(const [k,ping,zB,bf] of [['0',0,2.2,false],['0b',0,2.2,true],['80',80,2.4,false],['80b',80,2.4,true]]){R[k]=cross(ping,zB,bf);assert(R[k].touched,`scenario ${k}: the walkers meet`);}
assert(R['0'].worst<.02,`1. no ping: the page prediction = the server against a moving human (worst ${R['0'].worst.toFixed(3)} m in one tick; walking through it / solid where drawn ~100 ms in the past: 0.26-0.33 m)`);
assert(R['0b'].worst<.02,`1. no ping, the other unit stepped before the player (lower id): = the server (worst ${R['0b'].worst.toFixed(3)} m)`);
assert(R['80'].worst<.08&&R['80b'].worst<.08,`2. 80 ms ping: the newest snapshot carried to the server's step - = the server (worst ${R['80'].worst.toFixed(3)} / ${R['80b'].worst.toFixed(3)} m in one tick; walk-through / drawn: 0.26-0.33 m)`);
// 3. fallbacks
{const c=mk(),U={g:{position:{x:1,y:0,z:0}},alive:true,hp:100,nt:1,nb:[{t:1000,clock:true,x:3,y:0,z:0},{t:1050,clock:true,x:3.3,y:0,z:0}]};vm.runInContext('bots=globalThis.__b;',Object.assign(c,{__b:[U]}));
 const at=()=>{const b=c.xcAt(U);return [+b.x.toFixed(3),+b.z.toFixed(3)];};
 c.clock.t=1050;vm.runInContext('MP.snapClock={offset:0,delay:100};MP.ping=0;MP.on=true;',c);assert.deepEqual(at(),[1,0],'offline (no server socket): the drawn position');
 vm.runInContext('NET.socket={};',c);assert.deepEqual(at(),[3.3,0],'online: the newest snapshot');
 c.clock.t=1100;assert.deepEqual(at(),[3.3,0],'50 ms on with no ping: still the newest (10 ms margin for the snap clock\'s jitter)');
 c.clock.t=1110;assert.deepEqual(at(),[3.6,0],'carried forward by its velocity, a whole server step');
 c.clock.t=1600;assert.deepEqual(at(),[1,0],'stale buffer (> 400 ms past the newest snapshot): the drawn position');
 c.clock.t=1050;vm.runInContext('MP.me=5;',c);U.nid=3;assert.deepEqual(at(),[3.6,0],'a unit the server moves before the player (lower id): one step further');U.nid=7;assert.deepEqual(at(),[3.3,0],'after the player: the newest');
 c.clock.t=1159;assert.deepEqual(at(),[3.6,0],'whole 50 ms steps');
 c.clock.t=1110;vm.runInContext('MP.ping=900;',c);assert.deepEqual(at(),[3.3+.006*200,0],'the carry (ping counted up to 150 ms) is capped at 200 ms');vm.runInContext('MP.ping=0;',c);
 U.nb[0].x=-10;assert.deepEqual(at(),[3.3,0],'teleport-speed segment: not carried');U.nb[0].x=3;
 U.nb.length=0;assert.deepEqual(at(),[1,0],'no snapshots: the drawn position');
 assert.deepEqual([U.g.position.x,U.g.position.z],[1,0],'the drawn mesh is untouched');}
console.log(`test_online_body_predict: server units solid online (not P2P), prediction = server against a moving human (worst per tick: no ping ${R['0'].worst.toFixed(3)} / ${R['0b'].worst.toFixed(3)} m, 80 ms ping ${R['80'].worst.toFixed(3)} / ${R['80b'].worst.toFixed(3)} m), drawn unit untouched, fallbacks - pass`);
})().catch(e=>{console.error(e);process.exit(1);});
