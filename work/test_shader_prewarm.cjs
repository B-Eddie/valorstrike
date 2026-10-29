// Mid-match shader / texture spikes (drawcalls; browser: programs 46 -> 51 once the match was under way). Checks:
//  A. vfWarm (work/feel_runtime.js): the viewmodel scene (own lights => own programs) is compiled with every built
//     viewmodel in it (cached rigs not in the scene, parts hidden), every texture uploaded; parents, child order of the
//     viewmodel scene and visibility come back exactly as they were; a rig built later (xvFPGet) is warmed on arrival.
//  B. xWarmTex (index.html): uploads every material texture under a root, hidden parts included, never inside the skip
//     root (the native map's own budgeted upload) and never render targets / array textures.
//  C. both precompiles (legacy xPrecompile, native wrapper) show hidden parts at any depth, upload textures and warm
//     the viewmodel pass; the generated page carries the runtime blocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8'),nm=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const block=(src,a,b)=>{const i=src.indexOf(a);assert(i>=0,a);const j=src.indexOf(b,i);assert(j>i,b);return src.slice(i,j);};
const vfSrc=block(feel,'function vfWarm(','\n{const get=xvFPGet;'),getWrap=block(feel,'{const get=xvFPGet;','\n')+'\n';
assert(html.includes(vfSrc)&&html.includes(getWrap.trim()),'index.html carries vfWarm (run work/install_valorant.py)');
const fake=()=>{const r={compiled:[],up:[],compile(s,c){const vis=[];s.traverseVisible(o=>{if(o.isMesh)vis.push(o.name);});this.compiled.push({s,c,vis});},initTexture(t){this.up.push(t.name);}};return r;};
const mesh=(n,tex)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshLambertMaterial({map:tex||null}));m.name=n;return m;};
const tx=n=>{const t=new THREE.Texture({width:4,height:4});t.name=n;return t;};
// ---- A
{const VF_VIEW={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera()},camera=new THREE.PerspectiveCamera(),light=new THREE.HemisphereLight();VF_VIEW.scene.add(light);
 const rig=(n)=>{const root=new THREE.Group(),a=mesh(n+'-arms',tx(n+'-armsT')),g=mesh(n+'-gun',tx(n+'-gunT')),fx=mesh(n+'-fx',tx(n+'-fxT'));fx.visible=false;g.add(fx);root.add(a,g);return {root};};
 const cur=rig('vandal'),knife=rig('knife'),classic=rig('classic');VF_VIEW.scene.add(cur.root);const before=new THREE.Group(),after=new THREE.Group();camera.add(before,knife.root,after);knife.root.visible=false;
 const XVFP={c:new Map([['Jett|Vandal',cur],['Jett|Knife',knife]])},VF_RIGS=new Map([['Jett|Classic',classic]]),XV={fp:cur};
 const r=fake();let built=null;const xvFPGet=()=>Promise.resolve(built);
 const f=new Function('VF_VIEW','XVFP','VF_RIGS','XV','THREE','renderer','xvFPGet',vfSrc+'\n'+getWrap+'return {vfWarm,xvFPGet};')(VF_VIEW,XVFP,VF_RIGS,XV,THREE,r,xvFPGet);
 const order0=VF_VIEW.scene.children.slice();
 const n=f.vfWarm();assert.equal(r.compiled.length,1);assert.equal(r.compiled[0].s,VF_VIEW.scene,'viewmodel scene compiled');assert.equal(r.compiled[0].c,VF_VIEW.camera);
 assert.deepEqual(r.compiled[0].vis.sort(),['classic-arms','classic-fx','classic-gun','knife-arms','knife-fx','knife-gun','vandal-arms','vandal-fx','vandal-gun'],'every rig and hidden part visible while compiling');
 assert.equal(n,9);assert.deepEqual(r.up.sort(),['classic-armsT','classic-fxT','classic-gunT','knife-armsT','knife-fxT','knife-gunT','vandal-armsT','vandal-fxT','vandal-gunT']);
 assert.deepEqual(VF_VIEW.scene.children,order0,'viewmodel scene children restored');assert.deepEqual(camera.children,[before,knife.root,after],'cached rig back under its parent, same place');assert.equal(knife.root.visible,false);assert.equal(classic.root.parent,null);
 for(const R of [cur,knife,classic])assert.equal(R.root.children[1].children[0].visible,false,'hidden parts hidden again');
 built=rig('ghost');r.compiled.length=0;r.up.length=0;f.xvFPGet('Jett','Ghost').then(F=>{assert.equal(F,built);assert.equal(r.compiled.length,1,'a rig built mid-match is compiled on arrival');assert.deepEqual(r.compiled[0].vis.filter(x=>/ghost/.test(x)).sort(),['ghost-arms','ghost-fx','ghost-gun']);assert.equal(built.root.parent,null);assert.equal(F.vfWarm,1);
  return f.xvFPGet('Jett','Ghost');}).then(()=>{assert.equal(r.compiled.length,1,'warmed once per rig');console.log('shader prewarm: OK');}).catch(e=>{console.error(e);process.exit(1);});}
// ---- B
{const src=block(html,'function xWarmTex(','\nfunction xPrecompile()'),r=fake();const xWarmTex=new Function('renderer',src+'\nreturn xWarmTex;')(r);
 const sc=new THREE.Scene(),mapRoot=new THREE.Group(),hid=mesh('hid',tx('hidT'));hid.visible=false;const deep=new THREE.Group();deep.visible=false;deep.add(hid);sc.add(deep,mapRoot);mapRoot.add(mesh('map',tx('mapT')));
 const rt=mesh('rt');rt.material.map=new THREE.WebGLRenderTarget(4,4).texture;rt.material.map.name='rtT';sc.add(rt);const arr=mesh('arr');arr.material.map=new THREE.DataArrayTexture(new Uint8Array(64),2,2,4);arr.material.map.name='arrT';sc.add(arr);
 const sh=mesh('shared',hid.material.map);sh.material=hid.material;sc.add(sh);
 xWarmTex(sc,mapRoot);assert.deepEqual(r.up,['hidT'],'hidden texture uploaded once; map root, render target and array textures skipped');}
// ---- C
const pre=block(html,'function xPrecompile() {','\n// Loading-gate bridge');assert(/scene\.traverse\(\(o\) => \{ if \(!o\.visible && o !== scene\)/.test(pre)&&/xWarmTex\(scene\)/.test(pre)&&/vfWarm\(\)/.test(pre),'legacy precompile: deep hidden, textures, viewmodel');
const w=block(nm,'{const precompile=xPrecompile;','\n');assert(/scene\.traverse\(o=>\{if\(!o\.visible&&o!==scene\)/.test(w)&&/xWarmTex\(scene,NM\.current/.test(w)&&/vfWarm\(\)/.test(w),'native precompile: deep hidden, textures (map root skipped), viewmodel');
assert(html.includes(w.trim()),'index.html carries the native precompile');
