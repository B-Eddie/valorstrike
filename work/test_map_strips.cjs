// Map strips (gpu lane, 31 Oct 2026; user: "so laggy it's unplayable" on LOW, "just make it faster", must not look worse).
// The 110-chunk texture-array plan left map-wide pieces (Ascent: one window-frame chunk 647 k triangles), so three's
// frustum culling dropped almost nothing (Ascent LOW 1080: ~3 M map triangles from every view). nmChunkPlan now cuts
// pieces to at most NM_STRIP.span m (opt.span / opt.spanTris) and nmStrips stores the consecutive chunks of one material
// group in ONE geometry; nmRuns (scene.onBeforeRender, every frame) tests each chunk against the camera frustum (and its
// nmCull visibility) and draws each run of visible consecutive chunks as one call (pooled proxy meshes, drawRange).
// Checks run the runtime's own functions (work/native_maps_runtime.js) on a synthetic scene with three.js:
//  - span: no split piece of a big group is wider than NM_STRIP.span (unless under NM_STRIP.tris triangles)
//  - every source triangle is drawn exactly once when every chunk is visible; strip chunks' index ranges tile their strip
//  - every strip chunk's sphere (userData.nmChunk, what nmRuns tests) holds all of its vertices
//  - nmRuns, many cameras: the proxies drawn cover exactly the visible chunks' triangles (frustum + nmCull distance),
//    one proxy per run of consecutive visible chunks, nothing hidden drawn, nothing visible dropped
//  - proxies: never cast shadows, own frustum test off, drawRange set before / reset after their draw
//  - blended (transparent) chunks keep their own mesh (draw order); a strip chunk keeps no copy of the index
//  - wiring: the render hook runs nmCull then nmRuns; the generated page carries it
// RUNTIME=<file> runs it against another runtime (red on fd0793f: no strips).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),src=fs.readFileSync(process.env.RUNTIME||path.join(__dirname,'native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
assert(/var NM_STRIP=\{/.test(src),'runtime has no map strips (NM_STRIP): big map pieces defeat frustum culling');
const fn=n=>{let i=src.indexOf('\nfunction '+n+'(');assert(i>=0,n+' missing');i++;const re=/\n(?:function |async function |var |\/\/ |\(window|if\(typeof)/g;re.lastIndex=i+1;const m=re.exec(src);return src.slice(i,m?m.index:src.length);};
const val=n=>eval('('+src.match(new RegExp('var '+n+'=(\\{[^}]*\\})'))[1]+')');
const NM_SMALL=val('NM_SMALL'),NM_STRIP=val('NM_STRIP');
assert(NM_STRIP.on&&NM_STRIP.span>0&&NM_STRIP.span<=30,'strips off or pieces wider than 30 m');
for(const s of [src,html])assert(s.includes('if(C&&C.M.g.visible){nmCull(C,cam);nmRuns(C,cam);}'),'render hook does not run nmCull then nmRuns');
assert(html.includes('function nmRuns(')&&html.includes('var NM_STRIP={'),'generated page lacks the strips (run work/install_valorant.py)');
const NAMES=['nmDetailDistance','nmChunkPlan','nmSpanOver','nmMatKey','nmCull','nmSphere','nmCentroids','nmGather','nmOffset','nmCopy3','nmCopy2','nmCopyN','nmSmallDist','nmDetailSplit','nmOptimizeScene','nmStrips','nmStripBuild','nmStripChunk','nmRunRange','nmRunReset','nmRuns'];
const NM_OPT={ratio:1,minPiece:2000};// synthetic scene: few source meshes
const api=new Function('THREE','NM_OPT','NM_SMALL','NM_STRIP','nmQuality','var NM_RF=null;\n'+NAMES.map(fn).join('\n')+'\nreturn {'+NAMES.join(',')+'};')(THREE,NM_OPT,NM_SMALL,NM_STRIP,()=>'high');
// the page passes span only on the texture-array path (WebGL2); this scene runs the plain path, so pass it the same way
api.nmOptimizeScene=new Function('THREE','NM_OPT','NM_SMALL','NM_STRIP','nmQuality','var NM_RF=null;\n'+NAMES.map(fn).join('\n').replace('nmChunkPlan(items,arr?','nmChunkPlan(items,true?').replace('{total:NM_ARR.chunks,smallPiece:NM_ARR.smallPiece}','{}')+'\nreturn nmOptimizeScene;')(THREE,NM_OPT,NM_SMALL,NM_STRIP,()=>'high');
let seed=9;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const mat=(name,extra={})=>new THREE.MeshLambertMaterial(Object.assign({name,map:new THREE.Texture(),side:THREE.DoubleSide},extra));
function mesh(name,m,n,sx,sz,cx=0,cz=0){const P=[],N=[],U=[],I=[];for(let t=0;t<n;t++){const x=cx+(R()-.5)*sx,z=cz+(R()-.5)*sz,y=R()*8;for(let k=0;k<3;k++){P.push(x+R()*.8,y+R()*.8,z+R()*.8);N.push(0,1,0);U.push(R(),R());I.push(t*3+k);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(new THREE.BufferAttribute(new Uint32Array(I),1));const o=new THREE.Mesh(g,m);o.name=name;return o;}
const scene=new THREE.Group(),wall=mat('Stone_M6_LargeBricks_MI'),frame=mat('Metal_M1_WindowFrameKit_MI'),fern=mat('Plant_3_M0_Fern_MI',{alphaTest:.45}),glass=mat('Glass_M0_Window_MI',{transparent:true,opacity:.4}),sign=mat('Sign_0_M0_Kit_MI');fern.userData.cutout=true;
// the 647 k window-frame case: one group of modest size spread over the whole map (whole-map extent, one budget slot)
scene.add(mesh('wall',wall,60000,160,120),mesh('frame',frame,24000,170,130),mesh('fern',fern,9000,150,110),mesh('glass',glass,6000,150,110),mesh('sign',sign,150,3,3,20,20));
const src0=[];scene.traverse(o=>{if(o.isMesh)src0.push(o);});
const key=(P,U,i)=>[P[i*3],P[i*3+1],P[i*3+2],U[i*2],U[i*2+1]].map(v=>v.toFixed(5)).join(',');
const want=new Map();for(const o of src0){const g=o.geometry,P=g.attributes.position.array,U=g.attributes.uv.array,I=g.index.array;for(let t=0;t<I.length;t+=3){const k=o.material.name+'|'+[0,1,2].map(j=>key(P,U,I[t+j])).join('|');want.set(k,(want.get(k)||0)+1);}}
const r=api.nmOptimizeScene(scene),chunks=scene.userData.nmChunks,strips=scene.userData.nmStrips;
assert(strips&&strips.length>=2,'big groups not stored as strips ('+(strips&&strips.length)+')');assert.equal(r.strips,strips.length);
// span: every piece of a split group is at most span wide (or under the triangle floor)
let wide=0;const box=c=>{const g=c.geometry,P=g.attributes.position.array,I=g.index.array;let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(let t=0;t<I.length;t++){const v=I[t]*3;x0=Math.min(x0,P[v]);x1=Math.max(x1,P[v]);z0=Math.min(z0,P[v+2]);z1=Math.max(z1,P[v+2]);}return Math.max(x1-x0,z1-z0);};
for(const c of chunks)if(/LargeBricks|WindowFrame/.test(c.material.name)&&c.geometry.index.count/3>NM_STRIP.tris&&box(c)>NM_STRIP.span+2)wide++;
assert.equal(wide,0,wide+' pieces wider than '+NM_STRIP.span+' m: frustum culling cannot drop them');
assert(chunks.filter(c=>/WindowFrame/.test(c.material.name)).length>=6,'map-wide window-frame group was not cut');
// blended chunks keep their own mesh; the small whole mesh is reused
assert(chunks.filter(c=>c.material===glass).every(c=>!c.isNmStripChunk&&c.isMesh),'blended chunk put in a strip (draw order changes)');
assert(chunks.some(c=>c.name==='sign'&&c.isMesh),'small whole mesh not reused');
// strips: index ranges tile the strip geometry; spheres hold their vertices
const v=new THREE.Vector3();for(const st of strips){let at=0;for(const c of st.chunks){assert(c.isNmStripChunk);assert.equal(c.s,at,'strip chunk ranges must be consecutive');at+=c.n;const P=st.geometry.attributes.position,I=st.geometry.index.array,u=c.userData.nmChunk;for(let t=c.s;t<c.s+c.n;t++){v.fromBufferAttribute(P,I[t]);assert(v.distanceTo(u.c)<=u.r*1.0001+1e-4,'strip chunk sphere misses a vertex: nmRuns would cull a visible piece');}}
 assert.equal(at,st.geometry.index.count,'strip index not fully owned by its chunks');
 for(const p of st.proxies){assert.equal(p.frustumCulled,false);assert.equal(p.geometry,st.geometry);p.castShadow=true;assert.equal(p.castShadow,false,'a proxy casts shadows');assert.equal(p.receiveShadow,false);}}
// drawn triangles with every chunk visible (camera in the middle, looking all ways is not one frustum: use a huge fov box)
const drawn=cam=>{scene.updateMatrixWorld(true);const C={scene,cullAt:null};api.nmCull(C,cam);api.nmRuns(C,cam);const out=[];const fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse)),sp=new THREE.Sphere();
 scene.traverse(o=>{if(!o.isMesh||!o.visible)return;const g=o.geometry;if(o.frustumCulled!==false){if(!g.boundingSphere)g.computeBoundingSphere();sp.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);if(!fr.intersectsSphere(sp))return;}
  let s=0,e=g.index.count;if(o.onBeforeRender===api.nmRunRange||o.userData.nmRun){o.onBeforeRender(null,scene,cam,g,o.material,null);s=g.drawRange.start;e=s+Math.min(g.drawRange.count,g.index.count-s);o.onAfterRender(null,scene,cam,g,o.material,null);assert(g.drawRange.start===0&&g.drawRange.count===Infinity,'drawRange not reset after the proxy draw');}
  out.push({o,s,e});});return out;};
const tris=list=>{const m=new Map();for(const {o,s,e} of list){const g=o.geometry,P=g.attributes.position.array,U=g.attributes.uv.array,I=g.index.array;for(let t=s;t<e;t+=3){const k=o.material.name+'|'+[0,1,2].map(j=>key(P,U,I[t+j])).join('|');m.set(k,(m.get(k)||0)+1);}}return m;};
{const cam=new THREE.OrthographicCamera(-500,500,500,-500,-1000,1000);cam.position.set(0,50,0);cam.lookAt(0,0,0);cam.updateMatrixWorld(true);const got=tris(drawn(cam));
 assert.equal(got.size,want.size,'distinct triangles drawn with everything in view');for(const [k,n] of want)assert.equal(got.get(k),n,'triangle drawn '+(got.get(k)||0)+'x, want '+n);
 for(const st of strips)assert.equal(st.runs,1,'everything visible: one draw per strip');}
// many cameras: proxies draw exactly the visible chunks, one proxy per run
{let views=0,culled=0,runs=0,chunkN=0;const sp=new THREE.Sphere();for(let k=0;k<60;k++){const cam=new THREE.PerspectiveCamera(60+R()*40,16/9,.1,500);cam.position.set((R()-.5)*160,1.6,(R()-.5)*120);cam.rotation.set((R()-.5)*.6,R()*Math.PI*2,0,'YXZ');cam.updateMatrixWorld(true);
  const list=drawn(cam),fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));views++;
  for(const st of strips){const exp=new Set();let rr=0,prev=false;for(const c of st.chunks){const u=c.userData.nmChunk;sp.center.copy(u.c);sp.radius=u.r;const vis=c.visible&&fr.intersectsSphere(sp);if(vis){for(let t=c.s;t<c.s+c.n;t+=3)exp.add(t);if(!prev)rr++;chunkN++;}else culled++;prev=vis;}
   const mine=list.filter(d=>d.o.geometry===st.geometry),got=new Set();for(const d of mine)for(let t=d.s;t<d.e;t+=3){assert(!got.has(t),'a triangle drawn twice');got.add(t);}
   assert.equal(mine.length,rr,'one draw per run of consecutive visible chunks');assert.equal(got.size,exp.size,'drawn triangles != visible chunks');for(const t of exp)assert(got.has(t),'a visible chunk was not drawn');runs+=rr;}}
 assert(culled>0,'no chunk ever culled: the test scene does not exercise culling');
 console.log('nmRuns:',views,'views, avg',(runs/views).toFixed(1),'draws for',(chunkN/views).toFixed(1),'visible strip chunks,',(culled/views).toFixed(1),'culled');}
// no index copy kept: after the upload drops the strip's index array, its chunks hold nothing
{const st=strips[0],c=st.chunks[0];assert(c.geometry.index.array&&c.geometry.index.array.length===c.n);st.geometry.index.array=null;assert.equal(c.geometry.index.array,null,'strip chunk keeps its own copy of the index');}
console.log('test_map_strips OK: strips',strips.length,'chunks',chunks.length,'span',NM_STRIP.span,'m');
