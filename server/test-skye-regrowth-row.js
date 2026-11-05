// Skye Regrowth reaches clients as a snapshot fx row ('regrowth' in A18_NET_KINDS), follows its owner, ends when the pool is spent / recast.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const t=new SpikeSimulation(W),sk=t.add('sk','Skye');t.add('foe');t.start(false);t.buy=0;sk.ability.c=1;
assert.equal(t.command(sk,{t:'ab',k:'c'}),true);
let rows=()=>t.snapshot().fx.filter(r=>r.kind==='regrowth');
assert.equal(rows().length,1,'row is in the snapshot');
const r0=rows()[0];assert.equal(r0.o,sk.id);assert.equal(r0.r,18);assert.ok(r0.tl>3000,'tl is the 3600 s sentinel, not a duration');
sk.x=5;sk.z=-3;tickAbilities(t,.05);const r1=rows()[0];assert.equal(r1.id,r0.id);assert.equal(r1.p[0],5);assert.equal(r1.p[2],-3);
t.time+=1;assert.equal(t.command(sk,{t:'ab',k:'c'}),true);assert.equal(rows().length,0,'recast ends the row');
console.log('Skye regrowth row: in snapshot with owner/radius, follows owner, ends on recast');
