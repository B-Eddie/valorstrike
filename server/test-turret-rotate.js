// Killjoy Turret facing + Sage Barrier Orb angle sent by the page (m.fy / m.by, absolute yaw, page / server convention: forward = (-sin, -cos)).
// Valorant (wiki.playvalorant.com/en-us/Turret, patch 12.04): "Can now be rotated while holding down ALT-FIRE. ACTIVATE now swaps its direction."
// wiki Barrier_Orb: "Sage can recast the ability to rotate this indicator 90 deg. Using Alternate Fire allows her to have full control over the
// exact angle". The page rotates the placement indicator (work/ability_equip_runtime.js xRotDrag / xRotKey) and sends the chosen yaw; the
// trusted server must build the turret cone / the wall with it. Was: both always took u.look (where Killjoy / Sage was looking).
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,castYaw} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const setup=(agent)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add(agent,agent),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});return {s,u,f};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
assert.equal(typeof castYaw,'function','castYaw(m, fallback)');
assert.equal(castYaw({fy:1.25},0,'fy'),1.25);assert.equal(castYaw({},.5,'fy'),.5,'no facing sent: the look');assert.equal(castYaw({fy:'x'},.5,'fy'),.5,'junk: the look');assert.equal(castYaw({fy:Infinity},.5,'fy'),.5);
assert.ok(Math.abs(castYaw({fy:7*Math.PI},0,'fy')-Math.PI)<1e-9,'wrapped to -PI..PI');
// 1. Turret: the sent facing (m.fy) sets the cone, not Killjoy's look
for(const [fy,label] of [[Math.PI,'swapped 180 deg (E)'],[Math.PI/2,'rotated 90 deg left (ALT FIRE)']]){
 const {s,u,f}=setup('Killjoy');u.ability.e=1;assert.equal(s.command(u,{t:'ab',k:'e',fy}),true,'turret cast');const T=s.effects.find(e=>e.kind==='turret');assert.ok(T,'turret placed');
 assert.ok(Math.abs(T.yaw-fy)<1e-9,label+': turret yaw '+T.yaw);
 // a foe straight along the turret's facing is shot, one along Killjoy's look (behind the turret) is not
 const fx=-Math.sin(fy),fz=-Math.cos(fy);Object.assign(f,{x:T.p[0]+fx*10,y:0,z:T.p[2]+fz*10,hp:100,alive:true});tick(s,4.5);assert.ok(f.hp<100,label+': a foe in front of the turret is shot ('+f.hp+')');
 const {s:s2,u:u2,f:f2}=setup('Killjoy');u2.ability.e=1;s2.command(u2,{t:'ab',k:'e',fy});const T2=s2.effects.find(e=>e.kind==='turret');Object.assign(f2,{x:T2.p[0],y:0,z:T2.p[2]-10,hp:100,alive:true});tick(s2,4.5);assert.equal(f2.hp,100,label+': a foe along Killjoy\'s look (outside the 100 deg cone) is not shot');}
// 2. Turret without m.fy (bots, old clients): Killjoy's look
{const {s,u}=setup('Killjoy');u.look=.7;u.ability.e=1;s.command(u,{t:'ab',k:'e'});assert.ok(Math.abs(s.effects.find(e=>e.kind==='turret').yaw-.7)<1e-9,'no fy: look');}
// 3. Barrier Orb: the sent angle (m.by) orients the wall; a 90 deg turn makes it run along the aim
{const {s,u}=setup('Sage');u.ability.c=1;assert.equal(s.command(u,{t:'ab',k:'c',by:Math.PI/2}),true);const B=s.effects.find(e=>e.kind==='barrier');assert.ok(Math.abs(B.yaw-Math.PI/2)<1e-9,'barrier yaw '+B.yaw);
 // wall 15 m ahead (open fixture); turned 90 deg it runs along z: blocked 4 m nearer / farther on the aim line, not 4 m to the side
 assert.equal(s.world.blocked(B.p[0],B.p[2]+4,.3,0,1.8),true,'along the aim');assert.equal(s.world.blocked(B.p[0]+4,B.p[2],.3,0,1.8),false,'not across');}
{const {s,u}=setup('Sage');u.ability.c=1;s.command(u,{t:'ab',k:'c'});const B=s.effects.find(e=>e.kind==='barrier');assert.equal(B.yaw,0,'no by: across the aim (perpendicular to Sage)');assert.equal(s.world.blocked(B.p[0]+4,B.p[2],.3,0,1.8),true,'across');}
console.log('Turret facing (m.fy: E swap / ALT FIRE rotate) and Barrier Orb angle (m.by) from the page; bots / old clients keep the look');
