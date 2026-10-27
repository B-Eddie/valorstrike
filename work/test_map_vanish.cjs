// "Textures disappear at certain angles" (user bug, every map): a wall or floor the player looks at must show its own
// texture, never a surface hidden behind it. Headless sweep over the six original maps (render meshes, scene.gltf),
// no browser: the material state the runtime gives each map material (nmZFixApply z-fight levels, nmDecalApply) is
// applied to stand-in materials with the runtime's own functions, then the depth test is modelled per sight ray.
//  - Seeded playable navigation nodes, eye 1.6 m; per eye random yaw / pitch (-40..+12 deg) views (vertical fov 75,
//    720 px rows), random pixels in each view; every render surface on the ray within RANGE m (three-mesh-bvh, both
//    faces: every converted map material is double-sided).
//  - Each surface's depth as the GPU writes it: 24-bit window depth of the camera's near / far (0.1 / 500 on native
//    maps), plus glPolygonOffset (factor x the triangle's own max depth slope per pixel + units x 2^-24) when the
//    material has polygonOffset.
//  - Occluders: opaque, depth-writing materials (no decal / foliage cut-out / glass / alpha-tested card). The pixel
//    shows the occluder with the smallest written depth (or a decal drawn on top of it). An ARTIFACT is a pixel whose
//    winner lies more than GAP (1 cm) off the first occluder's surface (measured from the first hit to the winner's
//    plane): the surface the player looks at vanishes and something hidden behind it (another room's wall, the floor
//    under a slab, the back face of a wall, the wall behind a poster / graffiti card / crate face) is drawn instead.
//    The z-fight scan (server/tools/map-zfight.mjs) only layers surfaces within 1 cm of each other, so nothing farther
//    behind may ever win. Before the fix (slope-scaled glPolygonOffset factor = -level) 0.5-1% of all surface pixels
//    showed a hidden surface 1 cm - 40 cm behind, mostly at oblique / grazing views (the user's "at certain angles").
//  - Ties: coplanar layers on different levels whose written depths are within 2 depth steps (would flicker) are counted
//    and reported (not asserted: the scan leaves a few same-level pairs open by design).
//  - Frustum / distance culling soundness on the real data: nmOptimizeScene (the runtime's chunker, LOW preset with the
//    map's detail.json small-prop table) run on every map's real geometry; every chunk's bounding sphere must contain
//    all of its vertices (three's frustum test is then conservative: it never drops a visible triangle), nmCull must
//    keep every non-detail chunk visible, and no small-prop (distance-culled) chunk may hold a wall / floor sized
//    triangle (edge > 2.5 m).
// Usage: node work/test_map_vanish.cjs [maps...]   (env PER=eyes per map, VIEWS, PIX; JSON=path writes the report)
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),src=fs.readFileSync(process.env.RUNTIME||path.join(__dirname,'native_maps_runtime.js'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const MAPS=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','haven','split','lotus','breeze'];
const PER=+process.env.PER||60,VIEWS=+process.env.VIEWS||12,PIX=+process.env.PIX||30,RANGE=40,GAP=.01,NEAR=.1,FAR=500,FOV=75,H=720,ASPECT=16/9;
const line=re=>{const m=src.match(re);assert(m,'missing '+re);return m[0];};
const pick=n=>{const i=src.indexOf('\nfunction '+n+'(')+1;assert(i>0,n+' missing');let j=src.indexOf('\nfunction ',i+1),k=src.indexOf('\nasync function ',i+1);if(j<0)j=src.length;if(k>0&&k<j)j=k;return src.slice(i,j);};
const NM_ZFIX=JSON.parse(line(/^var NM_ZFIX=(.*);$/m).slice('var NM_ZFIX='.length,-1));
const api=new Function('THREE','NM_ZFIX',(src.match(/^var NM_ZBIAS=.*;$/m)||[''])[0]+'\n'+(src.match(/^var NM_ZLEVELS=.*;$/m)||[''])[0]+'\n'+['nmZFixApply','nmDecalApply','nmDecalStyle'].map(pick).join('\n')+'\nreturn {nmZFixApply,nmDecalApply,nmDecalStyle};')(THREE,NM_ZFIX);
const DECAL=/Decal|Floater/i,TERRAIN=/Floor|Ground|(?:Stone|Brick|Dirt|Gravel|Tile|Grass|Jam|Stairs).*Grass|Grass.*Stone|Blendable.*Gravel/i;
const SEE=/Glass|Window|Water|Puddle|Foliage|Leaves|Leaf|Plant(?!er)|Bush|Vine|Ivy|Fern|Shrub|Creeper|Moss|Flower|Tree|Palm|Grass_M0_Cards|Cards|Wires?|Cable|Vista|Sky|Cloud|LightCone|Godray|Volumetric|Fog|Smoke|Dust|Particle|Fence|Chain|Net|Grate|Mesh/i;
// Stand-in material per map material: what the runtime sets for depth (z-fight level, decal offset).
function materials(key,prims){const byName=new Map();const scene=new THREE.Group();for(const p of prims){if(byName.has(p.name))continue;const m=new THREE.MeshLambertMaterial({name:p.name,side:THREE.DoubleSide});const decal=DECAL.test(p.name);if(decal)api.nmDecalApply(m,'decal');byName.set(p.name,m);const g=new THREE.BufferGeometry();scene.add(new THREE.Mesh(g,m));}
 api.nmZFixApply(scene,key);
 const out=new Map();for(const [n,m] of byName){const p=prims.find(q=>q.name===n);const terrain=TERRAIN.test(n)&&!/Cards|Decal|Floater/i.test(n);const occ=!m.userData.decal&&(terrain||(p.alpha==='OPAQUE'&&!SEE.test(n)));out.set(n,{decal:!!m.userData.decal,occ,po:m.polygonOffset?[m.polygonOffsetFactor,m.polygonOffsetUnits]:null});}return out;}
const zw=z=>FAR/(FAR-NEAR)*(1-NEAR/z),R24=1/16777216;
// Ray-plane distance; plane through a with normal n.
function rayPlane(o,d,a,n){const den=n[0]*d[0]+n[1]*d[1]+n[2]*d[2];if(Math.abs(den)<1e-9)return Infinity;return (n[0]*(a[0]-o[0])+n[1]*(a[1]-o[1])+n[2]*(a[2]-o[2]))/den;}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
function tri(R,t){const I=R.index,P=R.pos,v=k=>{const i=I[t*3+k]*3;return [P[i],P[i+1],P[i+2]];};return [v(0),v(1),v(2)];}
// Depth written for surface triangle t at the pixel ray (eye o, dir d, camera forward F, right/up steps rx/ry).
function written(R,M,h,o,d,F,px){const T=tri(R,h.faceIndex),n=nrm(cross(sub(T[1],T[0]),sub(T[2],T[0])));const z=h.distance*dot(d,F);
 let e=zw(z);if(M.po){let dz=0;for(const s of px){const d2=nrm([d[0]+s[0],d[1]+s[1],d[2]+s[2]]),t=rayPlane(o,d2,T[0],n);if(isFinite(t)&&t>0)dz=Math.max(dz,Math.abs(zw(t*dot(d2,F))-e));}e+=M.po[0]*dz+M.po[1]*R24;}return e;}
function sweep(key,R,mats,nav){const {bvh,prims,triMat}=R;let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;const valid=nav.nodes.map((n,i)=>i).filter(i=>nav.valid[i]);
 const ray=new THREE.Ray(),tanV=Math.tan(FOV*Math.PI/360),step=2*tanV/H;let rays=0,seen=0,layered=0,misordered=0,ties=0;const bad=[];
 for(let k=0;k<PER;k++){const nd=nav.nodes[valid[Math.floor(rnd()*valid.length)]],o=[nd[0],nd[1]+1.6,nd[2]];
  for(let v=0;v<VIEWS;v++){const yaw=rnd()*Math.PI*2,pitch=(-40+52*rnd())*Math.PI/180,F=[Math.cos(pitch)*Math.sin(yaw),Math.sin(pitch),Math.cos(pitch)*Math.cos(yaw)],Rt=nrm(cross(F,[0,1,0])),U=cross(Rt,F);
   for(let q=0;q<PIX;q++){const sx=(rnd()*2-1)*tanV*ASPECT,sy=(rnd()*2-1)*tanV,d=nrm([F[0]+Rt[0]*sx+U[0]*sy,F[1]+Rt[1]*sx+U[1]*sy,F[2]+Rt[2]*sx+U[2]*sy]);
    const px=[[Rt[0]*step,Rt[1]*step,Rt[2]*step],[U[0]*step,U[1]*step,U[2]*step],[-Rt[0]*step,-Rt[1]*step,-Rt[2]*step],[-U[0]*step,-U[1]*step,-U[2]*step]];
    ray.origin.set(o[0],o[1],o[2]);ray.direction.set(d[0],d[1],d[2]);rays++;const hits=bvh.raycast(ray,THREE.DoubleSide).filter(h=>h.distance<=RANGE&&h.distance>NEAR).sort((a,b)=>a.distance-b.distance);
    const first=hits.findIndex(h=>mats.get(prims[triMat[h.faceIndex]].name).occ);if(first<0)continue;seen++;const S=hits[first],ST=tri(R,S.faceIndex);
    let best=null,be=Infinity;const cand=[];for(let i=first;i<hits.length;i++){const h=hits[i],M=mats.get(prims[triMat[h.faceIndex]].name);if(!M.occ&&!M.decal)continue;if(h.distance>S.distance+8)break;const e=written(R,M,h,o,d,F,px);cand.push([h,M,e]);if(M.occ&&e<be){be=e;best=h;}}
    const off=h=>{const T=tri(R,h.faceIndex),n=nrm(cross(sub(T[1],T[0]),sub(T[2],T[0])));return Math.abs(dot(n,sub([S.point.x,S.point.y,S.point.z],T[0])));};
    /* z-fight layers kept in order: coplanar occluders (within 1 cm of the surface in view) on different levels -> the higher level is drawn */const lvl=M=>M.po?-M.po[0]-M.po[1]:0;const co=cand.filter(([h,M])=>M.occ&&off(h)<=.01);if(co.length>1&&new Set(co.map(c=>lvl(c[1]))).size>1){layered++;const top=Math.max(...co.map(c=>lvl(c[1]))),bw=co.find(c=>c[0]===best);if(!bw||lvl(bw[1])<top)misordered++;}{const co2=co.map(c=>[c[2],prims[triMat[c[0].faceIndex]].name+'|'+lvl(c[1])]).sort((x,y)=>x[0]-y[0]);const k=co2.findIndex(c=>c[1]!==co2[0][1]);if(k>0&&co2[k][0]-co2[0][0]<2*R24)ties++;}
    let win=best!==S&&best&&off(best)>GAP?best:null;if(!win)for(const [h,M,e] of cand)if(M.decal&&h.distance>S.distance&&e<=be&&off(h)>GAP){win=h;break;}
    if(win){const sm=mats.get(prims[triMat[S.faceIndex]].name),wm=mats.get(prims[triMat[win.faceIndex]].name);bad.push({at:[+S.point.x.toFixed(1),+S.point.y.toFixed(1),+S.point.z.toFixed(1)],eye:o.map(x=>+x.toFixed(2)),dist:+S.distance.toFixed(2),cos:+Math.abs(dot(d,nrm(cross(sub(ST[1],ST[0]),sub(ST[2],ST[0]))))).toFixed(3),gap:+off(win).toFixed(3),looked:prims[triMat[S.faceIndex]].name,shown:prims[triMat[win.faceIndex]].name,shownOffset:wm.po,lookedOffset:sm.po});}}}}
 return {rays,seen,bad,layered,misordered,ties};}
// Frustum / distance culling soundness: the runtime's chunker on the real geometry (LOW preset, detail.json).
function culling(key,R){const {prims,pos,index}=R,detail=(()=>{try{return JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'detail.json'),'utf8'));}catch(e){return null;}})();
 const names=['nmOptimizeScene','nmChunkPlan','nmMatKey','nmSphere','nmGather','nmOffset','nmCopy3','nmCopy2','nmCopyN','nmCentroids','nmDetailSplit','nmDetailDistance','nmCull'];const f=new Function('THREE','NM_OPT','NM_SMALL','nmSmallDist',names.map(pick).join('\n')+'\nreturn {'+names.join(',')+'};')(THREE,new Function(line(/^var NM_OPT=.*;$/m)+'\nreturn NM_OPT;')(),new Function(line(/^var NM_SMALL=.*;$/m)+'\nreturn NM_SMALL;')(),q=>25);
 const scene=new THREE.Group();scene.userData.nmDetail=detail;const mats=new Map();for(const p of prims){let m=mats.get(p.name);if(!m){m=new THREE.MeshLambertMaterial({name:p.name,side:THREE.DoubleSide});mats.set(p.name,m);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos.slice(p.vert0*3,(p.vert0+p.verts)*3),3));const I=new Uint32Array(p.tris*3);for(let i=0;i<I.length;i++)I[i]=index[p.tri0*3+i]-p.vert0;g.setIndex(new THREE.BufferAttribute(I,1));scene.add(new THREE.Mesh(g,m));}
 f.nmOptimizeScene(scene);scene.updateMatrixWorld(true);const L=scene.userData.nmChunks;let loose=0,big=0,hidden=0;const v=new THREE.Vector3(),wsph=new THREE.Sphere();
 for(const m of L){const g=m.geometry;if(!g.boundingSphere)g.computeBoundingSphere();wsph.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);const P=g.attributes.position;for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(m.matrixWorld);if(v.distanceTo(wsph.center)>wsph.radius*1.0001+1e-4){loose++;break;}}
  if(m.userData.nmChunk.small){const I=g.index.array;for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,A=P.array;const e=Math.max(Math.hypot(A[a]-A[b],A[a+1]-A[b+1],A[a+2]-A[b+2]),Math.hypot(A[b]-A[c],A[b+1]-A[c+1],A[b+2]-A[c+2]),Math.hypot(A[a]-A[c],A[a+1]-A[c+1],A[a+2]-A[c+2]));if(e>2.5){big++;break;}}}}
 const C={scene,cullAt:null};const cam=new THREE.PerspectiveCamera();cam.position.set(1e4,0,1e4);f.nmCull(C,cam);for(const m of L){const u=m.userData.nmChunk;if(!u.maxDist&&!u.small&&!m.visible)hidden++;}
 const out={chunks:L.length,looseSpheres:loose,smallWithBigTris:big,alwaysChunksHidden:hidden};for(const m of L)m.geometry.dispose();return out;}
// No map material may use a slope-scaled depth bias: the factor term grows with the triangle's depth slope, i.e. with
// the viewing angle, and is what pulled hidden layers through the surface in view at grazing angles.
const PRE=[];/* every converted map material is double-sided (no back-face culling on single-sided / flipped-normal map meshes); the sweep ray-casts both faces on that basis */if(!/new THREE\.MeshLambertMaterial\(\{name:m\.name,[^}]*side:THREE\.DoubleSide/.test(pick('nmPrepareScene')))PRE.push('nmPrepareScene: map materials are no longer double-sided (back faces culled: walls vanish from behind)');{const T=new THREE.Group(),names=[...new Set(Object.values(NM_ZFIX).flatMap(f=>f.o.flat()))].slice(0,3);const L=[];for(const n of names){const m=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshLambertMaterial({name:n}));T.add(m);L.push(m);}
 const key=Object.keys(NM_ZFIX).find(k=>NM_ZFIX[k].o.flat().includes(names[0]));api.nmZFixApply(T,key);const d=api.nmDecalApply(new THREE.MeshLambertMaterial(),'decal');
 for(const m of [...L.map(o=>o.material),d])if(m.polygonOffset&&m.polygonOffsetFactor!==0)PRE.push((m.name||'decal')+': slope-scaled polygonOffset factor '+m.polygonOffsetFactor+' (hidden surfaces win at grazing angles)');}
(async()=>{const {loadRender}=await import(path.join(root,'server/tools/map-render.mjs'));const report={};let fail=PRE.slice();
 for(const key of MAPS){const t0=Date.now();const R=loadRender(key,{bvh:true}),nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'navigation.json'),'utf8'));const mats=materials(key,R.prims);
  const s=sweep(key,R,mats,nav);const c=culling(key,R);const rate=s.bad.length/Math.max(1,s.seen);
  const byPair=new Map();for(const b of s.bad){const k=b.looked+' -> '+b.shown;byPair.set(k,(byPair.get(k)||0)+1);}
  report[key]={rays:s.rays,surfaces:s.seen,layered:s.layered,misordered:s.misordered,ties:s.ties,artifacts:s.bad.length,rate:+(rate*100).toFixed(3)+'%',culling:c,topPairs:[...byPair].sort((a,b)=>b[1]-a[1]).slice(0,8),examples:s.bad.slice(0,6),ms:Date.now()-t0};
  console.log(key,JSON.stringify({rays:s.rays,surfaces:s.seen,layered:s.layered,misordered:s.misordered,ties:s.ties,artifacts:s.bad.length,rate:report[key].rate,culling:c,ms:report[key].ms}));for(const [k,n] of report[key].topPairs)console.log('   ',n,k);for(const e of report[key].examples)console.log('    e.g.',JSON.stringify(e));
  if(s.bad.length)fail.push(key+': '+s.bad.length+' pixels show a surface hidden > '+GAP+' m behind the one in view');if(c.looseSpheres)fail.push(key+': '+c.looseSpheres+' chunk bounding spheres miss their own vertices (frustum culling drops visible geometry)');if(c.smallWithBigTris)fail.push(key+': '+c.smallWithBigTris+' distance-culled small-prop chunks hold wall/floor-sized triangles');if(c.alwaysChunksHidden)fail.push(key+': '+c.alwaysChunksHidden+' non-detail chunks hidden by nmCull');
  R.bvh=null;R.geo=null;}
 if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(report,null,1));
 assert.deepEqual(fail,[],'map surfaces vanish:\n'+fail.join('\n'));console.log('test_map_vanish: OK',MAPS.join(' '));})().catch(e=>{console.error(e.message||e);process.exit(1);});
