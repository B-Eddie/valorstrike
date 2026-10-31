// Bots feel like real players beyond aim (lane-botfeel, user 2026-10-30 "bots have to feel like actual players"; offline twin:
// work/test_bot_feel_offline.cjs; measured with work/probe_bot_feel.cjs).
//  1. reloading is not done in the open: a bot whose gun is reloading while it sees the enemy backs off - toward where it
//     peeked from (its unseen trail) when that is close, else straight away from the enemy (to a free side when a wall is
//     behind) - instead of strafing / standing in the enemy's sight (09a42d4 offline: 10-23 % of reload time in sight, backing 7-23 % of it)
//  2. and it does not re-peek mid-reload: unsighted, reloading, with a remembered enemy within RELOAD.hold m, it holds the
//     angle until the magazine is back, then pushes again (the carrier and far contacts are not held)
//  3. trading like a player (lane-botfeel2; a8c64fa offline 5v5: 10.5 % of deaths traded within 3 s, real players far more):
//     the trader goes for the actual killer (u.lastKiller, the killfeed name; was: the enemy nearest the body), knows its
//     spot (the shots / the call: a 'heard' memory, so it comes round the corner pre-aimed), swings it wide (BotBrain.peek
//     ctx.trade: no hold / jiggle while a trade is on), and the killer's next fight within TRADE.focus s of its kill starts
//     TRADE.lag late (its eyes still on the body, its spray resetting: BotBrain.reaction ctx.postKill)
//  4. moving quietly (BotBrain.quiet / WALK): out of a fight, with an enemy it knows of within WALK.range m, a Spike-mode bot
//     shift-walks (silent) instead of running at it; never while trading, swinging wide, carrying the Spike, or seeing it
// Shared decision: vendor/bot-brain.cjs reloadPlay / reloadBack (the page's BOT VARIETY block uses the same module).
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {persona,botView} from './src/bots.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[];
const nodes=[],adj=[];for(let i=0;i<21;i++)for(let j=0;j<21;j++){nodes.push([i*2-20,0,-j*2+20]);const k=i*21+j,a=[];if(i>0)a.push(k-21);if(i<20)a.push(k+21);if(j>0)a.push(k-1);if(j<20)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const WALL={on:false};const G=()=>({map:{attacker:[-20,0,20],defender:[20,0,-20],sites:{A:[-8,0,0],B:[8,0,0]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:(o,d,max)=>WALL.on?Math.min(1,max):Infinity});
function duo(k,{bx=0,bz=0,look=0,tx=0,tz=-12,hold=false}={}){WALL.on=false;const s=new Simulation(G(),'tdm','ascent',B.rng(900+k)),t=s.add('Target','Jett',true),b=s.add('Bot Sage','Sage',false);
 s.phase='game';s.remaining=1e9;s.maxKills=1e9;if(hold)s.objectiveRoutes=true;
 Object.assign(t,{team:1,x:tx,y:0,z:tz,hp:1e9,armor:0,look:0,loading:false,protectedUntil:0,invulnerableUntil:0,input:{}});Object.assign(b,{team:0,x:bx,y:0,z:bz,look,weapon:'Vandal',ammo:25,reserve:75,loading:false,protectedUntil:0});
 persona(s,b);b.pitch=B.idlePitch(persona(s,b).brain);b.nextHoldAt=1e9;/* no holder pause between pushes: only the reload holds it */return {s,t,b};}
const mv=b=>{const i=b.input||{},f=i.forward||0,sd=i.side||0,c=Math.cos(b.look||0),sn=Math.sin(b.look||0);return [-sn*f+c*sd,-c*f-sn*sd];};
function tick(s,b,dt=.05,move=false){s.time+=dt;if(b.reloadAt&&s.time>=b.reloadAt)s.finishReload(b);const L0=b.look;s.bot(b);botView(s,b,L0,dt);const m=mv(b);if(move){b.x+=m[0]*dt*5;b.z+=m[1]*dt*5;}s.events.length=0;return m;}
// 0. the shared decision
{assert.equal(typeof B.reloadPlay,'function','BotBrain.reloadPlay');assert.equal(typeof B.reloadBack,'function','BotBrain.reloadBack');
 assert.equal(B.reloadPlay({reloading:true,seen:true}),'back','reloading in sight: back off');
 assert.equal(B.reloadPlay({reloading:true,seen:false,contactD:10}),'hold','reloading, a contact 10 m away: hold, no re-peek');
 assert.equal(B.reloadPlay({reloading:true,seen:false,contactD:B.RELOAD.hold+5}),null,'a far contact: keep going');
 assert.equal(B.reloadPlay({reloading:true,seen:false,contactD:10,carrier:true}),null,'the Spike carrier keeps its path');
 assert.equal(B.reloadPlay({reloading:false,seen:true}),null,'not reloading: fight');
 const a=B.reloadBack(0,0,0,4,0,-12);assert.ok(a[1]>.99,'back toward the spot it peeked from (4 m behind)');
 const c=B.reloadBack(0,0,null,null,0,-12);assert.ok(c[1]>.99,'no spot: straight away from the enemy');
 const f=B.reloadBack(0,0,0,B.RELOAD.back+6,0,-12);assert.ok(f[1]>.99&&Math.abs(f[0])<.01,'a spot too far: away from the enemy');
 const sd=B.reloadBack(0,0,3,1,0,-12),l=Math.hypot(sd[0],sd[1]);assert.ok(Math.abs(l-1)<1e-6&&sd[0]>.9,'a spot to the side (the corner it swung from): toward it');
 const w=B.reloadBack(0,0,null,null,0,-12,(x,z)=>z<.5);assert.ok(Math.abs(Math.hypot(w[0],w[1])-1)<1e-6&&w[1]<.1&&Math.abs(w[0])>.99,'a wall right behind: to a free side ('+w.map(v=>v.toFixed(2))+')');
 const T=[];for(let t=0;t<2;t+=.05)B.trailNote(T,-t*2,0,t);assert.ok(T.length<=B.RELOAD.keep&&T.length>=6,'trail: one point per '+B.RELOAD.step+' s, the last '+B.RELOAD.keep+' ('+T.length+')');
 const q=B.reloadSpot(T,T[T.length-1][0],0);assert.ok(q&&Math.abs(q[0]-T[T.length-1][0])>=B.RELOAD.min,'the peek spot is the newest trail point at least RELOAD.min m back');
 assert.equal(B.reloadSpot([[0,0,0]],.5,0),null,'a trail only under its feet: no spot (back off straight)');
 out.push('reloadPlay / reloadBack');}
// 1. server: reloading in sight backs off (away from the enemy without a cover spot, toward the peek spot with one)
{let back=0,n=0,dotS=0;for(let k=0;k<8;k++){const {s,t,b}=duo(k);for(let i=0;i<6;i++)tick(s,b);/* the fight is on */b.ammo=0;b.reloadAt=s.time+2.4;
  for(let i=0;i<30;i++){const m=tick(s,b,.05,true);if(!b.reloadAt)break;n++;const dx=t.x-b.x,dz=t.z-b.z,d=Math.hypot(dx,dz)||1,l=Math.hypot(m[0],m[1]);if(l>.1){const c=(m[0]*dx+m[1]*dz)/(d*l);dotS+=c;if(c<-.3)back++;}}}
 assert.ok(n>100,'reload ticks in sight ('+n+')');assert.ok(back/n>=.8,`a reloading bot in sight backs away from the enemy (${(back/n*100).toFixed(0)} % of ticks >= 80 %)`);
 let toward=0,m2=0;for(let k=0;k<6;k++){const {s,t,b}=duo(k,{bx:3,bz:2});WALL.on=true;tick(s,b);WALL.on=false;b.x=0;b.z=0;/* it walked out of (3, 2) unseen */for(let i=0;i<6;i++)tick(s,b);b.ammo=0;b.reloadAt=s.time+2.4;
  for(let i=0;i<10;i++){const m=tick(s,b,.05,false);m2++;const dx=3-b.x,dz=2-b.z,d=Math.hypot(dx,dz),l=Math.hypot(m[0],m[1]);if(l>.1&&(m[0]*dx+m[1]*dz)/(d*l)>.9)toward++;}}
 assert.ok(toward/m2>=.8,`with the spot it peeked from 3.6 m away it backs toward it (${(toward/m2*100).toFixed(0)} % >= 80 %)`);
 out.push(`reload in sight: backing ${(back/n*100).toFixed(0)} % of ticks, toward the peek spot ${(toward/m2*100).toFixed(0)} %`);}
// 2. server: unsighted mid-reload with a remembered enemy close -> holds (no re-peek), pushes again once reloaded
{let held=0,n=0,moved=0,base=0;for(let k=0;k<6;k++){
  {const {s,t,b}=duo(k,{bx:-10,bz:10});WALL.on=true;B.memNote(b.mem||(b.mem=B.memNew()),t.id,0,0,-4,s.time,'seen');let go=0;for(let i=0;i<10;i++){const m=tick(s,b);if(Math.hypot(m[0],m[1])>.1)go++;}base+=go;}
  const {s,t,b}=duo(k,{bx:-10,bz:10});WALL.on=true;B.memNote(b.mem||(b.mem=B.memNew()),t.id,0,0,-4,s.time,'seen');b.ammo=0;b.reloadAt=s.time+1.5;
  for(let i=0;i<60;i++){const m=tick(s,b),l=Math.hypot(m[0],m[1]);if(b.reloadAt){n++;if(l<.05)held++;}else if(l>.1)moved++;}}
 assert.ok(base>=40,'the same bot not reloading pushes the contact ('+base+' moving ticks of 60)');
 assert.ok(n>150&&held/n>=.95,`unsighted mid-reload with a contact 16 m away it holds (${(held/n*100).toFixed(0)} % of ${n} ticks >= 95 %)`);
 assert.ok(moved>=60,'and pushes again once the magazine is back ('+moved+' moving ticks)');
 out.push(`reload unsighted: holds ${(held/n*100).toFixed(0)} %, then moves`);}
// 3. trading like a player
const nodes2=nodes,G2=(ray)=>({map:{attacker:[-20,0,20],defender:[20,0,-20],sites:{A:[-8,0,0],B:[8,0,0]}},nav:{nodes:nodes2,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:ray||(()=>1)});
{assert.equal(typeof B.TRADE,'object','BotBrain.TRADE');const P0=B.personality(B.hash('Bot Omen'));
 for(let k=0;k<40;k++)assert.equal(B.peek(P0,B.rng(k),{trade:true}),'wide','a trade is swung wide, never held / jiggled');
 for(let k=0;k<10;k++)assert.ok(['jiggle','hold'].includes(B.peek(P0,B.rng(k),{trade:true,sniper:true})),'except into an Operator');
 let slow=0;for(let k=0;k<30;k++){const a=B.reaction(P0,B.rng(k),{pre:true,off:.1}),b=B.reaction(P0,B.rng(k),{pre:true,off:.1,postKill:true});if(b>=a+B.TRADE.lag[0]-1e-9)slow++;}
 assert.equal(slow,30,'a killer\'s next fight right after its kill starts at least TRADE.lag late');
 let toKiller=0,trades=0,mem=0;for(let k=0;k<16;k++){const s=new SpikeSimulation(G2(),'five','ascent',B.rng(40+k)),v=s.add('Bot V'+k,'Sage',false),m=s.add('Bot M'+k,'Omen',false),kl=s.add('Killer','Jett',true),e2=s.add('Other','Raze',true);
  s.phase='game';s.round=2;s.atk=1;s.buy=0;Object.assign(v,{team:0,x:0,y:0,z:-10,alive:true,hp:100});Object.assign(m,{team:0,x:4,y:0,z:-10,alive:true,hp:100});
  Object.assign(kl,{team:1,x:0,y:0,z:-24,alive:true,hp:100});Object.assign(e2,{team:1,x:-6,y:0,z:-12,alive:true,hp:100});s.spike={st:'carry',carrier:kl.id,x:0,y:0,z:0,t:45,pt:0,dt:0,site:'A'};s.remaining=80;
  s.time=1;s.botSense();v.alive=false;v.hp=0;v.lastKiller=kl.id;s.time=1.05;s.botSense();
  if(m.react&&m.react.kind==='trade'){trades++;if(Math.hypot(m.react.x-kl.x,m.react.z-kl.z)<1.5)toKiller++;const c=m.mem&&m.mem.c[kl.id];if(c&&Math.hypot(c.x-kl.x,c.z-kl.z)<1.5)mem++;}}
 assert.ok(trades>=8,'most mates 4 m from a death go for the trade ('+trades+' of 16)');
 assert.equal(toKiller,trades,'the trade goes for the killer (killfeed), not the enemy nearest the body ('+toKiller+' of '+trades+')');
 assert.equal(mem,trades,'the trader knows the killer\'s spot (pre-aims it): '+mem+' of '+trades);
 // the trade swing: a trader clearing the corner onto the killer swings wide; the same bots without a trade draw their own mix
 const clear=(o,d,max)=>o[0]>.8?Infinity:1;let wide=0,styles=new Set();for(let k=0;k<12;k++)for(const tr of [true,false]){const s=new SpikeSimulation(G2(clear),'five','ascent',B.rng(70+k)),m=s.add('Bot P'+k,'Omen',false),kl=s.add('Killer','Jett',true);
  s.phase='game';s.round=2;s.atk=1;s.buy=0;s.time=5;Object.assign(m,{team:0,x:0,y:0,z:0,look:0,alive:true,hp:100,input:{forward:1}});Object.assign(kl,{team:1,x:0,y:0,z:-6,alive:true,hp:100});
  B.memNote(m.mem=B.memNew(),kl.id,0,0,-6,s.time,'heard');if(tr)m.react={kind:'trade',x:0,y:0,z:-6,until:s.time+3};const P=persona(s,m);s.peekMove(m,P);const st=m.pkSt&&m.pkSt.style;if(tr){if(st==='wide')wide++;}else if(st)styles.add(st);}
 assert.equal(wide,12,'a trader swings the corner wide ('+wide+' of 12)');assert.ok(styles.size>=2,'without a trade the peek mix stays ('+[...styles]+')');
 // the killer's attention: a kill stamps killAt; its next reaction inside TRADE.focus is later
 let late=0;for(let k=0;k<8;k++){const r=[];for(const pk of [false,true]){const {s,t,b}=duo(k);if(pk)b.killAt=s.time-.3;tick(s,b);r.push(b.reactionAt-b.engagedAt);}if(r[1]>=r[0]+B.TRADE.lag[0]-1e-6)late++;}
 assert.equal(late,8,'a fight 0.3 s after its kill reacts TRADE.lag later ('+late+' of 8)');
 {const {s,t,b}=duo(0);t.hp=1;t.armor=0;s.applyHit(b,t,'body',50,[0,1.6,0],[0,0,-1],12,null,{});assert.ok(!t.alive&&b.killAt===s.time,'a kill stamps the killer\'s killAt');}
 out.push(`trades: ${trades}/16 go, all for the killer with its spot known; trade peeks wide ${wide}/12; post-kill reaction later ${late}/8`);}
// 4. moving quietly near a known enemy
{assert.equal(typeof B.quiet,'function','BotBrain.quiet');const W=B.WALK.range;
 assert.equal(B.quiet({contactD:W-4}),true,'a contact inside WALK.range: walk');assert.equal(B.quiet({contactD:W+6}),false,'a far contact: run');assert.equal(B.quiet({contactD:null}),false,'nothing known: run');
 for(const k of ['see','trading','wide','carrier'])assert.equal(B.quiet({contactD:W-4,[k]:true}),false,k+': run');
 const run=(memD,extra)=>{const s=new SpikeSimulation(G2(),'five','ascent',B.rng(5)),b=s.add('Bot Sage','Sage',false),e=s.add('Enemy','Jett',true);
  s.phase='game';s.round=2;s.atk=1;s.buy=0;Object.assign(b,{team:0,x:16,y:0,z:-16,look:0,alive:true,hp:100});Object.assign(e,{team:1,x:-18,y:0,z:18,alive:true,hp:100});
  s.spike={st:'carry',carrier:e.id,x:0,y:0,z:0,t:45,pt:0,dt:0,site:'A'};s.remaining=80;s.time=30;if(extra)extra(s,b,e);let w=0,f=0;
  for(let i=0;i<20;i++){s.time+=.05;if(memD)B.memNote(b.mem||(b.mem=B.memNew()),e.id,b.x-memD*.7,0,b.z+memD*.7,s.time,'heard');s.bot(b);if(b.input.forward){f++;if(b.input.walk)w++;}}return [w,f];};
 const [w1,f1]=run(10),[w0,f0]=run(null),[w3,f3]=run(W+10),[wt,ft]=run(10,(s,b)=>{b.react={kind:'trade',x:-8,y:0,z:0,until:s.time+5};});
 assert.ok(f1>=15&&w1===f1,'a heard enemy 10 m away: it walks ('+w1+' of '+f1+' moving ticks)');assert.ok(f0>=15&&w0===0,'nothing known: it runs ('+w0+' of '+f0+')');
 assert.ok(w3===0,'a contact past WALK.range: it runs ('+w3+' of '+f3+')');assert.ok(ft>=15&&wt===0,'a trade is run ('+wt+' of '+ft+')');
 out.push(`quiet: walks ${w1}/${f1} ticks with a contact 10 m away, runs with none / far / trading`);}
console.log('Bot feel (server): '+out.join('; '));
