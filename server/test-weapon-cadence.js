// Weapon fire cadence + alternate fires pinned to their published sources (qa-36; work/validation/values-weapons.md):
//  - Bulldog / Stinger ADS bursts (wiki.playvalorant.com/en-us/Bulldog, /Stinger: 3 rounds at 13.333/s, 2.105 bursts/s; 4 at 18/s,
//    2.118 bursts/s; valorant-api 13.08 adsStats burstCount 3 / 4, fireRate 6.315715 / 8.470589): rounds and bursts on the tick
//    clock, a burst finishes after the trigger is released, the hip stays full auto, a reload ends a burst.
//  - Odin hip spin-up 12 -> 15.6/s (wiki Odin "12-15.6 rounds/sec"; ramp time unpublished: motor CADENCE 1 s ASSUMED), ADS 15.6 at once.
//  - Classic ALT FIRE (wiki Classic / API altShotgunStats 3 pellets, 2.22 bursts/s): input alt:1 fires 3 rounds at once on the
//    wiki Alt Fire spread row (1.9 deg first, 2.5 back-to-back).
//  - Bucky ALT FIRE (wiki Bucky "Air burst": canister bursts at 7.5 m into 5 pellets; a target inside 7.5 m takes the canister
//    only, 40 / 20 / 15; API airBurstStats {5, 7.5}).
//  - Instant casts unequip (wiki ability pages 'Unequip time' + 'Weapon Reequip Speed: Fast'): Cloudburst 0.25 / Tailwind dash 0.2 /
//    Devour 0.5 / Dismiss 0.6 + the gun's fast equip time before it fires again.
//   node test-weapon-cadence.js
import assert from 'node:assert/strict';import Motor from './src/motor.cjs';import {Simulation,weapons} from './src/simulation.js';import {UNEQUIP,recoverTime} from './src/windups.js';import {INSTANT_UNEQUIP} from './src/abilities.js';import {SpikeSimulation} from './src/spike.js';
const world=()=>({map:{attacker:[0,0,0],defender:[0,0,-40]},nav:{nodes:[[0,0,0],[0,0,-40]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity});
const close=(a,b,e,m)=>assert.ok(Math.abs(a-b)<=e,`${m}: ${a} vs ${b}`);
// ---- the cadence table = the wiki rows; burst average = the API ADS rate ----
const C=Motor.CADENCE;
assert.deepEqual(C.burst,{Bulldog:{n:3,rate:13.333,bps:2.105},Stinger:{n:4,rate:18,bps:2.118}},'wiki burst rows');
close(C.burst.Bulldog.n*C.burst.Bulldog.bps,weapons.Bulldog.adsStats.fireRate,.002,'Bulldog 3 x 2.105 = API ADS 6.3157');
close(C.burst.Stinger.n*C.burst.Stinger.bps,weapons.Stinger.adsStats.fireRate,.002,'Stinger 4 x 2.118 = API ADS 8.4706');
assert.equal(weapons.Bulldog.adsStats.burstCount,3);assert.equal(weapons.Stinger.adsStats.burstCount,4);
assert.deepEqual([C.spin.Odin.from,C.spin.Odin.to],[weapons.Odin.fireRate,weapons.Odin.adsStats.fireRate],'Odin 12 -> 15.6 = API hip / ADS');
assert.deepEqual(Motor.CLASSIC_ALT.steps,[1.9,2.5,5.78]);assert.equal(Motor.CLASSIC_ALT.pellets,3);assert.equal(Motor.CLASSIC_ALT.bps,2.22);
assert.deepEqual(Motor.BUCKY_ALT,{dist:7.5,pellets:5,head:40,body:20,legs:15});
// ---- shots on the tick clock (step 5 ms, trigger held per `held(t)`) ----
function run(weapon,ads,T,held=()=>true,ammo=200){const s=new Simulation(world(),'tdm','ascent',()=>.5),a=s.add('a');s.start(false);a.human=true;
 Object.assign(a,{weapon,ammo,x:0,y:0,z:0,look:0,pitch:0,fireAt:0,protectedUntil:0,alive:true});const t0=s.time,shots=[];let seq=0;
 while(s.time-t0<T){const t=s.time-t0;s.command(a,{t:'in',seq:++seq,r:0,p:0,fire:held(t)?1:0,ads:ads?1:0});s.events.length=0;s.step(.005);if(s.events.some(e=>e[0]==='s'))shots.push(+(s.time-t0).toFixed(3));}
 return {shots,gaps:shots.slice(1).map((t,i)=>+(t-shots[i]).toFixed(3)),a,s};}
for(const [w,B] of Object.entries(C.burst)){
 const r=run(w,true,1.0),g=r.gaps;
 for(let i=0;i<g.length;i++){const inB=(i+1)%B.n!==0,want=inB?1/B.rate:1/B.bps-g.slice(i-B.n+1,i).reduce((x,y)=>x+y,0);close(g[i],want,.0051,`${w} ADS gap ${i} (${inB?'in a burst':'between bursts: the burst period minus its rounds'})`);}/* 5 ms ticks: a round waits for the tick after it is due */
 const bursts=Math.floor(r.shots.length/B.n);assert.ok(bursts>=2,w+' at least 2 bursts in 1 s');
 close((r.shots[B.n]-r.shots[0]),1/B.bps,.0051,`${w} burst period 1/${B.bps}`);
 // released after the first round: the burst still fires all its rounds, then stops
 const q=run(w,true,1.0,t=>t<.004);assert.equal(q.shots.length,B.n,`${w}: a tap fires the whole ${B.n}-round burst`);
 // hip: full auto at the gun's own rate
 const h=run(w,false,.5);for(const x of h.gaps)close(x,1/weapons[w].fireRate,.0051,w+' hip full auto');
 // a reload mid-burst ends it
 const z=run(w,true,.2,t=>t<.004,1);assert.equal(z.shots.length,1,w+': one round left, no more shots');z.s.command(z.a,{t:'reload'});assert.equal(z.a.cad.left,0,w+': the reload ended the burst');
}
{const r=run('Odin',false,1.4),rate=r.gaps.map(g=>1/g);close(rate[0],12,.8,'Odin first gap ~12/s');assert.ok(rate.at(-1)>15,'Odin spun up past 15/s: '+rate.at(-1));for(let i=1;i<rate.length;i++)assert.ok(rate[i]>=rate[i-1]-.8,'Odin ramps up, never down while held');
 const ad=run('Odin',true,.6);for(const x of ad.gaps)close(x,1/15.6,.0051,'Odin ADS 15.6 at once');
 const p=run('Odin',false,1.6,t=>t<.6||t>1.0),late=p.shots.filter(t=>t>1.0),g2=late[1]-late[0];close(1/g2,12,.8,'Odin: a pause past 0.25 s spins back down to 12');}
{const r=run('Vandal',true,.6);for(const x of r.gaps)close(x,1/weapons.Vandal.adsStats.fireRate,.0051,'Vandal ADS unchanged');}
// ---- Classic ALT FIRE: 3 rounds at once, 2.22 bursts/s, wiki Alt Fire spread ----
{const s=new Simulation(world(),'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);a.human=b.human=true;
 Object.assign(a,{weapon:'Classic',ammo:12,x:0,y:0,z:0,look:0,pitch:0,fireAt:0,protectedUntil:0});Object.assign(b,{x:0,y:0,z:-5,protectedUntil:0,armor:0,hp:100});
 s.command(a,{t:'in',seq:1,r:0,p:-.05,fire:1,alt:1});assert.equal(a.input.alt,true,'alt:1 parsed');s.events.length=0;assert.equal(s.fire(a),true);
 assert.equal(a.ammo,9,'3 rounds at once');assert.equal(s.events.filter(e=>e[0]==='s').length,1,'one shot event');assert.equal(s.events.filter(e=>e[0]==='h').length,3,'3 bullets hit a target 5 m ahead');
 close(a.fireAt-s.time,1/2.22,1e-9,'next alt burst after 1 / 2.22 s');assert.equal(a.cad.an,0);
 close(Motor.classicAltSpread({sf:0},0),Math.tan(1.9*Math.PI/180),1e-12,'first burst 1.9 deg');close(Motor.classicAltSpread({sf:0,cr:true},0),Math.tan(1.71*Math.PI/180),1e-12,'crouched 1.71');
 close(Motor.classicAltSpread({sf:1},0),Math.tan(3.4*Math.PI/180),1e-12,'running +1.5');close(Motor.classicAltSpread({air:true},2),Math.tan(8.03*Math.PI/180),1e-12,'max + airborne 2.25');
 s.time=a.fireAt;a.triggerHeld=false;s.command(a,{t:'in',seq:2,r:0,p:-.05,fire:1,alt:1});s.fire(a);assert.equal(a.cad.an,1,'back-to-back burst steps the spread');assert.equal(a.ammo,6);
 s.time+=2;a.triggerHeld=false;a.ammo=2;s.command(a,{t:'in',seq:3,r:0,p:-.05,fire:1,alt:1});s.fire(a);assert.equal(a.ammo,0,'2 left: 2 rounds');assert.equal(a.cad.an,0,'a pause resets the steps');
 s.time+=2;a.triggerHeld=false;a.ammo=12;s.command(a,{t:'in',seq:4,r:0,p:-.05,fire:1});s.events.length=0;s.fire(a);assert.equal(a.ammo,11,'primary click: one round');close(a.fireAt-s.time,1/6.75,1e-9,'primary 6.75/s');}
// ---- Bucky ALT FIRE: canister inside 7.5 m = 40 / 20 / 15 only; past it 5 pellets from the burst point ----
{const shot=(z,pitch,wall=Infinity)=>{const W=world();W.ray=(o,d,max)=>wall<=max?wall:Infinity;const s=new Simulation(W,'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);a.human=b.human=true;
  Object.assign(a,{weapon:'Bucky',ammo:5,x:0,y:0,z:0,look:0,pitch,fireAt:0,protectedUntil:0});Object.assign(b,{x:0,y:0,z,protectedUntil:0,armor:0,hp:500,alive:true});
  s.command(a,{t:'in',seq:1,r:0,p:pitch,fire:1,ads:1});s.events.length=0;s.fire(a);return {dmg:500-b.hp,hits:s.events.filter(e=>e[0]==='h').map(e=>e[5]),ammo:a.ammo};};
 const body=Math.atan2(-.45,5),head=Math.atan2(.05,5),legs=Math.atan2(-1.05,5);
 assert.deepEqual(shot(-5,body),{dmg:20,hits:[20],ammo:4},'canister body at 5 m: 20, no pellets');
 assert.deepEqual(shot(-5,head).hits,[40],'canister head at 5 m: 40');assert.deepEqual(shot(-5,legs).hits,[15],'canister legs at 5 m: 15');
 assert.deepEqual(shot(-5,body,3).hits,[],'a wall at 3 m stops the canister');
 const far=shot(-9,Math.atan2(-.45,9));assert.ok(far.hits.length>=1&&far.hits.length<=5,'past 7.5 m: up to 5 pellets: '+JSON.stringify(far.hits));assert.ok(far.hits.every(h=>h===17||h===34||h===14),'pellets 1.5 m from the burst point: the 0-8 m row (17 / 34 / 14): '+JSON.stringify(far.hits));
 const pri=(()=>{const s=new Simulation(world(),'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);a.human=b.human=true;Object.assign(a,{weapon:'Bucky',ammo:5,x:0,y:0,z:0,look:0,pitch:body,fireAt:0,protectedUntil:0});Object.assign(b,{x:0,y:0,z:-5,protectedUntil:0,armor:0,hp:500});s.command(a,{t:'in',seq:1,r:0,p:body,fire:1});s.events.length=0;s.fire(a);return s.events.filter(e=>e[0]==='h').length;})();
 assert.ok(pri>5,'primary fire still 15 pellets from the muzzle ('+pri+' hits at 5 m)');}
// ---- instant casts: the gun is down for unequip + fast re-equip from the press ----
assert.deepEqual(INSTANT_UNEQUIP,{Jett:'ce',Reyna:'qe'});assert.deepEqual([UNEQUIP.Jett,UNEQUIP.Reyna],[{c:.25,e:.2},{c:.5,q:.5,e:.6}],'wiki Unequip times');
assert.equal(recoverTime('Jett','c','Vandal'),.85);assert.equal(recoverTime('Jett','e','Vandal'),.8);assert.equal(recoverTime('Reyna','q','Classic'),.95);assert.equal(recoverTime('Reyna','e','Operator'),1.5);
{const W={...world(),map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0},s=new SpikeSimulation(W),a=s.add('j','Jett'),r=s.add('r','Reyna');s.start(false);s.buy=0;s.time=3;
 Object.assign(a,{weapon:'Vandal',ammo:25,fireAt:0});a.ability.c=2;assert.equal(s.command(a,{t:'ab',k:'c'}),true,'Cloudburst cast');close(a.fireAt,s.time+.85,1e-9,'Cloudburst + Vandal: 0.25 + 0.6');assert.equal(s.fire(a),false,'no fire while the gun is away');
 a.fireAt=0;a.ability.e=1;a.ability.cool={};assert.equal(s.command(a,{t:'ab',k:'e'}),true,'Tailwind armed');assert.equal(a.fireAt,0,'arming Tailwind keeps the gun up');
 s.time+=1.1;a.ability.cool={};assert.equal(s.command(a,{t:'ab',k:'e'}),true,'Tailwind dash');close(a.fireAt,s.time+.8,1e-9,'dash + Vandal: 0.2 + 0.6');
 Object.assign(r,{weapon:'Classic',ammo:12,fireAt:0,x:0,y:0,z:0});r.ability.q=2;s.effects.push({id:++s.effectSeq,kind:'soul',owner:r.id,team:r.team,p:[0,1.2,-2],until:s.time+3,radius:0});
 assert.equal(s.command(r,{t:'ab',k:'q'}),true,'Devour');close(r.fireAt,s.time+.95,1e-9,'Devour + Classic: 0.5 + 0.45');
 r.fireAt=0;r.ability.cool={};s.effects.push({id:++s.effectSeq,kind:'soul',owner:r.id,team:r.team,p:[0,1.2,-2],until:s.time+3,radius:0});r.devour=null;
 assert.equal(s.command(r,{t:'ab',k:'e'}),true,'Dismiss');close(r.fireAt,s.time+1.05,1e-9,'Dismiss + Classic: 0.6 + 0.45');
 r.fireAt=0;r.ability.cool={};assert.equal(s.command(r,{t:'ab',k:'q'}),false,'no orb: no cast');assert.equal(r.fireAt,0,'a refused cast keeps the gun up');}
console.log('weapon cadence: Bulldog / Stinger ADS bursts (wiki rows = API averages, finish once started, reload ends), Odin spin-up 12 -> 15.6 (ADS at once), Classic alt 3 at once + wiki spread, Bucky air burst (canister 40 / 20 / 15 inside 7.5 m, wall stops it, 5 pellets from the burst point), instant-cast unequip (Cloudburst / Tailwind dash / Devour / Dismiss) ok');
