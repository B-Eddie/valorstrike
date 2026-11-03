// iOS / WebKit full-map load (user, 3 Nov 2026: on an iPhone every mode but the aim trainer - offline 5v5 on a full map
// included - crashed with "Script error"; the aim trainer skips the full-map pipeline). The map's WebGL2 texture-array path
// (nmArrayScene / nmArrUpload: sRGB TEXTURE_2D_ARRAY filled by texSubImage3D from <img> / canvas layers, GPU mipmaps, an
// RGBA32F palette fetched in the vertex shader, sampler2DArray) is what only full maps use. Checks, on a synthetic map with a
// recording WebGL2 stand-in under iOS-like limits and failures: the map still loads every time - nmOptimizeScene,
// nmBudget, nmUpload complete, every triangle is still drawn, every textured mesh keeps a texture (array layer or its own
// 2D texture) - and the array path is only used where it works:
//  1. desktop WebGL2: arrays built (unchanged path)
//  2. iOS WebKit user agent (iPhone, iPadOS desktop UA): 2D materials, no texStorage3D
//  3. MAX_ARRAY_TEXTURE_LAYERS 4 (iOS-like low limit): every array within the limit
//  4. MAX_TEXTURE_SIZE 256 under 512 px textures: no array over the limit (2D path)
//  5. texSubImage3D from an image / canvas throws: 2D path (a test layer is probed before the map is re-bound)
//  6. gl.getError after the sRGB array storage / mipmaps: 2D path
//  7. the array shader (sampler2DArray, texelFetch of the RGBA32F palette) fails to link: 2D path
//  8. sampler limits: iOS 16 / 16 units -> arrays; no vertex texture units -> 2D path
// RUNTIME=<older native_maps_runtime.js> shows it red (no probe: 2, 4-8 fail).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),src=fs.readFileSync(process.env.RUNTIME||path.join(__dirname,'native_maps_runtime.js'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const fn=n=>{let i=src.indexOf('\nfunction '+n+'(');if(i<0)i=src.indexOf('\nasync function '+n+'(');if(i<0)return null;i++;const re=/\n(?:function |async function |var |\/\/ |\(window)/g;re.lastIndex=i+1;const m=re.exec(src);return src.slice(i,m?m.index:src.length);};
const val=n=>{const m=src.match(new RegExp('var '+n+'=(\\{[^}]*\\})'));return m?eval('('+m[1]+')'):null;};
const NM_ARR=val('NM_ARR'),NM_OPT=val('NM_OPT'),NM_SMALL=val('NM_SMALL'),NM_STRIP=val('NM_STRIP')||{on:false};
const NAMES=['nmArrOk','nmArrProbe','nmIOSWebKit','nmArrSize','nmArrBuckets','nmArrState','nmArrEligible','nmArrShader','nmArrMaterial','nmArrayScene','nmArrDispose','nmArrUpload','nmArrFit','nmMatKey','nmDetailDistance','nmChunkPlan','nmSpanOver','nmCentroids','nmSphere','nmGather','nmOffset','nmCopy3','nmCopy2','nmCopyN','nmSmallDist','nmDetailSplit','nmOptimizeScene','nmStrips','nmStripBuild','nmStripChunk','nmRunRange','nmRunReset','nmBytes','nmTexBytes','nmDropArray','nmTexUploaded','nmShrink','nmPackGeometry','nmBudget','nmUpload'].filter(n=>fn(n));
function api(renderer,nav){return new Function('THREE','NM_ARR','NM_OPT','NM_SMALL','NM_STRIP','NM_ARR_PROBE','renderer','nmQuality','nmTexCap','createImageBitmap','document','navigator',NAMES.map(fn).join('\n')+'\nreturn {'+NAMES.join(',')+'};')(THREE,NM_ARR,NM_OPT,NM_SMALL,NM_STRIP,{gl:null,ok:false,why:''},renderer,()=>'medium',()=>0,async(img,o)=>fakeImage(o.resizeWidth,o.resizeHeight,img.tag+'>'+o.resizeWidth),undefined,nav);}
function fakeImage(w,h,tag){return {width:w,height:h,tag,close(){this.closed=true;}};}
const K={TEXTURE_2D_ARRAY:35866,TEXTURE_2D:3553,SRGB8_ALPHA8:35907,RGBA8:32856,RGBA32F:34836,FLOAT:5126,RGBA:6408,UNSIGNED_BYTE:5121,UNPACK_FLIP_Y_WEBGL:37440,UNPACK_PREMULTIPLY_ALPHA_WEBGL:37441,UNPACK_ALIGNMENT:3317,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,LINEAR:9729,LINEAR_MIPMAP_LINEAR:9987,REPEAT:10497,MAX_ARRAY_TEXTURE_LAYERS:35071,MAX_TEXTURE_IMAGE_UNITS:34930,MAX_VERTEX_TEXTURE_IMAGE_UNITS:35660,MAX_TEXTURE_SIZE:3379,VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714};
// o: {layers, size, units, vunits, subThrows, errAfter: 'storage'|'mip', link:false}
function fakeGL(o){o=o||{};let n=0,err=0;const log=[];const P={[K.MAX_ARRAY_TEXTURE_LAYERS]:o.layers||2048,[K.MAX_TEXTURE_IMAGE_UNITS]:o.units!=null?o.units:16,[K.MAX_VERTEX_TEXTURE_IMAGE_UNITS]:o.vunits!=null?o.vunits:16,[K.MAX_TEXTURE_SIZE]:o.size||16384};
 const gl=Object.assign({},K,{log,getParameter:p=>P[p]!=null?P[p]:0,getError:()=>{const e=err;err=0;return e;},createTexture:()=>({id:++n}),bindTexture(){},deleteTexture(){},pixelStorei(){},texParameteri(){},texParameterf(){},texStorage2D(){},texSubImage2D(){},
  texStorage3D(t,l,f,w,h,d){if(w>P[K.MAX_TEXTURE_SIZE]||h>P[K.MAX_TEXTURE_SIZE]||d>P[K.MAX_ARRAY_TEXTURE_LAYERS]){err=0x501;return;}log.push(['storage',w,h,d]);if(o.errAfter==='storage')err=0x500;},
  texSubImage3D(...a){const s=a[10];if(o.subThrows&&!ArrayBuffer.isView(s))throw new TypeError('Type error');log.push(['sub',a[4]]);},
  generateMipmap(){log.push(['mip']);if(o.errAfter==='mip')err=0x502;},
  createProgram:()=>({}),createShader:k=>({k}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',attachShader(){},linkProgram(){},getProgramParameter:()=>o.link!==false,getProgramInfoLog:()=>o.link===false?"ERROR: sampler2DArray":'',deleteShader(){},deleteProgram(){}});
 return gl;}
function fakeRenderer(o){const gl=fakeGL(o),props=new WeakMap();return {gl,uploads:[],capabilities:{isWebGL2:true,getMaxAnisotropy:()=>16},properties:{get:x=>{let p=props.get(x);if(!p)props.set(x,p={});return p;}},extensions:{has:()=>false},resetState(){},initTexture(t){if(!t.image&&!(t.source&&t.source.data))throw new Error('no image');this.uploads.push(t);},getContext(){return gl;}};}
function scene(){let seed=7;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const g=new THREE.Group(),tex=[];
 const sizes=[];for(let i=0;i<12;i++)sizes.push([512,512]);for(let i=0;i<8;i++)sizes.push([256,256]);
 sizes.forEach(([w,h],i)=>{const t=new THREE.Texture(fakeImage(w,h,'t'+i));t.flipY=false;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;tex.push(t);});
 let tris=0;for(let i=0;i<40;i++){const P=[],U=[],I=[],nt=120+Math.floor(R()*40),x=(i%8)*40-160,z=Math.floor(i/8)*40-100;for(let k=0;k<nt;k++){const bx=x+R()*20,bz=z+R()*20,y=R()*5;for(let j=0;j<3;j++){P.push(bx+R()*2,y+R(),bz+R()*2);U.push(R(),R());}I.push(k*3,k*3+1,k*3+2);}tris+=nt;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(P),3));geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(P.length).fill(.577),3));geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(U),2));geo.setIndex(new THREE.BufferAttribute(new Uint32Array(I),1));
  const m=new THREE.MeshLambertMaterial({name:'Wall_'+i,map:tex[i%tex.length],color:[0xffffff,0xd0d0d0][i%2],side:THREE.DoubleSide});if(i%5===3){m.alphaTest=.45;m.userData.cutout=true;}g.add(new THREE.Mesh(geo,m));}
 return {g,tris};}
const NAV={desk:{userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',maxTouchPoints:0},
 iphone:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',maxTouchPoints:5},
 ipad:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',maxTouchPoints:5},
 macSafari:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',maxTouchPoints:0}};
// loads the synthetic map through the pipeline; returns what was drawn and how
async function load(o,nav){const r=fakeRenderer(o),A=api(r,nav||NAV.desk),S=scene();let opt;
 opt=A.nmOptimizeScene(S.g);r.gl.log.length=0;/* the probe's own test layer is not the map's */const mem=await A.nmBudget(S.g,0);await A.nmUpload(mem.textures,()=>true);
 let tris=0,arrayed=0,plain=0,untex=0;const arrays=new Set();
 S.g.traverse(m=>{if(!m.isMesh||m.visible===false)return;const g=m.geometry,mat=m.material;const n=(m.userData.nmChunk&&m.userData.nmChunk.tris!=null)?0:0;if(mat.nmArrTex){arrayed++;arrays.add(mat.nmArrTex);}else if(mat.map)plain++;else untex++;});
 for(const c of (S.g.userData.nmChunks||[]))tris+=(c.geometry.index?c.geometry.index.count:0)/3;
 const strips=S.g.userData.nmStrips||[];
 for(const a of arrays){const p=r.properties.get(a);assert(p.__webglTexture,'an array texture was never uploaded');}
 return {r,opt,mem,arrays:[...arrays],arrayed,plain,untex,S,storage:r.gl.log.filter(e=>e[0]==='storage'),uploads2D:r.uploads.filter(t=>!t.isDataArrayTexture&&!t.userData.nmArrPal).length};}
function loaded(L,label){assert(L.opt,label+': nmOptimizeScene returned nothing');assert.equal(L.untex,0,label+': a textured map mesh lost its texture');assert(L.arrayed+L.plain>0,label+': nothing drawn');}
function twoD(L,label){loaded(L,label);assert.equal(L.arrays.length,0,label+': texture arrays used where they fail');assert.equal(L.storage.length,0,label+': a map array texture was stored');assert(L.uploads2D>=20,label+': the 2D textures were not uploaded ('+L.uploads2D+')');}
(async()=>{const res={};
 {const L=await load({},NAV.desk);loaded(L,'desktop');assert(L.arrays.length>=2,'desktop WebGL2 must keep the texture arrays');assert.equal(L.plain,0,'desktop: a mesh left on its 2D material');res.desktop={arrays:L.arrays.length};}
 {const L=await load({},NAV.macSafari);loaded(L,'mac safari');assert(L.arrays.length>=2,'desktop Safari keeps the arrays (probe passes)');}
 for(const k of ['iphone','ipad']){const L=await load({},NAV[k]);twoD(L,k);res[k]='2D';}
 {const L=await load({layers:4},NAV.desk);loaded(L,'layers 4');for(const a of L.arrays)assert(a.image.depth<=4,'array over MAX_ARRAY_TEXTURE_LAYERS');for(const s of L.storage)assert(s[3]<=4);res.layers4={arrays:L.arrays.length};}
 {const L=await load({size:256},NAV.desk);for(const s of L.storage)assert(Math.max(s[1],s[2])<=256,'array storage over MAX_TEXTURE_SIZE: '+s);twoD(L,'max texture size 256');res.size256='2D';}
 {const L=await load({subThrows:true},NAV.desk);twoD(L,'texSubImage3D throws');res.subThrows='2D';}
 {const L=await load({errAfter:'storage'},NAV.desk);twoD(L,'getError after texStorage3D');res.errStorage='2D';}
 {const L=await load({errAfter:'mip'},NAV.desk);twoD(L,'getError after generateMipmap');res.errMip='2D';}
 {const L=await load({link:false},NAV.desk);twoD(L,'array shader link fails');res.link='2D';}
 {const L=await load({units:16,vunits:16},NAV.desk);loaded(L,'16 units');assert(L.arrays.length>=2,'iOS-like 16 sampler units are enough for the arrays');res.units16={arrays:L.arrays.length};}
 {const L=await load({vunits:0},NAV.desk);twoD(L,'no vertex texture units');res.vunits0='2D';}
 console.log(JSON.stringify(res));console.log('test_map_ios_webkit OK');
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
