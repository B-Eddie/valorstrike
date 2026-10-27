// Native-map memory budget (rows 1/12): packed geometry (Int8x4 normals, Uint16 indices), texture cap per quality
// tier, CPU copies dropped once the GPU holds them, eager texture upload during loading, and a scene reload when a new
// WebGL context (anti-aliasing switch / restored context) would otherwise have nothing to upload from.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const pick=n=>{const i=src.indexOf('function '+n+'(');assert(i>=0,n+' missing');return src.slice(i,src.indexOf('\n',i));};
const block=n=>{let i=src.indexOf('async function '+n+'(');if(i<0)i=src.indexOf('function '+n+'(');let j=src.indexOf('\nfunction ',i+1),k=src.indexOf('\nasync function ',i+1);if(k>0&&k<j)j=k;return src.slice(i,j);};
// Loader wiring, in the runtime and in the generated page.
for(const s of [src,html]){
 assert(/const t0=nmNow\(\);nmPrepareScene\(gl\.scene\);[^\n]*const mem=await nmBudget\(gl\.scene,nmTexCap\(\)\);/.test(s),'loader does not budget the scene before use');
 assert(/scene\.add\(root\);[^\n]*await nmUpload\(mem\.textures,\(\)=>ticket===NM\.ticket\);[^\n]*nmOverlay\(null\);return C;/.test(s),'textures are not uploaded during loading');
 assert(s.includes('{const remake=xRemake;xRemake=function(){const before=renderer,result=remake.apply(this,arguments);if(renderer!==before){nmWatchContext(renderer);nmRehydrate();}return result;};nmWatchContext(renderer);}'),'renderer recreation does not reload the map');
}
assert(!/gl\.scene\.traverse\(o=>\{if\(!o\.isMesh\)return;o\.geometry\.userData\.shared/.test(src),'old in-line conversion still present');
// Render meshes are never ray-cast: the native map's solids are the BVH collision mesh alone (dropped arrays are safe).
assert(src.includes("const M={g:root,solids:[collision],boxes:[],built:1,native:true};"));
const env={THREE,renderer:{initTexture(t){env.uploads.push(t);if(t.onUpdate)t.onUpdate(t);},capabilities:{getMaxAnisotropy:()=>8}},uploads:[],created:[],closed:0,NM:{current:null},
 createImageBitmap:async(img,o)=>{const b={width:o.resizeWidth,height:o.resizeHeight,close(){env.closed++;},resized:o};env.created.push(b);return b;},document:{createElement:()=>({getContext:()=>({drawImage(){}})})},
 nmFree:r=>env.freed.push(r.M.g),freed:[],nmTexStats:()=>null,nmDecalApply:m=>m,nmDecalStyle:()=>null,nmFoliageApply:m=>m,console:{error(){},warn(){}},localStorage:{getItem:k=>k==='vs.gq'?env.quality:(env.ls[k]??null)},ls:{},quality:null,xLowDev:false,navigator:{}};
const names=['nmNow','nmQuality','nmTexCap','nmBytes','nmTexBytes','nmDropArray','nmTexUploaded','nmWatchContext','nmDrawable'],blocks=['nmPackGeometry','nmShrink','nmBudget','nmUpload','nmRehydrate'];
const api=new Function('env','with(env){'+names.map(pick).join('\n')+'\n'+blocks.map(block).join('\n')+';return {'+names.concat(blocks).join(',')+'};}')(env);
(async()=>{
 // Quality tiers: LOW (mobile default) and devices reporting <= 4 GB get 256 px textures; others keep the 512 px sources.
 assert.equal(api.nmTexCap('low',8),256);assert.equal(api.nmTexCap('medium',8),0);assert.equal(api.nmTexCap('high',undefined),0);assert.equal(api.nmTexCap('custom',8),0);
 assert.equal(api.nmTexCap('high',4),256);assert.equal(api.nmTexCap('medium',2),256);
 env.quality=null;env.xLowDev=true;assert.equal(api.nmQuality(),'low');env.xLowDev=false;assert.equal(api.nmQuality(),'medium');env.quality='high';assert.equal(api.nmQuality(),'high');
 // A custom set keeps the cap of the preset it came from (browser: LOW + AA switch re-prepared Lotus with 149 MB instead of 41 MB of textures).
 env.quality='custom';assert.equal(api.nmQuality(),'custom');assert.equal(api.nmTexCap(undefined,8),0);env.ls['vs.gqb']='low';assert.equal(api.nmQuality(),'low');assert.equal(api.nmTexCap(undefined,8),256);env.ls['vs.gqb']='medium';assert.equal(api.nmTexCap(undefined,8),0);env.ls={};env.quality='high';
 {const H=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),i=H.indexOf('const xGQP = {'),j=H.indexOf('\nfunction xSkyApply',i),k=H.indexOf('function xGQSync() {'),l=H.indexOf('\nfunction xGQUi',k);assert(i>0&&j>i&&k>0&&l>k);
  const L={},G={XS:{scale:'1',res:'std',shd:'off',aa:false,sky:false},localStorage:{setItem:(a,b)=>{L[a]=b;}},$:()=>({}),xSegOn(){}};vm.createContext(G);vm.runInContext(H.slice(i,j)+'\n'+H.slice(k,l)+';globalThis.sync=xGQSync;',G);
  G.sync();assert.deepEqual(L,{'vs.gq':'low','vs.gqb':'low'});G.XS.aa=true;G.sync();assert.deepEqual(L,{'vs.gq':'custom','vs.gqb':'low'},'switching AA on LOW must remember LOW as the base preset');
  Object.assign(G.XS,{res:'retina',shd:'map',aa:true,sky:true});G.sync();assert.deepEqual(L,{'vs.gq':'medium','vs.gqb':'medium'});}
 // Real Lotus geometry: normals within 0.7 deg, indices identical, bytes down, arrays dropped on upload with bounds/counts kept.
 const dir=path.join(root,'models/valorant/maps/lotus'),g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8')),bufs=new Map();
 const T={5126:Float32Array,5125:Uint32Array,5123:Uint16Array},N={SCALAR:1,VEC2:2,VEC3:3};
 const acc=i=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView];if(!bufs.has(v.buffer))bufs.set(v.buffer,fs.readFileSync(path.join(dir,g.buffers[v.buffer].uri)));const b=bufs.get(v.buffer),C=T[a.componentType],n=a.count*N[a.type],o=b.byteOffset+(v.byteOffset||0)+(a.byteOffset||0);return new C(b.buffer.slice(o,o+n*C.BYTES_PER_ELEMENT));};
 let before=0,after=0,worst=1,meshes=0,u16=0,big=0;
 for(const mesh of g.meshes.slice(0,40))for(const p of mesh.primitives){const geo=new THREE.BufferGeometry(),pos=acc(p.attributes.POSITION),nrm=acc(p.attributes.NORMAL),idx=acc(p.indices);geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nrm,3));geo.setAttribute('uv',new THREE.BufferAttribute(acc(p.attributes.TEXCOORD_0),2));geo.setIndex(new THREE.BufferAttribute(idx,1));
  const [a,b]=api.nmPackGeometry(geo);before+=a;after+=b;meshes++;const q=geo.attributes.normal;assert(q.array instanceof Int8Array&&q.itemSize===4&&q.normalized);
  for(let i=0;i<q.count;i+=7){const x=q.array[i*4]/127,y=q.array[i*4+1]/127,z=q.array[i*4+2]/127,l=Math.hypot(x,y,z),o=Math.hypot(nrm[i*3],nrm[i*3+1],nrm[i*3+2])||1;worst=Math.min(worst,(x*nrm[i*3]+y*nrm[i*3+1]+z*nrm[i*3+2])/l/o);}
  const I=geo.index.array;if(pos.length/3<=65535){assert(I instanceof Uint16Array);u16++;}else{assert(I instanceof Uint32Array);big++;}for(let i=0;i<I.length;i+=11)assert.equal(I[i],idx[i]);
  assert(geo.boundingSphere&&geo.boundingSphere.radius>0&&geo.boundingBox);const counts={};for(const k in geo.attributes)counts[k]=geo.attributes[k].count;const ic=geo.index.count;
  for(const k in geo.attributes)geo.attributes[k].onUploadCallback();geo.index.onUploadCallback(); // what WebGLAttributes.createBuffer does after bufferData
  for(const k in geo.attributes){assert.equal(geo.attributes[k].array,null);assert.equal(geo.attributes[k].count,counts[k]);}assert.equal(geo.index.array,null);assert.equal(geo.index.count,ic);
  const cam=new THREE.PerspectiveCamera(),fr=new THREE.Frustum().setFromProjectionMatrix(cam.projectionMatrix);const m=new THREE.Mesh(geo);m.updateMatrixWorld();fr.intersectsObject(m); // culling after the drop needs no array
 }
 assert(Math.acos(Math.min(1,worst))*180/Math.PI<0.7,'normal error '+Math.acos(worst)*180/Math.PI);assert(after<before*0.8,'geometry not smaller '+before+' -> '+after);assert(u16>0);
 // Textures: cap shrinks (old bitmap closed), shared sources are released only after every texture using them uploaded.
 const bitmap=(w,h)=>({width:w,height:h,close(){this.closed=true;}});
 const makeScene=(cap)=>{const scene=new THREE.Group(),A=new THREE.Texture(bitmap(512,512)),B=A.clone(),C=new THREE.Texture(bitmap(256,128)),D=new THREE.Texture(bitmap(512,256));
  const mk=(...maps)=>maps.map(t=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array([0,1,0,0,1,0,0,1,0]),3));return new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:t}));});
  scene.add(...mk(A,B,C,D));return {scene,A,B,C,D,orig:[A.image,C.image,D.image]};};
 let s=makeScene(),mem=await api.nmBudget(s.scene,256);
 assert.equal(mem.textures.length,4);assert.equal(s.A.image.width,256);assert.equal(s.A.image.height,256);assert.equal(s.D.image.width,256);assert.equal(s.D.image.height,128);assert.equal(s.C.image,s.orig[1],'small texture untouched');
 assert(s.orig[0].closed&&s.orig[2].closed,'full-size decoded images not closed after shrinking');assert.equal(s.A.image.resized.premultiplyAlpha,'none');
 assert.equal(mem.texture[0],Math.round(512*512*16/3)+Math.round(256*128*16/3)+Math.round(512*256*16/3),'shared source not counted once');
 assert(mem.texture[1]<mem.texture[0]/3,'cap does not cut texture bytes');
 const shrunk=s.A.image;s.A.onUpdate(s.A);assert(!shrunk.closed&&s.A.source.data===shrunk,'shared source released before its second texture uploaded');s.B.onUpdate(s.B);assert(env.closed>=1&&s.A.source.data===null,'shared source not released after both uploads');
 s=makeScene();mem=await api.nmBudget(s.scene,0);assert.equal(s.A.image,s.orig[0],'uncapped tier must keep the source');assert.equal(mem.texture[0],mem.texture[1]);
 env.uploads.length=0;await api.nmUpload(mem.textures,()=>true);assert.equal(env.uploads.length,4);assert(s.orig[0].closed&&s.orig[1].closed&&s.orig[2].closed,'decoded images survive upload');assert.equal(s.C.source.data,null);
 let live=true;env.uploads.length=0;s=makeScene();mem=await api.nmBudget(s.scene,0);const many=[];for(let i=0;i<60;i++)many.push(mem.textures[i%4]);const pr=api.nmUpload(many,()=>live);live=false;await pr;assert(env.uploads.length<=24,'upload continues for a cancelled load');
 // New WebGL context: the scene is reloaded and prepared again, the old one hidden at once and freed; a map change mid-reload discards it.
 const key='lotus',mapRoot=new THREE.Group(),oldScene=new THREE.Group();mapRoot.add(oldScene);let next=makeScene(),loads=0;
 env.nmLoadScene=async()=>{loads++;await new Promise(r=>setTimeout(r,5));return {scene:next.scene};};env.nmPrepareScene=x=>x;env.nmZFixApply=()=>0;/* z-fight fix and render optimizer run after prepare; stubbed here */env.nmOptimizeScene=()=>({meshes:0,chunks:0,materials:0});env.quality='low';
 const C0={key,M:{g:mapRoot},scene:oldScene,memory:{collisionBytes:7,textures:[]}};env.NM.current=C0;env.freed.length=0;
 const p1=api.nmRehydrate();assert.equal(oldScene.visible,false,'old scene (no CPU copies) must not draw in the new context');assert.equal(await p1,true);assert.equal(loads,1);assert.equal(C0.scene,next.scene);assert(mapRoot.children.includes(next.scene)&&!mapRoot.children.includes(oldScene));assert(env.freed.includes(oldScene));assert.equal(C0.memory.rehydrated,1);assert.equal(C0.memory.cap,256);assert.equal(C0.memory.collisionBytes,7);
 next=makeScene();const p2=api.nmRehydrate();env.NM.current={key:'bind'};assert.equal(await p2,false);assert(env.freed.includes(next.scene),'stale reload not freed');
 // A second context change while a reload is still uploading supersedes it (quality Low -> Medium in quick succession went
 // black: the first reload's scene had been drawn by the in-between renderer, CPU copies gone, and the newest renderer was
 // left to draw it): the in-flight scene is hidden at once, the newest reload replaces it, the superseded one stops.
 {env.NM.current=C0;const A=makeScene(),B=makeScene();const queue=[A,B];env.nmLoadScene=async()=>{loads++;await new Promise(r=>setTimeout(r,5));return {scene:queue.shift().scene};};
  const pa=api.nmRehydrate();for(let i=0;i<500&&C0.scene!==A.scene;i++)await new Promise(r=>setTimeout(r,1));assert.equal(C0.scene,A.scene,'first reload swapped in');assert.equal(A.scene.visible,true);
  A.scene.traverse(o=>{if(o.isMesh)for(const k in o.geometry.attributes)o.geometry.attributes[k].array=null;});/* drawn by the in-between renderer: CPU copies dropped */
  const pb=api.nmRehydrate();assert.equal(A.scene.visible,false,'a superseded reload\'s scene (no CPU copies) must not draw in the newest context');
  const [ra,rb]=await Promise.all([pa,pb]);assert.equal(rb,true,'the newest reload completes');assert.equal(C0.scene,B.scene);assert(mapRoot.children.includes(B.scene)&&!mapRoot.children.includes(A.scene),'only the newest scene stays');assert(env.freed.includes(A.scene),'superseded scene freed');assert.equal(B.scene.visible,true);assert.equal(C0.rehydrating,false);
  // a reload superseded before it swapped frees its own scene and leaves the newest one in place
  const D=makeScene(),E=makeScene();queue.push(D,E);const pd=api.nmRehydrate(),pe=api.nmRehydrate();assert.equal(await pd,false,'superseded before the swap');assert.equal(await pe,true);assert.equal(C0.scene,E.scene);assert(env.freed.includes(D.scene)&&env.freed.includes(B.scene));assert(!mapRoot.children.includes(D.scene));}
 // a failed reload shows the old scene again only while it still has its CPU copies (a drawn one would throw every frame)
 env.NM.current=C0;env.nmLoadScene=async()=>{throw new Error('offline');};const kept=C0.scene;assert.equal(await api.nmRehydrate(),false);assert.equal(kept.visible,true,'failed reload must restore the old scene');
 kept.traverse(o=>{if(o.isMesh)o.geometry.attributes.position.array=null;});assert.equal(await api.nmRehydrate(),false);assert.equal(kept.visible,false,'a failed reload must not show a scene the new context cannot upload');
 // Restored context on the current renderer triggers a reload; listeners attach once per canvas.
 const listeners=[],canvas={addEventListener:(n,f)=>listeners.push([n,f])},r={domElement:canvas};env.renderer=r;api.nmWatchContext(r);api.nmWatchContext(r);assert.equal(listeners.length,1);assert.equal(listeners[0][0],'webglcontextrestored');
 env.NM.current=null;listeners[0][1]();await new Promise(r=>setTimeout(r,1));
 console.log('Map memory budget: '+meshes+' Lotus meshes packed '+(before/1e6).toFixed(1)+' -> '+(after/1e6).toFixed(1)+' MB (worst normal '+(Math.acos(Math.min(1,worst))*180/Math.PI).toFixed(2)+' deg, '+u16+' Uint16 / '+big+' Uint32 indices), arrays dropped on upload with bounds kept; LOW/<=4 GB cap 256 px, shared sources released after the last upload; eager upload stops on cancel; new context reloads the scene, hides the old one, a newer context change supersedes a reload in flight, discards stale/failed reloads');
})().catch(e=>{console.error(e);process.exit(1);});
