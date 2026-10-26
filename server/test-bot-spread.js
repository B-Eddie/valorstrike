// Bot teams split the map like real Valorant teams (bots-spread-1, user: "The opponent bots all just bunch up rather than
// doing their own thing, so I just get jumped by the entire team"). Deterministic (seeded RNG -> botSeed 0).
// 1. Pure (vendor/bot-brain.cjs areas / nearest / tradeSpot / follow): defence formations keep an anchor on every site and
//    put the rest in a mid / rotator / support / push slot, attackers default spread (entry + trade partner, map control,
//    flank) and only line up for an execute, GAP m apart; who answers a contact is capped.
// 2. Server Spike 5v5 (tools/bot-spread-metrics.mjs, real sight lines) on Ascent and Haven, both sides: mean pairwise
//    teammate distance, bots within 6 m of the first contact in the next 3 s, distinct areas held, true stacks (only on
//    plans that call for one), rotations / trades per event capped. Before (main 6ea8c3e) -> after numbers are printed;
//    BS_MEASURE=1 prints without asserting, BS_MAPS / BS_ROUNDS / BS_SECS override the run.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {measure} from './tools/bot-spread-metrics.mjs';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[];
// 1. formations
for(const sites of [['A','B'],['A','B','C']]){const forms=new Set(),slots={};let midRounds=0,std=0;
 for(let r=0;r<120;r++){const p=B.defensePlan(B.hash('dp|'+sites.length+'|'+r),sites,{});for(const n of [5,4,3]){if(n<sites.length)continue;const R=B.roles(p,n,B.hash('dr|'+r+'|'+n),false,sites);
   for(const s of sites)assert.ok(R.some(e=>e.site===s&&e.slot==='anchor'&&!e.rotator&&!e.stages.length),`${sites.length} sites, ${n} defenders (${p.type}): an anchor holds ${s}`);
   const per={};for(const e of R)if(!e.stages.length)per[e.site]=(per[e.site]||0)+1;
   for(const s in per)assert.ok(per[s]<=(p.type==='stack'?4:3),`${p.type}: at most 3 on one site outside a stack (${s}: ${per[s]})`);
   if(n===5){forms.add(R.formation);for(const e of R)slots[e.slot]=(slots[e.slot]||0)+1;if(p.type==='standard'){std++;if(R.some(e=>e.slot==='mid'||e.slot==='rot'))midRounds++;}}
   for(const e of R)if(e.slot==='mid'||e.slot==='rot')assert.ok(e.rotator&&e.stages[0]&&e.stages[0].site==='mid'&&e.stages[0].until>100,'mid / rotator hold the middle all round');}}
 assert.ok(forms.size>=5,`${sites.length} sites: several formations (${[...forms]})`);assert.ok(sites.length>2||midRounds/std>.5,`2 sites: most standard setups hold mid (${midRounds}/${std})`);
 out.push(`defence ${sites.length} sites: ${[...forms].join(' ')}; slots ${Object.entries(slots).map(([k,v])=>k+' '+v).join(', ')}`);}
for(const sites of [['A','B'],['A','B','C']]){const tg={};
 for(let r=0;r<200;r++){const p=B.attackPlan(B.hash('ap|'+sites.length+'|'+r),sites,{}),R=B.roles(p,5,B.hash('ar|'+r),true,sites,r%5);
  assert.ok(R.filter(e=>e.lurk).length<=1,'at most one lurker');
  if(p.type==='rush'){assert.ok(R.every(e=>!e.stages.length),'a rush has no staging');continue;}
  if(!R[r%5].lurk)assert.equal(R[r%5].slot,'trade','the carrier plays the trade slot behind the entry');
  const en=R.find(e=>e.slot==='entry'),tr=R.find(e=>e.slot==='trade');assert.ok(en&&tr,p.type+': entry and trade partner');
  if(p.type!=='fake'){assert.equal(tr.stages[0].site,en.stages[0].site);assert.equal(tr.stages[0].frac,en.stages[0].frac);assert.equal(tr.stages[0].back-en.stages[0].back,B.GAP,'trade partner GAP m behind its entry');}
  const line=R.filter(e=>e.stages[0]&&e.stages[0].site===en.stages[0].site&&e.stages[0].frac===en.stages[0].frac).map(e=>e.stages[0].back);assert.equal(new Set(line).size,line.length,'an execute line never shares a spot');
  const where=new Set(R.filter(e=>e.stages[0]).map(e=>e.stages[0].site));(tg[p.type]||(tg[p.type]=[])).push(where.size);
  if(p.type==='default'||p.type==='slow')assert.ok(where.size>=3&&where.has('mid'),`${p.type}: spread over the site, mid and the other side (${[...where]})`);}
 out.push(`attack ${sites.length} sites: staged areas per plan ${Object.entries(tg).map(([k,v])=>k+' '+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1)).join(', ')}`);}
// who answers a contact
{assert.deepEqual([...B.nearest([{id:3,d:9},{id:1,d:4},{id:2,d:4},{id:7,d:1}],2)],[7,1],'nearest two, ties by id');assert.equal(B.RESPOND.trade,2);assert.equal(B.RESPOND.rotate,2);assert.equal(B.RESPOND.push,1);
 const a=B.tradeSpot(0,0,0,10,0),b=B.tradeSpot(1,0,0,10,0),c=B.tradeSpot(2,0,0,10,0);assert.deepEqual([...a],[10,0]);assert.ok(Math.abs(Math.hypot(b[0]-10,b[1])-B.GAP)<1e-9&&Math.abs(b[0]-10)<1e-9,'2nd trader GAP m to the side');assert.ok(b[1]*c[1]<0,'3rd on the other side');
 assert.equal(B.follow(0,0,1,0,[[2,0]]),.55,'a teammate 2 m ahead: ease off');assert.equal(B.follow(0,0,1,0,[[-2,0]]),1,'behind: no effect');assert.equal(B.follow(0,0,1,0,[[1,3]]),1,'beside: no effect');assert.equal(B.follow(0,0,1,0,[[2,0,3.24]]),1,'a walking teammate ahead is overtaken');assert.equal(B.follow(0,0,1,0,[[2,0,9]]),.55,'a running (or line-held) teammate ahead: ease off');assert.equal(B.follow(0,0,1,0,[[5,0]]),1,'far ahead: no effect');
 const m=B.midPoint({A:[40,0,0],B:[-40,0,0]},[0,0,50],[0,0,-50]);assert.deepEqual(m,[0,0,0],'2 sites: the spawns midpoint');assert.deepEqual(B.midPoint({A:[40,0,0],B:[3,1,4],C:[-40,0,0]},[0,0,50],[0,0,-50]),[3,1,4],'3 sites: the middle site');}
// 2. server simulation, before (main 6ea8c3e, same harness) -> after
const BEFORE={"ascent":[{"pair":26.8,"jump":2,"jumpMean":1.75,"conv":2,"areas":2.13,"clump":0.01},{"pair":43.9,"jump":1,"jumpMean":1,"conv":2.25,"areas":2.21,"clump":0}],"haven":[{"pair":18.7,"jump":3,"jumpMean":1.8,"conv":2.8,"areas":1.5,"clump":0.028},{"pair":35.5,"jump":2,"jumpMean":1.4,"conv":1.4,"areas":2.87,"clump":0.004}]}; // main 6ea8c3e, same harness, 5 rounds x 55 s
const maps=(process.env.BS_MAPS||'ascent,haven').split(','),rounds=+(process.env.BS_ROUNDS||5),secs=+(process.env.BS_SECS||55);
for(const map of maps){const R=await measure(map,{rounds,secs,keep:true});
 for(const r of R){const tag=`${map} team${r.team}`;out.push(`${tag} (${r.team?'defending':'attacking'}): pair ${r.pair.toFixed(1)} m, first-contact 6 m/3 s max ${r.jumpMax} (mean ${r.jumpMean.toFixed(2)}), 12 m/10 s ${r.conv.toFixed(2)}, areas ${r.areas.toFixed(2)} (groups ${r.groups.toFixed(2)}), clump ${(100*r.clump).toFixed(0)}%, stacks ${r.stacks} (planned ${r.stackOk}), rotations/event max ${r.rotMax}, trades/death max ${r.tradeMax}`+(BEFORE[map]?` [before: pair ${BEFORE[map][r.team].pair}, contact max ${BEFORE[map][r.team].jump} mean ${BEFORE[map][r.team].jumpMean}, 12 m/10 s ${BEFORE[map][r.team].conv}, areas ${BEFORE[map][r.team].areas}, clump ${(100*BEFORE[map][r.team].clump).toFixed(0)}%]`:''));
  if(process.env.BS_MEASURE)continue;
  assert.ok(r.jumpMax<=3,`${tag}: at most 3 bots within 6 m of the first contact in 3 s (${r.jumpMax})`);
  assert.ok(r.pair>=15,`${tag}: mean pairwise teammate distance ${r.pair.toFixed(1)} m`);
  assert.ok(r.clump<=.12,`${tag}: >= 4 bots within 6 m in ${(100*r.clump).toFixed(0)}% of samples`);
  assert.ok(r.areas>=(r.team?2.6:1.4),`${tag}: distinct areas held ${r.areas.toFixed(2)}`);/* rounds 1-12: team 1 defends (2-1-2 / 1-3-1 ... holds 3+ areas), team 0 attacks (spawn exit counts as one) */
  if(r.team)assert.ok(r.conv<=1.8,`${tag}: defenders within 12 m of the first contact in 10 s ${r.conv.toFixed(2)} (the rest hold their areas)`);
  assert.equal(r.stacks,r.stackOk,`${tag}: true stacks only on execute / rush / stack plans`);
  assert.ok(r.rotMax<=B.RESPOND.rotate&&r.tradeMax<=B.RESPOND.trade,`${tag}: capped rotations (${r.rotMax}) / trades (${r.tradeMax})`);}}
console.log('Bot spread: '+out.join('; '));
