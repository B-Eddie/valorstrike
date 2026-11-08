// Spawn walls hold on the server (user: "In Breeze and Haven, the wall in buy phase isn't fully blocking the path, so I can
// sneak through it"). tools/spawn-barrier-probe.mjs: SpikeSimulation in its buy phase, a human sending real inputs from the
// spawn side of every wall piece of both spawns (along it and past both ends; run-ups, 45 deg either way, crouch-jumps, jump
// spam, hugging the wall to its end then out) must never cross a wall of its own spawn nor end up more than 1.5 m beyond the
// wall line outside its own zone. Static: every panel's top is above a jump from the highest floor reachable beside it, its
// foot under the doorway floor (+0.3 m). The page runs the same walls through its own collision at 30 / 10 fps
// (work/test_spawn_barrier_leaks_client.cjs).
// barrier-3 (user: "Make barriers higher in buy phase, I can jump past one in Haven"): walls stand to the sky as Valorant's -
// every top >= the map's highest valid navigation node + 8 m; reach() (walk / jump up 1.45 m / drop / crouch, on the leash,
// from the playable nodes of each own zone) gets no cell out; ledgeRuns() from the highest reachable places beside each
// wall (boxes, ledges, stairs, roofs) - jump spam, crouch-jump, an Updraft launch, a Tailwind dash - get none out; and the
// buy phase casts (allowed since user 2026-11-06 bug 4) never cross a wall, teleports refused (castAbility0). Red on 1588582 (Haven attacker
// east door jumped from its ledge, roofs beside walls, Haven defenders' west corridor with no wall).
//   SBL_MAPS=breeze,haven narrows the maps (default: all six).
import fs from 'node:fs';import {createRequire} from 'node:module';
import {loadWorld} from './src/world.js';import {escapes,heights,reach,ledgeRuns,polylines,nearestSd} from './tools/spawn-barrier-probe.mjs';import {SpikeSimulation} from './src/spike.js';
process.chdir(new URL('.',import.meta.url).pathname);
const SB=createRequire(import.meta.url)('../vendor/spawn-barriers.cjs');
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
const env=process.env.SBL_MAPS||'all',maps=env==='all'?['ascent','bind','breeze','haven','lotus','split']:env.split(','),fails=[],out=[];
for(const key of maps){const w=await loadWorld(assets,key);
 const H=heights(w,key,SB);for(const h of H){if(!h.okTop)fails.push(key+' '+h.side+' panel '+h.panel+': top '+h.y[1]+' < reachable floor '+h.reach.toFixed(2)+' + jump '+(h.needTop-h.reach).toFixed(2));if(!h.okFoot)fails.push(key+' '+h.side+' panel '+h.panel+': foot '+h.y[0]+' over the doorway floor '+h.floor.toFixed(2));}
 const {runs,leaks}=escapes(w,key,SB);const row=key+': '+H.length+' panels, '+runs+' escape runs, '+leaks.length+' out';out.push(row);if(process.env.VERBOSE)console.log(row);
 if(leaks.length){const by={};for(const l of leaks){const k=l.side+' piece '+l.piece+' (panel '+l.panel+')';(by[k]=by[k]||[]).push(l);}for(const k in by)fails.push(key+' '+k+': '+by[k].length+' x, e.g. '+JSON.stringify(by[k][0]));}
 if(runs<100)fails.push(key+': too few runs ('+runs+')');
 // barrier-3: tops to the sky, reach flood, ledge / ability runs
 let navTop=-Infinity;w.nav.nodes.forEach((p,i)=>{if(!w.nav.valid||w.nav.valid[i])navTop=Math.max(navTop,p[1]);});
 for(const p of SB.pieces(key))if(p.y1<navTop+8)fails.push(key+' '+p.side+' wall ('+p.ax+','+p.az+'): top '+p.y1+' < highest floor '+navTop.toFixed(2)+' + 8');
 const keep={},RR=reach(w,key,SB,{keep});if(RR.leaks.length)fails.push(key+' reach: '+RR.leaks.length+' cells out, e.g. '+JSON.stringify(RR.leaks[0]));
 const LR=ledgeRuns(w,key,SB,keep,{per:+process.env.SBL_PER||10});if(LR.leaks.length)fails.push(key+' ledge / ability runs: '+LR.leaks.length+' out, e.g. '+JSON.stringify(LR.leaks.slice(0,2)));if(LR.runs<40)fails.push(key+': too few ledge runs ('+LR.runs+')');
 out[out.length-1]+=', reach '+RR.cells+' cells / '+RR.leaks.length+' out, '+LR.runs+' ledge / ability runs / '+LR.leaks.length+' out';}
// buy phase abilities (the owner, 2026-11-07: the actual VALORANT buy phase, abilities.js BUY_PHASE): every agent's C / Q / E / X
// outside the table is refused; the allowed ones (Omen's Shrouded Step, Chamber's Rendezvous included) never carry the unit out
// past its spawn walls (1.5 s of buy-phase steps after each cast, every unit stays on its side) and never hurt anyone (buySafe)
{const w=await loadWorld(assets,maps[0]);const s=new SpikeSimulation(w,'five',maps[0],()=>.5),u=s.add('one'),o=s.add('two');s.start(false);let n=0,ok=0;
 const side=v=>v.team===s.atk?'atk':'def',zone=v=>{const P=polylines(SB,maps[0]).filter(q=>q.side===side(v)),d=nearestSd(P,v.x,v.z);return Number.isFinite(d)?Math.sign(d):0;};
 const {BUY_PHASE}=await import('./src/abilities.js');
 for(const ag of ['Jett','Phoenix','Sova','Sage','Reyna','Omen','Killjoy','Raze','Skye','Breach','Chamber','Cypher']){u.agent=ag;for(const k of ['c','q','e','x']){u.ability={...u.ability,c:2,q:2,e:2,ult:9,cool:{}};s.buy=20;s.effects=[];u.hp=o.hp=100;u.alive=o.alive=true;const z0=zone(u),r=s.command(u,{t:'ab',k});n++;if(r)ok++;
   if(!(BUY_PHASE[ag]||'').includes(k)){if(r||u.pendingTeleport)fails.push('buy phase: '+ag+' '+k+' not refused');}
   for(let i=0;i<30;i++)s.step(.05);const z1=zone(u);if(z0&&z1&&z0!==z1)fails.push('buy phase: '+ag+' '+k+' crossed the spawn wall');if(u.hp<100||o.hp<100||!u.alive||!o.alive)fails.push('buy phase: '+ag+' '+k+' hurt someone');u.pendingTeleport=null;u.dash=null;}}
 if(ok<8)fails.push('buy phase: only '+ok+' of '+n+' casts allowed');out.push('buy phase: '+ok+' / '+n+' ability casts allowed (BUY_PHASE), the rest refused, none crossed a spawn wall or hurt anyone');}
if(fails.length){console.log('FAIL spawn walls on the server ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
console.log('test-spawn-barrier-leaks: PASS\n  '+out.join('\n  '));
