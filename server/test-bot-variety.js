import assert from 'node:assert/strict';import {Simulation} from './src/simulation.js';
const world={map:{attacker:[0,0,0],defender:[0,0,-10]},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};
let seed=42;const rng=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const s=new Simulation(world,'dm','ascent',rng);s.start(true);
const bots=s.units.filter(u=>!u.human);
assert(bots.length>=3,'bots filled');
// step: bots acquire personalities and think
for(let k=0;k<20;k++)s.step(0.05);
bots.forEach(u=>{assert(u.per,'personality rolled');const p=u.per;
 assert(p.ag>=0.2&&p.ag<=1&&p.shz>=1.1&&p.shz<=2.5&&p.sam>=0.25&&p.sam<=0.6&&p.rt>=0&&p.rt<1,'profile ranges');});
assert(new Set(bots.map(u=>u.per.shz)).size>1,'strafe frequencies differ across bots');
assert(new Set(bots.map(u=>u.per.rt)).size>1,'reaction times differ across bots');
assert(new Set(bots.map(u=>u.per.sam)).size>1,'strafe amplitudes differ across bots');
console.log('server bot variety: OK');
