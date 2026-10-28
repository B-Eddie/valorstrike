// Spawn wall sealing pass over the committed walls (vendor/spawn-barriers.cjs DATA), after the generator
// (tools/spawn-barriers-gen.mjs --write): the generator's checks (nav cut, a walking capsule flood) miss ways out a player
// takes with the real motor (jumping onto a step / ledge beside a wall end, a corridor beside a bent panel). This pass:
//  1. FIX: hand-placed panels where the generated one stood along a corridor instead of across it;
//  2. probe (tools/spawn-barrier-probe.mjs escapes: real motor inputs from the spawn side of every piece) -> each panel a run
//     got past grows its end nearest to where the runs got out by 0.5 m, again until no run gets out (4 m per end at most);
//  3. top raised above a jump from the highest floor reachable beside the panel (+ margin), foot lowered to the doorway floor
//     - 0.4 m where it stood higher than 0.3 m over it; a grown end gets 0.5 m more (margin into the room's wall);
// then writes DATA back. usage: node tools/spawn-barriers-seal.mjs [map ...] [--write]
import fs from 'node:fs';import {createRequire} from 'node:module';import {loadWorld} from '../src/world.js';
import {escapes,heights,reach,polylines,sdist,nearestSd} from './spawn-barrier-probe.mjs';import {writeData} from './spawn-barriers-gen.mjs';
const require=createRequire(import.meta.url);process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
// Breeze attacker spawn, south-east exit: the generated panel ran along the corridor's west side (x 28, z 14 -> 16.25) and
// stopped at x 28 on z 14, leaving the 2.5 m corridor (x 28.3 - 30.8) and the strip under it (z 13.5) open; one panel across
// the corridor mouth at z 13 from the diagonal room wall (x 25.5) to past the east wall (x 32).
// Haven attacker spawn, east door (z 26): a 1 m step (x ~17) and a 2 m ledge (x 18 - 19.4) run along the room's east side
// past the door; the generated panel stopped at the step (x 17.25: its wall rays hit the step's riser), so a player climbed
// step + ledge round the end. The panel runs to the room's east wall (x 20.75).
// Lotus attacker spawn, west side: the generated panel 0 (x -18.75, z 29.25 -> 33.5) stopped 6.7 m short of panel 1 (x -17.25 from
// z 40.24), so a run-up went straight out past its end (z 34.5); panel 0 runs on to z 40.24 and turns to meet panel 1, its foot
// down to the doorway floor - 0.4. East door (z 29): stairs climb out through the doorway past the panel's end (x 0.19), so a
// player went up them round the end and over its 9.3 m top; the panel runs to x 2.2 and up to 12 m.
// Bind attacker spawn, east door, foot (barrier-3, the KNOWN open gap of 14c7c7c): under the panel a 2 m trench
// (x -22.5 .. -21) drops from the 8.9 m doorway floor to a 6.1 m layer that runs on under the spawn platform; a body in the
// trench walked under the 8.52 m foot. The trench / layer is off the playable leash (the motor never walks or falls into it
// from spawn: reach() and the escape runs from leash-valid starts), but the foot now goes down to 5.69 (the trench floor - 0.4).
// Bind attacker spawn, east door (z 5.25): past the grown end (x -21.82) the floor drops 2 m off a ledge, and the page's motor
// (30 fps, a 45 deg jump) dropped round the end; the panel runs 1 m further, to x -20.82 (over the ledge).
// Ascent attacker spawn, east door (panel 3, barrier-3): its west end (x 32.6) stopped 1.3 m short of the doorway's west wall
// (x ~31.3) under a 13 m overhang; the page's motor (30 fps) Updrafted over the 2 m box at the end and came down in the
// neutral area (work/test_spawn_barrier_tall_client.cjs). The panel runs on into that wall, to x 30.81.
export const FIX={ascent:{atk:{3:{p:[[30.81,8.36],[41.7,7.14]]}}},bind:{atk:{1:{p:[[-28.5,5.25],[-20.82,5.25]],y0:5.69}}},breeze:{atk:{3:{p:[[25.5,13],[32,13]],in:1}}},haven:{atk:{3:{p:[[8.41,26],[20.75,26]]}}},
 lotus:{atk:{0:{p:[[-18.75,29.25],[-18.75,40.24],[-17.25,40.24]],y:[4.38,11.33]},2:{p:[[-5.26,29],[2.2,29]],y:[5.9,12]}}}};
const r2=v=>Math.round(v*100)/100;
// ---- barrier-3: walls up to the sky (user: "Make barriers higher in buy phase, I can jump past one in Haven") ----
// Valorant's buy-phase barriers are walls you cannot get over at all - no jump, crouch-jump, jump off a box / ledge / step
// beside them, no Updraft / Satchel. The walls above stood 3.4 - 6.4 m over their doorway floor: a jump from Haven's
// attacker east door ledge (2.4 m, beside panel 3) cleared its 3.41 m top, and from the roofs / upper ledges a player gets
// onto beside other walls the same (tools/spawn-barrier-probe.mjs ledgeRuns). This pass:
//  1. ADD: walls the zone cut never made (no navigation link across the boundary): Haven defenders' west corridor (x -52 ..
//     -47.5, z 5.2: the C-side room at 6.0 m opens north into the neutral corridor sloping down to 5.2 m; reach() walked out);
//  2. every top -> SKY = the map's highest navigation node + SKY_UP (10 m): over anything reachable + an Updraft (5.3 m apex)
//     + a jump, i.e. effectively to the sky (one wall per doorway, so a column through a roof / upper floor stands only on the
//     zone boundary itself, and only while the buy phase runs);
//  3. every foot -> the lowest floor a player reaches beside the panel (reach(): cells within 1.2 m of its line on the spawn
//     side, over its span, at most FOOT_DROP under the foot - deeper is another level) - 0.4 m: Bind attackers' east door (panel 1) stood over a trench / under-platform floor 2.7 m below
//     the doorway (KNOWN open since 14c7c7c; FIX y0 below, as that
//     floor is off the playable leash), Breeze attacker 2 / defender 4 and Lotus attacker 3 a few cm;
//  4. reach() from the own zone until no cell gets out: each panel a flood got past grows its end nearest to where it got out
//     by 0.5 m (6 m per end at most), the foot is re-taken after a grow.
export const SKY_UP=10,FOOT_DROP=2.5;/* a floor more than 2.5 m under the foot is another level (Split's mid under a heaven door), not the doorway's */
export const ADD={haven:{def:[{p:[[-52.5,5.2],[-47,5.2]],y:[5.5,8.5],in:-1}]}};
export function skyTop(w){let m=-Infinity;w.nav.nodes.forEach((p,i)=>{if(!w.nav.valid||w.nav.valid[i])m=Math.max(m,p[1]);});return Math.ceil(m+SKY_UP);}
function footFrom(key,SB,keep,side,i){const q=polylines(SB,key).find(o=>o.side===side&&o.i===i);let low=Infinity;
 for(const [x,z,y] of keep[side]||[]){const sd=sdist(q,x,z);if(sd<0||sd>1.2)continue;let inSpan=false;for(const g of q.segs){const t=(x-g.ax)*g.tx+(z-g.az)*g.tz;if(t>=-.2&&t<=g.len+.2){inSpan=true;break;}}if(inSpan)low=Math.min(low,y);}
 return low;}
export function tall(w,key,SB,log=console.log){const D=SB.DATA[key],SKY=skyTop(w);
 for(const side in ADD[key]||{})for(const P of ADD[key][side]){if(!D[side].some(o=>JSON.stringify(o.p)===JSON.stringify(P.p))){D[side].push(JSON.parse(JSON.stringify(P)));log('add',key,side,D[side].length-1,JSON.stringify(P.p));}}
 for(const side of ['atk','def'])for(const P of D[side])P.y[1]=SKY;SB.set(key,D);log('sky',key,SKY);
 const grown={};let leaks=[];
 for(let it=0;it<20;it++){const keep={};const R=reach(w,key,SB,{keep});
  let moved=false;for(const side of ['atk','def'])D[side].forEach((P,i)=>{const low=footFrom(key,SB,keep,side,i);if(Number.isFinite(low)&&P.y[0]>low-.4+.05&&low>P.y[0]-FOOT_DROP){const v=r2(low-.4);log('foot',key,side,i,P.y[0],'->',v);P.y[0]=v;moved=true;}});SB.set(key,D);
  leaks=R.leaks;if(moved)continue;/* re-flood with the new feet before growing any end */if(!leaks.length)break;const polys=polylines(SB,key),by={};
  for(const l of leaks){const mine=polys.filter(o=>o.side===l.side);let best=null;for(const o of mine){const d=Math.abs(sdist(o,l.at[0],l.at[2]));if(d<6&&(!best||d<best.d))best={d,o};}if(!best){log('FAR',key,l.side,JSON.stringify(l));continue;}(by[l.side+':'+best.o.i]=by[l.side+':'+best.o.i]||[]).push(l);}
  if(!Object.keys(by).length)break;
  for(const k in by){const [side,i]=k.split(':'),P=D[side][+i],L=by[k];let best=null;for(const e of [0,P.p.length-1]){const q=P.p[e];let d=0;for(const l of L)d+=Math.hypot(l.at[0]-q[0],l.at[2]-q[1]);if(!best||d<best.d)best={d,e};}
   const e=best.e,q=P.p[e],o=P.p[e?e-1:1],dx=q[0]-o[0],dz=q[1]-o[1],l=Math.hypot(dx,dz)||1,gk=k+':'+e;grown[gk]=(grown[gk]||0)+.5;if(grown[gk]>6){log('UNSEALED (reach)',key,k,JSON.stringify(L[0]));continue;}
   P.p[e]=[r2(q[0]+dx/l*.5),r2(q[1]+dz/l*.5)];log('grow (reach)',key,side,i,'end',e,JSON.stringify(q),'->',JSON.stringify(P.p[e]),'('+L.length+' cells out)');}
  SB.set(key,D);}
 return {leaks};}
export async function seal(key,SB,log=console.log){const w=await loadWorld(assets,key),D=SB.DATA[key];
 for(const side in FIX[key]||{})for(const i in FIX[key][side]){const P=D[side][i];const F=FIX[key][side][i];if(F.p)P.p=F.p.map(q=>q.slice());if(F.y)P.y=F.y.slice();if(F.in!=null)P.in=F.in;if(F.y0!=null)P.y[0]=Math.min(P.y[0],F.y0);log('fix',key,side,i,JSON.stringify(P.p));}
 SB.set(key,D);tall(w,key,SB,log);/* barrier-3: sky tops, feet, reach() first; the motor runs then see the tall walls */const grown={};
 for(let it=0;it<10;it++){const {leaks}=escapes(w,key,SB);if(!leaks.length)break;const by={};for(const l of leaks)(by[l.side+':'+l.panel]=by[l.side+':'+l.panel]||[]).push(l);
  for(const k in by){const [side,i]=k.split(':'),P=D[side][+i],L=by[k];
   // the end nearest to where the runs got out (and started)
   let best=null;for(const e of [0,P.p.length-1]){const q=P.p[e];let d=0;for(const l of L)d+=Math.hypot(l.at[0]-q[0],l.at[2]-q[1])+Math.hypot(l.from[0]-q[0],l.from[2]-q[1]);if(!best||d<best.d)best={d,e};}
   const e=best.e,q=P.p[e],o=P.p[e?e-1:1],dx=q[0]-o[0],dz=q[1]-o[1],l=Math.hypot(dx,dz)||1,gk=k+':'+e;grown[gk]=(grown[gk]||0)+.5;
   if(grown[gk]>4){log('UNSEALED',key,k,'end',e,JSON.stringify(L[0]));continue;}
   P.p[e]=[r2(q[0]+dx/l*.5),r2(q[1]+dz/l*.5)];log('grow',key,side,i,'end',e,JSON.stringify(q),'->',JSON.stringify(P.p[e]),'('+L.length+' runs out)');}
  SB.set(key,D);}
 // a grown end goes 0.5 m further than the last run that got out (margin into the room's wall)
 for(const gk in grown){if(grown[gk]>4)continue;const [side,i,e]=gk.split(':'),P=D[side][+i],q=P.p[+e],o=P.p[+e?+e-1:1],dx=q[0]-o[0],dz=q[1]-o[1],l=Math.hypot(dx,dz)||1;P.p[+e]=[r2(q[0]+dx/l*.5),r2(q[1]+dz/l*.5)];log('margin',key,side,i,'end',e,'->',JSON.stringify(P.p[+e]));}
 SB.set(key,D);const {leaks}=escapes(w,key,SB);
 for(const h of heights(w,key,SB)){const P=D[h.side][h.panel];if(!h.okTop){P.y[1]=r2(Math.ceil((h.needTop+.05)*100)/100);log('top',key,h.side,h.panel,'->',P.y[1]);}if(!h.okFoot){P.y[0]=r2(h.floor-.4);log('foot',key,h.side,h.panel,'->',P.y[0]);}}
 SB.set(key,D);const T=tall(w,key,SB,log);/* again after the grows (idempotent: tops, feet, reach) */return {leaks:[...leaks,...T.leaks]};}
if(import.meta.url===`file://${process.argv[1]}`){const args=process.argv.slice(2),write=args.includes('--write'),maps=args.filter(a=>!a.startsWith('--'));const SB=require('../../vendor/spawn-barriers.cjs');
 const data=JSON.parse(JSON.stringify(SB.DATA));for(const k in data)SB.set(k,data[k]);let bad=0;
 for(const key of maps.length?maps:['ascent','bind','breeze','haven','lotus','split']){const r=await seal(key,SB);if(r.leaks.length){bad++;console.log('STILL OUT',key,JSON.stringify(r.leaks.slice(0,3)));}}
 if(write){writeData(new URL('../../vendor/spawn-barriers.cjs',import.meta.url).pathname,data);console.log('wrote vendor/spawn-barriers.cjs');}
 process.exit(bad?1:0);}
