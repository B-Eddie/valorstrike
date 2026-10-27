// Character collision (user: "there's supposed to be collisions between characters"; players and bots walked through each
// other). VALORANT: every living character, teammate or enemy, is a solid capsule - nobody walks through another, a walk into
// one stops at the contact and slides around it, nobody is shoved by someone walking into them, a unit dropping onto a head
// slides off. Shared motor (server/src/motor.cjs == vendor/valorant-feel.js): C.bodyR, bodies() after the mover's own step,
// bodySteer() for bots (pass on the right when someone is in the way). Server: Simulation (tdm / dm) and SpikeSimulation
// (round + buy phase, spike.js motor()) run it for every unit; the page runs the same call for its player's prediction.
//  1. Simulation, two humans, flat world: a walk into a standing unit stops at 2 x bodyR (server 0.05 s ticks), the standing
//     unit is not moved; a walk 0.3 m off-centre slides past; a head-on walk stops both, no jitter, nobody pushed through.
//  2. Bots (server bodySteer): two bots walking head-on pass each other in the open and in a 2 m corridor, never overlapping.
//  3. SpikeSimulation: the same walk-in in the round and in the buy phase (humans and buy-phase bots).
//  4. Dead units, loading units and Reyna's Dismiss (intangible) do not block.
//  5. Motor.bodies unit rules: pre-existing overlap eased apart at C.bodySep m/s, exactly stacked units separate, the push never
//     enters world collision, the velocity into the other unit is removed, no contact across heights (a unit on a ledge above),
//     dropping onto a head slides off.
//  6. Offline = online: Motor.step + Motor.bodies driven directly (what the page's moveP predicts) = the server Simulation, tick by tick.
import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {Simulation,weapons} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';
const require=createRequire(import.meta.url),Motor=require('./src/motor.cjs');
assert.equal(fs.readFileSync(new URL('./src/motor.cjs',import.meta.url),'utf8'),fs.readFileSync(new URL('../vendor/valorant-feel.js',import.meta.url),'utf8'),'motor pair identical');
const R=.35,MIN=2*R-1e-6,EAST=-Math.PI/2,WEST=Math.PI/2;/* look r walks (-sin r, -cos r): r = -pi/2 walks +x */
const flat=(blocked=()=>false)=>({map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked,ray:()=>Infinity});
const place=(u,x,z)=>Object.assign(u,{x,y:0,z,vx:0,vy:0,vz:0,ch:0,air:false,input:{},protectedUntil:0,invulnerableUntil:0});
let seq=1;const walk=(s,u,look,f=1)=>s.command(u,{t:'in',seq:seq++,r:look,p:0,f});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// 1. Simulation, humans
{const s=new Simulation(flat(),'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);place(a,0,0);place(b,3,0);let min=Infinity;
 for(let k=0;k<40;k++){walk(s,a,EAST);s.step(.05);min=Math.min(min,dist(a,b));}
 assert(min>=MIN,`walk into a standing unit: never closer than 2 x bodyR (min ${min.toFixed(3)} m, ${(dist(a,b)).toFixed(3)} at the end)`);
 assert(Math.abs(b.x-3)<1e-9&&Math.abs(b.z)<1e-9,`the standing unit is not shoved (${b.x.toFixed(4)}, ${b.z.toFixed(4)})`);
 assert(a.x>3-2*R-.05,`the walker reaches the contact (${a.x.toFixed(3)})`);
 assert(Math.abs(a.vx)<.05,`no velocity left into the other unit (${a.vx.toFixed(3)})`);
 // off-centre: slides around and carries on
 place(a,0,.3);place(b,3,0);min=Infinity;for(let k=0;k<40;k++){walk(s,a,EAST);s.step(.05);min=Math.min(min,dist(a,b));}
 assert(min>=MIN,`off-centre walk: never inside (min ${min.toFixed(3)})`);assert(a.x>4,`off-centre walk slides past (x ${a.x.toFixed(2)})`);
 assert(Math.abs(b.x-3)<1e-9&&Math.abs(b.z)<1e-9,'off-centre: the standing unit is not shoved');
 // head-on: both stop at the contact, no jitter, nobody through
 place(a,0,0);place(b,3,0);min=Infinity;const tail=[];for(let k=0;k<40;k++){walk(s,a,EAST);walk(s,b,WEST);s.step(.05);min=Math.min(min,dist(a,b));if(k>=30)tail.push([a.x,b.x]);}
 assert(min>=MIN,`head-on humans: never inside (min ${min.toFixed(3)})`);assert(a.x<b.x,'head-on humans: nobody walks through');
 const jit=Math.max(...tail.map(t=>Math.abs(t[0]-tail[0][0])+Math.abs(t[1]-tail[0][1])));assert(jit<.02,`head-on humans settle (jitter ${jit.toFixed(4)} m)`);}
// 2. bots pass each other (server bodySteer)
const botRun=(blocked,label,zA=0,zB=0,secs=4)=>{const s=new Simulation(flat(blocked),'tdm','ascent',()=>.5),a=s.add('a',undefined,false),b=s.add('b',undefined,false);s.start(false);
 place(a,0,zA);place(b,4,zB);const goal=new Map([[a,8],[b,-4]]);s.bot=u=>{const g=goal.get(u);u.look=g>u.x?EAST:WEST;u.input={forward:Math.abs(g-u.x)>.3?1:0};u.inputAt=s.time;};
 let min=Infinity,t=0;for(;t<secs&&!(a.x>5&&b.x<-1);t+=.05){s.step(.05);min=Math.min(min,dist(a,b));}
 assert(a.x>5&&b.x<-1,`${label}: the bots pass each other within ${secs} s (a ${a.x.toFixed(2)}, ${a.z.toFixed(2)} / b ${b.x.toFixed(2)}, ${b.z.toFixed(2)})`);
 assert(min>=MIN,`${label}: never inside each other (min ${min.toFixed(3)})`);return t;};
botRun(()=>false,'open floor, head-on');botRun(()=>false,'open floor, slightly off-centre',.05,0);
botRun((x,z,r)=>Math.abs(z)>1-r,'2 m corridor, head-on');
// 3. SpikeSimulation: round and buy phase
{const s=new SpikeSimulation(flat(),'five','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);s.buy=0;place(a,0,0);place(b,3,0);b.team=a.team;let min=Infinity;
 for(let k=0;k<40;k++){walk(s,a,EAST);s.step(.05);min=Math.min(min,dist(a,b));}
 assert(min>=MIN,`spike round: walk into a teammate stops at the contact (min ${min.toFixed(3)})`);assert(Math.abs(b.x-3)<1e-9,'spike round: the teammate is not shoved');
 s.buy=30;place(a,0,0);place(b,3,0);min=Infinity;for(let k=0;k<40;k++){walk(s,a,EAST);s.step(.05);min=Math.min(min,dist(a,b));}
 assert(min>=MIN,`spike buy phase: walk into a teammate stops at the contact (min ${min.toFixed(3)})`);}
// 4. dead / loading / Dismiss do not block
{const s=new Simulation(flat(),'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);
 for(const [label,set] of [['dead',u=>{u.alive=false;u.respawnAt=1e9;}],['loading',u=>{u.loading=true;}],['Dismiss (intangible)',u=>{u.dismissUntil=1e9;}]]){
  place(a,0,0);place(b,3,0);b.alive=true;b.loading=false;b.dismissUntil=0;set(b);for(let k=0;k<40;k++){walk(s,a,EAST);s.step(.05);}
  assert(a.x>4,`${label} unit does not block (x ${a.x.toFixed(2)})`);
  place(a,0,0);place(b,3,0);b.alive=true;b.loading=false;b.dismissUntil=0;a.dismissUntil=s.time+100;for(let k=0;k<40;k++){walk(s,a,EAST);s.step(.05);}a.dismissUntil=0;
  assert(a.x>4,`a Dismissed walker passes through (x ${a.x.toFixed(2)})`);}}
// 5. Motor.bodies rules
assert.equal(typeof Motor.bodies,'function','Motor.bodies');assert.equal(typeof Motor.bodySteer,'function','Motor.bodySteer');assert.equal(Motor.C.bodyR,R,'C.bodyR');
const W0={ground:()=>0,blocked:()=>false},unit=(x,z,y=0)=>({x,y,z,vx:0,vy:0,vz:0,ch:0});
{const P=unit(0,0),Q=unit(.3,0);const x0=P.x;Motor.bodies(P,[Q],.05,W0,0,0);assert(Math.abs(x0-P.x-Motor.C.bodySep*.05)<1e-9&&P.x<0,`old overlap eased at bodySep (moved ${(x0-P.x).toFixed(4)})`);
 let n=0;while(dist(P,Q)<2*R-1e-9&&n<100){Motor.bodies(P,[Q],.05,W0,P.x,P.z);n++;}assert(n<=6,`old overlap gone within 0.3 s (${n} ticks)`);assert(Math.abs(dist(P,Q)-2*R)<1e-9,'eased to exactly the contact');}
{const P=unit(1,1),Q=unit(1,1);for(let k=0;k<20;k++)Motor.bodies(P,[Q],.05,W0,P.x,P.z);assert(dist(P,Q)>=2*R-1e-9,'stacked units separate');}
{const P=unit(0,0),Q=unit(.5,0);P.vx=4;P.vz=1;Motor.bodies(P,[Q],.05,W0,-.3,0);assert(Math.abs(P.x-(.5-2*R))<1e-9,`fresh overlap undone at once (x ${P.x})`);assert(Math.abs(P.vx)<1e-9&&Math.abs(P.vz-1)<1e-9,`velocity into the unit removed, sideways kept (${P.vx}, ${P.vz})`);}
{const wall={ground:()=>0,blocked:(x,z,r)=>x<-.25+r-1e-9};const P=unit(.15,0),Q=unit(.55,0);Motor.bodies(P,[Q],.05,wall,.4,0);assert(P.x===.15,`no push into world collision (x ${P.x})`);
 const P2=unit(.15,.05),Q2=unit(.55,.2);Motor.bodies(P2,[Q2],.05,wall,.15,.05);assert(P2.x===.15&&P2.z<.05,`blocked axis dropped, the free axis still pushes (${P2.x}, ${P2.z})`);}
{const P=unit(0,0),Q=unit(.2,0,1.75);Motor.bodies(P,[Q],.05,W0,0,0);assert(P.x===0,'a unit standing above the head does not collide');const Q2=unit(.2,0,-1.75);Motor.bodies(P,[Q2],.05,W0,0,0);assert(P.x===0,'nor one below the feet');
 const top=unit(.05,0,1.6),under=unit(0,0);let k=0;for(;k<40&&dist(top,under)<2*R;k++)Motor.bodies(top,[under],.05,W0,top.x,top.z);assert(k<=6,`dropped onto a head: slides off (${k} ticks)`);}
{const P=unit(0,0),Q=unit(.8,0);const [x,z]=Motor.bodySteer(P,[Q],1,0);assert(z>.3&&Math.abs(Math.hypot(x,z)-1)<1e-9,`steer: someone ahead -> pass on the right, same speed (${x.toFixed(3)}, ${z.toFixed(3)})`);
 assert.deepEqual(Motor.bodySteer(P,[unit(1,1.5)],1,0),[1,0],'steer: nobody in the way -> unchanged');assert.deepEqual(Motor.bodySteer(P,[unit(1.2,0)],1,0),[1,0],'steer: someone ahead but not about to be bumped -> unchanged (a bot only sidesteps whoever it is about to bump)');assert.deepEqual(Motor.bodySteer(P,[unit(-1,0)],1,0),[1,0],'steer: someone behind -> unchanged');
 const [,zl]=Motor.bodySteer(P,[unit(.8,.2)],1,0);assert(zl<0,'steer: someone ahead on the right -> pass on the left');}
// 6. offline = online
{const s=new Simulation(flat(),'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);place(a,0,.2);place(b,2.5,0);const P=unit(0,.2),Q={x:2.5,y:0,z:0,ch:0};let worst=0;
 for(let k=0;k<30;k++){walk(s,a,EAST);s.step(.05);const ox=P.x,oz=P.z;Motor.step(P,{x:1,z:0,speed:6.75*weapons[a.weapon].runSpeedMultiplier},.05,W0);Motor.bodies(P,[Q],.05,W0,ox,oz);worst=Math.max(worst,Math.hypot(P.x-a.x,P.z-a.z));}
 assert(worst<1e-9,`page prediction (Motor.step + Motor.bodies) = server tick by tick (worst ${worst})`);}
console.log('Character collision tests passed: walk-in stop / slide / head-on, bots pass (open, off-centre, corridor), spike round + buy, dead / loading / Dismiss, motor rules, prediction = server');
