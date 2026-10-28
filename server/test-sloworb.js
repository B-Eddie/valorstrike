// Sage Slow Orb (wiki.playvalorant.com/en-us/Slow_Orb): "On cast she throws a slow orb as a projectile [Class 3] that detonates on contact with
// horizontal terrain"; 7 s field, 50 % slow. The orb flies the shared Class 3 arc (vendor/sova-bolt.cjs orb(): the uncharged bolt's 20 m/s,
// 12 m/s2), off a wall it drops to the floor below, and the field starts where and when it lands. Was: the field appeared at once at the
// first wall within 14 m (or 14 m ahead), on the floor.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,SLOW_ORB} from './src/abilities.js';import SovaBolt from '../vendor/sova-bolt.cjs';
const wall=(z)=>(o,d,max=Infinity)=>{const t=d[2]<0?(o[2]-z)/-d[2]:Infinity;return t>=0&&t<=max?t:Infinity;};
const mk=(ray)=>({map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,ray});
const setup=(W)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('sage','Sage'),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});Object.assign(f,{x:0,y:0,z:-40,alive:true});u.ability.q=2;return {s,u,f};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
assert.equal(typeof SovaBolt.orb,'function','shared Class 3 orb flight');
// 1. open floor, aimed flat: lands ~10 m ahead after ~0.5 s; the field is not there before it lands
{const {s,u,f}=setup(mk(()=>Infinity));assert.equal(s.command(u,{t:'ab',k:'q'}),true);const e=s.effects.find(e=>e.kind==='slow'&&e.orb);const d=-e.p[2];
 assert.ok(d>8&&d<13,'a throw ~10 m: '+d.toFixed(2));assert.ok(Math.abs(e.p[1])<.2,'on the floor');const fl=e.at-s.time;assert.ok(fl>.3&&fl<.8,'flight '+fl.toFixed(2)+' s');
 assert.ok(Math.abs(e.until-e.at-SLOW_ORB.life)<1e-6,'7 s from landing');Object.assign(f,{x:e.p[0],z:e.p[2]});tick(s,.2);assert.ok(!(f.orbSlowUntil>s.time),'not slowed before it lands');tick(s,fl);assert.ok(f.orbSlowUntil>s.time,'slowed once it landed');
 const ev=s.castEvents.find(v=>v.ag==='Sage'&&v.k==='q');assert.ok(ev&&Math.abs(ev.fl-fl)<.01,'cast event carries the flight time');}
// 2. a wall 4 m ahead: hits it and drops to the floor at the wall
{const {s,u}=setup(mk(wall(-4)));s.command(u,{t:'ab',k:'q'});const e=s.effects.find(e=>e.kind==='slow'&&e.orb);assert.ok(e.p[2]<-3.5&&e.p[2]>-4.1,'at the wall foot: '+e.p);assert.ok(Math.abs(e.p[1])<.2,'dropped to the floor');}
// 3. aimed up 30 deg: a longer arc
{const {s,u}=setup(mk(()=>Infinity));u.pitch=Math.PI/6;s.command(u,{t:'ab',k:'q'});const e=s.effects.find(e=>e.kind==='slow'&&e.orb);assert.ok(-e.p[2]>25,'lobbed farther: '+e.p);}
console.log('Slow Orb: Class 3 projectile arc, drops off walls, field starts where and when it lands (7 s)');
