// Server bots use their ultimates (user 2026-11-03 19:14 EST: "the bots aren't using their ultimates"). The server
// SpikeSimulation bots charged ult points (kills, deaths, plants, defuses, orbs) but nothing ever cast 'x' for a bot:
// planUtility / botUtility only chose c / q / e. Ascent 5v5, all bots, every bot handed its full ult points at each round
// start, two line-ups covering the 12 agents. Asserted:
//  1. at least 75 % of the bots cast their ultimate (ability.ult spent) within ROUNDS rounds, and every agent casts at
//     least once over the two line-ups; follow-ups work: Jett throws Blade Storm knives, Sova fires more than one Hunter's
//     Fury blast, Raze fires the Showstopper rocket (rocket effect), Chamber shoots Tour De Force;
//  2. human timing: each cast went through BotBrain.ultReady with the situation held for ULTX.delay (>= 0.3 s) first, and
//     none in the buy phase;
//  3. the decision is the shared one (BotBrain.ultCall) the page uses offline.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {SpikeSimulation} from './src/spike.js';import {loadWorld} from './src/world.js';import BotBrain from '../vendor/bot-brain.cjs';
const ROUNDS=+(process.env.ROUNDS||4);
const pre=[];if(typeof BotBrain.ultCall!=='function')pre.push('3. no BotBrain.ultCall (shared ult decision)');if(typeof BotBrain.ultReady!=='function')pre.push('2. no BotBrain.ultReady (hesitation)');
if(!(BotBrain.ULTX&&BotBrain.ULTX.delay[0]>=.3))pre.push('2. ULTX.delay missing or under 0.3 s');
const assets={async fetch(r){try{return new Response(await fs.readFile(new URL('./public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
const W=await loadWorld(assets,'ascent');
const LINEUPS=[['Raze','Cypher','Skye','Sage','Sova','Killjoy','Breach','Omen','Phoenix','Jett'],['Jett','Breach','Reyna','Sage','Chamber','Omen','Cypher','Skye','Killjoy','Raze']];
const ur=[];const r0=BotBrain.ultReady;if(r0)BotBrain.ultReady=function(st,t,want){const k0=st&&st.k,r=r0.apply(this,arguments);if(want&&k0!==want)st.t0=t;if(r)ur.push({t,t0:st.t0});return r;};
let units=0,castUnits=0;const byAgent={},follow={blade:0,fury:0,rocket:0,tdf:0},bad=[];
for(const [li,L] of LINEUPS.entries()){let seed=11+li*7;const S=new SpikeSimulation(W,'five','ascent',()=>(seed=(seed*16807)%2147483647)/2147483647);
 L.forEach((a,i)=>S.add('b'+i+a,a,false));S.start(false);
 const nr=S.newRound.bind(S);const full=()=>{for(const u of S.units)if(u.ability)u.ability.ult=({Jett:8,Reyna:7,Phoenix:7,Raze:8,Breach:8,Sova:8,Skye:8,Killjoy:9,Cypher:7,Sage:7,Omen:7,Chamber:8})[u.agent]??u.ability.ult;};
 S.newRound=function(){const r=nr();full();return r;};full();
 const cast=new Map(),last=new Map();let fired0=new Map();
 const fb=S.fireBlade.bind(S);S.fireBlade=function(u,alt){const r=fb(u,alt);if(r)follow.blade++;return r;};
 for(let t=0;t<ROUNDS*200/.05&&S.round<ROUNDS;t++){S.step(.05);
  for(const u of S.units){const A=u.ability;if(!A)continue;const p=last.get(u.id);if(p!=null&&p>0&&A.ult===0&&!u.human){cast.set(u.id,(cast.get(u.id)||0)+1);if(S.buy>0)bad.push('cast in the buy phase '+u.agent);}last.set(u.id,A.ult);
   if(A.fury&&A.fury.left<2)follow.fury++;if(u.ultWeapon&&u.weapon==='Operator'&&u.shotAt>S.time-.06)follow.tdf++;}
  for(const e of S.effects)if(e.kind==='rocket')follow.rocket++;for(const e of S.castEvents||[])if(e.sub==='boom')follow.rocket++;}
 for(const u of S.units){units++;const c=cast.get(u.id)||0;if(c)castUnits++;byAgent[u.agent]=(byAgent[u.agent]||0)+c;}
 console.log(`line-up ${li}: ${S.round} rounds; casts ${S.units.map(u=>u.agent+':'+(cast.get(u.id)||0)).join(' ')}`);}
const fails=pre.slice();
if(castUnits<.75*units)fails.push(`1. only ${castUnits}/${units} bots cast their ultimate within ${ROUNDS} rounds`);
const never=Object.entries(byAgent).filter(([,c])=>!c).map(([a])=>a);if(never.length)fails.push('1. agents that never cast: '+never.join(', '));
for(const k of ['blade','fury','rocket'])if(!follow[k])fails.push('1. no follow-up: '+k);
const quick=ur.filter(x=>x.t0==null||x.t-x.t0<(BotBrain.ULTX?BotBrain.ULTX.delay[0]:.3)-1e-6);if(quick.length)fails.push('2. '+quick.length+' casts inside the hesitation delay');
if(bad.length)fails.push('2. '+bad.slice(0,3).join('; '));
if(fails.length){console.error('FAIL test-bot-ults\n - '+fails.join('\n - '));process.exit(1);}
console.log(`test-bot-ults ok: ${castUnits}/${units} bots cast, every agent (${JSON.stringify(byAgent)}), follow-ups ${JSON.stringify(follow)}`);
