// Background tabs: browsers throttle a hidden tab's setInterval (about 1 Hz, then once a minute), so the client's 50 ms
// input loop goes quiet. The server must keep a hidden player who says so, accept Worker heartbeats, drop held input,
// and still drop a truly silent session. The client half is checked against work/server_runtime.js.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {Simulation} from './src/simulation.js';
let now=1_000_000;const FakeDate=class extends Date{static now(){return now;}};
const source=fs.readFileSync('src/worker.js','utf8'),code=source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;',context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date:FakeDate,URL,performance,setInterval,clearInterval,Map,JSON,Number,Object,kits:JSON.parse(fs.readFileSync('src/kits.json','utf8'))};vm.createContext(context);vm.runInContext(code,context);
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
let room;const fresh=()=>{room=new context.GameRoom({waitUntil(){}},{DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{}')})}});room.advertise=()=>{};room.broadcast=()=>{};room.saveResults=async()=>{};room.sim=new Simulation(W);room.sim.start();room.last=now;};fresh();
const sock=()=>({closed:null,close(c,r){this.closed=r;},send(){}});
const seat=(name)=>{const ws=sock(),u=room.sim.add(name);room.sim.spawn(u);room.sessions.set(ws,{id:name,u,window:now,count:0,last:now,ready:true});return ws;};
const msg=(ws,m)=>room.message(ws,JSON.stringify(m));
const advance=(ms)=>{const end=now+ms;while(now<end){now=Math.min(end,now+1000);room.tick();}};
assert.equal(context.GameRoom.IDLE.ready,45000);assert(context.GameRoom.IDLE.hidden>=120000,'hidden allowance must cover once-a-minute throttled timers');
// 1. A visible player who goes silent for 46 s is still dropped (dead connections must not linger).
const silent=seat('silent');advance(46000);assert.equal(silent.closed,'Connection idle');assert(!room.sessions.has(silent));
// 2. A hidden tab whose input loop only runs once a minute stays connected.
fresh();const hidden=seat('hidden');await msg(hidden,{t:'in',seq:1,r:0,p:0,f:1,s:0});assert.equal(room.sessions.get(hidden).u.input.forward,1);
await msg(hidden,{t:'vis',h:1});assert.equal(room.sessions.get(hidden).hidden,true);assert.deepEqual({...room.sessions.get(hidden).u.input},{},'hiding releases held movement/fire');
for(let i=0;i<4;i++){advance(60000);assert.equal(hidden.closed,null,'throttled hidden tab dropped after '+(i+1)+' min');await msg(hidden,{t:'in',seq:2+i,r:0,p:0,f:0,s:0});}
// 3. Worker heartbeats alone keep it alive and are not treated as input.
const before=room.sessions.get(hidden).u.lastSeq;for(let i=0;i<100;i++){advance(2000);await msg(hidden,{t:'hb'});}assert.equal(hidden.closed,null);assert.equal(room.sessions.get(hidden).u.lastSeq,before);
// 4. Coming back restores the normal limit, and a hidden client that goes fully silent is eventually dropped.
await msg(hidden,{t:'vis',h:0});assert.equal(room.sessions.get(hidden).hidden,false);advance(46000);assert.equal(hidden.closed,'Connection idle');
fresh();const gone=seat('gone');await msg(gone,{t:'vis',h:1});advance(context.GameRoom.IDLE.hidden-5000);assert.equal(gone.closed,null);advance(10000);assert.equal(gone.closed,'Connection idle');
// 4b. Slow match loads: a client still loading after IDLE.loading (180 s) was dropped as 'Connection idle' even while it
//     was making progress. It now stays while it reports progress (lp every 5 s) that keeps moving, up to LOAD.max; a
//     load that stalls, stops reporting or hits the cap is closed with the reason 'Load timed out' (the page says why).
{const L=context.GameRoom.IDLE.loading,M=context.GameRoom.LOAD;const loader=name=>{const ws=sock(),u=room.sim.add(name);u.loading=true;room.sessions.set(ws,{id:name,u,window:now,count:0,last:now,ready:false,loadStarted:now});return ws;};
 const report=async(ws,ms,p)=>{const end=now+ms;while(now<end){advance(5000);if(ws.closed)return;await msg(ws,{t:'lp',p:typeof p==='function'?p():p,m:-1});}};
 // progressing: kept well past 180 s
 fresh();let f=0;const slow=loader('slow');await report(slow,L+60000,()=>(f=Math.min(1,f+.004)));assert.equal(slow.closed,null,'progressing load kept past IDLE.loading');assert(room.sessions.has(slow));
 // then progress stops moving: dropped within LOAD.stall of the last change, with a clear reason
 await report(slow,M.stall+10000,f);assert.equal(slow.closed,'Load timed out');assert(!room.sessions.has(slow));
 // never reports: same 180 s limit as before, now with the load reason
 fresh();const quiet=loader('quiet');for(let i=0;i<Math.floor(L/10000)-1;i++){advance(10000);await msg(quiet,{t:'pi',c:1});}assert.equal(quiet.closed,null);advance(20000);assert.equal(quiet.closed,'Load timed out');
 // reports stop (tab frozen / crashed loader): dropped once the last report is LOAD.ping old
 fresh();let g=0;const frozen=loader('frozen');await report(frozen,L+10000,()=>(g+=.01));assert.equal(frozen.closed,null);advance(M.ping+1000);assert.equal(frozen.closed,'Load timed out');
 // hard cap even while progressing
 fresh();let h=0;const forever=loader('forever');await report(forever,M.max+10000,()=>(h=(h+.001)%1));assert.equal(forever.closed,'Load timed out');
 // malformed / out-of-place lp never throws or touches play state; a ready player's lp is ignored
 fresh();const bad=loader('bad');for(const v of [null,'x',1e309,-1e9,{},[1],NaN,true])await msg(bad,{t:'lp',p:v,m:v});assert.equal(bad.closed,null);
 const ok=seat('ok');await msg(ok,{t:'lp',p:.5});assert.equal(room.sessions.get(ok).loadPing,undefined);}
// 5. Client: visibilitychange hook, released keys, idle input + vis message, Worker-timer heartbeat in foreground and background.
const net=fs.readFileSync('../work/server_runtime.js','utf8'),a=net.indexOf('// Background-tab liveness.'),b=net.indexOf('// Online 5v5 Omen From the Shadows',a);assert(a>0&&b>a);
let listener=null,workers=[];const sent=[];const keys={KeyW:true,Space:true};
const c={document:{hidden:false,addEventListener:(t,f)=>{if(t==='visibilitychange')listener=f;}},MP:{on:true},NET:{socket:{readyState:1},ready:true,firePulse:9e9},keys,fireHeld:true,netWeapon:'Vandal',netSend:m=>sent.push(m),netInputMsg:(kk,w)=>({t:'in',f:kk.KeyW?1:0,j:kk.Space?1:0,w}),URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},Blob:class{constructor(parts){this.src=parts.join('');}},Worker:class{constructor(u){this.u=u;workers.push(this);}}};
vm.createContext(c);vm.runInContext(net.slice(a,b)+';globalThis.vis=netVisibility;',c);assert.equal(typeof listener,'function');
c.document.hidden=true;listener();assert.equal(keys.KeyW,false);assert.equal(keys.Space,false);assert.equal(vm.runInContext('fireHeld',c),false);assert.equal(c.NET.firePulse,0);assert.deepEqual(sent.map(m=>m.t),['in','vis']);assert.equal(sent[0].f,0);assert.equal(sent[1].h,1);assert.equal(c.NET.hid,1);
assert.equal(workers.length,1);workers[0].onmessage();assert.equal(sent.at(-1).t,'hb');c.document.hidden=false;listener();assert.equal(sent.at(-1).t,'vis');assert.equal(sent.at(-1).h,0);const n=sent.length;workers[0].onmessage();assert.equal(sent.length,n+1,'foreground heartbeat must cover a stalled input/render loop');assert.equal(sent.at(-1).t,'hb');
c.document.hidden=true;listener();assert.equal(workers.length,1,'one heartbeat worker per page');
console.log('Background tab: hidden clients signal vis, keep their seat through once-a-minute throttling and Worker heartbeats, held input released; silent sessions still dropped at 45 s visible / 150 s hidden; slow loads kept while progressing, closed as \'Load timed out\' when stalled/silent/capped');
