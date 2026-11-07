// Clove Ruse: the smoke row carries ag + age so clients build the module dome at the row age.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,smokeBlocks,CAGE} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,
 ray:(o,d,max=Infinity)=>{const t=d[1]<0?o[1]/-d[1]:Infinity;return t<=max?t:Infinity;}};
W.nav.nodes.push([0,0,-15]);W.nav.adj.push([0]);
const setup=(human=true)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('cl','Clove'),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;u.human=human;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});return {s,u};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
{const {s,u}=setup();u.ability.e=Math.max(1,u.ability.e);u.agent='Clove';const ok=s.command(u,{t:'ab',k:'e',d:[0,0,-1],o:[u.x,u.y+1.6,u.z]});assert.equal(ok,true,'ruse cast');
 let r=s.snapshot().fx.filter(e=>e.kind==='smoke');assert.equal(r.length,1,'one smoke row');assert.equal(r[0].ag,'Clove','row carries the owner agent');assert.equal(r[0].age,0);
 tick(s,3);r=s.snapshot().fx.filter(e=>e.kind==='smoke');assert.ok(r[0].age>=2.9&&r[0].age<3.2,'age advances (late-join reconstruction)');assert.ok(r[0].tl<10,'time left shrinks');}
console.log('clove ruse row ok');
{const {s,u}=setup();const f=s.units.find(x=>x.name==='foe')||s.units.find(x=>x!==u);u.ability.q=Math.max(1,u.ability.q);assert.equal(s.command(u,{t:'ab',k:'q',d:[0,0,-1],o:[u.x,u.y+1.6,u.z]}),true,'meddle cast');
 const e=s.effects.find(x=>x.kind==='blast');Object.assign(f,{x:e.p[0],y:0,z:e.p[2]});const far=s.add('far');far.team=f.team;Object.assign(far,{x:e.p[0]+30,z:e.p[2]});const hp=f.hp;
 let r=s.snapshot().fx.find(x=>x.kind==='blast');assert.ok(r&&r.ag==='Clove'&&!r.dn,'flight row: ag, no dn');
 tick(s,Math.max(0,e.at-s.time-.05));assert.equal(f.hp,hp,'nothing before landing + windup');tick(s,.1);assert.ok(f.medDecay,'temporal debt starts on impact');
 r=s.snapshot().fx.find(x=>x.kind==='blast');assert.ok(r&&r.dn===1,'explicit impact flag on the lingering row');tick(s,.3);assert.equal(s.snapshot().fx.some(x=>x.kind==='blast'),false,'row ends after the linger');tick(s,2);assert.equal(s.effects.filter(x=>x.kind==='blast').length,0,'no repeated tick: row stays gone');}
console.log('clove meddle server ok');

