// Out-of-bounds kill rule (server): a grounded unit >4 units from every playable nav node is
// warned (broadcast note), then killed after 2 s. Respawn semantics differ by mode: dm/tdm
// respawn after the usual delay; five (spike) stays dead for the round, mirroring the void fall.
import assert from 'node:assert/strict';import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';
const mkWorld=()=>({map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[20,0,20]}},nav:{nodes:[[0,0,0],[0,0,-30],[1000,0,1000]],adj:[[1],[0],[1]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>Math.hypot(x,z)<50?0:(z<-15?1:2),ground:()=>0,blocked:()=>false,ray:()=>Infinity});
{const s=new Simulation(mkWorld(),'tdm','ascent',()=>.5),a=s.add('a');s.phase='game';
 Object.assign(a,{x:300,y:0,z:0,input:{},inputAt:0}); // grounded, far past nav coverage
 s.step(.05);assert.equal(a.alive,true,'first OOB tick warns, does not kill');assert.ok(s.events.some(e=>e[0]==='n'&&/out of bounds/.test(e[1])),'warning note broadcast');
 for(let k=0;k<42;k++){Object.assign(a,{x:300,y:0,z:0,input:{},inputAt:s.time});s.step(.05);} // ~2.1 s held out there
 assert.equal(a.alive,false,'killed after 2 s grounded out of bounds');assert.equal(a.deaths,1);assert.ok(a.respawnAt>s.time,'dm/tdm respawn scheduled');
 assert.ok(s.events.some(e=>e[0]==='k'&&e[1]==='Out of bounds'&&e[2]==='a'),'kill event attributes the map boundary, not a player');}
{const s=new Simulation(mkWorld(),'tdm','ascent',()=>.5),a=s.add('a');s.phase='game';
 for(let k=0;k<50;k++){Object.assign(a,{x:1,y:0,z:1,input:{},inputAt:s.time});s.step(.05);}
 assert.equal(a.alive,true,'in-coverage unit never tripped');assert.equal(a.deaths,0);}
{const s=new Simulation(mkWorld(),'tdm','ascent',()=>.5),a=s.add('a');s.phase='game';
 Object.assign(a,{x:300,y:0,z:0,input:{},inputAt:0});s.step(.05); // clock starts
 Object.assign(a,{x:1,y:0,z:1,input:{},inputAt:s.time});s.step(.05); // back in coverage
 Object.assign(a,{x:300,y:0,z:0,input:{},inputAt:s.time});for(let k=0;k<38;k++){s.step(.05);Object.assign(a,{x:300,y:0,z:0,input:{},inputAt:s.time});}
 assert.equal(a.alive,true,'re-entry resets the clock: 1.9 s is not enough');}
{const s=new SpikeSimulation(mkWorld(),'five','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);
 a.credits=b.credits=800;s.buy=0;s.phase='game';
 Object.assign(a,{x:300,y:0,z:0,input:{},inputAt:0});s.step(.05);
 for(let k=0;k<42;k++){Object.assign(a,{x:300,y:0,z:0,input:{},inputAt:s.time});s.step(.05);}
 assert.equal(a.alive,false,'five: killed after 2 s out of bounds');assert.equal(a.deaths,1);assert.equal(a.respawnAt,0,'five: no mid-round respawn, mirroring void falls');}
console.log('OOB server rule: grounded past nav coverage warns then kills at 2 s; dm/tdm respawn, five stays dead; in-coverage and re-entry safe; kill attributed to the map boundary');
