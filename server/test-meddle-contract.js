// Meddle: shared approximate Class 3 flight, grounded .75 landing windup / 4 m / all players / LOS / max 90 / 5 s.
// Ramp .75 and restore 1.75 are source ESTIMATES. No rendered acceptance.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';import Debt from '../vendor/meddle-decay.cjs';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:(o,d,max=Infinity)=>{const g=d[1]<0?o[1]/-d[1]:Infinity,t=d[0]>0?(2-o[0])/d[0]:Infinity;return Math.min(g>=0&&g<=max?g:Infinity,t>0&&t<=max?t:Infinity);}};
const mk=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('cl','Clove');s.start(false);s.buy=0;s.roundDelay=0;s.phase='game';Object.assign(u,{human:true,x:0,y:0,z:0,look:0});u.ability.q=1;assert.equal(s.command(u,{t:'ab',k:'q',o:[0,1.6,0],d:[0,0,-1]}),true);const e=s.effects.find(e=>e.meddle);const add=(name,x,z,team)=>{const t=s.add(name,'Jett');Object.assign(t,{x:e.p[0]+x,y:0,z:e.p[2]+z,team,alive:true,loading:false,hp:100});return t;};return {s,u,e,add};};
const until=(s,T)=>{while(s.time<T-1e-9){const dt=Math.min(.01,T-s.time);s.time+=dt;tickAbilities(s,dt);}};
{const {s,u,e,add}=mk(),base=s.time;assert.ok(e.landAt>base);assert.ok(Math.abs(e.at-e.landAt-.75)<1e-8);assert.equal(e.radius,4);
 const inside=add('inside',0,3.999,1-u.team),outside=add('outside',0,4.001,1-u.team),ally=add('ally',-1,0,u.team),blocked=add('blocked',3,0,1-u.team);Object.assign(u,{x:e.p[0]-2,z:e.p[2]});
 until(s,e.at-.001);assert.equal(inside.hp,100,'not before landing + windup');until(s,e.at+.02);assert.ok(e.dn,'explicit impact');const hit=inside.medDecay.start;
 assert.ok(inside.medDecay&&ally.medDecay&&u.medDecay,'enemy, ally, caster');assert.equal(outside.medDecay,null,'4.001 out');assert.equal(blocked.medDecay,null,'wall blocks LOS');
 until(s,hit+.75);assert.ok(Math.abs(inside.hp-10)<1e-7,'90 HP ramp');assert.equal(s.effects.some(x=>x.meddle),false,'no persistent blast/repeated impacts');
 inside.hp-=5;until(s,hit+3.25);assert.ok(Math.abs(inside.hp-5)<1e-7,'hold until restoration');until(s,hit+5.01);assert.ok(Math.abs(inside.hp-95)<1e-7,'restore only debt, preserve real damage');assert.equal(inside.medDecay,null);}
{const {s,u,e,add}=mk(),v=add('v',-1,0,1-u.team);u.alive=false;until(s,e.at+.1);assert.ok(v.medDecay,'caster death does not erase an already thrown projectile');}
{const {s,e,add}=mk(),v=add('v',-1,0,0);v.alive=false;until(s,e.at+.1);assert.equal(v.medDecay,null,'dead victim excluded');}
{const {s,e,add}=mk(),v=add('v',-1,0,0);s.effects=[];until(s,e.at+1);assert.equal(v.hp,100,'cleared effects cancel impact');}
{const v={hp:20};Debt.begin(v,0);Debt.tick(v,.75,true,100);assert.equal(v.hp,1,'never below 1 HP');Debt.tick(v,5,true,100);assert.equal(v.hp,20,'restore actual debt, not 90 unconditionally');}
{const v={hp:150};Debt.begin(v,0);Debt.tick(v,.75,true,150);assert.equal(v.hp,60);Debt.tick(v,5,true,150);assert.equal(v.hp,150,'overheal cap preserved');}
{const {s,u}=mk();u.medDecay={debt:80};s.spawn(u);assert.equal(u.medDecay,null,'respawn clears old debt');}
console.log('meddle contract ok (real authority/temporal module, stub world)');
