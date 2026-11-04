// iOS warm crash (Jeff, 3 Nov 2026: Safari 27 on an iPhone, the tab killed in the loading gate's warm step ~35 s into Ascent, no JS
// error). Measured (qa/ios/warm_probe.cjs, iPhone UA 956x440 @3): the warm step uploaded ~300 MB of non-map textures, ~166 MB of
// map geometry and linked 33 programs in ONE synchronous frame. The gate now runs xWarmStaged (index.html WARM STAGED block)
// before the warm step: the same textures / geometry go up a few MB per frame. Model check, with the page's own xWarmStaged /
// xwsSteps / ... and xWarmTex, on a synthetic match (native map root whose textures the map loader already uploaded + 20 x
// 8 MB map chunks, 10 agent bodies built by xVisB with 3 textures each, hidden ability / effect parts with textures, queued
// viewmodel rigs) and a recording renderer (initTexture / a draw upload a texture or buffer once, three's version rule):
//  - no single step (the frames between the gate's yields) uploads more than 64 MB of textures + buffers
//  - the warm step after it uploads (nearly) nothing: <= 8 MB
//  - exactly the same textures and buffers end up uploaded as by the warm step alone (nothing missed, nothing extra:
//    hidden map / effect geometry still waits for its first draw, the map root's textures are left to the loader)
//  - a superseded load (alive() false) stops staging; the cap stops it too (the warm step uploads the rest, as before)
// INDEX=<older index.html> shows it red (no xWarmStaged: the warm step is one ~400 MB step).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const THREE=require(require.resolve('three',{paths:[path.join(__dirname,'..','server')]}));
const src=fs.readFileSync(process.env.INDEX||path.join(__dirname,'..','index.html'),'utf8');
const A='// ---- WARM STAGED ----',B='// ---- END WARM STAGED ----';
const block=src.includes(A)?src.slice(src.indexOf(A),src.indexOf(B)):'';
const wt=src.match(/\nfunction xWarmTex\(root, skip\) \{[^\n]*\n/);assert(wt,'xWarmTex not found');
const MB=1048576;
function world(){
 // recording renderer
 const up=new WeakMap(),log={cur:0,steps:[],tex:new Set(),buf:new Set()};
 const addUp=(o,ver,bytes,kind)=>{if(up.get(o)===ver)return;up.set(o,ver);log.cur+=bytes;log[kind].add(o);};
 const texB=t=>{const im=t.image||{};return (im.width||0)*(im.height||0)*4*4/3;};
 const upTex=t=>{if(!t||!t.isTexture||!(t.version>0)||!t.image)return;addUp(t,t.version,texB(t),'tex');};
 const upGeo=g=>{for(const k in g.attributes){const a=g.attributes[k];addUp(a,a.version,a.array.byteLength,'buf');}if(g.index)addUp(g.index,g.index.version,g.index.array.byteLength,'buf');};
 const matTex=m=>{for(const k in m){const t=m[k];if(t&&t.isTexture)upTex(t);}};
 let target=null;
 const renderer={initTexture:upTex,getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},getContext:()=>({flush(){}}),compile(){},
  render(sc,cam){sc.updateMatrixWorld();const walk=o=>{if(o.visible===false)return;if(o.isMesh){upGeo(o.geometry);for(const m of [].concat(o.material))matTex(m);}for(const c of o.children)walk(c);};walk(sc);}};
 // scene
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,2,.1,500);camera.position.set(0,0,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const tex=(n,s)=>{const t=new THREE.Texture({width:s,height:s,tag:n});t.needsUpdate=true;return t;};
 const geo=bytes=>{const g=new THREE.BufferGeometry(),n=Math.floor(bytes/(4*8));g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2));g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),5);return g;};
 const mapRoot=new THREE.Group();scene.add(mapRoot);const mapTex=[];
 for(let i=0;i<20;i++){const t=tex('map'+i,1024);mapTex.push(t);upTex(t);/* the map loader's own budgeted upload */const m=new THREE.Mesh(geo(8*MB),new THREE.MeshLambertMaterial({map:t}));m.position.set((i%5)*4-8,0,Math.floor(i/5)*-4);mapRoot.add(m);}
 {const m=new THREE.Mesh(geo(30*MB),new THREE.MeshLambertMaterial({map:mapTex[0]}));m.visible=false;mapRoot.add(m);} // an LOD-hidden map piece: not drawn by the warm frame
 {const m=new THREE.Mesh(geo(30*MB),new THREE.MeshLambertMaterial({map:mapTex[1]}));m.position.set(0,0,200);/* behind the camera */mapRoot.add(m);}
 // hidden ability / effect parts (the native precompile shows them to the compile and xWarmTex uploads their textures)
 const props=new THREE.Group();scene.add(props);for(let i=0;i<60;i++){const m=new THREE.Mesh(geo(.2*MB),new THREE.MeshBasicMaterial({map:tex('prop'+i,1024),alphaMap:i%3?null:tex('pa'+i,512)}));m.visible=false;props.add(m);}
 const st={bfx:false,hit:false,vis:0,lazy:0};
 const G={THREE,renderer,scene,camera,running:true,bots:[],allies:[],xDbOK:false,duelBot:null,NM:{current:{M:{g:mapRoot}}},nmActive:()=>true,
  BFX:{ok:false},bfxInit(){G.BFX.ok=true;st.bfx=true;const g=new THREE.Group();for(let i=0;i<8;i++){const m=new THREE.Mesh(geo(.1*MB),new THREE.MeshBasicMaterial({map:tex('bfx'+i,1024)}));m.visible=false;g.add(m);}scene.add(g);},
  xHitInit(){st.hit=true;},xNoRng:fn=>fn(),VF_WARMQ:[],XVFP:{c:new Map()},VF_RIGS:new Map(),XV:{fp:null},
  xWarmLazy(){st.lazy++;const w=[];const m=new THREE.Mesh(geo(.05*MB),new THREE.MeshBasicMaterial({map:G.lazyTex}));m.frustumCulled=false;w.push(m);for(const x of w)scene.add(x);return w;},
  lazyTex:tex('lazy',512)};
 const bodyTex=[];for(let k=0;k<6;k++)bodyTex.push([tex('ag'+k+'a',1024),tex('ag'+k+'b',1024),tex('ag'+k+'c',512)]);
 for(let i=0;i<10;i++){const b={i,g:null};(i<5?G.bots:G.allies).push(b);}
 G.xVisB=(b,dt,now,ally)=>{st.vis++;if(b.g)return;const T=bodyTex[b.i%6],g=new THREE.Group();g.position.set(b.i*2-10,0,5);for(let k=0;k<3;k++){const m=new THREE.Mesh(geo(.6*MB),new THREE.MeshStandardMaterial({map:T[0],normalMap:T[1],roughnessMap:T[2]}));g.add(m);}scene.add(g);b.g=g;};
 for(let i=0;i<4;i++){const r=new THREE.Group(),h=new THREE.Mesh(geo(1.5*MB),new THREE.MeshBasicMaterial({map:tex('gun'+i,1024)}));h.visible=false;r.add(h,new THREE.Mesh(geo(1*MB),new THREE.MeshBasicMaterial({map:tex('arm'+i,1024)})));G.XVFP.c.set('g'+i,{root:r});}
 // the gate's warm step (xWarmShaders -> native xPrecompile -> vfWarm, the warm draw, its viewmodel warm flush), modelled
 G.warmStep=()=>{const now=0;for(const b of G.bots)G.xVisB(b,0,now,false);for(const b of G.allies)G.xVisB(b,0,now,true);
  const warm=G.xWarmLazy();if(!G.BFX.ok)G.bfxInit();G.xHitInit();const hid=[];scene.traverse(o=>{if(!o.visible&&o!==scene){hid.push(o);o.visible=true;}});
  renderer.compile(scene,camera);G.xWarmTex(scene,mapRoot);for(const o of hid)o.visible=false;for(const F of G.XVFP.c.values())if(!G.VF_WARMQ.includes(F.root))G.VF_WARMQ.push(F.root);for(const m of warm)scene.remove(m);
  // the draw: what the camera's frame draws (frustum culled), then the queued rigs with every part shown
  const F=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));scene.updateMatrixWorld();
  const walk=o=>{if(o.visible===false)return;if(o.isMesh&&(!o.frustumCulled||F.intersectsObject(o))){upGeo(o.geometry);for(const m of [].concat(o.material))matTex(m);}for(const c of o.children)walk(c);};walk(scene);
  for(const R of G.VF_WARMQ.splice(0))R.traverse(o=>{if(o.isMesh){upGeo(o.geometry);matTex(o.material);}});};
 // fake frames: every timer / animation-frame callback starts a new step
 const Q=[];let now=0;G.setTimeout=(f,ms)=>{Q.push({t:now+(ms||0),f});};G.requestAnimationFrame=f=>{Q.push({t:now+16,f});};G.performance={now:()=>now};G.window={};
 const api=new Function(...Object.keys(G).filter(k=>!['warmStep','lazyTex'].includes(k)),wt[0]+'\n'+block+'\nreturn {xWarmTex,xWarmStaged:typeof xWarmStaged==="function"?xWarmStaged:null,XWST:typeof XWST!=="undefined"?XWST:null};')(...Object.keys(G).filter(k=>!['warmStep','lazyTex'].includes(k)).map(k=>G[k]));
 G.xWarmTex=api.xWarmTex;
 log.cur=0; // the map loader's own uploads above are not the warm step's
 const cut=()=>{log.steps.push(log.cur);log.cur=0;};
 const pump=async p=>{let done=false;p.then(()=>{done=true;});for(let n=0;n<100000;n++){await new Promise(r=>setImmediate(r));if(done)return;Q.sort((a,b)=>a.t-b.t);const j=Q.shift();if(!j)continue;now=Math.max(now,j.t);cut();j.f();}throw Error('staging never finished');};
 const gate=async(alive,frameMs)=>{if(frameMs)G.renderer.initTexture=t=>{now+=frameMs;upTex(t);};cut();let R=null;if(api.xWarmStaged){const p=api.xWarmStaged(alive||(()=>true));await pump(p);R=await p;}cut();G.warmStep();cut();return {R,warmMB:log.steps[log.steps.length-1]/MB,steps:log.steps.filter(x=>x>0).map(x=>x/MB)};};
 return {G,api,log,gate,st};}
(async()=>{
 // reference: the warm step alone (what the page did before)
 const ref=world();ref.G.warmStep();const refTex=[...ref.log.tex].map(t=>t.image.tag).sort(),refBuf=ref.log.buf.size,refMB=ref.log.cur/MB;
 assert(refMB>300,'synthetic warm step too small to mean anything ('+refMB.toFixed(0)+' MB)');
 // staged
 const W=world(),out=await W.gate();const top=Math.max(...out.steps);
 console.log(JSON.stringify({warmAloneMB:+refMB.toFixed(1),staged:!!W.api.xWarmStaged,steps:out.steps.length,maxStepMB:+top.toFixed(1),warmStepMB:+out.warmMB.toFixed(1),R:out.R&&{steps:out.R.steps.length,capped:out.R.capped}}));
 assert(top<=64,'one warm step uploads '+top.toFixed(1)+' MB of textures + buffers (> 64 MB): the iPhone warm-frame spike');
 assert(out.warmMB<=8,'the warm step still uploads '+out.warmMB.toFixed(1)+' MB after staging');
 assert.deepEqual([...W.log.tex].map(t=>t.image.tag).sort(),refTex,'staging uploaded a different set of textures than the warm step');
 assert.equal(W.log.buf.size,refBuf,'staging uploaded a different set of buffers than the warm step');
 assert(W.st.bfx&&W.st.hit,'effect pools built');
 // superseded load: staging stops at the next step and the gate's warm step is skipped by the gate itself (id re-check)
 {const S=world();let n=0;const r=await S.gate(()=>++n<3);assert(r.R.steps.length<=2,'a superseded load kept staging ('+r.R.steps.length+' steps)');}
 // the cap: a slow device stops staging after XWS.cap s and the warm step uploads the rest in one go (as before)
 {const S=world();const r=await S.gate(null,400);assert(r.R.capped,'cap never hit');assert(r.R.ms<=(S.api.XWST.cap*1000)+20000,'cap overshoot');const all=[...S.log.tex].map(t=>t.image.tag).sort();assert.deepEqual(all,refTex,'capped: a texture was never uploaded');}
 console.log('test_warm_staged OK');
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
