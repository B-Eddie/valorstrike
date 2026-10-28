// Asset loader retry + concurrency cap (work/loader_retry_runtime.js, installed as its own <script> right after GLTFLoader.js).
// User 2026-10-28 (Firefox, live page at 191bcb4): a map load logged ~75x "THREE.GLTFLoader: Couldn't load texture
// textures/<hash>.png" and 5x "Uncaught (in promise) TypeError: Error in input stream" (an interrupted HTTP body) while the
// server answered 200 to every texture: ~373 textures / 55 MB fetched at once, a broken-off body = an untextured surface,
// and three r149's FileLoader leaves an interrupted glTF / .bin body as an unhandled rejection and a load that never settles.
// This test drives the REAL three r149 loaders + the r147 GLTFLoader the page loads (REAL3_DIR, as page_harness; falls back to
// server/node_modules three r160 for the loader-level checks, without the glTF part) against a fake network whose response
// bodies break off ("Error in input stream") the first N times per URL:
//  1. the installed page script == work/loader_retry_runtime.js, after GLTFLoader.js and before the game script;
//  2. baseline (unpatched three, documents the bug): textures go missing, an interrupted .bin body never settles and leaves
//     an unhandled rejection;
//  3. patched, Firefox UA (ImageBitmapLoader): a glTF "map" whose json, .bin and every texture fail 1-3 times loads with every
//     material textured with the right image, concurrent fetches never above the cap, glTF / .bin ahead of the texture queue,
//     no "Couldn't load texture", no unhandled rejection, LoadingManager progress counts balanced;
//  4. a body failing more than LR.retries times -> onError once (texture null), no retry on 404, data: URLs bypass the pool;
//  5. Safari UA (TextureLoader / ImageLoader <img>): failed <img> loads retried, cap held;
//  6. the unhandledrejection filter swallows fetch-interruption TypeErrors only.
//   node work/test_loader_retry.cjs
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
const RT=fs.readFileSync(path.join(__dirname,'loader_retry_runtime.js'),'utf8');
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(String((e&&e.message)||e)));
function threeFiles(){const d=process.env.REAL3_DIR||'/workspace/work/qa';if(!process.env.QA_THREE160&&['three.min.js','GLTFLoader.js'].every(f=>fs.existsSync(path.join(d,f))))return {three:fs.readFileSync(path.join(d,'three.min.js'),'utf8'),gltf:fs.readFileSync(path.join(d,'GLTFLoader.js'),'utf8'),rev:'149'};return null;}
const REAL=threeFiles();
// three r149's FileLoader builds a Request first: resolve relative URLs against a page base, as a browser does (page_harness)
const BASE='http://localhost/';class PageRequest extends Request{constructor(u,o){super(typeof u==='string'?new URL(u,BASE).href:u,o);}}
const tick=ms=>new Promise(r=>setTimeout(r,ms));
// fake network: plan[url] = number of attempts whose body breaks off; status[url] = HTTP status; files[url] = bytes
function net(){
 const N={R:Response,files:new Map(),plan:new Map(),status:new Map(),attempts:new Map(),inflight:0,peak:0,order:[],fetches:0};
 N.fetch=function(url,init){url=typeof url==='string'?url:String(url.url||url);if(url.startsWith(BASE))url=url.slice(BASE.length);N.fetches++;const a=(N.attempts.get(url)||0)+1;N.attempts.set(url,a);N.order.push(url);
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
 const c={console:con,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,TextDecoder,TextEncoder,ReadableStream,Headers,Request:PageRequest,Blob,URL,ProgressEvent:class{constructor(t,o){this.type=t;Object.assign(this,o);}},DOMParser:undefined,
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
 // 1. installed in index.html
 { const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const a=html.indexOf('// ---- LOADER RETRY ----'),b=html.indexOf('// ---- END LOADER RETRY ----');
   assert(a>0&&b>a,'index.html carries the LOADER RETRY block (run python3 work/install_valorant.py)');
   assert.equal(html.slice(a,b+'// ---- END LOADER RETRY ----'.length),RT.trimEnd(),'installed block == work/loader_retry_runtime.js');
   const g=html.indexOf('examples/js/loaders/GLTFLoader.js"></script>'),m=html.indexOf('const $ = (id) => document.getElementById(id);');
   assert(g>0&&g<a,'runs after GLTFLoader.js');assert(m>b,'runs before the game script');
   assert.equal(html.split('// ---- LOADER RETRY ----').length,2,'installed once'); }
 const base='models/valorant/maps/test/';
 if(REAL){
  // 2. baseline: unpatched three r149 + r147 GLTFLoader (the live page before this fix)
  { const N=net();gltfMap(N,base,40);for(let i=0;i<40;i+=3)N.plan.set(base+'textures/t'+i+'.png',1);
    const {c,errs}=ctx(N,{ua:FF,patched:false});const u0=unhandled.length;const r=await loadMap(c,base,3000);
    assert(!r.hang,'baseline map loads');const t=textured(r.gl),miss=t.filter(x=>!x).length;
    assert(miss>=10,'baseline: textures whose body broke off are missing ('+miss+')');
    assert(errs.filter(e=>/Couldn't load texture/.test(e)).length>=10,'baseline logs Couldn\'t load texture');
    assert(N.peak>20,'baseline: every texture fetched at once (peak '+N.peak+')');
    const N2=net();gltfMap(N2,base,4);N2.plan.set(base+'scene.bin',1);const B=ctx(N2,{ua:FF,patched:false});const r2=await loadMap(B.c,base,1500);await tick(50);
    assert(r2.hang,'baseline: an interrupted .bin body never settles (FileLoader progress stream)');
    assert(unhandled.slice(u0).some(m=>/input stream/.test(m)),'baseline: unhandled "Error in input stream"');
    unhandled.length=u0;
    console.log(`  baseline (unpatched): ${miss}/40 textures missing, fetch peak ${N.peak}, interrupted .bin -> load hangs + unhandled rejection`); }
  // 3. patched, Firefox: every asset fails 1-3 times, all load, cap held
  { const N=net();gltfMap(N,base,120);for(let i=0;i<120;i++)N.plan.set(base+'textures/t'+i+'.png',i%4);N.plan.set(base+'scene.gltf',2);N.plan.set(base+'scene.bin',3);
    const {c,errs}=ctx(N,{ua:FF,patched:true});const LR=c.xLoaderRetry;assert.equal(LR.installed,true);
    assert.equal(LR.cap,10);assert.equal(LR.retries,3);assert.deepEqual([...LR.backoff],[400,1200,3000]);LR.backoff=[5,10,20];
    const u0=unhandled.length;const r=await loadMap(c,base,20000);assert(!r.hang,'patched map load settles');
    const t=textured(r.gl);assert.equal(t.length,120);
    t.forEach((x,i)=>assert.equal(x,'png:textures/t'+i+'.png','mesh '+i+' textured with its own image'));
    assert(N.peak<=LR.cap,'concurrent fetches '+N.peak+' <= cap '+LR.cap);assert(N.peak>=Math.min(LR.cap,4),'fetches still run in parallel (peak '+N.peak+')');
    assert.equal(LR.peak<=LR.cap,true);assert.equal(N.attempts.get(base+'scene.bin'),4,'.bin: 3 broken bodies then loaded');
    assert.equal(errs.filter(e=>/Couldn't load texture/.test(e)).length,0,'no Couldn\'t load texture');
    await tick(30);assert.deepEqual(unhandled.slice(u0),[],'no unhandled rejection');
    assert.equal(r.st.start,r.st.end,'LoadingManager itemStart == itemEnd');assert.equal(r.st.err,0,'no itemError');
    assert.equal(LR.active,0);assert.equal(LR.queued,0);
    console.log(`  patched Firefox: 120/120 textured after ${LR.retried} retries, fetch peak ${N.peak}/${LR.cap}, ${N.fetches} fetches`); }
  // 3b. glTF / buffer requests jump the texture queue
  { const N=net();const T0=ctx(N,{ua:FF,patched:true}),c=T0.c,LR=c.xLoaderRetry;LR.backoff=[5,10,20];
    for(let i=0;i<30;i++)N.files.set('img/'+i+'.png',Buffer.from('png:'+i));N.files.set('a.glb',Buffer.from('glb'));
    const il=new c.THREE.ImageBitmapLoader();for(let i=0;i<30;i++)il.load('img/'+i+'.png',()=>{});
    const fl=new c.THREE.FileLoader();fl.setResponseType('arraybuffer');let got=null;fl.load('a.glb',d=>{got=d;});
    await tick(400);assert(got&&got.byteLength===3,'glb loaded');const k=N.order.indexOf('a.glb');assert(k>=0&&k<=LR.cap,'glb fetched as soon as a slot freed (position '+k+'), not behind 20 queued textures'); }
 }
 // 4. loader level (works on r149 or the r160 fallback): exhausted retries, 404, data:, json / text, dedup, Cache
 { const N=net();const {c,errs}=ctx(N,{ua:FF,patched:true});const T=c.THREE,LR=c.xLoaderRetry;LR.backoff=[5,10,20];
   N.files.set('x/a.png',Buffer.from('png:a'));N.plan.set('x/a.png',9);
   let ok=0,no=0;const man=new T.LoadingManager();let ie=0;const r0=man.itemError.bind(man);man.itemError=u=>{ie++;r0(u);};
   new T.ImageBitmapLoader(man).load('x/a.png',()=>ok++,undefined,()=>no++);await tick(600);
   assert.equal(ok,0);assert.equal(no,1,'onError once after the retries ran out');assert.equal(ie,1);assert.equal(N.attempts.get('x/a.png'),LR.retries+1,'1 + '+LR.retries+' attempts');
   N.status.set('x/404.bin',404);let e404=null;const fl=new T.FileLoader(man);fl.setResponseType('arraybuffer');fl.load('x/404.bin',null,undefined,e=>e404=e);await tick(100);
   assert(e404&&e404.status===404,'404 -> onError with the HttpError');assert.equal(N.attempts.get('x/404.bin'),1,'404 not retried');
   N.files.set('x/j.json',Buffer.from('{"a":1}'));N.plan.set('x/j.json',2);const jl=new T.FileLoader();jl.setResponseType('json');let J=null,J2=null;jl.load('x/j.json',d=>J=d);jl.load('x/j.json',d=>J2=d);await tick(300);
   assert.deepEqual(J,{a:1});assert.deepEqual(J2,{a:1},'second caller of an in-flight URL gets the same data');assert.equal(N.attempts.get('x/j.json'),3,'deduped: one fetch chain');
   N.files.set('x/t.txt',Buffer.from('hello'));const tl=new T.FileLoader();let tx=null;tl.load('x/t.txt',d=>tx=d);await tick(100);assert.equal(tx,'hello');
   const f0=N.fetches;let du=null;const dl=new T.FileLoader();dl.setResponseType('arraybuffer');
   const dfetch=c.fetch;c.fetch=(u,i)=>/^data:/.test(u)?Promise.resolve(new N.R(Buffer.from('zz'))):dfetch(u,i);dl.load('data:application/octet-stream;base64,enp6',d=>du=d);await tick(50);c.fetch=dfetch;
   assert(du&&du.byteLength===2,'data: URL loaded');assert.equal(N.fetches,f0,'data: URL bypassed the fake network pool');
   T.Cache.enabled=true;N.files.set('x/c.bin',Buffer.from('cc'));let c1=null,c2=null;const cl=new T.FileLoader();cl.setResponseType('arraybuffer');cl.load('x/c.bin',d=>c1=d);await tick(80);cl.load('x/c.bin',d=>c2=d);await tick(20);
   assert(c1&&c2===c1,'THREE.Cache honoured');assert.equal(N.attempts.get('x/c.bin'),1);T.Cache.enabled=false;T.Cache.clear();
   if(REAL){const N2=net();gltfMap(N2,base,6);N2.plan.set(base+'textures/t2.png',9);const P=ctx(N2,{ua:FF,patched:true});P.c.xLoaderRetry.backoff=[5,10,20];const u0=unhandled.length;
    const r=await loadMap(P.c,base,5000);assert(!r.hang);const t=textured(r.gl);assert.equal(t.filter(x=>!x).length,1,'only the texture that never loads is missing');
    assert.equal(P.errs.filter(e=>/Couldn't load texture/.test(e)).length,1);await tick(30);assert.deepEqual(unhandled.slice(u0),[]);}
   void errs; }
 // 5. Safari UA: TextureLoader -> ImageLoader <img>, retried + capped
 if(REAL){ const N=net();gltfMap(N,base,40);let inflight=0,peak=0;const att=new Map();
   const doc={createElementNS:(ns,tag)=>{const L={};const el={_l:L,crossOrigin:undefined,addEventListener:(t,f)=>{(L[t]=L[t]||[]).push(f);},removeEventListener:(t,f)=>{L[t]=(L[t]||[]).filter(x=>x!==f);},
     set src(u){this._src=u;inflight++;if(inflight>peak)peak=inflight;const a=(att.get(u)||0)+1;att.set(u,a);const fail=a<=(/t(\d+)/.exec(u)[1]%3);setTimeout(()=>{inflight--;for(const f of (L[fail?'error':'load']||[]).slice())f.call(el,{type:fail?'error':'load'});},2+(a%3));},get src(){return this._src;},width:4,height:4};el.tag=null;return el;}};
   const {c,errs}=ctx(N,{ua:SAFARI,patched:true,doc});const LR=c.xLoaderRetry;LR.backoff=[5,10,20];const u0=unhandled.length;
   const r=await loadMap(c,base,10000);assert(!r.hang,'Safari path settles');let miss=0;r.gl.scene.traverse(o=>{if(o.isMesh&&!(o.material.map&&o.material.map.image&&o.material.map.image._src))miss++;});
   assert.equal(miss,0,'Safari: every texture loaded after retries');assert(peak<=LR.cap,'Safari <img> loads capped ('+peak+')');
   assert.equal(errs.filter(e=>/Couldn't load texture/.test(e)).length,0);await tick(20);assert.deepEqual(unhandled.slice(u0),[]);
   console.log(`  patched Safari (<img>): 40/40 textured, peak ${peak}/${LR.cap}`); }
 // 6. unhandledrejection filter
 { const N=net();const {listeners,warns}=ctx(N,{ua:FF,patched:true});const f=listeners.unhandledrejection&&listeners.unhandledrejection[0];assert(f,'unhandledrejection listener');
   const ev=r=>{const e={reason:r,prevented:false,preventDefault(){this.prevented=true;}};f(e);return e.prevented;};
   assert.equal(ev(new TypeError('Error in input stream')),true);assert.equal(ev(new TypeError('NetworkError when attempting to fetch resource.')),true);assert.equal(ev(new TypeError('Failed to fetch')),true);
   assert.equal(ev(new TypeError('x is not a function')),false,'real bugs still reach the page');assert.equal(ev(new Error('Error in input stream')),false);assert.equal(ev(undefined),false);
   assert.equal(warns.filter(w=>/asset fetch interrupted/.test(w)).length,1,'one warning'); }
 await tick(30);assert.deepEqual(unhandled,[],'no unhandled rejection anywhere');
 console.log('Loader retry: installed after GLTFLoader.js; '+(REAL?'three r149 + r147 GLTFLoader':'three r160 fallback (glTF parts skipped)')+': interrupted texture / glTF / .bin bodies retried up to 3x with backoff, every material textured, fetches capped at 10 (glTF / buffers first), exhausted retries / 404 -> onError, data: bypass, Cache + dedup kept, Safari <img> path retried, fetch-interruption rejections swallowed');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
