// Miks Waveform smoke row carries wf:1 so clients add the module overlay; other smokes do not.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const t=new SpikeSimulation(W),m=t.add('mk','Miks');t.add('foe');t.start(false);t.buy=0;m.ability.e=1;
assert.equal(t.command(m,{t:'ab',k:'e'}),true);
const rows=t.snapshot().fx.filter(r=>r.kind==='smoke');
assert.equal(rows.length,1);assert.equal(rows[0].wf,1);assert.equal(rows[0].o,m.id);assert.ok(rows[0].tl>13);
console.log('miks waveform row: smoke row tagged wf:1');
