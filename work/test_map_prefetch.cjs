// Map prefetch during the room countdown (loadfast 1, user 2026-11-03 "loading into the game for multiplayer takes really long"):
// an online room knows its map when the room is assigned, but every map byte (Ascent: 177 MB geometry .bin + 13.6 MB textures)
// was fetched only after the 'start' message, after the 5 s countdown. xMapPrefetch (work/loader_retry_runtime.js) fetches the
// map's scene.gltf, buffers and images at room assignment; the glTF loaders take the prefetched / in-flight bodies.
// Drives the REAL three r149 loaders + r147 GLTFLoader (as test_loader_retry) against a fake network:
//  1. installed: the room message starts the prefetch, nmEnsure drops another map's prefetch and releases it after the load,
//     mpReset (leave / lost) stops it;
//  2. prefetch completed before the load: every URL downloaded exactly once, all handed over, every material textured, nothing held after;
//  3. load starting while the prefetch is mid-flight: still one download per URL (in-flight bodies awaited, queued ones claimed);
//  4. the room's map changes: the old map's fetches aborted, its bodies dropped, the new map prefetched; the old map still loads (own fetches);
//  5. a prefetch body that breaks off falls back to the loader's fetch + retry (map loads, textured);
//  6. stop() releases everything.
//   node work/test_map_prefetch.cjs
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
const RT=fs.readFileSync(path.join(__dirname,'loader_retry_runtime.js'),'utf8');
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(String((e&&e.message)||e)));
function threeFiles(){const d=process.env.REAL3_DIR||'/workspace/work/qa';if(!process.env.QA_THREE160&&['three.min.js','GLTFLoader.js'].every(f=>fs.existsSync(path.join(d,f))))return {three:fs.readFileSync(path.join(d,'three.min.js'),'utf8'),gltf:fs.readFileSync(path.join(d,'GLTFLoader.js'),'utf8'),rev:'149'};return null;}
const REAL=threeFiles();
// three r149's FileLoader builds a Request first: resolve relative URLs against a page base, as a browser does (page_harness)
const BASE='http://localhost/';class PageRequest extends Request{constructor(u,o){super(typeof u==='string'?new URL(u,BASE).href:u,o);}}
const tick=ms=>new Promise(r=>setTimeout(r,ms));const until=async(f,ms=5000)=>{const e=Date.now()+ms;while(!f()){if(Date.now()>e)throw new Error('timeout waiting');await tick(2);}};
// fake network: plan[url] = number of attempts whose body breaks off; status[url] = HTTP status; files[url] = bytes
function net(){
 const N={R:Response,files:new Map(),plan:new Map(),status:new Map(),attempts:new Map(),inflight:0,peak:0,order:[],fetches:0};
 N.signals=[];N.fetch=function(url,init){url=typeof url==='string'?url:String(url.url||url);if(init&&init.signal){N.signals.push([url,init.signal]);if(init.signal.aborted)return Promise.reject(Object.assign(new Error('aborted'),{name:'AbortError'}));}if(url.startsWith(BASE))url=url.slice(BASE.length);N.fetches++;const a=(N.attempts.get(url)||0)+1;N.attempts.set(url,a);N.order.push(url);
  if(N.status.has(url))return Promise.resolve(new N.R('',{status:N.status.get(url),statusText:'Not Found'}));
  const body=N.files.get(url);if(!body)return Promise.resolve(new N.R('',{status:404,statusText:'Not Found'}));
  const fail=a<=(N.plan.get(url)||0);N.inflight++;if(N.inflight>N.peak)N.peak=N.inflight;let open=true;const end=()=>{if(open){open=false;N.inflight--;}};
  const delay=1+((a*7+url.length)%5);
  return new Promise(res=>setTimeout(()=>{
   if(fail&&a%3===0){end();res(Promise.reject(new TypeError('NetworkError when attempting to fetch resource.')));return;} // every 3rd failing attempt: the fetch itself fails
   let sent=false;const stream=new ReadableStream({pull(c){return new Promise(r=>setTimeout(()=>{
     if(fail&&sent){end();c.error(new TypeError('Error in input stream'));r();return;}
     if(fail){sent=true;c.enqueue(body.subarray(0,Math.max(1,body.length>>1)));r();return;}
     c.enqueue(body);c.close();end();r();},delay));},cancel(){end();}});
   res(new N.R(stream,{status:200,headers:{'Content-Length':String(body.length)}}));},delay));
 };
 return N;
}
function ctx(N,{ua,patched,doc}){
 const errs=[],warns=[];const con={log(){},info(){},debug(){},warn:(...a)=>warns.push(a.join(' ')),error:(...a)=>errs.push(a.map(String).join(' '))};
 const listeners={};
 const c={console:con,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,TextDecoder,TextEncoder,ReadableStream,Headers,Request:PageRequest,Blob,URL,ProgressEvent:class{constructor(t,o){this.type=t;Object.assign(this,o);}},DOMParser:undefined,
  navigator:{userAgent:ua},fetch:N.fetch,
  createImageBitmap:async(blob,opts)=>{const t=await blob.text();if(!t.startsWith('png:'))throw new Error('InvalidStateError: The source image could not be decoded.');return {width:4,height:4,tag:t,close(){}};},
  addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f);}};
 if(doc)c.document=doc;
 c.window=c;c.self=c;vm.createContext(c);
 // one realm, as in a browser: bodies read as the page realm's ArrayBuffer (GLTFLoader tests data instanceof ArrayBuffer)
 const VAB=vm.runInContext('ArrayBuffer',c),VU8=vm.runInContext('Uint8Array',c);
 c.Response=N.R=class extends Response{arrayBuffer(){return super.arrayBuffer().then(a=>{const v=new VAB(a.byteLength);new VU8(v).set(new Uint8Array(a));return v;});}};
 if(REAL){vm.runInContext(REAL.three,c,{filename:'three.min.js'});vm.runInContext(REAL.gltf,c,{filename:'GLTFLoader.js'});}
 else{c.THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));}
 if(patched)vm.runInContext(RT,c,{filename:'loader_retry_runtime.js'});
 return {c,errs,warns,listeners};
}
const FF='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';
const SAFARI='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
// a glTF "map": nTex textures, one material + mesh + node per texture, one .bin with a triangle
function gltfMap(N,base,nTex){
 const pos=new Float32Array([0,0,0,1,0,0,0,1,0]),bin=Buffer.from(pos.buffer);
 const j={asset:{version:'2.0'},buffers:[{uri:'scene.bin',byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:bin.length}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],images:[],textures:[],materials:[],meshes:[],nodes:[],scenes:[{nodes:[]}],scene:0,samplers:[{}]};
 for(let i=0;i<nTex;i++){const u='textures/t'+i+'.png';N.files.set(base+u,Buffer.from('png:'+u));j.images.push({uri:u,mimeType:'image/png'});j.textures.push({source:i,sampler:0});
  j.materials.push({name:'m'+i,pbrMetallicRoughness:{baseColorTexture:{index:i}}});j.meshes.push({primitives:[{attributes:{POSITION:0},material:i}]});j.nodes.push({mesh:i,name:'n'+i});j.scenes[0].nodes.push(i);}
 N.files.set(base+'scene.gltf',Buffer.from(JSON.stringify(j)));N.files.set(base+'scene.bin',bin);return j;
}
function loadMap(c,base,timeout){const T=c.THREE;let st={start:0,end:0,err:0};
 const man=new T.LoadingManager(()=>{},()=>{},()=>{});const s0=man.itemStart.bind(man),e0=man.itemEnd.bind(man),r0=man.itemError.bind(man);
 man.itemStart=u=>{st.start++;s0(u);};man.itemEnd=u=>{st.end++;e0(u);};man.itemError=u=>{st.err++;r0(u);};
 const p=new T.GLTFLoader(man).loadAsync(base+'scene.gltf');
 return Promise.race([p.then(gl=>({gl,st})),tick(timeout).then(()=>({hang:true,st}))]);}
function textured(gl){const out=[];gl.scene.traverse(o=>{if(o.isMesh)out[+o.material.name.slice(1)]=o.material.map?o.material.map.image&&o.material.map.image.tag:null;});return out;} // indexed by material m<i>

(async()=>{
 assert(REAL,'needs three r149 + GLTFLoader in REAL3_DIR (/workspace/work/qa)');
 // 1. installed
 { const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const a=html.indexOf('// ---- LOADER RETRY ----'),b=html.indexOf('// ---- END LOADER RETRY ----');
   assert.equal(html.slice(a,b+'// ---- END LOADER RETRY ----'.length),RT.trimEnd(),'installed block == work/loader_retry_runtime.js (python3 work/install_valorant.py)');
   assert(RT.includes('G.xMapPrefetch'),'loader_retry_runtime defines xMapPrefetch');
   const room=html.indexOf("if(m.t==='room'){"),rs=html.slice(room,html.indexOf("if(m.t==='start'){",room));
   assert(/xMapPrefetch\.start\(m\.map\)/.test(rs),'the room message starts the map prefetch');assert(/MP\.st==='room'/.test(rs)&&/NM\.current\.key===m\.map/.test(rs),'only in the room (not mid-game), not for a map already in memory');
   const ne=html.slice(html.indexOf('async function nmEnsure(key){'),html.indexOf('// Decals and floaters (#lotus-white)'));
   assert(/xMapPrefetch\.key!==key\)xMapPrefetch\.stop\(\)/.test(ne),'nmEnsure drops a prefetch of another map');
   assert(/finally\([^]*xMapPrefetch\.key===key\)xMapPrefetch\.stop\(\)/.test(ne),'nmEnsure releases the prefetch once the load settles');
   assert(/mpReset=function\(\)\{try\{if\(window\.xMapPrefetch\)xMapPrefetch\.stop\(\)/.test(html),'leaving / losing the room stops the prefetch'); }
 const B='models/valorant/maps/';
 const onceEach=(N,pre)=>{for(const [u,n] of N.attempts)if(u.startsWith(pre))assert.equal(n,1,u+' downloaded once ('+n+')');};
 // 2. prefetch done before the start
 { const N=net();gltfMap(N,B+'ascent/',30);const {c}=ctx(N,{ua:FF,patched:true});const PF=c.xMapPrefetch;assert(PF&&typeof PF.start==='function','xMapPrefetch.start');
   assert.equal(PF.start('ascent'),true);await until(()=>PF.fetched===32);assert.equal(PF.held>0,true,'bodies held as Blobs');const f0=N.fetches;
   const r=await loadMap(c,B+'ascent/',5000);assert(!r.hang);const t=textured(r.gl);t.forEach((x,i)=>assert.equal(x,'png:textures/t'+i+'.png'));
   assert.equal(N.fetches,f0,'the load fetched nothing itself');onceEach(N,B+'ascent/');assert.equal(PF.hits,32,'32 bodies handed over');assert.equal(PF.held,0,'nothing held after hand-over');
   assert.equal(r.st.start,r.st.end);assert.equal(r.st.err,0);
   console.log(`  prefetched before start: ${PF.hits}/32 handed over, ${N.fetches} fetches (one per file)`); }
 // 3. start mid-prefetch
 { const N=net();gltfMap(N,B+'ascent/',60);const {c}=ctx(N,{ua:FF,patched:true});const PF=c.xMapPrefetch;PF.start('ascent');await tick(4);
   const r=await loadMap(c,B+'ascent/',8000);assert(!r.hang);const t=textured(r.gl);assert.equal(t.length,60);t.forEach((x,i)=>assert.equal(x,'png:textures/t'+i+'.png'));
   onceEach(N,B+'ascent/');assert.equal(N.fetches,62,'62 files, 62 downloads');assert(PF.hits>=1,'some bodies came from the prefetch ('+PF.hits+')');
   console.log(`  start mid-prefetch: ${PF.hits} handed over, ${N.fetches} downloads for 62 files`); }
 // 4. room map changes
 { const N=net();gltfMap(N,B+'ascent/',40);gltfMap(N,B+'bind/',10);const {c}=ctx(N,{ua:FF,patched:true});const PF=c.xMapPrefetch;PF.start('ascent');await tick(6);
   const sigA=N.signals.filter(([u])=>u.startsWith(B+'ascent/'));assert(sigA.length>0,'ascent prefetch started');
   PF.start('bind');assert.equal(PF.key,'bind');assert(sigA.every(([,s])=>s.aborted),'ascent fetches aborted');
   assert(![...PF.entries.keys()].some(k=>k.includes('/ascent/')),'no ascent body held');await until(()=>PF.fetched>=12);
   const r=await loadMap(c,B+'bind/',5000);assert(!r.hang);assert.equal(textured(r.gl).filter(Boolean).length,10);onceEach(N,B+'bind/');
   PF.stop();const r2=await loadMap(c,B+'ascent/',8000);assert(!r2.hang);assert.equal(textured(r2.gl).filter(Boolean).length,40,'old map still loads on its own fetches');
   console.log(`  map change: ${sigA.length} ascent fetches aborted, bind prefetched and loaded once each`); }
 // 5. a broken prefetch body falls back to the loader
 { const N=net();gltfMap(N,B+'ascent/',8);N.plan.set(B+'ascent/scene.bin',1);N.plan.set(B+'ascent/textures/t3.png',1);const {c}=ctx(N,{ua:FF,patched:true});const PF=c.xMapPrefetch;c.xLoaderRetry.backoff=[5,10,20];
   PF.start('ascent');await until(()=>PF.fetched>=7);await tick(30);const r=await loadMap(c,B+'ascent/',5000);assert(!r.hang);assert.equal(textured(r.gl).filter(Boolean).length,8,'every texture');
   assert.equal(N.attempts.get(B+'ascent/scene.bin'),2,'broken .bin: prefetch + one loader fetch');assert(PF.misses>=2,'misses counted'); }
 // 6. stop releases
 { const N=net();gltfMap(N,B+'ascent/',10);const {c}=ctx(N,{ua:FF,patched:true});const PF=c.xMapPrefetch;PF.start('ascent');await until(()=>PF.fetched===12);
   assert(PF.held>0);PF.stop();assert.equal(PF.held,0);assert.equal(PF.entries.size,0);assert.equal(PF.key,null);assert.equal(PF.take(B+'ascent/scene.bin'),null,'nothing to take after stop');
   assert.equal(PF.start('../x'),false,'only plain map keys'); }
 // 7. Safari / WebKit (GLTFLoader's TextureLoader -> <img> path): prefetched images are shown from object URLs, not fetched again
 { const N=net();gltfMap(N,B+'ascent/',20);const imgs=[];let direct=0;
   const doc={createElementNS:()=>{const L={};const el={addEventListener:(t,f)=>{(L[t]=L[t]||[]).push(f);},removeEventListener:(t,f)=>{L[t]=(L[t]||[]).filter(x=>x!==f);},width:4,height:4,
     set src(u){this._src=u;if(!/^blob:/.test(u))direct++;setTimeout(()=>{for(const f of (L.load||[]).slice())f.call(el,{type:'load'});},2);},get src(){return this._src;}};imgs.push(el);return el;}};
   const {c}=ctx(N,{ua:SAFARI,patched:true,doc});c.URL=URL;const PF=c.xMapPrefetch;PF.start('ascent');await until(()=>PF.fetched===22);
   const r=await loadMap(c,B+'ascent/',5000);assert(!r.hang);let tex=0;r.gl.scene.traverse(o=>{if(o.isMesh&&o.material.map&&o.material.map.image)tex++;});assert.equal(tex,20,'every material textured');
   assert.equal(direct,0,'no <img> fetched its texture again');onceEach(N,B+'ascent/');assert.equal(N.fetches,22);assert.equal(PF.hits,22,'scene + bin + 20 images handed over');
   console.log(`  Safari <img> path: ${PF.hits}/22 handed over (object URLs), ${N.fetches} downloads`); }
 await tick(30);assert.deepEqual(unhandled,[],'no unhandled rejection');
 console.log('Map prefetch: room assignment fetches the map (scene.gltf, buffers, images) during the countdown; the glTF loaders take the prefetched / in-flight bodies, one download per file; a map change aborts and drops the old prefetch; a broken prefetch body falls back to the loader; the load releases it');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
