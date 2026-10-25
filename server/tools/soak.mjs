// Gameplay soak / fuzz harness. Runs the real worker module in-process (tools/local-cluster.mjs: default fetch ->
// GameRoom -> Directory on a virtual clock) with bots plus fuzzing "human" clients that speak the browser protocol and
// do random things: move, jump, crouch, walk, ADS, shoot, reload, equip, buy/sell, abilities and ultimates, Blade Storm,
// pick up / drop guns, drop the spike, plant and defuse, hidden-tab signals, malformed messages, and disconnect /
// rejoin (also mid-load and silent drops). After every server tick it asserts invariants on the authoritative state.
//
//   node --expose-gc tools/soak.mjs [maps=all] [modes=dm,tdm,five] [seconds=180] [humans=3] [seed=1] [scenario=base|abilities|ults]
// Spike runs also check economy / carry-over / detain / Run It Back / kill-event invariants (tools/soak-checks.mjs);
// the abilities and ults scenarios make every bot and fuzzer spend utility or ultimates constantly, aimed at enemies.
//   e.g. node --expose-gc tools/soak.mjs ascent,bind five 600 4 7
//
// Exported soakRun() is used by test-soak.js (short run in npm test).
import {localCluster} from './local-cluster.mjs';
import {loadWorld} from '../src/world.js';
import {path} from '../src/path.js';
import {weapons} from '../src/simulation.js';
import {FLOOR_LIMIT} from '../src/floor.js';
import kits from '../src/kits.json' with {type:'json'};
import {instrument,checkFive,deathCheck,driveBots,fuzzCast,FOCUS} from './soak-checks.mjs';

export const MAPS=['ascent','bind','haven','split','lotus','breeze'],MODES=['dm','tdm','five'];
const BUYABLE=['Classic','Shorty','Frenzy','Ghost','Sheriff','Stinger','Spectre','Bucky','Judge','Bulldog','Guardian','Phantom','Vandal','Marshal','Outlaw','Operator','Ares','Odin','Light Shields','Heavy Shields'];
const AGENTS=Object.keys(kits);
export function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const worlds=new Map();
async function worldFor(cluster,map){if(!worlds.has(map))worlds.set(map,await loadWorld(cluster.env.ASSETS,map));return worlds.get(map);}

class Fuzzer{
 constructor(i,rng,world,mode){this.i=i;this.rng=rng;this.world=world;this.mode=mode;this.name='Fuzz'+i;this.agent=AGENTS[Math.floor(rng()*AGENTS.length)];this.token=null;this.reset();}
 reset(){this.id=null;this.seq=0;this.ready=false;this.rows=null;this.rs=null;this.fw=[];this.state={f:0,s:0,j:0,c:0,w:0,fire:0,ads:0,h4:0,r:0,p:0};this.until=0;this.goal=null;this.route=null;this.routeAt=-1e9;this.socket=null;this.connected=false;this.silentUntil=0;this.loadDelay=0;this.pendingReady=0;this.started=false;}
 me(){return this.rows?.find(r=>r[0]===this.id)||null;}
}

export async function soakRun({map='ascent',mode='dm',seconds=120,humans=3,seed=1,log=()=>{},stuckSeconds=8,shorten=null,maxViolations=200,scenario='base'}={}){
 const realRandom=Math.random,rng=mulberry(seed*7919+MAPS.indexOf(map)*31+MODES.indexOf(mode));Math.random=mulberry(seed*104729+MAPS.indexOf(map)*131+MODES.indexOf(mode)*17);
 const violations=[],seen=new Map(),errors=[],stats={ticks:0,kills:0,rounds:0,plants:0,defuses:0,detonations:0,rejoins:0,disconnects:0,silentDrops:0,commands:{},ults:0,picks:0,drops:0,maxFloor:0,maxEffects:0,maxRoute:0,phaseEnd:null,stuck:[]};
 const flag=(kind,detail,key=kind)=>{const n=(seen.get(key)||0)+1;seen.set(key,n);if(n===1&&violations.length<maxViolations)violations.push({kind,detail,key,t:+(cluster.clock.now()-t0)/1000});};
 const onRej=e=>errors.push('unhandledRejection: '+(e?.stack||e));process.on('unhandledRejection',onRej);
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}}),t0=cluster.clock.now();
 try{
 const W=await worldFor(cluster,map),code='SKRM'+'ABCDEFGHJK'[seed%10]+'ABCDEFGHJKLMNPQRSTUVWXYZ'[(MAPS.indexOf(map)*3+MODES.indexOf(mode))%24];
 // Bounds from the playable nav graph (every legal standing spot), with margin for jumps, knock-ups and Updraft.
 const P=W.playable.map(i=>W.nav.nodes[i]),bx=[Math.min(...P.map(p=>p[0]))-12,Math.max(...P.map(p=>p[0]))+12],bz=[Math.min(...P.map(p=>p[2]))-12,Math.max(...P.map(p=>p[2]))+12],by=[Math.min(...P.map(p=>p[1]))-3,Math.max(...P.map(p=>p[1]))+15];
 const fz=[];for(let i=0;i<humans;i++)fz.push(new Fuzzer(i,rng,W,mode));
 // Ability/ult scenarios seat the agents whose kits they exercise (Showstopper, Lockdown, Run It Back, Tour de Force,
 // Headhunter, Killjoy/Cypher/Phoenix devices, Boom Bot ...).
 if(scenario!=='base')fz.forEach((h,i)=>{h.agent=FOCUS[(i+seed)%FOCUS.length];});
 for(const h of fz){const p=await cluster.profile();h.token=p.token;}
 const send=(h,m)=>{if(h.connected&&h.socket)h.socket.send(typeof m==='string'?m:JSON.stringify(m));};
 const connect=(h,q)=>{h.reset();const s=cluster.connect(q);h.socket=s;
  s.on('open',()=>{h.connected=true;send(h,{t:'hi',n:h.name,ag:h.agent,token:h.token});});
  s.on('error',e=>{h.connected=false;h.socket=null;h.refused=String(e.message||e);});
  s.on('close',()=>{h.connected=false;h.socket=null;});
  s.on('message',m=>receive(h,m));};
 const receive=(h,m)=>{if(m.t==='welcome'){h.id=m.you;h.name=m.name;}else if(m.t==='room')h.room=m;else if(m.t==='start'){h.started=true;h.rows=m.u;h.pendingReady=now()+h.loadDelay;}else if(m.t==='end')h.ended=m;else if(m.t==='rs')h.rs=m;else if(m.t==='s'&&h.ready){h.rows=m.u;if(m.fw)h.fw=m.fw;}};
 const now=()=>cluster.clock.now()-t0;
 connect(fz[0],{create:1,code,mode,map});
 // World loading is real file I/O: under machine load it can outlast 5 virtual seconds, so wait in real time too.
 {const until=Date.now()+90000;for(let k=0;!fz[0].room&&(k<100||Date.now()<until)&&!fz[0].refused;k++){await cluster.advance(50);if(k>=20)await new Promise(r=>setTimeout(r,k<100?5:50));}}
 if(!fz[0].room)throw Error('room was not created: '+fz[0].refused);
 for(const h of fz.slice(1))connect(h,{code});
 for(let k=0;k<100&&fz[0].room.pl.length<humans;k++)await cluster.advance(50);
 send(fz[0],{t:'start'});
 const room=cluster.room(code);
 // Hook every server tick: run the invariant checks right after the room's own tick.
 const tick=room.tick.bind(room);let lastRound=0,roundSince=0,lastRemaining=null,remainingSince=0,killEvents=0;const pos=new Map(),trail=new Map();
 room.tick=()=>{const sim=room.sim;const before=sim.events.length;let threw=null;if(sim.mode==='five')instrument(sim,flag,stats);
  // count kill events before snapshot() drains them
  const tickEv=[];const origSnap=sim.snapshot;sim.snapshot=function(){const s=origSnap.call(this);for(const e of s.ev||[]){tickEv.push(e);if(e[0]==='k'){killEvents++;stats.kills++;}if(e[0]==='sp')stats.plants++;}return s;};
  try{tick();}catch(e){threw=e;errors.push('tick threw: '+(e.stack||e).split('\n').slice(0,4).join(' | '));}finally{sim.snapshot=origSnap;}
  stats.ticks++;check(sim,threw);if(sim.mode==='five'){checkFive(sim,flag,stats);deathCheck(sim,flag,stats,tickEv);}};
 const valid=w=>typeof w==='string'&&Object.hasOwn(weapons,w);
 function check(sim){const t=now(),phases=['room','game','post','closed'];if(!phases.includes(sim.phase))flag('phase',sim.phase);
  if(sim.units.length>10)flag('units>10',sim.units.length);if(room.sessions.size>10)flag('sessions>10',room.sessions.size);
  const names=new Set();for(const u of sim.units){if(names.has(u.name))flag('duplicate name',u.name,'dup:'+u.name);names.add(u.name);}
  for(const u of sim.units){const tag=`${u.name}(${u.agent}${u.human?',human':''})`;
   for(const f of ['x','y','z','vx','vy','vz','look','pitch'])if(u[f]!==undefined&&!Number.isFinite(u[f]))flag('non-finite '+f,tag+' '+f+'='+u[f],'nf:'+f);
   if(u.alive&&!u.loading){if(u.x<bx[0]||u.x>bx[1]||u.z<bz[0]||u.z>bz[1])flag('out of bounds xz',`${tag} at ${u.x.toFixed(2)},${u.y.toFixed(2)},${u.z.toFixed(2)}`,'oob:'+Math.round(u.x/5)+','+Math.round(u.z/5));
    if(u.y<by[0])flag('below map floor',`${tag} y=${u.y.toFixed(2)} (min nav ${(by[0]+3).toFixed(2)}) at ${u.x.toFixed(1)},${u.z.toFixed(1)} trail ${JSON.stringify((trail.get(u.id)||[]).slice(-14))}`,'below:'+Math.round(u.x/5)+','+Math.round(u.z/5));
    if(u.y>by[1])flag('above map',`${tag} y=${u.y.toFixed(2)}`,'above');}
   const hpMax=u.agent==='Reyna'?150:100;
   if(!Number.isFinite(u.hp)||u.hp>hpMax+1e-9)flag('hp range',`${tag} hp=${u.hp}`,'hp:'+u.agent);
   if(u.alive&&!(u.hp>0))flag('alive with hp<=0',`${tag} hp=${u.hp}`,'alivehp');
   if(!u.alive&&u.hp>0&&sim.mode!=='five')flag('dead with hp>0',`${tag} hp=${u.hp}`,'deadhp');
   if(!Number.isFinite(u.armor)||u.armor<0||u.armor>50)flag('armor range',`${tag} armor=${u.armor}`,'armor');
   if(!valid(u.weapon))flag('invalid weapon',`${tag} weapon=${u.weapon}`,'weapon');
   else{const mag=weapons[u.weapon].magazineSize;if(!Number.isInteger(u.ammo)||u.ammo<0||u.ammo>Math.max(mag,1))flag('ammo range',`${tag} ${u.weapon} ammo=${u.ammo}/${mag}`,'ammo:'+u.weapon);if(!Number.isFinite(u.reserve)||u.reserve<0)flag('reserve range',`${tag} ${u.weapon} reserve=${u.reserve}`,'reserve');}
   if(sim.mode==='five'){if(!Number.isInteger(u.credits)||u.credits<0||u.credits>9000)flag('credits range',`${tag} credits=${u.credits}`,'credits');
    for(const k of ['primary','secondary'])if(u[k]!=null&&!valid(u[k]))flag('invalid '+k,`${tag} ${k}=${u[k]}`,'slot:'+k);
    if(u.primary&&weapons[u.primary]&&['Classic','Shorty','Frenzy','Ghost','Sheriff'].includes(u.primary))flag('sidearm in primary slot',`${tag} ${u.primary}`,'sideprim');
    const A=u.ability;if(A){const K=kits[u.agent];for(const k of ['c','q','e']){if(!Number.isFinite(A[k])||A[k]<0||(K?.mx?.[k]!=null&&A[k]>K.mx[k]))flag('ability charges',`${tag} ${k}=${A[k]} max ${K?.mx?.[k]}`,'ab:'+u.agent+k);}if(!Number.isFinite(A.ult)||A.ult<0)flag('ult points',`${tag} ult=${A.ult}`,'ult');}}
   if(sim.phase==='game'&&sim.mode!=='five'&&!u.alive&&!u.loading&&sim.time-u.respawnAt>1)flag('dead past respawn',`${tag} dead ${(sim.time-u.respawnAt).toFixed(1)} s past respawnAt`,'norespawn');
  }
  for(const u of sim.units){let a=trail.get(u.id);if(!a)trail.set(u.id,a=[]);a.push([+u.x.toFixed(2),+u.y.toFixed(2),+u.z.toFixed(2),+(u.vy||0).toFixed(1),u.air?1:0,u.alive?1:0,+(u.ch||0).toFixed(2)]);if(a.length>40)a.shift();}
  // Scores consistent with kills.
  if(sim.mode!=='five'||sim.phase==='game'){const total=sim.scores.reduce((a,b)=>a+(b||0),0);if(sim.mode!=='five'&&total!==killEvents)flag('score/kill mismatch',`scores ${total} vs kill events ${killEvents}`,'score');}
  if(sim.mode==='tdm'){const team=[0,1].map(t=>sim.units.filter(u=>u.team===t).reduce((a,u)=>a+u.kills,0));for(const t of [0,1])if(team[t]>(sim.scores[t]||0))flag('team kills exceed score',`team ${t} kills ${team[t]} > score ${sim.scores[t]}`,'teamscore'+t);
   const counts=[0,1].map(t=>sim.units.filter(u=>u.team===t).length);if(sim.phase==='game'&&sim.units.length===10&&Math.abs(counts[0]-counts[1])>0)flag('unbalanced teams',`teams ${counts}`,'unbalanced');}
  if(sim.mode==='five'&&sim.phase==='game'){const played=sim.roundScores[0]+sim.roundScores[1];if(played!==sim.round-(sim.roundDelay>0?0:1))flag('round score mismatch',`round ${sim.round} scores ${sim.roundScores} delay ${sim.roundDelay}`,'rscore');
   const sp=sim.spike;if(!['carry','drop','plant','',undefined].includes(sp.st))flag('spike state',sp.st);if(!Number.isFinite(sp.x)||!Number.isFinite(sp.z))flag('spike pos',JSON.stringify(sp),'sppos');
   if(sp.st==='carry'&&sim.roundDelay<=0&&sim.buy<=0){const c=sim.units.find(u=>u.id===sp.carrier);if(!c)flag('spike carrier missing',`carrier ${sp.carrier}`,'spcarrier');else if(c.team!==sim.atk)flag('spike carrier on defence',c.name,'spteam');}
   if(sp.dt>7.06||sp.t>45||sp.pt>4.06)flag('spike timers',JSON.stringify({t:sp.t,dt:sp.dt,pt:sp.pt}),'sptimer');
   const counts=[0,1].map(t=>sim.units.filter(u=>u.team===t).length);if(sim.units.length===10&&counts[0]!==counts[1])flag('unbalanced teams (five)',`teams ${counts}`,'unbalanced5');
   if(sim.buy<0||sim.buy>20)flag('buy timer',sim.buy);}
  // Round / match progress.
  if(sim.phase==='game'){if(sim.mode==='five'){if(sim.round!==lastRound){if(lastRound)stats.rounds++;lastRound=sim.round;roundSince=t;}else if(t-roundSince>260000)flag('round stuck',`round ${sim.round} for ${((t-roundSince)/1000).toFixed(0)} s (buy ${sim.buy.toFixed(1)}, remaining ${sim.remaining.toFixed(1)}, delay ${sim.roundDelay}, spike ${sim.spike.st}, loading ${sim.units.filter(u=>u.loading).map(u=>u.name)})`,'roundstuck:'+sim.round);}
   else{if(lastRemaining===null||sim.remaining<lastRemaining-1e-9){lastRemaining=sim.remaining;remainingSince=t;}else if(t-remainingSince>20000&&[...room.sessions.values()].some(s=>s.ready&&s.u))flag('clock stuck',`remaining ${sim.remaining}`,'clock');
    if(sim.remaining<-1)flag('match past time',`remaining ${sim.remaining}`,'overtime');}}
  // Bounded collections.
  const fl=(sim.floor||[]).length;stats.maxFloor=Math.max(stats.maxFloor,fl);if(fl>FLOOR_LIMIT)flag('floor guns over limit',fl);
  for(const d of sim.floor||[]){if(!valid(d.w)||!Number.isFinite(d.x)||!Number.isFinite(d.y)||!Number.isFinite(d.z))flag('bad floor gun',JSON.stringify(d),'floorbad');if(d.y<by[0])flag('floor gun below map',`${d.w} y=${d.y.toFixed(2)} at ${d.x.toFixed(1)},${d.z.toFixed(1)}`,'floorlow:'+Math.round(d.x/5)+','+Math.round(d.z/5));}
  const fx=(sim.effects||[]).length;stats.maxEffects=Math.max(stats.maxEffects,fx);if(fx>200)flag('effects unbounded',fx);
  if(sim.events.length>500)flag('events unbounded',sim.events.length);if((sim.castEvents||[]).length>200)flag('castEvents unbounded',sim.castEvents.length);if((sim.roundEvents||[]).length>50)flag('roundEvents unbounded',sim.roundEvents.length);
  if((room.finishedParticipants||[]).length>200)flag('finishedParticipants unbounded',room.finishedParticipants.length);
  // Bots stuck: alive, trying to move (forward input) and not in a fight, yet barely moved for stuckSeconds.
  const live=sim.phase==='game'&&!(sim.mode==='five'&&(sim.buy>0||sim.roundDelay>0||sim.units.some(u=>u.human&&u.loading)));
  for(const u of sim.units){if(u.human||!u.alive||!live){pos.delete(u.id);continue;}let p=pos.get(u.id);if(!p||p.seq!==u.seq){p={seq:u.seq,x:u.x,z:u.z,y:u.y,at:t,want:0,n:0,flagged:false};pos.set(u.id,p);}
   p.n++;if(u.input?.forward&&!u.sawTarget)p.want++;
   if(Math.hypot(u.x-p.x,u.z-p.z)>1){p.x=u.x;p.z=u.z;p.y=u.y;p.at=t;p.want=0;p.n=0;p.flagged=false;}
   else if(!p.flagged&&!u.sawTarget&&t-p.at>stuckSeconds*1000&&p.want>p.n*.8){p.flagged=true;const near=W.near(u.x,u.z,u.y),key=`${map}:${Math.round(u.x)},${Math.round(u.z)}`;stats.stuck.push({bot:u.name,at:[+u.x.toFixed(2),+u.y.toFixed(2),+u.z.toFixed(2)],node:near,seconds:+((t-p.at)/1000).toFixed(1),route:u.route?.length??null});const head=u.route?.[0]!=null?W.nav.nodes[u.route[0]]:null;flag('bot stuck',`${u.name} at ${u.x.toFixed(2)},${u.y.toFixed(2)},${u.z.toFixed(2)} for ${((t-p.at)/1000).toFixed(0)} s (route ${u.route?.length}, head ${head?head.map(v=>v.toFixed(1)).join(','):'-'} d ${head?Math.hypot(head[0]-u.x,head[2]-u.z).toFixed(2):'-'}, input ${JSON.stringify(u.input)}, stuck ${u.stuck?.toFixed?.(2)}, air ${u.air}, via ${u.via}, goalOff ${u.goalOff}, look ${u.look?.toFixed(2)}, wedged ${u.wedged?.toFixed?.(2)} unwedged ${u.unwedged} blocked ${W.blocked(u.x,u.z,.4,u.y,1.8-(u.ch||0))} ch ${u.ch} rescued ${u.rescued} escapes ${u.escapes} unstuck ${u.unstuck} stuckVal ${u.stuck} goalStuck ${u.goalStuck})`,'stuck:'+key);}}
  if(sim.phase==='post'&&!stats.phaseEnd)stats.phaseEnd={t:t/1000,scores:[...sim.scores],round:sim.round};
 }
 // Fuzz driver, once per 50 ms.
 const R=(a,b)=>a+rng()*(b-a),pick=a=>a[Math.floor(rng()*a.length)],chance=p=>rng()<p;
 const cmd=(h,m)=>{stats.commands[m.t]=(stats.commands[m.t]||0)+1;send(h,m);};
 function drive(h){const t=now();
  if(!h.socket||!h.connected){if(h.rejoinAt&&t>=h.rejoinAt&&room.sim.phase==='game'){h.rejoinAt=0;stats.rejoins++;connect(h,{code});h.loadDelay=chance(.15)?R(2000,9000):R(0,600);}return;}
  if(h.started&&!h.ready&&h.pendingReady&&t>=h.pendingReady){send(h,{t:'ready'});h.ready=true;}
  if(!h.ready||room.sim.phase!=='game')return;
  if(t<h.silentUntil)return;
  // Disconnect / rejoin mid-round (sometimes mid-load is covered by loadDelay + the next roll).
  if(chance(.0007)){stats.disconnects++;if(chance(.3))send(h,{t:'bye'});h.socket.close();h.connected=false;h.socket=null;h.rejoinAt=t+R(300,6000);return;}
  if(chance(.00015)){h.silentUntil=t+R(16000,20000);stats.silentDrops++;h.rejoinAt=h.silentUntil+R(200,2000);return;}
  const me=h.me(),sim=room.sim;
  if(t>=h.until){const s=h.state;h.until=t+R(150,1500);s.f=pick([1,1,1,0,-1]);s.s=pick([0,0,1,-1]);s.j=chance(.15)?1:0;s.c=chance(.15)?1:0;s.w=chance(.15)?1:0;s.fire=chance(.3)?1:0;s.ads=chance(.2)?1:0;s.h4=chance(.05)?1:0;s.r=R(-Math.PI,Math.PI);s.p=R(-1.4,1.4);
   // Objective play in Spike: attackers carry to the site and plant; defenders go to a planted spike and defuse.
   h.goal=null;if(me&&sim.mode==='five'&&h.rs?.sp&&chance(.7)){const sp=h.rs.sp,atk=(h.rs.atk===1?0:1)===me[1];if(atk&&sp[0]==='carry'&&sp[1]===me[0])h.goal={site:sp[7]};else if(!atk&&sp[0]==='plant')h.goal={x:sp[2],z:sp[3],defuse:true};else if(atk&&sp[0]==='drop'&&sp[1]===-1)h.goal={x:sp[2],z:sp[3]};}}
  const s=h.state;let input={t:'in',seq:++h.seq,r:s.r,p:s.p,f:s.f,s:s.s,j:s.j,c:s.c,w:s.w,fire:s.fire,ads:s.ads,h4:s.h4};
  if(me&&me[10]&&h.goal){let gx,gz,gy=me[5];if(h.goal.site){const site=W.map.sites[h.goal.site];if(site){gx=site[0];gz=site[2];gy=site[1];}}else{gx=h.goal.x;gz=h.goal.z;}
   if(gx!==undefined){const d=Math.hypot(gx-me[4],gz-me[6]);if(d<(h.goal.defuse?1.8:3)){input={t:'in',seq:input.seq,r:s.r,p:0,f:0,s:0,h4:1};}else{if(!h.route||t-h.routeAt>1500){h.route=path(W,W.near(me[4],me[6],me[5]),W.near(gx,gz,gy));h.routeAt=t;}let next=null;if(h.route){const at=W.near(me[4],me[6],me[5]),i=h.route.indexOf(at);for(const n of i>=0?h.route.slice(i+1):h.route){const p=W.nav.nodes[n];if(Math.hypot(p[0]-me[4],p[2]-me[6])>1.2){next=p;break;}}}
     if(next)input={...input,r:Math.atan2(-(next[0]-me[4]),-(next[2]-me[6])),f:1,s:0,fire:0,h4:0,c:0,w:0,j:chance(.02)?1:0};}}}
  if(chance(.003))send(h,{t:'vis',h:chance(.5)?1:0});
  send(h,input);
  if(scenario!=='base'&&sim.mode==='five'&&me&&me[10]&&chance(.08)){const u=sim.units.find(x=>x.id===h.id),c=fuzzCast(sim,u,scenario,rng,stats);if(c){if(c.aim)send(h,{t:'in',seq:++h.seq,r:c.aim.look,p:c.aim.pitch,f:0,s:0});cmd(h,c.m);if(u.ultWeapon||u.headhunter)send(h,{t:'in',seq:++h.seq,r:c.aim?.look??s.r,p:c.aim?.pitch??0,f:0,s:0,fire:1});}}
  // Commands (well under the 80 msg/s limit).
  if(chance(.04)&&me){const r=rng();
   if(r<.12)cmd(h,{t:'reload'});
   else if(r<.24)cmd(h,{t:'equip',w:pick(sim.mode==='five'?['Knife','Classic',me[11],...BUYABLE.slice(0,18)]:BUYABLE.slice(0,18).concat('Knife','Blade Storm'))});
   else if(r<.40&&sim.mode==='five')cmd(h,{t:'buy',n:chance(.2)?'ab:'+pick(['c','q','e','x']):pick(BUYABLE)});
   else if(r<.46&&sim.mode==='five')cmd(h,{t:'sell',n:pick(BUYABLE)});
   else if(r<.66&&sim.mode==='five'){const k=pick(['c','q','e','x','x']),u=sim.units.find(u=>u.id===h.id);if(k==='x'&&u?.ability&&chance(.5)){u.ability.ult=Math.max(u.ability.ult,kits[u.agent]?.u||8);stats.ults++;}cmd(h,{t:'ab',k,...(k==='x'&&u?.agent==='Omen'?{p:[me[4]+R(-30,30),me[6]+R(-30,30)]}:{})});}
   else if(r<.72&&sim.mode==='five')cmd(h,{t:'blade'});
   else if(r<.80&&sim.mode==='five'&&h.fw.length){const g=h.fw.toSorted((a,b)=>Math.hypot(a[2]-me[4],a[4]-me[6])-Math.hypot(b[2]-me[4],b[4]-me[6]))[0];stats.picks++;cmd(h,{t:'pick',id:chance(.9)?g[0]:pick([-1,'x',1e9,null])});}
   else if(r<.86&&sim.mode==='five'){stats.drops++;cmd(h,{t:'dropw'});}
   else if(r<.89&&sim.mode==='five')cmd(h,{t:'drop'});
   else if(r<.95)send(h,pick(['{"t":"in","seq":"x"}','{"t":"in","seq":1e300,"r":1e308,"p":-1e308}','{"t":"buy","n":{"x":1}}','{"t":"pick","id":"1e2"}','{"t":"ab","k":"x","p":[null,null]}','{"t":"equip","w":"__proto__"}','{"t":"sell","n":"toString"}','{"t":"buy","n":"constructor"}','[1,2]','null','{"t":"ab","k":"__proto__"}','{"t":"in","seq":'+(h.seq+1)+',"r":0,"p":0,"f":"1e999","s":-5}','not json']));
   else cmd(h,{t:'pi',c:t});}
 }
 // Occasionally give bots ultimate points so their ult paths run too (abilities are cast through the normal 'ab' command).
 const deadline=seconds*1000;let lastGc=0;const heap=[];
 for(let k=0;now()<deadline;k++){for(const h of fz)drive(h);
  if(scenario!=='base'&&room.sim.mode==='five'&&k%10===0)driveBots(room.sim,scenario,rng,stats);
  if(room.sim.mode==='five'&&k%400===0)for(const u of room.sim.units)if(!u.human&&u.ability&&chance(.3))room.sim.command(u,{t:'ab',k:'x',p:[u.x,u.z]});
  if(shorten&&room.sim.mode!=='five'&&k===40)room.sim.remaining=Math.min(room.sim.remaining,shorten);
  try{await cluster.advance(50);}catch(e){errors.push('advance threw: '+(e.stack||e).split('\n').slice(0,4).join(' | '));}
  if(room.sim.phase==='post'||room.sim.phase==='closed')break;
  if(now()-lastGc>30000&&globalThis.gc){lastGc=now();globalThis.gc();heap.push(process.memoryUsage().heapUsed);}}
 if(room.sim.phase==='post'){await cluster.advance(1500);}
 stats.end={phase:room.sim.phase,remaining:room.sim.remaining,scores:room.sim.scores,round:room.sim.round,roundScores:room.sim.roundScores,virtualSeconds:now()/1000};stats.heapMB=heap.map(b=>+(b/1048576).toFixed(1));stats.timers=null;
 for(const h of fz)if(h.socket&&h.connected)try{h.socket.close();}catch(e){}
 await cluster.advance(200);
 return {map,mode,seed,humans,violations:violations.map(v=>({...v,count:seen.get(v.key)})),counts:Object.fromEntries(seen),errors:[...new Set(errors)].slice(0,50),stats};
 }finally{Math.random=realRandom;process.off('unhandledRejection',onRej);}
}

if(import.meta.url===`file://${process.argv[1]}`){
 const [maps='all',modes='dm,tdm,five',secs='180',humans='3',seed='1',scenario='base']=process.argv.slice(2);
 const list=(maps==='all'?MAPS:maps.split(','));const out=[];
 for(const map of list)for(const mode of modes.split(',')){const t=Date.now();const r=await soakRun({map,mode,seconds:+secs,humans:+humans,seed:+seed,scenario});out.push(r);
  console.log(JSON.stringify({map,mode,ms:Date.now()-t,ticks:r.stats.ticks,kills:r.stats.kills,rounds:r.stats.rounds,plants:r.stats.plants,rejoins:r.stats.rejoins,end:r.stats.end,heapMB:r.stats.heapMB,five:r.stats.five,maxFloor:r.stats.maxFloor,errors:r.errors,counts:r.counts,violations:r.violations.slice(0,25)}));}
 process.exit(out.some(r=>r.errors.length||r.violations.length)?1:0);
}
