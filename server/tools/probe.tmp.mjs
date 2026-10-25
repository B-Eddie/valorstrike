// replicate generator decisions around a flagged landing spot
import * as T from 'three';import {MeshBVH,CENTER} from 'three-mesh-bvh';import fs from 'node:fs';
const [key,TX,TZ]=[process.argv[2],+process.argv[3],+process.argv[4]],root='../models/valorant/maps/'+key+'/';
const b=fs.readFileSync(root+'collision.bin'),nv=b.readUInt32LE(0),ni=b.readUInt32LE(4);
const P0=new Float32Array(b.buffer,b.byteOffset+8,nv*3),I0=new Uint32Array(b.buffer,b.byteOffset+8+nv*12,ni);
const nav=JSON.parse(fs.readFileSync(root+'navigation.json'));const nodes=nav.nodes,valid=nav.valid,play=[];
for(let i=0;i<valid.length;i++)if(valid[i])play.push(i);
const min=[0,1,2].map(a=>Math.min(...play.map(i=>nodes[i][a]))-3),max=[0,1,2].map(a=>Math.max(...play.map(i=>nodes[i][a]))+3);
console.log('clip x',min[0].toFixed(1),max[0].toFixed(1),'z',min[2].toFixed(1),max[2].toFixed(1),'target in clip?',TX>min[0]&&TX<max[0]&&TZ>min[2]&&TZ<max[2]);
const P=[],idx=[],vm=new Map();const seen=new Set();
for(let i=0;i<ni;i+=3){let out=false;for(let a=0;a<3;a++)if([0,1,2].every(j=>P0[I0[i+j]*3+a]<min[a])||[0,1,2].every(j=>P0[I0[i+j]*3+a]>max[a])){out=true;break;}if(out)continue;
 const v=[];for(let j=0;j<3;j++){const k=I0[i+j]*3,s=[P0[k],P0[k+1],P0[k+2]].map(x=>Math.round(x*1000)).join(',');let a=vm.get(s);if(a===undefined){a=P.length/3;P.push(P0[k],P0[k+1],P0[k+2]);vm.set(s,a);}v.push(a);}
 if(new Set(v).size<3)continue;const s=[...v].sort((a,b)=>a-b).join(',');if(seen.has(s))continue;seen.add(s);idx.push(...v);}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(P),3));geo.setIndex(idx);
const bvh=new MeshBVH(geo,{maxLeafTris:12,maxDepth:64,strategy:CENTER});
const ground=(x,z,y)=>{const ray=new T.Ray(new T.Vector3(x,y+.32,z),new T.Vector3(0,-1,0));for(let i=0;i<24;i++){const h=bvh.raycastFirst(ray,T.DoubleSide);if(!h)break;if(h.face.normal.y>.45)return h.point.y;ray.origin.y=h.point.y-.005;}return y-10;};
const cell=new Map(),CK=(x,z)=>Math.round(x/1.5)+','+Math.round(z/1.5);
for(const i of play){const k=CK(nodes[i][0],nodes[i][2]);(cell.get(k)||cell.set(k,[]).get(k)).push(i);}
const near=(x,z,y,rad,dy)=>{for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const i of cell.get((Math.round(x/1.5)+dx)+','+(Math.round(z/1.5)+dz))||[]){const p=nodes[i];if((p[0]-x)**2+(p[2]-z)**2<=rad*rad&&Math.abs(p[1]-y)<=dy)return true;}return false;};
console.log('ground at target:',ground(TX,TZ,9).toFixed(2));
const ns=play.map(i=>nodes[i]).map(p=>[Math.hypot(p[0]-TX,p[2]-TZ),p]).sort((a,b)=>a[0]-b[0]).slice(0,3);
for(const [nd,n] of ns){const y0=ground(n[0],n[2],n[1]+.1);
 console.log('node',n.map(v=>v.toFixed(1)).join(','),'dist',nd.toFixed(2),'y0',y0.toFixed(2));
 const dx=TX-n[0],dz=TZ-n[2],L=Math.hypot(dx,dz),sx=dx/L,cz=dz/L;
 for(let d=1.0;d<=Math.min(L,3.5);d+=0.35){const x=n[0]+sx*d,z=n[2]+cz*d;
  if(near(x,z,y0,1.3,2.0))continue;
  const g=ground(x,z,y0+1.8);
  console.log('  first uncovered d',d.toFixed(2),'pt',x.toFixed(1),z.toFixed(1),'ground',g.toFixed(2),'class',g>y0+1.2?'wall':g<y0-1.5?'drop':'same');
  break;}}
