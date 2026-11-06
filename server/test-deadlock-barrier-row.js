// Diagnostic regression: Deadlock Barrier Mesh must not lose its identity into Sage's row.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const s=new SpikeSimulation(W),u=s.add('dl','Deadlock');s.add('foe');s.start(false);s.buy=0;u.ability.c=1;assert(s.command(u,{t:'ab',k:'c'}));const e=s.effects.find(e=>e.kind==='barrier');assert.equal(e.mesh,1);assert.equal(e.radius,3.75);const row=s.snapshot().fx.find(r=>r.id===e.id);assert.equal(row.mesh,1,'Barrier Mesh identity reaches wire, not Sage');console.log('Deadlock barrier wire identity: PASS');
