// walk diagnosis: step the motor from a node toward a spot; at the stop, list triangles inside the capsule (material, see-through %)
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const S='/workspace/work/vs-lane-invis/server/';const {loadWorld}=await import(S+'src/world.js');const require=createRequire(S+'x.js'),Motor=require(S+'src/motor.cjs'),T=require('three');
const [key,x,y,z,nx,nz]=[process.argv[2],...process.argv.slice(3).map(Number)],TAG=process.env.TAG||'';
const W=await loadWorld({fetch:async r=>new Response(await fs.promises.readFile(path.join(S+'public',new URL(r.url).pathname)))},key);
const mat=new Int16Array(fs.readFileSync('mat_'+key+TAG+'.bin').buffer.slice(0)),frac=fs.readFileSync('frac_'+key+TAG+'.bin'),info=JSON.parse(fs.readFileSync('mats_'+key+TAG+'.json'));
const dx=x-nx,dz=z-nz,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,u={x:nx,y:0,z:nz};u.y=W.ground(nx,nz,y+.6);console.log('start',u.y.toFixed(2),'node y',y,'ground at spot',W.ground(x,z,y+.6));
for(let i=0;i<200;i++){const r=Motor.step(u,{x:ux,z:uz,speed:4},1/128,W);if(i<2)console.log('step',JSON.stringify(r),JSON.stringify(u).slice(0,200));}
console.log('end',u.x.toFixed(2),u.y.toFixed(2),u.z.toFixed(2),'prog',((u.x-nx)*ux+(u.z-nz)*uz).toFixed(2));
// what is in a capsule 0.1 m ahead of the stop
const {MeshBVH}=require('three-mesh-bvh'),WD=S+'public/worlds/'+key+'/',rd=f=>{const b=fs.readFileSync(WD+f);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);},meta=JSON.parse(fs.readFileSync(WD+'meta.json')),pos=new Float32Array(rd('position.bin')),idx=new Uint32Array(rd('index.bin')),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(new T.BufferAttribute(idx,1));const roots=[];for(let i=0;i<meta.roots;i++)roots.push(rd('bvh'+i+'.bin'));const bvh=MeshBVH.deserialize({roots,index:idx},g,{setIndex:false});
console.log('start blocked',W.blocked(nx,nz,.38,u.y,1.8),'start blocked above step',W.blocked(nx,nz,.38,u.y+.42,1.38));const px=u.x+ux*.1,pz=u.z+uz*.1,r=.38,line=new T.Line3(new T.Vector3(px,u.y+r+.025,pz),new T.Vector3(px,u.y+1.8-r,pz)),box=new T.Box3(new T.Vector3(px-r,u.y+.025,pz-r),new T.Vector3(px+r,u.y+1.8,pz+r)),a=new T.Vector3(),b=new T.Vector3();
const seen={};bvh.shapecast({intersectsBounds:bb=>bb.intersectsBox(box),intersectsTriangle:(t,ti)=>{if(Math.max(t.a.y,t.b.y,t.c.y)<=u.y+.025)return false;if(t.closestPointToSegment(line,a,b)<r-.012){const m=mat[ti],n=(m===-2?'COLONLY':info[m].name)+' see'+frac[ti]+' y'+Math.min(t.a.y,t.b.y,t.c.y).toFixed(2)+'..'+Math.max(t.a.y,t.b.y,t.c.y).toFixed(2);seen[n]=(seen[n]||0)+1;}return false;}});
console.log(Object.entries(seen).slice(0,12));
