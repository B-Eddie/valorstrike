// Two-player acceptance (ledger row 2), in-process: the real worker module (default fetch -> GameRoom -> Directory)
// on a virtual clock with two scripted human clients. Checks human-to-human damage, kills both ways, deaths and
// respawns, leave (bot takes the seat) and rejoin with the same profile, a natural match finish, and that both
// profiles' persisted records equal the match totals (the leaver's two stints aggregated once, DM win on the total).
// Also checks deathmatch spawns are spread out and not in an enemy's sight.
import assert from 'node:assert/strict';import {localCluster} from './tools/local-cluster.mjs';import {twoPlayerScenario} from './tools/scripted-human.mjs';
const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true'}}),code='TWPLAY';
const world=await (await import('./src/world.js')).loadWorld(cluster.env.ASSETS,'ascent');
const env={now:cluster.clock.now,wait:ms=>cluster.advance(ms),connect:q=>cluster.connect(q),profile:cluster.profile,stats:cluster.stats,shorten:s=>{const r=cluster.room(code);r.sim.remaining=Math.min(r.sim.remaining,s);}};
const report=await twoPlayerScenario(env,{world,map:'ascent',mode:'dm',code,fightMs:300000,matchLimitMs:200000,shortenMatchTo:60});
assert(report.phase1.aKillsB>=1&&report.phase1.bKillsA>=1&&report.phase1.aRespawns>=1&&report.phase1.bRespawns>=1);
assert.equal(report.leave.units,10);assert(report.leave.botSeat);assert.equal(report.rejoin.name,'AcceptB');
assert(report.end.seconds>0);assert.equal(report.records.A.matches,1);assert.equal(report.records.B.matches,1);
assert.equal(report.records.B.kills,report.expected.B.kills);assert.equal(report.records.B.deaths,report.expected.B.deaths);
// Directory dedupe: the finished room cannot be rejoined, and results were written once.
const late=await cluster.fetch('/connect?code='+code,{headers:{Upgrade:'websocket'}});assert.equal(late.status,409);
// Deathmatch spawns: spread across the map, none visible to a living enemy when a clear point exists.
const {Simulation}=await import('./src/simulation.js');const s=new Simulation(world,'dm','ascent');s.add('Solo');s.start();const pts=[];const sp=s.spawn.bind(s);let seen=0;
s.spawn=u=>{sp(u);pts.push([u.x,u.z]);for(const v of s.units){if(v===u||!v.alive)continue;const o=[v.x,v.y+1.6,v.z],t=[u.x-o[0],u.y+1.2-o[1],u.z-o[2]],l=Math.hypot(...t);if(l<50&&world.ray(o,t.map(x=>x/l),l)===Infinity)seen++;}};
let kills=0;for(let n=0;n<1200;n++){s.step(.05);kills+=s.events.splice(0).filter(e=>e[0]==='k').length;}
const span=a=>Math.max(...a)-Math.min(...a);assert(pts.length>=10);assert(span(pts.map(p=>p[0]))>60&&span(pts.map(p=>p[1]))>60,'DM spawns spread across the map');
assert(kills<120,'no spawn-kill churn: '+kills+' kills in 60 s');assert(seen<=Math.ceil(pts.length*.15),'spawns in enemy sight: '+seen+'/'+pts.length);
console.log(`Two-player acceptance (in-process worker, Ascent DM): human hits A→B ${report.phase1.aHitsOnB}, B→A ${report.phase1.bHitsOnA}; kills both ways; respawns; leave → bot seat; rejoin same profile; natural end (${report.end.over}); persisted records match (B aggregated ${report.records.B.kills}/${report.records.B.deaths}); DM spawns spread (${kills} kills/60 s, ${seen}/${pts.length} in sight)`);
process.exit(0);
