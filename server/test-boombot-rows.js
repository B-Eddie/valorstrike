// Raze Boom Bot device row: phase (0 patrol, 1 locked, 2 windup, 4 detonated) + explicit dn linger; the detonation itself is asserted on the real sim in test-ults.js.
import {deviceRows,DEV} from './src/devices.js';
import assert from 'node:assert/strict';
const sim={time:10,effects:[{id:1,kind:'boombot',owner:2,team:0,p:[0,0,0],until:15,born:9.9,hp:60,yaw:1}]};
const row=()=>deviceRows(sim).find(r=>r.id===1);
assert.equal(row().d,'boombot');assert.equal(row().ph,0);assert.equal(row().age,.1);assert.equal(row().yaw,1);
sim.effects[0].lk=1;assert.equal(row().ph,1,'locked on an enemy');
sim.effects[0].blastAt=10.6;assert.equal(row().ph,2,'windup');assert.equal(row().dn,undefined);
Object.assign(sim.effects[0],{dn:1,hp:0,until:10.25});sim.time=10.1;assert.equal(row().ph,4);assert.equal(row().dn,1,'detonation is explicit');
sim.time=10.3;assert.equal(row(),undefined,'dn linger expires');
sim.effects=[{id:1,kind:'boombot',owner:2,team:0,p:[0,0,0],until:15,hp:0}];assert.equal(row(),undefined,'shot down (hp 0, no dn): the row just stops - no detonation signal');
console.log('boombot rows ok');
