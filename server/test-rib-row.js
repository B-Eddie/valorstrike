// Phoenix Run It Back: state row (marker) + explicit return / retdeath cast events.
// Cypher Cyber Cage (wiki.playvalorant.com/en-us/Cyber_Cage): "INSTANTLY toss the cyber cage in front of Cypher. ACTIVATE to create a zone
// that blocks vision"; "tossing forward a cyber cage as a projectile. Once it lands on horizontal terrain, it turns invisible and remains
// indefinitely"; activated it forms the 3.72 m hollow cylinder for 7.25 s. Activation (Valorant): Q while looking at a placed cage activates
// it; with no charge left Q activates the cage nearest the crosshair. Was: Q placed an already-active cage 15 m ahead.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,smokeBlocks,CAGE} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,
 ray:(o,d,max=Infinity)=>{const t=d[1]<0?o[1]/-d[1]:Infinity;return t<=max?t:Infinity;}};
const setup=(human=true)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('ph','Phoenix'),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;u.human=human;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});return {s,u};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const cages=(s,u)=>s.effects.filter(e=>e.kind==='cage'&&e.owner===u.id),smokes=s=>s.effects.filter(e=>e.kind==='smoke'&&e.cyl);

const rows=s=>s.snapshot().fx.filter(r=>r.kind==='rib');
// A. window ends: marker row for the whole window, one 'return' event at the marker, row gone
{const {s,u}=setup();u.ability.ult=99;s.castEvents.length=0;assert.equal(s.command(u,{t:'ab',k:'x'}),true,'ult cast');
 const p0=[u.x,u.y,u.z];tick(s,.2);const r=rows(s);assert.equal(r.length,1);assert.deepEqual(r[0].p.map(n=>Math.round(n)),p0.map(n=>Math.round(n)),'marker at the cast point');assert.ok(r[0].tl>9&&r[0].tl<=10.5,'tl '+r[0].tl);
 tick(s,5);assert.equal(rows(s).length,1,'still there mid-window');
 s.castEvents.length=0;tick(s,5.5);assert.equal(rows(s).length,0,'row gone after the return');
 const ev=s.castEvents.filter(e=>e.sub==='return'||e.sub==='retdeath');assert.equal(ev.length,1,'exactly one return event');assert.equal(ev[0].sub,'return','time-out return');}
// B. killed during the window: 'retdeath' event with the body point in o and the marker in p, row gone
{const {s,u}=setup();u.ability.ult=99;s.command(u,{t:'ab',k:'x'});const mk=[u.x,u.y,u.z];tick(s,.2);u.x+=6;u.alive=false;s.castEvents.length=0;tick(s,.1);
 const ev=s.castEvents.filter(e=>e.sub==='return'||e.sub==='retdeath');assert.equal(ev.length,1);assert.equal(ev[0].sub,'retdeath');assert.deepEqual(ev[0].p.map(Math.round),mk.map(Math.round),'marker');assert.ok(Math.abs(ev[0].o[0]-(mk[0]+6))<1e-6,'death point');assert.equal(rows(s).length,0,'row gone with the return');}
console.log('run it back rows/events ok');
