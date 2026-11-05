// Device rows carry age (s since placed): the online client plays a deploy look only for a fresh placement.
import {deviceRows} from './src/devices.js';
import assert from 'node:assert/strict';
const sim={time:10,effects:[
 {id:1,kind:'alarmbot',owner:2,team:0,p:[0,0,0],until:130,born:9.95,hp:20},
 {id:2,kind:'turret',owner:2,team:0,p:[1,0,0],until:30,born:2,hp:100,yaw:0},
 {id:3,kind:'trapwire',owner:2,team:0,p:[2,0,0],until:30,hp:20}]};
const r=deviceRows(sim);
assert.equal(r.find(x=>x.id===1).age,0.05,'fresh placement: small age');
assert.equal(r.find(x=>x.id===2).age,8,'old row: large age (client must not replay deploy)');
assert.ok(!('age' in r.find(x=>x.id===3)),'no born: no age');
console.log('device row age ok');
