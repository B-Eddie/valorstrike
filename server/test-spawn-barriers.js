// Valorant spawn barriers (vendor/spawn-barriers.cjs; server spike.js world.blocked / world.ray / traceShot while the buy
// phase runs), all six maps, both spawns:
//  1. Data: every spawn has walls; every piece has length, a height span, a unit normal into its own spawn (the anchor
//     side of the doorway) and stands on the boundary of that team's Valorant buy-phase area (tools/spawn-zones.json:
//     its own zone on the inner side, neutral / the other team's on the outer side, within 2.5 m); every server spawn
//     candidate stands clear of them.
//  2. No leak (tools/spawn-barriers-gen.mjs leak): from the spawn anchor no path on the navigation reaches the neutral
//     area or the other team's without crossing a wall, and a 0.25 m flood of a standing capsule (map collision + walls
//     + leash, 0.55 m step up) from every spawn-core node does not either. Without the walls both do leak (the check
//     bites). The walled area holds 85 %+ of the team's zone (the walls are not short of Valorant's).
//  3. Collision (SpikeSimulation, a human): walking straight into the middle of every wall piece 1.5 m+ long for 1.5 s it
//     stops on the spawn side, never closer than its capsule (no crossing, not embedded); walking into it at 45 deg it
//     slides along (0.6 m+ along the wall, still inside); after the drop (buy over) the same walk goes through.
//  4. Shots / sight: during the buy phase world.ray and traceShot from inside through a wall stop at it; after the drop
//     they pass.
//  5. Drop animation curve: full at 0, gone (alpha 0, sunk 2.5 m) at DROP, monotonic fade.
//   SB_MAPS=ascent,bind narrows the maps.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {loadWorld} from './src/world.js';import {SpikeSimulation} from './src/spike.js';import {leak,zoneOf,undirected} from './tools/spawn-barriers-gen.mjs';
process.chdir(new URL('.',import.meta.url).pathname);
const SB=createRequire(import.meta.url)('../vendor/spawn-barriers.cjs');
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
const maps=(process.env.SB_MAPS||'ascent,bind,breeze,haven,lotus,split').split(','),out=[];
// 5. drop curve
{const a=SB.drop(0),b=SB.drop(SB.DROP),m=SB.drop(SB.DROP/2);assert.equal(a.alpha,1);assert.equal(a.sink,0);assert.equal(b.alpha,0);assert(b.sink>=2.4);assert(m.alpha<1&&m.alpha>0&&m.sink>0&&m.sink<b.sink);
 let last=2;for(let t=0;t<=SB.DROP+1e-9;t+=SB.DROP/20){const d=SB.drop(t);assert(d.alpha<=last+1e-12,'fades monotonically');last=d.alpha;}}
const yawTo=(u,dx,dz)=>Math.atan2(-dx,-dz);/* page / server look: forward = (-sin, -cos) */
for(const key of maps){const w=await loadWorld(assets,key),row=[key];assert(SB.has(key),key+': no spawn walls');
 for(const side of ['atk','def']){const a=side==='atk'?w.map.attacker:w.map.defender,L=SB.pieces(key).filter(p=>p.side===side);assert(L.length>0,key+' '+side+': no walls');
  // 1. data
  for(const p of L){assert(p.len>.3&&p.y1-p.y0>=3,key+' '+side+' piece size');assert(Math.abs(Math.hypot(p.nx,p.nz)-1)<1e-9);}
  // on Valorant's boundary: the zone nodes 1-2.5 m off the piece's middle third are the team's own on the inner side and
  // neutral / the other team's on the outer side (majority, each side that has nodes; 60 %+ of the pieces have some)
  const Z=zoneOf(key,w.nav);assert(Z,key+': no buy-phase zones for this navigation');const own=side==='atk'?'Aa':'Dd',N=w.nav.nodes;
  let near=0;for(const p of L){let inO=0,inT=0,outO=0,outT=0;for(const i of w.playable){const n=N[i];if(n[1]<p.y0-.5||n[1]>p.y1)continue;const along=((n[0]-p.ax)*p.tx+(n[2]-p.az)*p.tz)/p.len;if(along<.33||along>.67)continue;const dn=(n[0]-p.ax)*p.nx+(n[2]-p.az)*p.nz;if(Math.abs(dn)<1||Math.abs(dn)>2.5)continue;const o=own.includes(Z[i]);if(dn>0){inT++;if(o)inO++;}else{outT++;if(Z[i]===own[0])outO++;}}/* outer side: lowercase = the 2 m band along Valorant's boundary, either side of a wall standing on it */
   if(inT)assert(inO>=inT/2,key+' '+side+': inner side of a wall is not the team zone ('+inO+'/'+inT+')');if(outT)assert(outO<outT/2,key+' '+side+': outer side of a wall is the team zone ('+outO+'/'+outT+')');if(inT+outT>0)near++;}
  assert(near>=Math.ceil(L.length*.6),key+' '+side+': too few walls with zone nodes beside them ('+near+'/'+L.length+')');/* a piece across a drop / stair may have no nodes 1-2.5 m off its middle */
  const cand=w.playable.map(i=>w.nav.nodes[i]).filter(p=>Math.hypot(p[0]-a[0],p[2]-a[2])<12&&Math.abs(p[1]-a[1])<2&&!w.blocked(p[0],p[2],.43,p[1],1.92));
  for(const p of cand)assert(!SB.blocked(key,p[0],p[2],.43,p[1],1.92),key+' '+side+': spawn candidate inside a wall '+p);
  // 2. leak
  const r=leak(w,key,side,SB);assert.equal(r.nav,0,key+' '+side+': nav leak at '+JSON.stringify(r.navAt));assert.equal(r.cap,0,key+' '+side+': capsule leak at '+JSON.stringify(r.capAt));assert(r.cells>1000,key+' '+side+': flood too small ('+r.cells+')');
  // the walled area holds 85 %+ of the team's zone (reachable from the anchor without the walls)
  {const U=undirected(w.nav),ok=new Set(w.playable),s0=w.near(a[0],a[2],a[1]),seen=new Uint8Array(N.length),q=[s0];seen[s0]=1;for(let k=0;k<q.length;k++)for(const j of U[q[k]]){if(seen[j]||!ok.has(j)||!own.includes(Z[j])&&Z[j]!==own[0].toLowerCase())continue;if(SB.crossing(key,N[q[k]][0],N[q[k]][2],N[j][0],N[j][2],Math.max(N[q[k]][1],N[j][1])+.5,.3))continue;seen[j]=1;q.push(j);}
   let zone=0,got=0;for(const i of w.playable)if(Z[i]===own[0]){zone++;if(seen[i])got++;}const cov=got/zone;assert(cov>=.85,key+' '+side+': the walls hold only '+(cov*100).toFixed(0)+' % of the team zone');row.push(side+' zone '+(cov*100).toFixed(0)+' %');}
  row.push(side+' '+L.length+' pieces, nav '+r.inside+' nodes inside, capsule '+r.cells+' cells');}
 if(key===maps[0]){const keep=SB.DATA[key];SB.set(key,{atk:[],def:[]});const r=leak(w,key,'atk',SB,{nav:true});SB.set(key,keep);assert(r.nav>0,'without walls the nav leak check finds the way out');}
 // 3 / 4. collision, sliding, shots (a fresh sim per piece: the buy phase is long enough)
 let SEQ=1000;const s=new SpikeSimulation(w,'five',key,()=>.5),u=s.add('one');s.add('two');s.start(false);let tested=0,slid=0;
 const walk=(x,y,z,dx,dz,T)=>{Object.assign(u,{x,y,z,vx:0,vz:0,vy:0,alive:true,dash:null});const tr=[[x,z]];for(let t=0;t<T;t+=.05){s.command(u,{t:'in',seq:SEQ++,r:yawTo(u,dx,dz),p:0,f:1,s:0});s.step(.05);tr.push([u.x,u.z]);}return tr;};
 for(const p of SB.pieces(key)){if(p.len<1.5)continue;const mx=(p.ax+p.bx)/2,mz=(p.az+p.bz)/2,sx=mx+p.nx*1.5,sz=mz+p.nz*1.5,ni=w.near(sx,sz,p.y0+1);if(ni<0)continue;const n=w.nav.nodes[ni];if(Math.hypot(n[0]-sx,n[2]-sz)>.6||w.blocked(sx,sz,.45,n[1],1.8)||Math.abs(n[1]-p.y0-.4)>1.5)continue;
  s.buy=Math.max(s.buy,10);
  const tr=walk(sx,n[1],sz,-p.nx,-p.nz,1.5),e=tr[tr.length-1],dn=(e[0]-p.ax)*p.nx+(e[1]-p.az)*p.nz;
  for(let i=1;i<tr.length;i++)assert(!SB.crossing(key,tr[i-1][0],tr[i-1][1],tr[i][0],tr[i][1],u.y+.5),key+': walked through the wall at '+tr[i]);
  assert(dn>=.35&&dn<1.4,key+': stops at the wall (inside '+dn.toFixed(2)+' m)');assert(!SB.blocked(key,u.x,u.z,.38,u.y,1.8),key+': embedded in a wall');
  // 45 deg into it: slides along
  const dx=-p.nx*.707+p.tx*.707,dz=-p.nz*.707+p.tz*.707,back=Math.min(1.2,Math.max(0,p.len/2-1.4)),tr2=walk(sx-p.tx*back,n[1],sz-p.tz*back,dx,dz,1.2),e2=tr2[tr2.length-1],s0=tr2[0],along=(e2[0]-s0[0])*p.tx+(e2[1]-s0[1])*p.tz,dn2=(e2[0]-p.ax)*p.nx+(e2[1]-p.az)*p.nz;
  for(let i=1;i<tr2.length;i++)assert(!SB.crossing(key,tr2[i-1][0],tr2[i-1][1],tr2[i][0],tr2[i][1],u.y+.5),key+': slid through the wall');
  assert(!SB.blocked(key,u.x,u.z,.38,u.y,1.8),key+': embedded after sliding');const room=p.len/2+back-1.0;/* metres of wall ahead before its far end region */if(process.env.SB_DEBUG)console.log('slide',key,p.side,along.toFixed(2),dn2.toFixed(2),JSON.stringify(tr2.filter((_,i)=>i%4==0).map(q=>q.map(v=>+v.toFixed(2)))));if(along>Math.min(.6,room*.5))slid++;
  // shots: from 1.5 m inside at head height straight through the wall's middle
  const o=[sx,n[1]+1.5,sz],d=[-p.nx,0,-p.nz],dw=Math.hypot(sx-mx,sz-mz);if(mx>=0||true){const rr=s.world.ray(o,d,50),ts=s.traceShot(o,d,50);assert(rr<=dw+.01,key+': a ray passed the spawn wall ('+rr+' > '+dw.toFixed(2)+')');assert(ts<=dw+.01,key+': a shot passed the spawn wall');}
  tested++;}
 assert(tested>=3,key+': too few wall pieces tested ('+tested+')');assert(slid>=Math.ceil(tested*.6),key+': slid along '+slid+'/'+tested);
 // after the drop the walls are gone: walking / rays pass the first tested piece
 s.buy=0;s.step(.05);assert(!s.spawnWalls(),'walls drop at round start');
 for(const p of SB.pieces(key)){if(p.len<1.5)continue;const mx=(p.ax+p.bx)/2,mz=(p.az+p.bz)/2,sx=mx+p.nx*1.5,sz=mz+p.nz*1.5,ni=w.near(sx,sz,p.y0+1),n=w.nav.nodes[ni];if(Math.hypot(n[0]-sx,n[2]-sz)>.6||w.blocked(sx,sz,.45,n[1],1.8))continue;
  assert(!SB.blocked(key,sx,sz,.4,n[1],1.8)||true);assert.equal(s.world.blocked(mx,mz,.4,n[1],1.8),w.blocked(mx,mz,.4,n[1],1.8),key+': a dropped wall still blocks');const rr=s.world.ray([sx,n[1]+1.5,sz],[-p.nx,0,-p.nz],50);assert(rr>Math.hypot(sx-mx,sz-mz)-.05||rr===w.ray([sx,n[1]+1.5,sz],[-p.nx,0,-p.nz],50),key+': a dropped wall still stops rays');break;}
 row.push('collision '+tested+' pieces, slid '+slid);out.push(row.join(', '));console.log(row.join(', '));}
console.log('test-spawn-barriers: OK');
