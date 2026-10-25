import assert from 'node:assert/strict';import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,smokeBlocks,SMOKE} from './src/abilities.js';import {hitVolumes,rayHit,HITBOX} from './src/hitboxes.js';
// A slab wall between zA and zB (zA > zB), DoubleSide like the BVH: distance to the nearest face along the ray.
const slab=(zA,zB)=>(o,d,max=Infinity)=>{let best=Infinity;for(const z of [zA,zB]){if(Math.abs(d[2])<1e-9)continue;const t=(z-o[2])/d[2];if(t>=1e-6&&t<best)best=t;}return best<max?best:Infinity;};
const world=(ray=()=>Infinity)=>({map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,-5]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray});
const aim=(o,p)=>{const q=p.map((n,i)=>n-o[i]);return {look:Math.atan2(-q[0],-q[2]),pitch:Math.atan2(q[1],Math.hypot(q[0],q[2]))};};
function duel(ray,weapon='Vandal',Sim=Simulation,mode='tdm'){const s=new Sim(world(ray),mode,'ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);if(s.buy!==undefined)s.buy=0;Object.assign(a,{team:0,x:0,y:0,z:0,weapon,ammo:30,fireAt:0,protectedUntil:0,input:{},vx:0,vz:0});Object.assign(b,{team:1,x:0,y:0,z:-10,look:0,armor:0,hp:100,protectedUntil:0,vx:0,vz:0,ch:0});return {s,a,b};}
const shootAt=(s,a,p)=>{Object.assign(a,aim([a.x,a.y+1.6-(a.ch||0),a.z],p),{fireAt:0,triggerHeld:false});return s.fire(a);};

// 1. Hit volumes follow the rendered pose: head sits on the rendered Head bone (forward of the root, above the eye).
{const v={x:0,y:0,z:0,look:0,ch:0},H=hitVolumes(v),P=HITBOX.poses.stand;assert.ok(Math.abs(H.head.c[1]-(P.head[1]+.08))<1e-9);assert.ok(H.head.c[2]<-.1,'head is forward (facing -Z) of the root');
 const turned=hitVolumes({...v,look:Math.PI/2});assert.ok(turned.head.c[0]<-.1&&Math.abs(turned.head.c[2])<.05,'head offset rotates with facing');
 const crouched=hitVolumes({...v,ch:.45});assert.ok(Math.abs(H.head.c[1]-crouched.head.c[1]-.45)<1e-9,'crouch drops the head with the eye');assert.ok(crouched.head.c[2]<H.head.c[2],'crouch leans the head further forward');assert.ok(crouched.body.b[1]<H.body.b[1]);
 const run=hitVolumes({...v,vx:0,vz:-6.75});assert.ok(run.head.c[2]<H.head.c[2]-.05,'running leans the head forward');assert.equal(hitVolumes({...v,air:true}).pose,'air');
 assert.equal(rayHit(v,[0,H.head.c[1],5],[0,0,-1]).part,'head');assert.equal(rayHit(v,[0,1,5],[0,0,-1]).part,'body');assert.equal(rayHit(v,[0,.5,5],[0,0,-1]).part,'legs');assert.equal(rayHit(v,[1,1,5],[0,0,-1]),null);}
// 2. Authoritative shots: standing-head aim misses a crouched target's head; aiming at the crouched head is a headshot.
{const {s,a,b}=duel();shootAt(s,a,hitVolumes(b).head.c);assert.equal(b.alive,false,'standing head aim kills');}
{const {s,a,b}=duel();const head=hitVolumes(b).head.c;b.ch=.45;shootAt(s,a,head);assert.equal(b.hp,100,'standing head height passes over a crouched target');s.time+=1;shootAt(s,a,hitVolumes(b).head.c);assert.equal(b.alive,false,'crouched head aim kills (Vandal headshot)');assert.ok(s.events.some(e=>e[0]==='k'&&e[3]===1));}
// 3. Wall penetration by official tier: a 0.3 m wall at z -4.85..-5.15.
{const wall=slab(-4.85,-5.15),body=[0,1,-10];
 const v=duel(wall,'Vandal');shootAt(v.s,v.a,body);assert.equal(v.b.hp,100-Math.floor(40*.5),'Medium tier passes 0.3 m at 50%');
 const sp=duel(wall,'Spectre');shootAt(sp.s,sp.a,body);assert.equal(sp.b.hp,100,'Low tier (0.15 m) is stopped');
 const thick=slab(-4.5,-5.5),o=duel(thick,'Odin');shootAt(o.s,o.a,body);assert.equal(o.b.hp,100,'1 m wall stops everything');
 const mid=slab(-4.75,-5.25),od=duel(mid,'Odin');shootAt(od.s,od.a,body);assert.equal(od.b.hp,100-Math.floor(38*.75),'High tier passes 0.5 m at 75%');
 const kn=duel(wall,'Knife');kn.b.z=-1.2;shootAt(kn.s,kn.a,[0,1,-1.2]);assert.ok(kn.b.hp<100,'knife unaffected');}
// 4. Sage barrier stops bullets (no wallbang) and takes the damage instead.
{const {s,a,b}=duel(undefined,'Odin',SpikeSimulation,'five');s.effects.push({id:9,kind:'barrier',p:[0,0,-5],yaw:0,hp:600,until:99});shootAt(s,a,[0,1,-10]);assert.equal(b.hp,100);assert.ok(s.effects[0].hp<600);}
// 5. Smoke volume matches the render (radius 4, centred 1.8 m above its floor) and blocks bot sight both ways.
{const s=new SpikeSimulation(world(),'five','ascent',()=>.5);s.effects=[{kind:'smoke',p:[0,.1,-5],until:99,radius:SMOKE.radius}];s.time=0;
 assert.equal(smokeBlocks(s,[0,1.6,0],[0,0,-1],10),true);assert.equal(smokeBlocks(s,[0,1.6,-5],[1,0,0],1),true,'standing inside smoke blocks sight out');assert.equal(smokeBlocks(s,[6,1.6,0],[0,0,-1],10),false);
 const t=duel(undefined,'Vandal',SpikeSimulation,'five'),bot=t.s.units.find(u=>u.name==='b');bot.human=false;t.a.human=false;Object.assign(bot,{reactionAt:0});t.s.effects.push({id:3,kind:'smoke',p:[0,.1,-5],until:99,radius:4});t.s.time=1;t.s.bot(bot);assert.equal(!!bot.input.fire,false,'bot does not fire through smoke');assert.equal(bot.sawTarget,false);
 t.s.effects=[];t.s.time+=1;t.s.bot(bot);assert.equal(bot.sawTarget,true);assert.equal(!!bot.input.fire,true,'bot fires with clear sight');
 // Nearest enemy is the one checked (not merely the first listed enemy).
 const far=t.s.add('far');Object.assign(far,{team:0,x:30,y:0,z:-10,alive:true});t.s.units.unshift(t.s.units.pop());t.s.effects=[{id:4,kind:'smoke',p:[0,.1,-5],until:99,radius:4}];t.s.bot(bot);assert.equal(bot.sawTarget,false,'smoke between the bot and its nearest target blocks it');}
// 6. Flash: needs line of sight (geometry, barrier, smoke) and 3D facing.
{const mk=()=>{const s=new SpikeSimulation(world(),'five','ascent',()=>.5),o=s.add('o','Phoenix'),v=s.add('v');s.start(false);s.buy=0;Object.assign(o,{team:0,x:0,y:0,z:5});Object.assign(v,{team:1,x:0,y:0,z:0,look:0,pitch:0,ch:0,alive:true});s.effects=[{id:1,kind:'flash',owner:o.id,team:0,p:[0,2,-6],until:s.time+1,radius:30,at:s.time}];return {s,v};};
 let {s,v}=mk();tickAbilities(s,.05);assert.ok(v.blindUntil>s.time,'facing flash blinds');
 ({s,v}=mk());v.look=Math.PI;tickAbilities(s,.05);assert.ok(!(v.blindUntil>s.time),'facing away is not blinded');
 ({s,v}=mk());v.pitch=-1.3;tickAbilities(s,.05);assert.ok(!(v.blindUntil>s.time),'looking at the floor is not blinded');
 ({s,v}=mk());s.effects.push({id:2,kind:'smoke',p:[0,.1,-3],until:99,radius:4});tickAbilities(s,.05);assert.ok(!(v.blindUntil>s.time),'smoke blocks the flash');
 ({s,v}=mk());s.effects.push({id:2,kind:'barrier',p:[0,0,-3],yaw:0,hp:600,until:99});tickAbilities(s,.05);assert.ok(!(v.blindUntil>s.time),'barrier blocks the flash');}
// 7. Snapshot rows carry crouch fraction and aim pitch for remote rendering.
{const {s,a}=duel();a.ch=.45;a.pitch=-.25;const row=s.rows().find(r=>r[0]===a.id);assert.equal(row[17],1);assert.equal(row[18],-.25);}
console.log('Combat: pose-following head/body/legs volumes (facing, crouch, run, air), crouched headshots, official wall penetration tiers, barrier stops bullets, render-matched smoke blocks bot sight, flash LOS/facing, crouch/pitch rows');
