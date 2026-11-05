// Killjoy device rows: explicit lifecycle signals for the online client (alarmbot phase + detonation row, turret shot counter).
import {deviceRows,tickDevices,DEV} from './src/devices.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('./src/devices.js',import.meta.url),'utf8');
assert.ok(src.includes("e.dn=1;e.hp=0;e.until=sim.time+.25"),'detonation keeps a dn row instead of silently splicing');
const sim={time:10,effects:[{id:1,kind:'alarmbot',owner:2,team:0,p:[0,0,0],until:130,born:9,hp:20,armAt:9.5}]};
const row=()=>deviceRows(sim).find(r=>r.id===1);
assert.equal(row().ph,0);
sim.effects[0].chase=5;sim.effects[0].alertAt=10.3;assert.equal(row().ph,1,'alert');
sim.time=10.4;assert.equal(row().ph,2,'running');
sim.effects[0].blastAt=10.9;assert.equal(row().ph,3,'windup');
Object.assign(sim.effects[0],{dn:1,hp:0,until:11.15,blastAt:10.9});sim.time=11;
assert.equal(row().ph,4);assert.equal(row().dn,1,'detonation is explicit, not a disappearance');
sim.time=11.2;assert.equal(row(),undefined,'dn row expires');
sim.effects=[{id:3,kind:'turret',owner:2,team:0,p:[0,0,0],until:30,hp:100,yaw:0,sn:2,ft:[1,1.5,3]}];
const t=deviceRows(sim)[0];assert.equal(t.sn,2);assert.deepEqual(t.ft,[1,1.5,3]);
console.log('killjoy device signals ok');
