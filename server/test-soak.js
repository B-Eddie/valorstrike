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
//    (y -3400 seen). Now a falling unit with no floor below is put back where it last stood. The playable leash (motor
//    leashOk) now stops the walk at the edge first, so the rescue net is exercised with the leash lifted, and the
//    leash itself is checked: the same walk keeps the unit on the floor with no rescue needed.
{const s=new Simulation(W,'tdm','ascent');const u=s.add('Leashed');s.start(false);const p=node(-1.3,8.4,71.8);[u.x,u.y,u.z]=p;u.safe=null;
 const low=walk(s,u,Math.PI,6);assert(low>p[1]-.6,'leash: walking at the open edge stays on the floor: '+low);assert.equal(u.rescued||0,0,'leash: no rescue needed');assert(Math.hypot(u.x-p[0],u.z-p[2])<6,'leash: stopped at the edge');}
const LEASH=W.leash;delete W.leash;
{const s=new Simulation(W,'tdm','ascent');const u=s.add('Edge');s.start(false);const p=node(-1.3,8.4,71.8);[u.x,u.y,u.z]=p;u.safe=null;
 const low=walk(s,u,Math.PI,6);assert(low>minNav-1,'never below the map: '+low);assert(u.rescued>=1||low>p[1]-1.5,'rescued at the open edge, or held by the boundary fence (the nav-edge fence now closes this edge: no fall, no rescue needed)');assert.equal(u.deaths,0);assert(Number.isFinite(u.x+u.y+u.z));assert(Math.hypot(u.x-p[0],u.z-p[2])<6,'kept near the edge');}
{const s=new SpikeSimulation(W,'five','ascent');const u=s.add('Buyer');s.start(false);assert(s.buy>0);assert.equal(u.team,s.atk);const p=node(-1.3,8.4,71.8);[u.x,u.y,u.z]=p;
 const low=walk(s,u,Math.PI,6);assert(s.buy>0,'still the buy phase');assert(low>minNav-1,'buy phase: never below the map: '+low);assert(u.rescued>=1);assert(u.alive);}
W.leash=LEASH;

// 2. Wedged in collision: a bot settled where its capsule intersects a prop at A main (blocked where it stands) and every
//    move was rejected for the rest of the match. It is now moved to the nearest free nav node.
{const s=new Simulation(W,'dm','ascent');const t=s.add('Target'),b=s.add('Bot Reyna','Reyna',false);s.phase='game';const T=[0.25,8.07,-49.75];
 [b.x,b.y,b.z]=[16.71,11.71,-32.99];assert(W.blocked(b.x,b.z,.4,b.y,1.8),'start is inside collision');const start=[b.x,b.z];
 /* since map pass C2 (55bb06a) the shared motor backs an embedded capsule out on its own (moveAxis takes a move that grows its free radius), so either path frees it */let freeAt=-1;for(let k=0;k<60;k++){[t.x,t.y,t.z]=T;t.hp=100;t.alive=true;s.step(.05);if(freeAt<0&&!W.blocked(b.x,b.z,.4,b.y,1.8))freeAt=k;}assert(b.unwedged>=1||(freeAt>=0&&freeAt<20),'unwedged or backed out by the motor within 1 s: '+freeAt);assert(Math.hypot(b.x-start[0],b.z-start[1])>1,'moving again');assert(!W.blocked(b.x,b.z,.4,b.y,1.8));}

// 2b. Wedged high: a seat bot sat inside a prop at Ascent (-56, 6.53, -22.4), 2.5 m above the floor nodes (soak seed 9).
//     freeNode only accepted nodes within 1.5 m of its height, so unwedge and the escape found nothing for the rest of
//     the match. It now falls back to the nearest free node below (up to 4 m down).
{const s=new Simulation(W,'dm','ascent');const t=s.add('Target'),b=s.add('Bot Phoenix','Phoenix',false);s.phase='game';const at=[-55.98,6.53,-22.44];
 [b.x,b.y,b.z]=at;assert(W.blocked(b.x,b.z,.4,b.y,1.8),'start is inside collision');const p=s.freeNode(b);assert(p&&p[1]<at[1]-2,'free node below');
 for(let k=0;k<80;k++){[t.x,t.y,t.z]=[0.25,8.07,-49.75];t.hp=100;t.alive=true;s.step(.05);}assert(Math.hypot(b.x-at[0],b.z-at[2],b.y-at[1])>1,'moving again');assert(!W.blocked(b.x,b.z,.4,b.y,1.8),'out of the prop');}

// 2c. How that bot got up there: the shared motor climbed walls. Jumping into the corner of the building at Ascent
//     (-55.6, -22.1), the capsule crept to the wall at exactly blocked()'s .388 tolerance, where the same-radius test
//     flips with float noise; the "descending beside a riser" clamp then held it mid-air, contact counted as support,
//     and each new jump rose with no collision test into the wall (2.5-4.7 m up, inside the building). Now rises stop
//     at geometry, vertical probes use a 2 cm thinner capsule, and support needs a floor under the footprint.
{const Motor=(await import('./src/motor.cjs')).default;let worst=0,inside=0;
 for(const [x,y,z,a] of [[-55.25,3.98,-22.75,Math.PI],[-55.25,3.98,-22.75,2.75],[-57.5,4.01,-23.5,5.5],[-56.75,4.11,-19.75,4.71],[-54.5,4.15,-20.5,1.57]]){const u={x,y,z,vx:0,vy:0,vz:0};
  for(let k=0;k<80;k++){Motor.step(u,{x:-Math.sin(a),z:-Math.cos(a),speed:6.75,jump:k%12<2},.05,W);if(!u.air)worst=Math.max(worst,u.y-W.ground(u.x,u.z,u.y+.05));if(W.blocked(u.x,u.z,.36,u.y,1.8))inside++;}}
 assert(worst<.6,'no standing high up the wall: '+worst.toFixed(2));assert.equal(inside,0,'never inside the building');}

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

// 6b2. The progress check reset on any tick without forward input, so a bot that paused a tick now and then (replans,
//      escapes ending) never qualified; soak saw one held 8 s with 30 escapes and no reposition. Pauses no longer reset it.
{const s=new Simulation(W,'dm','ascent');const b=s.add('Bot Sova','Sova',false);s.phase='game';const p=W.nav.nodes[W.playable[500]];[b.x,b.y,b.z]=[p[0]+.3,p[1],p[2]];b.route=null;let moved=false;
 for(let k=0;k<140&&!moved;k++){s.time+=.05;b.input={forward:k%8===0?0:1};b.sawTarget=false;moved=s.botProgress(b);}assert(moved,'repositioned despite occasional idle ticks');
 const c=s.add('Bot Omen','Omen',false);[c.x,c.y,c.z]=[p[0]+.3,p[1],p[2]];let m2=false;for(let k=0;k<140;k++){s.time+=.05;c.input={forward:k%3===0?1:0};m2=m2||s.botProgress(c);}assert(!m2,'a bot mostly standing still is left alone');}

// 6c. Off-map pockets: past the Breeze walkway edge near (-30, -68) there is collision 4.3 m down with no nav node and
//     void around it; a bot walked off and stood there for the rest of the match (soak, seed 5). A unit standing over
//     1.5 m below its last on-graph spot with no playable node near is put back on the walkway. The playable leash
//     now stops the walk at the walkway edge (no rescue needed); the rescue net is then checked with the leash lifted.
{const B=await loadWorld(assets,'breeze');const BL=B.leash;for(const leashed of [true,false]){if(!leashed)delete B.leash;const s=new Simulation(B,'tdm','breeze');const u=s.add('Ledge');s.start(false);const p=B.nav.nodes[B.near(-29.75,-66.25,8.06)];
 for(const look of [Math.atan2(.76,2.12),Math.atan2(.76,2.12)-.5]){[u.x,u.y,u.z]=p;u.safe=u.anchor=null;u.vx=u.vy=u.vz=0;let low=Infinity;
  for(let k=0;k<60;k++){s.command(u,{t:'in',seq:++u.lastSeq+1,r:look,p:0,f:1,s:0});s.step(.05);if(!u.air)low=Math.min(low,u.y);}
  assert(low>7,'never stands in the pocket below the walkway: '+low.toFixed(2));}
 if(leashed)assert.equal(u.rescued||0,0,'leash: stopped at the walkway edge, no rescue needed');else assert(u.rescued>=2,'put back');assert(!s.offMesh(B,...p)&&s.offMesh(B,-30.51,3.77,-68.37),'pocket is off the graph, walkway is on it');
 const a=W.nav.nodes[W.playable[100]];assert(!s.offMesh(W,...a),'nav node on Ascent is on the graph');}B.leash=BL;}

// 6d. DM seat-taker (soak 13, DM): a human joining a full DM room took the replaced bot's team id, so it inherited that
//     bot's score row (points it never scored; the row no longer matched its kills). Each DM unit now has its own row.
{const s=new Simulation(W,'dm','ascent');s.add('host');s.start();const bot=s.units.find(u=>!u.human);s.scores[bot.team]=(s.scores[bot.team]||0)+4;bot.kills=4;
 const j=s.add('joiner');assert.equal(s.units.length,10);assert(!s.units.includes(bot)||s.units.some(u=>u!==j&&!u.human),'a bot gave up its seat');
 assert.equal(new Set(s.units.map(u=>u.team)).size,10,'every DM unit on its own side');assert.notEqual(j.team,bot.team);assert.equal(s.scores[j.team]||0,0,'no inherited points');}

const yawLog=[];
// 7. Short seeded soak through the real worker: fuzzing humans + bots, TDM and Spike, invariants every tick.
for(const [mode,seconds] of [['tdm',50],['five',70]]){const r=await soakRun({map:'ascent',mode,seconds,humans:3,seed:3,stuckSeconds:10});
 assert.deepEqual(r.errors,[],mode+' errors');const bad=r.violations.filter(v=>v.kind!=='bot stuck');assert.deepEqual(bad.map(v=>v.kind+': '+v.detail.slice(0,200)),[],mode+' invariants');assert(r.stats.ticks>seconds*15);if(mode==='tdm')assert(r.stats.kills>0);
 /* bots-tune-1: no impossible flicks - every bot's view stays within its own turn rate and hand acceleration (BotBrain turnAcc) */const Y=r.stats.yaw;assert(Y&&Y.n>1000,mode+' yaw samples');assert.equal(Y.overV,0,mode+' yaw speed over the turn rate ('+JSON.stringify(Y)+')');assert.equal(Y.overA,0,mode+' yaw acceleration over the hand limit ('+JSON.stringify(Y.worst)+')');yawLog.push(mode+' max '+Y.maxV.toFixed(1)+' rad/s / '+Y.maxA.toFixed(0)+' rad/s^2 ('+(Y.maxAk*100).toFixed(0)+' % of the hand limit, '+Y.n+' samples)');}
// Ability- and ult-heavy Spike soaks (bots and fuzzers spend utility / ults constantly, aimed at enemies) with the
// economy, carry-over, detain, Run It Back, owned-weapon and kill-event invariants of tools/soak-checks.mjs.
// Bind ults runs 150 s: with every ult refilled and cast, 70 s can end with no death at all (seed 5 after the hark merge).
for(const [map,scenario,seconds] of [['bind','ults',150],['lotus','abilities',70]]){const r=await soakRun({map,mode:'five',seconds,humans:4,seed:5,stuckSeconds:10,scenario,forceDeathAt:40});const F=r.stats.five;
 assert.deepEqual(r.errors,[],scenario+' errors');const bad=r.violations.filter(v=>v.kind!=='bot stuck');assert.deepEqual(bad.map(v=>v.kind+': '+v.detail.slice(0,200)),[],scenario+' invariants');
 const casts=Object.values(scenario==='ults'?F.ultCasts:F.abilityCasts).reduce((a,b)=>a+b,0);assert(casts>50,scenario+' casts '+casts);
 /* a death is guaranteed (forceDeathAt: a real utility kill between ticks once the round runs, after 40 s): the kill-event invariant above
    must have checked it, so this no longer flakes when load starves the natural fights (qa-19: one FAIL under box load) */
 assert(r.stats.forcedDeaths,scenario+' forced death happened');assert(F.deathsChecked>0,scenario+' deaths checked '+F.deathsChecked);}
console.log('Gameplay QA: open-edge falls rescued (TDM + Spike buy phase), wedged bot freed (also high on a prop), routes avoid prop-blocked nodes, leaving or replaced spike carrier hands over/drops, stuck-in-place escape, Spike bots skip discarded hunt routes, off-graph loose goal arrival, Breeze off-map pocket, seeded worker soak (TDM, Spike) clean; ability/ult-heavy Spike soaks (Bind ults, Lotus abilities) hold the economy/carry-over/detain/Run It Back/kill-event invariants; bot view kinematics '+yawLog.join(', ')+'');
process.exit(0);
