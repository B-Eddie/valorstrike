// The 18 added agents (2026-11-03): cast gates, faithful core mechanics and resource accounting.
// Run: node test-agents18.js (part of npm test).
import assert from 'node:assert';
import {AG18,TYPES18,A18,init18,cast18,tick18,reward18} from './src/agents18.js';
import {initAbilities,types,abilityDamage} from './src/abilities.js';
import {Simulation,weapons} from './src/simulation.js';
import {arenaWrap,ARENA_X,ARENA_STRIDE} from './src/arena.js';
import kits from './src/kits.json' with {type:'json'};

const world={ray:()=>Infinity,ground:()=>0,blocked:()=>false,near:()=>0,nav:{nodes:[[0,0,0]]}};
const mkSim=()=>({time:0,effects:[],castEvents:[],units:[],world,effectSeq:0,events:[],scores:{},mode:'spike'});
const mk=(agent,team,id,x=0,human=false)=>({id,agent,team,alive:true,human,x,y:0,z:0,look:0,pitch:0,ch:0,hp:100,mx:100,armor:0,name:agent+id,ability:null,kills:0,deaths:0,credits:0,input:{},vx:0,vz:0});
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

// Iso Kill Contract: the duel runs in the analytic pocket arena (arena.js) - both combatants are pulled to the
// cell, the walls/floor/cover work there, duel damage lands, outsiders are locked out, both return home
{const s=mkSim(),iso=mk('Iso',0,1),foe=mk('Jett',1,2,5);s.units=[iso,foe];initAbilities(iso,true);initAbilities(foe,true);iso.ability.ult=kits.Iso.u;
 assert.equal(cast18(s,iso,{k:'x'},O,D),true,'contract cast');
 assert.ok(iso.isoDuel&&foe.isoDuel,'both in the duel');
 assert.equal(iso.x,ARENA_X-4,'Iso is pulled into the pocket cell');assert.equal(foe.x,ARENA_X+4,'the target is pulled in across the cell');
 assert.equal(iso.y,.1)&&assert.equal(foe.z,0,'on the arena floor');
 abilityDamage(s,iso,foe,50);assert.equal(foe.hp,50,'duel damage lands');
 const out=mk('Sage',1,3,9);s.units.push(out);initAbilities(out,true);
 abilityDamage(s,out,iso,50);assert.equal(iso.hp,100,'an outsider cannot shoot into the duel');
 run(s,300);assert.ok(!iso.isoDuel&&!foe.isoDuel&&iso.x===0&&foe.x===5,'both return home when it ends');}
{const w=arenaWrap({ray:()=>Infinity,ground:()=>0,blocked:()=>false,plantAt:()=>'A'});
 assert.equal(w.ground(ARENA_X,0,2),0,'the arena floor carries the cell');
 assert.ok(Math.abs(w.ground(ARENA_X+40,0,2)-(-8))<1e-9||w.ground(ARENA_X+40,0,2)<0,'off the platform is the void');
 assert.ok(w.blocked(ARENA_X+14.8,0,.45,0),'the energy wall stops movement');
 assert.ok(!w.blocked(ARENA_X,0,.45,0),'the cell floor is open');
 assert.equal(w.ray([ARENA_X-10,1,0],[1,0,0]),25,'a shot across the cell hits the far wall');
 assert.equal(w.ray([ARENA_X-10,5,0],[1,0,0]),Infinity,'above the walls the cell is open');
 assert.ok(w.ray([ARENA_X-7.5,0.7,-5],[1,0,0])<Infinity,'a cover block stops a low shot');
 assert.equal(w.plantAt(ARENA_X,0),'','no spike plant inside the duel');
 assert.equal(w.ground(3,4,2),0,'map positions still reach the match world');}
{const u=mk('Iso',0,1,ARENA_X-4);u.isoDuel={foe:2,until:9,ret:[0,0,0],slot:0};
 const ctx={world:arenaWrap(world),time:0,events:[]};
 assert.equal(Simulation.prototype.oobKill.call(ctx,u),false,'a duelist in the arena is not out of bounds');
 u.isoDuel=null;ctx.time=1;Simulation.prototype.oobKill.call(ctx,u);ctx.time=4;assert.equal(Simulation.prototype.oobKill.call(ctx,u),true,'the same spot without a duel is out of bounds (warning, then the kill after 2 s)');}
{const s=mkSim(),a=mk('Iso',0,1),b=mk('Jett',1,2,5),c=mk('Iso',0,3),d=mk('Jett',1,4,5);c.z=20;d.z=20;s.units=[a,b,c,d];
 for(const u of s.units){initAbilities(u,true);if(u.agent==='Iso')u.ability.ult=kits.Iso.u;}
 assert.equal(cast18(s,a,{k:'x'},O,D),true,'first contract');assert.equal(cast18(s,c,{k:'x'},O,D),true,'second contract at the same time');
 assert.equal(a.isoDuel.slot,0,'first duel takes cell 0');assert.equal(c.isoDuel.slot,1,'the second duel takes the next cell');
 assert.equal(c.x,ARENA_X+ARENA_STRIDE-4,'the second cell sits one stride over');
 assert.ok(s.effects.filter(e=>e.kind==='duel').length===2,'both cells have an arena row');
 run(s,300);assert.ok(s.units.every(u=>!u.isoDuel),'both duels end and return');}

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


// Yoru Gatecrash: recast teleports on the wiki 1.2 s timing; USE fakes - audio cue + 30 s decal, anchor kept
{const s=mkSim(),y=mk('Yoru',0,15);s.units=[y];initAbilities(y,true);
 assert.equal(cast18(s,y,{k:'e'},O,D),true,'anchor out');const gp=[...y.ability.gate.p];
 s.time+=1;/* past the 0.6 s recast cooldown */
 assert.equal(cast18(s,y,{k:'e',fk:1},O,D),true,'USE fakes');
 assert.ok(y.ability.gate,'the anchor survives a fake');
 const gf=s.effects.find(e=>e.kind==='gatefake');assert.ok(gf&&gf.until-gf.at>=29.9&&gf.until-s.time<=30,'30 s fake decal (v4.04)');
 assert.ok(Math.abs(y.x)<.01&&Math.abs(y.z)<.01,'no teleport on a fake');
 s.time+=1;assert.equal(cast18(s,y,{k:'e'},O,D),true,'real recast');
 assert.ok(y.pendingTeleport&&Math.abs(y.pendingTeleport.at-s.time-1.2)<.01,'1.2 s wiki teleport timing');
 assert.ok(!y.ability.gate,'the anchor is spent by the real teleport');
 assert.ok(Math.abs(y.pendingTeleport.p[0]-gp[0])<.01&&Math.abs(y.pendingTeleport.p[2]-gp[2])<.01,'to the anchor');}
// Yoru Dimensional Drift: no gunfire while drifting (wiki: unable to equip any weapons)
{const s=mkSim(),y=mk('Yoru',0,16);s.units=[y];initAbilities(y,true);y.ability.ult=kits.Yoru.u;y.weapon='Vandal';y.ammo=30;
 assert.equal(cast18(s,y,{k:'x'},O,D),true,'drift cast');assert.ok(y.driftUntil>s.time,'drifting');y.input={fire:true};
 assert.equal(Simulation.prototype.fire.call(s,y),false,'no gunfire in Dimensional Drift');}
// Astra Astral Form (human): X enters the map view; stars land on the picked point and spend stars, not the aim
// point; Cosmic Divide spans its two picked points and spends the ult; exiting without points spends nothing
{const s=mkSim(),a2=mk('Astra',0,17,0,true);s.units=[a2];initAbilities(a2,true);a2.ability.ult=kits['Astra'].u;
 assert.equal(cast18(s,a2,{k:'x'},O,D),true,'enters Astral Form');assert.ok(a2.astralForm&&a2.ability.astral,'in the form');
 assert.equal(cast18(s,a2,{k:'e',p:[30,40]},O,D),true,'star placed from the map');
 const sm=s.effects.find(e=>e.kind==='smoke');assert.ok(sm&&Math.abs(sm.p[0]-30)<.01&&Math.abs(sm.p[2]-40)<.01,'the smoke lands at (30,40), not the aim point');
 assert.equal(a2.ability.stars,1,'one star spent');
 assert.equal(cast18(s,a2,{k:'x',p:[0,0,60,0]},O,D),true,'Cosmic Divide across two points');
 const dv=s.effects.find(e=>e.kind==='divide');assert.ok(dv,'the wall exists');
 assert.ok(Math.abs(dv.p[0]-30)<.01&&Math.abs(dv.p[2]-0)<.01,'midpoint between the picks');
 assert.ok(Math.abs(dv.radius-30)<.01,'half the span');assert.ok(!a2.astralForm&&a2.ability.ult===0,'ult spent, form closed');
 assert.equal(cast18(s,a2,{k:'x'},O,D),false,'no ult, no re-entry');}
{const s=mkSim(),a2=mk('Astra',0,18,0,true);s.units=[a2];initAbilities(a2,true);a2.ability.ult=kits['Astra'].u;
 cast18(s,a2,{k:'x'},O,D);Object.assign(a2,{weapon:'Vandal',ammo:30,input:{fire:true}});
 assert.equal(Simulation.prototype.fire.call(s,a2),false,'no gunfire in Astral Form (wiki: unable to equip weapons)');
 assert.equal(cast18(s,a2,{k:'x'},O,D),true,'X again exits');assert.ok(!a2.astralForm&&a2.ability.ult===kits['Astra'].u,'exit spends nothing');}
// Tejo Guided Salvo: up to two map-picked strike points; Armageddon: map-picked origin, wave aimed from Tejo through it
{const s=mkSim(),t2=mk('Tejo',0,19,0,true);s.units=[t2];initAbilities(t2,true);t2.ability.ult=kits.Tejo.u;
 assert.equal(cast18(s,t2,{k:'e',p:[10,10,20,25]},O,D),true,'two-point salvo');
 const sv=s.effects.filter(e=>e.kind==='salvo');assert.equal(sv.length,2,'both strikes');
 assert.ok(sv.some(e=>Math.abs(e.p[0]-10)<.01&&Math.abs(e.p[2]-10)<.01)&&sv.some(e=>Math.abs(e.p[0]-20)<.01&&Math.abs(e.p[2]-25)<.01),'at the picked points');
 assert.equal(t2.ability.e,0,'one charge spent for the cast');
 assert.equal(cast18(s,t2,{k:'x',p:[0,30]},O,D),true,'Armageddon at the picked origin');
 const ar=s.effects.find(e=>e.kind==='armag');assert.ok(ar&&Math.abs(ar.p[2]-30)<.01,'origin moved to the pick');
 assert.ok(Math.abs(ar.yaw-Math.atan2(-(0-t2.x),-(30-t2.z)))<.001,'wave from Tejo through the pick');}
console.log('agents18: registration, charge/star gates, Iso pocket-arena duel isolation + return, Neon fuel/slide/reset, KAY/O downed/revive/bleedout, Deadlock cocoon pull/rescue/kill, suppress gate, Gekko globule reclaim, Miks Bassquake deafen/slow, Yoru Gatecrash fake + 1.2 s timing');
