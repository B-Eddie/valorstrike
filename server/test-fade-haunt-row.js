// Fade Haunt row contract: in the snapshot while winding up (no dn), dn:1 after the 0.4 s pop (units in range revealed), row stays until
// the 2 s mark time ends, then is gone. The client bursts only on dn.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const t=new SpikeSimulation(W),f=t.add('fd','Fade'),foe=t.add('foe');t.start(false);t.buy=0;f.ability.e=1;
assert.equal(t.command(f,{t:'ab',k:'e'}),true);
const row=()=>t.snapshot().fx.find(r=>r.kind==='haunt');
const r0=row();assert.ok(r0,'row in snapshot');assert.equal(r0.dn,undefined,'no dn while winding up');
const step=s=>{for(let i=0;i<Math.round(s/.05);i++){t.time+=.05;tickAbilities(t,.05);}};
step(.2);assert.ok(row()&&row().dn===undefined,'still winding up at 0.2 s');
step(.4);const r1=row();assert.ok(r1,'row kept after the pop');assert.equal(r1.dn,1,'dn:1 after the pop');
step(2);assert.equal(row(),undefined,'row gone after the mark time');
console.log('fade haunt row: windup (no dn), pop (dn:1), kept until mark end');
