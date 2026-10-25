import assert from 'node:assert/strict';import {Simulation,KNIFE_HEAVY} from './src/simulation.js';const W={map:{attacker:[0,0,0],defender:[0,0,-2]},nav:{nodes:[[0,0,0],[0,0,-2]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};const s=new Simulation(W,'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);Object.assign(a,{weapon:'Bucky',ammo:5,x:0,y:0,z:0,look:0,pitch:Math.atan2(-.6,2),input:{},sf:0,air:false,lp:0,protectedUntil:0});Object.assign(b,{x:0,y:0,z:-2,protectedUntil:0,armor:0});s.fire(a);assert.equal(a.ammo,4);assert.equal(b.alive,false);assert.equal(a.kills,1);assert.equal(s.events.filter(e=>e[0]==='s').length,1);s.spawn(b);Object.assign(a,{weapon:'Knife',ammo:1,fireAt:0});Object.assign(b,{x:0,y:0,z:-5,protectedUntil:0});s.fire(a);assert.equal(b.hp,100);s.time+=1;b.z=-1;s.fire(a);assert.equal(b.hp<100,true);assert.equal(a.ammo,1);console.log('Weapons: shotgun pellets use one round/shot event, kill credited once; knife range enforced without ammo depletion');
{// Knife heavy swing (client right-click / long-press sends kh:1): 1 s cooldown, 75 front body, 150 head or back; light stays 50 at 2/s.
const k=new Simulation(W,'tdm','ascent',()=>.5),a=k.add('a'),b=k.add('b');k.start(false);
const swing=(heavy,pitch,bLook,fireAt=0)=>{k.spawn(b);Object.assign(a,{weapon:'Knife',ammo:1,fireAt,x:0,y:0,z:0,look:0,pitch,sf:0,air:false,lp:0,protectedUntil:0,triggerHeld:false,alive:true,input:{fire:true,heavy}});Object.assign(b,{x:0,y:0,z:-1.2,look:bLook,protectedUntil:0,armor:0,hp:200,alive:true});const ok=k.fire(a);return {ok,dmg:200-b.hp,cd:+(a.fireAt-k.time).toFixed(3)};};
assert.deepEqual(swing(false,-.3,Math.PI),{ok:true,dmg:50,cd:.5},'light swing');
assert.deepEqual(swing(true,-.3,Math.PI),{ok:true,dmg:75,cd:1},'heavy swing to the front body');
assert.deepEqual(swing(true,-.3,0),{ok:true,dmg:150,cd:1},'heavy back-stab');
assert.deepEqual(swing(true,.05,Math.PI),{ok:true,dmg:150,cd:1},'heavy to the head');
assert.equal(swing(false,-.3,Math.PI,k.time+.4).ok,false,'heavy cooldown blocks the next swing');
assert.equal(KNIFE_HEAVY.cooldown,1);
let seq=50;k.command(a,{t:'in',seq:++seq,r:0,p:0,fire:1,kh:1});assert.equal(a.input.heavy,true);k.command(a,{t:'in',seq:++seq,r:0,p:0,fire:1});assert.equal(a.input.heavy,false);
Object.assign(a,{weapon:'Vandal',ammo:25,fireAt:0,input:{fire:true,heavy:true}});k.spawn(b);Object.assign(b,{x:0,y:0,z:-1.2,look:Math.PI,protectedUntil:0,armor:0,hp:200,alive:true});a.pitch=-.3;k.fire(a);assert.equal(200-b.hp,40,'kh never changes a gun shot');
console.log('Weapons: knife heavy swing (kh) 75 front / 150 head or back, 1 s cooldown; light 50 at 2/s; kh ignored for guns');}
{// Reserve ammo per gun = the wiki infobox "Reserve" (wiki.playvalorant.com/en-us/<Weapon>, retrieved 2026-10-25; e.g. Vandal
// 75 -> 50 in v3.0): spawn, buy, swap and the floor gun default all use it (was 3 magazines for every gun).
const WIKI={Classic:36,Shorty:6,Frenzy:45,Ghost:39,Sheriff:24,Stinger:60,Spectre:90,Bucky:10,Judge:15,Bulldog:72,Guardian:36,Phantom:60,Vandal:50,Marshal:15,Outlaw:10,Operator:10,Ares:100,Odin:200};
const {RESERVE,reserveOf,weapons:WS}=await import('./src/simulation.js');const {SpikeSimulation}=await import('./src/spike.js');
assert.deepEqual({...RESERVE},WIKI);for(const w of Object.keys(WIKI)){assert.ok(WS[w],w);assert.equal(reserveOf(w),WIKI[w],w);}
assert.equal(reserveOf('Knife'),WS.Knife.magazineSize*3,'not a gun: unchanged');
const SW={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const S=new SpikeSimulation(SW),a=S.add('a');S.start(false);a.credits=9000;S.buy=10;
for(const w of ['Vandal','Operator','Odin','Outlaw','Phantom','Ares','Bucky']){assert.equal(S.command(a,{t:'buy',n:w}),true,w);assert.equal(a.reserve,WIKI[w],'bought '+w);S.command(a,{t:'sell',n:w});}
assert.equal(S.command(a,{t:'buy',n:'Sheriff'}),true);assert.equal(a.reserve,24,'bought Sheriff');
console.log('Weapons: reserve ammo per gun = wiki (18 guns), on buy');}
