// The 18 added agents (2026-11-03): cast gates, faithful core mechanics and resource accounting.
// Run: node test-agents18.js (part of npm test).
import assert from 'node:assert';
import {AG18,TYPES18,A18,init18,cast18,tick18,reward18} from './src/agents18.js';
import {initAbilities,types,abilityDamage} from './src/abilities.js';
import {Simulation,weapons} from './src/simulation.js';
import kits from './src/kits.json' with {type:'json'};

const world={ray:()=>Infinity,ground:()=>0,blocked:()=>false,near:()=>0,nav:{nodes:[[0,0,0]]}};
const mkSim=()=>({time:0,effects:[],castEvents:[],units:[],world,effectSeq:0,events:[],scores:{},mode:'spike'});
const mk=(agent,team,id,x=0)=>({id,agent,team,alive:true,x,y:0,z:0,look:0,pitch:0,ch:0,hp:100,mx:100,armor:0,name:agent+id,ability:null,kills:0,deaths:0,credits:0,input:{},vx:0,vz:0});
const run=(sim,n,dt=.05)=>{for(let i=0;i<n;i++){sim.time+=dt;tick18(sim,dt);}};
const O=[0,1.6,0],D=[1,0,0];

// every one of the 18 is registered with kit data and a type map
for(const a of Object.keys(AG18)){assert.ok(kits[a],a+' in kits.json');assert.ok(types[a],a+' in types');assert.equal(types[a].length,3,a+' c/q/e types');}

// charge gates: no charge, no cast; a cast spends exactly one
{const s=mkSim(),u=mk('Brimstone',0,1);s.units=[u];initAbilities(u,true);u.ability.c=0;
 assert.equal(cast18(s,u,{k:'c'},O,D),false,'no charge, no cast');
 u.ability.c=3;assert.equal(cast18(s,u,{k:'c'},O,D),true,'cast lands');assert.equal(u.ability.c,2,'one charge spent');}

// Astra: 2 stars a round, casts spend stars not charges
{const s=mkSim(),u=mk('Astra',0,1);s.units=[u];initAbilities(u,true);
 assert.equal(u.ability.stars,2,'2 stars (wiki Stars)');
 assert.equal(cast18(s,u,{k:'e'},O,D),true);assert.equal(u.ability.stars,1,'star spent');
 assert.equal(cast18(s,u,{k:'c'},O,D),true);assert.equal(u.ability.stars,0);
 assert.equal(cast18(s,u,{k:'q'},O,D),false,'no stars, no cast');}

// Iso Kill Contract: walled 1v1 - duel damage lands, outsiders are locked out, both return home
{const s=mkSim(),iso=mk('Iso',0,1),foe=mk('Jett',1,2,5);s.units=[iso,foe];initAbilities(iso,true);initAbilities(foe,true);iso.ability.ult=kits.Iso.u;
 assert.equal(cast18(s,iso,{k:'x'},O,D),true,'contract cast');
 assert.ok(iso.isoDuel&&foe.isoDuel,'both in the duel');assert.equal(foe.x,2,'the target is pulled into the cell');
 abilityDamage(s,iso,foe,50);assert.equal(foe.hp,50,'duel damage lands');
 const out=mk('Sage',1,3,9);s.units.push(out);initAbilities(out,true);
 abilityDamage(s,out,iso,50);assert.equal(iso.hp,100,'an outsider cannot shoot into the duel');
 run(s,300);assert.ok(!iso.isoDuel&&!foe.isoDuel&&iso.x===0&&foe.x===5,'both return home when it ends');}

// Neon: High Gear drains fuel, ALT slides on a charge, 2 kills reset the slides
{const s=mkSim(),u=mk('Neon',0,4);s.units=[u];initAbilities(u,true);
 assert.equal(u.ability.fuel,A18.fuel.max,'full fuel');
 assert.equal(cast18(s,u,{k:'e'},O,D),true);run(s,20);
 assert.ok(u.ability.fuel<A18.fuel.max,'gear drains fuel');assert.ok(u.stimOn,'haste while geared');
 assert.equal(cast18(s,u,{k:'e',alt:true,f:1},O,D),true,'slide');assert.equal(u.ability.slides,0,'the one slide charge spent (wiki v9.11)');assert.equal(u.gearOn,false,'the slide ends High Gear');
 u.ability.slides=0;u.ability.slideKills=1;reward18(u,u.ability);assert.equal(u.ability.slides,1,'2 kills reset the slide');}

// KAY/O NULL/cmd: downed, bled out, or revived
{const s=mkSim(),k=mk('KAY/O',0,5),e=mk('Sage',1,6,3);s.units=[k,e];initAbilities(k,true);initAbilities(e,true);
 k.nullCmdUntil=s.time+10;k.hp=10;abilityDamage(s,e,k,50);
 assert.ok(k.kayoDown&&k.deaths===0,'downed, not dead (wiki NULL/cmd)');
 const ally=mk('Sage',0,7,k.x+1);ally.input={use:true};s.units.push(ally);initAbilities(ally,true);
 run(s,110);assert.ok(k.alive&&k.hp===100,'an ally channel revives him at 100');
 ally.input={};const k2=mk('KAY/O',0,9,50);s.units.push(k2);initAbilities(k2,true);k2.nullCmdUntil=s.time+1;k2.hp=5;
 abilityDamage(s,e,k2,50);run(s,310);assert.ok(!k2.alive&&k2.deaths===1,'the bleedout kills');
 const k3=mk('KAY/O',0,11,60);s.units.push(k3);initAbilities(k3,true);k3.nullCmdUntil=s.time+20;k3.hp=5;abilityDamage(s,e,k3,50);
 assert.equal(k3.kayoDown.hp,850,'850 HP core (wiki Downed Health)');
 Simulation.prototype.applyHit.call(s,e,k3,'body',400,[e.x,e.y+1.6,e.z],[1,0,0],2,2,weapons.Vandal);assert.ok(k3.kayoDown&&k3.kayoDown.hp===450,'the core takes gun damage');
 const u0=k3.kayoDown.until;const al2=mk('Sage',0,12,k3.x+1);al2.input={use:true};s.units.push(al2);initAbilities(al2,true);run(s,20);
 assert.ok(k3.kayoDown.until>u0,'stabilizing pauses the countdown (wiki)');al2.input={};
 Simulation.prototype.applyHit.call(s,e,k3,'body',500,[e.x,e.y+1.6,e.z],[1,0,0],2,2,weapons.Vandal);assert.ok(!k3.alive&&k3.deaths===1&&e.kills>0,'destroying the core kills with credit');}

// Deadlock Annihilate: 600 HP cocoon, the pull, the rescue, the kill
{const s=mkSim(),dl=mk('Deadlock',0,7),vic=mk('Jett',1,8,10);s.units=[dl,vic];initAbilities(dl,true);initAbilities(vic,true);dl.ability.ult=kits.Deadlock.u;
 assert.equal(cast18(s,dl,{k:'x'},O,D),true);assert.ok(vic.anni&&vic.anni.hp===600,'600 HP cocoon (wiki Annihilate)');
 const d0=Math.hypot(vic.x-dl.x);run(s,40);assert.ok(Math.hypot(vic.x-dl.x,vic.z-dl.z)<d0,'pulled toward Deadlock');
 vic.anni.hp=30;const mate=mk('Sage',1,11,20);s.units.push(mate);initAbilities(mate,true);
 abilityDamage(s,mate,vic,50);assert.ok(!vic.anni&&vic.tetheredUntil===0,'a teammate shoots the cocoon off');
 const dl2=mk('Deadlock',0,12),vic2=mk('Jett',1,13,-20);dl2.x=-30;s.units.push(dl2,vic2);initAbilities(dl2,true);initAbilities(vic2,true);dl2.ability.ult=kits.Deadlock.u;
 cast18(s,dl2,{k:'x'},O,D);run(s,160);assert.ok(!vic2.alive,'unrescued: the wire kills');}

// suppress locks the 18 out of casting (Vyse jam locks guns in spike.fire)
{const s=mkSim(),u=mk('Gekko',0,14);s.units=[u];initAbilities(u,true);u.ability.c=1;u.suppressUntil=s.time+5;
 assert.equal(cast18(s,u,{k:'c'},O,D),false,'suppressed: no cast');}

// Gekko globules: a used basic comes back after the reclaim window
{const s=mkSim(),u=mk('Gekko',0,15);s.units=[u];initAbilities(u,true);u.ability.c=1;
 cast18(s,u,{k:'c'},O,D);assert.equal(u.ability.c,0);run(s,Math.ceil((A18.mosh.life+1+A18.globule.reclaim)/.05)+10);
 assert.equal(u.ability.c,1,'globule reclaim returns the charge');}

// Miks Bassquake (wiki): 40 m 60 deg cone, 5 m knockback, 8 s deafen + slow
{const s=mkSim(),m=mk('Miks',0,13),e=mk('Jett',1,14,0);e.z=-10;s.units=[m,e];/* look 0 faces -z: the cone covers him */initAbilities(m,true);initAbilities(e,true);m.ability.ult=kits.Miks.u;
 assert.equal(cast18(s,m,{k:'x'},[m.x,m.y+1.6,m.z],[1,0,0]),true,'Bassquake cast');run(s,30);
 assert.ok(e.deafenUntil>s.time,'deafened 8 s');assert.ok(e.hinderUntil>s.time,'slowed 8 s');}

console.log('agents18: registration, charge/star gates, Iso duel isolation + return, Neon fuel/slide/reset, KAY/O downed/revive/bleedout, Deadlock cocoon pull/rescue/kill, suppress gate, Gekko globule reclaim');
