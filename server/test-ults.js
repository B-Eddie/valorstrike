// Server-authoritative ultimates (ledger row 9): Hunter's Fury, Showstopper, Lockdown, Rolling Thunder,
// Seekers, Neural Theft, Tour de Force and Run It Back replace the old shared 100-damage blast.
// Intents carry no trusted origin/aim/target; everything comes from server state.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,SMOKE,smokeBlocks} from './src/abilities.js';import {ULT} from './src/ults.js';import {floorTick} from './src/floor.js';
let wall=Infinity;const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:(o,d,max=Infinity)=>{if(!(d[2]<0)||!Number.isFinite(wall))return Infinity;const t=(o[2]+wall)/-d[2];return t>=0&&t<=max?t:Infinity;}};// wall: a plane at z=-wall
const setup=(agent,...others)=>{wall=Infinity;const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add(agent,agent),list=others.map(([n,team])=>{const v=s.add(n);return v;});s.start(false);s.buy=0;s.roundDelay=0;
 Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});for(const v of list){Object.assign(v,{armor:0,hp:100,protectedUntil:0});}
 // force teams: every 'foe*' opposes u, 'mate*' shares u's team
 for(const v of list)v.team=v.name.startsWith('mate')?u.team:1-u.team;return {s,u,list};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const cast=(s,u,m={})=>s.command(u,{t:'ab',k:'x',...m});
// Showstopper: X equips the launcher (wiki 1.4 s), FIRE shoots the rocket
const rocket=(s,u,m={})=>{const ok=cast(s,u,m);if(!ok)return ok;s.time+=ULT.rocket.equip;return s.fire(u);};

// Hunter's Fury: unearned ult rejected; three wall-piercing 80-damage blasts on the server aim (first now,
// then every 2 s, recast early after 0.9 s); hit enemies are revealed to Sova's team; spoofed aim ignored.
{const {s,u,list:[foe,side,mate]}=setup('Sova',['foe'],['foeSide'],['mate']);Object.assign(foe,{x:0,y:0,z:-40});Object.assign(side,{x:6,y:0,z:-20});Object.assign(mate,{x:0,y:0,z:-10});
 assert.equal(cast(s,u),false,'no unearned ult');u.ability.ult=9;wall=5;
 assert.equal(cast(s,u,{o:[0,0,-40],d:[1,0,0],p:[6,-20]}),true);assert.equal(u.ability.ult,0);assert.equal(foe.hp,20,'first blast pierces the wall');assert.equal(side.hp,100,'off-line enemy untouched');assert(Math.abs(mate.hp-(100-80/3))<1e-6,'ally on the line takes a third (VALORANT friendly fire 1/3): '+mate.hp);
 const rs=s.roundState(mate);assert.deepEqual(rs.rv.map(r=>r[0]),[foe.id],'hit enemy revealed to the team (the hit ally is not)');assert.equal(mate.kills,0);assert.equal(u.kills,0);assert.equal(s.roundState(foe).rv.length,0);
 s.time+=.35;assert.equal(cast(s,u),true,'recast consumed');assert.equal(foe.hp,20,'recast too soon does not fire');tick(s,.7);assert.equal(cast(s,u),true);assert.equal(foe.alive,false,'second blast kills');
 assert.equal(u.ability.fury.left,1);u.look=Math.atan2(-6,20);foe.alive=true;foe.hp=100;tick(s,2.05);assert.equal(u.ability.fury,null,'channel ends after three blasts');assert.equal(side.hp,20,'auto blast follows the current aim');
 tick(s,10);assert.equal(cast(s,u),false,'no free blasts after the channel');}
{const {s,u,list:[foe]}=setup('Sova',['foe']);Object.assign(foe,{x:0,y:0,z:-30});u.ability.ult=9;cast(s,u);u.alive=false;tick(s,.1);assert.equal(u.ability.fury,null,'death ends Hunter\'s Fury');tick(s,3);assert.equal(foe.hp,20);}

// Showstopper (wiki): X equips a launcher (1.4 s equip, 10 s max including it); FIRE before the equip does nothing and
// never fires the gun; after it the one rocket leaves along the server aim; unfired, the launcher goes away after 10 s.
{const {s,u,list:[foe]}=setup('Raze',['foe']);Object.assign(foe,{x:0,y:.6,z:-15});Object.assign(u,{weapon:'Vandal',ammo:25});u.ability.ult=9;
 assert.equal(cast(s,u),true);assert.equal(u.ability.ult,0,'ult spent on equip');assert.equal(s.effects.some(e=>e.kind==='rocket'),false,'no rocket on equip');assert(u.showstopper);
 assert.equal(cast(s,u),false,'second X while the launcher is out');s.time+=1.3;assert.equal(s.fire(u),false,'launcher still coming up at 1.3 s');assert.equal(u.ammo,25,'gun not fired');assert.equal(s.effects.some(e=>e.kind==='rocket'),false);
 s.time+=.1;u.look=Math.PI/2;assert.equal(s.fire(u),true,'rocket at 1.4 s');const r=s.effects.find(e=>e.kind==='rocket');assert(r);assert(r.d[0]<-.99,'rocket follows the server aim at FIRE');assert.equal(u.showstopper,null);assert.equal(u.ammo,25);
 u.triggerHeld=false;assert.equal(s.fire(u),true,'next FIRE is the gun again');assert.equal(u.ammo,24);assert.equal(s.effects.filter(e=>e.kind==='rocket').length,1);}
{const {s,u,list:[foe]}=setup('Raze',['foe']);u.ability.ult=9;cast(s,u);tick(s,9.9);assert(u.showstopper,'launcher still out at 9.9 s');tick(s,.15);assert.equal(u.showstopper,null,'put away after 10 s');s.time+=.1;u.ammo=5;s.fire(u);assert.equal(s.effects.some(e=>e.kind==='rocket'),false,'no rocket after the window');}
{const {s,u,list:[foe]}=setup('Raze',['foe']);u.ability.ult=9;cast(s,u);u.alive=false;tick(s,.05);assert.equal(u.showstopper,null,'death drops the launcher');}
// Showstopper rocket: a travelling rocket; impact on a body deals 150 at the centre with falloff to 7 m and LOS;
// a wall detonates it early; allies take a third (VALORANT friendly fire 1/3).
{const {s,u,list:[foe,near,mate,hidden]}=setup('Raze',['foe'],['foeNear'],['mate'],['foeHidden']);Object.assign(foe,{x:0,y:.6,z:-15});Object.assign(near,{x:5.5,y:.6,z:-15});Object.assign(mate,{x:-1,y:.6,z:-15});Object.assign(hidden,{x:0,y:.6,z:-60});
 u.ability.ult=9;assert.equal(rocket(s,u,{d:[0,1,0]}),true);assert.equal(foe.hp,100,'rocket travels, no instant damage');tick(s,.25);assert.equal(foe.hp,100);tick(s,.4);
 assert.equal(foe.alive,false,'direct hit kills');assert.ok(near.hp>0&&near.hp<100,'splash falls off with distance: '+near.hp);assert.ok(mate.alive&&mate.hp<100&&mate.hp>=50,'ally beside the impact takes a third: '+mate.hp);assert.equal(hidden.hp,100);assert.equal(s.effects.some(e=>e.kind==='rocket'),false);}
{const {s,u,list:[foe]}=setup('Raze',['foe']);Object.assign(foe,{x:0,y:.6,z:-20});u.ability.ult=9;wall=6;rocket(s,u);tick(s,.5);assert.equal(foe.hp,100,'wall stops the rocket short');assert.equal(s.effects.some(e=>e.kind==='rocket'),false);}

// Lockdown: 13 s windup, then every enemy within 32.5 m is detained for 8 s (no guns, no abilities, slowed);
// it clears on the next round.
{const {s,u,list:[foe,far]}=setup('Killjoy',['foe'],['foeFar']);Object.assign(foe,{x:20,y:0,z:-10,weapon:'Vandal',ammo:25,agent:'Jett'});Object.assign(far,{x:0,y:0,z:-60});u.ability.ult=9;
 assert.equal(cast(s,u),true);tick(s,12.5);assert.ok(!(foe.detainUntil>s.time),'windup');tick(s,.7);assert.ok(foe.detainUntil>s.time,'detained in radius');assert.ok(!(far.detainUntil>s.time),'outside radius free');
 assert.equal(s.fire(foe),false,'detained cannot fire');foe.ability.ult=9;assert.equal(cast(s,foe),false,'detained cannot cast');assert.ok(s.roundState(foe).status.detain>7);assert.ok(foe.slowUntil>s.time);
 tick(s,8.1);foe.fireAt=0;foe.triggerHeld=false;assert.equal(s.fire(foe),true,'detain expires');s.newRound();assert.equal(foe.detainUntil,0);}

// Rolling Thunder: after 0.9 s, a forward 18 m cone concusses enemies through walls; behind and out of cone are spared.
{const {s,u,list:[a,b,c,mate]}=setup('Breach',['foeIn'],['foeWide'],['foeBehind'],['mate']);Object.assign(a,{x:2,y:0,z:-12});Object.assign(b,{x:14,y:0,z:-6});Object.assign(c,{x:0,y:0,z:6});Object.assign(mate,{x:0,y:0,z:-5});wall=1;u.ability.ult=9;
 assert.equal(cast(s,u),true);tick(s,.5);assert.ok(!(a.concussUntil>s.time));tick(s,.5);assert.ok(a.concussUntil>s.time+5,'concussed through the wall for 6 s');assert.ok(!(b.concussUntil>s.time));assert.ok(!(c.concussUntil>s.time));assert.ok(!(mate.concussUntil>s.time));}

// Seekers: the three nearest living enemies are nearsighted when their seeker arrives; a fourth is not.
{const {s,u,list}=setup('Skye',['foe1'],['foe2'],['foe3'],['foe4']);list.forEach((v,i)=>Object.assign(v,{x:0,y:0,z:-(6+i*10)}));u.ability.ult=9;assert.equal(cast(s,u),true);assert.equal(s.effects.filter(e=>e.kind==='seeker').length,3);
 tick(s,.4);assert.ok(!(list[0].nearsightUntil>s.time),'travel time');tick(s,3);for(const v of list.slice(0,3))assert.ok(v.nearsightUntil>s.time,'seeker hits '+v.name);assert.ok(!(list[3].nearsightUntil>s.time));}

// Neural Theft: needs a visible enemy corpse within 5 m in front (ult points kept otherwise); reveals all living enemies twice
// (wiki: 1st reveal after a 2 s windup, the 2nd 4 s after it).
{const {s,u,list:[corpse,alive1,alive2]}=setup('Cypher',['foeDead'],['foeA'],['foeB']);Object.assign(corpse,{x:0,y:0,z:-3});Object.assign(alive1,{x:30,y:0,z:-30});Object.assign(alive2,{x:-30,y:0,z:-30});u.ability.ult=9;
 assert.equal(cast(s,u),false,'no corpse');assert.equal(u.ability.ult,9);corpse.alive=false;u.look=Math.PI;assert.equal(cast(s,u),false,'corpse behind');u.look=0;wall=1;assert.equal(cast(s,u),false,'corpse behind a wall');wall=Infinity;
 assert.equal(cast(s,u),true);assert.equal(u.ability.ult,0);tick(s,1.9);assert.equal(s.roundState(u).rv.length,0,'nothing before 2 s');tick(s,.2);assert.equal(s.roundState(u).rv.length,2,'first reveal at 2 s');tick(s,1.6);assert.equal(s.roundState(u).rv.length,0);tick(s,2.1);assert.equal(s.roundState(u).rv.length,0,'nothing before 6 s');tick(s,.25);assert.equal(s.roundState(u).rv.length,2,'second reveal at 6 s');}

// Tour de Force: the gun becomes a 5-round Operator; spent, swapped away or dead, the previous weapon returns.
{const {s,u,list:[foe]}=setup('Chamber',['foe']);Object.assign(foe,{x:0,y:0,z:-6,hp:1000,armor:0});u.weapon='Spectre';u.ammo=17;u.reserve=60;u.ability.ult=9;
 assert.equal(cast(s,u),true);assert.equal(u.weapon,'Operator');assert.equal(u.ammo,5);assert.equal(cast(s,u),false,'no stacking');
 for(let i=0;i<5;i++){s.time+=2;u.fireAt=0;u.triggerHeld=false;u.input={ads:1};assert.equal(s.fire(u),true);}assert.ok(foe.hp<1000,'Operator hits');tick(s,.05);assert.equal(u.weapon,'Spectre');assert.equal(u.ammo,17);assert.equal(u.reserve,60);assert.equal(u.inventory.Operator,undefined);
 u.ability.ult=9;cast(s,u);u.alive=false;tick(s,.05);assert.equal(u.weapon,'Spectre','death returns the saved gun');}
// Round reset mid-ult (native maps, online): the round's own loadout comes back, no Operator, ult state cleared.
{const {s,u}=setup('Chamber',['foe']);u.primary='Spectre';u.weapon='Spectre';u.ammo=11;u.reserve=40;u.inventory={Spectre:11,Classic:12};u.ability.ult=9;
 assert.equal(cast(s,u),true);assert.equal(u.weapon,'Operator');s.newRound();assert.equal(u.weapon,'Spectre','round start re-arms the primary');assert.equal(u.ammo,30,'full Spectre magazine');assert.equal(u.ultWeapon,null);assert.equal(u.inventory.Operator,undefined);
 s.buy=0;u.primary=null;u.weapon='Classic';u.ammo=12;u.ability.ult=9;assert.equal(cast(s,u),true);s.newRound();assert.equal(u.weapon,'Classic','Classic-only Chamber gets the Classic back');assert.equal(u.ultWeapon,null);}

// Run It Back: dying (or the 10 s window ending) returns Phoenix to the mark at full health; his team is not
// eliminated by that death.
{const {s,u,list:[foe]}=setup('Phoenix',['foe']);Object.assign(foe,{x:0,y:0,z:-30});u.hp=40;u.ability.ult=9;assert.equal(cast(s,u),true);assert.equal(cast(s,u),false);
 u.x=10;u.z=-10;u.hp=0;u.alive=false;s.step(.05);assert.equal(s.roundDelay,0,'round continues while Run It Back is pending');tick(s,.05);assert.equal(u.alive,true);assert.equal(u.hp,100);assert.deepEqual([u.x,u.z],[0,0]);assert.equal(u.runItBack,null);
 u.ability.ult=9;s.time+=.5;assert.equal(cast(s,u),true);u.x=7;u.hp=55;tick(s,ULT.rib.window+.1);assert.deepEqual([u.x,u.hp],[0,100],'window end returns to the mark');}
// Run It Back death drops nothing (soak, ults scenario): the death drop handed Phoenix's rifle to the floor and he came
// back without it; a round that ends while he is down does not strip his gear either.
{const {s,u,list:[foe]}=setup('Phoenix',['foe']);Object.assign(foe,{x:0,y:0,z:-30});Object.assign(u,{primary:'Vandal',weapon:'Vandal',ammo:25,armor:50});u.ability.ult=9;assert.equal(cast(s,u),true);
 u.hp=0;u.alive=false;floorTick(s);/* as in a step: killed in the unit loop, floor drops after it */assert.equal((s.floor||[]).length,0,'no gun dropped for a returning Phoenix');s.step(.05);assert.equal(u.alive,true);assert.equal(u.primary,'Vandal','back with his rifle');
 u.ability.ult=9;s.time+=.5;assert.equal(cast(s,u),true);u.hp=0;u.alive=false;s.finishRound(1-u.team,'QA');assert.equal(u.primary,'Vandal','round end keeps a pending Phoenix\'s gun');assert.equal(u.armor,50);}
// A leaver's utility goes to the seat bot (soak, ults scenario): kills by a turret / rocket whose owner left were not
// recorded (no kill event, score, credits or ult point). Tour de Force moves with the body instead of leaving a free Operator.
{const {s,u,list:[foe]}=setup('Raze',['foe']);Object.assign(foe,{x:0,y:0,z:-12,hp:1,armor:0});u.ability.ult=9;assert.equal(rocket(s,u),true);const rk=s.effects.find(e=>e.kind==='rocket');assert(rk);
 const b=s.add('Bot Raze','Raze',false);b.team=u.team;s.units=s.units.filter(v=>v!==u);assert.equal(s.takeOver(b,u),true);assert.equal(rk.owner,b.id,'rocket now the seat bot\'s');
 const k0=b.kills,c0=b.credits;tick(s,1);assert.equal(foe.alive,false,'rocket kill');assert.equal(b.kills,k0+1,'kill credited to the seat bot');assert.equal(b.credits,c0+200);assert(s.events.some(e=>e[0]==='k'&&e[1]===b.name&&e[2]===foe.name),'kill event');}
{const {s,u,list:[foe]}=setup('Chamber',['foe']);Object.assign(foe,{x:0,y:0,z:-30});Object.assign(u,{primary:'Spectre',weapon:'Spectre',ammo:30});u.ability.ult=9;assert.equal(cast(s,u),true);assert.equal(u.weapon,'Operator');
 const b=s.add('Bot Chamber','Chamber',false);b.team=u.team;s.units=s.units.filter(v=>v!==u);s.takeOver(b,u);assert.equal(b.weapon,'Operator');assert(b.ultWeapon,'Tour de Force state moved');b.ammo=0;tick(s,.05);assert.equal(b.weapon,'Spectre','Operator spent: the Spectre comes back');}
// Utility whose unit left with no seat bot: its kill still reaches the feed (no credit), and a joiner on that team takes it over.
{const {s,u,list:[foe]}=setup('Raze',['foe']);Object.assign(foe,{x:0,y:0,z:-12,hp:1,armor:0});u.ability.ult=9;rocket(s,u);const rk=s.effects.find(e=>e.kind==='rocket');s.units=s.units.filter(v=>v!==u);
 const j=s.add('Joiner');assert.equal(j.team,rk.team);assert.equal(rk.owner,j.id,'joiner owns the orphaned rocket');tick(s,1);assert.equal(foe.alive,false);assert(s.events.some(e=>e[0]==='k'&&e[1]===j.name&&e[2]===foe.name));}
{const {s,u,list:[foe]}=setup('Raze',['foe']);Object.assign(foe,{x:0,y:0,z:-12,hp:1,armor:0});u.ability.ult=9;rocket(s,u);s.units=s.units.filter(v=>v!==u);tick(s,1);assert.equal(foe.alive,false);assert(s.events.some(e=>e[0]==='k'&&e[1]==='Raze'&&e[2]===foe.name&&e[4]==='Ability'),'ownerless kill in the feed, credited to the utility\'s agent');assert.equal(s.fxSrc,null,'no stale effect source after the tick (a later owner-less direct kill must not borrow it)');}
// Detain survives a disconnect: the seat bot inherits the leaver's statuses.
{const {s,u}=setup('Jett',['foe']);u.detainUntil=s.time+5;const b=s.add('Bot Jett','Jett',false);b.team=u.team;s.takeOver(b,u);assert(b.detainUntil>s.time,'still detained');}
console.log('Ultimates: Hunter\'s Fury (3 wall-piercing blasts, recast, reveal, death end), Showstopper (1.4 s launcher equip, FIRE shoots, 10 s window, travelling rocket, falloff, LOS, wall detonation), Lockdown (windup, radius detain blocks guns/abilities, round reset), Rolling Thunder (cone through walls), Seekers (3 nearest), Neural Theft (corpse targeting, reveals at 2 s and 6 s), Tour de Force (5-round Operator, weapon restore, round reset), Run It Back (death/expiry return, no elimination, no death drop, gear kept at round end); leaver utility/ult state moves to the seat bot; server-side aim only');
// Devices that used to be inert markers: recon pulses reveal enemies in the bolt's sight (not through walls),
// Boom Bot hunts the nearest visible enemy and explodes for 125, Trailblazer concusses on contact.
import {DEV} from './src/devices.js';
{const {s,u,list:[seen,hidden,far]}=setup('Sova',['foeSeen'],['foeHidden'],['foeFar']);u.ability.e=1;Object.assign(seen,{x:3,y:0,z:-14});Object.assign(hidden,{x:-3,y:0,z:-30});Object.assign(far,{x:0,y:0,z:-60});wall=20;
 assert.equal(s.command(u,{t:'ab',k:'e'}),true);const bolt=s.effects.find(e=>e.kind==='recon');assert.ok(bolt&&Math.abs(bolt.p[2]+19.97)<.05,'bolt lands on the wall at the server aim (full-charge flight, vendor/sova-bolt.cjs)');tick(s,.5);assert.equal(s.roundState(u).rv.length,0,'first pulse not yet');tick(s,.9);/* 0.4 s flight + 0.9 s first pulse */
 assert.deepEqual(s.roundState(u).rv.map(r=>r[0]),[seen.id],'pulse reveals only what the bolt sees');const first=seen.revealedUntil;tick(s,1.6);assert.ok(seen.revealedUntil>first+1,'second pulse refreshes the reveal');assert.ok(!(hidden.revealedUntil>0)&&!(far.revealedUntil>0));}
{const {s,u,list:[foe,mate]}=setup('Raze',['foe'],['mate']);u.ability.c=1;Object.assign(foe,{x:4,y:0,z:-7});Object.assign(mate,{x:-30,y:0,z:0});
 assert.equal(s.command(u,{t:'ab',k:'c'}),true);assert.ok(s.effects.some(e=>e.kind==='boombot'));tick(s,2.5);assert.equal(foe.alive,false,'Boom Bot hunts and kills (125)');assert.equal(mate.hp,100);assert.ok(!s.effects.some(e=>e.kind==='boombot'));}
{const {s,u,list:[foe]}=setup('Skye',['foe']);u.ability.q=1;Object.assign(foe,{x:0,y:0,z:-10});assert.equal(s.command(u,{t:'ab',k:'q'}),true);tick(s,1.5);assert.ok(foe.concussUntil>s.time,'Trailblazer concusses');assert.ok(!s.effects.some(e=>e.kind==='trail'));}
console.log('Devices: recon pulses reveal by line of sight (two pulses), Boom Bot seeks and explodes, Trailblazer concusses');
// Row 9 device parity: Phoenix (Blaze, Hot Hands, Curveball), Killjoy (Nanoswarm, Alarmbot, Turret arc),
// Cypher (Trapwire, Cyber Cage), Chamber (Trademark, Headhunter weapon restore).
import {sightClear,abilityDamage} from './src/abilities.js';
const ab=(s,u,k,m={})=>{s.time+=.5;return s.command(u,{t:'ab',k,...m});};
// Blaze: fire wall along the aim, cut short at walls; burns enemies, heals Phoenix inside it, blocks sight.
{const {s,u,list:[foe]}=setup('Phoenix',['foe']);u.ability.c=1;Object.assign(foe,{x:.3,y:0,z:-6});
 assert.equal(ab(s,u,'c'),true);const b=s.effects.find(e=>e.kind==='blaze');assert.ok(b&&Math.abs(b.q[2]+12)<.01,'12 m wall along the aim');
 u.z=-3;u.hp=50;tick(s,1);assert.ok(Math.abs(foe.hp-70)<1,'30/s to enemies in the wall: '+foe.hp);assert.ok(Math.abs(u.hp-62.5)<1,'heals Phoenix 12.5/s: '+u.hp);
 assert.equal(sightClear(s,[-3,1.6,-6],[3,1.6,-6]),false,'wall blocks sight');assert.equal(sightClear(s,[-3,4,-6],[3,4,-6]),true,'not above it');
 wall=5;u.z=0;u.ability.c=1;s.effects=[];ab(s,u,'c');assert.ok(s.effects.find(e=>e.kind==='blaze').q[2]>-5,'stops at a wall');}
// Hot Hands: burns enemies and heals Phoenix standing in his own fire.
{const {s,u,list:[foe]}=setup('Phoenix',['foe']);u.ability.q=1;Object.assign(foe,{x:1,y:0,z:-14});assert.equal(ab(s,u,'q'),true);u.z=-14;u.hp=40;tick(s,1);
 assert.ok(foe.hp<65,'Hot Hands burns: '+foe.hp);assert.ok(Math.abs(u.hp-52.5)<1,'self-heal: '+u.hp);}
// Curveball: bends right (or left) and pops beside the corner after a windup, not at the crosshair.
{const {s,u,list:[victim]}=setup('Phoenix',['foe']);Object.assign(victim,{x:2.5,y:0,z:-9,look:Math.PI});assert.equal(ab(s,u,'e'),true);const f=s.effects.find(e=>e.kind==='flash');assert.ok(f.p[0]>2&&Math.abs(f.p[2]+5)<.01,'right curve');
 tick(s,.3);assert.ok(!(victim.blindUntil>s.time),'windup');tick(s,.3);assert.ok(victim.blindUntil>s.time&&victim.blindUntil-s.time<=1.1,'blinds 1.1 s');
 u.ability.e=1;ab(s,u,'e',{l:1});assert.ok(s.effects.find(e=>e.kind==='flash').p[0]<-2,'left curve');}
// Nanoswarm: dormant until C again (no charge spent), then 45/s for 4 s.
{const {s,u,list:[foe]}=setup('Killjoy',['foe']);u.ability.c=2;Object.assign(foe,{x:1,y:0,z:-14});assert.equal(ab(s,u,'c'),true);tick(s,1);assert.equal(foe.hp,100,'dormant');
 assert.equal(ab(s,u,'c'),true);assert.equal(u.ability.c,1,'trigger is free');tick(s,1);assert.ok(Math.abs(foe.hp-55)<1.5,'45/s: '+foe.hp);tick(s,3.8);assert.ok(s.effects.some(e=>e.kind==='nanoswarm'),'still burning at 4.8 s');tick(s,0.4);assert.ok(!s.effects.some(e=>e.kind==='nanoswarm'),'5 s then gone (wiki)');}
// Alarmbot chases a nearby visible enemy and leaves it Vulnerable (double damage from guns and abilities).
{const {s,u,list:[foe]}=setup('Killjoy',['foe']);u.ability.q=1;Object.assign(foe,{x:4,y:0,z:-14});assert.equal(ab(s,u,'q'),true);tick(s,1);
 assert.ok(foe.vulnerableUntil>s.time&&!s.effects.some(e=>e.kind==='alarmbot'),'Alarmbot pops');assert.ok(s.roundState(foe).status.vulnerable>3);const hp=foe.hp;abilityDamage(s,u,foe,10);assert.equal(hp-foe.hp,20,'vulnerable doubles damage');}
// Turret only covers the 180° in front of where Killjoy faced; hits tag.
{const {s,u,list:[back,front]}=setup('Killjoy',['foeBack'],['foeFront']);Object.assign(back,{x:0,y:0,z:-8});Object.assign(front,{x:0,y:0,z:-200});assert.equal(ab(s,u,'e'),true);tick(s,2);assert.equal(back.hp,100,'behind the turret');
 front.z=-20;tick(s,1.5);assert.ok(front.hp<100&&front.tagUntil>s.time-.6,'in front');}
// Trapwire: across the lane at the aim point; an enemy crossing is revealed and slowed, then dazed; one use.
{const {s,u,list:[foe,mate]}=setup('Cypher',['foe'],['mate']);u.ability.c=1;Object.assign(foe,{x:3,y:0,z:-16});Object.assign(mate,{x:-3,y:0,z:-14});assert.equal(ab(s,u,'c'),true);const w=s.effects.find(e=>e.kind==='trapwire');assert.ok(Math.abs(w.p[0])>7&&Math.abs(w.q[0])>7,'wall to wall');
 tick(s,.1);assert.equal(mate.slowUntil||0,0,'allies pass');foe.z=-14;tick(s,.4);assert.ok(!foe.tether,'not armed before the 0.7 s windup');foe.z=-16;tick(s,.3);foe.z=-14;tick(s,.1);assert.ok(foe.revealedUntil>s.time&&foe.slowUntil>s.time&&s.roundState(foe).status.tether>2,'tethered');tick(s,2.5);assert.ok(foe.concussUntil>s.time,'dazed');assert.ok(!s.effects.some(e=>e.kind==='trapwire'),'consumed');}
{const {s,u}=setup('Cypher',['foe']);u.ability.q=1;ab(s,u,'q');const c=s.effects.find(e=>e.kind==='smoke');assert.ok(Math.abs(c.until-s.time-7.25)<.01,'Cyber Cage 7.25 s');assert.equal(c.radius,3.72,'Cyber Cage radius 3.72 m (wiki)');}
// Smoke radius per ability (wiki): Cloudburst 3.35 m, Dark Cover 4.1 m, Cyber Cage 3.72 m; sight is blocked inside that radius only.
{assert.deepEqual(SMOKE.r,{Jett:3.35,Omen:4.1,Cypher:3.72});const {s,u}=setup('Omen',['foe']);u.ability.e=1;assert.equal(ab(s,u,'e'),true);const c=s.effects.find(e=>e.kind==='smoke');assert.equal(c.radius,4.1,'Dark Cover radius 4.1 m (wiki)');
 for(const [r,off,want] of [[3.35,3.5,false],[4.1,3.5,true],[3.72,3.6,true],[3.72,3.8,false]]){s.effects=[{kind:'smoke',p:[0,0,-10],until:s.time+5,radius:r}];const y=SMOKE.lift;assert.equal(smokeBlocks(s,[-20,y,-10+off],[1,0,0],40),want,'radius '+r+' m, ray '+off+' m from the centre');}}
// Trademark: spots a visible enemy within 10 m, then a 9.5 s slow field.
{const {s,u,list:[foe]}=setup('Chamber',['foe']);u.ability.c=1;Object.assign(foe,{x:0,y:0,z:-19});assert.equal(ab(s,u,'c'),true);tick(s,1.9);assert.ok(!s.effects.find(e=>e.kind==='trademark').spotted,'Trademark arms 2 s after placement');tick(s,.2);tick(s,.3);assert.ok(!s.effects.find(e=>e.kind==='trademark').field);tick(s,.4);
 const t=s.effects.find(e=>e.kind==='trademark');assert.ok(t.field&&Math.abs(t.until-s.time-9.3)<.2&&foe.slowUntil>s.time,'slow field');}
// Headhunter: was a one-way swap (previous gun never came back). Now restored when spent, put away, on death and on Tour de Force.
{const {s,u,list:[foe]}=setup('Chamber',['foe']);Object.assign(foe,{x:0,y:0,z:-6,hp:1000});Object.assign(u,{weapon:'Spectre',ammo:17,reserve:60,inventory:{Spectre:17}});u.ability.q=3;
 const fire=()=>{s.time+=1;u.fireAt=0;u.triggerHeld=false;return s.fire(u);};
 assert.equal(ab(s,u,'q'),true);assert.deepEqual([u.weapon,u.ammo],['Sheriff',1]);assert.equal(fire(),true);assert.equal(fire(),false,'one round per charge');tick(s,.05);assert.deepEqual([u.weapon,u.ammo,u.reserve,u.inventory.Sheriff],['Spectre',17,60,undefined],'spent: Spectre back');
 ab(s,u,'q');assert.equal(u.ability.q,1);ab(s,u,'q');assert.deepEqual([u.weapon,u.ability.q],['Spectre',2],'Q again puts it away and refunds the unfired round');
 ab(s,u,'q');u.alive=false;tick(s,.05);assert.equal(u.weapon,'Spectre','death returns the gun');u.alive=true;
 u.inventory.Sheriff=6;ab(s,u,'q');fire();tick(s,.05);assert.equal(u.inventory.Sheriff,6,'own Sheriff ammo untouched');
 ab(s,u,'q');u.ability.ult=9;assert.equal(cast(s,u),true);assert.equal(u.weapon,'Operator');assert.equal(u.headhunter,null);for(let i=0;i<5;i++)fire();tick(s,.05);assert.equal(u.weapon,'Spectre','Tour de Force over Headhunter returns the Spectre');}
// Friendly fire (wiki.playvalorant.com/en-us/Abilities: "abilities that damage allies deal 1/3 damage"; per ability, Paint Shells /
// Shock Bolt / Hot Hands / Blaze / Nanoswarm / Showstopper / Hunter's Fury: friendlyfire "Yes (damage reduced)", Turret / Boom
// Bot: "No"): an ally in a damaging ability takes a third; a teamkill is the ally's death with no kill, credits, ult point or score
// for the caster; the caster's own utility never hurts the caster.
{const {s,u,list:[foe,mate]}=setup('Raze',['foe'],['mate']);for(const v of [foe,mate,u])Object.assign(v,{x:0,y:0,z:-5,armor:0,hp:100});
 const fx=(kind,extra)=>s.effects.push({id:++s.effectSeq,kind,owner:u.id,ag:u.agent,team:u.team,p:[0,.1,-5],until:s.time+5,radius:4,...extra});
 fx('blast',{damage:75,at:s.time});tick(s,.05);assert.equal(foe.hp,25,'enemy full 75');assert(Math.abs(mate.hp-75)<1e-9,'ally a third: '+mate.hp);assert.equal(u.hp,100,'caster untouched');s.effects.length=0;
 for(const v of [foe,mate])v.hp=100;fx('fire',{rate:60});tick(s,1);assert(Math.abs(foe.hp-40)<1e-6,'enemy 60/s: '+foe.hp);assert(Math.abs(mate.hp-80)<1e-6,'ally 20/s: '+mate.hp);assert.equal(u.hp,100);s.effects.length=0;
 Object.assign(foe,{z:-40,hp:100});const k0=[u.kills,u.credits,u.ability.ult,s.scores[u.team]||0],d0=mate.deaths;mate.hp=10;fx('blast',{damage:75,at:s.time});tick(s,.05);assert(!mate.alive,'teamkill');s.step(.05);
 assert.deepEqual([u.kills,u.credits,u.ability.ult,s.scores[u.team]||0],k0,'no kill / credits / ult / score for a teamkill');assert.equal(mate.deaths,d0+1,'the ally still dies');
 const t=new SpikeSimulation(W,'five','ascent',()=>.5),kj=t.add('kj','Killjoy'),m2=t.add('mate2'),f2=t.add('foe2');t.start(false);t.buy=0;m2.team=kj.team;f2.team=1-kj.team;Object.assign(m2,{x:1,y:0,z:-3,hp:100,armor:0});Object.assign(f2,{x:-1,y:0,z:-3,hp:100,armor:0});
 t.effects.push({id:++t.effectSeq,kind:'turret',owner:kj.id,ag:'Killjoy',team:kj.team,p:[0,0,0],until:t.time+5,radius:30,at:t.time,yaw:0});tick(t,.05);assert(f2.hp<100,'turret shoots the enemy');assert.equal(m2.hp,100,'turret never shoots allies');}
console.log('Devices row 9: Blaze (wall burn/heal/sight), Hot Hands self-heal, Curveball (curve, windup, 1.1 s), Nanoswarm (dormant, free trigger, 45/s), Alarmbot (Vulnerable x2), Turret 180° arc + tag, Trapwire (wall-to-wall tether, daze, one use), Cyber Cage 7.25 s / 3.72 m, Dark Cover 4.1 m and Cloudburst 3.35 m smoke radii, Trademark (spot, slow field), Headhunter weapon restore');
