import assert from 'node:assert/strict';import {Simulation,KNIFE_HEAVY} from './src/simulation.js';const W={map:{attacker:[0,0,0],defender:[0,0,-2]},nav:{nodes:[[0,0,0],[0,0,-2]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};const s=new Simulation(W,'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);Object.assign(a,{weapon:'Bucky',ammo:5,x:0,y:0,z:0,look:0,pitch:Math.atan2(-.6,2),input:{},sf:0,air:false,lp:0,protectedUntil:0});Object.assign(b,{x:0,y:0,z:-2,protectedUntil:0,armor:0});s.fire(a);assert.equal(a.ammo,4);assert.equal(b.alive,false);assert.equal(a.kills,1);assert.equal(s.events.filter(e=>e[0]==='s').length,1);s.spawn(b);Object.assign(a,{weapon:'Knife',ammo:1,fireAt:0});Object.assign(b,{x:0,y:0,z:-5,protectedUntil:0});s.fire(a);assert.equal(b.hp,100);s.time+=1;b.z=-1;s.fire(a);assert.equal(b.hp<100,true);assert.equal(a.ammo,1);console.log('Weapons: shotgun pellets use one round/shot event, kill credited once; knife range enforced without ammo depletion');
{// Knife (wiki.playvalorant.com/en-us/Melee: Front 50/75, Back 100/150 Primary/Alt, no headshot bonus): heavy swing (kh:1) 1 s cooldown; light 2/s.
const k=new Simulation(W,'tdm','ascent',()=>.5),a=k.add('a'),b=k.add('b');k.start(false);
const swing=(heavy,pitch,bLook,fireAt=0)=>{k.spawn(b);Object.assign(a,{weapon:'Knife',ammo:1,fireAt,x:0,y:0,z:0,look:0,pitch,sf:0,air:false,lp:0,protectedUntil:0,triggerHeld:false,alive:true,input:{fire:true,heavy}});Object.assign(b,{x:0,y:0,z:-1.2,look:bLook,protectedUntil:0,armor:0,hp:200,alive:true});const ok=k.fire(a);return {ok,dmg:200-b.hp,cd:+(a.fireAt-k.time).toFixed(3)};};
assert.deepEqual(swing(false,-.3,Math.PI),{ok:true,dmg:50,cd:.5},'light swing');
assert.deepEqual(swing(true,-.3,Math.PI),{ok:true,dmg:75,cd:1},'heavy swing to the front body');
assert.deepEqual(swing(true,-.3,0),{ok:true,dmg:150,cd:1},'heavy back-stab');
assert.deepEqual(swing(true,.05,Math.PI),{ok:true,dmg:75,cd:1},'heavy to the head: no headshot bonus (wiki Melee)');
assert.deepEqual(swing(false,-.3,0),{ok:true,dmg:100,cd:.5},'light back-stab 100 (wiki Melee Back 100 primary)');
assert.deepEqual(swing(false,.05,Math.PI),{ok:true,dmg:50,cd:.5},'light to the head: 50');
assert.equal(swing(false,-.3,Math.PI,k.time+.4).ok,false,'heavy cooldown blocks the next swing');
assert.equal(KNIFE_HEAVY.cooldown,1);
let seq=50;k.command(a,{t:'in',seq:++seq,r:0,p:0,fire:1,kh:1});assert.equal(a.input.heavy,true);k.command(a,{t:'in',seq:++seq,r:0,p:0,fire:1});assert.equal(a.input.heavy,false);
Object.assign(a,{weapon:'Vandal',ammo:25,fireAt:0,input:{fire:true,heavy:true}});k.spawn(b);Object.assign(b,{x:0,y:0,z:-1.2,look:Math.PI,protectedUntil:0,armor:0,hp:200,alive:true});a.pitch=-.3;k.fire(a);assert.equal(200-b.hp,40,'kh never changes a gun shot');
console.log('Weapons: knife light 50 front / 100 back at 2/s, heavy (kh) 75 front / 150 back, 1 s cooldown, no headshot bonus (wiki Melee); kh ignored for guns');}
{// Reserve ammo per gun = the wiki infobox "Reserve" (wiki.playvalorant.com/en-us/<Weapon>, retrieved 2026-10-25; e.g. Vandal
// 75 -> 50 in v3.0): spawn, buy, swap and the floor gun default all use it (was 3 magazines for every gun).
const WIKI={Classic:36,Shorty:6,Frenzy:45,Ghost:39,Bandit:24,Sheriff:24,Stinger:60,Spectre:90,Bucky:10,Judge:15,Bulldog:72,Guardian:36,Warden:36,Phantom:60,Vandal:50,Marshal:15,Outlaw:10,Operator:10,Ares:100,Odin:200};
const {RESERVE,reserveOf,weapons:WS}=await import('./src/simulation.js');const {SpikeSimulation}=await import('./src/spike.js');
assert.deepEqual({...RESERVE},WIKI);for(const w of Object.keys(WIKI)){assert.ok(WS[w],w);assert.equal(reserveOf(w),WIKI[w],w);}
assert.equal(reserveOf('Knife'),WS.Knife.magazineSize*3,'not a gun: unchanged');
const SW={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const S=new SpikeSimulation(SW),a=S.add('a');S.start(false);a.credits=9000;S.buy=10;
for(const w of ['Vandal','Operator','Odin','Outlaw','Phantom','Ares','Bucky']){assert.equal(S.command(a,{t:'buy',n:w}),true,w);assert.equal(a.reserve,WIKI[w],'bought '+w);S.command(a,{t:'sell',n:w});}
assert.equal(S.command(a,{t:'buy',n:'Sheriff'}),true);assert.equal(a.reserve,24,'bought Sheriff');
console.log('Weapons: reserve ammo per gun = wiki (18 guns), on buy');}
{// Per-round reloads (wiki Bucky "2.5 sec (0.5 per shell)", Marshal "2.5 sec (0.5 per bullet)", one round at a time, a shot can go
// out between rounds) and the Outlaw's 2.3 s one barrel / 3.8 s both; shotgun hit past 10 m = 30% slow easing out over .5 s
// (patch 1.07, wiki Bucky / Judge / Shorty), never weakening a standard tag.
const {RELOAD_ROUND,reloadTime,tagHit,tagMul,weapons:WS}=await import('./src/simulation.js');const {SpikeSimulation}=await import('./src/spike.js');
assert.deepEqual({...RELOAD_ROUND},{Bucky:.5,Marshal:.5});
const SW={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const S=new SpikeSimulation(SW),a=S.add('a'),b=S.add('b');S.start(false);b.invulnerableUntil=1e9;/* the shots below never end the round */S.buy=0;S.roundDelay=0;const run=t=>{for(let x=0;x<t-1e-9;x+=.05)S.step(.05);};
for(const w of ['Marshal','Bucky']){Object.assign(a,{weapon:w,primary:w,triggerHeld:false,equipAt:0,ammo:0,reserve:WS[w].magazineSize*2,reloadAt:0,alive:true,fireAt:0,input:{}});a.inventory={[w]:0};
 assert.equal(S.command(a,{t:'reload'}),true);assert.ok(Math.abs(a.reloadAt-S.time-.5)<1e-9,w+' first round .5 s');run(.55);assert.equal(a.ammo,1,w+' one round');assert.equal(a.reserve,WS[w].magazineSize*2-1);
 run(2.05);assert.equal(a.ammo,5,w+' full after 2.5 s');assert.equal(a.reloadAt,0);
 a.ammo=2;assert.equal(S.command(a,{t:'reload'}),true);run(.2);a.fireAt=0;a.triggerHeld=false;a.input={fire:true};assert.equal(S.fire(a),true,w+' shot interrupts the reload');assert.equal(a.reloadAt,0);assert.equal(a.ammo,1);a.input={};}
Object.assign(a,{weapon:'Vandal',ammo:3,reserve:50,reloadAt:0});S.command(a,{t:'reload'});a.fireAt=0;a.input={fire:true};assert.equal(S.fire(a),false,'a magazine reload still blocks the shot');a.input={};a.reloadAt=0;
Object.assign(a,{weapon:'Outlaw',ammo:1});assert.equal(reloadTime(a),2.3);a.ammo=0;assert.equal(reloadTime(a),3.8);Object.assign(a,{weapon:'Vandal',ammo:0});assert.equal(reloadTime(a),WS.Vandal.reloadTimeSeconds);
const sim={time:10},t={};tagHit(sim,t,WS.Bucky,12);assert.equal(t.tagSoft,1);assert.ok(Math.abs(tagMul(t,10)-.7)<1e-9);assert.ok(Math.abs(tagMul(t,10.25)-.85)<1e-9);assert.equal(tagMul(t,10.5),1);
tagHit(sim,t,WS.Bucky,8);assert.equal(t.tagSoft,0);assert.equal(tagMul(t,10),.275,'near shotgun hit: standard tag');tagHit(sim,t,WS.Judge,15);assert.equal(t.tagSoft,0,'a far pellet never weakens a standard tag');
const v={};tagHit(sim,v,WS.Vandal,30);assert.equal(tagMul(v,10),.275,'rifles keep the standard tag at any range');assert.ok(Math.abs(tagMul(v,10.1)-(.275+.725*.1/.75))<1e-9,'the standard tag recovers linearly over 0.75 s (game files)');assert.equal(tagMul(v,10.75),1);
{const {Simulation:SM}=await import('./src/simulation.js');const W2={map:{attacker:[0,0,0],defender:[0,0,-2]},nav:{nodes:[[0,0,0],[0,0,-2]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 for(const [w,d,soft] of [['Bucky',12,1],['Bucky',6,0],['Vandal',12,0]]){const k=new SM(W2),p=k.add('p'),q=k.add('q');k.start(false);Object.assign(p,{x:0,y:0,z:0,weapon:w,ammo:5,fireAt:0,input:{fire:true},look:0,pitch:-.05,triggerHeld:false,equipAt:0});Object.assign(q,{x:0,y:0,z:-d,look:Math.PI,protectedUntil:0,armor:0,hp:500,alive:true});k.fire(p);assert.ok(q.hp<500,w+' hit at '+d);assert.equal(q.tagSoft,soft,w+' at '+d+' m tag');}}
console.log('Weapons: Bucky / Marshal reload one round per .5 s and a shot interrupts it, Outlaw 2.3 / 3.8 s, shotgun hits past 10 m = 30% slow easing out');}
