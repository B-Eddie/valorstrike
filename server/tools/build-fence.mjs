// Nav-boundary fence generator: random walks (tools/eval-fall.mjs) showed walkers can leave
// playable nav coverage onto same-elevation collision ground with no nav (breeze x -8..12 z 53..64,
// bind near (-1.6,74)). This emits vertical collision quads just outside porous nav edges so the
// motor stops at the coverage boundary instead of standing in unmapped space.
// Output: models/valorant/maps/<key>/fence.bin (collision.bin format: u32 nv, u32 ni, f32 pos, u32 idx).
import fs from 'node:fs';import * as T from 'three';import {MeshBVH,CENTER} from 'three-mesh-bvh';
const key=process.argv[2]||'breeze',root='../models/valorant/maps/'+key+'/';
const b=fs.readFileSync(root+'collision.bin'),nv=b.readUInt32LE(0),ni=b.readUInt32LE(4);
const P0=new Float32Array(b.buffer,b.byteOffset+8,nv*3),I0=new Uint32Array(b.buffer,b.byteOffset+8+nv*12,ni);
const nav=JSON.parse(fs.readFileSync(root+'navigation.json'));
const nodes=nav.nodes,valid=nav.valid;
// playable = largest connected component of the valid graph, same as server/src/world.js:
// valid-but-disconnected islands are NOT coverage - walkers reach them with no nav and get flagged
const seenC=new Set(),components=[];for(let i=0;i<nodes.length;i++){if(seenC.has(i)||!valid[i])continue;const c=[i];seenC.add(i);for(let k=0;k<c.length;k++)for(const j of nav.adj[c[k]]||[])if(!seenC.has(j)&&valid[j]){seenC.add(j);c.push(j);}components.push(c);}
components.sort((a,b)=>b.length-a.length);const play=components[0];
// collision BVH clipped to the playable bbox + 3 (same clip as build-world.cjs)
const min=[0,1,2].map(a=>Math.min(...play.map(i=>nodes[i][a]))-3),max=[0,1,2].map(a=>Math.max(...play.map(i=>nodes[i][a]))+3);
const P=[],idx=[],vm=new Map();const seen=new Set();
for(let i=0;i<ni;i+=3){let out=false;for(let a=0;a<3;a++)if([0,1,2].every(j=>P0[I0[i+j]*3+a]<min[a])||[0,1,2].every(j=>P0[I0[i+j]*3+a]>max[a])){out=true;break;}if(out)continue;
 const v=[];for(let j=0;j<3;j++){const k=I0[i+j]*3,s=[P0[k],P0[k+1],P0[k+2]].map(x=>Math.round(x*1000)).join(',');let a=vm.get(s);if(a===undefined){a=P.length/3;P.push(P0[k],P0[k+1],P0[k+2]);vm.set(s,a);}v.push(a);}
 if(new Set(v).size<3)continue;const s=[...v].sort((a,b)=>a-b).join(',');if(seen.has(s))continue;seen.add(s);idx.push(...v);}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(P),3));geo.setIndex(idx);
const bvh=new MeshBVH(geo,{maxLeafTris:12,maxDepth:64,strategy:CENTER});
const ground=(x,z,y)=>{const ray=new T.Ray(new T.Vector3(x,y+.32,z),new T.Vector3(0,-1,0));for(let i=0;i<24;i++){const h=bvh.raycastFirst(ray,T.DoubleSide);if(!h)break;if(h.face.normal.y>.45)return h.point.y;ray.origin.y=h.point.y-.005;}return y-10;};
// playable-node spatial hash (xz)
const cell=new Map(),CK=(x,z)=>Math.round(x/1.5)+','+Math.round(z/1.5);
for(const i of play){const k=CK(nodes[i][0],nodes[i][2]);(cell.get(k)||cell.set(k,[]).get(k)).push(i);}
const near=(x,z,y,rad,dy)=>{for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const i of cell.get((Math.round(x/1.5)+dx)+','+(Math.round(z/1.5)+dz))||[]){const p=nodes[i];if((p[0]-x)**2+(p[2]-z)**2<=rad*rad&&Math.abs(p[1]-y)<=dy)return true;}return false;};
const inset=new Set(play),edges=[];for(const i of play){for(const j of nav.adj[i]||[]){if(inset.has(j))edges.push([nodes[i],nodes[j]]);}}
const dropEdges=edges.filter(([A,B])=>Math.abs(A[1]-B[1])>1.2);
const ecell=new Map(),EK=(x,z)=>Math.round(x/2)+','+Math.round(z/2);
edges.forEach((e,k)=>{const [[ax,az],[bx,bz]]=[[e[0][0],e[0][2]],[e[1][0],e[1][2]]];
 for(let x=Math.min(ax,bx)-1;x<=Math.max(ax,bx)+1;x+=2)for(let z=Math.min(az,bz)-1;z<=Math.max(az,bz)+1;z+=2){const key=EK(x,z);(ecell.get(key)||ecell.set(key,[]).get(key)).push(k);}});
const nearEdge=(x1,z1,x2,z2,rad)=>{const seen=new Set();
 for(let x=Math.min(x1,x2)-rad;x<=Math.max(x1,x2)+rad;x+=2)for(let z=Math.min(z1,z2)-rad;z<=Math.max(z1,z2)+rad;z+=2)for(const k of ecell.get(EK(x,z))||[]){if(seen.has(k))continue;seen.add(k);const [A,B]=edges[k];if(segDist(A[0],A[2],B[0],B[2],x1,z1,x2,z2)<rad)return true;}return false;};
const nearDropLink=(x,z,rad)=>{for(const [A,B] of dropEdges)if(segDist(A[0],A[2],B[0],B[2],x,z,x,z)<rad)return true;return false;};
const segDist=(ax,az,bx,bz,cx,cz,dx,dz)=>{const u=(x1,z1,x2,z2,px,pz)=>{const dx=x2-x1,dz=z2-z1,L=dx*dx+dz*dz||1e-9;let t=((px-x1)*dx+(pz-z1)*dz)/L;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(x1+t*dx),pz-(z1+t*dz));};
 return Math.min(u(ax,az,bx,bz,cx,cz),u(ax,az,bx,bz,dx,dz),u(cx,cz,dx,dz,ax,az),u(cx,cz,dx,dz,bx,bz));};
const fences=[],fcents=[];let porous=0,edgeCut=0;
const dedupe=(x,z)=>{for(const [fx,fz] of fcents)if((fx-x)**2+(fz-x*0)**2<0.49&&(fz-z)**2<0.49)return true;return false;};
for(const i of play){const n=nodes[i],y0=ground(n[0],n[2],n[1]+.1);
 for(let k=0;k<16;k++){const a=(k/16)*Math.PI*2,sx=Math.sin(a),cz=Math.cos(a);let d0=0,drop=false;
  for(const d of [1.0,1.4,1.8,2.2,2.6,3.0]){const x=n[0]+sx*d,z=n[2]+cz*d;
   if(near(x,z,y0,1.3,2.0))continue;
   const g=ground(x,z,y0+1.8);
   if(g>y0+1.2){d0=0;break;}
   if(g<y0-1.5){if(!nearDropLink(x,z,2.5)&&!near(x,z,g,1.3,2.0)){d0=d;drop=true;}break;}
   d0=d;break;}
  // drop-edge class: ground discontinuity INSIDE nav xz coverage (ledge rim where walkers fall
  // from nav level onto unmapped lower ground). Legit drops keep nav at the landing or a drop link.
  if(!d0){let pg=y0,de2=0;
   for(let d=0.5;d<=3.0;d+=0.5){const x=n[0]+sx*d,z=n[2]+cz*d;
    if(!near(x,z,y0,1.3,2.0))break;
    const g=ground(x,z,y0+1.8);
    if(g<pg-1.5){if(!near(x,z,g,1.3,2.0)&&!nearDropLink(x,z,2.5)){d0=d-0.2;drop=true;}break;}
    pg=g;}}
  if(!d0)continue;porous++;
  let de=1.0;for(let d=1.0;d<d0;d+=0.25){const x=n[0]+sx*d,z=n[2]+cz*d;if(near(x,z,y0,1.3,2.0))de=d;}
  const fd=drop?Math.max(0.5,d0-0.2):d0-0.4,cx=n[0]+sx*fd,cz2=n[2]+cz*fd,px=-cz,pz=sx; // drop fences stand at the rim, same-level fences just inside the gap
  const e1=[cx+px*0.95,cz2+pz*0.95],e2=[cx-px*0.95,cz2-pz*0.95];
  // segment-to-node clearance: the whole fence quad must stay off every playable node's capsule
  let clash=false;
  for(let gx=-2;gx<=2&&!clash;gx++)for(let gz=-2;gz<=2&&!clash;gz++)for(const j of cell.get((Math.round(cx/1.5)+gx)+','+(Math.round(cz2/1.5)+gz))||[]){
   const p=nodes[j];if(Math.abs(p[1]-y0)>2.2)continue;
   if(segDist(e1[0],e1[1],e2[0],e2[1],p[0],p[2],p[0],p[2])<0.55){clash=true;break;}}
  if(clash)continue;
  if(!drop&&nearEdge(e1[0],e1[1],e2[0],e2[1],0.9)){edgeCut++;continue;} // nav edges crossing a trap rim are the defect, not a reason to skip
  if(dedupe(cx,cz2))continue;fcents.push([cx,cz2]);
  const g1=ground(e1[0],e1[1],y0+1.8),g2=ground(e2[0],e2[1],y0+1.8);
  const bot=Math.min(g1,g2,y0)-0.4,top=Math.max(g1,g2,y0)+2.6; // drop fences reach the lower ground so fallen walkers still stop
  fences.push([[e1[0],bot,e1[1]],[e2[0],bot,e2[1]],[e2[0],top,e2[1]],[e1[0],top,e1[1]]]);}}
const fp=new Float32Array(fences.length*12),fi=new Uint32Array(fences.length*6);
fences.forEach((q,k)=>{q.forEach((v,j)=>fp.set(v,k*12+j*3));fi.set([k*4,k*4+1,k*4+2,k*4,k*4+2,k*4+3],k*6);});
const buf=Buffer.alloc(8+fp.length*4+fi.length*4);buf.writeUInt32LE(fp.length/3,0);buf.writeUInt32LE(fi.length,4);
Buffer.from(fp.buffer,fp.byteOffset,fp.length*4).copy(buf,8);Buffer.from(fi.buffer,fi.byteOffset,fi.length*4).copy(buf,8+fp.length*4);
fs.writeFileSync(root+'fence.bin',buf);
console.log(key,'playable nodes',play.length,'porous edges',porous,'edge-cut rejections',edgeCut,'fences',fences.length);
