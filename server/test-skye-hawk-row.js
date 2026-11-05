// Guiding Light hawk snapshot rows: 'hawk' row (hd) in flight, 'flash' row with fa (windup) after the pop, both numeric; row drops on pop / detonation.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const t=new SpikeSimulation(W),c=t.add('c','Skye');t.add('v');t.start(false);t.buy=0;Object.assign(c,{x:0,y:0,z:0,look:0,pitch:0});c.ability.e=1;
assert.equal(t.command(c,{t:'ab',k:'e'}),true);t.time=.5;tickAbilities(t,.5);
let fx=t.snapshot().fx;let h=fx.find(e=>e.kind==='hawk');assert.ok(h&&Number.isFinite(h.id)&&h.p.every(Number.isFinite)&&h.hd.length===3&&h.o===c.id,'hawk row');assert.ok(h.p[2]<-8&&h.p[2]>-10,'hawk position moves: '+h.p);
assert.equal(t.command(c,{t:'ab',k:'e'}),true);fx=t.snapshot().fx;assert.ok(!fx.some(e=>e.kind==='hawk'),'hawk row drops on pop');const f=fx.find(e=>e.kind==='flash');assert.ok(f&&f.ag==='Skye'&&Math.abs(f.fa-.3)<.011,'flash row carries windup fa: '+JSON.stringify(f));
t.time=.85;tickAbilities(t,.35);assert.ok(!t.snapshot().fx.some(e=>e.kind==='flash'),'flash row drops at detonation');
console.log('skye hawk row ok');
