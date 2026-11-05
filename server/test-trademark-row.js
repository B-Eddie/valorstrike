// Chamber Trademark row: field time left (fl) alongside fp, so a late join rebuilds the slow field at its current age.
import {deviceRows} from './src/devices.js';import assert from 'node:assert/strict';
const sim={time:20,effects:[{id:1,kind:'trademark',owner:2,team:0,p:[0,0,0],until:140,born:19,hp:20}]};
assert.equal(deviceRows(sim)[0].fl,undefined);assert.equal(deviceRows(sim)[0].fp,undefined);
Object.assign(sim.effects[0],{field:true,fp:[3,0,3],hp:0,until:23.2});const r=deviceRows(sim)[0];
assert.deepEqual(r.fp,[3,0,3]);assert.equal(r.fl,3.2);sim.time=22;assert.equal(deviceRows(sim)[0].fl,1.2);
console.log('trademark row ok');
