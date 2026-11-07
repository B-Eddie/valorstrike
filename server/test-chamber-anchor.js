// Chamber Rendezvous: destructible anchor effect (50 HP) + row, dn on destruction (no recharge), removal on use, explicit stepout/stepin events on the teleport.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,smokeBlocks,CAGE} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,
 ray:(o,d,max=Infinity)=>{const t=d[1]<0?o[1]/-d[1]:Infinity;return t<=max?t:Infinity;}};
W.nav.nodes.push([0,0,-15]);W.nav.adj.push([0]);
const setup=(human=true)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('ch','Chamber'),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;u.human=human;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});return {s,u};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
import {deviceRows,damageDevice} from './src/devices.js';
const prep=()=>{const {s,u}=setup();s.world.nav.nodes[2]=[u.x,0,u.z-5];s.world.near=()=>2;u.ability.e=1;return {s,u};};
const place=(s,u)=>s.command(u,{t:'ab',k:'e',d:[0,0,-1],o:[u.x,u.y+1.6,u.z]});
const anchors=s=>s.effects.filter(e=>e.kind==='rdvanchor');
// placement: effect + row
{const {s,u}=prep();assert.equal(place(s,u),true,'placed');assert.equal(anchors(s).length,1);assert.equal(anchors(s)[0].hp,50);const r=deviceRows(s).find(x=>x.d==='rdvanchor');assert.ok(r,'row');assert.equal(r.hp,50);assert.deepEqual(r.p.map(n=>+n.toFixed(2)),u.ability.anchor.map(n=>+n.toFixed(2)));
 // destroyed by enemy fire: dn row once, then gone; ability state cleared, no recharge
 const e=anchors(s)[0];assert.equal(damageDevice(s,e,30),false);assert.equal(damageDevice(s,e,30),true);const dr=deviceRows(s).find(x=>x.d==='rdvanchor');assert.equal(dr.dn,1,'explicit destruction row');assert.equal(u.ability.anchor,null);assert.equal(u.ability.e,0);assert.equal(u.ability.rechargeAt,0,'no recharge when destroyed');
 s.time+=.3;tickAbilities(s,.05);assert.equal(anchors(s).length,0,'dn row expires');assert.equal(deviceRows(s).filter(x=>x.d==='rdvanchor').length,0);}
// use: reactivate teleports after the delay; anchor effect removed; stepout/stepin events once
{const {s,u}=prep();place(s,u);const a=[...u.ability.anchor];tick(s,.4);u.x+=2;const from=[u.x,u.y,u.z];s.castEvents.length=0;assert.equal(place(s,u),true,'reactivated');assert.equal(anchors(s).length,0,'anchor consumed on use');tick(s,.5);assert.equal(s.castEvents.filter(e=>e.sub==='stepin').length,0,'not before the delay');tick(s,1.5);
 const so=s.castEvents.filter(e=>e.sub==='stepout'),si=s.castEvents.filter(e=>e.sub==='stepin');assert.equal(so.length,1);assert.equal(si.length,1);assert.equal(so[0].ag,'Chamber');assert.equal(so[0].k,'e');assert.deepEqual(so[0].p.map(n=>+n.toFixed(2)),from.map(n=>+n.toFixed(2)),'origin');assert.deepEqual(si[0].p.map(n=>+n.toFixed(2)),a.map(n=>+n.toFixed(2)),'destination');}
console.log('chamber rendezvous anchor ok');
