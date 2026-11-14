// Late timers (net lane, 13 Nov 2026): the room must stay on real time when its tick timer fires late.
// On Cloudflare the clock a Durable Object reads is not the wall clock (workerd io-context.c++): inside a timer callback
// Date.now() is that timer's deadline, and anywhere else it is the time the current event arrived, clamped to the earliest
// pending timer deadline. An interval is re-armed from the deadline it observed. So under a plain setInterval a tick that
// fired late always saw dt = one tick, and the room ran behind real time without knowing (deployed worker, TDM + bots:
// snapshots 100-600 ms behind for seconds while a ping over the same socket took 30 ms).
// This test runs the real GameRoom (sliced out of worker.js, as test-net-tickrate.js) on a model of that clock:
//   - real time advances event by event; the isolate freezes now and then (a heavy step, a descheduled isolate), and the
//     events that came due meanwhile run afterwards, in order, an overdue timer no sooner than GAP ms after the last one
//   - (strict variant: a timer callback keeps reading its own deadline even after it cleared itself - the less favourable
//     reading of the runtime; the default lets the clamp lift once the timer is gone)
//   - one page sends an input 60 times a second (each is an event; GameRoom.pump runs after it, as the socket listener does)
// and measures, at every snapshot sent, how far its serverTime is behind the real time it was sent at.
//   legacy pacing (setInterval -> tick, no pump): the lag piles up        (the harness reproduces the deployed behaviour)
//   GameRoom pacing (arm / beat / pump):          the lag stays within about a tick; sim time == real time
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {Simulation} from './src/simulation.js';
const source=fs.readFileSync('src/worker.js','utf8'),code=source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:0;};
async function run({legacy,hz=40,secs=40,freeze=true,gap=22,seed=7,strict=false,wobble=0,ct=false}){
 let r=seed;const rnd=()=>((r=(r*16807)%2147483647)/2147483647);
 // the modelled clock: ev = real time the current event started, obs = last time shown to the script (never goes back)
 let ev=1_000_000,obs=ev,nextId=1,pin=Infinity;const timers=new Map();
 const clamp=()=>{let c=Infinity;for(const t of timers.values())if(t.when<c)c=t.when;return c;};
 const base=()=>{obs=Math.max(obs,Math.min(ev,clamp(),pin));return obs;};
 // wobble: the object's clock wanders against real time (deployed: ~250 ms within seconds); timers keep the model's own domain
 const now=()=>{const b=base();return Math.floor(b+wobble*Math.sin(2*Math.PI*(b-1_000_000)/4000));};
 const FakeDate=class extends Date{static now(){return now();}};
 const setI=(f,ms)=>{const id=nextId++;timers.set(id,{f,ms:Math.floor(ms),when:base()+Math.floor(ms)});return id;},clearI=id=>{timers.delete(id);};
 const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date:FakeDate,URL,performance,setInterval:setI,clearInterval:clearI,Map,JSON,Number,Object,kits:JSON.parse(fs.readFileSync('src/kits.json','utf8'))};
 vm.createContext(context);vm.runInContext(code,context);
 const room=new context.GameRoom({waitUntil(){}},hz===40?{}:{TICK_HZ:String(hz)});room.advertise=()=>{};room.saveResults=async()=>{};room.sim=new Simulation(W);room.sim.start(false);
 if(legacy){room.startTimer=function(){if(!this.timer){this.last=Date.now();this.timer=setI(()=>this.tick(),this.tickMs);}};room.pump=()=>{};}
 const lag=[],frames=[];const ws={send(d){const m=JSON.parse(d);if(m.t==='s'){lag.push(ev-m.serverTime);frames.push([ev,m.serverTime]);}},close(){}},u=room.sim.add('A');u.loading=false;
 const s={id:'a',u,window:now(),count:0,last:now(),ready:true};room.sessions.set(ws,s);room.startTimer();
 const t0=ev,end=t0+secs*1000,sim0=room.sim.time;let busy=t0,lastFire=-1e9,nextMsg=t0+5,nextFreeze=freeze?t0+1500:Infinity,seq=0;
 while(true){
  // next event: the earliest of the next input (arrival) and the earliest timer (deadline); neither runs while the isolate is frozen
  let tid=null,tw=Infinity;for(const [id,t] of timers)if(t.when<tw){tw=t.when;tid=id;}
  const tFire=tw<Math.max(ev,busy)?Math.max(tw,lastFire+gap):tw,at=Math.min(nextMsg,tFire);if(at>end)break;
  if(at>=nextFreeze){busy=nextFreeze+40+rnd()*260;nextFreeze=busy+300+rnd()*1200;} // a 40-300 ms freeze every 0.3-1.5 s
  ev=Math.max(ev,at,busy);
  if(tFire<=nextMsg){const t=timers.get(tid);lastFire=ev;obs=Math.max(obs,Math.min(ev,t.when));/* a timer callback sees its own deadline */
   if(strict)pin=t.when;/* strict: a timer callback never sees past its own deadline, even after clearing itself */t.f();pin=Infinity;if(timers.get(tid)===t)t.when=obs+t.ms;/* (re-armed interval) *//* an interval still alive is re-armed from the time its callback observed */}
  else{nextMsg+=1000/60+(rnd()*2-1)*2;s.last=now();await room.message(ws,JSON.stringify({t:'in',seq:++seq,r:0,p:0,f:1,s:0,...(ct?{ct:Math.round(ev-777_000)}:{})}));/* ct: the page's clock (true rate, its own origin) */room.pump();}
 }
 const simMs=(room.sim.time-sim0)*1000,realMs=ev-t0;
 const sp=[...lag].sort((a,b)=>a-b),spread=sp[Math.floor(sp.length*.95)]-sp[Math.floor(sp.length*.05)];
 return {spread,lag,frames,simMs,realMs,fps:frames.length/(realMs/1000),pumped:room.metrics.pumped||0,p50:q(lag,.5),p95:q(lag,.95),max:q(lag,1)};
}
const out=[];
for(const hz of [40,60]){
for(const strict of [false,true]){
 const old=await run({legacy:true,hz,strict}),cur=await run({legacy:false,hz,strict}),calm=await run({legacy:false,hz,freeze:false,strict});
 out.push(`${hz} Hz${strict?' strict':''} legacy: lag p50 ${old.p50.toFixed(0)} p95 ${old.p95.toFixed(0)} max ${old.max.toFixed(0)} ms | now: p50 ${cur.p50.toFixed(0)} p95 ${cur.p95.toFixed(0)} ms, ${cur.fps.toFixed(1)} frames/s, ${cur.pumped} ticks from messages | calm: p95 ${calm.p95.toFixed(0)} ms, ${calm.fps.toFixed(1)} frames/s`);
 // the harness reproduces the deployed symptom with the old pacing: snapshots far behind real time most of the time
 assert.ok(old.p50>60&&old.max>200,'legacy pacing falls behind on this clock: p50 '+old.p50+' max '+old.max);
 // the room now: within about one tick of real time except right at a freeze (the frame sent as it ends), never piling up
 assert.ok(cur.p50<=1000/hz+2,'snapshots on real time: lag p50 '+cur.p50);
 assert.ok(cur.p95<=2*1000/hz+12,'no lag piling up: p95 '+cur.p95);
 assert.ok(cur.pumped>0,'overdue ticks were taken over by incoming messages');
 // sim time follows real time: only the part of a freeze past the 0.2 s catch-up cap is dropped (never replayed late)
 assert.ok(cur.simMs<=cur.realMs+1000/hz&&cur.simMs>cur.realMs*.93,'sim time tracks real time: '+cur.simMs.toFixed(0)+' of '+cur.realMs.toFixed(0)+' ms');
 assert.ok(cur.frames.every((f,i)=>!i||f[1]>cur.frames[i-1][1]),'serverTime strictly increases');
 // a calm room is unchanged: the timer keeps its cadence, a frame per tick, one step each
 assert.ok(calm.fps>hz*.95&&calm.fps<hz*1.03,'calm room: about '+hz+' snapshots/s: '+calm.fps);
 assert.ok(calm.p95<=1000/hz+2,'calm room on time: '+calm.p95);
 let one=0;for(let i=1;i<calm.frames.length;i++)if(Math.abs(calm.frames[i][1]-calm.frames[i-1][1]-1000/hz)<.01)one++;
 /* ticks ride 60 Hz inputs (worker.js arm / pump), so a few frames carry two 1/hz steps (60 inputs into 40 steps); stamps stay exact */
 assert.ok(one/(calm.frames.length-1)>.9,'calm room: one step per frame: '+one+'/'+(calm.frames.length-1));
 assert.ok(Math.abs(calm.simMs-calm.realMs)<=1000/hz+1,'calm room: sim time == real time');
}}
// 2) the object's clock wanders +-150 ms over 4 s (as measured on the deployed worker): stepping by it runs the room up to ~24 % fast
//    or slow and stamps wander with it; timed by the pages' input timestamps (ct) the stamps follow real time
for(const hz of [40,60]){
 const off=await run({legacy:false,hz,freeze:false,wobble:150}),on=await run({legacy:false,hz,freeze:false,wobble:150,ct:true}),fz=await run({legacy:false,hz,wobble:150,ct:true});
 out.push(`${hz} Hz wandering clock: stamp spread ${off.spread.toFixed(0)} ms by the object's clock, ${on.spread.toFixed(0)} ms by page time (${fz.spread.toFixed(0)} ms with freezes), ${on.fps.toFixed(1)} frames/s`);
 assert.ok(off.spread>150,'the model reproduces the wander: '+off.spread);
 assert.ok(on.spread<=1000/hz+12,'page-timed stamps follow real time: spread '+on.spread);
 assert.ok(Math.abs(on.simMs-on.realMs)<=1000/hz+2,'page-timed sim time == real time: '+on.simMs.toFixed(0)+' / '+on.realMs.toFixed(0));
 assert.ok(on.fps>hz*.95&&on.fps<hz*1.05,'page-timed room keeps its rate: '+on.fps);
 assert.ok(fz.spread<=2*1000/hz+40,'with freezes too: spread '+fz.spread);
 assert.ok(on.frames.every((f,i)=>!i||f[1]>on.frames[i-1][1]),'serverTime strictly increases');
}
console.log('late timers ok: '+out.join('; '));
