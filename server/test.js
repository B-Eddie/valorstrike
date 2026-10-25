import assert from 'node:assert/strict';import {Simulation} from './src/simulation.js';
const world={map:{attacker:[0,0,0],defender:[0,0,-10]},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const s=new Simulation(world,'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);a.weapon='Vandal';a.ammo=25;Object.assign(a,{x:0,z:0,look:0});Object.assign(b,{x:0,z:-10,protectedUntil:0});a.protectedUntil=0;
assert.equal(s.command(a,{t:'hit',i:b.id,n:10000}),false);assert.equal(b.hp,100);
assert.equal(s.command(a,{t:'in',seq:1,r:0,p:0,x:99999,y:99999,z:99999}),true);assert.equal(a.x,0);s.step(.05);assert.ok(Math.abs(a.x)<.01);
assert.equal(s.command(a,{t:'in',seq:1,r:0,p:0,f:1}),false);
s.command(a,{t:'in',seq:2,r:0,p:0,f:1000000});for(let i=0;i<4;i++)s.step(.05);assert.ok(Math.hypot(a.x,a.z)<1.2);
Object.assign(a,{x:0,z:0,vx:0,vz:0,look:0,input:{},sf:0,air:false,lp:0,protectedUntil:0});Object.assign(b,{x:0,z:-10,protectedUntil:0});let rounds=0;while(b.alive&&rounds<20){s.time+=.2;s.fire(a);rounds++;}assert.equal(b.alive,false);assert.equal(a.kills,1);assert.equal(b.deaths,1);assert.ok(rounds>=1);
const ammo=a.ammo;s.fire(a);assert.equal(a.ammo,ammo);s.command(a,{t:'reload'});const prior=a.ammo;s.time+=.1;s.fire(a);assert.equal(a.ammo,prior);s.time+=3;s.step(.05);assert.equal(a.ammo,25);
const t=new Simulation({...world,ray:()=>2},'tdm','ascent',()=>.5),c=t.add('c'),d=t.add('d');t.start(false);Object.assign(c,{x:0,z:0,look:0,protectedUntil:0});Object.assign(d,{x:0,z:-10,protectedUntil:0});t.fire(c);assert.equal(d.hp,100);
assert.equal(t.command(c,{t:'in',seq:3,r:NaN,p:0}),false);assert.equal(t.command(c,{t:'equip',w:'madeup'}),false);assert.equal(t.command(c,{t:'buy',credits:99999}),false);
const e=t.add('<script>alert(1)</script>');assert.ok(!/[<>]/.test(e.name));
console.log('authority tests passed: ignored damage/teleport/credit claims, monotonic input, speed, server ray/damage/scoring, walls, reload and cadence');

for(const name of ['toString','constructor','__proto__','valueOf'])assert.equal(t.command(c,{t:'equip',w:name}),false);
console.log('Inherited prototype names cannot select a weapon');

const names=new Simulation(world);names.add('Agent');names.add('Agent 2');assert.equal(names.add('Agent').name,'Agent 3');assert.equal(new Set(names.units.map(u=>u.name)).size,3);
console.log('Name collision suffix advances, including user-supplied numbered names');

const tier=new Simulation(world,'tdm'),tu=tier.add('tier');tier.start(false);assert.equal(tu.weapon,'Spectre');assert.equal(tier.command(tu,{t:'equip',w:'Vandal'}),false);tier.remaining=450;assert.equal(tier.command(tu,{t:'equip',w:'Vandal'}),true);tier.time=3;assert.equal(tier.command(tu,{t:'equip',w:'Operator'}),false);tier.remaining=270;assert.equal(tier.command(tu,{t:'equip',w:'Operator'}),true);
console.log('TDM server enforces UI weapon tier unlocks at2and5minutes with Spectre start');
