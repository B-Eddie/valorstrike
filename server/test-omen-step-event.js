// Omen Shrouded Step: explicit 'stepout/stepin' arrival event only on a real teleport; none when killed.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,smokeBlocks,CAGE} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,
 ray:(o,d,max=Infinity)=>{const t=d[1]<0?o[1]/-d[1]:Infinity;return t<=max?t:Infinity;}};
W.nav.nodes.push([0,0,-15]);W.nav.adj.push([0]);
const setup=(human=true)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('om','Omen'),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;u.human=human;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});return {s,u};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const ev=s=>s.castEvents.filter(e=>e.sub==='stepout'||e.sub==='stepin');
{const {s,u}=setup();s.world.nav.nodes[2]=[u.x,0,u.z-15];s.world.near=()=>2;u.ability.c=Math.max(1,u.ability.c);s.castEvents.length=0;const from=[u.x,u.y,u.z];assert.equal(s.command(u,{t:'ab',k:'c',d:[0,0,-1],o:[u.x,u.y+1.6,u.z]}),true,'step cast');assert.equal(ev(s).length,0,'no arrival at cast time');
 assert.equal(u.pendingTeleport?.kind,'step');const dest=[...u.pendingTeleport.p];tick(s,.5);assert.equal(ev(s).length,0,'not before the delay');tick(s,2);
 assert.equal(ev(s).length,2,'one event per point');const eo=ev(s).find(e=>e.sub==='stepout'),ei=ev(s).find(e=>e.sub==='stepin');assert.deepEqual(eo.p.map(n=>+n.toFixed(3)),from.map(n=>+n.toFixed(3)),'origin point');assert.deepEqual(ei.p,dest,'destination point');assert.deepEqual([u.x,u.y,u.z],dest,'unit actually there');}
{const {s,u}=setup();s.world.nav.nodes[2]=[u.x,0,u.z-15];s.world.near=()=>2;u.ability.c=Math.max(1,u.ability.c);u.ability;s.command(u,{t:'ab',k:'c',d:[0,0,-1],o:[u.x,u.y+1.6,u.z]});assert.equal(u.pendingTeleport?.kind,'step');tick(s,.3);u.alive=false;s.castEvents.length=0;tick(s,2.5);assert.equal(ev(s).length,0,'killed mid-step: no arrival event');}
console.log('omen step arrival event ok');
