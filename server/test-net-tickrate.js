// Faster rooms (net lane, 2 Nov 2026): GameRoom steps and sends at 40 Hz by default (env.TICK_HZ 10..60 overrides; 60 approved,
// 40 chosen on measured tick cost - worker.js GameRoom.TICK). Checked at 40 Hz and at 60 Hz:
//  1. snapshots: a room on a jittery timer sends ~hz frames/s, one 1/hz s step per frame (serverTime + 1000/hz ms)
//  2. bots: on a 1/40 or 1/60 s step the bot brain still decides every 50 ms of sim time (20 Hz) and sees tickDt .05; at a .05 s
//     step Simulation.think is bit-identical to the old direct bot()+ropeBot() call (same seeded room, 20 s, every unit)
//     a bot fires only on its decision steps (each shot on a fresh aim, as at 20 Hz); shots use the brain's view as at 20 Hz; the wire draws a brain turn across its 50 ms (Simulation.wireAim)
//  3. lag compensation: at 60 Hz the hit history still covers 0.5 s (REWIND.keep; 48 frames), a 0.35 s rewind (REWIND.max)
//     lands on the recorded pose, and a 60 Hz page's real 35 ms view is honoured (floor 30); 20 Hz pages (>= 100) unchanged
//  4. an old 20 Hz server (tickIntervalMs 50) still gets the 100 ms client delay; a 60 Hz one gets 35 ms (page mpCliSnap)
import fs from 'node:fs';import fsp from 'node:fs/promises';import vm from 'node:vm';import assert from 'node:assert/strict';
import {Simulation} from './src/simulation.js';import {loadWorld} from './src/world.js';import {ropeBot} from './src/ropes.js';
import {REWIND,shotTime,historicalPose} from './src/rewind.js';
const out=[];
// 1. GameRoom on a jittery timer (sliced out of worker.js as test-network.js does), at its default 40 Hz and at TICK_HZ=60
for(const HZ of [40,60]){let now=1_000_000;const FakeDate=class extends Date{static now(){return now;}};const source=fs.readFileSync('src/worker.js','utf8');
 const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date:FakeDate,URL,performance,setInterval:()=>1,clearInterval(){},Map,JSON,Number,Object,kits:JSON.parse(fs.readFileSync('src/kits.json','utf8'))};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;',context);
 const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const room=new context.GameRoom({waitUntil(){}},HZ===40?{}:{TICK_HZ:String(HZ)});room.advertise=()=>{};room.saveResults=async()=>{};room.sim=new Simulation(W);room.sim.start(false);room.last=now;
 assert.equal(room.hz,HZ,'rate '+HZ);
 const ws={frames:[],send(d){this.frames.push(JSON.parse(d));},close(){}},u=room.sim.add('A');u.loading=false;room.sessions.set(ws,{id:'a',u,window:now,count:0,last:now,ready:true});
 let r=17;const rnd=()=>((r=(r*16807)%2147483647)/2147483647);const t0=now;
 /* the timer fires on its cadence with +-3 ms of noise (whole ms, as Date.now) */for(let k=1;now-t0<5000;k++){now=Math.max(now,t0+Math.round(k*1000/HZ+(rnd()*2-1)*3));room.sessions.get(ws).last=now;room.tick();}
 const f=ws.frames.filter(m=>m.t==='s'),fps=f.length/((now-t0)/1000);let one=0;for(let i=1;i<f.length;i++)if(Math.abs(f[i].serverTime-f[i-1].serverTime-1000/HZ)<.01)one++;
 out.push(`${HZ} Hz: ${fps.toFixed(1)} frames/s, ${(100*one/(f.length-1)).toFixed(1)} % one step apart`);
 assert.ok(fps>HZ*.95&&fps<HZ*1.03,'about '+HZ+' snapshots/s: '+fps);assert.ok(f.every(x=>x.tickIntervalMs===+(1000/HZ).toFixed(3)),'rooms say their rate');assert.ok(one/(f.length-1)>.97,'frames carry one step each (not bunched 0/2): '+one+'/'+(f.length-1));
 assert.ok(f.every((x,i)=>!i||x.serverTime>f[i-1].serverTime),'serverTime strictly increases');}
// 2 + 3 on a real map, seeded
const assets={async fetch(q){try{return new Response(await fsp.readFile('public'+new URL(q.url).pathname));}catch(e){return new Response('',{status:404});}}};
const world=await loadWorld(assets,'ascent');
const seeded=s=>()=>((s=(s*16807)%2147483647)/2147483647);
function room(step,secs,old=false){const R=Math.random;Math.random=seeded(99);try{const sim=new Simulation(world,'tdm','ascent',seeded(42));if(old)sim.think=function(u){this.bot(u);ropeBot(this,u);return true;};
  const times={},calls=new Map(),dts=new Set(),per=new Map(),thought=new Set(),fired=new Set(),bot=sim.bot.bind(sim);sim.bot=u=>{calls.set(u.id,(calls.get(u.id)||0)+1);(times[u.id]||(times[u.id]=[])).push(sim.time);dts.add(sim.tickDt);const k=Math.round(sim.time/step);per.set(k,(per.get(k)||0)+1);thought.add(u.id+':'+k);return bot(u);};
  const ft=sim.fireTick.bind(sim);sim.fireTick=sh=>{const k=Math.round(sim.time/step);for(const u of sh)if(!u.human)fired.add([u.id,k]);return ft(sh);};
  const h=sim.add('Human');sim.start(true);const n=Math.round(secs/step);for(let i=0;i<n;i++){h.input={forward:1,side:i%120<60?1:-1};h.inputAt=sim.time;h.look+=.002;sim.step(step);}
  return {sim,h,calls,dts,per,thought,fired,times};}finally{Math.random=R;}}
{const A=room(.05,20),B=room(.05,20,true),pick=s=>JSON.stringify(s.units.map(u=>[u.id,u.x,u.y,u.z,u.vx,u.vz,u.look,u.pitch,u.hp,u.armor,u.alive,u.kills,u.deaths,u.ammo,u.weapon])),a=pick(A.sim);
 assert.equal(a,pick(B.sim),'at a .05 s step think() is bit-identical to the old bot()+ropeBot() call (20 s seeded room)');assert.equal(A.sim.time,B.sim.time);
 assert.ok(A.sim.units.some(u=>!u.human&&u.kills+u.deaths>0)||A.sim.units.some(u=>!u.human&&Math.hypot(u.x-A.sim.units[0].x,u.z-A.sim.units[0].z)>1),'bots acted');out.push('20 Hz bit-identical over 20 s');}
for(const HZ of [40,60]){const SECS=25,S=room(1/HZ,SECS),bots=S.sim.units.filter(u=>!u.human),rates=bots.map(u=>(S.calls.get(u.id)||0)/SECS);
 assert.ok(bots.length>=4,'bots present');let gaps=0,at50=0;for(const id in S.times){const T=S.times[id];for(let k=1;k<T.length;k++){const g=T[k]-T[k-1];gaps++;assert.ok(g>.05-1e-9,'decisions at most every 50 ms: '+g);if(Math.abs(g-.05)<1e-9)at50++;}}
 for(const v of rates)assert.ok(v>15&&v<=20.05,'bot brain decides at 20 Hz on a '+HZ+' Hz step (dead time aside): '+v.toFixed(2)+'/s');assert.ok(at50/gaps>.98,'decisions 50 ms apart while alive: '+at50+'/'+gaps);
 assert.ok(S.fired.size>0&&[...S.fired].every(([id,k])=>S.thought.has(id+':'+k)),'bots fire only on their decision steps ('+S.fired.size+' shots)');out.push(HZ+' Hz: '+S.fired.size+' bot trigger steps, all on decisions');
 const most=Math.max(...S.per.values());assert.ok(most<=Math.ceil(bots.length/(HZ/20)),'brains spread over the '+HZ/20+' steps of a 50 ms period: at most '+most+' of '+bots.length+' on one step');
 assert.deepEqual([...S.dts],[.05],'the brain sees tickDt .05 (its per-call timers keep their time)');
 out.push(HZ+' Hz: bots '+Math.min(...rates).toFixed(1)+'-'+Math.max(...rates).toFixed(1)+' decisions/s');
 if(HZ===60){const b=bots[0],sim=S.sim,L=b.look,P=b.pitch;b.human=false;b.look=.3;b.pitch=.1;b.wl={t:sim.time,a:0,b:.3,pa:0,pb:.1};const row=()=>sim.rows().find(r=>r[0]===b.id);
  assert.ok(Math.abs(row()[7]-Math.PI-.1)<1e-3&&Math.abs(row()[18]-.1/3)<1e-3,'a brain turn is drawn a third of the way on its step');b.wl.t-=1/60;assert.ok(Math.abs(row()[7]-Math.PI-.2)<1e-3,'two thirds on the next');
  b.wl.t-=1/60;assert.ok(Math.abs(row()[7]-Math.PI-.3)<1e-3,'whole on the third');b.wl.t=sim.time;b.look=.5;assert.ok(Math.abs(row()[7]-Math.PI-.5)<1e-3,'a view moved since (botView) is drawn as it is');b.look=L;b.pitch=P;b.wl=null;}
 // 3. lag compensation at 60 Hz
 const h=S.h,H=h.hitHistory,span=H.at(-1).t-H[0].t;assert.ok(H.length<=REWIND.frames&&REWIND.frames>=48,'48 frames kept');
 assert.ok(span>=REWIND.keep-1/HZ-1e-9,HZ+' Hz history covers 0.5 s: '+span.toFixed(3)+' s in '+H.length+' frames');
 const t=S.sim.time-REWIND.max,p=historicalPose(h,t),rec=H.reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a);assert.notEqual(p,h,'a 0.35 s rewind is inside the history');
 assert.ok(Math.abs(rec.t-t)<1e-6&&Math.hypot(p.x-rec.x,p.z-rec.z)<1e-6,'0.35 s rewind lands on the recorded pose');
 h.ping=0;h.viewMs=35;assert.ok(Math.abs(S.sim.time-shotTime(S.sim,h)-.035)<1e-9,'a 60 Hz page rewinds by its real 35 ms view');
 h.viewMs=10;assert.ok(Math.abs(S.sim.time-shotTime(S.sim,h)-REWIND.minView/1000)<1e-9,'view floor 30 ms');
 h.viewMs=100;h.ping=80;assert.ok(Math.abs(S.sim.time-shotTime(S.sim,h)-.14)<1e-9,'20 Hz page (100 ms view, 80 ms rtt) unchanged: 140 ms');
 h.viewMs=220;h.ping=1000;assert.ok(Math.abs(S.sim.time-shotTime(S.sim,h)-REWIND.max)<1e-9,'capped at REWIND.max');
 assert.ok(S.sim.command(h,{t:'in',seq:h.lastSeq+1,r:0,p:0,view:35})&&h.viewMs===35,'command keeps a 35 ms view');
 assert.ok(S.sim.command(h,{t:'in',seq:h.lastSeq+1,r:0,p:0,view:5})&&h.viewMs===REWIND.minView,'command floors the view at 30');
 out.push(`history ${span.toFixed(3)} s / ${H.length} frames`);}
// 4. the page's delay against old (20 Hz) and new (60 Hz) servers
{const html=fs.readFileSync('../index.html','utf8'),i=html.indexOf('function mpCliSnap('),j=html.indexOf('function mpCliSelf(',i);
 const page=()=>{const n={running:true,MP:{st:'game',me:1,DELAY:+html.match(/DELAY: (\d+)/)[1]},NET:{socket:{}},bots:[],allies:[],XAG:{},FV:{},performance:{now:()=>n.now},now:0,mpClean:s=>s,mpCliKD(){},showStats(){},Math};vm.createContext(n);vm.runInContext(html.slice(i,j),n);return n;};
 const run=TI=>{const n=page();for(let t=0;t<3000;t+=TI){n.now=t+40;n.mpCliSnap({u:[],serverTime:t+5e5,tickIntervalMs:+TI.toFixed(3)});}return n.MP.snapClock.delay;};
 assert.equal(run(50),100,'old 20 Hz server: 100 ms client delay');const d40=run(25);assert.ok(d40>=50&&d40<51,'40 Hz server: 50 ms ('+d40+')');const d60=run(1000/60);assert.ok(d60>=35&&d60<36,'60 Hz server: 35 ms client delay ('+d60+')');out.push(`client delay 20 Hz ${run(50)} ms, 40 Hz ${d40.toFixed(1)} ms, 60 Hz ${d60.toFixed(1)} ms`);}
console.log('Tick rate: '+out.join('; '));
