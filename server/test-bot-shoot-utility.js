// Bots shoot down destroyable enemy utility (qa-20): spike.js shootUtility + vendor/bot-brain.cjs shootUtility, with the
// device HP of devices.js SHOOT (wiki 'Health': Boom Bot 60, Turret 100, Alarmbot 20, Trademark 20, Nanoswarm 20,
// Trapwire 20, Chamber's Rendezvous anchor 50) and the Sage Barrier (600). Real bullets: the bot only aims and pulls the trigger; traceShot / shotImpact
// take the HP off. A barrier is shot only when it stands across the bot's way; with an enemy in sight the fight wins.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {SHOOT,nearestDevice,damageDevice} from './src/devices.js';
import BotBrain from '../vendor/bot-brain.cjs';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
// 1. Shared decision: threats first, range / line of sight, a barrier only when blocking.
{const S=BotBrain.shootUtility;
 assert.equal(S([]),null);
 assert.equal(S([{kind:'barrier',d:6,los:true,blocking:false}]),null,'a barrier off the way is walked around');
 assert.equal(S([{kind:'barrier',d:6,los:true,blocking:true}]).kind,'barrier','a barrier across the way is shot');
 assert.equal(S([{kind:'barrier',d:15,los:true,blocking:true}]),null,'not from beyond 14 m');
 assert.equal(S([{kind:'turret',d:20,los:false}]),null,'needs a line of sight');
 assert.equal(S([{kind:'barrier',d:3,los:true,blocking:true},{kind:'turret',d:25,los:true},{kind:'alarmbot',d:5,los:true}]).kind,'turret','turret before trap devices and barrier');
 assert.equal(S([{kind:'turret',d:10,los:true},{kind:'boombot',d:12,los:true}]).kind,'boombot','an incoming Boom Bot first');
 assert.equal(S([{kind:'alarmbot',d:13,los:true}]),null,'trap devices within 12 m');
 assert.equal(S([{kind:'trapwire',d:8,los:true},{kind:'trademark',d:4,los:true}]).kind,'trademark','same priority: the nearer');
 assert.deepEqual(Object.fromEntries(Object.entries(SHOOT).map(([k,v])=>[k,v.hp])),{rdvanchor:50,hunter:150,boombot:60,turret:100,alarmbot:20,trademark:20,nanoswarm:20,trapwire:20,blastpack:20,spycam:1,owl:100},'wiki device HP');}
const mk=(agent='Jett')=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5);const b=s.add('bot','Jett',false),kj=s.add('kj',agent);s.start(false);s.buy=0;s.roundDelay=0;
 Object.assign(b,{x:0,y:0,z:0,look:0,pitch:0,weapon:'Vandal',ammo:25,reserve:50,fireAt:0,alive:true,hp:100});if(b.team===kj.team){kj.team=1-b.team;}Object.assign(kj,{x:40,y:0,z:40,alive:true});return {s,b,kj};};
const run=(s,b,sec,goal)=>{for(let i=0;i<sec*20;i++){s.time+=.05;if(s.shootUtility(b,goal)&&b.input.fire)s.fire(b);if(s.time>=b.reloadAt&&b.reloadAt)s.finishReload(b);}};
// 2. Each enemy device: the bot turns onto it and shoots it down with its gun.
for(const [kind,p,extra] of [['turret',[3,0,-10],{at:0,yaw:0}],['alarmbot',[-2,0,-7],{chase:null}],['trademark',[1,0,-8],{spotted:0,armAt:0}],['nanoswarm',[0,0,-5],{armed:false}],['boombot',[2,.2,-9],{yaw:0}],['trapwire',[-3,0,-8],{q:[3,0,-8],armAt:0}]]){
 const {s,b,kj}=mk();s.effects.push({id:7,kind,owner:kj.id,team:kj.team,p,until:s.time+60,radius:3,hp:SHOOT[kind].hp,...extra});
 s.shootUtility(b,null);assert.equal(b.utilShot?.kind,kind,kind+' picked');run(s,b,4,null);
 assert.ok(!s.effects.some(e=>e.id===7),kind+' destroyed by the bot\'s gunfire');assert.ok(b.ammo<25,kind+': bullets were fired');}
// 3. Own team's devices are not shot (nor hit by its bullets).
{const {s,b}=mk();s.effects.push({id:8,kind:'turret',owner:b.id,team:b.team,p:[0,0,-10],until:s.time+60,hp:100,at:0});assert.equal(s.shootUtility(b,null),false,'own turret ignored');
 assert.equal(nearestDevice(s,[0,.45,0],[0,0,-1],50,b),null,'own device not in the way of its bullets');}
// 4. Sage Barrier: shot only when across the way to the goal, broken by the gunfire, then the bot moves on.
{const {s,b,kj}=mk('Sage');s.effects.push({id:9,kind:'barrier',owner:kj.id,team:kj.team,p:[0,0,-6],yaw:0,hp:600,until:s.time+40});
 assert.equal(s.shootUtility(b,[20,0,0]),false,'goal off to the side: walk around, no shooting');
 assert.equal(s.shootUtility(b,[0,0,-30]),true,'barrier across the line to the goal');assert.equal(b.utilShot.kind,'barrier');
 run(s,b,8,[0,0,-30]);const w=s.effects.find(e=>e.id===9);assert.ok(!(w.hp>0)&&w.until<=s.time,'barrier broken: '+w.hp);
 s.time+=.05;assert.equal(s.shootUtility(b,[0,0,-30]),false,'a broken barrier is not shot again');}
// 5. A barrier on the bot's route (not the straight line) counts as across its way.
{const {s,b,kj}=mk('Sage');s.world.nav={nodes:[[0,0,0],[6,0,-6],[0,0,-30]],adj:[[1],[0,2],[1]]};s.effects.push({id:10,kind:'barrier',owner:kj.id,team:kj.team,p:[4,0,-4],yaw:-Math.PI/4,hp:600,until:s.time+40});
 b.route=[0,1,2];assert.equal(s.barrierAcross(b,s.effects[0],[-10,0,-30]),true,'route through the wall');b.route=null;assert.equal(s.barrierAcross(b,s.effects[0],[-10,0,-30]),false,'straight line clear of it');}
// 6. An enemy in sight wins: the full bot step fights instead of shooting the device.
{const {s,b,kj}=mk();s.effects.push({id:11,kind:'alarmbot',owner:kj.id,team:kj.team,p:[0,0,-6],until:s.time+60,hp:20,chase:null});Object.assign(kj,{x:0,y:0,z:-15});
 s.bot(b);assert.ok(!b.utilShot,'fighting the visible enemy, not the device');assert.ok(b.sawTarget);}
// 7. Full simulation steps: a bot with no enemy in sight destroys an enemy Turret in front of it.
{const {s,b,kj}=mk();Object.assign(kj,{x:60,z:60});s.effects.push({id:12,kind:'turret',owner:kj.id,team:kj.team,p:[0,0,-12],until:s.time+60,hp:100,at:0,yaw:0});s.canSee=()=>false;
 for(let i=0;i<120&&s.effects.some(e=>e.id===12);i++)s.step(.05);assert.ok(!s.effects.some(e=>e.id===12),'turret destroyed in the real step loop');}
// 8. damageDevice: removal at 0 HP only.
{const s={effects:[]},e={kind:'alarmbot',hp:20};s.effects.push(e);assert.equal(damageDevice(s,e,15),false);assert.equal(e.hp,5);assert.equal(damageDevice(s,e,9),true);assert.equal(s.effects.length,0);}
console.log('Bots shoot utility: shared priority (Boom Bot > Lockdown > Turret > trap devices > Nanoswarm > blocking barrier), wiki device HP, each device destroyed by real bot gunfire, own devices ignored, barrier only across the way (line or route) and broken, a visible enemy wins, full step loop');
