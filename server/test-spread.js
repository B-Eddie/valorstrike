// Spread and spray against VALORANT's published numbers (wiki.playvalorant.com/en-us/<Weapon>, "Spread values" tables and
// update history): first-shot spread standing / crouched, the movement penalties (crouch-walk / walk / run / airborne) for
// every gun, scoped snipers 0 only while still, spray error capped at the published max (Ares shrinks to its min), gun
// recovery time, and the running recoil multiplier. The airborne case is the "jump and the sniper is still accurate" report:
// a jumping scoped Operator was +10 deg and a running one +2.3 deg (every non-rifle used the pistol row); now +15 deg.
import assert from 'node:assert/strict';import Motor from './src/motor.cjs';import {SpikeSimulation} from './src/spike.js';import {weapons} from './src/simulation.js';
const deg=x=>Math.atan(x)*180/Math.PI,near=(a,b,m)=>assert(Math.abs(a-b)<1e-9,`${m}: ${a} vs ${b}`);
// [first stand, first crouch, crouch-walk, walk, run, airborne] (+ADS first stand / crouch), degrees, from the wiki tables.
const WIKI={Classic:[.4,.3,.5,1.1,2.3,7],Shorty:[4,3.4,.5,1,2,4],Frenzy:[.65,.55,.5,.8,2,7],Ghost:[.3,.23,.5,1.1,2.3,7],Sheriff:[.25,.19,.5,1.2,3,7],Stinger:[.65,.55,.15,1,2.5,10,.35,.26],Spectre:[.4,.34,.15,1,2.5,10,.25,.21],
 Bucky:[3,2.55,.5,1,2,4],Judge:[2.5,2.12,.5,1,2,4],Bulldog:[.3,.26,.8,3,6,10,.1,.08],Guardian:[.1,.09,.8,3,6,10,0,0],Phantom:[.2,.17,.8,3,6,10,.11,.09],Vandal:[.25,.21,.8,3,6,10,.157,.13],
 Marshal:[1,.9,7.5,10,15,20,0,0],Outlaw:[3.5,3.15,7.5,10,15,20,0,0],Operator:[5,4.5,7.5,10,15,15,0,0],Ares:[1,.6,.4,3,6.5,10,.9,.54],Odin:[.8,.48,.4,3,6.5,10,.79,.47]};
// 1. Every gun, every state, hip and ADS / scoped.
for(const [w,T] of Object.entries(WIKI)){const p=weapons[w];for(const ads of T.length>6?[0,1]:[0]){const f=ads?T[6]:T[0],fc=ads?T[7]:T[1],s=st=>deg(Motor.spread({...st,ads},w,p)),tag=w+(ads?' ADS':'');
 near(s({sf:0}),f,tag+' first shot');near(s({sf:0,cr:1}),fc,tag+' crouched first shot');near(s({sf:.5,cr:1}),fc+T[2],tag+' crouch-walk');near(s({sf:.5,wk:1}),f+T[3],tag+' walk');near(s({sf:1}),f+T[4],tag+' run');near(s({sf:1,air:true}),f+T[5],tag+' airborne');near(s({sf:0,air:true}),f+T[5],tag+' airborne, no horizontal speed');}}
// 2. Online: a scoped Operator fired at the top of a jump lands anywhere in the 15 deg airborne cone (and never outside
// it); the same shot standing still goes dead centre.
{const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 let seed=7;const rnd=()=>((seed=seed*1103515245+12345>>>0)%100000)/100000;const s=new SpikeSimulation(W,'five','ascent',rnd),a=s.add('a','Sova',true);s.add('b','Sage');s.start(false);s.buy=0;
 Object.assign(a,{human:true,primary:'Operator',weapon:'Operator',ammo:5,look:0,pitch:0});const dev=[];s.traceShot=(o,d)=>{dev.push(deg(Math.hypot(d[0],d[1])/-d[2]));return Infinity;};
 const shot=()=>{a.fireAt=0;a.triggerHeld=false;a.ammo=5;a.spray=null;a.look=0;a.pitch=0;a.input={ads:true};a.inputAt=s.time;s.fire(a);};
 shot();assert(dev[0]<1e-9,'scoped Operator standing still: dead centre');
 a.input={jump:true,ads:true};a.inputAt=s.time;s.step(.05);s.step(.05);assert(a.air,'airborne');assert.equal(a.alive,true);
 const air=[];for(let i=0;i<200;i++){const n=dev.length;shot();air.push(dev[n]);}
 assert(Math.max(...air)<=15+1e-6,'inside the 15 deg airborne cone ('+Math.max(...air)+')');assert(Math.max(...air)>12,'airborne shots reach the edge of the cone ('+Math.max(...air)+')');
 assert(air.filter(x=>x>5).length>150,'most airborne scoped shots miss a 5 deg window');}
// 3. Spray error: Vandal tops out at its 1.0 deg max standing (.85 crouched), Ares shrinks toward its .7 deg min; recovery times.
{for(const [w,cr,max] of [['Vandal',0,1],['Vandal',1,.85],['Phantom',0,.9],['Ares',0,.7],['Guardian',0,1.58]]){const R={},p=weapons[w],st={sf:0,cr};let cone=0;
  for(let n=0;n<40;n++){const t=1+n*.08;Motor.sprayReset(R,w,t);cone=Motor.spread(st,w,p)+Motor.sprayBloom(R,w,t);Motor.sprayStep(R,w,1,t,()=>.5,Motor.bloomCap(st,w,p));}
  near(deg(Motor.spread(st,w,p)+R.bloom),max,w+(cr?' crouched':'')+' spray error settles at the published max/min');assert(w==='Ares'?deg(cone)<1:deg(cone)<=max+1e-9,w+' cone never past it');}
 assert.deepEqual(['Vandal','Phantom','Bulldog','Guardian','Stinger'].map(Motor.recoveryTime),[.375,.35,.35,.35,.4]);}
// 4. Running recoil: a running Vandal / Phantom / Spectre climbs 1.8x (patch 6.11), Frenzy 1.5x; walking and crouching do not.
{for(const [w,k] of [['Vandal',1.8],['Phantom',1.8],['Spectre',1.8],['Frenzy',1.5],['Guardian',1]]){near(Motor.recoilMove({sf:1},w),k,w+' running');near(Motor.recoilMove({air:true},w),k,w+' airborne');near(Motor.recoilMove({sf:1,wk:1},w),1,w+' walking');near(Motor.recoilMove({sf:0},w),1,w+' still');}}
console.log('Spread: wiki first-shot / crouch / crouch-walk / walk / run / airborne for 18 guns hip + ADS; online jumping scoped Operator spreads over the 15 deg airborne cone, still = dead centre; spray error capped at the published max (Ares min); recovery times; running recoil x1.8 / x1.5');
