// Bots walk with purpose, not back and forth (bug 7, user 2026-11-06: "bots repeatedly walk back and forth instead of
// playing intelligently"). Cause: every timed repath (P.repath, 0.8-1.7 s) started the route at the nav node nearest the
// bot - often one it had just passed - so it turned round to touch it and turned again; an over-budget re-route returned
// the plain A* lane one tick and the varied lane the next (two routes, two directions). Fix (spike.js goalPath, bots.js
// routeAhead / variedPath keep, simulation.js botUnseen): the route is kept while the goal is the same and the bot is on it,
// passed nodes are dropped (fresh routes and every tick), an over-budget re-route keeps the route the bot has.
//  1. unit: routeAhead drops the passed node, keeps a node ahead / on another floor; variedPath over budget keeps the old route.
//  2. Ascent 5v5 Spike (ROUNDS rounds, all bots), off-fight movement sampled every 0.25 s per bot:
//     - reversals (two 0.25 s legs > 0.5 m each, the second turning back > 127 deg) per minute of walking <= 2 (before: 5.7);
//     - dither windows (3.25 s: walked > 3 m, ended < 30 % of that from where it started) <= 6 % (before: 12.4 %);
//     - path efficiency (net / walked over those windows) >= 0.78 (before: 0.72).
//   node test-bot-oscillation.js     (ROUNDS=5 by default; PROBE=1 prints and never fails)
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {SpikeSimulation} from './src/spike.js';import {loadWorld} from './src/world.js';import {routeAhead,variedPath} from './src/bots.js';
const ROUNDS=+(process.env.ROUNDS||5),PROBE=!!process.env.PROBE;
// 1. unit
{const N=[[0,0,0],[1,0,0],[2,0,0],[3,0,0],[2,4,0]];
 assert.deepEqual(routeAhead(N,[0,1,2,3],1.6,0,0),[2,3],'nodes the bot walked past are dropped');
 assert.deepEqual(routeAhead(N,[0,1,2,3],-.5,0,0),[0,1,2,3],'a node ahead stays');
 assert.deepEqual(routeAhead(N,[1,4],1.4,0,0.3),[1,4],'the next node on another floor: the first node stays (the stairs start there)');
 const W={nav:{nodes:N.concat([[4,0,0],[5,0,0]]),adj:[]},map:{},allowed:null},sim={world:W,time:1,_vrT:1,_vrN:2,units:[],map:'t'},u={name:'b',id:1,team:0};
 const keep=[2,3,5],r=variedPath(sim,u,1,6,()=>[1,2,3,5,6],keep);assert.equal(r,keep,'over the re-route budget a bot keeps its route');
 assert.deepEqual(variedPath(sim,u,1,6,()=>[1,2,3,5,6],null),[1,2,3,5,6],'no route yet: the plain one');}
// 2. sim
const assets={async fetch(r){try{return new Response(await fs.readFile(new URL('./public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
const W=await loadWorld(assets,'ascent');
const L=['Raze','Cypher','Skye','Sage','Sova','Killjoy','Breach','Omen','Phoenix','Jett'];let seed=23;
const S=new SpikeSimulation(W,'five','ascent',()=>(seed=(seed*16807)%2147483647)/2147483647);L.forEach((a,i)=>S.add('b'+i+a,a,false));S.start(false);
const trail=new Map(),o={moveT:0,rev:0,win:0,dither:0,L:0,D:0};let round=S.round;
for(let k=0;k<ROUNDS*200/.05&&S.round<ROUNDS;k++){S.step(.05);if(S.round!==round){round=S.round;trail.clear();}if(S.buy>0||Math.round(S.time*20)%5)continue;
 for(const u of S.units){if(u.human)continue;if(!u.alive||u.sawTarget||S.time-(u.engagedAt||-9)<1){trail.delete(u.id);continue;}
  let T=trail.get(u.id);if(!T)trail.set(u.id,T=[]);T.push([u.x,u.z]);if(T.length>14)T.shift();const n=T.length;
  if(n>=3){const a=T[n-3],b=T[n-2],c=T[n-1],l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]);if(l2>.3)o.moveT+=.25;if(l1>.5&&l2>.5&&((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))/(l1*l2)<-.6)o.rev++;}
  if(n===14&&Math.round(S.time*4)%4===0){let Lp=0;for(let i=1;i<n;i++)Lp+=Math.hypot(T[i][0]-T[i-1][0],T[i][1]-T[i-1][1]);const Dn=Math.hypot(T[n-1][0]-T[0][0],T[n-1][1]-T[0][1]);if(Lp>3){o.win++;o.L+=Lp;o.D+=Dn;if(Dn<.3*Lp)o.dither++;}}}}
const rpm=o.rev/(o.moveT/60||1),dith=o.dither/Math.max(1,o.win),eff=o.D/(o.L||1);
console.log(`oscillation: ${S.round} rounds, ${(o.moveT/60).toFixed(1)} bot-min walking, ${rpm.toFixed(2)} reversals / min, dither windows ${(dith*100).toFixed(1)} % of ${o.win}, efficiency ${eff.toFixed(3)}`);
const fails=[];if(o.moveT<600)fails.push(`enough walking (${(o.moveT/60).toFixed(1)} bot-min >= 10)`);
if(!(rpm<=2))fails.push(`reversals ${rpm.toFixed(2)} / min (<= 2; before 5.7)`);if(!(dith<=.06))fails.push(`dither windows ${(dith*100).toFixed(1)} % (<= 6 %; before 12.4 %)`);if(!(eff>=.78))fails.push(`efficiency ${eff.toFixed(3)} (>= 0.78; before 0.72)`);
if(fails.length&&!PROBE){console.error('FAIL test-bot-oscillation\n - '+fails.join('\n - '));process.exit(1);}
console.log(fails.length?'PROBE (would fail): '+fails.join('; '):'test-bot-oscillation ok');
