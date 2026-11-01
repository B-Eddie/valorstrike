// Native-map render optimizer (map perf): identical converted materials are shared, big material groups are re-cut
// into spatial pieces (nmChunkPlan: a draw-object budget of ratio x source meshes, pieces >= minPiece triangles, split
// by triangle-centroid median along the longer axis) so three's frustum culling works, small groups stay whole,
// foliage cut-outs/decals get a draw distance re-tested only after the camera moves 2 m, and textures used only by
// decals or by materials under 300 triangles are capped at 256 px.
// Checks run the runtime's own functions (work/native_maps_runtime.js) on a synthetic scene with three.js:
//  - every source triangle (position+normal+uv of its three corners) is in the output exactly once, nothing extra
//  - equal materials are one instance; different ones stay apart; duplicates are disposed
//  - the object budget holds (never more draw objects than ratio x source meshes) and pieces are spatially compact
//  - nmCull: detail chunks beyond their distance hidden, near ones shown, others always shown; no work under 2 m moves
//  - loader wiring (runtime and generated page): optimize after prepare + z-fight fix, before the budget, also on rehydrate
//  - shipped plan settings: NM_OPT ratio <= 0.9 (ratio 1 measured Haven's worst view above the source)
//  - nmBudget caps small/decal-only textures at 256 px even with no tier cap, keeps big shared ones
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),src=fs.readFileSync(process.env.RUNTIME||path.join(__dirname,'native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const pick=n=>{const i=src.indexOf('function '+n+'(');assert(i>=0,n+' missing');return src.slice(i,src.indexOf('\n',i));};
const block=n=>{let i=src.indexOf('async function '+n+'(');if(i<0)i=src.indexOf('function '+n+'(');let j=src.indexOf('\nfunction ',i+1),k=src.indexOf('\nasync function ',i+1);if(k>0&&k<j)j=k;return src.slice(i,j);};
for(const s of [src,html]){
 assert(/const t0=nmNow\(\);nmPrepareScene\(gl\.scene\);nmZFixApply\(gl\.scene,key\);const mapOpt=nmOptimizeScene\(gl\.scene\);[^\n]*const mem=await nmBudget\(gl\.scene,nmTexCap\(\)\);/.test(s),'loader does not optimize between prepare/z-fix and budget');
 assert(s.includes('nmPrepareScene(gl.scene);nmZFixApply(gl.scene,key);const opt=nmOptimizeScene(gl.scene);const mem=await nmBudget(gl.scene,nmTexCap());'),'rehydrate does not optimize');
 assert(/var NM_OPT=\{ratio:(0?\.\d+),minPiece:\d+\};/.test(s)&&+s.match(/var NM_OPT=\{ratio:(0?\.\d+)/)[1]<=.9,'NM_OPT ratio must stay <= 0.9');
 assert(s.includes("scene.onBeforeRender=function(r,s,cam){try{const C=NM.current;if(C&&C.M.g.visible){nmCull(C,cam);nmRuns(C,cam);}}"),"cull hook missing");}
const NM_OPT={ratio:2,minPiece:2000};// synthetic scene is small: give the planner room to split
const NM_SMALL=eval('('+src.match(/var NM_SMALL=(\{[^}]*\})/)[1]+')');let GQ='medium';const nmQuality=()=>GQ;// the small-prop split is off without a detail table (this synthetic scene has none): test_map_detail.cjs covers it
// NM_STRIP off here: this checks the plain chunk invariants (one mesh per chunk); test_map_strips.cjs covers the strips
const NM_STRIP={on:false};
const api=new Function('THREE','NM_OPT','NM_SMALL','nmQuality','NM_STRIP',['nmDetailDistance','nmChunkPlan','nmSpanOver','nmMatKey','nmCull','nmSphere','nmCentroids','nmGather','nmOffset','nmCopy3','nmCopy2','nmCopyN','nmSmallDist','nmDetailSplit','nmStripChunk','nmRunRange','nmRunReset'].map(pick).join('\n')+'\n'+block('nmOptimizeScene')+'\n'+block('nmStrips')+'\n'+block('nmStripBuild')+'\nreturn {nmDetailDistance,nmChunkPlan,nmMatKey,nmOptimizeScene,nmCull};')(THREE,NM_OPT,NM_SMALL,nmQuality,NM_STRIP);
// synthetic scene: one mesh per source material, like scene.gltf
let seed=5;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const tex=new THREE.Texture(),tex2=new THREE.Texture();
const mat=(name,map,extra={})=>{const m=new THREE.MeshLambertMaterial(Object.assign({name,map,side:THREE.DoubleSide},extra));return m;};
function mesh(name,m,n,spread,cx=0,cz=0){const P=[],N=[],U=[],I=[];for(let t=0;t<n;t++){const x=cx+(R()-.5)*spread,z=cz+(R()-.5)*spread,y=R()*10;for(let k=0;k<3;k++){P.push(x+R(),y+R(),z+R());N.push(0,1,0);U.push(R(),R());I.push(t*3+k);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(new THREE.BufferAttribute(new Uint32Array(I),1));const o=new THREE.Mesh(g,m);o.name=name;return o;}
const scene=new THREE.Group();
const bricksA=mat('Stone_M6_LargeBricks_MI',tex),bricksB=mat('Stone_M6_LargeBricks_MI_2',tex);// same look -> shared
const fern=mat('Plant_3_M0_Fern_MI',tex2,{alphaTest:.45});fern.userData.cutout=true;
const decal=mat('Decal_Grime_MI',tex2,{transparent:true,depthWrite:false});decal.userData.decal='decal';
const prop=mat('Sign_0_M0_Kit_MI',tex2);
scene.add(mesh('a',bricksA,30000,200),mesh('b',bricksB,9000,200),mesh('c',fern,3000,40),mesh('c2',fern,3000,40,400,400),mesh('d',decal,500,100),mesh('e',prop,120,4,30,30));
const before=[];scene.traverse(o=>{if(o.isMesh)before.push(o);});
const key=(P,N,U,i)=>[P[i*3],P[i*3+1],P[i*3+2],N[i*3+1],U[i*2],U[i*2+1]].map(v=>v.toFixed(5)).join(',');
const triSet=list=>{const out=new Map();for(const o of list){const g=o.geometry,P=g.attributes.position.array,N=g.attributes.normal.array,U=g.attributes.uv.array,I=g.index.array;for(let t=0;t<I.length;t+=3){const k=o.material.name.replace(/_\d+$/,'')+'|'+[0,1,2].map(j=>key(P,N,U,I[t+j])).join('|');out.set(k,(out.get(k)||0)+1);}}return out;};
const want=triSet(before);let disposed=0;bricksB.addEventListener('dispose',()=>disposed++);
const r=api.nmOptimizeScene(scene);const chunks=scene.userData.nmChunks;
assert.equal(r.meshes,6);assert.equal(r.materials,4,'bricks share one material');assert.equal(disposed,1,'duplicate material disposed');
const after=[];scene.traverse(o=>{if(o.isMesh)after.push(o);});assert.equal(after.length,chunks.length);assert(after.filter(o=>before.includes(o)).every(o=>!/LargeBricks|Fern/.test(o.material.name)),'split source meshes removed');assert(after.some(o=>o.name==='e'),'a whole small mesh is reused, not copied');
const got=triSet(after);assert.equal(got.size,want.size,'same distinct triangles');for(const [k,n] of want)assert.equal(got.get(k),n,'triangle kept exactly once');
// sharing and sizes
const brick=chunks.filter(o=>/LargeBricks/.test(o.name));assert(brick.length>1,'large group split');assert(brick.every(o=>o.material===brick[0].material));
assert(chunks.length<=Math.floor(6*NM_OPT.ratio),'object budget: '+chunks.length);for(const o of brick)assert(o.geometry.index.count/3>=NM_OPT.minPiece,'piece not below minPiece');
const small=chunks.filter(o=>o.material.name==='Sign_0_M0_Kit_MI');assert.equal(small.length,1,'small group stays one object');assert.equal(small[0].userData.nmChunk.maxDist,0);
assert(chunks.filter(o=>/Fern/.test(o.name)).every(o=>o.userData.nmChunk.maxDist===70),'foliage: 70 m');
assert(chunks.filter(o=>/Decal/.test(o.name)).every(o=>o.userData.nmChunk.maxDist===45),'decals: 45 m');
assert.equal(bricksA.userData.nmTris,39000,'material triangle total recorded');
// pieces are spatially compact: split pieces of one group cover less ground than the whole group
{const ext=list=>{let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const o of list){const P=o.geometry.attributes.position.array;for(let i=0;i<P.length;i+=3){x0=Math.min(x0,P[i]);x1=Math.max(x1,P[i]);z0=Math.min(z0,P[i+2]);z1=Math.max(z1,P[i+2]);}}return (x1-x0)*(z1-z0);};const whole=ext(brick);for(const o of brick)assert(ext([o])<whole*.75,'split piece is smaller than its group');}
// culling
const C={scene,cullAt:null},cam={position:new THREE.Vector3(0,1.6,0)};api.nmCull(C,cam);
const fernC=chunks.filter(o=>/Fern/.test(o.name)),far=fernC.filter(o=>{const u=o.userData.nmChunk;return u.c.distanceTo(cam.position)-u.r>70;}),near=fernC.filter(o=>!far.includes(o));
assert(far.length&&near.length,'test scene has near and far foliage');assert(far.every(o=>!o.visible)&&near.every(o=>o.visible),'foliage draw distance');assert(brick.every(o=>o.visible),'structure always drawn (frustum culling only)');
const at=C.cullAt;cam.position.x+=1;api.nmCull(C,cam);assert.equal(C.cullAt,at,'no re-test under 2 m');cam.position.x+=200;api.nmCull(C,cam);assert.notEqual(C.cullAt,at,'re-test after moving');
// budget: decal/small-material textures capped at 256 px with no tier cap
(async()=>{const env={THREE,uploads:[],nmTexBytes:(w,h,m)=>w*h*4*(m?4/3:1),nmPackGeometry:g=>[0,0],nmTexUploaded(){},nmShrink:async(img,c)=>({width:Math.round(img.width*c/Math.max(img.width,img.height)),height:Math.round(img.height*c/Math.max(img.width,img.height))})};
 const budget=new Function('env','with(env){'+block('nmBudget')+';return nmBudget;}')(env);
 const big=new THREE.Texture({width:512,height:512}),tiny=new THREE.Texture({width:512,height:512}),dec=new THREE.Texture({width:512,height:256});
 const g=new THREE.Group(),m1=mat('Wall',big),m2=mat('Sign',tiny),m3=mat('Decal_x',dec),m4=mat('Sign2',big);m1.userData.nmTris=50000;m2.userData.nmTris=120;m3.userData.decal='decal';m3.userData.nmTris=9000;m4.userData.nmTris=50;
 for(const m of [m1,m2,m3,m4])g.add(new THREE.Mesh(new THREE.BufferGeometry(),m));
 const mem=await budget(g,0);assert.equal(big.source.data.width,512,'texture shared with a big material keeps its size');assert.equal(tiny.source.data.width,256,'small-material texture capped');assert.deepEqual([dec.source.data.width,dec.source.data.height],[256,128],'decal texture capped');assert.equal(mem.smallCapped,2);
 const lowTex=new THREE.Texture({width:512,height:512}),g2=new THREE.Group(),m5=mat('Sign',lowTex);m5.userData.nmTris=10;g2.add(new THREE.Mesh(new THREE.BufferGeometry(),m5));await budget(g2,128);assert.equal(lowTex.source.data.width,128,'a lower tier cap still wins');
 console.log('map optimizer: '+r.meshes+' meshes -> '+r.chunks+' chunks, '+r.materials+' materials; triangles preserved; detail culling; small-texture cap');})().catch(e=>{console.error(e);process.exit(1);});
