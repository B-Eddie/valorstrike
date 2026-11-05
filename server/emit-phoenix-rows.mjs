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

// emits the real snapshot fx rows of a Hot Hands cast at t=0.1 and t=2.5, and after expiry (JSON on stdout)
{const {s,u}=setup();u.ability.q=1;assert.equal(s.command(u,{t:'ab',k:'q'}),true);const out={};
 tick(s,.1);out.a=s.snapshot().fx.filter(r=>r.kind==='fire');out.ev=s.castEvents?.length??null;
 tick(s,2.4);out.b=s.snapshot().fx.filter(r=>r.kind==='fire');tick(s,3);out.c=s.snapshot().fx.filter(r=>r.kind==='fire');
 console.log(JSON.stringify(out));}
