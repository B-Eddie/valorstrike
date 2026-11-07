// Miks Harmonize: one 'harmon' row per buffed unit (self + nearest ally), tg = unit id, p follows the unit, row drops on death.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const t=new SpikeSimulation(W),m=t.add('mk','Miks'),a=t.add('ally');const f=t.add('foe');t.start(false);t.buy=0;a.team=m.team;f.team=m.team+1;Object.assign(m,{x:0,z:0});Object.assign(a,{x:2,z:0});m.ability.q=1;
assert.equal(t.command(m,{t:'ab',k:'q'}),true);
let rows=t.snapshot().fx.filter(r=>r.kind==='harmon');assert.deepEqual(rows.map(r=>r.tg).sort(),[a.id,m.id].sort(),'self + ally rows');assert.ok(rows.every(r=>Number.isFinite(r.id)&&r.tl>7&&r.o===m.id));
a.x=5;t.time=.1;tickAbilities(t,.1);rows=t.snapshot().fx.filter(r=>r.kind==='harmon');assert.equal(rows.find(r=>r.tg===a.id).p[0],5,'p follows the ally');
a.alive=false;t.time=.2;tickAbilities(t,.1);rows=t.snapshot().fx.filter(r=>r.kind==='harmon');assert.deepEqual(rows.map(r=>r.tg),[m.id],'ally death drops its row');
console.log('miks harmonize row ok');
