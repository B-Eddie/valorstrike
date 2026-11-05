// Skye Trailblazer reaches clients as a snapshot fx row ('trail' in A18_NET_KINDS), moves each tick, ends when the leap spends it.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const t=new SpikeSimulation(W),sk=t.add('sk','Skye');t.add('foe');t.start(false);t.buy=0;sk.ability.q=1;
assert.equal(t.command(sk,{t:'ab',k:'q'}),true);
const rows=()=>t.snapshot().fx.filter(r=>r.kind==='trail'||(r.kind==='dev'&&r.d==='trail'));
assert.equal(rows().filter(r=>r.kind==='trail').length,1,'trail row in snapshot');
console.log('skye trail row ok');
