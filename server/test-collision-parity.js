// Online collision parity (qa-22): the server and the client (offline and online) collide with the same world.
//  1. The prebuilt server worlds (public/worlds/<map>, what loadWorld reads and what the client's nmCollision fetches from the
//     game server) are exactly what build-world.cjs makes from the maps' collision.bin + collision-patch.bin today (rebuilt
//     into a temp dir, byte-compared), and their map / navigation / plants JSON are the maps' own.
//  2. Player clips: one table (motor CLIPS; vendor/valorant-feel.js = server src/motor.cjs), every clip - Ascent's A ramp
//     pit, Breeze's platform, Bind's rock pocket crevices (7add113) ... - blocks a capsule in the server world AND in the
//     client's nmBlocked (taken from the generated index.html) on the same BVH.
//  3. Sampled parity: the server world's blocked() and the client's nmBlocked() give the same answer at 1200 seeded capsule
//     probes per map around valid nav nodes, at every clip, and at every walk fixture of map-walk-fixtures.json (Bind's
//     traps included).
//  4b. The fallback drops exactly the foliage runs of collision-exclude.bin that build-world.cjs drops.
//  4. The client's fallback collision (no game server: raw collision.bin) now appends collision-patch.bin like the server
//     build (nmRawCollision): on Ascent / Breeze / Lotus the patched floors the server stands on exist for the client too.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
import {loadWorld} from './src/world.js';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.join(here,'..'),require=createRequire(import.meta.url),T=require('three'),{MeshBVH,CENTER}=require('three-mesh-bvh'),Motor=require('./src/motor.cjs');
const MAPS=['ascent','bind','haven','split','lotus','breeze'],quick=process.argv.includes('--quick');
assert.equal(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),fs.readFileSync(path.join(here,'src/motor.cjs'),'utf8'),'client and server motor are the same file');
// 1. prebuilt worlds == build-world output
if(!quick){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vs-worlds-'));fs.mkdirSync(path.join(tmp,'s'));fs.symlinkSync(path.join(root,'models'),path.join(tmp,'models'));
 try{for(const k of MAPS){execFileSync(process.execPath,[path.join(here,'build-world.cjs'),k],{cwd:path.join(tmp,'s'),stdio:'ignore'});const a=path.join(tmp,'s/worlds',k),b=path.join(here,'public/worlds',k);
  for(const f of fs.readdirSync(a))assert.ok(fs.readFileSync(path.join(a,f)).equals(fs.readFileSync(path.join(b,f))),k+'/'+f+': prebuilt server world is stale (run build-all.cjs)');
  for(const f of ['map.json','navigation.json','plants.json'])assert.ok(fs.readFileSync(path.join(root,'models/valorant/maps',k,f)).equals(fs.readFileSync(path.join(b,f))),k+'/'+f+' differs from the map');
  fs.rmSync(path.join(tmp,'s/worlds',k),{recursive:true,force:true});}}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
// client nmBlocked / nmRawCollision from the generated page, with the shared motor as window.ValorantFeel
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),ctx={THREE:T,Math,Number,Infinity,Float32Array,Uint32Array,globalThis:null,window:null};ctx.globalThis=ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),ctx);
const i=html.indexOf('var NM_Q='),j=html.indexOf('function nmBlocked('),k=html.indexOf('\n',j),r0=html.indexOf('function nmExcludeTris('),r1=html.indexOf('\nasync function nmEnsure(',r0);assert.ok(i>0&&j>0&&r0>0&&r1>r0,'page functions found');
vm.runInContext(html.slice(i,html.indexOf('\n',i))+'\n'+html.slice(j,html.indexOf('\n}',k)+2)+'\n'+html.slice(r0,r1)+'\nglobalThis.nmBlocked=nmBlocked;globalThis.nmRawCollision=nmRawCollision;',ctx);
assert.ok(/nmRawCollision\(bytes,patch,exclude\)/.test(html)&&/collision-patch\.bin/.test(html)&&/collision-exclude\.bin/.test(html),'the fallback load passes the patch and the foliage exclusion');
const assets=k=>({fetch:async req=>{const f=path.join(here,'public/worlds',k,new URL(req.url).pathname.split('/').pop());return fs.existsSync(f)?new Response(fs.readFileSync(f)):new Response('',{status:404});}});
const tree=k=>{const b=f=>fs.readFileSync(path.join(here,'public/worlds',k,f)),p=b('position.bin'),ix=b('index.bin'),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.buffer.slice(p.byteOffset,p.byteOffset+p.byteLength)),3));g.setIndex(new T.BufferAttribute(new Uint32Array(ix.buffer.slice(ix.byteOffset,ix.byteOffset+ix.byteLength)),1));const meta=JSON.parse(b('meta.json')),roots=[];for(let n=0;n<meta.roots;n++){const r=b('bvh'+n+'.bin');roots.push(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));}return MeshBVH.deserialize({index:g.index.array,roots},g,{setIndex:false});};
let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
const fixtures=JSON.parse(fs.readFileSync(path.join(here,'map-walk-fixtures.json'),'utf8')),report=[];
for(const key of MAPS){const W=await loadWorld(assets(key),key),C={key,bvh:tree(key)},cl=(x,z,r,y,h)=>ctx.nmBlocked(C,x,z,r,y,h),N=W.nav.nodes,valid=N.map((_,n)=>n).filter(n=>!W.nav.valid||W.nav.valid[n]);
 const probes=[];
 // 2. every clip blocks in both, at its centre and band
 for(const c of Motor.CLIPS[key]||[]){const cx=c.p.reduce((a,q)=>a+q[0],0)/c.p.length,cz=c.p.reduce((a,q)=>a+q[1],0)/c.p.length,y=Math.max(c.y[0],Math.min(c.y[1]-1,W.ground(cx,cz,c.y[0]+3)));
  assert.equal(W.blocked(cx,cz,.38,y,1.8),true,key+' clip '+c.name+': server world');assert.equal(cl(cx,cz,.38,y,1.8),true,key+' clip '+c.name+': client nmBlocked');report.push(key+':'+c.name);
  for(const [x,z] of c.p)for(const d of [-.6,0,.6])probes.push([x+d,z-d,y]);}
 // 3. walk fixtures (edges' end nodes, traps' start nodes)
 const F=fixtures[key]||{};for(const e of F.edges||[])for(const n of e.slice(0,2))if(N[n])probes.push([N[n][0],N[n][2],N[n][1]]);for(const t of F.traps||[]){const n=N[t[0]];if(n)for(const s of [0,.2,.4])probes.push([n[0]+s*Math.cos(t[1]||0),n[2]+s*Math.sin(t[1]||0),n[1]]);}
 for(let n=0;n<(quick?300:1200);n++){const q=N[valid[Math.floor(rnd()*valid.length)]];probes.push([q[0]+(rnd()-.5)*3,q[2]+(rnd()-.5)*3,q[1]+[0,.3,1][n%3]]);}
 let blockedN=0;for(const [x,z,y] of probes){const s=W.blocked(x,z,.38,y,1.8),c=cl(x,z,.38,y,1.8);assert.equal(c,s,key+' blocked differs at '+[x,z,y].map(v=>v.toFixed(2)));if(s)blockedN++;}
 assert.ok(blockedN>probes.length*.05&&blockedN<probes.length*.95,key+': probes hit both walls and open floor ('+blockedN+'/'+probes.length+')');report.push(key+' '+probes.length+' probes');}
assert.ok(report.some(r=>r.startsWith('bind:')),'Bind has its 7add113 rock-pocket clips');
// 4b. fallback drops the same foliage runs as build-world.cjs (collision-exclude.bin, work/build_foliage_exclude.py)
for(const key of MAPS){const dir=path.join(root,'models/valorant/maps',key),buf=f=>{const b=fs.readFileSync(path.join(dir,f));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},raw=buf('collision.bin'),ex=buf('collision-exclude.bin'),n=new Uint32Array(ex,0,1)[0],runs=new Uint32Array(ex.slice(4,4+n*8));let drop=0;for(let r=0;r<n;r++)drop+=runs[r*2+1];
 const R=ctx.nmRawCollision(raw,null,ex),h=new Uint32Array(raw,0,2);assert.equal(R.indices.length,h[1]-drop*3,key+': fallback drops the excluded foliage triangles');report.push(key+' fallback excludes '+drop+' foliage triangles');}
// 4. fallback collision = raw + patch
for(const key of ['ascent','breeze','lotus']){const dir=path.join(root,'models/valorant/maps',key),buf=f=>{const b=fs.readFileSync(path.join(dir,f));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},raw=buf('collision.bin'),patch=buf('collision-patch.bin'),ex=buf('collision-exclude.bin');/* the exclusion applies like build-world.cjs */
 const R=ctx.nmRawCollision(raw,patch,ex),R0=ctx.nmRawCollision(raw,null,ex),hp=new Uint32Array(patch,0,2);assert.equal(R.indices.length,R0.indices.length+hp[1],key+': patch triangles appended');assert.equal(R.positions.length,R0.positions.length+hp[0]*3);
 const pp=new Float32Array(patch.slice(8,8+hp[0]*12)),ip=new Uint32Array(patch.slice(8+hp[0]*12,8+hp[0]*12+hp[1]*4)),Bs=tree(key);let n=0,miss0=0;/* the server world's own BVH */
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(R.positions,3));g.setIndex(new T.BufferAttribute(R.indices,1));const B=new MeshBVH(g,{maxLeafTris:12,maxDepth:64,strategy:CENTER});
 const g0=new T.BufferGeometry();g0.setAttribute('position',new T.BufferAttribute(R0.positions,3));g0.setIndex(new T.BufferAttribute(R0.indices,1));const B0=new MeshBVH(g0,{maxLeafTris:12,maxDepth:64,strategy:CENTER});
 const down=(b,x,y,z)=>{const h=b.raycastFirst(new T.Ray(new T.Vector3(x,y+.3,z),new T.Vector3(0,-1,0)),T.DoubleSide);return h&&h.distance<.6?h.point.y:null;};
 for(let t=0;t<ip.length&&n<150;t+=3*Math.max(1,Math.floor(ip.length/450))){const c=[0,1,2].map(a=>(pp[ip[t]*3+a]+pp[ip[t+1]*3+a]+pp[ip[t+2]*3+a])/3),s=down(Bs,c[0],c[1],c[2]);if(s===null||Math.abs(s-c[1])>.05)continue;/* a patch triangle under another surface / cropped away */n++;
  const f=down(B,c[0],c[1],c[2]);assert.ok(f!==null&&Math.abs(f-s)<.02,key+': fallback floor at a patched point ('+c.map(v=>v.toFixed(2))+') '+f+' vs server world '+s);if(down(B0,c[0],c[1],c[2])===null)miss0++;}
 assert.ok(n>=3,key+': patched floor points checked ('+n+')');assert.ok(miss0>0,key+': without the patch the fallback has holes there ('+miss0+'/'+n+')');report.push(key+' fallback '+n+' patched floor points (unpatched missed '+miss0+')');}
console.log('Collision parity: '+(quick?'':'prebuilt server worlds = build-world output for 6 maps; ')+'clips '+report.filter(r=>r.includes(':')).join(', ')+'; '+report.filter(r=>!r.includes(':')).join('; '));
