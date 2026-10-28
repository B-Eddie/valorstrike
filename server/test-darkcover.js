// Omen Dark Cover (wiki.playvalorant.com/en-us/Dark_Cover): "Omen can use his fire keys to move the marker across the map" - HOLD FIRE pushes the
// marker farther, HOLD ALT FIRE pulls it closer, through walls, "at any position in range at any altitude", max deploy distance 80 m; "If the
// centre of the smoke is not directly on top of a horizontal surface ... the smoke will sink vertically until this condition is met"; 15 s,
// 4.1 m. The page sends the marker distance (m.dist) along the aim; the server places the smoke there (no wall stop) and sinks it to the floor.
// Was: smoke at the first wall hit along the aim, at most 40 m.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {DARK} from './src/abilities.js';
assert.equal(DARK.max,80,'max deploy distance 80 m (wiki)');
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,
 ground:(x,z,y)=>z<-40&&y>=3?3:0/* a 3 m ledge past 40 m */,blocked:()=>false,ray:(o,d,max=Infinity)=>{/* a wall 10 m ahead */const t=d[2]<0?(o[2]+10)/-d[2]:Infinity;return t<=max?t:Infinity;}};
const setup=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('om','Omen'),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});u.ability.e=2;return {s,u};};
const smoke=(s)=>s.effects.filter(e=>e.kind==='smoke').pop();
// 1. marker 30 m out, behind the wall: the smoke goes there (through the wall), sunk to the floor
{const {s,u}=setup();assert.equal(s.command(u,{t:'ab',k:'e',dist:30}),true);const e=smoke(s);assert.ok(Math.abs(e.p[2]+30)<.01&&Math.abs(e.p[0])<1e-6,'30 m along the aim through the wall: '+e.p);assert.ok(e.p[1]<.5,'sunk to the floor: '+e.p[1]);assert.ok(Math.abs(e.until-s.time-15)<.01);assert.equal(e.radius,4.1);}
// 2. clamped to 80 m; aimed up at 30 deg the marker is high in the air and sinks to the floor below (the ledge at 3 m past 40 m)
{const {s,u}=setup();u.pitch=Math.PI/6;assert.equal(s.command(u,{t:'ab',k:'e',dist:500}),true);const e=smoke(s),h=80*Math.cos(Math.PI/6);assert.ok(Math.abs(e.p[2]+h)<.01,'80 m cap: '+e.p);assert.ok(Math.abs(e.p[1]-3.1)<.2,'sunk onto the ledge: '+e.p[1]);}
// 3. no marker distance (bots): unchanged - the first wall along the aim
{const {s,u}=setup();assert.equal(s.command(u,{t:'ab',k:'e'}),true);const e=smoke(s);assert.ok(e.p[2]>-10&&e.p[2]<-8,'stops short of the wall: '+e.p);}
// 4. a bad distance is ignored (wall rule)
{const {s,u}=setup();assert.equal(s.command(u,{t:'ab',k:'e',dist:'x'}),true);assert.ok(smoke(s).p[2]>-10);}
console.log('Dark Cover: the marker distance (to 80 m, through walls) places the smoke, sunk to the floor below; bots keep the wall rule');
