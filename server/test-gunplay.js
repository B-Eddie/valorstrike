// Gunplay QA (server, two scripted units on a flat test world): armor-boundary shots-to-kill and the HP / armor the
// snapshot rows show after every shot, for every weapon x damage band x part x armor 0 / 25 / 50 against an exact
// integer model; headshot damage per weapon at each falloff band equals weapons.json; shotgun pellets (count, cone
// = tan(firstBulletAccuracy) + bloom, round in the shot's own basis); spray recoil (the shared motor's climb, reset after a
// pause or a weapon change, identical to the client's VF sequence for the same weight); a swap mid-reload cancels the
// reload (and a knife swap no longer fires the gun), G mid-reload drops the gun with its magazine; ammo refills between
// rounds; a dead enemy's gun picked up off the floor keeps its magazine and reserve; same-tick trades resolve in unit order.
import assert from 'node:assert/strict';import Motor from './src/motor.cjs';import {Simulation,weapons} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {hitVolumes} from './src/hitboxes.js';import {floorDrop,floorTick,floorDropHeld} from './src/floor.js';
const world=()=>({map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,-5]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity});
const aim=(o,p)=>{const q=p.map((n,i)=>n-o[i]);return {look:Math.atan2(-q[0],-q[2]),pitch:Math.atan2(q[1],Math.hypot(q[0],q[2]))};};
function duel(w,dist,armor,Sim=Simulation,rnd=()=>0){const s=new Sim(world(),'tdm','ascent',rnd),a=s.add('a'),b=s.add('b');s.start(false);if(s.buy!==undefined)s.buy=0;
 Object.assign(a,{team:0,x:0,y:0,z:0,weapon:w,ammo:999,fireAt:0,protectedUntil:0,input:{},vx:0,vz:0,sf:0,mv:false,cr:false});Object.assign(b,{team:1,x:0,y:0,z:-dist,look:0,armor,hp:100,protectedUntil:0,vx:0,vz:0,ch:0});return {s,a,b};}
const target=(b,part)=>part==='head'?hitVolumes(b).head.c:part==='body'?[b.x,1.2,b.z]:[b.x,.5,b.z];
// 1-2. Every weapon / band / part / armor: shots to kill and each shot's displayed HP / armor match the exact model
// (x100 integers: armor absorbs 66 % of the floored damage until it runs out).
let cases=0;
for(const [w,p] of Object.entries(weapons)){if(p.abilityOnly||w==='Knife')continue;const pel=Math.max(1,p.shotgunPelletCount||1);
 for(const R of p.damageRanges)for(const part of ['head','body','legs'])for(const armor of [0,25,50]){cases++;
  const dist=Math.min((R.rangeStartMeters+R.rangeEndMeters)/2,140),{s,a,b}=duel(w,dist,armor),D=Math.floor(R[part==='head'?'headDamage':part==='legs'?'legDamage':'bodyDamage']);
  let hp=10000,ar=armor*100,n=0;
  while(b.alive&&n<60){Object.assign(a,aim([0,1.6,0],target(b,part)),{fireAt:0,triggerHeld:false,spray:null});s.fire(a);n++;
   for(let k=0;k<pel&&hp>0;k++){const ab=Math.min(ar,D*66);ar-=ab;hp-=D*100-ab;}
   if(n===1&&part==='head'&&armor===0)assert.equal(100-b.hp,Math.min(100,D*pel),`${w} ${R.rangeStartMeters} m head: damage ${100-b.hp}, weapons.json ${D}x${pel}`);
   const row=s.rows().find(r=>r[0]===b.id);
   if(hp>0){assert(b.alive,`${w} ${R.rangeStartMeters} m ${part} armor ${armor}: died on shot ${n} with ${hp/100} hp left`);assert.equal(row[8],Math.ceil(hp/100),`${w} ${R.rangeStartMeters} m ${part} armor ${armor} shot ${n}: row hp ${row[8]} (raw ${b.hp}), exact ${hp/100}`);assert.equal(row[9],Math.ceil(ar/100),`${w} ${part} armor ${armor} shot ${n}: row armor ${row[9]} (raw ${b.armor}), exact ${ar/100}`);}
   else assert(!b.alive,`${w} ${R.rangeStartMeters} m ${part} armor ${armor}: alive after shot ${n} (hp ${b.hp}), exact model dead`);}}}
// 3. Shotgun pellets: count, cone and a round pattern in the shot's own basis, whatever the facing.
for(const w of ['Shorty','Bucky','Judge'])for(const look of [0,Math.PI/2,2.2]){let i=0;const rnd=()=>((i=i*1103515245+12345>>>0)%100000)/100000;const {s,a}=duel(w,5,0,Simulation,rnd);a.look=look;a.pitch=0;
 const dirs=[];s.traceShot=(o,d)=>{dirs.push([...d]);return Infinity;};s.fire(a);const p=weapons[w],cone=Motor.spread(a,w,p);
 assert.equal(dirs.length,p.shotgunPelletCount,w+' pellet count');const f=[-Math.sin(look),0,-Math.cos(look)],r=[Math.cos(look),0,-Math.sin(look)];
 let h=0,v=0;for(const d of dirs){const fw=d[0]*f[0]+d[2]*f[2],x=(d[0]*r[0]+d[2]*r[2])/fw,y=d[1]/fw;assert(Math.hypot(x,y)<=cone*1.0001,`${w} pellet outside the cone (${Math.hypot(x,y)} > ${cone})`);h=Math.max(h,Math.abs(x));v=Math.max(v,Math.abs(y));}
 assert(h>cone*.5&&v>cone*.5,`${w} facing ${look}: pellet pattern not round (h ${h.toFixed(4)} v ${v.toFixed(4)} cone ${cone.toFixed(4)})`);}
// 4. Spray: the climb follows the shared motor (same numbers as the client's gFire for the same weight), resets after a
// .375 s pause or a weapon change; crouch / ADS scale it.
{const {s,a}=duel('Vandal',10,0);const pitches=[];s.traceShot=(o,d)=>{pitches.push(Math.atan(d[1]/-d[2]));return Infinity;};
 const R={},want=[];const shoot=(t)=>{s.time=t;a.fireAt=0;a.triggerHeld=false;a.look=0;a.pitch=0;s.fire(a);};
 for(let n=0;n<12;n++){shoot(1+n*.1026);Motor.sprayReset(R,'Vandal',1+n*.1026);Motor.sprayStep(R,'Vandal',1,1+n*.1026,()=>.9);want.push(R.recoilY);}
 for(let n=0;n<12;n++)assert(Math.abs(Math.tan(pitches[n])-want[n])<1e-9,`Vandal shot ${n}: climb ${Math.tan(pitches[n])}, motor ${want[n]}`);
 assert(want[11]>.035&&want[0]===0,'the spray climbs');shoot(1+11*.1026+.4);assert(Math.abs(pitches.at(-1))<1e-9,'a .4 s pause resets the spray');
 shoot(5);shoot(5.1);assert(pitches.at(-1)>.005,'second shot climbs');a.weapon='Phantom';shoot(5.2);assert(Math.abs(pitches.at(-1))<1e-9,'a weapon change resets the spray');
 a.weapon='Vandal';a.cr=true;shoot(8);shoot(8.1);assert(Math.abs(Math.tan(pitches.at(-1))-.006*.85)<1e-9,'crouched climb x.85');
 assert.deepEqual(Object.keys(Motor.REC).sort(),Object.keys(weapons).filter(w=>w!=='Knife'&&!weapons[w].abilityOnly).sort(),'recoil weight for every gun');}
// 5. Swap mid-reload (Spike mode and TDM): the equip is taken, the reload cancelled, the magazine unchanged; a knife
// swap mid-reload no longer leaves the gun in the server's hands (the client's knife click fired it).
for(const Sim of [SpikeSimulation,Simulation]){const {s,a}=duel('Vandal',10,0,Sim);s.remaining=200;/* TDM: rifles unlocked */if(Sim===SpikeSimulation){a.primary='Vandal';a.secondary='Classic';}a.ammo=5;a.reserve=50;a.inventory={Vandal:5};a.reserves={Vandal:50};a.equipAt=0;
 assert(s.command(a,{t:'reload'}));assert(a.reloadAt>0);assert(s.command(a,{t:'equip',w:'Classic'}),Sim.name+': swap mid-reload refused');assert.equal(a.weapon,'Classic');assert.equal(a.reloadAt,0);assert.equal(a.inventory.Vandal,5);
 s.time=a.equipAt+.01;assert(s.command(a,{t:'equip',w:'Vandal'}));assert.equal(a.ammo,5,'magazine as it was');s.time=a.equipAt+.01;assert(s.command(a,{t:'reload'}));assert(s.command(a,{t:'equip',w:'Knife'}),Sim.name+': knife swap mid-reload refused');
 s.time=a.equipAt+.01;a.input={fire:true};s.fire(a);assert.equal(a.weapon,'Knife');assert.equal(a.inventory.Vandal,5,'the knife click did not fire the Vandal');s.time+=10;s.step(.05);assert.equal(a.inventory.Vandal,5,'no reload completed in the holster');}
// 6. G mid-reload drops the gun with its magazine; ammo refills next round; an enemy's dropped gun keeps its ammo.
{const {s,a,b}=duel('Vandal',3,0,SpikeSimulation);a.primary='Vandal';a.secondary='Classic';a.ammo=4;a.reserve=40;s.roundDelay=0;s.command(a,{t:'reload'});
 assert(floorDropHeld(s,a),'G mid-reload drops the gun');const d=s.floor.at(-1);assert.equal(d.w,'Vandal');assert.equal(d.ammo,4);assert.equal(d.reserve,40);assert.equal(a.reloadAt,0);assert.equal(a.weapon,'Classic');
 s.floor=[];Object.assign(b,{primary:'Phantom',secondary:'Classic',weapon:'Phantom',ammo:7,reserve:13,inventory:{Phantom:7},reserves:{Phantom:13},hp:0,alive:false});floorTick(s);const g=s.floor.find(x=>x.w==='Phantom');assert(g&&g.ammo===7&&g.reserve===13,'dead enemy drops the Phantom with 7 / 13');
 a.primary=null;Object.assign(a,{x:g.x,z:g.z,y:g.y,alive:true});floorTick(s);assert.equal(a.primary,'Phantom');assert.equal(a.weapon,'Phantom');assert.equal(a.ammo,7);assert.equal(a.reserve,13);
 a.reloadAt=0;assert(s.command(a,{t:'reload'}));s.time=a.reloadAt;s.finishReload(a);assert.equal(a.ammo,20);assert.equal(a.reserve,0,'reload takes from the picked-up reserve');}
{const s=new SpikeSimulation(world(),'five','ascent',()=>0),a=s.add('a');s.start(false);a.primary='Vandal';a.secondary='Sheriff';a.weapon='Vandal';a.ammo=3;a.reserve=10;a.inventory={Vandal:3,Sheriff:1};a.reserves={Vandal:10,Sheriff:0};
 const r0=s.round;s.finishRound(a.team===s.atk?0:1,'QA');for(let i=0;i<400&&s.round===r0;i++)s.step(.05);assert(s.round>r0,'next round');
 assert.equal(a.weapon,'Vandal');assert.equal(a.ammo,25);assert.equal(a.reserve,50);s.time=a.equipAt+.01;assert(s.command(a,{t:'equip',w:'Sheriff'}));assert.equal(a.ammo,6,'holstered sidearm refilled');assert.equal(a.reserve,24,'Sheriff reserve 24 (wiki)');}
// 7. Same-tick trades: both lethal, shots resolve after both moved; the dead one cannot fire back that tick, and the first
// shooter rotates tick to tick (it was always the first unit in the list, i.e. the room creator).
{const {s,a,b}=duel('Operator',10,0);const wins=[];
 for(let n=0;n<4;n++){Object.assign(a,{alive:true,hp:100,armor:0,x:0,z:0,weapon:'Operator',ammo:5,fireAt:0,triggerHeld:false,protectedUntil:0,human:true,input:{fire:true},inputAt:s.time+.05,vx:0,vz:0},aim([0,1.6,0],[0,1.2,-10]));
  Object.assign(b,{alive:true,hp:100,armor:0,x:0,z:-10,weapon:'Operator',ammo:5,fireAt:0,triggerHeld:false,protectedUntil:0,human:true,input:{fire:true},inputAt:s.time+.05,vx:0,vz:0},aim([0,1.6,-10],[0,1.2,0]));
  s.step(.05);assert.equal(a.alive+b.alive,1,'exactly one survives a same-tick trade');wins.push(a.alive?'a':'b');}
 assert(wins.includes('a')&&wins.includes('b'),'the first shooter rotates: '+wins.join(''));}
console.log(`Gunplay: ${cases} weapon x band x part x armor cases (shots-to-kill and every shot's row HP / armor exact, headshot damage per band = weapons.json), shotgun pellet count / cone / round pattern at 3 facings, spray climb = shared motor (pause / weapon reset, crouch), swap and knife mid-reload cancel the reload, G mid-reload, enemy gun pickup keeps ammo, ammo refill next round, same-tick trades (one survivor, first shooter rotates)`);
