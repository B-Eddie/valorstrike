// Ledger row 11, Spike acceptance (local only, ENABLE_SPIKE=true): the real worker module (default fetch -> GameRoom ->
// SpikeSimulation on the real Ascent world) in-process on a virtual clock (tools/local-cluster.mjs), with two clients
// speaking the browser protocol over the room's WebSockets. Bots are held still so every round is decided by the
// scripted step under test; everything checked is what the clients receive (rs round state, s snapshots, end).
//  1. release gate: without ENABLE_SPIKE the worker offers no Spike mode and refuses a five room
//  2. buy phase + economy: 800 start, buy/sell, buy rejected after the phase
//  3. plant by a human holding 4 (h4) in a site: 4 s, +300 to every attacker, rs.sp shows it to both teams
//  4. late join mid-round: the joiner takes a bot seat, sits the round out dead, plays from the next round
//  5. defuse by a human (7 s, half checkpoint kept on release), detonation (45 s), round credits (3000 / loss streak)
//  6. leave mid-round (seat bot takes over the living body) and reconnect with the same token (same team, same seat)
//  7. half time at round 13: sides swap, credits reset to 800, loss streak reset
//  8. overtime from 12-12: 5000 credits each round, sides swap every round, win by two; match end reaches both clients
import assert from 'node:assert/strict';import {localCluster} from './tools/local-cluster.mjs';
const out=[],note=s=>{out.push(s);if(process.env.VERBOSE)console.log(s);};
// 1. gate
{const c=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true'}});const h=await (await c.fetch('/health')).json();assert(!h.modes.includes('five'),'production default offers no Spike: '+h.modes);
 const s=c.connect({create:1,code:'NSPKAB',mode:'five',map:'ascent'});let err=null,opened=false;s.on('error',e=>err=e);s.on('open',()=>opened=true);await c.advance(200);
 assert(err&&!opened,'a five room is refused without ENABLE_SPIKE');note('gate: no Spike without ENABLE_SPIKE ('+String(err.message).slice(0,60)+')');}
const C=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}}),code='SPKACC';
assert((await (await C.fetch('/health')).json()).modes.includes('five'),'ENABLE_SPIKE=true offers five');
class Client{constructor(name,token){Object.assign(this,{name,token,seq:0,rs:null,rows:null,ended:null,events:[],room:null,started:false,h4:false,id:null});}
 hook(q){this.s=C.connect(q);this.s.on('message',m=>this.on(m));this.s.on('open',()=>this.s.send(JSON.stringify({t:'hi',n:this.name,ag:'Sova',token:this.token})));return this;}
 send(m){this.s.send(JSON.stringify(m));}
 on(m){if(m.t==='welcome'){this.id=m.you;this.name=m.name;}else if(m.t==='room')this.room=m;else if(m.t==='start'){this.started=true;this.rows=m.u;this.send({t:'ready'});}
  else if(m.t==='rs')this.rs=m;else if(m.t==='re')(this.re||(this.re=[])).push(m);else if(m.t==='end')this.ended=m;else if(m.t==='s'){this.rows=m.u;for(const e of m.ev||[])this.events.push(e);this.send({t:'in',seq:++this.seq,r:0,p:0,f:0,s:0,h4:this.h4?1:0});}}
 me(){return this.rows?.find(r=>r[0]===this.id);}}
const until=async(cond,ms,what)=>{const end=C.clock.now()+ms;while(!cond()){if(C.clock.now()>end)throw Error('timed out: '+what);await C.advance(50);}};
const pa=await C.profile(),pb=await C.profile();const A=new Client('SpikeA',pa.token).hook({create:1,code,mode:'five',map:'ascent'});
await until(()=>A.room,5000,'room');A.send({t:'start'});await until(()=>A.started&&A.rs,20000,'start');
const R=C.room(code),sim=R.sim,W=sim.world,unit=n=>sim.units.find(u=>u.name===n);
// bots stand still (they would otherwise decide rounds by fighting)
sim.bot=u=>{u.input={};u.inputAt=sim.time;};
// 2. buy phase + economy
assert.equal(A.rs.me,800);assert(A.rs.b>0,'buy phase');A.send({t:'buy',n:'Ghost'});await C.advance(200);assert.equal(A.rs.me,300,'Ghost bought');A.send({t:'sell',n:'Ghost'});await C.advance(200);assert.equal(A.rs.me,800,'sold back');
note('round 1 buy phase: 800, Ghost 500 bought and sold back');
const plantSpot=site=>{for(const i of W.playable){const p=W.nav.nodes[i];if(W.plantAt(p[0],p[2])===site&&!W.blocked(p[0],p[2],.45,p[1],1.8))return p;}throw Error('no plant spot '+site);};
const endBuy=async()=>{sim.buy=Math.min(sim.buy,.1);await until(()=>A.rs.b===0,3000,'buy end');};
const atkTeam=()=>sim.atk,ua=unit('SpikeA');
// 3. plant by SpikeA (attacker in round 1)
assert.equal(ua.team,sim.atk,'host attacks first');await endBuy();A.send({t:'buy',n:'Ghost'});await C.advance(100);assert.equal(A.rs.me,800,'no buying after the buy phase');
sim.spike.carrier=ua.id;sim.spike.st='carry';const sA=plantSpot('A');[ua.x,ua.y,ua.z]=sA;ua.vx=ua.vz=ua.vy=0;
const atkBefore=Object.fromEntries(sim.units.filter(u=>u.team===sim.atk).map(u=>[u.name,u.credits]));
A.h4=true;await C.advance(2000);assert(sim.spike.pt>1.7&&sim.spike.st==='carry','plant progressing');A.h4=false;await C.advance(200);assert.equal(sim.spike.pt,0,'release resets the plant');
A.h4=true;await until(()=>sim.spike.st==='plant',6000,'plant');A.h4=false;const plantAt=C.clock.now();
assert.equal(sim.spike.site,'A');assert.equal(A.rs.sp[0],'plant');
for(const u of sim.units.filter(u=>u.team===sim.atk))assert.equal(u.credits,Math.min(9000,atkBefore[u.name]+300),'+300 plant bonus for every attacker ('+u.name+')');
note('plant: SpikeA held 4 in A, released at 2 s (reset), then planted; +300 to all five attackers');
// 4. late join mid-round: SpikeB takes a bot seat on the defending side, out for the round
const B=new Client('SpikeB',pb.token).hook({code});await until(()=>B.started&&B.me()&&B.rs,10000,'late join');
const ub=unit('SpikeB');assert.equal(sim.units.length,10,'still 5v5');assert.equal(ub.alive,false,'joiner sits the round out');assert.equal(B.rs.sp[0],'plant','joiner sees the planted Spike');
note('late join: SpikeB seated on team '+ub.team+' (attackers '+sim.atk+'), dead for the current round, sees the plant');
// detonation decides round 1 (nobody defuses)
const s0=[...sim.roundScores],credits0=Object.fromEntries(sim.units.map(u=>[u.name,u.credits]));
await until(()=>sim.roundDelay>0,47000,'detonation');assert(C.clock.now()-plantAt>=44000,'fuse ran ~45 s');
await until(()=>A.re&&A.re.length===1&&B.re&&B.re.length===1,2000,'round end message');assert.equal(A.re[0].tx,'Spike detonated');assert.equal(B.re[0].tx,'Spike detonated');assert.equal(sim.roundScores[sim.atk],s0[sim.atk]+1);
// VALORANT (wiki.playvalorant.com/en-us/Credits): a defender still alive after the detonation gets 1000 instead of the loss bonus
for(const u of sim.units)assert.equal(u.credits,Math.min(9000,credits0[u.name]+(u.team===sim.atk?3000:u.alive?1000:1900)),'round credits '+u.name);
await until(()=>A.rs.sc[sim.atk===0?0:1]+A.rs.sc[sim.atk===0?1:0]===1,3000,'clients see the score');note('detonation: attackers win round 1 after the 45 s fuse; winners +3000, losers +1900 (surviving defenders +1000)');
// round 2: SpikeB plays (alive), defuses with the half checkpoint
await until(()=>sim.round===2&&sim.buy>0,8000,'round 2');assert.equal(ub.alive,true,'joiner plays from the next round');
await endBuy();const def=ub.team!==sim.atk?ub:null;assert(def,'SpikeB defends (took a defender bot seat)');
sim.spike.st='plant';sim.spike.site='B';sim.spike.t=45;sim.spike.dt=0;sim.spike.carrier=null;const sB=plantSpot('B');[sim.spike.x,sim.spike.y,sim.spike.z]=sB;[ub.x,ub.y,ub.z]=[sB[0]+.8,sB[1],sB[2]];ub.vx=ub.vz=ub.vy=0;
B.h4=true;await C.advance(4200);B.h4=false;await C.advance(300);assert.equal(sim.spike.dt,3.5,'half checkpoint kept');
const c2=Object.fromEntries(sim.units.map(u=>[u.name,u.credits])),l2=[...sim.losses];
B.h4=true;await until(()=>sim.roundDelay>0,6000,'defuse');B.h4=false;await until(()=>A.re.length===2,2000,'re 2');assert.equal(A.re[1].tx,'Spike defused');
for(const u of sim.units){const won=u.team!==sim.atk;assert.equal(u.credits,Math.min(9000,c2[u.name]+(won?3000:Math.min(2900,1900+(sim.losses[u.team]-1)*500))),'round 2 credits '+u.name);}
note('defuse: SpikeB released after 4.2 s (checkpoint 3.5 s kept), then completed the defuse; defenders +3000');
// 6. leave mid-round and reconnect with the same token
await until(()=>sim.round===3&&sim.buy>0,8000,'round 3');await endBuy();const team=ub.team,seatHp=ub.hp;
B.send({t:'bye'});B.s.close();await C.advance(300);const seat=sim.units.find(u=>!u.human&&u.team===team&&u.alive&&Math.hypot(u.x-ub.x,u.z-ub.z)<.01);
assert(seat,'a seat bot took over the living body');assert.equal(sim.units.length,10);
const B2=new Client('SpikeB',pb.token).hook({code});await until(()=>B2.started&&B2.me(),10000,'rejoin');const ub2=unit('SpikeB');
assert.equal(ub2.team,team,'rejoin keeps the team');assert.equal(sim.units.length,10,'5v5 after rejoin');note('leave/rejoin: seat bot took the living body (hp '+seatHp+'), SpikeB rejoined on team '+team+', 10 units');
// eliminations decide rounds quickly from here
const elim=async team=>{for(const u of sim.units)if(u.team===team){u.alive=false;u.hp=0;}await until(()=>sim.roundDelay>0,3000,'elimination');};
const next=async n=>{await until(()=>sim.round===n&&sim.buy>0,8000,'round '+n);await endBuy();};
// 7. half time: rounds 3..12 decided by eliminating the defenders, round 13 swaps sides
await elim(1-sim.atk);for(let n=4;n<=12;n++){await next(n);await elim(1-sim.atk);}
const atk12=sim.atk;await next(13);assert.equal(sim.atk,1-atk12,'sides swap at round 13');for(const u of sim.units)if(u.human)assert.equal(u.credits,800,'credits reset at half ('+u.name+')');else assert(u.credits<=800&&u.credits+(u.spent||0)>=0,'bot credits reset at half then auto-buy ('+u.name+' '+u.credits+')');assert.deepEqual(sim.losses,[0,0]);
await C.advance(200);assert.equal(A.rs.atk,sim.atk===0?1:0,'client sees the swap');note('half time: round 13 sides swapped, everyone 800, loss streaks reset; scores '+sim.roundScores);
// 8. overtime: this round stands in for round 24 at 12-11, the defenders take it: 12-12
sim.round=24;sim.roundScores[sim.atk]=12;sim.roundScores[1-sim.atk]=11;await elim(sim.atk);assert.deepEqual(sim.roundScores,[12,12]);
const atk24=sim.atk;await next(25);
assert.equal(sim.atk,1-atk24,'overtime round 25 swaps sides');for(const u of sim.units)if(u.human)assert.equal(u.credits,5000,'overtime credits 5000 ('+u.name+')');else assert(u.credits<=5000,'bot overtime credits '+u.credits);
const lead=1-sim.atk;await elim(sim.atk);assert.equal(sim.roundScores[lead],13);
await next(26);assert.equal(sim.atk,atk24,'overtime swaps every round');for(const u of sim.units)if(u.human)assert.equal(u.credits,5000,'overtime credits reset to 5000 each round ('+u.name+')');assert(!A.ended,'13-12 is not a win');
await elim(1-lead);
await until(()=>A.ended&&B2.ended,8000,'match end on both clients');assert.equal(sim.phase,'post');assert.deepEqual([...sim.roundScores].sort((a,b)=>a-b),[12,14]);
note('overtime: 12-12 -> round 25 sides swapped, 5000 each; 13-12 continues; round 26 swapped again, 5000; 14-12 ends the match; end reached both clients');
console.log('Spike acceptance (local ENABLE_SPIKE, real worker + Ascent world, virtual clock): gate, buy/sell/econ, human plant with +300 team bonus, late join, detonation, human defuse with checkpoint, leave/rejoin seat handover, half-time swap, overtime 5000/swap/win-by-two, match end'+(process.env.VERBOSE?'':''));
if(process.env.VERBOSE)console.log(out.join('\n'));
process.exit(0);
