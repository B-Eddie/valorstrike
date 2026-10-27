// Horizontal-ray sweep from playable nav nodes: first collision hit within REACH whose triangle renders see-through
const R=require('module').createRequire('/workspace/work/vs-lane-invis/server/x.js');
// (see_<key>.json from classify.py) and has no opaque collision surface within 10 cm = invisible wall candidate.
const fs=require('fs'),path=require('path'),T=R('three'),{MeshBVH}=R('three-mesh-bvh');
const key=process.argv[2],W=process.argv[3]||'/workspace/work/vs-lane-invis/server/worlds',root='/workspace/work/vs-lane-invis/models/valorant/maps/'+key+'/';
const meta=JSON.parse(fs.readFileSync(W+'/'+key+'/meta.json')),rd=f=>{const b=fs.readFileSync(W+'/'+key+'/'+f);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);};
const pos=new Float32Array(rd('position.bin')),idx=new Uint32Array(rd('index.bin')),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(new T.BufferAttribute(idx,1));
const roots=[];for(let i=0;i<meta.roots;i++)roots.push(rd('bvh'+i+'.bin'));const bvh=MeshBVH.deserialize({roots,index:idx},g,{setIndex:false});
const tk=(a)=>{const v=[];for(let j=0;j<3;j++)v.push([0,1,2].map(c=>Math.round(a[j*3+c]*1000)).join(','));return v.sort().join('|');};
const see=new Map();for(const [n,k,f,v] of JSON.parse(fs.readFileSync(__dirname+'/see_'+key+(process.env.TAG||'')+'.json')))see.set(tk(v),{n,k,f});
const triKey=t=>{const a=[];for(let j=0;j<3;j++){const i=idx[t*3+j];a.push(pos[i*3],pos[i*3+1],pos[i*3+2]);}return tk(a);};
const nav=JSON.parse(fs.readFileSync(root+'navigation.json')),mp=JSON.parse(fs.readFileSync(root+'map.json'));
const N=nav.nodes,V=nav.valid,seen=new Uint8Array(N.length),prot=new Uint8Array(N.length);
for(let s=0;s<N.length;s++){if(seen[s]||!V[s])continue;const c=[s];seen[s]=1;for(let q=0;q<c.length;q++)for(const j of nav.adj[c[q]])if(V[j]&&!seen[j]){seen[j]=1;c.push(j);}if(c.length>=30)for(const i of c)prot[i]=1;}
const callout=(x,z)=>{let b=null,d=1e9;for(const c of mp.callouts||[]){const e=(c.position[0]-x)**2+(c.position[2]-z)**2;if(e<d){d=e;b=c.name;}}return b+' ('+Math.sqrt(d).toFixed(0)+'m)';};
const ray=new T.Raycaster();ray.firstHitOnly=true;const REACH=+process.env.REACH||0.9,HS=[0.35,0.9,1.5],DIRS=16;
const sph=new T.Sphere(),hits=[];const kindCount={};
const mesh=new T.Mesh(g);g.boundsTree=bvh;T.Mesh.prototype.raycast=R('three-mesh-bvh').acceleratedRaycast;
for(let i=0;i<N.length;i++){if(!prot[i])continue;const [x,y,z]=N[i];
 for(const h of HS)for(let d=0;d<DIRS;d++){const a=d/DIRS*Math.PI*2,dir=new T.Vector3(Math.cos(a),0,Math.sin(a));ray.set(new T.Vector3(x,y+h,z),dir);ray.far=REACH;
  const r=mesh.raycast?(()=>{const o=[];mesh.raycast(ray,o);return o[0];})():null;if(!r)continue;kindCount.any=(kindCount.any||0)+1;const s=see.get(triKey(r.faceIndex));if(!s)continue;
  // opaque collision within 10 cm of the hit point -> the see-through tri lies on a visible surface (decal on a wall)
  sph.set(r.point,0.10);let opaque=false;bvh.shapecast({intersectsBounds:b=>b.intersectsSphere(sph),intersectsTriangle:(tri,ti)=>{if(tri.intersectsSphere(sph)&&!see.has(triKey(ti))){opaque=true;return true;}return false;}});
  if(opaque)continue;hits.push({node:i,x:+r.point.x.toFixed(2),y:+r.point.y.toFixed(2),z:+r.point.z.toFixed(2),h,mat:s.n,kind:s.k,f:s.f,dist:+r.distance.toFixed(2)});}}
// cluster in 2 m cells
const cl=new Map();for(const p of hits){const c=Math.round(p.x/2)+','+Math.round(p.y/2)+','+Math.round(p.z/2)+'|'+p.mat;let e=cl.get(c);if(!e)cl.set(c,e={mat:p.mat,kind:p.kind,n:0,nodes:new Set(),hs:new Set(),x:0,y:0,z:0});e.n++;e.nodes.add(p.node);e.hs.add(p.h);e.x+=p.x;e.y+=p.y;e.z+=p.z;}
const out=[...cl.values()].map(e=>({mat:e.mat,kind:e.kind,rays:e.n,nodes:e.nodes.size,heights:[...e.hs].sort(),at:[+(e.x/e.n).toFixed(1),+(e.y/e.n).toFixed(1),+(e.z/e.n).toFixed(1)],callout:callout(e.x/e.n,e.z/e.n)})).sort((a,b)=>b.nodes-a.nodes);
fs.writeFileSync(__dirname+'/sweep_'+key+(process.env.TAG||'')+'.json',JSON.stringify(out,null,1));
const by={};for(const e of out){by[e.mat]=(by[e.mat]||0)+e.nodes;}console.log(JSON.stringify(kindCount),key,'rays',hits.length,'clusters',out.length,JSON.stringify(by));for(const e of out.slice(0,+process.env.TOP||25))console.log(JSON.stringify(e));
