// Capsule sweep: from every playable nav node push a standing capsule (r .38, 0.42..1.8 m above the node, i.e. above
// the 0.4 m step) outwards in 16 directions; at the first blocked distance record WHAT blocks it. A spot counts as an
// invisible/foliage wall when every blocking triangle is suspect: a plant material (walk-through in VALORANT), drawn
// >=50% see-through by the page (alpha cut / decal), or collision-only (no render triangle).
const R=require('module').createRequire('/workspace/work/vs-lane-invis/server/x.js'),fs=require('fs'),T=R('three'),{MeshBVH}=R('three-mesh-bvh');
const key=process.argv[2],W=process.argv[3],TAG=process.env.TAG||'',root='/workspace/work/vs-lane-invis/models/valorant/maps/'+key+'/';
const rd=f=>{const b=fs.readFileSync(W+'/'+key+'/'+f);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);},meta=JSON.parse(fs.readFileSync(W+'/'+key+'/meta.json'));
const pos=new Float32Array(rd('position.bin')),idx=new Uint32Array(rd('index.bin')),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(new T.BufferAttribute(idx,1));
const roots=[];for(let i=0;i<meta.roots;i++)roots.push(rd('bvh'+i+'.bin'));const bvh=MeshBVH.deserialize({roots,index:idx},g,{setIndex:false});
const mat=new Int16Array(fs.readFileSync(__dirname+'/mat_'+key+TAG+'.bin').buffer.slice(0)),frac=new Uint8Array(fs.readFileSync(__dirname+'/frac_'+key+TAG+'.bin')),info=JSON.parse(fs.readFileSync(__dirname+'/mats_'+key+TAG+'.json'));
const nav=JSON.parse(fs.readFileSync(root+'navigation.json')),mp=JSON.parse(fs.readFileSync(root+'map.json'));
const N=nav.nodes,V=nav.valid,seen=new Uint8Array(N.length),prot=new Uint8Array(N.length);
for(let s=0;s<N.length;s++){if(seen[s]||!V[s])continue;const c=[s];seen[s]=1;for(let q=0;q<c.length;q++)for(const j of nav.adj[c[q]])if(V[j]&&!seen[j]){seen[j]=1;c.push(j);}if(c.length>=30)for(const i of c)prot[i]=1;}
const callout=(x,z)=>{let b=null,d=1e9;for(const c of mp.callouts||[]){const e=(c.position[0]-x)**2+(c.position[2]-z)**2;if(e<d){d=e;b=c.name;}}return b+' '+Math.sqrt(d).toFixed(0)+'m';};
const r=.38,line=new T.Line3(),box=new T.Box3(),q1=new T.Vector3(),q2=new T.Vector3();
const blockers=(x,y,z)=>{line.start.set(x,y+.42+r,z);line.end.set(x,y+1.8-r,z);box.min.set(x-r,y+.42,z-r);box.max.set(x+r,y+1.8,z+r);const out=[];bvh.shapecast({intersectsBounds:b=>b.intersectsBox(box),intersectsTriangle:(t,ti)=>{if(t.closestPointToSegment(line,q1,q2)<r-.012)out.push(ti);return false;}});return out;};
const cls=t=>{const m=mat[t];if(m===-2)return 'colonly';if(frac[t]>=50)return 'seethru';const I=info[m];return I&&I.plant?'plant':'solid';};
(async()=>{const path=require('path');const {loadWorld}=await import('/workspace/work/vs-lane-invis/server/src/world.js');
const Wd=await loadWorld({fetch:async r=>new Response(await fs.promises.readFile(path.join(W,'..',new URL(r.url).pathname)))},key);
// reachable = on the movement leash footprint (motor leashGrid: largest nav component + low side components); nav islands on
// roofs / wall tops (e.g. Breeze y 14.5 above Defender Side Arches) are not standable space
let off=0;for(let i=0;i<N.length;i++)if(prot[i]&&!Wd.leash(N[i][0],N[i][2],Wd.ground(N[i][0],N[i][2],N[i][1]+.6))){prot[i]=0;off++;}console.log('off-leash nodes skipped',off);
const spots=[],blockMat={};
for(let i=0;i<N.length;i++){if(!prot[i])continue;const [x,y,z]=N[i];if(blockers(x,y,z).length)continue;
 for(let d=0;d<16;d++){const a=d/16*Math.PI*2,cx=Math.cos(a),cz=Math.sin(a);
  for(let s=.15;s<=.9;s+=.15){const b=blockers(x+cx*s,y,z+cz*s);if(!b.length)continue;const c=b.map(cls);
   for(const t of b){const n=mat[t]===-2?'COLLISION-ONLY':(info[mat[t]]||{}).name;blockMat[n]=(blockMat[n]||0)+1;}
   if(c.every(k=>k!=='solid')){const t=b[0],m=mat[t];spots.push({i,x:x+cx*s,y,z:z+cz*s,kind:[...new Set(c)].join('+'),mat:[...new Set(b.map(t=>mat[t]===-2?'COLLISION-ONLY':info[mat[t]].name))].join(',')});}
   break;}}}
const cl=new Map();for(const p of spots){const k=Math.round(p.x/2.5)+','+Math.round(p.y/2.5)+','+Math.round(p.z/2.5);let e=cl.get(k);if(!e)cl.set(k,e={rep:[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)],node:N[p.i],n:0,nodes:new Set(),x:0,y:0,z:0,mats:new Set(),kinds:new Set()});e.n++;e.nodes.add(p.i);e.x+=p.x;e.y+=p.y;e.z+=p.z;p.mat.split(',').forEach(m=>e.mats.add(m));e.kinds.add(p.kind);}
const out=[...cl.values()].map(e=>({rep:e.rep,node:e.node,nodes:e.nodes.size,pushes:e.n,at:[+(e.x/e.n).toFixed(1),+(e.y/e.n).toFixed(1),+(e.z/e.n).toFixed(1)],callout:callout(e.x/e.n,e.z/e.n),kinds:[...e.kinds],mats:[...e.mats]})).sort((a,b)=>b.pushes-a.pushes);
fs.writeFileSync(__dirname+'/caps_'+key+TAG+'.json',JSON.stringify({spots:out,blockMat},null,1));
const tot={};for(const s of spots)for(const m of s.mat.split(','))tot[m]=(tot[m]||0)+1;
console.log(key,TAG,'suspect pushes',spots.length,'clusters',out.length,JSON.stringify(tot));for(const e of out.slice(0,+process.env.TOP||20))console.log(' ',JSON.stringify(e));
})();
