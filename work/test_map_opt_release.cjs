// nmOptimizeScene load memory (iOS map-prepare kill 2026-11-03: nmOptimizeScene +318 MB RSS, the source geometry and the chunks
// built from it all alive until the end). Each merged source mesh is released (removed, geometry disposed, its attribute /
// index arrays dropped) right after the LAST chunk that copies from it is built, and a strip's chunk geometries drop their
// arrays once copied into the strip. The chunks must be bit-identical.
// Runs the runtime's own functions on a seeded synthetic scene with three.js, plain path and strip path:
//  1. output: sha256 of every output geometry (chunk meshes, strip geometries, kept whole meshes: every attribute array and
//     index, in scene order) equals the hash recorded from the runtime before the change (b894643);
//  2. timing: some source geometries are disposed before the last chunk is built (each one only after its last chunk), and a
//     released source keeps no attribute / index array; a mesh kept whole, or whose geometry another mesh shares, is not
//     released early;
//  3. the generated page carries the runtime.
// RUNTIME=<file> runs it against another runtime (red on b894643: nothing released before the last chunk).
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),src=fs.readFileSync(process.env.RUNTIME||path.join(__dirname,'native_maps_runtime.js'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const fn=n=>{let i=src.indexOf('\nfunction '+n+'(');if(i<0)return '';i++;const re=/\n(?:function |async function |var |\/\/ |\(window|if\(typeof)/g;re.lastIndex=i+1;const m=re.exec(src);return src.slice(i,m?m.index:src.length);};
const val=n=>eval('('+src.match(new RegExp('var '+n+'=(\\{[^}]*\\})'))[1]+')');
const NM_SMALL=val('NM_SMALL'),NM_STRIP=val('NM_STRIP');
const NAMES=['nmDetailDistance','nmChunkPlan','nmSpanOver','nmMatKey','nmSphere','nmCentroids','nmGather','nmOffset','nmCopy3','nmCopy2','nmCopyN','nmSmallDist','nmDetailSplit','nmOptLast','nmOptRelease','nmOptimizeScene','nmStrips','nmStripBuild','nmStripChunk','nmRunRange','nmRunReset'];
const NM_OPT={ratio:1,minPiece:2000};
const build=strip=>{const body=NAMES.map(fn).join('\n');return new Function('THREE','NM_OPT','NM_SMALL','NM_STRIP','nmQuality','NM','var NM_RF=null;\n'+(strip?body.replace('nmChunkPlan(items,arr?','nmChunkPlan(items,true?').replace('{total:NM_ARR.chunks,smallPiece:NM_ARR.smallPiece}','{}'):body)+'\nreturn nmOptimizeScene;')(THREE,NM_OPT,NM_SMALL,Object.assign({},NM_STRIP,{on:strip}),()=>'high',{});};
function scene(){let seed=9;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const mat=(name,extra={})=>new THREE.MeshLambertMaterial(Object.assign({name,map:new THREE.Texture(),side:THREE.DoubleSide},extra));
 const mesh=(name,m,n,sx,sz,cx=0,cz=0,g0)=>{if(g0){const o=new THREE.Mesh(g0,m);o.name=name;return o;}const P=[],N=[],U=[],I=[];for(let t=0;t<n;t++){const x=cx+(R()-.5)*sx,z=cz+(R()-.5)*sz,y=R()*8;for(let k=0;k<3;k++){P.push(x+R()*.8,y+R()*.8,z+R()*.8);N.push(0,1,0);U.push(R(),R());I.push(t*3+k);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(new THREE.BufferAttribute(new Uint32Array(I),1));const o=new THREE.Mesh(g,m);o.name=name;return o;};
 const s=new THREE.Group(),wall=mat('Stone_M6_LargeBricks_MI'),frame=mat('Metal_M1_WindowFrameKit_MI'),fern=mat('Plant_3_M0_Fern_MI',{alphaTest:.45}),glass=mat('Glass_M0_Window_MI',{transparent:true,opacity:.4}),sign=mat('Sign_0_M0_Kit_MI'),crate=mat('Crate_0_M0_MI');fern.userData.cutout=true;
 const w2=mesh('wall2',wall,30000,90,70,40,30),shared=mesh('crateA',crate,800,4,4,-30,10);
 s.add(mesh('wall',wall,60000,160,120),mesh('frame',frame,24000,170,130),w2,mesh('fern',fern,9000,150,110),mesh('glass',glass,6000,150,110),mesh('sign',sign,150,3,3,20,20),shared,mesh('crateB',crate,0,0,0,0,0,shared.geometry));return s;}
const H=g=>{const h=crypto.createHash('sha256');for(const k of Object.keys(g.attributes).sort()){const a=g.attributes[k].array;h.update(k);h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}if(g.index){const a=g.index.array;h.update('i');h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}return h.digest('hex');};
const EXPECT={plain:'498bc0d21f69acba10bb84437446aff896c56e0dcde88b996cba3a81de604a9a',strip:'2cf4a40f3663cfa60f0e578e586331fc7aac5ba84a478b2df3829ee95c3aec41'};
const out={};let early=0;
for(const strip of [false,true]){const tag=strip?'strip':'plain',s=scene(),src0=[];s.traverse(o=>{if(o.isMesh)src0.push(o);});
 const made=[],disp=new Map(),orig=THREE.BufferGeometry.prototype.dispose,MC=THREE.Mesh;let chunksBuilt=0;
 const srcGeo=new Set(src0.map(o=>o.geometry));THREE.BufferGeometry.prototype.dispose=function(){if(srcGeo.has(this)&&!disp.has(this))disp.set(this,chunksBuilt);return orig.apply(this,arguments);};
 const seen=new Set();const ctr=new Proxy(MC,{construct(T,a){const m=Reflect.construct(T,a);if(a[0]&&!srcGeo.has(a[0])&&!seen.has(a[0])&&a[0].index&&a[0].index.count>3){seen.add(a[0]);chunksBuilt++;}return m;}});
 THREE.Mesh=ctr;let r;try{r=build(strip)(s);}finally{THREE.Mesh=MC;THREE.BufferGeometry.prototype.dispose=orig;}
 // 1. output hash
 const h=crypto.createHash('sha256'),gs=new Set();s.traverse(o=>{if(o.isMesh&&o.geometry&&!gs.has(o.geometry)){gs.add(o.geometry);h.update(o.name+'|'+H(o.geometry)+'\n');}});for(const st of s.userData.nmStrips||[])if(!gs.has(st.geometry)){gs.add(st.geometry);h.update('strip|'+H(st.geometry)+'\n');}
 out[tag]=h.digest('hex');
 // 2. release timing
 const nChunks=chunksBuilt-r.strips/* each strip geometry is built after every chunk */,before=[...disp.values()].filter(v=>v<nChunks).length;early+=before;
 const crates=src0.filter(o=>/crate/.test(o.name));
 for(const o of src0){if(o.parent===s&&!o.userData.nmReleased)continue;if(o.userData.nmReleased){assert.equal(Object.keys(o.geometry.attributes).length,0,tag+': '+o.name+' released but keeps attributes');assert.equal(o.geometry.index,null,tag+': '+o.name+' keeps its index');assert(!crates.includes(o),tag+': a shared geometry released early');}}
 console.log(`  ${tag}: ${r.chunks} chunks, ${r.strips} strips; ${disp.size} source geometries disposed, ${before} of them before the last chunk was built; output ${out[tag].slice(0,16)}`);
 if(!process.env.RUNTIME||process.env.EXPECT_CHECK)assert.equal(out[tag],EXPECT[tag],tag+': chunk geometry differs from the runtime before the change');}
if(process.env.PRINT){console.log(JSON.stringify(out));process.exit(0);}
assert(early>0,'no source geometry released before the last chunk was built');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(html.includes(fn('nmOptRelease').trim())&&html.includes(fn('nmOptimizeScene').trim()),'generated page lacks the runtime (python3 work/install_valorant.py)');
console.log('nmOptimizeScene releases each source mesh after its last chunk (and strip chunks once copied); chunk geometry bit-identical to b894643');
