// Route variety and spacing for server Spike bots (deterministic): over several rounds on real maps the attackers
// walk several distinct routes (not one shared shortest path) and moving teammates keep their distance.
//   BV_MEASURE=1 prints the numbers without asserting; BV_MAPS / BV_ROUNDS / BV_SECS override the run.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {loadWorld} from './src/world.js';import {SpikeSimulation} from './src/spike.js';
const assets={async fetch(r){try{return new Response(await fs.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
const ROUNDS=+(process.env.BV_ROUNDS||6),SECS=+(process.env.BV_SECS||22),out=[];
for(const map of (process.env.BV_MAPS||'ascent,bind').split(',')){
 const W0=await loadWorld(assets,map),W={...W0,ray:()=>0}; // no sight lines: measure movement, not fights
 let seed=11;const S=new SpikeSimulation(W,'five',map,()=>(seed=(seed*16807)%2147483647)/2147483647);S.start(true);
 const routes=new Set(),perRound=[];let dsum=0,dn=0,close=0;
 for(let r=0;r<ROUNDS;r++){if(r)S.newRound();S.buy=0;const atk=S.units.filter(u=>u.team===S.atk&&!u.human),tr=new Map(atk.map(u=>[u,[]]));
  for(let t=0;t<SECS/.05;t++){S.step(.05);S.roundDelay=0;for(const u of S.units){u.hp=100;u.alive=true;}
   if(t%4===0)for(const u of atk){const L=tr.get(u),c=Math.floor(u.x/5)+','+Math.floor(u.z/5);if(L[L.length-1]!==c)L.push(c);}
   if(t>60&&t%10===0)for(const u of atk){if(Math.hypot(u.vx||0,u.vz||0)<.5)continue;let m=Infinity;for(const v of atk)if(v!==u)m=Math.min(m,Math.hypot(u.x-v.x,u.z-v.z));dsum+=m;dn++;if(m<1.8)close++;}}
  const sig=new Set();for(const [,L] of tr){const k=L.slice(0,Math.min(L.length,14)).join(' ');sig.add(k);routes.add(k);}perRound.push(sig.size);}
 const avg=dsum/Math.max(1,dn),pc=100*close/Math.max(1,dn);
 out.push(`${map} distinct attacker routes ${routes.size} over ${ROUNDS} rounds (per round ${perRound.join('/')}), avg moving teammate gap ${avg.toFixed(2)} m, <1.8 m ${pc.toFixed(1)}%`);
 if(!process.env.BV_MEASURE){assert.ok(routes.size>=ROUNDS*4,`${map}: attackers use many distinct routes (${routes.size})`);assert.ok(perRound.every(n=>n>=4),`${map}: at least 4 distinct routes every round (${perRound})`);
  assert.ok(avg>=8,`${map}: average moving teammate gap ${avg.toFixed(2)} m`);assert.ok(pc<=15,`${map}: share of moving samples within 1.8 m of a teammate ${pc.toFixed(1)}%`);}
}
console.log('Bot variety (server): '+out.join('; '));
