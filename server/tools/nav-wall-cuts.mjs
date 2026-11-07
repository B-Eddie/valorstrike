// Nav edges through collision walls -> removed from navigation.json (user, Lotus: bots walk into walls; Split / Lotus: bots
// "pass through" walls). The navigation was baked before tools/map-render-walls.mjs restored render-only walls to collision
// (Lotus C Mound west rock wall, C Hall temple walls, Breeze Mid Bottom stall) and before the Lotus A Door east wall slot was
// boxed (map-void-fill.json lotus.boxes), so the graph still links nodes straight through those walls (and into nav points
// that now stand inside them). A* planned routes over them; the motor stops the bot at the wall, it stalls, re-plans the same
// edge, and the stuck rescue used to put it on the far node through the wall.
// An edge is cut when its straight segment hits the built collision (build-world.cjs output in public/worlds, the world the
// server and the page use) before the far end, from BOTH ends, at knee, chest and head height (0.6 / 1.2 / 1.7 m above the
// floors, 5 cm end tolerance). Nodes are never removed or invalidated: the movement leash (motor leashGrid) is built from
// the valid nodes; a pocket cut off from the main component keeps its leash cells when it is at floor height (leashGrid
// keeps other components within 4.6 m of the playable floor) and only drops out of the A* playable set. navigation.json is
// what world.js and the page (native_maps_runtime nmEnsure) both read, so bots plan the same graph offline and online.
// Idempotent. Usage (after build-all.cjs / build-world.cjs): node tools/nav-wall-cuts.mjs [maps...]   (WRITE=0 dry run)
import fs from 'node:fs';import {loadWorld} from '../src/world.js';
process.chdir(new URL('..',import.meta.url).pathname);
export const HEIGHTS=[.6,1.2,1.7];
// -> [[a, b], ...] (a < b) valid nav edges of nav (the raw navigation.json, no rope links) that cross W's collision
export function wallEdges(W,nav){const N=nav.nodes,A=nav.adj,out=[];
 const hit=(p,q,h)=>{const o=[p[0],p[1]+h,p[2]],d=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],L=Math.hypot(...d);return L>.05&&W.ray(o,d.map(v=>v/L),L)<L-.05;};
 for(let a=0;a<N.length;a++){if(!nav.valid[a])continue;for(const b of A[a]){if(b<a&&A[b].includes(a))continue;if(!nav.valid[b])continue;const p=N[a],q=N[b];if(HEIGHTS.every(h=>hit(p,q,h)&&hit(q,p,h)))out.push([Math.min(a,b),Math.max(a,b)]);}}
 return out;}
export const MAPS=['ascent','bind','haven','split','lotus','breeze'];
if(import.meta.url===`file://${process.argv[1]}`){for(const key of (process.argv.slice(2).length?process.argv.slice(2):MAPS)){
 const W=await loadWorld({fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))},key),file='../models/valorant/maps/'+key+'/navigation.json',nav=JSON.parse(fs.readFileSync(file,'utf8'));
 const cut=wallEdges(W,nav),drop=new Set(cut.flatMap(([a,b])=>[a+'>'+b,b+'>'+a]));let removed=0;
 nav.adj=nav.adj.map((l,a)=>l.filter(b=>{const k=drop.has(a+'>'+b);if(k)removed++;return !k;}));
 console.log(key,JSON.stringify({wallEdges:cut.length,directedRemoved:removed}));if(removed&&process.env.WRITE!=='0')fs.writeFileSync(file,JSON.stringify(nav));}}
