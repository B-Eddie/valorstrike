// Map draw-call budget (user, 28 Oct 2026: "fix the lag. im always around 30fps and 600 calls").
// Root cause: every native-map material owns its own texture (Ascent 479 materials / 373 textures), so the chunk plan
// (NM_OPT) could never merge two materials and a frame submitted one draw per visible material chunk: offline model
// Ascent 299 calls average / 453 worst (HIGH, before the small-prop pieces LOW / MEDIUM add), ~430 chunk objects.
// Fix (work/native_maps_runtime.js NM_ARR / nmArrayScene): on WebGL2 the opaque and cut-out materials are re-bound to
// texture arrays (one TEXTURE_2D_ARRAY per texture size, a palette texel per material: colour + layer), so materials
// differ only by GL state and the plan cuts the few dozen groups into NM_ARR.chunks spatial chunks.
// Checks:
//  A. runtime on a synthetic scene (three.js, the runtime's own functions, a recording WebGL2 stand-in): arrays per
//     size bucket (rare sizes resampled to their square bucket), every triangle drawn exactly once with its own texture
//     layer and colour (palette), materials shared by GL state only, decal / texture-missing / shared-geometry meshes
//     untouched; nmBudget fits layer images to the array (the LOW cap included) and nmUpload fills each array (sRGB
//     storage, every mip level, one texSubImage3D per layer, mipmaps, images closed, texture handed to three);
//     dispose deletes the GL texture; WebGL1 leaves the scene as it was.
//  B. shader: the replacement hooks exist in the page's three r149 Lambert shader (REAL3_DIR) and the patched shader
//     samples the array with the palette layer; the generated page carries the runtime block.
//  C. BUDGET, offline frame model (server/tools/map-perf.mjs views, three's sphere-frustum test, the runtime's own
//     nmArrSize / nmArrBuckets / nmChunkPlan / NM_ARR, z-fight levels from NM_ZFIX): per map, average and worst-view
//     map draw calls under the ceilings below, and average triangles not above the plan without arrays.
//  MAPS=ascent,... limits part C (default all six); VIEWS (default 16 points x 8 headings).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
assert(/var NM_ARR=\{/.test(src),'runtime has no texture-array plan (NM_ARR): every map material is its own draw call');
// one top-level function (sync or async) up to the next top-level declaration / comment line
const fn=n=>{let i=src.indexOf('\nfunction '+n+'(');if(i<0)i=src.indexOf('\nasync function '+n+'(');assert(i>=0,n+' missing');i++;const re=/\n(?:function |async function |var |\/\/ |\(window)/g;re.lastIndex=i+1;const m=re.exec(src);return src.slice(i,m?m.index:src.length);};
const val=n=>eval('('+src.match(new RegExp('var '+n+'=(\\{[^}]*\\})'))[1]+')');
const NM_ARR=val('NM_ARR'),NM_OPT=val('NM_OPT'),NM_SMALL=val('NM_SMALL');
const NAMES=['nmArrOk','nmArrSize','nmArrBuckets','nmArrState','nmArrEligible','nmArrShader','nmArrMaterial','nmArrayScene','nmArrDispose','nmArrUpload','nmArrFit','nmMatKey','nmDetailDistance','nmChunkPlan','nmCentroids','nmSphere','nmGather','nmOffset','nmCopy3','nmCopy2','nmCopyN','nmSmallDist','nmDetailSplit','nmOptimizeScene','nmBytes','nmTexBytes','nmDropArray','nmTexUploaded','nmShrink','nmPackGeometry','nmBudget','nmUpload'];
function api(renderer,cap){return new Function('THREE','NM_ARR','NM_OPT','NM_SMALL','renderer','nmQuality','nmTexCap','createImageBitmap','document',NAMES.map(fn).join('\n')+'\nreturn {'+NAMES.join(',')+'};')(THREE,NM_ARR,NM_OPT,NM_SMALL,renderer,()=>'high',()=>cap,async(img,o)=>fakeImage(o.resizeWidth,o.resizeHeight,img.tag+'>'+o.resizeWidth+'x'+o.resizeHeight),undefined);}
function fakeImage(w,h,tag){return {width:w,height:h,tag,closed:false,close(){this.closed=true;}};}
function fakeGL(){const C={TEXTURE_2D_ARRAY:35866,SRGB8_ALPHA8:35907,RGBA8:32856,RGBA:6408,UNSIGNED_BYTE:5121,UNPACK_FLIP_Y_WEBGL:37440,UNPACK_PREMULTIPLY_ALPHA_WEBGL:37441,UNPACK_ALIGNMENT:3317,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,LINEAR:9729,LINEAR_MIPMAP_LINEAR:9987,REPEAT:10497,MAX_ARRAY_TEXTURE_LAYERS:35071};
 const log=[];let n=0;const gl=Object.assign({},C,{log,deleted:[],getParameter:p=>p===C.MAX_ARRAY_TEXTURE_LAYERS?2048:0,createTexture:()=>({id:++n}),bindTexture:(t,x)=>log.push(['bind',x&&x.id]),texStorage3D:(...a)=>log.push(['storage',...a]),texSubImage3D:(...a)=>log.push(['sub',a[4],a[5],a[6],a[10]]),pixelStorei:(k,v)=>log.push(['px',k,v]),generateMipmap:t=>log.push(['mip',t]),texParameteri:(...a)=>log.push(['param',...a]),texParameterf:()=>{},deleteTexture:t=>gl.deleted.push(t.id)});return gl;}
function fakeRenderer(webgl2){const gl=fakeGL(),props=new WeakMap();return {gl,uploads:[],capabilities:{isWebGL2:webgl2,getMaxAnisotropy:()=>16},properties:{get:o=>{let p=props.get(o);if(!p)props.set(o,p={});return p;}},extensions:{has:()=>false},resetState(){},initTexture(t){this.uploads.push(t);},getContext(){return gl;}};}
// ---- A. synthetic scene
function scene(){let seed=5;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const g=new THREE.Group(),tex=[],meta=[];
 const sizes=[];for(let i=0;i<14;i++)sizes.push([512,512]);for(let i=0;i<7;i++)sizes.push([256,256]);sizes.push([512,256],[256,512],[64,64]);/* 512x256 / 256x512 / 64x64: fewer than minExact -> square buckets */
 sizes.forEach(([w,h],i)=>{const t=new THREE.Texture(fakeImage(w,h,'t'+i));t.flipY=false;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.encoding=THREE.sRGBEncoding!==undefined?THREE.sRGBEncoding:3001;if('colorSpace' in t&&THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;tex.push(t);});
 const mesh=(mat,x,z,tris,geo)=>{if(!geo){const P=[],U=[],I=[];for(let k=0;k<tris;k++){const bx=x+R()*20,bz=z+R()*20,y=R()*5;for(let j=0;j<3;j++){P.push(bx+R()*2,y+R(),bz+R()*2);U.push(R(),R());}I.push(k*3,k*3+1,k*3+2);}geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(P),3));geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(P.length).fill(.577),3));geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(U),2));geo.setIndex(new THREE.BufferAttribute(new Uint32Array(I),1));}const o=new THREE.Mesh(geo,mat);g.add(o);return o;};
 const lam=(t,c,extra)=>{const m=new THREE.MeshLambertMaterial(Object.assign({name:'Wall_'+(t?t.image.tag:'none')+'_'+c,map:t||null,color:c,side:THREE.DoubleSide},extra||{}));return m;};
 const kinds=[];for(let i=0;i<sizes.length;i++){const c=[0xffffff,0xe0e0e0,0x998877][i%3],m=lam(tex[i],c,i%5===3?{alphaTest:.45}:i%7===2?{polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-8}:{});if(i%5===3)m.userData.cutout=true;if(i%7===2)m.userData.zLayer=2;kinds.push(m);}
 const meshes=[];for(let i=0;i<60;i++){const m=kinds[i%kinds.length],o=mesh(m,(i%10)*40-200,Math.floor(i/10)*40-120,130+Math.floor(R()*60));meshes.push(o);meta.push({o,src:m.map.source,color:m.color.clone(),arrayed:true});}
 // untouched: a decal (blended), a texture-missing cut-out, two meshes sharing one geometry, an untextured mesh
 const dt=tex[0].clone();dt.source=new THREE.Source(fakeImage(256,256,'decal'));const dec=lam(dt,0xffffff,{transparent:true,depthWrite:false});/* own source (a source shared with a blended material is not arrayed: checked by tex[1]) */dec.userData.decal='decal';const dm=mesh(dec,0,0,8);
 const miss=lam(null,0xffffff,{alphaTest:.45});miss.userData.nmTexMissing=true;miss.visible=false;const mm=mesh(miss,10,10,8);
 const sh=lam(tex[1],0x808080),s1=mesh(sh,30,30,8),s2=mesh(sh,60,60,0,s1.geometry);/* tex[1] is also used by plain meshes: a shared source is not arrayed at all */
 const un=lam(null,0xff0000),um=mesh(un,90,90,8);
 return {g,tex,meta,meshes,kept:[dm,mm,s1,s2,um],sharedSrc:tex[1].source};}
const sig=(P,U,a,b,c,extra)=>[a,b,c].map(v=>[P[v*3],P[v*3+1],P[v*3+2],U[v*2],U[v*2+1]].map(x=>x.toFixed(4)).join(',')).join(';')+'|'+extra;
(async()=>{
{const r=fakeRenderer(true),A=api(r,0),S=scene();const want=new Map();
 for(const q of S.meta){const g=q.o.geometry,P=g.attributes.position.array,U=g.attributes.uv.array,I=g.index.array;for(let t=0;t<I.length;t+=3){const s=sig(P,U,I[t],I[t+1],I[t+2],q.src===S.sharedSrc?'plain':q.src.data.tag+'#'+q.color.getHexString());want.set(s,(want.get(s)||0)+1);}}
 for(const o of [S.kept[2],S.kept[3]]){const g=o.geometry,P=g.attributes.position.array,U=g.attributes.uv.array,I=g.index.array;for(let t=0;t<I.length;t+=3){const s=sig(P,U,I[t],I[t+1],I[t+2],'plain');want.set(s,(want.get(s)||0)+1);}}
 const keptMats=S.kept.map(o=>o.material);
 const opt=A.nmOptimizeScene(S.g);assert(opt.arrays,'nmOptimizeScene did not build texture arrays on WebGL2');
 const srcCount=new Set(S.meta.filter(q=>q.src!==S.sharedSrc).map(q=>q.src)).size;assert.equal(opt.arrays.layers,srcCount,'every eligible texture is one layer');
 assert.equal(opt.arrays.arrays,3,'buckets: 512x512 (+512x256 / 256x512 resampled), 256x256, 64x64');
 const chunks=S.g.userData.nmChunks,got=new Map(),arrMats=new Set();let arrays=new Set();
 for(const o of chunks){const g=o.geometry,P=g.attributes.position.array,U=g.attributes.uv.array,I=g.index.array,m=o.material;if(!m.nmArrTex){continue;}arrMats.add(m);arrays.add(m.nmArrTex);
  assert(g.attributes.nmM,'arrayed chunk without palette index');const M=g.attributes.nmM.array,pal=m.nmPalTex.image.data,L=m.nmArrTex.userData.nmLayers;
  for(let t=0;t<I.length;t+=3){const pi=M[I[t]];assert(M[I[t+1]]===pi&&M[I[t+2]]===pi,'palette index varies inside a triangle');const layer=pal[pi*4+3],col=new THREE.Color(pal[pi*4],pal[pi*4+1],pal[pi*4+2]);const s=sig(P,U,I[t],I[t+1],I[t+2],L[layer].source.data.tag+'#'+col.getHexString());got.set(s,(got.get(s)||0)+1);}}
 for(const o of chunks){const m=o.material;if(m.nmArrTex)continue;const g=o.geometry,P=g.attributes.position.array,U=g.attributes.uv.array,I=g.index.array;if(m.map&&m.map.source===S.sharedSrc&&!m.transparent)for(let t=0;t<I.length;t+=3){const s=sig(P,U,I[t],I[t+1],I[t+2],'plain');got.set(s,(got.get(s)||0)+1);}}
 for(const [s,n] of want)assert.equal(got.get(s)||0,n,'triangle lost / duplicated / wrong layer or colour: '+s.slice(0,80));
 assert.equal([...got.values()].reduce((a,b)=>a+b,0),[...want.values()].reduce((a,b)=>a+b,0),'extra triangles');
 const states=new Set(S.meta.filter(q=>q.src!==S.sharedSrc).map(q=>{const m=S.meta.find(x=>x.o===q.o);return q.src.data.width+'x'+q.src.data.height+'/'+q.o.userData.nmSrcName;}));
 const keys=new Set([...arrMats].map(m=>m.userData.nmArrK));assert.equal(keys.size,arrMats.size,'two materials with one state on one array');
 assert(arrMats.size<=3*3,'materials are shared by array + GL state only ('+arrMats.size+')');
 for(const m of arrMats){assert(m.userData.nmArrK.split('#')[1].split('|')[5]==='1'?m.alphaTest===.45:true,'cut-out state lost');assert(m.map===null&&m.defines.USE_UV==='','array material keeps a 2D map or lacks uvs');}
 assert(arrMats.size>=4,'cut-out / polygon-offset states were merged with plain ones');
 for(const m of keptMats){assert(!m.nmArrTex,'decal / missing / shared / untextured material was arrayed');}
 for(const o of S.kept)assert(!o.geometry.attributes.nmM,'kept mesh got a palette attribute');
 // budget at the LOW cap: 512 layers -> 256, the arrays and the palette queued for upload
 const r2=fakeRenderer(true),A2=api(r2,256),S2=scene(),orig=S2.tex.filter(t=>t.source!==S2.sharedSrc).map(t=>t.image);A2.nmOptimizeScene(S2.g);const mem=await A2.nmBudget(S2.g,256);
 const arrs=mem.textures.filter(t=>t.isDataArrayTexture);assert.equal(arrs.length,2,"LOW cap: 512 textures join the 256 array");assert.equal(mem.arrays,2);assert(mem.textures.some(t=>t.userData.nmArrPal),'palette not uploaded');
 for(const t of arrs){const W=t.image.width,H=t.image.height;assert(W<=256&&H<=256,'LOW cap ignored by the arrays');for(const q of t.userData.nmLayers){assert(q.image&&q.image.width===W&&q.image.height===H,'layer image not fitted to its array');}}

 await A2.nmUpload(mem.textures,()=>true);const gl=r2.gl,st=gl.log.filter(e=>e[0]==='storage'),sub=gl.log.filter(e=>e[0]==='sub');
 assert.equal(st.length,2,"one storage per array");for(const e of st){assert.equal(e[3],gl.SRGB8_ALPHA8,'sRGB textures must keep sRGB decode');assert.equal(e[2],Math.floor(Math.log2(Math.max(e[4],e[5])))+1,'mip levels');}
 assert.equal(sub.length,arrs.reduce((a,t)=>a+t.image.depth,0),'one layer upload per texture');assert.equal(gl.log.filter(e=>e[0]==="mip").length,2,"mipmaps");
 assert(gl.log.some(e=>e[0]==='param'&&e[2]===gl.TEXTURE_WRAP_S&&e[3]===gl.REPEAT)&&gl.log.some(e=>e[0]==='param'&&e[2]===gl.TEXTURE_MIN_FILTER&&e[3]===gl.LINEAR_MIPMAP_LINEAR),'sampler state differs from the 2D textures');
 assert(gl.log.some(e=>e[0]==='px'&&e[1]===gl.UNPACK_FLIP_Y_WEBGL&&e[2]===false),'flipY');
 for(const t of arrs){assert(r2.properties.get(t).__webglTexture,'array not handed to three');assert.equal(t.version,0,'three would re-upload an empty array');assert.equal(t.userData.nmLayers,null);}
 for(const im of orig)assert(im.closed,'decoded image survives the array upload');
 const del=gl.deleted.length;for(const t of arrs)t.dispose();assert.equal(gl.deleted.length,del+2,'dispose leaves the GL texture');
 // WebGL1: nothing changes
 const r3=fakeRenderer(false),A3=api(r3,0),S3=scene(),before=new Set();S3.g.traverse(o=>{if(o.isMesh)before.add(o.material);});const o3=A3.nmOptimizeScene(S3.g);assert.equal(o3.arrays,null);S3.g.traverse(o=>{if(o.isMesh){assert(!o.material.nmArrTex);assert(!o.geometry.attributes.nmM);}});
 // groundblend: a ground layer (nmGroundApply: userData.groundLayer, its own onBeforeCompile reading the map's alpha) and
 // any other material with its own onBeforeCompile keep their material on the WebGL2 array path - an array material would
 // replace their shader (the ground drew as a flat colour again) - and their source is not arrayed for anyone
 {const r4=fakeRenderer(true),A4=api(r4,0),S4=scene(),G=new Function('THREE',[...(src.match(/^var NM_GROUND\w*=.*$/mg)||[]),fn('nmGroundLayer'),fn('nmGroundApply')].join('\n')+'\nreturn nmGroundApply;')(THREE);
  const mk=tag=>{const t=S4.tex[2].clone();t.source=new THREE.Source(fakeImage(512,512,tag));return t;};
  const gm=G(new THREE.MeshLambertMaterial({name:'Grass_M0_Dirtblend_A',map:mk('ground'),side:THREE.DoubleSide}),'Grass_M0_Dirtblend_A',{lum:2,alpha:40,am:120});
  assert(gm.userData.groundLayer&&Object.prototype.hasOwnProperty.call(gm,'onBeforeCompile'),'nmGroundApply did not make a ground layer');
  const cm=new THREE.MeshLambertMaterial({name:'Custom_M0',map:mk('custom'),side:THREE.DoubleSide});cm.onBeforeCompile=sh=>{sh.fragmentShader='/*custom*/\n'+sh.fragmentShader;};
  const sm=new THREE.MeshLambertMaterial({name:'Wall_sharesground',map:gm.map,side:THREE.DoubleSide});/* a plain material on the ground layer's texture */
  assert.equal(A4.nmArrEligible(gm),false,'a ground layer (userData.groundLayer) is texture-array eligible: merged into an array it loses its blend shader');
  assert.equal(A4.nmArrEligible(cm),false,'a material with its own onBeforeCompile is texture-array eligible: the array shader replaces it');
  const tri=(m,x)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([x,0,0,x+1,0,0,x,0,1,x+1,0,1]),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(12).fill(.577),3));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array([0,0,1,0,0,1,1,1]),2));g.setIndex(new THREE.BufferAttribute(new Uint32Array([0,1,2,1,3,2]),1));const o=new THREE.Mesh(g,m);S4.g.add(o);return o;};
  tri(gm,500);tri(gm,510);tri(cm,520);tri(sm,530);
  const o4=A4.nmOptimizeScene(S4.g);assert(o4.arrays,'arrays still built for the rest of the scene');
  const ch=S4.g.userData.nmChunks,by=m=>ch.filter(o=>o.material===m);
  for(const [m,n,what] of [[gm,4,'ground layer'],[cm,2,'custom-shader material'],[sm,2,'plain material on the ground layer texture']]){const c=by(m);assert(c.length>0,what+' was re-bound to a texture-array material');
   assert.equal(c.reduce((a,o)=>a+o.geometry.index.count/3,0),n,what+' triangles lost / duplicated');for(const o of c)assert(!o.geometry.attributes.nmM,what+' got a palette attribute');}
  assert(ch.every(o=>!o.material.nmArrTex||!o.material.userData.groundLayer),'array material carries a ground layer');
  const sh={vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader,uniforms:{}};by(gm)[0].material.onBeforeCompile(sh,{});assert(/texture2D\(map,[^;]*\)\.a/.test(sh.fragmentShader)&&sh.uniforms.gbAm,'ground layer chunk lost its blend shader');
  console.log('A ok: ground layer / custom shader kept off the arrays (',by(gm).length+by(cm).length+by(sm).length,'chunks )');}
 console.log('A ok: arrays',opt.arrays,'chunks',opt.chunks,'materials',arrMats.size);}
// ---- B. shader + page
{const d=process.env.REAL3_DIR||'/workspace/work/qa',f=path.join(d,'three.min.js');let T=null;if(!process.env.QA_THREE160&&fs.existsSync(f)){const ctx={self:{},window:{},console};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(f,'utf8'),ctx);T=ctx.THREE||ctx.self.THREE||ctx.window.THREE;}
 if(T&&T.REVISION==='149'){const L=T.ShaderLib.lambert,sh={vertexShader:L.vertexShader,fragmentShader:L.fragmentShader,uniforms:{}},m={nmArrTex:{a:1},nmPalTex:{p:1}};
  const A=new Function('THREE','NM_ARR',fn('nmArrShader')+';return nmArrShader;')(T,NM_ARR);A.call(m,sh);
  assert(sh.uniforms.nmArr.value===m.nmArrTex&&sh.uniforms.nmPal.value===m.nmPalTex,'uniforms');
  assert(/attribute float nmM;/.test(sh.vertexShader)&&/vNmP=texelFetch\(nmPal/.test(sh.vertexShader),'vertex hook missing (r149 <uv_vertex> / <common>)');
  assert(/texture\(nmArr,vec3\(vUv,vNmP\.a\)\)/.test(sh.fragmentShader)&&!/#include <map_fragment>/.test(sh.fragmentShader),'fragment hook missing');
  assert(/varying vec2 vUv;/.test(T.ShaderChunk.uv_pars_fragment)&&/USE_UV/.test(T.ShaderChunk.uv_pars_fragment)&&/vUv = \( uvTransform/.test(T.ShaderChunk.uv_vertex),'r149 declares vUv under USE_UV');console.log('B ok: r149 shader hooks');}
 else console.log('B: r149 three not found (REAL3_DIR) - shader hook check skipped');
 assert(html.includes('var NM_ARR={')&&html.includes('function nmArrayScene(')&&html.includes('nmArrayScene(root)'),'generated page lacks the texture-array runtime (run work/install_valorant.py)');}
// ---- C. budget (offline frame model)
// Ceilings per map (map draw calls per frame, 16 x 8 views, NM_ARR.chunks 110; measured 29 Oct 2026, ~15% headroom).
// Before (NM_OPT, no arrays) -> after: ascent 299 / 458 worst -> 78 / 99, bind 231 / 368 -> 63 / 89, haven 204 / 305 -> 77 / 110,
// split 306 / 470 -> 81 / 104, lotus 154 / 241 -> 68 / 98, breeze 257 / 448 -> 68 / 98; average triangles down 3-31%.
// groundblend (29 Oct 2026): ground layers (nmGroundApply, own blend shader) stay off the arrays, one group each in the same
// NM_ARR.chunks budget, so the arrayed groups get fewer spatial splits: ascent 78 / 99 -> 80 / 110 calls, average triangles
// 2.86 M -> 3.29 M (+15%, the only map above its no-array plan; split +0.2%). Calls are what the user hit (600 calls, 30 fps);
// giving each ground group its own chunk slot instead costs ascent 105 / 142 calls for 2.90 M triangles. Triangle check:
// average not above the no-array plan by more than TRIS_SLACK.
const TRIS_SLACK=1.2;
const BUDGET={ascent:{avg:92,worst:120},bind:{avg:75,worst:105},haven:{avg:90,worst:128},split:{avg:95,worst:122},lotus:{avg:80,worst:115},breeze:{avg:80,worst:115}};
if(!process.env.VIEWS)process.env.VIEWS='16';
const {loadRender,root:mroot}=await import(path.join(root,'server/tools/map-render.mjs')),{views,count,sphereOf}=await import(path.join(root,'server/tools/map-perf.mjs'));
const B=new Function('NM_SMALL','NM_ARR',['nmDetailDistance','nmChunkPlan','nmCentroids','nmArrSize','nmArrBuckets'].map(fn).join('\n')+'\nreturn {nmDetailDistance,nmChunkPlan,nmArrSize,nmArrBuckets};')(NM_SMALL,NM_ARR);
const GB=new Function([...(src.match(/^var NM_GROUND\w*=.*$/mg)||[]),fn('nmGroundLayer')].join('\n')+'\nreturn {nmGroundLayer};')();
let texRaw=null;const sharp=require(path.join(root,'server/node_modules/sharp')),pageStats=new Function('document',fn('nmTexStats')+';return nmTexStats;')({createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:texRaw})})})});
const texStats=async f=>{texRaw=new Uint8ClampedArray(await sharp(f).ensureAlpha().resize(16,16,{fit:'fill'}).raw().toBuffer());return pageStats({width:16});};
const ZF=JSON.parse(src.match(/var NM_ZFIX=(\{.*?\});\n/s)[1]);
const png=f=>{const b=Buffer.alloc(24),fd=fs.openSync(f,'r');fs.readSync(fd,b,0,24,0);fs.closeSync(fd);return [b.readUInt32BE(16),b.readUInt32BE(20)];};
const FOL=/Plant(?!er)|Vines|Foliage|Leaf|Leaves|Fern|Shrub|Creeper|Bush|MossOvergrowth|Flower|Ivy|Canopy|TreeCard|Conifer|Arborvitae|Palm|Bonsai|Bananna|Agave|Cabbage|Jasmine|Philodendron|MorningGlory|Cables/i,NOFOL=/Blend|Trunk|Bark|Planter|Wall|Floor|Stone|Rock|Tile|Brick|Plaster|Mural|Decal|Floater|Light|Lamp|Glass|Sack|Graffiti|Vista_2_M1/i;
const MAPS=(process.env.MAPS||'ascent,bind,haven,split,lotus,breeze').split(',');const rows=[];
for(const key of MAPS){const R=loadRender(key,{bvh:false}),V=views(key),z=ZF[key]||{o:[]},lv=new Map();z.o.forEach((l,i)=>{for(const n of l)lv.set(n,i+1);});
 const srcs=[],sIx=new Map();for(const p of R.prims)if(p.tex!=null){const s=R.g.textures[p.tex].source;if(!sIx.has(s)){const [w,h]=png(mroot(key)+R.g.images[s].uri),wh=B.nmArrSize(w,h,false,0);sIx.set(s,srcs.length);srcs.push({w:wh[0],h:wh[1],e:1});}}
 const arrays=B.nmArrBuckets(srcs,NM_ARR.minExact,NM_ARR.layers),arrOf=new Map();arrays.forEach((a,ai)=>a.ids.forEach(i=>arrOf.set(i,ai)));
 // groundblend: ground layers (the page's nmGroundLayer name + nmTexStats flat-RGB / alpha-mask rule on the texture) keep
 // their own material and shader, and their texture is not arrayed for anyone (nmArrayScene's shared-source rule)
 const gl=new Set(),glSrc=new Set();for(const p of R.prims){if(p.tex==null||p.alpha==='MASK'||p.alpha==='BLEND'||/Decal|Floater/i.test(p.name)||GB.nmGroundLayer(p.name)===null)continue;const s=R.g.textures[p.tex].source,st=await texStats(mroot(key)+R.g.images[s].uri);if(st&&st.lum<10&&st.alpha>=8&&st.am>=25){gl.add(p);glSrc.add(s);}}
 const items=R.prims.map((p,k)=>{const decal=/Decal|Floater/i.test(p.name),cut=p.alpha==='MASK'||(FOL.test(p.name)&&!NOFOL.test(p.name));const own='m'+p.material;const s=p.tex!=null?R.g.textures[p.tex].source:null;
  const ak=decal||s==null||gl.has(p)||glSrc.has(s)?own:'a'+arrOf.get(sIx.get(s))+'|'+(cut?1:0)+'|'+(lv.get(p.name)||0)+'|'+B.nmDetailDistance(p.name,false,cut);return {key:ak,own,k,name:p.name,pos:R.pos,index:R.index,tri0:p.tri0,tris:p.tris,decal,cutout:cut};});
 const run=(its,opt)=>{const plan=B.nmChunkPlan(its,opt),objs=plan.map(o=>{let n=0;for(const q of o.parts)n+=q.tris?q.tris.length:its[q.item].tris;const ids=new Uint32Array(n);let k=0;for(const q of o.parts){const it=its[q.item];if(q.tris)for(const t of q.tris)ids[k++]=it.tri0+t;else for(let t=0;t<it.tris;t++)ids[k++]=it.tri0+t;}const s=sphereOf(R.pos,R.index,ids);return {c:s.c,r:s.r,tris:n,maxDist:o.maxDist};});return Object.assign({objects:objs.length},count(objs,V));};
 const before=run(items.map(it=>Object.assign({},it,{key:it.own})),NM_OPT),after=run(items,Object.assign({},NM_OPT,{total:NM_ARR.chunks}));
 rows.push({key,arrays:arrays.length,groups:new Set(items.map(i=>i.key)).size,groundLayers:gl.size,before,after});console.log(key,'arrays',arrays.length,'ground layers',gl.size,'calls avg',before.calls,'->',after.calls,'worst',before.worstCalls,'->',after.worstCalls,'tris avg',before.tris,'->',after.tris,'objects',before.objects,'->',after.objects);
 const b=BUDGET[key];assert(after.calls<=b.avg,key+': average map draw calls '+after.calls+' > '+b.avg);assert(after.worstCalls<=b.worst,key+': worst-view map draw calls '+after.worstCalls+' > '+b.worst);
 assert(after.tris<=before.tris*TRIS_SLACK,key+': texture-array chunks draw more triangles on average ('+after.tris+' vs '+before.tris+' x '+TRIS_SLACK+')');}
if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(rows,null,1));
console.log('test_map_drawcalls OK');})().catch(e=>{console.error(e);process.exit(1);});
