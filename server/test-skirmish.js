// Skirmish 1v1 ('skm', server/src/modes.js SkirmishSimulation + worker.js): two human players online, one per team, no bots;
// elimination rounds without the Spike, first to 5 round wins (user-approved; VALORANT Skirmish: patch 11.07b notes + wiki Skirmish,
// see modes.js). Pins:
//  1. Simulation (small test world): one human per team, no bot and no third player; round 1 buy 15 s then 3 s; walking and fire
//     held in the buy phase; free loadout kept between rounds, changed in the buy phase only; no buy / abilities; Heavy Armor and
//     full health every round; the dead stay out until the next round; elimination scores the round (a real gun kill and direct
//     kills); a double death is a draw; 3 s between rounds; first to 5 ends the match; an empty seat pauses ('wait'), the rejoiner
//     restarts the round with the score kept, 60 s alone is a forfeit win; snapshot 'skm' row.
//  2. Worker (real worker module in-process, real Ascent world, virtual clock) with two simulated clients: /health lists skm without
//     ENABLE_SPIKE; the leader switches the party to Skirmish (teams 0 / 1); a solo leader cannot start it; a third player is refused
//     and the switch refused with three in the room; a full match to 5 over real inputs (the round winner shoots the other), round
//     score in both clients' snapshots, a dropped connection resumes the same unit mid-match, a player who leaves is not replaced by
//     a bot (the round waits) and rejoins on their side with the score kept; 'end' to both with the final score; never a bot.
import assert from 'node:assert/strict';
import {SkirmishSimulation,SKM,createSim} from './src/modes.js';
import {weapons} from './src/simulation.js';
import {localCluster} from './tools/local-cluster.mjs';
const out=[],note=s=>{out.push(s);if(process.env.VERBOSE)console.log(s);};
const W={map:{attacker:[0,0,0],defender:[0,0,-40],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-40],[30,0,-20],[-30,0,-20]],adj:[[1,2,3],[0,2,3],[0,1],[0,1]]},playable:[0,1,2,3],allowed:new Set([0,1,2,3]),near:(x,z)=>z<-20?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const run=(s,secs)=>{for(let i=0;i<Math.round(secs/.05);i++)s.step(.05);};
const down=(s,k,v)=>{v.hp=0;v.alive=false;v.deaths++;v.respawnAt=s.time+1.5;if(k)k.kills++;};
const toLive=s=>{for(let i=0;i<2000&&s.skm.ph!=='live';i++)s.step(.05);assert.equal(s.skm.ph,'live');};
// ---- 1. simulation ----
{assert(createSim(W,'skm','ascent')instanceof SkirmishSimulation);
 const s=new SkirmishSimulation(W,'skm','ascent',rnd);assert.equal(s.mode,'skm');assert.equal(s.gm,'skm');assert.equal(SKM.win,5);
 const a=s.add('Alpha','Jett'),b=s.add('Bravo','Sage');assert.deepEqual([a.team,b.team],[0,1],'one per team');
 assert.throws(()=>s.add('Third','Omen'),/full/,'no third player');assert.throws(()=>s.add('Bot Sage','Sage',false),/no bots/);
 s.start(true);assert.equal(s.units.length,2,'start fills no bots');assert(s.units.every(u=>u.human));assert.equal(s.phase,'game');
 assert.equal(s.skm.r,1);assert.equal(s.skm.ph,'buy');assert.equal(s.skm.t,15,'round 1 buy phase 15 s');
 for(const u of [a,b]){assert.equal(u.alive,true);assert.equal(u.hp,100);assert.equal(u.armor,50,'Heavy Armor');assert.equal(u.weapon,'Vandal');assert.deepEqual(Object.keys(u.inventory).sort(),['Classic','Vandal']);}
 assert.equal(s.command(a,{t:'buy',n:'Phantom'}),false,'no economy');assert.equal(s.command(a,{t:'ab',k:'e'}),false,'no abilities');
 assert.equal(s.command(a,{t:'equip',w:'Sheriff'}),true);assert.equal(s.command(a,{t:'equip',w:'Operator'}),true);assert.deepEqual(a.kit,{pri:'Operator',sec:'Sheriff'},'buy-phase loadout');assert.equal(a.weapon,'Operator');
 const x0=a.x,z0=a.z;a.input={forward:1,fire:true};a.inputAt=s.time;s.command(a,{t:'in',seq:1,r:0,p:0,f:1,s:0,fire:1});run(s,1);assert(Math.hypot(a.x-x0,a.z-z0)<.01,'no walking in the buy phase');assert.equal(a.ammo,weapons.Operator.magazineSize,'no fire in the buy phase');assert.equal(s.fire(a),false);
 toLive(s);assert.equal(s.command(a,{t:'equip',w:'Odin'}),false,'a new gun only in the buy phase');assert.equal(s.command(a,{t:'equip',w:'Sheriff'}),true,'loadout guns switch any time');assert.equal(s.command(a,{t:'equip',w:'Knife'}),true);s.command(a,{t:'equip',w:'Operator'});
 // a real gun kill: Bravo 6 m in front of Alpha, Alpha fires at the head
 Object.assign(b,{x:a.x,y:a.y,z:a.z-6,vx:0,vz:0,input:{},inputAt:-9});s.command(a,{t:'equip',w:'Sheriff'});
 let seq=10;for(let i=0;i<80&&b.alive;i++){s.command(a,{t:'in',seq:++seq,r:0,p:Math.atan2(.05,6),f:0,s:0,fire:i%2});s.step(.05);}
 assert.equal(b.alive,false,'Alpha shot Bravo');assert.equal(s.skm.ph,'end');assert.deepEqual(s.skm.sc,[1,0]);assert.deepEqual(s.scores,[1,0],'scores = round wins');assert.equal(s.skm.lw,0);
 run(s,2);assert.equal(b.alive,false,'no respawn inside the round');assert(!(b.respawnAt<Infinity));s.spawn(b);assert.equal(b.alive,false,'a late spawn call does not revive');
 run(s,1.1);assert.equal(s.skm.r,2);assert.equal(s.skm.ph,'buy');assert.equal(s.skm.t<=3&&s.skm.t>2.8,true,'3 s buy after round 1');
 for(const u of [a,b]){assert.equal(u.alive,true);assert.equal(u.hp,100);assert.equal(u.armor,50);}assert.deepEqual(a.kit,{pri:'Operator',sec:'Sheriff'});assert.equal(a.weapon,'Operator','loadout kept');assert.deepEqual(Object.keys(a.inventory).sort(),['Operator','Sheriff']);assert.equal(a.ammo,weapons.Operator.magazineSize);
 toLive(s);down(s,b,a);s.step(.05);assert.deepEqual(s.skm.sc,[1,1]);run(s,3.1);
 toLive(s);down(s,null,a);down(s,null,b);s.step(.05);assert.deepEqual(s.skm.sc,[1,1],'double death: draw');assert.equal(s.skm.why,'draw');run(s,3.1);assert.equal(s.skm.r,4);
 for(let i=0;i<3;i++){toLive(s);down(s,a,b);s.step(.05);run(s,3.1);}assert.deepEqual(s.skm.sc,[4,1]);
 toLive(s);down(s,a,b);s.step(.05);assert.equal(s.phase,'post','5th round win ends the match');assert.deepEqual(s.scores,[5,1]);const sn=s.snapshot();assert.deepEqual(sn.skm.sc,[5,1]);assert.equal(sn.skm.win,5);assert.equal(sn.skm.ph,'over');
 note('sim: 1 human per team, no bots / third player, buy 15 s then 3 s, walk + fire held in buy, free loadout kept and changed in buy only, no buy / abilities, Heavy Armor each round, dead stay out, real kill + direct kills score, draw, first to 5');}
{seed=5;const s=new SkirmishSimulation(W,'skm','ascent',rnd),a=s.add('Alpha'),b=s.add('Bravo');s.start();toLive(s);down(s,a,b);s.step(.05);run(s,3.1);toLive(s);
 s.units=s.units.filter(u=>u!==b);s.step(.05);assert.equal(s.skm.ph,'wait','an empty seat pauses');assert.equal(s.fire(a),false);run(s,10);assert.equal(s.phase,'game');
 const b2=s.add('Bravo','Sage',true,1);assert.equal(b2.team,1,'rejoins on its side');s.step(.05);assert.equal(s.skm.ph,'buy','rejoin restarts the round');assert.deepEqual(s.skm.sc,[1,0],'score kept');assert.equal(s.skm.r,3);assert(b2.alive&&a.alive);
 assert.throws(()=>s.add('Charlie','Omen',true,0),/full/);
 s.units=s.units.filter(u=>u!==b2);s.step(.05);assert.equal(s.skm.ph,'wait');run(s,59);assert.equal(s.phase,'game');run(s,1.2);assert.equal(s.phase,'post','60 s alone: forfeit');assert.deepEqual(s.scores,[5,0]);assert.equal(s.skm.why,'forfeit');
 note('sim: empty seat -> wait (no fire), rejoin on own side restarts the round with the score kept, third player refused, 60 s alone = forfeit win');}
// Round-1 load wait (user, live: whoever loads first was frozen ~105 s - the buy clock held up to 90 s for a loading opponent while
// the HUD read 'BUY 15s'): the hold is capped at SKM.loadHold = 20 s, then the buy phase runs regardless; the snapshot's skm.ld is
// the wait left (s) while it holds (the page shows 'Waiting for opponent' with it instead of the buy timer), absent otherwise.
{seed=9;const s=new SkirmishSimulation(W,'skm','ascent',rnd),a=s.add('Alpha'),b=s.add('Bravo');b.loading=true;s.start();
 assert.equal(SKM.loadHold,20,'load wait capped at 20 s');
 run(s,10);assert.equal(s.skm.ph,'buy');assert.equal(s.skm.t,15,'buy clock held while the opponent loads');let K=s.snapshot().skm;assert(K.ld>9.5&&K.ld<=10.05,'snapshot ld = wait left ('+K.ld+')');
 run(s,9.9);K=s.snapshot().skm;assert(K.ld>0&&K.ld<=.2,'still waiting at 19.9 s ('+K.ld+')');assert.equal(s.skm.t,15);
 run(s,.3);K=s.snapshot().skm;assert.equal(K.ld,undefined,'no wait after 20 s');assert(s.skm.t<15,'buy clock runs after 20 s even with the opponent still loading');
 run(s,15.1);assert.equal(s.skm.ph,'live','round 1 live at ~35 s, opponent still loading');assert.equal(s.snapshot().skm.ld,undefined);
 // the opponent loading in early ends the wait at once
 seed=10;const s2=new SkirmishSimulation(W,'skm','ascent',rnd),c=s2.add('Alpha'),e=s2.add('Bravo');e.loading=true;s2.start();run(s2,4);assert(s2.snapshot().skm.ld>15);e.loading=false;run(s2,.1);assert.equal(s2.snapshot().skm.ld,undefined);assert(s2.skm.t<15);run(s2,15);assert.equal(s2.skm.ph,'live');
 note('sim: round-1 load wait capped at 20 s (snapshot skm.ld = wait left), then the buy phase runs; an early load ends the wait');}
// ---- 2. worker: two simulated clients, a full match to 5 ----
{const P=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true'}});const h=await (await P.fetch('/health')).json();assert(h.modes.includes('skm'),'skm offered without ENABLE_SPIKE');assert(!h.modes.includes('five'));
 const C=P,until=async(c,ms,w)=>{const end=C.clock.now()+ms;while(!c()){if(C.clock.now()>end)throw Error('timed out: '+w);await C.advance(50);}};
 class Cl{constructor(n,ag){this.n=n;this.ag=ag;this.msgs=[];this.room=null;this.you=null;this.snap=null;this.closed=null;this.seq=0;}
  hook(q,extra={}){this.s=C.connect(q);this.s.on('message',m=>{this.msgs.push(m);if(m.t==='room')this.room=m;if(m.t==='welcome'){this.you=m.you;this.resume=m.resume;}if(m.t==='s'||m.t==='end')this.snap=m;if(m.t==='start'){this.start=m;this.send({t:'ready'});}});this.s.on('close',e=>{this.closed=e;});this.s.on('error',e=>{this.closed={code:0,reason:String(e.message)};});this.s.on('open',()=>this.send({t:'hi',n:this.n,ag:this.ag,...extra}));return this;}
  send(m){this.s.send(JSON.stringify(m));}last(t){return this.msgs.filter(m=>m.t===t).at(-1);}}
 // a solo leader cannot start Skirmish
 const S1=new Cl('Solo','Jett').hook({create:1,code:'SKMSLA',mode:'skm',map:'ascent'});await until(()=>S1.room,10000,'solo room');assert.equal(S1.room.mode,'skm');
 S1.send({t:'queue'});await until(()=>S1.last('qx'),2000,'solo refused');assert.match(S1.last('qx').why,/second player/);S1.send({t:'start'});await C.advance(200);assert.equal(C.room('SKMSLA').sim.phase,'room','no solo start');S1.send({t:'bye'});
 // party: TDM room of three, the switch to Skirmish refused, then two
 const code='SKMDUE',A=new Cl('Lead','Jett').hook({create:1,code,mode:'tdm',map:'ascent'});await until(()=>A.room&&A.you!=null,10000,'room');
 const B=new Cl('Mate','Sage').hook({code});await until(()=>B.room&&A.room.pl.length===2,8000,'join');const X=new Cl('Extra','Omen').hook({code});await until(()=>A.room.pl.length===3,8000,'third');
 A.send({t:'mode',mode:'skm'});await until(()=>A.last('mo'),3000,'mo');assert.equal(A.last('mo').ok,0,'three in the room: no Skirmish');assert.match(A.last('mo').why,/1v1/);assert.equal(C.room(code).gm(),'tdm');
 X.send({t:'bye'});await until(()=>A.room.pl.length===2,3000,'third left');A.send({t:'mode',mode:'skm'});await until(()=>A.room.mode==='skm'&&B.room.mode==='skm',3000,'switch');const R=C.room(code);assert(R.sim instanceof SkirmishSimulation);
 const ua=()=>R.sim.units.find(u=>u.name==='Lead'),ub=()=>R.sim.units.find(u=>u.name==='Mate');assert.notEqual(ua().team,ub().team,'opposite teams after the switch');
 const Z=new Cl('Late','Omen').hook({code});await until(()=>Z.closed,3000,'third refused');assert.match(String(Z.closed.reason),/1v1/);assert.equal(R.sim.units.length,2);
 let maxUnits=0,bots=0;const watch=()=>{maxUnits=Math.max(maxUnits,R.sim.units.length);bots+=R.sim.units.filter(u=>!u.human).length;};
 A.send({t:'queue'});await until(()=>A.start&&B.start,9000,'start');assert.equal(A.start.mode,'skm');assert.equal(A.start.gm,'skm');assert.equal(A.start.win,5);assert.equal(R.sim.units.length,2,'no bots');
 // a fight on open ground: two nav nodes 5-9 m apart with a clear sight line at eye height
 const Wd=R.world,N=Wd.nav.nodes,list=Wd.playable;let pair=null;
 for(let i=0;i<list.length&&!pair;i+=7){const p=N[list[i]];for(let j=0;j<list.length;j+=3){const q=N[list[j]],d=Math.hypot(q[0]-p[0],q[2]-p[2]);if(d<5||d>9||Math.abs(q[1]-p[1])>.2||Wd.blocked(p[0],p[2],.5,p[1],1.9)||Wd.blocked(q[0],q[2],.5,q[1],1.9))continue;const o=[p[0],p[1]+1.6,p[2]],t=[q[0]-p[0],q[1]+1.2-o[1],q[2]-p[2]],l=Math.hypot(...t);if(Wd.ray(o,t.map(v=>v/l),l)===Infinity){pair=[p,q];break;}}}
 assert(pair,'open ground pair');
 const duel=async(K,V,uk,uv)=>{await until(()=>R.sim.skm.ph==='live',30000,'live');const [p,q]=pair,k=uk(),v=uv();Object.assign(k,{x:p[0],y:p[1],z:p[2],vx:0,vz:0,vy:0});Object.assign(v,{x:q[0],y:q[1],z:q[2],vx:0,vz:0,vy:0});k.seq++;v.seq++;
  const dx=q[0]-p[0],dz=q[2]-p[2],r=Math.atan2(-dx,-dz),pt=Math.atan2(q[1]+1.45-(p[1]+1.6),Math.hypot(dx,dz)),sc=[...R.sim.skm.sc];
  for(let i=0;i<120&&uv()?.alive;i++){K.send({t:'in',seq:++K.seq,r,p:pt,f:0,s:0,fire:1});V.send({t:'in',seq:++V.seq,r:0,p:0,f:0,s:0});watch();await C.advance(50);}
  assert.equal(uv().alive,false,K.n+' shot '+V.n);await until(()=>R.sim.skm.ph!=='live',2000,'round over');const w=uk().team;sc[w]++;assert.deepEqual(R.sim.skm.sc,sc,'round to the shooter');
  await until(()=>K.snap?.skm&&V.snap?.skm&&K.snap.skm.sc.join()===sc.join()&&V.snap.skm.sc.join()===sc.join(),3000,'score in both snapshots');return sc;};
 let sc=await duel(A,B,ua,ub);assert.equal(A.snap.skm.ph,'end');await C.advance(1500);assert.equal(ub().alive,false,'no respawn inside the round');
 await until(()=>R.sim.skm.ph==='buy'&&R.sim.skm.r===2,5000,'round 2');assert(ub().alive);assert.equal(A.snap.skm.r,2);
 sc=await duel(B,A,ub,ua);assert.deepEqual(sc,[ua().team===0?0:1,ua().team===0?1:0].map((_,t)=>R.sim.skm.sc[t]));
 sc=await duel(A,B,ua,ub);
 // a dropped connection resumes the same unit mid-match (no bot, score kept)
 await until(()=>R.sim.skm.ph==='buy',6000,'buy');const before=ub(),tok=B.resume;B.s.close();await C.advance(500);assert.equal(R.sim.units.length,2,'the unit is kept for the resume');assert(R.sim.units.every(u=>u.human));
 const B2=new Cl('Mate','Sage').hook({code,resume:tok},{resume:tok});await until(()=>B2.you!=null,5000,'resumed');assert.equal(B2.you,before.id,'same unit');assert.equal(ub(),before);assert.equal(B2.last('welcome').resumed,1);
 sc=await duel(B2,A,ub,ua);
 // a player who leaves is not replaced by a bot; the round waits; the rejoiner is back on their side with the score kept
 await until(()=>R.sim.skm.ph==='buy',6000,'buy 2');const teamB=ub().team,scKeep=[...R.sim.skm.sc];B2.send({t:'bye'});await C.advance(400);watch();
 assert.equal(R.sim.units.length,1,'no bot fills the seat');assert.equal(R.sim.skm.ph,'wait');assert.equal(A.snap.skm.ph,'wait');await C.advance(5000);assert.equal(R.sim.phase,'game');
 const B3=new Cl('Mate','Sage').hook({code});await until(()=>B3.start&&ub(),8000,'rejoin');assert.equal(ub().team,teamB,'own side back');await until(()=>R.sim.skm.ph==='buy',3000,'round restarts');assert.deepEqual(R.sim.skm.sc,scKeep,'score kept');
 for(let i=0;i<20&&R.sim.phase==='game';i++)await duel(A,B3,ua,ub);
 await until(()=>A.last('end')&&B3.last('end'),3000,'end');assert.equal(R.sim.phase,'post');const fin=R.sim.scores;assert.equal(Math.max(...fin),5,'first to 5');assert.equal(fin[ua().team],5,'Lead won');
 const endA=A.last('end');assert.equal(endA.over,ua().team===0?'t':'r');assert.deepEqual(endA.skm.sc,fin);assert.equal(endA.skm.ph,'over');assert.deepEqual(B3.last('end').skm.sc,fin);
 assert.equal(bots,0,'never a bot');assert(maxUnits<=2);
 note('worker: health skm (no Spike gate), no solo start, switch refused with 3 / third player refused, full match to 5 over real inputs ('+fin.join('-')+'), score in both snapshots, dead stay out, resume keeps the unit, a leaver is not replaced (wait), rejoins own side with score kept, end to both');}
console.log('test-skirmish: PASS\n  '+out.join('\n  '));
