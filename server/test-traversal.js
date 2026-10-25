// Row 3 traversal sweep: on all six original maps, a unit driven like a human client (input commands only: yaw toward
// the next A* waypoint, forward held, no jumping) walks with the real shared motor from each team's spawn to every
// site, through the SpikeSimulation (buy wall, guard/unwedge, teleporters). Also checks the buy wall releases at the
// end of the buy phase and that Bind's two one-way teleporters move a unit from each entry to its exit.
// TRAVERSE_MAPS=bind,lotus limits the maps; TRAVERSE_VERBOSE=1 prints every route.
import assert from 'node:assert/strict';import {loadWorld} from './src/world.js';import {SpikeSimulation} from './src/spike.js';import {path} from './src/path.js';import fs from 'node:fs/promises';
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
const MAPS=(process.env.TRAVERSE_MAPS||'ascent,bind,breeze,haven,lotus,split').split(','),VERBOSE=!!process.env.TRAVERSE_VERBOSE;
let seq=1;const drive=(s,u,r,f=1)=>s.command(u,{t:'in',seq:seq++,r,p:0,f,s:0});
const clear=(W,u,m)=>{const d=Math.hypot(m[0]-u.x,m[2]-u.z),n=Math.ceil(d/.15);for(let i=1;i<=n;i++){const x=u.x+(m[0]-u.x)*i/n,z=u.z+(m[2]-u.z)*i/n,y=u.y+(m[1]-u.y)*i/n;if(W.blocked(x,z,.42,y+.05,1.8))return false;}return true;};
const yawTo=(u,x,z)=>Math.atan2(-(x-u.x),-(z-u.z));
// Walk u to the goal point; returns {ok,t,repaths,unwedged,rescued,stuckAt}.
export function walk(s,u,goal,limit=120){const W=s.world,N=W.nav.nodes,dt=.05;let px=u.x,pz=u.z,still=0,side=0,flip=1,sideUntil=0,route=[],k=0,best=Infinity,lastGain=0,repaths=0,t=0;const u0={w:u.unwedged||0,r:u.rescued||0};
 const plan=()=>{route=path(W,W.near(u.x,u.z,u.y),W.near(goal[0],goal[2],goal[1]));k=1;repaths++;};plan();if(!route.length)return {ok:false,t,why:'no route'};
 while(t<limit){const d=Math.hypot(u.x-goal[0],u.z-goal[2]);if(d<2&&Math.abs(u.y-goal[1])<2)return {ok:true,t,repaths:repaths-1,unwedged:(u.unwedged||0)-u0.w,rescued:(u.rescued||0)-u0.r};
  if(d<best-.5){best=d;lastGain=t;}if(t-lastGain>4){if(repaths>6)break;plan();lastGain=t;}
  // advance past reached waypoints, and skip ahead while the next-but-one is within 1.2 m (dense graph)
  while(k<route.length){const n=N[route[k]];if(Math.hypot(n[0]-u.x,n[2]-u.z)<.7&&Math.abs(n[1]-u.y)<1.6)k++;else break;}
  // a player pressed against a corner the straight line to the next waypoint clips sidesteps off it: after 0.3 s
  // without moving, strafe (alternating sides) for 0.35 s with forward released (backing off the face)
  const n=k<route.length?N[route[k]]:goal;if(Math.hypot(u.x-px,u.z-pz)>.01){px=u.x;pz=u.z;still=0;}else still+=dt;
  if(still>.3&&side===0){side=flip=-flip;sideUntil=t+.35;still=0;}if(t>sideUntil)side=0;
  s.command(u,{t:'in',seq:seq++,r:yawTo(u,n[0],n[2]),p:0,f:side?0:1,s:side});s.step(dt);t+=dt;if(!u.alive)return {ok:false,t,why:'died'};}
 return {ok:false,t,why:'stuck',stuckAt:[+u.x.toFixed(2),+u.y.toFixed(2),+u.z.toFixed(2)],repaths};}
// Open collision edges the fall guard is there for: the capsule centre goes past the rim and is put back where it stood
// (a hitch, not a fall). Any rescue elsewhere fails the walk.
// Ascent A stairs, west rim (no collision past x 42.75, 8 m pit) used to be whitelisted here: the defender walk to A cut the
// corner with the capsule centre over the pit, the motor measured each riser from the pit floor and refused it, the unit
// pressed into the riser corner and was unwedged twice (~0.5 m) and rescued once. Fixed in the motor (floorNear counts
// the footprint tread), so no edge is whitelisted and no walk may need the unwedge either.
const KNOWN_EDGES={};
const fresh=(w,key)=>{const s=new SpikeSimulation(w,'five',key,()=>.5);s.rescues=[];{const g=s.guard.bind(s);s.guard=u=>{const b=[u.x,u.y,u.z],r=g(u);if(r)s.rescues.push(b);return r;};}const a=s.add('atk'),d=s.add('def');s.start(false);return {s,a,d};};
const endBuy=s=>{for(let n=0;n<420&&s.buy>0;n++){for(const u of s.units)drive(s,u,u.look,0);s.step(.05);}assert.equal(s.buy,0);};
const report=[];
for(const key of MAPS){const w=await loadWorld(assets,key);const sites=Object.entries(w.map.sites);
 // buy wall: held during the buy phase (test-buy-worlds), released after it: an attacker walking toward the
 // defender side passes the old boundary within a few seconds of the phase ending.
 {const {s,a,d}=fresh(w,key);const edge=Math.min(Math.abs(w.map.attacker[2]),Math.abs(w.map.defender[2]))-7;endBuy(s);
  const atk=s.units.find(u=>u.team===s.atk),r=walk(s,atk,w.map.defender,90);report.push([key,'attacker spawn→defender spawn',r]);
  assert(r.ok||atk.z<edge-3,key+': buy wall released for attackers '+JSON.stringify(r));}
 for(const team of ['attacker','defender'])for(const [name,p] of sites){const {s}=fresh(w,key);endBuy(s);const u=s.units.find(v=>team==='attacker'?v.team===s.atk:v.team!==s.atk);
  // Defenders and attackers both start on their own side; the other human stands still in spawn.
  const r=walk(s,u,p,110);report.push([key,team+' spawn→'+name,r]);if(VERBOSE)console.log(key,team,name,JSON.stringify(r));
  assert(r.ok,key+' '+team+' spawn → site '+name+' walkable: '+JSON.stringify(r));
  // never yanked back by the fall-out-of-map guard on a normal walk (Haven C stairs: a crack under the capsule centre)
  const odd=s.rescues.filter(([x,,z])=>!(KNOWN_EDGES[key]||[]).some(e=>x>=e.x[0]&&x<=e.x[1]&&z>=e.z[0]&&z<=e.z[1]));assert.equal(odd.length,0,key+' '+team+' → '+name+' rescued mid-walk at '+JSON.stringify(odd));assert.equal(r.unwedged,0,key+' '+team+' → '+name+' needed the stuck-in-geometry unwedge '+r.unwedged+' times');}
 if(key==='bind'){const calls=w.map.callouts,find=n=>calls.find(c=>c.name===n).position;
  for(const [entry,exit] of [['A Teleporter','B Exit'],['B Teleporter','A Exit']]){const {s}=fresh(w,key);endBuy(s);const u=s.units.find(v=>v.team===s.atk),e=find(entry),x=find(exit);
   // walk onto the pad from the attacker spawn; the teleport fires on entry
   let moved=false;const before=[];const W=s.world,route=path(W,W.near(u.x,u.z,u.y),W.near(e[0],e[2],e[1]));assert(route.length,'route to '+entry);
   let t=0,k=1;while(t<90&&!moved){while(k<route.length&&Math.hypot(W.nav.nodes[route[k]][0]-u.x,W.nav.nodes[route[k]][2]-u.z)<.7)k++;const n=k<route.length?W.nav.nodes[route[k]]:e;const px=u.x,pz=u.z;drive(s,u,yawTo(u,n[0],n[2]));s.step(.05);t+=.05;if(Math.hypot(u.x-px,u.z-pz)>5)moved=true;}
   assert(moved,entry+' teleports a walking unit');assert(Math.hypot(u.x-x[0],u.z-x[2])<3&&Math.abs(u.y-x[1])<2,entry+' lands at '+exit+': '+[u.x,u.y,u.z].map(v=>v.toFixed(2)));
   assert(!w.blocked(u.x,u.z,.4,u.y,1.8),exit+' is clear');
   // and the far site is reachable on foot from the exit
   const site=entry==='A Teleporter'?w.map.sites.B:w.map.sites.A,r=walk(s,u,site,60);report.push([key,entry+'→'+exit+'→site',r]);assert(r.ok,'walk on from '+exit+': '+JSON.stringify(r));}}
 console.log(key,'traversal pass',report.filter(r=>r[0]===key).map(r=>r[1]+' '+r[2].t.toFixed(1)+'s'+(r[2].unwedged?' unwedged '+r[2].unwedged:'')+(r[2].rescued?' rescued at known edge '+r[2].rescued:'')+(r[2].repaths?' repaths '+r[2].repaths:'')).join('; '));}
console.log('Traversal: '+report.length+' human-driven walks (spawn→every site both teams, buy-wall release, Bind teleporters) on '+MAPS.length+' maps with the shared motor');
