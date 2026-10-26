// Map holes and boundary containment, all six original maps, on the server collision world (the same BVH, motor and
// leash the offline client walks with; tools/map-holes.mjs and tools/map-boundary.mjs are the full sweeps).
//  1. Hole grid: every playable nav node sampled at 0.25 m; no sample where the leash lets a capsule centre stand
//     without floor under its footprint (void, crack or missing collision floor such as Lotus' moss floors).
//  2. Known escapes: map-escapes.json holds escapes the full sweep found before the leash (walking/dashing off spawn
//     backs and site edges into the void, satchel/updraft over walls out of the map); each is replayed and must stay
//     on the map. The same cases are replayed without the leash and must still escape, so the fixture keeps meaning
//     something (fails on the old motor).
//  3. Sampled sweep: every 40th border cell, all movement probes (walk, crouch-jump, Jett dash, updraft, updraft+dash,
//     Raze satchel at a jump's apex): no fall out of the world and no landing outside the playable footprint.
//  4. Spawns, sites, callouts (tools/map-sweep.mjs is the full sweep): the server's team spawn candidates (simulation.js
//     teamSpawnPoint) exist for both teams, none sits in geometry, all reach every site anchor on the navigation; each
//     site anchor lies in its own plant zone and passes spike.js siteAt there (plantable floor around it); every callout
//     has a playable node reachable from the attacker spawn within 8 m horizontally (callout labels are approximate API
//     points: Breeze's all sit at one height, its A Lobby label lies 7.9 m off the minimap's floor).
//  5. Walk fixtures (map-walk-fixtures.json): nav edges on flat or stepped floor the motor refused before the riser /
//     step-up fixes are walked end to end, and the walk-in traps (a capsule pressed against a wall over uneven paving
//     that could not walk out again) now walk out: 0.3 m within 0.5 s in one of 8 directions (a pocket that lets the
//     capsule shuffle 0.2 m, Breeze's west-edge lip, is still a trap).
import fs from 'node:fs';import assert from 'node:assert/strict';import {loadWorld} from './src/world.js';import {scanHoles} from './tools/map-holes.mjs';import {scanBoundary,PROBES,index} from './tools/map-boundary.mjs';import {createRequire} from 'node:module';
process.chdir(new URL('.',import.meta.url).pathname);
const require=createRequire(import.meta.url),Motor=require('./src/motor.cjs');
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
const cases=JSON.parse(fs.readFileSync('map-escapes.json','utf8')),maps=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','haven','split','lotus','breeze'];
function replay(w,X,c,leash){const saved=w.leash;if(!leash)delete w.leash;try{const pr=PROBES[c.probe],y0=w.ground(c.from[0],c.from[2],c.from[1]+.1),P={x:c.from[0],z:c.from[2],y:y0,vx:0,vz:0,vy:0,ch:0},DT=1/30;let still=0;
 for(let t=0;t<pr.T;t+=DT){const inp={x:c.dir[0],z:c.dir[1],speed:6.75,jump:false,duck:false};pr.plan(t,P,inp,c.dir,w);Motor.step(P,inp,DT,w);if(P.y<X.ymin-3.5)break;const g=!P.air&&Math.abs(P.vy||0)<.01;if(g&&t>.4&&Math.hypot(P.vx,P.vz)<.05){if((still+=DT)>.25)break;}else still=0;}
 const low=X.nearest(P.x,P.z,null,1.3);if((P.y<X.ymin-3||P.y<y0-12)&&!(low&&Math.abs(low[1]-P.y)<1.5))return 'fall';if(!P.air&&!X.nearValid(P.x,P.z,3))return 'out';return null;}finally{if(saved)w.leash=saved;}}
let total=0;
for(const key of maps){const t=Date.now(),w=await loadWorld(assets,key),X=index(w);
 const h=await scanHoles(key,w),fall=h.void.concat(h.gap).filter(p=>!p.held&&p.leash);assert.equal(fall.length,0,key+': capsule can stand over a hole at '+JSON.stringify(fall.slice(0,3)));
 const list=cases[key]||[];let escapedOld=0;for(const c of list){const r=replay(w,X,c,true);assert.equal(r,null,key+': '+c.probe+' from '+c.from+' toward '+c.dir+' still escapes ('+r+')');if(replay(w,X,c,false))escapedOld++;}
 assert(list.length===0||escapedOld>0,key+': fixture no longer escapes without the leash');
 const s=await scanBoundary(key,w,{stride:40});assert.equal(s.fall.length,0,key+': fell off the map '+JSON.stringify(s.fall.slice(0,2)));assert.equal(s.out.length,0,key+': left the playable footprint '+JSON.stringify(s.out.slice(0,2)));
 total+=s.probes+list.length;console.log(key,'holes 0 /',h.samples,'samples; known escapes contained',list.length,'(old motor escapes',escapedOld+'); sweep',s.probes,'probes contained,',s.perch.length,'perches;',((Date.now()-t)/1000).toFixed(1)+'s');}
console.log('Map bounds: '+maps.length+' maps, hole grid clean, '+total+' boundary probes contained');
// 4 + 5
const walks=JSON.parse(fs.readFileSync('map-walk-fixtures.json','utf8')),DT=1/30,DIRS=Array.from({length:8},(_,k)=>[Math.cos(k*Math.PI/4),Math.sin(k*Math.PI/4)]);
const place=(w,p)=>{const y=w.ground(p[0],p[2],p[1]+.1);return {x:p[0],z:p[2],y:Number.isFinite(y)&&y>p[1]-1?y:p[1],vx:0,vz:0,vy:0,ch:0};};
const reachSet=(w,from)=>{const seen=new Uint8Array(w.nav.nodes.length),q=[from];seen[from]=1;for(let k=0;k<q.length;k++)for(const j of w.nav.adj[q[k]])if(!seen[j]&&w.allowed.has(j)){seen[j]=1;q.push(j);}return seen;};
function walkEdge(w,p,q){const L=Math.hypot(q[0]-p[0],q[2]-p[2]),d=[(q[0]-p[0])/L,(q[2]-p[2])/L],up=q[1]-p[1]>.42;for(const jump of up?[false,true]:[false]){const P=place(w,p);for(let t=0;t<.8;t+=DT){Motor.step(P,{x:d[0],z:d[1],speed:6.75,jump:jump&&t>1.5*DT&&t<.12},DT,w);if(Math.hypot(P.x-q[0],P.z-q[2])<.35&&Math.abs(P.y-q[1])<1.2)return true;}
  /* a drop edge carries past the next node in the air: reached = landed on its floor beyond it */if(p[1]-q[1]>1&&!P.air&&Math.abs(P.y-q[1])<.6&&(P.x-p[0])*d[0]+(P.z-p[2])*d[1]>=L-.35)return true;}return false;}
// The browser's walk-in trap check (work/browser_map_walk.cjs): 1 s into the wall, then straight back for 0.9 s: >= 0.7 m, ending on a floor.
// level = [from, dir]: a 1.5 s walk along / into a wall never lifts the feet more than 0.1 m above the start floor (no ride up a
// plinth or skirting narrower than the capsule: Ascent (-12.5, 7.07, 38), a 7 cm, 0.5 m plinth lifted the capsule 0.27 m).
function walksLevel(w,from,dir){const P=place(w,from),y0=P.y;let m=y0;for(let t=0;t<1.5;t+=DT){Motor.step(P,{x:dir[0],z:dir[1],speed:6.75},DT,w);m=Math.max(m,P.y);}return m-y0<.1;}
function walksBack(w,from,dir){const P=place(w,from);for(let t=0;t<1;t+=DT)Motor.step(P,{x:dir[0],z:dir[1],speed:6.75},DT,w);const x=P.x,z=P.z;for(let t=0;t<.9;t+=DT)Motor.step(P,{x:-dir[0],z:-dir[1],speed:6.75},DT,w);const g=w.ground(P.x,P.z,P.y+.05);return Math.hypot(P.x-x,P.z-z)>=.7&&Math.abs(P.y-g)<.05;}
function walksOut(w,from,dir){const P=place(w,from);for(let t=0;t<.4;t+=DT)Motor.step(P,{x:dir[0],z:dir[1],speed:6.75},DT,w);for(const d of DIRS){const Q={x:P.x,y:P.y,z:P.z,vx:0,vz:0,vy:0,ch:0};for(let t=0;t<.5;t+=DT)Motor.step(Q,{x:d[0],z:d[1],speed:6.75},DT,w);if(Math.hypot(Q.x-P.x,Q.z-P.z)>=.3||Math.abs(Q.y-P.y)>.3)return true;}return false;}
let fixtures=0;
for(const key of maps){const w=await loadWorld(assets,key),N=w.nav.nodes,M=w.map,siteNode={};for(const [s,a]of Object.entries(M.sites))siteNode[s]=w.near(a[0],a[2],a[1]);
 for(const [team,anchor]of [['attacker',M.attacker],['defender',M.defender]]){const c=w.playable.filter(i=>{const p=N[i];return Math.hypot(p[0]-anchor[0],p[2]-anchor[2])<12&&Math.abs(p[1]-anchor[1])<2&&!w.blocked(p[0],p[2],.43,p[1],1.92);});
  assert(c.length>=50,key+' '+team+': only '+c.length+' spawn candidates');const r=reachSet(w,c[0]);
  for(const i of c){assert(r[i],key+' '+team+' spawn '+N[i]+' is cut off from the others');const y=w.ground(N[i][0],N[i][2],N[i][1]+.1);assert(!(w.blocked(N[i][0],N[i][2],.4,y,1.8)&&w.blocked(N[i][0],N[i][2],.4,y+.32,1.8)),key+' '+team+' spawn '+N[i]+' is inside geometry');}
  for(const [s,i]of Object.entries(siteNode))assert(r[i],key+' '+team+' spawn cannot reach site '+s);}
 for(const [s,a]of Object.entries(M.sites)){assert.equal(w.plantAt(a[0],a[2]),s,key+' site '+s+' anchor outside its plant zone');const n=N[siteNode[s]];assert.equal(w.plantAt(n[0],n[2]),s,key+' site '+s+' anchor node outside its plant zone');assert(Math.abs(n[1]-a[1])<2,key+' site '+s+' anchor node not plantable (siteAt height)');
  const plantable=w.playable.filter(i=>w.plantAt(N[i][0],N[i][2])===s&&Math.abs(N[i][1]-a[1])<2).length;assert(plantable>=100,key+' site '+s+': only '+plantable+' plantable nodes');}
 const atk=reachSet(w,w.near(M.attacker[0],M.attacker[2],M.attacker[1]));for(const c of M.callouts||[]){const p=c.position;let best=Infinity;for(const i of w.playable)if(atk[i])best=Math.min(best,Math.hypot(N[i][0]-p[0],N[i][2]-p[2]));assert(best<8,key+' callout '+c.name+' has no reachable floor within 8 m ('+best.toFixed(1)+')');}
 const F=walks[key]||{edges:[],traps:[]};for(const [p,q]of F.edges)assert(walkEdge(w,p,q),key+': refused the walk '+p+' -> '+q);for(const [p,d]of F.traps)assert(walksOut(w,p,d),key+': trapped walking from '+p+' toward '+d);for(const [p,d]of F.backs||[])assert(walksBack(w,p,d),key+': no straight walk back from '+p+' toward '+d);for(const [p,d]of F.level||[])assert(walksLevel(w,p,d),key+': walk from '+p+' toward '+d+' rode up a ledge');fixtures+=F.edges.length+F.traps.length;
 console.log(key,'spawns/sites/callouts valid; walk fixtures',F.edges.length,'edges',F.traps.length,'traps');}
console.log('Map walk: spawns, plant sites and callouts valid on '+maps.length+' maps; '+fixtures+' walk fixtures pass');
