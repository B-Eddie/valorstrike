// Tactical checks that do not need a built map or rendering dependencies. The original
// six-map buy / spread / teamplay suites still run in the full gate and report their blockers.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {persona,strategy,plan,botView} from './src/bots.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[];
const brain=fs.readFileSync(new URL('./test-bot-brain.js',import.meta.url),'utf8');
new Function('assert','B','out','Simulation','SpikeSimulation','persona','strategy','plan','botView',brain.slice(brain.indexOf('// 1. Pure decisions'),brain.indexOf('// 3. Real map')))(assert,B,out,Simulation,SpikeSimulation,persona,strategy,plan,botView);
const spread=fs.readFileSync(new URL('./test-bot-spread.js',import.meta.url),'utf8');
new Function('assert','B','out',spread.slice(spread.indexOf('// 1. formations'),spread.indexOf('// 2. server simulation')))(assert,B,out);
const modes=new Set();for(let k=0;k<40;k++){const rand=B.rng(700+k),p=B.personality(90+k),st=B.buyNew(p,rand);let x=0,z=0;
 for(let i=0;i<300;i++){const c={dt:.1,left:30-i*.1,pos:[x,z],spot:[8,0,0],face:[0,-1],wander:()=>[rand()*4-2,0,rand()*4-2],free:()=>true},a=B.buyTick(st,c);modes.add(st.mode);if(a.goal){const dx=a.goal[0]-x,dz=a.goal[2]-z,l=Math.hypot(dx,dz)||1,q=Math.min(l,(a.walk?2.8:4.6)*.1)/l;x+=dx*q;z+=dz*q;}}
 assert(Math.hypot(x-8,z)<.7,'buy phase ends at the barrier, not wandering');}
for(const kind of ['shop','mill','pause','go','wait','peek'])assert(modes.has(kind),'buy phase includes '+kind);
{const p=B.personality(7),a=B.aimPlan(p,B.rng(4),1,0,15,{start:.25});assert(!B.readyToFire(a,0,15,.1),'no shot before reaction');assert(!B.readyToFire(a,.8,15,5),'no shot while crosshair is off the target');}
console.log('Bot tactics: pure team formations / site coverage / spacing / nearest trade caps; grid-world hearing and teammate trades; coordinated economy / plans; 40 seeded buy schedules shop, wander, line up and peek; aim-before-fire. '+out.join('; '));
