// Raze Blast Pack (wiki.playvalorant.com/en-us/Blast_Pack Stats): thrown, sticks to the first thing it hits; recast (Q) or 5 s detonates;
// everyone within 5 m (Raze and allies too) is launched away; armed after 1.5 s it also deals 50 inside 2 m falling to 20 at 5 m to
// enemies only; 20 HP (enemy gunfire destroys it). Replaces the old instant 8 m forward dash. Client: index.html XBP / rsPack.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';import {DEV,SHOOT,packDamage,packStick,nearestDevice,damageDevice} from './src/devices.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const B=DEV.blastPack;assert.deepEqual([B.life,B.arm,B.inner,B.outer,B.max,B.min],[5,1.5,2,5,50,20],'wiki Blast Pack');assert.equal(SHOOT.blastpack.hp,20,'20 HP');
assert.equal(packDamage(0),50);assert.equal(packDamage(2),50);assert.equal(packDamage(3.5),35);assert.ok(Math.abs(packDamage(4.999)-20)<.02);assert.equal(packDamage(5),0);
function setup(){const s=new SpikeSimulation(W),rz=s.add('rz','Raze'),foe=s.add('foe'),mate=s.add('mate');s.start(false);s.buy=0;Object.assign(rz,{x:0,y:0,z:0,look:0,pitch:0});mate.team=rz.team;foe.team=rz.team===0?1:0;return {s,rz,foe,mate};}
// the throw: lands ahead on the floor (no instant dash), sticks there; a wall in the way stops it on the wall
{const {s,rz}=setup();rz.ability.q=2;assert.equal(s.command(rz,{t:'ab',k:'q'}),true);assert.equal(rz.z,0,'Raze does not move on the throw');assert.equal(rz.ability.q,1);
 const e=s.effects.find(e=>e.kind==='blastpack');assert.ok(e&&e.p[2]<-3&&e.p[2]>-15&&Math.abs(e.p[0])<1e-9&&Math.abs(e.p[1]-.1)<1e-9,'on the floor ahead: '+e.p);
 const wall={...W,ray:(o,d,m)=>{if(d[2]>=0)return Infinity;const t=(o[2]+3)/-d[2];return t>=0&&t<=m?t:Infinity;}},q=packStick({world:wall},[0,1.6,0],[0,0,-1]);assert.ok(Math.abs(q[2]+2.95)<.01&&q[1]>.5,'sticks on a wall 3 m ahead: '+q);}
// recast before arming: launches everyone in 5 m (Raze too), no damage; no charge spent
{const {s,rz,foe,mate}=setup();rz.ability.q=1;s.command(rz,{t:'ab',k:'q'});const e=s.effects.find(e=>e.kind==='blastpack');Object.assign(rz,{x:e.p[0],z:e.p[2]+1});Object.assign(foe,{x:e.p[0]+3,y:0,z:e.p[2],hp:100,armor:0});Object.assign(mate,{x:e.p[0]-4,y:0,z:e.p[2],hp:100});
 tick(s,.5);s.time+=.31;const seq=rz.seq;assert.equal(s.command(rz,{t:'ab',k:'q'}),true,'recast detonates');assert.equal(rz.ability.q,0,'no extra charge');assert.ok(!s.effects.some(e=>e.kind==='blastpack'&&e.until>s.time),'gone');
 assert.equal(foe.hp,100,'unarmed: no damage');assert.ok(rz.vy===B.vy&&rz.air&&rz.vz>13.9&&rz.seq===seq+1,'Raze launched away (up + back)');assert.ok(foe.vx>13.9&&foe.vy===B.vy,'enemy knocked away');assert.ok(mate.vx<-13.9,'ally knocked away too');assert.equal(mate.hp,100);}
// armed (1.5 s): enemies take 50 -> 20 by distance; allies and Raze none; out of 5 m untouched
{const {s,rz,foe,mate}=setup();const far=s.add('far');rz.ability.q=1;s.command(rz,{t:'ab',k:'q'});const e=s.effects.find(e=>e.kind==='blastpack');far.team=foe.team;
 Object.assign(foe,{x:e.p[0]+3.5,y:0,z:e.p[2],hp:100,armor:0});Object.assign(mate,{x:e.p[0],y:0,z:e.p[2]+1,hp:100});Object.assign(far,{x:e.p[0]+6,y:0,z:e.p[2],hp:100,armor:0});Object.assign(rz,{x:e.p[0]-30});
 tick(s,1.6);s.time+=.31;assert.equal(s.command(rz,{t:'ab',k:'q'}),true);const d=Math.hypot(3.5,1-e.p[1]);assert.ok(Math.abs(100-foe.hp-packDamage(d))<1e-6,'enemy '+foe.hp);assert.equal(mate.hp,100,'never allies');assert.equal(far.hp,100);assert.ok(!far.vx,'6 m: not launched');}
// 5 s: it goes off on its own
{const {s,rz,foe}=setup();rz.ability.q=1;s.command(rz,{t:'ab',k:'q'});const e=s.effects.find(e=>e.kind==='blastpack');Object.assign(foe,{x:e.p[0]+1,y:0,z:e.p[2],hp:100,armor:0});Object.assign(rz,{x:e.p[0]-30});
 tick(s,4.9);assert.equal(foe.hp,100);tick(s,.15);assert.equal(foe.hp,50,'5 s fuse: 50 inside 2 m');assert.ok(!s.effects.some(e=>e.kind==='blastpack'));}
// enemy gunfire destroys it (20 HP); its own team cannot hit it
{const {s,rz,foe}=setup();rz.ability.q=1;s.command(rz,{t:'ab',k:'q'});const e=s.effects.find(e=>e.kind==='blastpack');const o=[e.p[0],e.p[1]+.1,e.p[2]+5],d=[0,0,-1];
 assert.equal(nearestDevice(s,o,d,10,rz),null,'own team: not a target');const h=nearestDevice(s,o,d,10,foe);assert.ok(h&&h.effect===e);assert.equal(damageDevice(s,e,19),false);assert.equal(damageDevice(s,e,1),true,'20 HP');}
console.log('Raze Blast Pack: thrown and stuck (floor / wall), no dash; recast or 5 s detonates; launches everyone in 5 m (Raze, allies, enemies); armed after 1.5 s 50 -> 20 over 2-5 m to enemies only; 20 HP shootable by enemies');
