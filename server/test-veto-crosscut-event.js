// Omen Shrouded Step: explicit 'stepout/stepin' arrival event only on a real teleport; none when killed.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,smokeBlocks,CAGE} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,
 ray:(o,d,max=Infinity)=>{const t=d[1]<0?o[1]/-d[1]:Infinity;return t<=max?t:Infinity;}};
W.nav.nodes.push([0,0,-15]);W.nav.adj.push([0]);

const setup=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('ve','Veto');s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});u.ability.c=2;return{s,u};};
const events=s=>s.castEvents.filter(e=>e.ag==='Veto'&&e.sub);
for(const mode of ['ok','blocked','dead']){const{s,u}=setup();u.ability.xcut=[5,0,-5];u.ability.xcutReady=true;
assert(s.command(u,{t:'ab',k:'c',d:[0,0,-1],o:[0,1.6,0]}));assert.equal(events(s).length,0);assert.equal(u.pendingTeleport.kind,'xcut');
if(mode==='dead')u.alive=false;if(mode==='blocked')s.world.blocked=()=>true;
s.time+=.31;tickAbilities(s,.31);
if(mode==='ok'){assert.equal(events(s).length,2);assert.deepEqual(events(s).map(e=>e.p),[[0,0,0],[5,0,-5]]);assert.deepEqual(events(s).map(e=>e.k),['c','c']);}
else assert.equal(events(s).length,0,mode+' no fake completed teleport');}
console.log('Veto Crosscut completion two points, dead/blocked silent: PASS');
