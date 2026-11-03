// Map load memory (iOS user 2026-11-03: online match -> black screen / back to the menu; a WebKit tab is capped in memory).
// three's GLTFLoader keeps every geometry .bin (Ascent: 10 files, 177 MB) in its parser cache for as long as the glTF result
// lives, and slices a COPY of every bufferView out of them, so raw buffers + bufferView copies + the merged chunk geometry
// (nmOptimizeScene) were all alive while the map was prepared. native_maps_runtime:
//  - nmBufRelease (GLTFLoader plugin, registered by nmLoadScene): a raw buffer leaves the parser cache once all its bufferViews
//    are sliced, during the load;
//  - nmParserRelease (nmLoadScene, right after nmTexMissingMark): the parser and its caches are dropped once loaded.
// Real three r149 + r147 GLTFLoader (REAL3_DIR) on a 2-buffer / 6-bufferView glTF, with a GC:
//  1. wired in nmLoadScene; 2. baseline loader: raw buffers still reachable after the load (the bug);
//  3. with the plugin + release: raw buffers collected while the scene is alive, and the bufferView copies collected once the
//     scene's geometry is replaced (as nmOptimizeScene does); 4. identical geometry (same attributes / indices).
//   node work/test_map_load_memory.cjs
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),v8=require('v8');
v8.setFlagsFromString('--expose-gc');const gc=vm.runInNewContext('gc');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const D=process.env.REAL3_DIR||'/workspace/work/qa';
const pick=n=>{const i=src.indexOf('function '+n+'(');assert(i>=0,n+' missing from native_maps_runtime.js');let j=src.indexOf('\nfunction ',i+1);return src.slice(i,j);};
const tick=ms=>new Promise(r=>setTimeout(r,ms));
function ctx(){
 const raws=[];const c={console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,queueMicrotask,TextDecoder,TextEncoder,Blob,URL,Headers,navigator:{userAgent:'node'},NM:{}};
 vm.createContext(c);const VAB=vm.runInContext('ArrayBuffer',c),VU8=vm.runInContext('Uint8Array',c);
 const files=new Map();c.__files=files;
 class R extends Response{arrayBuffer(){return super.arrayBuffer().then(a=>{const v=new VAB(a.byteLength);new VU8(v).set(new Uint8Array(a));if(/\.bin$/.test(this.__u))raws.push(new WeakRef(v));return v;});}}
 c.Response=R;c.Request=class extends Request{constructor(u,o){super(typeof u==='string'?new URL(u,'http://localhost/').href:u,o);}};
 c.fetch=async(u)=>{u=typeof u==='string'?u:u.url;u=u.replace('http://localhost/','');const b=files.get(u);const r=new R(b||'',{status:b?200:404});r.__u=u;return r;};
 vm.runInContext(fs.readFileSync(path.join(D,'three.min.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(D,'GLTFLoader.js'),'utf8'),c);
 vm.runInContext(pick('nmBufRelease')+'\n'+pick('nmParserRelease'),c);
 return {c,raws};
}
// 2 buffers x 3 meshes: each mesh a position bufferView + an index bufferView (6 views per buffer)
function gltf(files,base){const j={asset:{version:'2.0'},buffers:[],bufferViews:[],accessors:[],meshes:[],nodes:[],scenes:[{nodes:[]}],scene:0};
 for(let b=0;b<2;b++){const parts=[];let off=0;for(let m=0;m<3;m++){const n=300+m*7+b,P=new Float32Array(n*3);for(let i=0;i<P.length;i++)P[i]=Math.sin(i*0.37+m+b*3);const I=new Uint32Array((n-2)*3);for(let t=0;t<n-2;t++){I[t*3]=t;I[t*3+1]=t+1;I[t*3+2]=t+2;}
   for(const [arr,tgt,acc] of [[P,34962,{componentType:5126,count:n,type:'VEC3',min:[-1,-1,-1],max:[1,1,1]}],[I,34963,{componentType:5125,count:I.length,type:'SCALAR'}]]){const by=Buffer.from(arr.buffer);j.bufferViews.push({buffer:b,byteOffset:off,byteLength:by.length,target:tgt});j.accessors.push({bufferView:j.bufferViews.length-1,...acc});parts.push(by);off+=by.length;}
   const a=j.accessors.length;j.meshes.push({primitives:[{attributes:{POSITION:a-2},indices:a-1}]});j.nodes.push({mesh:j.meshes.length-1});j.scenes[0].nodes.push(j.nodes.length-1);}
  const buf=Buffer.concat(parts);files.set(base+'geometry-0'+b+'.bin',buf);j.buffers.push({uri:'geometry-0'+b+'.bin',byteLength:buf.length});}
 files.set(base+'scene.gltf',Buffer.from(JSON.stringify(j)));}
const geo=gl=>{const out=[];gl.scene.traverse(o=>{if(o.isMesh)out.push([Array.from(o.geometry.attributes.position.array),Array.from(o.geometry.index.array)]);});return out;};
async function collected(refs){for(let k=0;k<6;k++){gc();await tick(5);}return refs.filter(r=>r.deref()===undefined).length;}
(async()=>{
 // 1. wiring
 { const ls=pick('nmLoadScene');assert(/L\.register\(nmBufRelease\)/.test(ls),'nmLoadScene registers nmBufRelease');assert(/nmTexMissingMark\(gl\);nmParserRelease\(gl\);/.test(ls),'nmLoadScene releases the parser after nmTexMissingMark');
   const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(html.includes(pick('nmBufRelease').trim())&&html.includes(pick('nmParserRelease').trim()),'installed in index.html (python3 work/install_valorant.py)'); }
 const base='models/valorant/maps/t/';
 // 2. baseline: the raw .bin buffers stay reachable through the parser while the result lives
 let ref;{ const {c,raws}=ctx();gltf(c.__files,base);const gl=await new c.THREE.GLTFLoader().loadAsync(base+'scene.gltf');ref=geo(gl);
   assert.equal(raws.length,2);const n=await collected(raws);assert.equal(n,0,'baseline: raw buffers still alive ('+n+'/2 collected)');void gl.scene;
   console.log('  baseline GLTFLoader: 2/2 raw .bin buffers still reachable after the load'); }
 // 3. plugin + release
 { const {c,raws}=ctx();gltf(c.__files,base);const L=new c.THREE.GLTFLoader();L.register(c.nmBufRelease);let gl=await L.loadAsync(base+'scene.gltf');
   const P=gl.parser;assert(P.cache.get('buffer:0')===undefined&&P.cache.get('buffer:1')===undefined,'no raw buffer left in the parser cache after the load');assert(P.cache.get('bufferView:0')!==undefined,'(bufferViews still cached until the release)');assert.equal(c.NM.bufFreed,2,'both buffers released during the load');
   assert.deepEqual(geo(gl),ref,'identical geometry');
   const views=[];gl.scene.traverse(o=>{if(o.isMesh){views.push(new WeakRef(o.geometry.attributes.position.array.buffer),new WeakRef(o.geometry.index.array.buffer));}});
   assert.equal(c.nmParserRelease(gl),true);assert.equal(gl.parser,null);assert.equal(P.cache.get('bufferView:0'),undefined,'parser cache emptied');
   assert.equal(await collected(raws),2,'raw buffers collected while the scene is alive');
   gl.scene.traverse(o=>{if(o.isMesh){o.geometry=new c.THREE.BufferGeometry();}});/* nmOptimizeScene: the source geometry is replaced by its chunks */
   const nv=await collected(views);assert.equal(nv,views.length,'bufferView copies collected once the source geometry is gone ('+nv+'/'+views.length+')');
   console.log(`  nmBufRelease + nmParserRelease: raw buffers 2/2 collected during the load, bufferView copies ${nv}/${views.length} collected after the merge, geometry identical`); }
 { // a parser without the cache API / an undefined gl are tolerated
   const {c}=ctx();assert.equal(c.nmParserRelease(null),false);assert.equal(c.nmParserRelease({}),false); }
 console.log('Map load memory: GLTFLoader raw buffers leave the parser cache as soon as their bufferViews are sliced, and the parser (bufferView copies, caches) is dropped once loaded; same geometry');
})().catch(e=>{console.error(e);process.exit(1);});
