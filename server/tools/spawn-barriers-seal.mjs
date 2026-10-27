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
import {escapes,heights} from './spawn-barrier-probe.mjs';import {writeData} from './spawn-barriers-gen.mjs';
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
// Bind attacker spawn, east door (z 5.25): past the grown end (x -21.82) the floor drops 2 m off a ledge, and the page's motor
// (30 fps, a 45 deg jump) dropped round the end; the panel runs 1 m further, to x -20.82 (over the ledge).
export const FIX={bind:{atk:{1:{p:[[-28.5,5.25],[-20.82,5.25]]}}},breeze:{atk:{3:{p:[[25.5,13],[32,13]],in:1}}},haven:{atk:{3:{p:[[8.41,26],[20.75,26]]}}},
 lotus:{atk:{0:{p:[[-18.75,29.25],[-18.75,40.24],[-17.25,40.24]],y:[4.38,11.33]},2:{p:[[-5.26,29],[2.2,29]],y:[5.9,12]}}}};
const r2=v=>Math.round(v*100)/100;
export async function seal(key,SB,log=console.log){const w=await loadWorld(assets,key),D=SB.DATA[key];
 for(const side in FIX[key]||{})for(const i in FIX[key][side]){const P=D[side][i];Object.assign(P,FIX[key][side][i]);log('fix',key,side,i,JSON.stringify(P.p));}
 SB.set(key,D);const grown={};
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
 SB.set(key,D);return {leaks};}
if(import.meta.url===`file://${process.argv[1]}`){const args=process.argv.slice(2),write=args.includes('--write'),maps=args.filter(a=>!a.startsWith('--'));const SB=require('../../vendor/spawn-barriers.cjs');
 const data=JSON.parse(JSON.stringify(SB.DATA));for(const k in data)SB.set(k,data[k]);let bad=0;
 for(const key of maps.length?maps:['ascent','bind','breeze','haven','lotus','split']){const r=await seal(key,SB);if(r.leaks.length){bad++;console.log('STILL OUT',key,JSON.stringify(r.leaks.slice(0,3)));}}
 if(write){writeData(new URL('../../vendor/spawn-barriers.cjs',import.meta.url).pathname,data);console.log('wrote vendor/spawn-barriers.cjs');}
 process.exit(bad?1:0);}
