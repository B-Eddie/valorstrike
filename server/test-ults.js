// Server-authoritative ultimates (ledger row 9): Hunter's Fury, Showstopper, Lockdown, Rolling Thunder,
// Seekers, Neural Theft, Tour de Force and Run It Back replace the old shared 100-damage blast.
// Intents carry no trusted origin/aim/target; everything comes from server state.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';import {ULT} from './src/ults.js';
let wall=Infinity;const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:(o,d,max=Infinity)=>{if(!(d[2]<0)||!Number.isFinite(wall))return Infinity;const t=(o[2]+wall)/-d[2];return t>=0&&t<=max?t:Infinity;}};// wall: a plane at z=-wall
const setup=(agent,...others)=>{wall=Infinity;const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add(agent,agent),list=others.map(([n,team])=>{const v=s.add(n);return v;});s.start(false);s.buy=0;s.roundDelay=0;
 Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});for(const v of list){Object.assign(v,{armor:0,hp:100,protectedUntil:0});}
 // force teams: every 'foe*' opposes u, 'mate*' shares u's team
 for(const v of list)v.team=v.name.startsWith('mate')?u.team:1-u.team;return {s,u,list};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const cast=(s,u,m={})=>s.command(u,{t:'ab',k:'x',...m});

// Hunter's Fury: unearned ult rejected; three wall-piercing 80-damage blasts on the server aim (first now,
// then every 2 s, recast early after 0.9 s); hit enemies are revealed to Sova's team; spoofed aim ignored.
{const {s,u,list:[foe,side,mate]}=setup('Sova',['foe'],['foeSide'],['mate']);Object.assign(foe,{x:0,y:0,z:-40});Object.assign(side,{x:6,y:0,z:-20});Object.assign(mate,{x:0,y:0,z:-10});
 assert.equal(cast(s,u),false,'no unearned ult');u.ability.ult=9;wall=5;
 assert.equal(cast(s,u,{o:[0,0,-40],d:[1,0,0],p:[6,-20]}),true);assert.equal(u.ability.ult,0);assert.equal(foe.hp,20,'first blast pierces the wall');assert.equal(side.hp,100,'off-line enemy untouched');assert.equal(mate.hp,100,'no team damage');
 const rs=s.roundState(mate);assert.deepEqual(rs.rv.map(r=>r[0]),[foe.id],'hit enemy revealed to the team');assert.equal(s.roundState(foe).rv.length,0);
 s.time+=.35;assert.equal(cast(s,u),true,'recast consumed');assert.equal(foe.hp,20,'recast too soon does not fire');tick(s,.7);assert.equal(cast(s,u),true);assert.equal(foe.alive,false,'second blast kills');
 assert.equal(u.ability.fury.left,1);u.look=Math.atan2(-6,20);foe.alive=true;foe.hp=100;tick(s,2.05);assert.equal(u.ability.fury,null,'channel ends after three blasts');assert.equal(side.hp,20,'auto blast follows the current aim');
 tick(s,10);assert.equal(cast(s,u),false,'no free blasts after the channel');}
{const {s,u,list:[foe]}=setup('Sova',['foe']);Object.assign(foe,{x:0,y:0,z:-30});u.ability.ult=9;cast(s,u);u.alive=false;tick(s,.1);assert.equal(u.ability.fury,null,'death ends Hunter\'s Fury');tick(s,3);assert.equal(foe.hp,20);}

// Showstopper: a travelling rocket; impact on a body deals 150 at the centre with falloff to 7 m and LOS;
// a wall detonates it early; allies are unharmed.
{const {s,u,list:[foe,near,mate,hidden]}=setup('Raze',['foe'],['foeNear'],['mate'],['foeHidden']);Object.assign(foe,{x:0,y:.6,z:-15});Object.assign(near,{x:5.5,y:.6,z:-15});Object.assign(mate,{x:-1,y:.6,z:-15});Object.assign(hidden,{x:0,y:.6,z:-60});
 u.ability.ult=9;assert.equal(cast(s,u,{d:[0,1,0]}),true);assert.equal(foe.hp,100,'rocket travels, no instant damage');tick(s,.25);assert.equal(foe.hp,100);tick(s,.4);
 assert.equal(foe.alive,false,'direct hit kills');assert.ok(near.hp>0&&near.hp<100,'splash falls off with distance: '+near.hp);assert.equal(mate.hp,100);assert.equal(hidden.hp,100);assert.equal(s.effects.some(e=>e.kind==='rocket'),false);}
{const {s,u,list:[foe]}=setup('Raze',['foe']);Object.assign(foe,{x:0,y:.6,z:-20});u.ability.ult=9;wall=6;cast(s,u);tick(s,.5);assert.equal(foe.hp,100,'wall stops the rocket short');assert.equal(s.effects.some(e=>e.kind==='rocket'),false);}

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

// Neural Theft: needs a visible enemy corpse within 5 m in front (ult points kept otherwise); reveals all living enemies twice.
{const {s,u,list:[corpse,alive1,alive2]}=setup('Cypher',['foeDead'],['foeA'],['foeB']);Object.assign(corpse,{x:0,y:0,z:-3});Object.assign(alive1,{x:30,y:0,z:-30});Object.assign(alive2,{x:-30,y:0,z:-30});u.ability.ult=9;
 assert.equal(cast(s,u),false,'no corpse');assert.equal(u.ability.ult,9);corpse.alive=false;u.look=Math.PI;assert.equal(cast(s,u),false,'corpse behind');u.look=0;wall=1;assert.equal(cast(s,u),false,'corpse behind a wall');wall=Infinity;
 assert.equal(cast(s,u),true);assert.equal(u.ability.ult,0);tick(s,1.1);assert.equal(s.roundState(u).rv.length,2,'first reveal');tick(s,1.6);assert.equal(s.roundState(u).rv.length,0);tick(s,.5);assert.equal(s.roundState(u).rv.length,2,'second reveal');}

// Tour de Force: the gun becomes a 5-round Operator; spent, swapped away or dead, the previous weapon returns.
{const {s,u,list:[foe]}=setup('Chamber',['foe']);Object.assign(foe,{x:0,y:0,z:-6,hp:1000,armor:0});u.weapon='Spectre';u.ammo=17;u.reserve=60;u.ability.ult=9;
 assert.equal(cast(s,u),true);assert.equal(u.weapon,'Operator');assert.equal(u.ammo,5);assert.equal(cast(s,u),false,'no stacking');
 for(let i=0;i<5;i++){s.time+=2;u.fireAt=0;u.triggerHeld=false;u.input={ads:1};assert.equal(s.fire(u),true);}assert.ok(foe.hp<1000,'Operator hits');tick(s,.05);assert.equal(u.weapon,'Spectre');assert.equal(u.ammo,17);assert.equal(u.reserve,60);assert.equal(u.inventory.Operator,undefined);
 u.ability.ult=9;cast(s,u);u.alive=false;tick(s,.05);assert.equal(u.weapon,'Spectre','death returns the saved gun');}

// Run It Back: dying (or the 10 s window ending) returns Phoenix to the mark at full health; his team is not
// eliminated by that death.
{const {s,u,list:[foe]}=setup('Phoenix',['foe']);Object.assign(foe,{x:0,y:0,z:-30});u.hp=40;u.ability.ult=9;assert.equal(cast(s,u),true);assert.equal(cast(s,u),false);
 u.x=10;u.z=-10;u.hp=0;u.alive=false;s.step(.05);assert.equal(s.roundDelay,0,'round continues while Run It Back is pending');tick(s,.05);assert.equal(u.alive,true);assert.equal(u.hp,100);assert.deepEqual([u.x,u.z],[0,0]);assert.equal(u.runItBack,null);
 u.ability.ult=9;s.time+=.5;assert.equal(cast(s,u),true);u.x=7;u.hp=55;tick(s,ULT.rib.window+.1);assert.deepEqual([u.x,u.hp],[0,100],'window end returns to the mark');}
console.log('Ultimates: Hunter\'s Fury (3 wall-piercing blasts, recast, reveal, death end), Showstopper (travelling rocket, falloff, LOS, wall detonation), Lockdown (windup, radius detain blocks guns/abilities, round reset), Rolling Thunder (cone through walls), Seekers (3 nearest), Neural Theft (corpse targeting, double reveal), Tour de Force (5-round Operator, weapon restore), Run It Back (death/expiry return, no elimination); server-side aim only');
