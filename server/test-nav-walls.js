// Navigation edges never cross collision (user: bots walk into / "pass through" walls on Lotus and Split). The nav graph was
// baked before tools/map-render-walls.mjs restored render-only walls (Lotus C Mound west rock wall, C Hall temple walls,
// Breeze Mid Bottom stall) and before the Lotus A Door east wall slot was boxed; tools/nav-wall-cuts.mjs removes every edge
// whose segment hits the built collision from both ends at knee / chest / head height. On the prebuilt worlds (public/worlds):
//  1. all six maps: 0 nav edges through collision (navigation.json as shipped, rope links excluded - they climb);
//  2. the nodes the cut edges led to (inside the C Mound rock, inside the A Door slot box, inside the Breeze stall) are out
//     of the playable set (A* never targets them); spawn and site nodes stay playable;
//  (the movement leash is unaffected: nodes are never removed; leashGrid keeps the cut pockets' cells - 9020 Lotus / 12425
//  Breeze leash nodes before and after the cuts)
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {loadWorld} from './src/world.js';import {wallEdges,MAPS} from './tools/nav-wall-cuts.mjs';
const here=path.dirname(new URL(import.meta.url).pathname),pub=f=>path.join(here,'public',f);
const counts={};
for(const key of MAPS){const W=await loadWorld({fetch:async r=>new Response(await fs.promises.readFile(pub(new URL(r.url).pathname)))},key);
 const raw=JSON.parse(fs.readFileSync(pub('worlds/'+key+'/navigation.json'),'utf8'));const cut=wallEdges(W,raw);counts[key]=cut.length;
 assert.equal(cut.length,0,key+': nav edges through collision '+JSON.stringify(cut.slice(0,5).map(([a,b])=>[raw.nodes[a],raw.nodes[b]]))+' (run node tools/nav-wall-cuts.mjs '+key+')');
 const sp=[...Object.values(raw.spawnNodes||{}).flat(),...Object.values(raw.siteNodes||{}).flat()].filter(Number.isInteger);
 for(const i of sp)assert.ok(W.allowed.has(i),key+': spawn / site node '+i+' still playable');
 // 2: pockets behind the restored walls
 const POCKETS={lotus:[[-42.75,4.9,18.5,'C Mound west rock wall'],[42.75,6.3,-1.75,'A Door east wall slot']],breeze:[[-5.75,4.02,32,'Mid Bottom stall']]}[key]||[];
 for(const [x,y,z,what] of POCKETS){const N=W.nav.nodes;let i=-1,d=1e9;for(let k=0;k<N.length;k++){const e=Math.hypot(N[k][0]-x,N[k][2]-z)+Math.abs(N[k][1]-y);if(e<d){d=e;i=k;}}
  assert.ok(d<.3,key+' '+what+': pocket node present');assert.ok(!W.allowed.has(i),key+' '+what+': the node inside the wall is not playable (no route plans to it)');}}
console.log('Nav walls: no nav edge crosses collision on '+MAPS.length+' maps '+JSON.stringify(counts)+'; wall pockets on Lotus / Breeze left the playable set; spawn / site nodes playable');
