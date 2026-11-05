// Fog gating of Clove's Meddle blast row (impact point): an enemy group that cannot see the point never gets the row; the own team does. Stub world with a wall at x=20.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {fogView} from './src/fog.js';import {tickAbilities} from './src/abilities.js';
const wall=(o,d,max)=>{if(Math.abs(d[0])<1e-9)return Infinity;const t=(20-o[0])/d[0];return t>0&&t<=max?t:Infinity;};
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:wall};
const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('A','Clove'),b=s.add('B','Jett');s.start(false);s.buy=0;s.roundDelay=0;s.phase='game';s.units=[a,b];b.team=1-a.team;
Object.assign(a,{x:30,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0});Object.assign(b,{x:0,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0});
const e=s.effects.push({id:++s.effectSeq,kind:'blast',owner:a.id,ag:'Clove',team:a.team,p:[35,.1,0],until:s.time+.6,radius:4.5,decay:70,at:s.time+.5,dnLinger:1});
const snap={...s.snapshot()};snap.fx=s.snapshot().fx;
const has=v=>(fogView(s,{...snap,fx:s.snapshot().fx},v).fx||[]).some(r=>r.kind==='blast');
assert.equal(has(a),true,'caster team gets its own row');
assert.equal(has(b),false,'enemy behind the wall does not get the impact point');
Object.assign(b,{x:30,z:3});s.time+=.05;assert.equal(has(b),true,'an enemy with sight of the point gets it');
console.log('fog clove blast ok');
