// Server-authoritative ultimates (ledger row 9): Hunter's Fury, Showstopper, Lockdown, Rolling Thunder,
// Seekers, Neural Theft, Tour de Force and Run It Back replace the old shared 100-damage blast.
// Intents carry no trusted origin/aim/target; everything comes from server state.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,SMOKE,smokeBlocks,cageBlocks,PARITY} from './src/abilities.js';import {ULT,ssDamage} from './src/ults.js';import {gunOf,weapons} from './src/simulation.js';import {floorTick} from './src/floor.js';
let wall=Infinity;const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:(o,d,max=Infinity)=>{if(!(d[2]<0)||!Number.isFinite(wall))return Infinity;const t=(o[2]+wall)/-d[2];return t>=0&&t<=max?t:Infinity;}};// wall: a plane at z=-wall
const setup=(agent,...others)=>{wall=Infinity;const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add(agent,agent),list=others.map(([n,team])=>{const v=s.add(n);return v;});s.start(false);s.buy=0;s.roundDelay=0;
 Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});for(const v of list){Object.assign(v,{armor:0,hp:100,protectedUntil:0});}
 // force teams: every 'foe*' opposes u, 'mate*' shares u's team
 for(const v of list)v.team=v.name.startsWith('mate')?u.team:1-u.team;return {s,u,list};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const cast=(s,u,m={})=>s.command(u,{t:'ab',k:'x',...m});
// Showstopper: X equips the launcher (wiki 1.4 s), FIRE shoots the rocket
const rocket=(s,u,m={})=>{const ok=cast(s,u,m);if(!ok)return ok;s.time+=ULT.rocket.equip;return s.fire(u);};

// Hunter's Fury (wiki Hunter's_Fury): unearned ult rejected; three wall-piercing 80-damage blasts (66 m, 1.76 m radius) on the
// server aim - the first on the cast, the rest on FIRE (recast) no sooner than 2.125 s apart, no auto blasts; hit enemies are
// revealed to Sova's team for 1 s; unfired charges are lost 6 s after the cast; spoofed aim ignored.
{const {s,u,list:[foe,side,mate]}=setup('Sova',['foe'],['foeSide'],['mate']);Object.assign(foe,{x:0,y:0,z:-40});Object.assign(side,{x:6,y:0,z:-20});Object.assign(mate,{x:0,y:0,z:-10});
 assert.equal(cast(s,u),false,'no unearned ult');u.ability.ult=9;wall=5;
 assert.equal(cast(s,u,{o:[0,0,-40],d:[1,0,0],p:[6,-20]}),true);assert.equal(u.ability.ult,0);assert.equal(foe.hp,20,'first blast pierces the wall');assert.equal(side.hp,100,'off-line enemy untouched');assert(Math.abs(mate.hp-(100-80/3))<1e-6,'ally on the line takes a third (VALORANT friendly fire 1/3): '+mate.hp);
 const rs=s.roundState(mate);assert.deepEqual(rs.rv.map(r=>r[0]),[foe.id],'hit enemy revealed to the team (the hit ally is not)');assert.equal(mate.kills,0);assert.equal(u.kills,0);assert.equal(s.roundState(foe).rv.length,0);
 assert.deepEqual([ULT.fury.blasts,ULT.fury.cycle,ULT.fury.window,ULT.fury.range,ULT.fury.width,ULT.fury.damage,ULT.fury.reveal],[3,2.125,6,66,1.76,80,1],'ULT.fury table');
 {tick(s,.95);assert.ok(s.roundState(mate).rv.some(r=>r[0]===foe.id),'still revealed at 0.95 s');tick(s,.1);assert.ok(!s.roundState(mate).rv.some(r=>r[0]===foe.id),'reveal over after 1 s');}
 tick(s,1);assert.equal(cast(s,u),true,'recast consumed');assert.equal(foe.hp,20,'recast before 2.125 s does not fire');tick(s,.1);assert.equal(foe.hp,20,'no auto blast');tick(s,.1);assert.equal(cast(s,u),true);assert.equal(foe.alive,false,'second blast kills');
 assert.equal(u.ability.fury.left,1);u.look=Math.atan2(-6,20);foe.alive=true;foe.hp=100;tick(s,2.2);assert.equal(side.hp,100,'no auto blast for the last charge');assert.equal(cast(s,u),true);assert.equal(u.ability.fury,null,'channel ends after three blasts');assert.equal(side.hp,20,'the blast follows the current aim');
 tick(s,10);assert.equal(cast(s,u),false,'no free blasts after the channel');}
// 1.76 m radius: a foe 1.6 m off the line is hit (was 0.9 m), 1.9 m is not; a charge left unfired is lost at 6 s.
{const {s,u,list:[near,far]}=setup('Sova',['foeNear'],['foeFar']);Object.assign(near,{x:1.6,y:0,z:-30});Object.assign(far,{x:-1.9,y:0,z:-30});u.ability.ult=9;
 assert.equal(cast(s,u),true);assert.equal(near.hp,20,'1.6 m off the line hit');assert.equal(far.hp,100,'1.9 m off the line missed');
 tick(s,5.9);assert.equal(u.ability.fury.left,2,'charges held until 6 s');tick(s,.15);assert.equal(u.ability.fury,null,'unfired charges lost at 6 s');assert.equal(cast(s,u),false);}
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
// Showstopper splash (wiki Showstopper: 4 m inner / 7 m outer, 30 - 150): full inside 4 m (was 3 m), linear to 30 at the edge (was to 0).
assert.deepEqual([ULT.rocket.inner,ULT.rocket.outer,ULT.rocket.damage,ULT.rocket.min],[4,7,150,30],'ULT.rocket radii / damage');
assert.deepEqual([0,3.5,4,5.5,7,8].map(ssDamage),[150,150,150,90,0,0],'ssDamage: 150 to 4 m, 90 at 5.5 m, nothing from 7 m');assert.ok(Math.abs(ssDamage(6.999)-30)<.1,'30 at the outer edge');
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

// Rolling Thunder (wiki Rolling_Thunder): after the 1 s fuse (1.2 s windup - 0.2 s release), a 32 m x 18 m strip starting 8 m in
// front of Breach concusses enemies for 4 s through walls; nearer than 8 m, past 40 m, more than 9 m to the side, behind and allies are spared.
{assert.deepEqual([ULT.quake.near,ULT.quake.length,ULT.quake.width,ULT.quake.concuss],[8,32,18,4],'ULT.quake strip');
 const {s,u,list:[a,b,c,mate,close,edge,side,past]}=setup('Breach',['foeIn'],['foeWide'],['foeBehind'],['mate'],['foeClose'],['foeEdge'],['foeSide'],['foePast']);
 Object.assign(a,{x:2,y:0,z:-12});Object.assign(b,{x:14,y:0,z:-6});Object.assign(c,{x:0,y:0,z:6});Object.assign(mate,{x:0,y:0,z:-12});
 Object.assign(close,{x:0,y:0,z:-5});Object.assign(edge,{x:8.5,y:0,z:-38});Object.assign(side,{x:-9.6,y:0,z:-20});Object.assign(past,{x:0,y:0,z:-41});wall=1;u.ability.ult=9;
 assert.equal(cast(s,u),true);tick(s,.5);assert.ok(!(a.concussUntil>s.time),'windup');tick(s,.6);
 assert.ok(a.concussUntil>s.time+3&&a.concussUntil<=s.time+4,'concussed through the wall for 4 s');assert.ok(edge.concussUntil>s.time+3,'38 m ahead, 8.5 m aside: inside the strip');
 for(const v of [b,c,mate,close,side,past])assert.ok(!(v.concussUntil>s.time),v.name+' spared');}

// Seekers: the three nearest living enemies are nearsighted when their seeker arrives; a fourth is not.
{const {s,u,list}=setup('Skye',['foe1'],['foe2'],['foe3'],['foe4']);list.forEach((v,i)=>Object.assign(v,{x:0,y:0,z:-(6+i*10)}));u.ability.ult=9;assert.equal(cast(s,u),true);assert.equal(s.effects.filter(e=>e.kind==='seeker').length,3);
 tick(s,.4);assert.ok(!(list[0].nearsightUntil>s.time),'travel time');tick(s,3);for(const v of list.slice(0,3))assert.ok(v.nearsightUntil>s.time,'seeker hits '+v.name);assert.ok(!(list[3].nearsightUntil>s.time));
 assert.deepEqual([ULT.seekers.count,ULT.seekers.maxTravel,ULT.seekers.nearsight,ULT.seekers.slow,ULT.seekers.slowK],[3,15,3,5,.4],'wiki Seekers: 3, 15 s lifespan, 3 s Nearsight, 5 s 60 % Slow');for(const v of list.slice(0,3))assert.ok(v.seekSlowUntil>s.time&&v.seekSlowUntil-s.time<=5&&s.roundState(v).status.sslow>0,'seeker slows '+v.name);assert.ok(!(list[3].seekSlowUntil>s.time));}

// Neural Theft: needs a visible enemy corpse within 18 m in front (ult points kept otherwise); reveals all living enemies twice
// (wiki: 1st reveal after a 2 s windup, the 2nd 4 s after it).
{const {s,u,list:[corpse,alive1,alive2]}=setup('Cypher',['foeDead'],['foeA'],['foeB']);Object.assign(corpse,{x:0,y:0,z:-3});Object.assign(alive1,{x:30,y:0,z:-30});Object.assign(alive2,{x:-30,y:0,z:-30});u.ability.ult=9;
 assert.equal(cast(s,u),false,'no corpse');assert.equal(u.ability.ult,9);corpse.alive=false;u.look=Math.PI;assert.equal(cast(s,u),false,'corpse behind');u.look=0;wall=1;assert.equal(cast(s,u),false,'corpse behind a wall');wall=Infinity;
 corpse.z=-18.5;assert.equal(cast(s,u),false,'corpse beyond 18 m');assert.equal(u.ability.ult,9);corpse.z=-17;
 assert.equal(cast(s,u),true,'corpse at 17 m');assert.equal(u.ability.ult,0);tick(s,1.9);assert.equal(s.roundState(u).rv.length,0,'nothing before 2 s');tick(s,.2);assert.equal(s.roundState(u).rv.length,2,'first reveal at 2 s');tick(s,1.6);assert.equal(s.roundState(u).rv.length,0);tick(s,2.1);assert.equal(s.roundState(u).rv.length,0,'nothing before 6 s');tick(s,.25);assert.equal(s.roundState(u).rv.length,2,'second reveal at 6 s');}

// Tour de Force: the gun becomes a 5-round Operator; spent, swapped away or dead, the previous weapon returns.
{const {s,u,list:[foe]}=setup('Chamber',['foe']);Object.assign(foe,{x:0,y:0,z:-6,hp:1000,armor:0});u.weapon='Spectre';u.ammo=17;u.reserve=60;u.ability.ult=9;
 assert.equal(cast(s,u),true);assert.equal(u.weapon,'Operator');assert.equal(u.ammo,5);assert.equal(cast(s,u),false,'no stacking');
 for(let i=0;i<5;i++){s.time+=2;u.fireAt=0;u.triggerHeld=false;u.input={ads:1};assert.equal(s.fire(u),true);}assert.ok(foe.hp<1000,'Operator hits');tick(s,.05);assert.equal(u.weapon,'Spectre');assert.equal(u.ammo,17);assert.equal(u.reserve,60);assert.equal(u.inventory.Operator,undefined);
 u.ability.ult=9;cast(s,u);u.alive=false;tick(s,.05);assert.equal(u.weapon,'Spectre','death returns the saved gun');}
// Tour De Force = wiki (v8.03 / Tour_De_Force stats): 2.3 s summon, 0.9 shots / s scoped or not, 150 body x1.7 head x0.85 legs with
// no falloff; a kill leaves a 6 m slow field under the victim for 4 s (50 %, oslow) that slows everyone in it (friendly fire: slow).
{const {s,u,list:[foe,mate,far]}=setup('Chamber',['foe'],['mate'],['foeFar']);Object.assign(foe,{x:0,y:0,z:-40,hp:1000,armor:0});Object.assign(mate,{x:3,y:0,z:-40});Object.assign(far,{x:20,y:0,z:-40});u.weapon='Spectre';u.ammo=17;u.reserve=60;u.ability.ult=9;
 assert.deepEqual([ULT.tdf.ammo,ULT.tdf.fireRate,ULT.tdf.field,ULT.tdf.slow],[5,.9,6,4],'ULT.tdf table');const G=gunOf({agent:'Chamber',ultWeapon:{},weapon:'Operator'});assert.deepEqual([G.fireRate,G.adsStats.fireRate,G.damageRanges.length,G.damageRanges[0].headDamage,G.damageRanges[0].bodyDamage,G.damageRanges[0].legDamage],[.9,.9,1,255,150,127.5]);
 assert.equal(cast(s,u),true);const t0=s.time;u.input={ads:1};s.time=t0+2.29;assert.equal(s.fire(u),false,'2.3 s summon');s.time=t0+2.31;assert.equal(s.fire(u),true);const d=1000-foe.hp;assert.ok([255,150,127].includes(d),'TDF damage '+d+' at 40 m (no falloff)');
 u.triggerHeld=false;s.time+=1.1;assert.equal(s.fire(u),false,'0.9 per second: not before 1.111 s');s.time+=.02;assert.equal(s.fire(u),true,'next shot at 1.111 s');
 foe.hp=1;u.triggerHeld=false;s.time+=1.2;assert.equal(s.fire(u),true);assert.equal(foe.alive,false,'kill');const f=s.effects.find(e=>e.kind==='trademark'&&e.tdf);assert.ok(f&&f.field&&f.radius===6&&Math.abs(f.until-s.time-4)<1e-9,'kill field 6 m / 4 s');assert.deepEqual(f.fp,[foe.x,foe.y,foe.z],'under the victim');
 tick(s,.1);assert.ok(mate.orbSlowUntil>s.time&&!(mate.slowUntil>s.time),'ally inside slowed 50 % (oslow)');assert.ok(!(far.orbSlowUntil>s.time),'20 m away: no slow');assert.ok(s.snapshot().fx.some(r=>r.kind==='dev'&&r.d==='trademark'&&r.fp),'page gets the field row');tick(s,4);assert.ok(!s.effects.includes(f),'gone after 4 s');}
// Headhunter kills leave no field
{const {s,u,list:[foe]}=setup('Chamber',['foe']);Object.assign(foe,{x:0,y:0,z:-10,hp:1,armor:0});u.ability.q=1;s.time+=.5;assert.equal(s.command(u,{t:'ab',k:'q'}),true);s.time+=.31;assert.equal(s.fire(u),true);assert.equal(foe.alive,false);assert.ok(!s.effects.some(e=>e.tdf),'no field from Headhunter');}
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
console.log('Ultimates: Hunter\'s Fury (3 wall-piercing 1.76 m blasts, FIRE every 2.125 s, 1 s reveal, 6 s window, death end), Showstopper (1.4 s launcher equip, FIRE shoots, 10 s window, travelling rocket, falloff, LOS, wall detonation), Lockdown (windup, radius detain blocks guns/abilities, round reset), Rolling Thunder (32 x 18 m strip from 8 m ahead, 4 s, through walls), Seekers (3 nearest), Neural Theft (corpse targeting, reveals at 2 s and 6 s), Tour de Force (5-round Operator, weapon restore, round reset), Run It Back (death/expiry return, no elimination, no death drop, gear kept at round end); leaver utility/ult state moves to the seat bot; server-side aim only');
// Devices that used to be inert markers: recon pulses reveal enemies in the bolt's sight (not through walls),
// Boom Bot hunts the nearest visible enemy and explodes for 125, Trailblazer concusses on contact.
import {DEV,bbDamage,tbConcuss,turretDamage} from './src/devices.js';
{const {s,u,list:[seen,hidden,far]}=setup('Sova',['foeSeen'],['foeHidden'],['foeFar']);u.ability.e=1;Object.assign(seen,{x:3,y:0,z:-14});Object.assign(hidden,{x:-3,y:0,z:-30});Object.assign(far,{x:0,y:0,z:-60});wall=20;
 assert.equal(s.command(u,{t:'ab',k:'e'}),true);const bolt=s.effects.find(e=>e.kind==='recon');assert.ok(bolt&&Math.abs(bolt.p[2]+19.97)<.05,'bolt lands on the wall at the server aim (full-charge flight, vendor/sova-bolt.cjs)');tick(s,.5);assert.equal(s.roundState(u).rv.length,0,'first pulse not yet');tick(s,.9);/* 0.4 s flight + 0.9 s first pulse */
 assert.deepEqual(s.roundState(u).rv.map(r=>r[0]),[seen.id],'pulse reveals only what the bolt sees');const first=seen.revealedUntil;tick(s,1.6);assert.ok(seen.revealedUntil>first+1,'second pulse refreshes the reveal');assert.ok(!(hidden.revealedUntil>0)&&!(far.revealedUntil>0));
 assert.deepEqual(DEV.reconBolt,{pulses:[.9,2.5],radius:30,reveal:.75},'wiki Recon_Bolt: 30 m, 2 pulses 1.6 s apart, 0.75 s reveal');assert.ok(Math.abs(seen.revealedUntil-s.time-.75)<.2,'0.75 s reveal per pulse ('+(seen.revealedUntil-s.time)+')');tick(s,.9);assert.equal(s.roundState(u).rv.length,0,'reveal over 0.75 s after the last pulse');}
{const {s,u,list:[near,mid,out]}=setup('Sova',['foeNear'],['foeMid'],['foeOut']);u.ability.e=1;
 assert.equal(s.command(u,{t:'ab',k:'e'}),true);const b=s.effects.find(e=>e.kind==='recon');assert.ok(b.radius===30&&b.reveal===.75,'Recon Bolt effect: 30 m, 0.75 s');const [bx,,bz]=b.p;Object.assign(near,{x:bx+10,y:0,z:bz});Object.assign(mid,{x:bx,y:0,z:bz+28});Object.assign(out,{x:bx-31,y:0,z:bz});
 tick(s,b.pulses[0]-s.time+.05);const rv=s.roundState(u).rv.map(r=>r[0]);assert.ok(rv.includes(near.id)&&rv.includes(mid.id),'10 m and 28 m from the bolt revealed (was 20 m)');assert.ok(!rv.includes(out.id),'31 m from the bolt not revealed');}
{const {s,u,list:[foe,mate]}=setup('Raze',['foe'],['mate']);u.ability.c=1;Object.assign(foe,{x:4,y:0,z:-7});Object.assign(mate,{x:-30,y:0,z:0});
 assert.equal(s.command(u,{t:'ab',k:'c'}),true);assert.ok(s.effects.some(e=>e.kind==='boombot'));tick(s,2.5);assert.ok(foe.alive&&foe.hp>=20&&foe.hp<=26.25,'Boom Bot hunts and explodes within 2.5 m: 73.75-80 (wiki, was a 125 kill): '+foe.hp);assert.equal(mate.hp,100);assert.ok(!s.effects.some(e=>e.kind==='boombot'));}
// Boom Bot (wiki Boom_Bot): 5 s, 15 m detection, explodes within 2.5 m, 80 inside 2 m falling to 30 at 6 m.
{assert.deepEqual([bbDamage(0),bbDamage(2),bbDamage(4),bbDamage(5.5),bbDamage(6.01)],[80,80,55,36.25,0],'Boom Bot falloff 80 (2 m) -> 30 (6 m)');
 const {s,u,list:[foe,side,out]}=setup('Raze',['foe'],['foeSide'],['foeOut']);u.ability.c=1;Object.assign(foe,{x:12,y:0,z:-6});Object.assign(side,{x:12,y:0,z:-9});Object.assign(out,{x:12,y:0,z:-15});
 assert.equal(s.command(u,{t:'ab',k:'c'}),true);tick(s,4.5);assert.ok(foe.hp<=26.25,'locks onto an enemy 13.4 m away (15 m detection, was 10 m): '+foe.hp);assert.ok(side.hp<100&&side.hp>=20&&side.hp>foe.hp,'falloff to a second enemy 4-6 m from the blast: '+side.hp);assert.equal(out.hp,100,'9 m away: outside 6 m');assert.ok(!s.effects.some(e=>e.kind==='boombot'));}
// Trailblazer bite (wiki Trailblazer: 30 damage to the enemy the leap reaches); the one beside it is only concussed.
{assert.equal(DEV.trail.bite,30,'DEV.trail.bite');const {s,u,list:[foe,side]}=setup('Skye',['foe'],['foeSide']);u.ability.q=1;Object.assign(foe,{x:0,y:0,z:-8});Object.assign(side,{x:2.5,y:0,z:-8});assert.equal(s.command(u,{t:'ab',k:'q'}),true);tick(s,1.5);
 assert.ok(!s.effects.some(e=>e.kind==='trail'),'leapt');assert.equal(foe.hp,70,'bitten for 30');assert.equal(side.hp,100,'only the reached enemy is bitten');assert.ok(side.concussUntil>s.time,'the other one concussed');}
// Boom Bot windup + 60 HP (wiki Boom_Bot): it stops within 2.5 m and explodes 0.6 s later; enemy gunfire destroys it (60 HP), allies' shots pass it.
{assert.deepEqual([DEV.boombot.windup,DEV.boombot.hp],[.6,60],'DEV.boombot windup / hp');
 const {s,u,list:[foe]}=setup('Raze',['foe']);u.ability.c=1;Object.assign(foe,{x:0,y:0,z:-5});assert.equal(s.command(u,{t:'ab',k:'c'}),true);const bb=s.effects.find(e=>e.kind==='boombot');assert.equal(bb.hp,60,'the bot has 60 HP');
 let n=0;while(!bb.blastAt&&n++<40)tick(s,.05);assert.ok(bb.blastAt>0,'closed within 2.5 m: windup started');const p0=[...bb.p];assert.equal(foe.hp,100,'no damage at the trigger (0.6 s windup, was instant)');
 tick(s,.5);assert.equal(foe.hp,100,'0.5 s into the windup: not yet');assert.deepEqual(bb.p,p0,'stopped during the windup');tick(s,.15);assert.ok(foe.hp<=30&&foe.hp>=20,'explodes 0.6 s after the trigger: '+foe.hp);assert.ok(!s.effects.includes(bb));}
{const {s,u,list:[foe,mate]}=setup('Raze',['foe'],['mate']);u.ability.c=1;Object.assign(foe,{x:0,y:0,z:30});Object.assign(mate,{x:0,y:0,z:28});assert.equal(s.command(u,{t:'ab',k:'c'}),true);tick(s,.5);const bb=s.effects.find(e=>e.kind==='boombot'),o=[bb.p[0],bb.p[1]+.2,30],d=[0,0,-1],V={damageRanges:[{rangeStartMeters:0,rangeEndMeters:999,bodyDamage:40}]};
 s.shotBy=mate;assert.equal(s.traceShot(o,d,100),Infinity,'an ally shot passes the bot');s.shotBy=foe;const t=s.traceShot(o,d,100);assert.ok(s.shotBlockedBy==='boombot'&&Math.abs(t-(30-bb.p[2]-.4))<.02,'an enemy shot stops on the bot: '+t);
 s.shotImpact(o,d,t,V);assert.equal(bb.hp,20,'40 body damage: 60 -> 20');assert.ok(s.effects.includes(bb));s.traceShot(o,d,100);s.shotImpact(o,d,t,V);assert.ok(!s.effects.includes(bb),'destroyed at 0 HP');tick(s,5);assert.equal(foe.hp,100,'a destroyed bot never explodes');
 // through the real gun path (fire sets shotBy): the foe shoots the bot 5 m away
 const {s:s2,u:u2,list:[f2]}=setup('Raze',['foe']);u2.ability.c=1;Object.assign(f2,{x:0,y:0,z:40});assert.equal(s2.command(u2,{t:'ab',k:'c'}),true);tick(s2,.3);const b2=s2.effects.find(e=>e.kind==='boombot');Object.assign(u2,{x:10});/* Raze out of the line of fire */Object.assign(f2,{x:b2.p[0],z:b2.p[2]+5,look:0});f2.pitch=Math.atan2(b2.p[1]+.2-(f2.y+1.6),5);
 let shots=0;for(let k=0;k<10&&s2.effects.includes(b2);k++){s2.time+=1;f2.triggerHeld=false;if(s2.fire(f2))shots++;}assert.ok(!s2.effects.includes(b2)&&shots>=2,'enemy gunfire destroys the Boom Bot ('+shots+' shots, hp '+b2.hp+')');}
{const {s,u,list:[foe,side,out]}=setup('Skye',['foe'],['foeSide'],['foeOut']);u.ability.q=1;Object.assign(foe,{x:0,y:0,z:-10});Object.assign(side,{x:2.5,y:0,z:-8});Object.assign(out,{x:4,y:0,z:-8});assert.equal(s.command(u,{t:'ab',k:'q'}),true);tick(s,1.5);assert.ok(!s.effects.some(e=>e.kind==='trail'));
 // Trailblazer (wiki): 6 s, 3.5 m explosion, concuss 4 s at the centre falling to 2.5 s at the edge
 assert.deepEqual([tbConcuss(0),tbConcuss(1.75),tbConcuss(3.5),DEV.trail.life],[4,3.25,2.5,6],'Trailblazer concuss falloff 4 -> 2.5 s, 6 s');
 const t0=s.time,cf=foe.concussUntil-t0,cs=side.concussUntil-t0;/* the explosion happened up to 1.5 s ago: compare remaining times */assert.ok(cf>cs&&cs>0,'closer foe concussed longer: '+cf.toFixed(2)+' > '+cs.toFixed(2));assert.ok(!(out.concussUntil>0),'4 m from the blast: outside 3.5 m (was 4 m)');
 assert.ok(Math.abs((foe.concussUntil-side.concussUntil)-(tbConcuss(1.8)-tbConcuss(2.55)))<.25,'falloff by distance');}
console.log('Devices: recon pulses reveal by line of sight (two pulses), Boom Bot seeks and explodes (0.6 s windup, 60 HP, shootable), Trailblazer concusses + 30 bite');
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
 tick(s,.3);assert.ok(!(victim.blindUntil>s.time),'windup');tick(s,.3);assert.ok(victim.blindUntil>s.time&&victim.blindUntil-s.time<=1.5&&victim.blindUntil-s.time>1.1,'blinds 1.5 s (wiki Curveball max blind)');
 u.ability.e=1;ab(s,u,'e',{l:1});assert.ok(s.effects.find(e=>e.kind==='flash').p[0]<-2,'left curve');}
// Nanoswarm: dormant until C again (no charge spent), then a 1 s windup and 45/s for 4 s (5 s total, 4.5 m; wiki).
{const {s,u,list:[near,far]}=setup('Killjoy',['near'],['far']);u.ability.c=1;assert.equal(ab(s,u,'c'),true);const n=s.effects.find(e=>e.kind==='nanoswarm');Object.assign(near,{x:n.p[0]+4.3,y:0,z:n.p[2]});Object.assign(far,{x:n.p[0]-4.7,y:0,z:n.p[2]});assert.equal(ab(s,u,'c'),true);tick(s,2);assert.ok(near.hp<100&&far.hp===100,'4.5 m radius (was 4): '+near.hp+' / '+far.hp);}
{const {s,u,list:[foe]}=setup('Killjoy',['foe']);u.ability.c=2;Object.assign(foe,{x:1,y:0,z:-14});assert.equal(ab(s,u,'c'),true);tick(s,1);assert.equal(foe.hp,100,'dormant');
 assert.equal(ab(s,u,'c'),true);assert.equal(u.ability.c,1,'trigger is free');tick(s,.95);assert.equal(foe.hp,100,'1 s activation windup (wiki)');tick(s,1.05);assert.ok(Math.abs(foe.hp-55)<1.5,'45/s: '+foe.hp);tick(s,2.8);assert.ok(s.effects.some(e=>e.kind==='nanoswarm'),'still burning at 4.8 s');tick(s,0.4);assert.ok(!s.effects.some(e=>e.kind==='nanoswarm'),'5 s then gone (wiki)');}
// Alarmbot chases a nearby visible enemy and leaves it Vulnerable (double damage from guns and abilities).
// wiki Alarmbot (v13.00): 5.5 m detection, 0.5 s alert phase, 22.5 m/s, 0.5 s windup once within 2 m, 4 s Vulnerable.
{const {s,u,list:[foe]}=setup('Killjoy',['foe']);u.ability.q=1;assert.equal(ab(s,u,'q'),true);const e=s.effects.find(e=>e.kind==='alarmbot');const p0=[...e.p];Object.assign(foe,{x:p0[0]+4.5,y:0,z:p0[2]});
 assert.equal(DEV.alarmbot.deploy,1.85);tick(s,1.8);assert.ok(e.chase==null&&!e.alertAt,'1.85 s deploy: detects nothing');tick(s,.05);assert.equal(e.chase,foe.id,'deployed: detects');
 tick(s,.45);assert.ok(Math.hypot(e.p[0]-p0[0],e.p[2]-p0[2])<1e-6,'0.5 s alert phase: not moving yet');tick(s,.1);const m=Math.hypot(e.p[0]-p0[0],e.p[2]-p0[2]);assert.ok(m>.5&&m<=22.5*.1+1e-6,'runs at 22.5 m/s: '+m);
 tick(s,.15);assert.ok(e.blastAt>s.time,'within 2 m: 0.5 s windup');assert.ok(!(foe.vulnerableUntil>s.time),'not before the windup');tick(s,.55);
 assert.ok(foe.vulnerableUntil>s.time&&!s.effects.some(e=>e.kind==='alarmbot'),'Alarmbot pops');assert.ok(s.roundState(foe).status.vulnerable>3);const hp=foe.hp;abilityDamage(s,u,foe,10);assert.equal(hp-foe.hp,20,'vulnerable doubles damage');}
// Alarmbot proximity (wiki 'Proximity radius to remain active 40 m', v1.11): inactive while Killjoy is dead or past 40 m (as the Turret).
{const {s,u,list:[foe]}=setup('Killjoy',['foe']);u.ability.q=1;assert.equal(ab(s,u,'q'),true);const e=s.effects.find(e=>e.kind==='alarmbot');const p0=[...e.p];assert.equal(DEV.alarmbot.active,40);
 Object.assign(u,{x:p0[0],z:p0[2]+41});Object.assign(foe,{x:p0[0]+4.5,y:0,z:p0[2]});tick(s,3);assert.ok(e.chase==null&&Math.hypot(e.p[0]-p0[0],e.p[2]-p0[2])<1e-6,'Killjoy 41 m away: inactive');
 Object.assign(u,{z:p0[2]+39});tick(s,.1);assert.equal(e.chase,foe.id,'back within 40 m: active');tick(s,.6);const m=Math.hypot(e.p[0]-p0[0],e.p[2]-p0[2]);assert.ok(m>.5,'running');u.alive=false;tick(s,.3);assert.ok(e.chase==null&&Math.abs(Math.hypot(e.p[0]-p0[0],e.p[2]-p0[2])-m)<1e-6&&!e.blastAt,'Killjoy dead: stops, inactive');
 console.log('Alarmbot: 1.85 s deploy; inactive while Killjoy is dead or past 40 m');}
// Turret only covers the 180° in front of where Killjoy faced; hits tag.
{const {s,u,list:[back,front]}=setup('Killjoy',['foeBack'],['foeFront']);Object.assign(back,{x:0,y:0,z:-2});Object.assign(front,{x:0,y:0,z:-200});assert.equal(ab(s,u,'e'),true);assert.deepEqual(s.effects.find(e=>e.kind==='turret').p.map(n=>+n.toFixed(3)),[0,.1,-4.5],'placed at the crosshair 4.5 m out (wiki Turret max cast distance; was the generic 14 m ray)');/* back: between Killjoy and the turret, behind its cone */tick(s,4);assert.equal(back.hp,100,'behind the turret');
 front.z=-20;tick(s,1.5);assert.ok(front.hp<100&&front.tagUntil>s.time-.6,'in front');}
// Owl Drone stand-in (wiki Owl_Drone): the dart tags the nearest visible enemy near the aim point; pings 0.6 s at 1.6 s and 3.4 s.
{assert.deepEqual([DEV.owl.pings,DEV.owl.reveal,DEV.owl.radius],[[1.6,3.4],.6,20],'DEV.owl');assert.deepEqual([DEV.spycam.deploy,DEV.spycam.every,DEV.spycam.pings,DEV.spycam.reveal,DEV.spycam.radius],[1.15,2,undefined,1,20],'DEV.spycam: every 2 s, no ping cap');
 const {s,u,list:[foe,far]}=setup('Sova',['foe'],['foeFar']);Object.assign(foe,{x:1,y:0,z:-12});Object.assign(far,{x:0,y:0,z:-45});u.ability.c=1;assert.equal(ab(s,u,'c'),true);const t0=s.time,rv=v=>v.revealedUntil>s.time,at=t=>tick(s,t0+t-s.time);
 const d=s.effects.find(e=>e.kind==='dart');assert.ok(d&&!s.effects.some(e=>e.kind==='recon'),'Owl Drone is a dart (not the 20 m area pulse)');
 at(1.5);assert.ok(!rv(foe),'tagged, no ping before 1.6 s');at(1.7);assert.ok(rv(foe),'1st ping');assert.ok(!rv(far),'the far enemy is not tagged');at(2.35);assert.ok(!rv(foe),'0.6 s ping over');at(3.5);assert.ok(rv(foe),'2nd ping at 3.4 s');at(4.1);assert.ok(!rv(foe));assert.ok(!s.effects.includes(d),'dart done');}
// Spycam stand-in (wiki Spycam): once deployed (1.15 s) the cam darts the nearest visible enemy; 1 s reveal every 2 s until removed
// (wiki 'continues indefinitely until dart removed': the 1.85 s removal channel is tested below; here nobody removes it).
{const {s,u,list:[foe]}=setup('Cypher',['foe']);Object.assign(foe,{x:1,y:0,z:-12});u.ability.e=1;assert.equal(ab(s,u,'e'),true);const t0=s.time,rv=()=>foe.revealedUntil>s.time,at=t=>tick(s,t0+t-s.time);
 at(1.05);assert.ok(!rv(),'deploying');at(1.25);assert.ok(rv(),'darted on deploy');at(2.3);assert.ok(!rv(),'1 s reveal');at(3.25);assert.ok(rv(),'next ping 2 s later');at(9.25);assert.ok(rv(),'5th ping');at(11.25);assert.ok(rv(),'6th ping (no 5-ping cap)');at(59.5);assert.ok(rv(),'still pinging at 59 s (1.15 + 29 x 2)');at(60.5);assert.ok(!rv(),'1 s reveals between pings');assert.ok(s.effects.some(e=>e.kind==='dart'),'dart stays');s.newRound();assert.ok(!s.effects.some(e=>e.kind==='dart'),'round end clears it');}
{const {s,u,list:[foe]}=setup('Cypher',['foe']);Object.assign(foe,{x:1,y:0,z:-12});u.ability.e=1;ab(s,u,'e');tick(s,1.3);foe.alive=false;tick(s,.1);assert.ok(!s.effects.some(e=>e.kind==='dart'),'the dart ends with its target');}
{const {s,u,list:[foe]}=setup('Cypher',['foe']);Object.assign(foe,{x:1,y:0,z:-12});wall=3;u.ability.e=1;ab(s,u,'e');tick(s,1.3);assert.ok(!(foe.revealedUntil>s.time)&&!s.effects.some(e=>e.kind==='dart'),'no enemy in sight: the dart misses');wall=Infinity;}
// Spycam dart removal (wiki Spycam 'Dart removal channel time 1.85 seconds'): the darted target holds interact (h4) standing still,
// not firing, not on the Spike: 1.85 s and the dart is gone (no more pings); a break (fire, moving, letting go) restarts the channel;
// a defender at the planted Spike defuses instead; bots channel it while no enemy is in sight. Status dart / drm for the page.
{const {dartChannel,dartOn}=await import('./src/devices.js');assert.equal(DEV.spycam.remove,1.85);
 const darted=()=>{const r=setup('Cypher',['foe']);Object.assign(r.list[0],{x:1,y:0,z:-12,vx:0,vz:0,air:false});r.u.ability.e=1;assert.equal(ab(r.s,r.u,'e'),true);tick(r.s,1.3);assert.ok(dartOn(r.s,r.list[0]),'darted');return r;};
 const hold=(s,v,sec,inp={interact:true})=>{for(let t=0;t<sec-1e-9;t+=.05){v.input={...inp};v.inputAt=s.time;s.time+=.05;tickAbilities(s,.05);}};
 {const {s,u,list:[foe]}=darted();hold(s,foe,1.8);assert.ok(dartOn(s,foe),'1.8 s: still in');const st=s.roundState(foe).status;assert.equal(st.dart,1);assert.ok(Math.abs(st.drm-1.8)<.06,'status drm '+st.drm);
  hold(s,foe,.1);assert.ok(!dartOn(s,foe),'removed after 1.85 s');assert.equal(s.roundState(foe).status.dart,0);foe.revealedUntil=0;tick(s,6);assert.ok(!(foe.revealedUntil>s.time),'no pings once removed');}
 {const {s,u,list:[foe]}=darted();hold(s,foe,1.5);hold(s,foe,.05,{interact:true,fire:true});hold(s,foe,1.5);assert.ok(dartOn(s,foe),'firing breaks the channel: 1.5 s after it is not enough');hold(s,foe,.4);assert.ok(!dartOn(s,foe),'1.85 s unbroken removes it');}
 {const {s,u,list:[foe]}=darted();hold(s,foe,1);foe.vx=3;hold(s,foe,1.2);assert.ok(dartOn(s,foe),'moving: no channel');foe.vx=0;hold(s,foe,1);foe.input={};foe.inputAt=s.time;tick(s,.3);hold(s,foe,1);assert.ok(dartOn(s,foe),'letting go restarts it');hold(s,foe,.9);assert.ok(!dartOn(s,foe));}
 {const {s,u,list:[foe]}=darted();s.atk=u.team;Object.assign(s.spike,{st:'plant',x:foe.x,y:0,z:foe.z+1});foe.input={interact:true};foe.inputAt=s.time;assert.equal(dartChannel(s,foe),false,'at the planted Spike interact defuses');hold(s,foe,3);assert.ok(dartOn(s,foe),'defusing never removes the dart');}
 {const {s,u,list:[foe]}=darted();foe.human=false;Object.assign(u,{z:-40});wall=20;/* Cypher out of the foe's sight (wall plane at z -20) */for(let t=0;t<1.9;t+=.05){assert.equal(s.botDartRemove(foe),dartOn(s,foe));s.time+=.05;tickAbilities(s,.05);}assert.ok(!dartOn(s,foe),'a bot with no enemy in sight removes it in 1.85 s');wall=Infinity;
  const r=darted(),b=r.list[0];b.human=false;Object.assign(r.u,{z:-40});for(let t=0;t<3;t+=.05){assert.equal(r.s.botDartRemove(b),false,'enemy in sight: the bot fights instead');r.s.time+=.05;tickAbilities(r.s,.05);}assert.ok(dartOn(r.s,b));}
 assert.ok(SpikeSimulation.prototype.bot.toString().includes('if(this.botDartRemove(u))return;'),'bots run the removal first');
 console.log('Spycam dart removal: 1.85 s interact channel (standing, not firing, not on the Spike), breaks restart it, no pings after; bots remove it with no enemy in sight; status dart / drm');}

// Turret deploy / cone / proximity (wiki Turret: 2.7 s deploy, 100 degree detection cone, active within 40 m of a living Killjoy).
{assert.deepEqual([DEV.turret.deploy,+(DEV.turret.arc*360/Math.PI).toFixed(6),DEV.turret.active],[2.7,100,40],'DEV.turret deploy / cone / active');
 const {s,u,list:[foe]}=setup('Killjoy',['foe']);u.ability.e=1;assert.equal(ab(s,u,'e'),true);const T=s.effects.find(e=>e.kind==='turret');Object.assign(foe,{x:T.p[0],y:0,z:T.p[2]-10});const t0=s.time,at=t=>tick(s,t0+t-s.time);
 at(3.4);assert.equal(foe.hp,100,'deploying 2.7 s + 0.75 s windup: no shot by 3.4 s (was a 0.7 s deploy)');at(3.6);assert.ok(foe.hp<100,'first burst once deployed and locked: '+foe.hp);}
{const run=(ang,own)=>{const {s,u,list:[foe]}=setup('Killjoy',['foe']);Object.assign(foe,{x:-Math.sin(ang)*10,y:0,z:-Math.cos(ang)*10,hp:100,armor:0});s.effects.push({id:++s.effectSeq,kind:'turret',owner:u.id,ag:'Killjoy',team:u.team,p:[0,0,0],until:s.time+20,radius:30,at:s.time,yaw:0});if(own)own(u);tick(s,1.5);return 100-foe.hp;};
 assert.ok(run(45*Math.PI/180)>0,'45 degrees off the facing: inside the 100 degree cone');assert.equal(run(55*Math.PI/180),0,'55 degrees off: outside the cone (was 90)');
 assert.equal(run(0,u=>Object.assign(u,{x:0,z:41})),0,'Killjoy 41 m away: deactivated');assert.ok(run(0,u=>Object.assign(u,{x:0,z:39}))>0,'39 m: active');assert.equal(run(0,u=>{u.alive=false;}),0,'Killjoy dead: deactivated');}
// Turret fire (wiki Turret): 0.75 s lock windup, bursts of 3 shots 0.083 s apart every 1.25 s; 8 / 6 / 4 per shot within 20 / 35 / beyond m.
{assert.deepEqual([DEV.turret.windup,DEV.turret.shots,DEV.turret.gap,DEV.turret.cycle,DEV.turret.near,DEV.turret.mid,DEV.turret.dmg],[.75,3,.083,1.25,20,35,[8,6,4]],'DEV.turret fire table');
 assert.deepEqual([0,19.9,20,34.9,35,50].map(turretDamage),[8,8,6,6,4,4],'turretDamage tiers');
 const run=z=>{const {s,u,list:[foe]}=setup('Killjoy',['foe']);Object.assign(foe,{x:0,y:0,z,hp:100,armor:0});s.effects.push({id:++s.effectSeq,kind:'turret',owner:u.id,ag:'Killjoy',team:u.team,p:[0,0,0],until:s.time+20,radius:30,at:s.time,yaw:0});const h=[];for(const t of [.7,.6,.6,.6,.6,.6])tick(s,t),h.push(100-foe.hp);return h;};
 assert.deepEqual(run(-10),[0,24,24,48,48,72],'10 m: nothing in the 0.75 s windup (0.7 s), one 24 burst by 1.3 s and still at 1.9 s, the next at 2.0 s, the third at 3.25 s');
 assert.deepEqual(run(-25),[0,18,18,36,36,54],'25 m: 6 per shot');}
// Trapwire (wiki v11.08 / v13.00): across the lane at the aim point, 1.5 s deploy; a crossing enemy is Slowed 50 % at once, 0.7 s windup,
// then zapped 5 and Revealed while within 4 m of the crossing; breaking free leaves a 1.25 s slow; the wire re-arms 2 s later (not consumed, no tether / concuss).
{const {s,u,list:[foe,mate]}=setup('Cypher',['foe'],['mate']);u.ability.c=1;Object.assign(foe,{x:3,y:0,z:-16});Object.assign(mate,{x:-3,y:0,z:-14});assert.equal(ab(s,u,'c'),true);const w=s.effects.find(e=>e.kind==='trapwire');assert.ok(Math.abs(w.p[0])>7&&Math.abs(w.q[0])>7,'wall to wall');
 tick(s,.1);assert.equal(mate.orbSlowUntil||0,0,'allies pass');foe.z=-14;tick(s,.4);assert.ok(!(foe.orbSlowUntil>s.time),'not armed in the 1.5 s deploy');foe.z=-16;tick(s,1.1);foe.z=-14;tick(s,.1);
 assert.ok(foe.orbSlowUntil>s.time&&s.roundState(foe).status.tether>0,'slowed at once');assert.equal(foe.hp,100);assert.ok(!(foe.revealedUntil>s.time),'no reveal in the 0.7 s windup');tick(s,.7);
 assert.equal(foe.hp,95,'zap 5');assert.ok(foe.revealedUntil>s.time,'revealed');tick(s,3);assert.equal(foe.hp,95,'one zap');assert.ok(foe.orbSlowUntil>s.time&&foe.revealedUntil>s.time,'held while within 4 m');assert.ok(!(foe.concussUntil>s.time),'no concuss since v11.08');
 foe.x+=4.5;tick(s,.1);assert.ok(Math.abs(foe.orbSlowUntil-s.time-1.15)<.06,'1.25 s slow after breaking free: '+(foe.orbSlowUntil-s.time));tick(s,.3);assert.ok(!(foe.revealedUntil>s.time),'reveal ends');assert.ok(s.effects.some(e=>e.kind==='trapwire'),'not consumed');
 tick(s,1.2);foe.x-=4.5;foe.z=-16;tick(s,.1);foe.z=-14;tick(s,.1);assert.equal(s.roundState(foe).status.tether,0,'re-arming (2 s)');foe.z=-16;tick(s,.5);foe.z=-14;tick(s,.1);assert.ok(s.roundState(foe).status.tether>0,'re-armed after 2 s');}
{const {s,u}=setup('Cypher',['foe']);u.ability.q=1;ab(s,u,'q');tick(s,3);ab(s,u,'q');/* the toss lands; Q again (no charge left) activates it: test-cage.js */const c=s.effects.find(e=>e.kind==='smoke');assert.ok(Math.abs(c.until-s.time-7.25)<.01,'Cyber Cage 7.25 s');assert.equal(c.radius,3.72,'Cyber Cage radius 3.72 m (wiki)');assert.equal(c.cyl,5,'Cyber Cage is a cylinder (half-height 5 m)');
 // hollow open-ended cylinder centred on the cage: blocks where a line crosses the wall, not inside-to-inside or down the open top
 s.effects=[{kind:'smoke',p:[0,0,-10],until:s.time+5,radius:3.72,cyl:5}];const B=(o,d,m)=>{const l=Math.hypot(...d);return smokeBlocks(s,o,d.map(n=>n/l),m);};
 assert.deepEqual([B([-20,1.6,-10],[1,0,0],40),B([-20,1.6,-6.4],[1,0,0],40),B([-20,1.6,-6.2],[1,0,0],40),B([0,1.6,-10],[1,0,0],2),B([0,1.6,-10],[1,0,0],10),B([-20,6,-10],[1,0,0],40),B([0,9,-10],[0,-1,0],9),B([-20,1.6,-10],[1,0,0],15),B([-20,-4.5,-10],[1,0,0],40)],
  [true,true,false,false,true,false,false,false,true],'cage: through / 3.6 m / 3.8 m off / inside-inside / inside-out / over the top / down the top / ends short of the wall / walls below the cage centre');
 assert.deepEqual([cageBlocks(s.effects[0],[-20,1.6,-10],[1,0,0],16.27),cageBlocks(s.effects[0],[-20,1.6,-10],[1,0,0],16.29)],[false,true],'the wall at 16.28 m');}
// Smoke radius per ability (wiki): Cloudburst 3.35 m, Dark Cover 4.1 m, Cyber Cage 3.72 m; sight is blocked inside that radius only.
{assert.deepEqual(SMOKE.r,{Jett:3.35,Omen:4.1,Cypher:3.72});const {s,u}=setup('Omen',['foe']);u.ability.e=1;assert.equal(ab(s,u,'e'),true);const c=s.effects.find(e=>e.kind==='smoke');assert.equal(c.radius,4.1,'Dark Cover radius 4.1 m (wiki)');
 for(const [r,off,want] of [[3.35,3.5,false],[4.1,3.5,true],[3.72,3.6,true],[3.72,3.8,false]]){s.effects=[{kind:'smoke',p:[0,0,-10],until:s.time+5,radius:r}];const y=SMOKE.lift;assert.equal(smokeBlocks(s,[-20,y,-10+off],[1,0,0],40),want,'radius '+r+' m, ray '+off+' m from the centre');}}
// Trademark: spots a visible enemy within 10 m, then a 9.5 s slow field.
{const {s,u,list:[foe]}=setup('Chamber',['foe']);u.ability.c=1;Object.assign(foe,{x:0,y:0,z:-19});assert.equal(ab(s,u,'c'),true);tick(s,1.9);assert.ok(!s.effects.find(e=>e.kind==='trademark').spotted,'Trademark arms 2 s after placement');tick(s,.2);tick(s,.3);assert.ok(!s.effects.find(e=>e.kind==='trademark').field);tick(s,.4);assert.ok(!s.effects.find(e=>e.kind==='trademark').field,'0.9 s windup on the enemy in sight (wiki)');tick(s,.25);
 const t=s.effects.find(e=>e.kind==='trademark');assert.ok(t.field&&Math.abs(t.until-s.time-4)<.2&&foe.orbSlowUntil>s.time&&!(foe.slowUntil>s.time),'4 s field, 50 % slow (oslow), wiki');assert.deepEqual(t.fp,[foe.x,foe.y,foe.z],'field under the enemy');assert.equal(t.hp,0,'trap spent');
 Object.assign(u,{x:foe.x+3,z:foe.z});tick(s,.1);assert.ok(u.orbSlowUntil>s.time,'Chamber in his own field is slowed too (wiki: affects allies / self)');Object.assign(foe,{x:foe.x+7});tick(s,.3);assert.ok(!(foe.orbSlowUntil>s.time),'out of the 6 m field');tick(s,4);assert.ok(!s.effects.find(e=>e.kind==='trademark'),'gone after 4 s');}
// Headhunter (wiki): one charge = one round, the previous gun restored when spent, put away, on death and on Tour de Force;
// 0.3 s equip, 4 per second (the next charge is chambered after each shot), 159 / 55 / 46 with no falloff.
{const {s,u,list:[foe]}=setup('Chamber',['foe']);Object.assign(foe,{x:0,y:0,z:-40,hp:1000,armor:0});Object.assign(u,{weapon:'Spectre',ammo:17,reserve:60,inventory:{Spectre:17},pitch:-.01});/* aim at the chest */u.ability.q=3;
 const fire=()=>{s.time+=1;u.fireAt=0;u.triggerHeld=false;return s.fire(u);};
 const G=gunOf({headhunter:{},weapon:'Sheriff'});assert.deepEqual([G.fireRate,G.equipTimeSeconds,G.damageRanges.length,G.damageRanges[0].headDamage,G.damageRanges[0].bodyDamage,G.damageRanges[0].legDamage],[4,.3,1,159,55,46],'Headhunter stats');assert.equal(gunOf({weapon:'Sheriff'}),weapons.Sheriff,'a bought Sheriff keeps its own stats');
 assert.equal(ab(s,u,'q'),true);assert.deepEqual([u.weapon,u.ammo,u.ability.q],['Sheriff',1,2]);assert.equal(s.fire(u),false,'0.3 s equip');s.time+=.29;assert.equal(s.fire(u),false);s.time+=.02;assert.equal(s.fire(u),true);assert.ok([159,55,46].includes(1000-foe.hp),'no falloff at 40 m: '+(1000-foe.hp));
 tick(s,.05);assert.deepEqual([u.weapon,u.ammo,u.ability.q],['Sheriff',1,1],'next charge chambered');u.triggerHeld=false;assert.equal(s.fire(u),false,'4 per second');s.time+=.2;assert.equal(s.fire(u),true,'0.25 s later');
 tick(s,.05);assert.deepEqual([u.ammo,u.ability.q],[1,0]);u.triggerHeld=false;s.time+=.3;assert.equal(s.fire(u),true);tick(s,.05);assert.deepEqual([u.weapon,u.ammo,u.reserve,u.inventory.Sheriff],['Spectre',17,60,undefined],'spent: Spectre back');
 u.ability.q=2;ab(s,u,'q');assert.equal(u.ability.q,1);ab(s,u,'q');assert.deepEqual([u.weapon,u.ability.q],['Spectre',2],'Q again puts it away and refunds the unfired round');
 ab(s,u,'q');u.alive=false;tick(s,.05);assert.equal(u.weapon,'Spectre','death returns the gun');u.alive=true;
 u.inventory.Sheriff=6;u.ability.q=1;ab(s,u,'q');fire();tick(s,.05);assert.equal(u.inventory.Sheriff,6,'own Sheriff ammo untouched');
 u.ability.q=1;ab(s,u,'q');u.ability.ult=9;assert.equal(cast(s,u),true);assert.equal(u.weapon,'Operator');assert.equal(u.headhunter,null);for(let i=0;i<5;i++)fire();tick(s,.05);assert.equal(u.weapon,'Spectre','Tour de Force over Headhunter returns the Spectre');}
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
 t.effects.push({id:++t.effectSeq,kind:'turret',owner:kj.id,ag:'Killjoy',team:kj.team,p:[0,0,0],until:t.time+5,radius:30,at:t.time,yaw:0});tick(t,.9);assert(f2.hp<100,'turret shoots the enemy');assert.equal(m2.hp,100,'turret never shoots allies');}
console.log('Devices row 9: Blaze (wall burn/heal/sight), Hot Hands self-heal, Curveball (curve, windup, 1.5 s), Nanoswarm (dormant, free trigger, 45/s), Alarmbot (Vulnerable x2), Owl Drone / Spycam dart stand-ins (wiki pings), Turret 100° cone / 2.7 s deploy / 40 m + alive Killjoy + tag, 0.75 s windup, 3-shot bursts every 1.25 s, 8 / 6 / 4 by distance, Trapwire (wall-to-wall tether, daze, one use), Cyber Cage 7.25 s / 3.72 m, Dark Cover 4.1 m and Cloudburst 3.35 m smoke radii, Trademark (spot, slow field), Headhunter weapon restore');
// Sage Resurrection (wiki): 12 m max cast distance (v11.04), 2 s windup, then the 1.3 s revive: the ally stands 3.3 s after the cast.
{const {s,u,list:[mate,foe]}=setup('Sage',['mate'],['foe']);Object.assign(mate,{x:0,y:0,z:-10,alive:false,hp:0});Object.assign(foe,{x:30,y:0,z:-30});u.ability.ult=9;
 assert.deepEqual(PARITY.rez,{windup:2,revive:1.3,reach:12},'PARITY.rez');assert.equal(cast(s,u),true,'corpse 10 m ahead (was 5 m)');assert.equal(u.ability.ult,0);
 tick(s,3.25);assert.equal(mate.alive,false,'still rising at 3.25 s');assert.equal(cast(s,u),false,'no second cast on the same corpse');tick(s,.1);assert.equal(mate.alive,true,'standing at 3.3 s');assert.equal(mate.hp,100);
 const t2=setup('Sage',['mate']);Object.assign(t2.list[0],{x:0,y:0,z:-13,alive:false,hp:0});t2.u.ability.ult=9;assert.equal(cast(t2.s,t2.u),false,'13 m: out of reach');
 const t3=setup('Sage',['mate']);Object.assign(t3.list[0],{x:0,y:0,z:-5,alive:false,hp:0});t3.u.ability.ult=9;cast(t3.s,t3.u);t3.s.newRound();tick(t3.s,4);assert.equal(t3.list[0].reviveAt,0,'round reset clears a pending revive');}
// Chamber Rendezvous (wiki): the teleport takes 1.3 s (0.1 s windup + 1.2 s arrival); no shots or casts meanwhile; channel 'rendezvous' to the page.
{const {s,u}=setup('Chamber',['foe']);u.ability.e=1;assert.equal(ab(s,u,'e'),true);assert.deepEqual(u.ability.anchor,[0,0,-8.5],'anchor at the crosshair, 8.5 m max cast distance (wiki Rendezvous)');Object.assign(u,{x:9,z:-5});
 assert.equal(ab(s,u,'e'),true);assert.deepEqual([u.x,u.z],[9,-5],'not instant');assert.equal(s.roundState(u).channel.kind,'rendezvous');assert.ok(Math.abs(s.roundState(u).channel.remaining-1.3)<1e-9);
 u.weapon='Classic';u.ammo=12;u.fireAt=0;u.triggerHeld=false;assert.equal(s.fire(u),false,'no shot while teleporting');tick(s,1.25);assert.deepEqual([u.x,u.z],[9,-5]);tick(s,.1);assert.deepEqual([u.x,u.z],[0,-8.5],'at the anchor after 1.3 s');assert.equal(u.pendingTeleport,null);
 assert.equal(u.ability.e,0);assert.ok(u.ability.rechargeAt>s.time+28,'30 s cooldown');}
console.log('Chamber / Sage / Cypher (qa-27): Tour De Force 0.9/s, 150/255/127 no falloff, 6 m 4 s 50 % kill field (allies too); Headhunter 159/55/46 no falloff, 0.3 s equip, 4/s chambering; Resurrection 12 m, 2 s + 1.3 s; Rendezvous 1.3 s teleport; Spycam dart every 2 s until removed (1.85 s) / the target dies / round ends');
