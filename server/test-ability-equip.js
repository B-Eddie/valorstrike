// Server side of the Valorant ability flow (work/ability_equip_runtime.js): kit charges / costs / ult points / signature
// recharge match the wiki table (work/validation/abilities-wiki.json), and an equip-then-fire cast keeps the gun down
// for XAB_REC s on the server too (fire() refuses until u.fireAt), while a quick-cast (Jett Cloudburst) does not.
import assert from 'node:assert/strict';import fs from 'node:fs';import {SpikeSimulation} from './src/spike.js';import {ABILITY_EQUIP,XAB_REC} from './src/abilities.js';import {DEV} from './src/devices.js';import {WINDUP,XAB_REL,wf} from './src/windups.js';import {ULT} from './src/ults.js';
const kits=JSON.parse(fs.readFileSync(new URL('./src/kits.json',import.meta.url),'utf8')),wiki=JSON.parse(fs.readFileSync(new URL('../work/validation/abilities-wiki.json',import.meta.url),'utf8'));
for(const [a,w] of Object.entries(wiki)){if(a[0]==='_')continue;const k=kits[a];assert(k,a+' kit');assert.equal(k.u,w.u,a+' ult points');
 for(const s of ['c','q']){assert.equal(k.mx[s],w[s][0],a+' '+s+' charges');assert.equal(k.buy.find(r=>r[0]===s)[2],w[s][1],a+' '+s+' cost');}
 if(w.e&&w.e[1]){assert.equal(k.mx.e,w.e[0],a+' e charges');assert.equal(k.buy.find(r=>r[0]==='e')[2],w.e[1],a+' e cost');}}
const src=fs.readFileSync(new URL('./src/abilities.js',import.meta.url),'utf8'),sec=Object.fromEntries([...src.match(/const seconds=\{([^}]*)\}/)[1].matchAll(/(\w+):(\d+)/g)].map(m=>[m[1],+m[2]]));
for(const [a,w] of Object.entries(wiki))if(typeof w.eRecharge==='number'&&a!=='Omen')assert.equal(sec[a],w.eRecharge,a+' signature recharge');
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const s=new SpikeSimulation(W),ph=s.add('p','Phoenix'),j=s.add('j','Jett');s.start(false);s.buy=0;s.time=3;
ph.ability.c=1;ph.fireAt=0;assert.equal(s.command(ph,{t:'ab',k:'c'}),true,'Blaze cast');assert.equal(ph.ability.c,0);assert(ABILITY_EQUIP.Phoenix.includes('c'));
assert(ph.fireAt>=s.time+XAB_REC-1e-9,'equip cast holds the gun down on the server');assert.equal(s.fire(ph),false,'no gun fire mid-cast');
s.time+=XAB_REC+.01;ph.triggerHeld=false;assert.notEqual(s.fire(ph),false,'gun back after the recovery');
j.ability.c=1;j.fireAt=0;assert.equal(s.command(j,{t:'ab',k:'c'}),true,'Cloudburst cast');assert(!(j.fireAt>s.time),'quick-cast keeps the gun up');
// effect values checked against the wiki (work/validation/abilities-wiki.txt): Cloudburst 2.5 s, Hot Hands 60 dps, Nanoswarm 5 s
{const e=s.effects.filter(e=>e.kind==='smoke').pop();assert(e,'Cloudburst smoke effect');assert(Math.abs(e.until-s.time-2.5)<1e-6,'Cloudburst lasts 2.5 s (got '+(e.until-s.time)+')');}
assert.equal(DEV.hotHands.damage,60,'Hot Hands 60/s');assert.equal(DEV.nanoswarm.active,5,'Nanoswarm active 5 s');
{const ph2=s.add('p2','Phoenix');ph2.alive=true;ph2.ability.q=1;ph2.fireAt=0;s.time+=1;assert.equal(s.command(ph2,{t:'ab',k:'q'}),true,'Hot Hands cast');const f=s.effects.filter(e=>e.kind==='fire').pop();assert(f&&f.rate===60,'Hot Hands zone burns 60/s');}
// per-ability windups (wiki): FIRE -> effect = the client's 0.2 s hand release + the server fuse; arm / equip times from the cast
assert.deepEqual(WINDUP,{aftershock:2.2,flashpoint:.5,faultLine:1.1,rollingThunder:1.2,curveball:.6,leer:.4,lockdown:13,trapwire:.7,trademark:2,blastPack:1.5,showstopper:1.4,tourDeForce:2.3});assert.equal(XAB_REL,.2);
{const br=s.add('br','Breach');br.alive=true;Object.assign(br.ability,{c:1,q:1,e:1});br.cool={};s.time+=1;
 assert.equal(s.command(br,{t:'ab',k:'c'}),true,'Aftershock');const a=s.effects.filter(e=>e.kind==='blast').pop();assert(Math.abs(a.at-s.time-wf('aftershock'))<1e-9&&a.until>a.at,'Aftershock fuse 2.2 - 0.2 s');
 s.time+=1;assert.equal(s.command(br,{t:'ab',k:'q'}),true,'Flashpoint');const f=s.effects.filter(e=>e.kind==='flash').pop();assert(Math.abs(f.at-s.time-.3)<1e-9&&f.until>f.at,'Flashpoint fuse 0.5 - 0.2 s');
 s.time+=1;assert.equal(s.command(br,{t:'ab',k:'e'}),true,'Fault Line');assert(Math.abs(br.fault.at-s.time-.9)<1e-9,'Fault Line 1.1 - 0.2 s');}
assert(Math.abs(DEV.curveball.windup-.4)<1e-9&&Math.abs(ULT.quake.delay-1)<1e-9&&ULT.lockdown.windup===13&&DEV.trapwire.arm===.7&&DEV.trademark.armDeploy===2,'Curveball / Rolling Thunder / Lockdown / Trapwire / Trademark windups');
{const ry=s.add('ry','Reyna');ry.alive=true;ry.ability.c=1;s.time+=1;assert.equal(s.command(ry,{t:'ab',k:'c'}),true,'Leer');const l=s.effects.filter(e=>e.kind==='leer').pop();assert(Math.abs(l.at-s.time-.2)<1e-9,'Leer 0.4 - 0.2 s');}
{const ch=s.add('ch','Chamber');ch.alive=true;ch.ability.ult=8;ch.fireAt=0;s.time+=1;assert.equal(s.command(ch,{t:'ab',k:'x'}),true,'Tour De Force');assert.equal(ch.weapon,'Operator');assert(Math.abs(ch.fireAt-s.time-2.3)<1e-9,'Tour De Force 2.3 s equip');assert.equal(s.fire(ch),false,'no shot during the equip');s.time+=2.31;ch.triggerHeld=false;assert.notEqual(s.fire(ch),false,'fires once up');}
console.log('Ability equip (server): kit table matches the wiki, equip casts hold fire for '+XAB_REC+' s, quick-casts do not; Cloudburst 2.5 s, Hot Hands 60/s, Nanoswarm 5 s; wiki windups (Aftershock / Flashpoint / Fault Line / Leer / Curveball / Rolling Thunder / Trapwire / Trademark / Tour De Force)');
