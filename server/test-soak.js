// Gameplay QA regressions found by the soak/fuzz harness (tools/soak.mjs), on the real Ascent world, plus a short
// seeded soak (TDM and Spike) through the real worker with fuzzing human clients. Each block names the defect it pins.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadWorld} from './src/world.js';import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {path,blockedNodes} from './src/path.js';
import {soakRun} from './tools/soak.mjs';
const assets={async fetch(r){try{return new Response(fs.readFileSync(new URL('./public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
const W=await loadWorld(assets,'ascent');const minNav=Math.min(...W.playable.map(i=>W.nav.nodes[i][1]));
const node=(x,y,z)=>W.nav.nodes[W.near(x,z,y)];
const walk=(s,u,look,seconds,each=()=>{})=>{let low=Infinity;for(let k=0;k<seconds*20;k++){s.command(u,{t:'in',seq:++u.lastSeq+1,r:look,p:0,f:1,s:0});s.step(.05);low=Math.min(low,u.y);each(k);}return low;};

// 1. Open map edge behind the attacker spawn (no wall, no floor below): units fell out of the world. In DM/TDM they
//    fell to y -20 and respawned elsewhere; in a Spike buy phase there was no check at all and they fell forever
//    (y -3400 seen). Now a falling unit with no floor below is put back where it last stood.
{const s=new Simulation(W,'tdm','ascent');const u=s.add('Edge');s.start(false);const p=node(-1.3,8.4,71.8);[u.x,u.y,u.z]=p;u.safe=null;
 const low=walk(s,u,Math.PI,6);assert(low>minNav-1,'never below the map: '+low);assert(u.rescued>=1,'rescued at the open edge');assert.equal(u.deaths,0);assert(Number.isFinite(u.x+u.y+u.z));assert(Math.hypot(u.x-p[0],u.z-p[2])<6,'kept near the edge');}
{const s=new SpikeSimulation(W,'five','ascent');const u=s.add('Buyer');s.start(false);assert(s.buy>0);assert.equal(u.team,s.atk);const p=node(-1.3,8.4,71.8);[u.x,u.y,u.z]=p;
 const low=walk(s,u,Math.PI,6);assert(s.buy>0,'still the buy phase');assert(low>minNav-1,'buy phase: never below the map: '+low);assert(u.rescued>=1);assert(u.alive);}

// 2. Wedged in collision: a bot settled where its capsule intersects a prop at A main (blocked where it stands) and every
//    move was rejected for the rest of the match. It is now moved to the nearest free nav node.
{const s=new Simulation(W,'dm','ascent');const t=s.add('Target'),b=s.add('Bot Reyna','Reyna',false);s.phase='game';const T=[0.25,8.07,-49.75];
 [b.x,b.y,b.z]=[16.71,11.71,-32.99];assert(W.blocked(b.x,b.z,.4,b.y,1.8),'start is inside collision');const start=[b.x,b.z];
 for(let k=0;k<60;k++){[t.x,t.y,t.z]=T;t.hp=100;t.alive=true;s.step(.05);}assert(b.unwedged>=1,'unwedged');assert(Math.hypot(b.x-start[0],b.z-start[1])>1,'moving again');assert(!W.blocked(b.x,b.z,.4,b.y,1.8));}

// 3. About 5% of playable nav nodes sit inside props; routes now pay 8 m to enter one, so bots walk around obstacles
//    (150 seeded routes: 5.7% of route nodes blocked before, 0.8% now).
{const bl=blockedNodes(W);let n=0;for(const i of W.playable)n+=bl[i];assert(n>100,'blocked nodes found: '+n);
 let visits=0,total=0,r=1;const rnd=()=>(r=(r*16807)%2147483647)/2147483647,free=W.playable.filter(i=>!bl[i]);
 for(let k=0;k<150;k++){const a=free[Math.floor(rnd()*free.length)],b=free[Math.floor(rnd()*free.length)],route=path(W,a,b);total+=route.length;for(const i of route)visits+=bl[i];}
 assert(visits/total<.015,`routes avoid blocked nodes: ${visits}/${total}`);}

// 4. Spike carrier leaving the room: the spike pointed at a unit that no longer existed for the rest of the buy phase.
//    Buy phase: the next attacker carries it. Live round: it drops where the carrier stood.
{const s=new SpikeSimulation(W,'five','ascent');s.add('A1');s.add('A2');s.add('D1');s.start(false);const atk=s.units.filter(u=>u.team===s.atk);assert(atk.length>=2);
 const c=s.units.find(u=>u.id===s.spike.carrier);s.release(c);s.units=s.units.filter(u=>u!==c);const next=s.units.find(u=>u.id===s.spike.carrier);assert(next&&next.team===s.atk&&s.spike.st==='carry','handed over in the buy phase');
 s.buy=0;next.x+=1;s.release(next);s.units=s.units.filter(u=>u!==next);assert.equal(s.spike.st,'drop');assert.equal(s.spike.carrier,null);assert.equal(s.spike.x,next.x);
 assert(fs.readFileSync(new URL('./src/worker.js',import.meta.url),'utf8').includes('this.sim.release?.(s.u);this.sim.units=this.sim.units.filter'),'room drop releases the spike');}

// 4b. A human joining a full Spike room replaces a bot; when that bot carried the spike, the spike pointed at a removed
//     unit. add() now releases it first.
{const s=new SpikeSimulation(W,'five','ascent');s.add('Host');s.start();assert.equal(s.units.length,10);const carrier=s.units.find(u=>u.id===s.spike.carrier);
 if(!carrier.human){const order=s.units.indexOf(carrier);s.units.splice(order,1);s.units.unshift(carrier);}else{const bot=s.units.find(u=>!u.human&&u.team===s.atk);s.spike.carrier=bot.id;s.units.splice(s.units.indexOf(bot),1);s.units.unshift(bot);}
 const joined=s.add('Joiner');assert(s.units.some(u=>u.id===s.spike.carrier),'spike carrier still in the match after a join');assert(joined);}

// 5. Spike bots computed a full A* hunt route to the nearest enemy every tick and threw it away (goalPath drives them),
//    over half of Spike CPU. Non-fighting Spike bots no longer route in the base hunt.
{const s=new SpikeSimulation(W,'five','ascent');s.add('Bot Jett','Jett',false);s.start();s.buy=0;let near=0;const n0=s.world.near;s.world.near=(...a)=>{near++;return n0(...a);};
 for(let k=0;k<100;k++)s.step(.05);const bots=s.units.filter(u=>!u.human).length;assert(near<bots*100*.6,`near() calls ${near} for ${bots} bots x 100 ticks`);}

// 6. A loose objective goal off the nav graph (offset into a wall or onto another floor): the bot reached the route's
//    last node and kept walking into the wall for the rest of the round. Standing on the last node is now arrival.
{const s=new SpikeSimulation(W,'five','ascent');const b=s.add('Bot Sage','Sage',false);s.start(false);s.buy=0;const goal={x:-9.8,y:8.1,z:-62.7},n=node(goal.x,goal.y,goal.z);
 assert(Math.hypot(n[0]-goal.x,n[2]-goal.z)>1.2,'goal is off the graph');[b.x,b.y,b.z]=n;b.goalOff=[0,0];b.route=null;s.goalPath(b,goal,true);assert.equal(b.input.forward,0,'arrived');
 b.route=null;s.goalPath(b,goal,false);assert.equal(b.input.forward,1,'exact goals (spike) still step toward the goal');}

// 6b. Escape loops: on Lotus a bot facing a step the motor will not climb sidestepped and re-tried in place for the rest
//     of the match (37 escapes, under 1 m of progress). Under 1.5 m in 5 s while walking now puts it on the route node.
{const L=await loadWorld(assets,'lotus');const s=new Simulation(L,'dm','lotus');const t=s.add('Target'),b=s.add('Bot Cypher','Cypher',false);s.phase='game';const T=L.nav.nodes[L.near(-18.7,14.3,4)],start=[-6.39,3.88,-5.46];
 [b.x,b.y,b.z]=start;let far=0;for(let k=0;k<200;k++){[t.x,t.y,t.z]=T;t.hp=100;t.alive=true;s.step(.05);far=Math.max(far,Math.hypot(b.x-start[0],b.z-start[2]));}assert(far>2,'bot got past the step: '+far.toFixed(2));}

// 7. Short seeded soak through the real worker: fuzzing humans + bots, TDM and Spike, invariants every tick.
for(const [mode,seconds] of [['tdm',50],['five',70]]){const r=await soakRun({map:'ascent',mode,seconds,humans:3,seed:3,stuckSeconds:10});
 assert.deepEqual(r.errors,[],mode+' errors');const bad=r.violations.filter(v=>v.kind!=='bot stuck');assert.deepEqual(bad.map(v=>v.kind+': '+v.detail.slice(0,200)),[],mode+' invariants');assert(r.stats.ticks>seconds*15);if(mode==='tdm')assert(r.stats.kills>0);}
console.log('Gameplay QA: open-edge falls rescued (TDM + Spike buy phase), wedged bot freed, routes avoid prop-blocked nodes, leaving or replaced spike carrier hands over/drops, stuck-in-place escape, Spike bots skip discarded hunt routes, off-graph loose goal arrival, seeded worker soak (TDM, Spike) clean');
process.exit(0);
