// Exercise real snapshot, not a source-text match: seeker identity survives the wire.
import assert from 'node:assert/strict';
import {SpikeSimulation} from './src/spike.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const s=new SpikeSimulation(W),u=s.add('u','Gekko');s.add('v','Fade');s.start(false);s.buy=0;
s.effects=[{id:301,owner:u.id,ag:'Gekko',kind:'seeker',p:[1,3,2],until:s.time+3,radius:0,wing:1},{id:302,owner:u.id,ag:'Fade',kind:'seeker',p:[2,1,4],until:s.time+3,radius:0,prowler:1},{id:303,owner:u.id,ag:'Skye',kind:'seeker',p:[3,1,5],until:s.time+3,radius:0}];
const rows=s.snapshot().fx.filter(e=>e.kind==='seeker');assert.deepEqual(rows.map(e=>e.ag),['Gekko','Fade','Skye']);assert.deepEqual(rows[0].p,[1,3,2]);assert.equal(rows[0].o,u.id);assert.equal(rows[0].tl,3);s.time+=3.1;assert(!s.snapshot().fx.some(e=>e.kind==='seeker'),'expired rows absent');console.log('real snapshot seeker agent/position/owner/TTL/expiry: PASS');

u.evoUntil=s.time+7;assert.equal(s.roundState(u).status.evo,7);assert.equal(s.roundState(s.units.find(v=>v!==u)).status.evo,0);s.time+=8;assert.equal(s.roundState(u).status.evo,0);console.log("Evolution private authoritative remaining duration: PASS");
