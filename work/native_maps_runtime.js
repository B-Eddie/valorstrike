// ---- ORIGINAL VALORANT MAPS ----
// Entire source scenes, collisions and navigation replace the six legacy blockouts.
var NM = { current:null, pending:null, ticket:0, enabled:true, progress:null, routeCache:new Map() };
function nmActive(){return NM.current && MAPS[mode]===NM.current.M && solids===NM.current.M.solids ? NM.current : null;}
function nmOverlay(name,error){let e=document.getElementById('nativeMapLoading');if(!e){e=document.createElement('div');e.id='nativeMapLoading';e.style.cssText='position:fixed;inset:0;z-index:500;background:#0f1923;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;color:#ece8e1;font:600 20px Arial;text-align:center';e.innerHTML='<span></span><small style="font-size:14px;font-weight:400;max-width:480px"></small>';document.body.append(e);}e.style.display=name?'flex':'none';if(name){e.firstChild.textContent=error?'Could not load '+name:'Loading '+name;e.querySelector('small').textContent=error?'Check your connection and choose the map again.': 'Preparing the map…';}if(error&&!e.querySelector('[data-back]')){const back=document.createElement('button');back.dataset.back='true';back.textContent='Back';back.style.cssText='padding:12px 30px;background:#ff4655;color:white;border:0;cursor:pointer';back.onclick=()=>{e.style.display='none';closeAll();$('lobby').style.display='flex';};e.append(back);}if(e.querySelector('[data-back]'))e.querySelector('[data-back]').hidden=!error;if(!e.querySelector('[data-cancel]')){const cancel=document.createElement('button');cancel.dataset.cancel='true';cancel.textContent='Cancel';cancel.style.cssText='padding:12px 30px;background:#263744;color:white;border:0;cursor:pointer';cancel.onclick=()=>{nmCancel();closeAll();$('lobby').style.display='flex';};e.append(cancel);}e.querySelector('[data-cancel]').hidden=!!error;NM.progress=e;}
function nmFree(C){if(!C)return;scene.remove(C.M.g);const seen=new Set();C.M.g.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}for(const m of [].concat(o.material||[]))if(!seen.has(m)){seen.add(m);for(const k in m)if(m[k]&&m[k].isTexture&&!seen.has(m[k])){seen.add(m[k]);const image=m[k].source?.data||m[k].image;if(image&&typeof image.close==='function')image.close();m[k].dispose();}m.dispose();}});if(C.geometry){C.geometry.dispose();C.geometry.boundsTree=null;}C.M.g.clear();}
async function nmCollision(key,signal){
 const base=(typeof NET!=='undefined'?NET.url:'https://valorstrike-game.itsmybirthdayim7.workers.dev')+'/worlds/'+key+'/',read=async f=>{const r=await fetch(base+f,{signal});if(!r.ok)throw Error('Collision '+f+' '+r.status);return r;},meta=await(await read('meta.json')).json(),[positions,index,...roots]=await Promise.all([read('position.bin').then(r=>r.arrayBuffer()),read('index.bin').then(r=>r.arrayBuffer()),...Array.from({length:meta.roots},(_,i)=>read('bvh'+i+'.bin').then(r=>r.arrayBuffer()))]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions),3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index),1));geometry.boundsTree=MeshBVHLib.MeshBVH.deserialize({index:geometry.index.array,roots},geometry,{setIndex:false});return geometry;
}
function nmCancel(interactive=true){const pending=NM.pending;++NM.ticket;NM.pending=null;if(pending?.controller)pending.controller.abort(Object.assign(new Error('Map selection changed'),{name:'AbortError'}));nmOverlay(null);if(interactive&&window.xCancelMatchLoad)window.xCancelMatchLoad();if(interactive&&typeof NET!=='undefined'&&NET.socket&&typeof mpLost==='function')mpLost('Map loading cancelled');}
async function nmEnsure(key){
 if(NM.current&&NM.current.key===key){if(NM.pending){nmCancel(false);}return NM.current;}
 if(NM.pending&&NM.pending.key===key)return NM.pending.promise;
 if(NM.pending)nmCancel(false);
 const ticket=++NM.ticket,controller=new AbortController();let loadedGeometry=null,loadedScene=null,committed=false,failed=false;
 const release=()=>{if(loadedScene||loadedGeometry){nmFree({M:{g:loadedScene||new THREE.Group()},geometry:loadedGeometry});loadedScene=loadedGeometry=null;}};
 const timeout=setTimeout(()=>controller.abort(new Error('Map loading timed out. Please retry.')),120000);
 nmOverlay(key.charAt(0).toUpperCase()+key.slice(1));
 const promise=(async()=>{const base='models/valorant/maps/'+key+'/';const read=url=>fetch(base+url,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error(url+' '+r.status);return r;});
  const tLoad=nmNow(),aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(controller.signal.reason||new Error('Map selection changed')),{once:true}));
  const [meta,nav,geometry,gl,plants]=await Promise.race([aborted,Promise.all([read('map.json').then(r=>r.json()),read('navigation.json').then(r=>r.json()),nmCollision(key,controller.signal).catch(async e=>{if(controller.signal.aborted)throw e;const bytes=await read('collision.bin').then(r=>r.arrayBuffer()),head=new Uint32Array(bytes,0,2),positions=new Float32Array(bytes,8,head[0]*3),indices=new Uint32Array(bytes,8+head[0]*12,head[1]),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(new THREE.BufferAttribute(indices,1));g.boundsTree=new MeshBVHLib.MeshBVH(g,{maxLeafTris:12,maxDepth:64,strategy:MeshBVHLib.CENTER});return g;}).then(g=>{loadedGeometry=g;if(failed||controller.signal.aborted){release();throw controller.signal.reason||new Error('Map selection changed');}return g;}),nmLoadScene(base,ticket).then(gl=>{loadedScene=gl.scene;if(failed||controller.signal.aborted){release();throw controller.signal.reason||new Error('Map selection changed');}return gl;}),read('plants.json').then(r=>r.json())])]);
  if(ticket!==NM.ticket){release();throw new Error('Map selection changed');}
  if(!nav.validation.attackerToDefender||Object.values(nav.validation.attackerToSites).some(v=>!v))throw new Error('Map navigation is incomplete');
  NM.progress.querySelector('small').textContent='Preparing the map…';await new Promise(r=>setTimeout(r,20));if(ticket!==NM.ticket){release();throw new Error('Map selection changed');}
  const collision=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,visible:false}));collision.name='native-collision';collision.raycast=MeshBVHLib.acceleratedRaycast;
  const root=xMG();root.name='native-'+key;root.userData.nativeMap=key;root.visible=false;root.add(gl.scene,collision);const M={g:root,solids:[collision],boxes:[],built:1,native:true};
  const t0=nmNow();nmPrepareScene(gl.scene);NM.progress.querySelector('small').textContent='Fitting the map to this device…';const mem=await nmBudget(gl.scene,nmTexCap());if(ticket!==NM.ticket){release();throw new Error('Map selection changed');}mem.prepareMs=Math.round(nmNow()-t0);mem.loadMs=Math.round(t0-tLoad);
  const C={key,meta,nav,plants,M,geometry,bvh:geometry.boundsTree,image:new Image(),cells:new Map(),cellSize:2,scene:gl.scene,memory:mem};mem.collisionBytes=nmBytes(geometry);C.image.src=base+'minimap.png';nmConnected(C);root.add(nmSkirt(nmSkirtSpec(nav.nodes,C.playable)));nav.nodes.forEach((p,i)=>{if(!C.playable[i])return;const k=Math.floor(p[0]/2)+','+Math.floor(p[2]/2);if(!C.cells.has(k))C.cells.set(k,[]);C.cells.get(k).push(i);});
  nmSiteGoals(C);
  // Only the original playable footprint defines navigation/minimap bounds; vista geometry is still rendered.
  const X=nav.nodes.filter((_,i)=>C.playable[i]).map(p=>p[0]),Z=nav.nodes.filter((_,i)=>C.playable[i]).map(p=>p[2]);C.bounds={x1:Math.min(...X)-3,x2:Math.max(...X)+3,z1:Math.min(...Z)-3,z2:Math.max(...Z)+3};
  const b=C.bounds;M.boxes.push({x1:b.x1,x2:b.x2,z1:b.z1,z2:b.z1,h:0},{x1:b.x1,x2:b.x2,z1:b.z2,z2:b.z2,h:0});
  if(NM.current){const old=NM.current;if(fsM.parent)fsM.parent.remove(fsM);if(spike.parent&&spike.parent===old.M.g)spike.parent.remove(spike);nmFree(old);for(const k in FMAP)if(FMAP[k]===old.M){const g=new THREE.Group();g.visible=false;FMAP[k]={g,solids:[],boxes:[],built:0};}}
  committed=true;loadedScene=loadedGeometry=null;NM.current=C;NM.routeCache.clear();scene.add(root);NM.progress.querySelector('small').textContent='Uploading map textures…';const t1=nmNow();await nmUpload(mem.textures,()=>ticket===NM.ticket);mem.uploadMs=Math.round(nmNow()-t1);if(ticket===NM.ticket)nmOverlay(null);return C;
 })().catch(e=>{failed=true;controller.abort(e);if(!committed)release();if(ticket===NM.ticket)nmOverlay(key,true);console.error('Original map load failed',key,e);throw e;}).finally(()=>{clearTimeout(timeout);if(NM.pending&&NM.pending.ticket===ticket)NM.pending=null;});NM.pending={key,ticket,promise,controller};return promise;
}
// Decals and floaters (#lotus-white): the ports export every Decal_/Floater_ material as OPAQUE although
// their textures carry the cut-out in alpha, so murals drew as rectangles and destruction/edge-wear masks
// (pure white RGB, the real shader only uses their alpha to reveal damage) drew as solid white jagged patches
// on walls (Lotus spawn, Ascent/Bind/Breeze/Haven/Split brick edges). A decal whose texture really has alpha is
// alpha-blended without depth writes, pulled toward the camera with polygon offset; a white mask floater is
// tinted to a soft dark grime so it reads as wear instead of paint. Textures with no alpha stay opaque.
function nmTexStats(img){try{if(!img||!(img.width>0))return null;const n=16,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,n,n);const d=x.getImageData(0,0,n,n).data;let lo=255,cover=0,white=0,cut=0;for(let i=0;i<d.length;i+=4){const a=d[i+3];lo=Math.min(lo,a);if(a<128)cut++;if(a>32){cover++;if(Math.min(d[i],d[i+1],d[i+2])>220)white++;}}return {minAlpha:lo,white:cover?white/cover:0,cut:cut/(n*n)};}catch(e){return null;}}
function nmDecalStyle(name,stats){if(!/Decal|Floater/i.test(name||'')||!stats||stats.minAlpha>=250)return null;return /Floater/i.test(name)&&stats.white>.9?'mask':'decal';}
// Foliage cut-outs: plants, vines, moss overgrowth, leaves, ferns and tree cards are also exported OPAQUE (only
// some foliage keeps alphaMode MASK) although their textures carry the leaf silhouette in alpha, so vines and moss
// drew as solid sheets with their card edges showing (Lotus walls). Foliage materials whose texture really cuts
// (>=2% of texels under half alpha) get the export's own 0.45 alpha test. Blended walls/floors (moss blends keep a
// height mask in alpha), trunks, bark, pots and planters stay opaque.
function nmFoliageCut(name,stats){return !!(stats&&stats.cut>=.02&&/Plant(?!er)|Vines|Foliage|Leaf|Leaves|Fern|Shrub|Creeper|Bush|MossOvergrowth|Flower|Ivy|Canopy|TreeCard|Conifer|Arborvitae|Palm|Bonsai|Bananna|Agave|Cabbage|Jasmine|Philodendron|MorningGlory|Cables/i.test(name||'')&&!/Blend|Trunk|Bark|Planter|Wall|Floor|Stone|Rock|Tile|Brick|Plaster|Mural|Decal|Floater|Light|Lamp|Glass|Sack|Graffiti|Vista_2_M1/i.test(name));}
function nmFoliageApply(mat,name,stats){if(!mat.transparent&&!(mat.alphaTest>0)&&nmFoliageCut(name,stats)){mat.alphaTest=.45;mat.userData.cutout=true;}return mat;}
function nmDecalApply(mat,style){if(!style)return mat;mat.transparent=true;mat.depthWrite=false;mat.alphaTest=.02;mat.polygonOffset=true;mat.polygonOffsetFactor=-2;mat.polygonOffsetUnits=-2;mat.opacity=1;if(style==='mask'){mat.color.setHex(0x2e2924);mat.opacity=.45;}mat.userData.decal=style;return mat;}
// Backdrop skirt (#5): the exported render meshes stop at the map edge, so looking out or down past
// them showed the sky below the horizon. A ground disc 1.5 m under the lowest playable floor plus a ring
// wall rising past the highest eye line fill those pixels. Both draw first without writing depth, so
// every real surface still draws over them: the skirt can only ever replace void, never hide geometry.
function nmSkirtSpec(nodes,playable){let y0=Infinity,y1=-Infinity;for(let i=0;i<nodes.length;i++){if(playable&&!playable[i])continue;y0=Math.min(y0,nodes[i][1]);y1=Math.max(y1,nodes[i][1]);}return {y:y0-1.5,top:y1+12};}
// Radius follows the camera: inside the far plane (any mode's), and past fog.far so the ring reads as horizon haze.
function nmSkirtRadius(far,fogFar){return Math.max(20,Math.min(far*.92,Math.max((fogFar||0)+15,300)));}
function nmSkirt(spec){const g=new THREE.Group();g.name='native-skirt';const mat=c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,depthWrite:false,fog:true});
 const ground=new THREE.Mesh(new THREE.CircleGeometry(1,48).rotateX(-Math.PI/2),mat(0x56544b)),ring=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,48,1,true),mat(0x8d8a80));
 const follow=(m,isRing)=>(r,s,cam)=>{const R=nmSkirtRadius(cam.far,s.fog&&s.fog.far);m.position.set(cam.position.x,isRing?(spec.y+spec.top)/2:spec.y,cam.position.z);m.scale.set(R,isRing?spec.top-spec.y:1,R);m.updateMatrixWorld(true);};
 ground.onBeforeRender=follow(ground,false);ring.onBeforeRender=follow(ring,true);
 for(const m of [ground,ring]){m.renderOrder=-10;m.frustumCulled=false;m.raycast=()=>{};m.castShadow=m.receiveShadow=false;m.userData.skirt=true;g.add(m);}g.userData.spec=spec;return g;}
// Memory budget (#1/#12): a native-map match used ~5 GB across Chromium processes. The map scene was held three
// times over: the GLTF typed arrays and decoded ImageBitmaps stayed in the page after upload, the GPU kept its own
// copy (and in SwiftShader/ANGLE that is page-process memory too), and normals/indices were stored at full float/
// uint32 width. Each prepared map now (1) stores normals as normalized Int8x4 (12 -> 4 bytes/vertex) and indices as
// Uint16 wherever a mesh has <= 65535 vertices; (2) caps texture size at 256 px on the LOW preset or a device
// reporting <= 4 GB (512 px sources otherwise, unchanged); (3) drops each attribute's array and each decoded image
// once the GPU holds it (bounds are computed first; render meshes are never raycast: native solids are the BVH
// collision mesh only); (4) uploads every texture during loading instead of at first sight. A new WebGL context
// (anti-aliasing switch -> xRemake, or a restored context) has nothing to re-upload from, so the scene is reloaded
// from the HTTP cache and prepared again (nmRehydrate) at the then-current texture cap.
function nmNow(){return typeof performance!=='undefined'?performance.now():Date.now();}
function nmLoadScene(base,ticket){return new THREE.GLTFLoader(new THREE.LoadingManager(()=>{},(url,done,total)=>{if(ticket===NM.ticket)NM.loaded=total?done/total:0;/* reported to the server while loading (lp) */if(ticket===NM.ticket&&NM.progress)NM.progress.querySelector('small').textContent='Loading map assets '+done+' / '+total+'…';})).loadAsync(base+'scene.gltf');}
function nmPrepareScene(root){root.traverse(o=>{if(!o.isMesh)return;o.geometry.userData.shared=true;o.castShadow=false;o.receiveShadow=false;const convert=m=>{const terrain=/Floor|Ground|(?:Stone|Brick|Dirt|Gravel|Tile|Grass|Jam|Stairs).*Grass|Grass.*Stone|Blendable.*Gravel/i.test(m.name)&&!/Cards|Decal|Floater/i.test(m.name);const out=new THREE.MeshLambertMaterial({name:m.name,color:m.color,map:m.map,side:THREE.DoubleSide,alphaTest:terrain?0:m.alphaTest||0,transparent:terrain?false:m.transparent,opacity:terrain?1:m.opacity});m.dispose();if(m.map)m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());const st=m.map&&nmTexStats(m.map.image);nmDecalApply(out,nmDecalStyle(m.name,st));nmFoliageApply(out,m.name,st);return out;};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});return root;}
// A custom set (e.g. LOW with anti-aliasing switched on) keeps the texture cap of the preset it came from (vs.gqb): the AA switch re-prepares the map and dropped the LOW 256 px cap (41 -> 149 MB of Lotus textures).
function nmQuality(){let q=null;try{q=localStorage.getItem('vs.gq');if(q==='custom')q=localStorage.getItem('vs.gqb')||q;}catch(e){}if(!q)q=typeof xLowDev!=='undefined'&&xLowDev?'low':'medium';return q;}
function nmTexCap(quality,deviceMemory){if(quality===undefined)quality=nmQuality();if(deviceMemory===undefined)deviceMemory=typeof navigator!=='undefined'?navigator.deviceMemory:undefined;return quality==='low'||(deviceMemory>0&&deviceMemory<=4)?256:0;}
function nmBytes(g){let n=0;if(!g)return 0;for(const k in g.attributes){const a=g.attributes[k];n+=a.array?a.array.byteLength:0;}if(g.index&&g.index.array)n+=g.index.array.byteLength;return n;}
function nmTexBytes(w,h,mips){return Math.round(w*h*4*(mips?4/3:1));}
function nmDropArray(){this.array=null;}
function nmPackGeometry(g){const before=nmBytes(g);if(!g.boundingSphere)g.computeBoundingSphere();if(!g.boundingBox)g.computeBoundingBox();
 const n=g.attributes.normal;if(n&&n.array instanceof Float32Array&&n.itemSize===3){const s=n.array,c=n.count,q=new Int8Array(c*4);for(let i=0,j=0,k=0;i<c;i++,j+=3,k+=4){const x=s[j],y=s[j+1],z=s[j+2],l=127/(Math.sqrt(x*x+y*y+z*z)||1);q[k]=Math.round(x*l);q[k+1]=Math.round(y*l);q[k+2]=Math.round(z*l);}g.setAttribute('normal',new THREE.BufferAttribute(q,4,true));}
 const ix=g.index,pos=g.attributes.position;if(ix&&ix.array instanceof Uint32Array&&pos&&pos.count<=65535){const a=new Uint16Array(ix.array.length);a.set(ix.array);g.setIndex(new THREE.BufferAttribute(a,1));}
 for(const k in g.attributes)g.attributes[k].onUpload(nmDropArray);if(g.index)g.index.onUpload(nmDropArray);g.userData.nmReleased=true;return [before,nmBytes(g)];}
async function nmShrink(image,cap){const w=image.width,h=image.height,s=cap/Math.max(w,h),W=Math.max(1,Math.round(w*s)),H=Math.max(1,Math.round(h*s));
 if(typeof image.close==='function'&&typeof createImageBitmap==='function'){const out=await createImageBitmap(image,{resizeWidth:W,resizeHeight:H,resizeQuality:'high',premultiplyAlpha:'none',colorSpaceConversion:'none'});image.close();return out;}
 const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(image,0,0,W,H);return c;}
function nmTexUploaded(t){const s=t.source,left=(s.nmRefs||1)-1;s.nmRefs=left;t.onUpdate=null;if(left>0)return;const d=s.data;if(d&&typeof d.close==='function')d.close();s.data=null;}
async function nmBudget(root,cap){const mem={cap,geometry:[0,0],texture:[0,0],textures:[],meshes:0};const seen=new Set(),sources=new Map();
 root.traverse(o=>{if(!o.isMesh)return;mem.meshes++;if(!seen.has(o.geometry)){seen.add(o.geometry);const [a,b]=nmPackGeometry(o.geometry);mem.geometry[0]+=a;mem.geometry[1]+=b;}for(const m of [].concat(o.material||[]))for(const k in m){const t=m[k];if(t&&t.isTexture&&!seen.has(t)){seen.add(t);mem.textures.push(t);const s=t.source;if(!sources.has(s))sources.set(s,[]);sources.get(s).push(t);}}});
 for(const [s,list] of sources){const img=s.data;if(!img||!(img.width>0))continue;const mips=list.some(t=>t.generateMipmaps!==false);mem.texture[0]+=nmTexBytes(img.width,img.height,mips);if(cap&&Math.max(img.width,img.height)>cap){s.data=await nmShrink(img,cap);s.needsUpdate=true;}mem.texture[1]+=nmTexBytes(s.data.width,s.data.height,mips);s.nmRefs=list.length;for(const t of list)t.onUpdate=nmTexUploaded;}
 return mem;}
async function nmUpload(textures,live){for(let i=0;i<textures.length;i++){if(!live())return;try{renderer.initTexture(textures[i]);}catch(e){console.warn('Map texture upload',e);}if(i%24===23)await new Promise(r=>setTimeout(r,0));}}
async function nmRehydrate(){const C=NM.current;if(!C||!C.scene||C.rehydrating)return false;C.rehydrating=true;const old=C.scene,key=C.key,base='models/valorant/maps/'+key+'/';old.visible=false;
 try{const gl=await nmLoadScene(base,-1);if(NM.current!==C){nmFree({M:{g:gl.scene}});return false;}nmPrepareScene(gl.scene);const mem=await nmBudget(gl.scene,nmTexCap());if(NM.current!==C){nmFree({M:{g:gl.scene}});return false;}
  C.M.g.remove(old);nmFree({M:{g:old}});C.M.g.add(gl.scene);C.scene=gl.scene;mem.collisionBytes=C.memory&&C.memory.collisionBytes;mem.rehydrated=(C.memory&&C.memory.rehydrated||0)+1;C.memory=mem;await nmUpload(mem.textures,()=>NM.current===C);return true;}
 catch(e){console.error('Map reload after renderer change failed',key,e);old.visible=true;return false;}finally{C.rehydrating=false;}}
function nmWatchContext(r){const el=r&&r.domElement;if(!el||el.nmWatched)return;el.nmWatched=true;el.addEventListener('webglcontextrestored',()=>{if(renderer===r)nmRehydrate();});}
// Disconnected decorative islands are not playable spawn or path targets.
function nmConnected(C){const N=C.nav.nodes,A=C.nav.adj,seen=new Uint8Array(N.length);let largest=[];for(let i=0;i<N.length;i++){if(seen[i]||(C.nav.valid&&!C.nav.valid[i]))continue;const q=[i];seen[i]=1;for(let k=0;k<q.length;k++)for(const j of A[q[k]])if(!seen[j]&&(!C.nav.valid||C.nav.valid[j])){seen[j]=1;q.push(j);}if(q.length>largest.length)largest=q;}C.playable=new Uint8Array(N.length);for(const i of largest)C.playable[i]=1;}
function nmNear(C,x,z,y,yBand){let best=-1,bd=Infinity;const gx=Math.floor(x/2),gz=Math.floor(z/2);for(let ring=0;ring<=8;ring++){for(let dx=-ring;dx<=ring;dx++)for(let dz=-ring;dz<=ring;dz++){if(ring&&Math.abs(dx)!==ring&&Math.abs(dz)!==ring)continue;for(const i of C.cells.get((gx+dx)+','+(gz+dz))||[]){const p=C.nav.nodes[i];if(Number.isFinite(yBand)&&Number.isFinite(y)&&Math.abs(p[1]-y)>yBand)continue;const d=(p[0]-x)**2+(p[2]-z)**2+(Number.isFinite(y)?(p[1]-y)**2*2:0);if(d<bd){bd=d;best=i;}}}if(best>=0&&ring>1&&bd<(ring*2-2)**2)return best;}if(best<0)for(let i=0;i<C.nav.nodes.length;i++){if(C.playable?!C.playable[i]:(C.nav.valid&&!C.nav.valid[i]))continue;const p=C.nav.nodes[i];if(Number.isFinite(yBand)&&Number.isFinite(y)&&Math.abs(p[1]-y)>yBand)continue;const d=(p[0]-x)**2+(p[2]-z)**2+(Number.isFinite(y)?(p[1]-y)**2*2:0);if(d<bd){best=i;bd=d;}}return best;}
// Select only nearby upward support. Never snap a falling actor onto a roof above its feet.
function nmHeight(C,x,z,y){const i=nmNear(C,x,z,Number.isFinite(y)?y:undefined);if(i<0)throw Error('No valid navigation floor');const reference=Number.isFinite(y)?y:C.nav.nodes[i][1],ray=new THREE.Ray(new THREE.Vector3(x,reference+.32,z),new THREE.Vector3(0,-1,0));for(let k=0;k<24;k++){const hit=C.bvh.raycastFirst(ray,THREE.DoubleSide);if(!hit)break;if(Math.abs(hit.face.normal.y)>.45)return hit.point.y;ray.origin.y=hit.point.y-.005;}const n=C.nav.nodes[i];return Number.isFinite(y)?Math.hypot(n[0]-x,n[2]-z)<=.65&&n[1]<=reference+.32&&n[1]>=reference-.65?Math.min(reference,n[1]):reference-10:n[1];}
var NM_Q={box:new THREE.Box3(),line:new THREE.Line3(),p:new THREE.Vector3(),q:new THREE.Vector3(),normal:new THREE.Vector3()};
function nmBlocked(C,x,z,r,y,height=1.8){if(!Number.isFinite(y))y=nmHeight(C,x,z);const VM_=window.ValorantFeel;if(VM_&&VM_.clipBlocked&&VM_.clipBlocked(C.key,x,z,r,y,height))return true;/* player clips: same invisible walls as the server world (shared motor) */const Q=NM_Q,epsilon=.025;Q.line.start.set(x,y+r+epsilon,z);Q.line.end.set(x,y+Math.max(r+epsilon,height-r),z);Q.box.min.set(x-r,y+epsilon,z-r);Q.box.max.set(x+r,y+height,z+r);let blocked=false;
 C.bvh.shapecast({intersectsBounds:b=>b.intersectsBox(Q.box),intersectsTriangle:t=>{if(Math.max(t.a.y,t.b.y,t.c.y)<=y+epsilon)return false;const d=t.closestPointToSegment(Q.line,Q.p,Q.q);if(d<r-.012){blocked=true;return true;}return false;}});return blocked;
}
{const b=blocked,g=groundAt;blocked=function(x,z,r,y){const C=nmActive();if(!C)return b(x,z,r,y);if(sgBlk(x,z,r,y))return true;if(!nmBlocked(C,x,z,r,y))return false;const floor=nmHeight(C,x,z,y+.32);return !(floor<=y+.32&&!nmBlocked(C,x,z,r,y+.32));};groundAt=function(x,z,r,y){const C=nmActive();return C?nmHeight(C,x,z,y):g(x,z,r,y);};}
function nmPlant(C,x,z){const t=C.meta.transform,p=C.meta.apiProjection,ca=Math.cos(t.angle),sa=Math.sin(t.angle),sx=ca*x-sa*z+t.cx,sz=sa*x+ca*z+t.cz,u=Math.floor((sx*100*p.xMultiplier+p.xScalarToAdd)*1024),v=Math.floor((-sz*100*p.yMultiplier+p.yScalarToAdd)*1024);for(const row of C.plants.rows[v]||[])if(u>=row[0]&&u<row[1])return row[2];return undefined;}
// Site anchors sit at the very edge of their plant zones (breeze B: anchor 0.15 u inside a 15 u
// zone), so a carrier stopping at the arrival floor never entered the zone and never planted -
// the whole attacking team parked at the site edge. Attackers now path to an in-zone point: the
// zone centroid inverse-projected to world, snapped to a playable nav node, verified in-zone;
// falls back to the first qualifying cell, then to the meta anchor.
function nmSiteGoals(C){if(!C.plants||!C.plants.rows)return;const t=C.meta.transform,p=C.meta.apiProjection,ca=Math.cos(t.angle),sa=Math.sin(t.angle),inv=(u,v)=>{const sx=((u+.5)/1024-p.xScalarToAdd)/(100*p.xMultiplier),sz=-(((v+.5)/1024-p.yScalarToAdd)/(100*p.yMultiplier)),X=sx-t.cx,Z=sz-t.cz;return [ca*X+sa*Z,-sa*X+ca*Z];},out={};for(const site of Object.keys(C.meta.sites)){let n=0,su=0,sv=0;for(const v of Object.keys(C.plants.rows))for(const r of C.plants.rows[v]){if(r[2]!==site)continue;n++;su+=(r[0]+r[1])/2;sv+=+v;}if(!n)continue;const put=(u,v)=>{const g=inv(u,v),i=nmNear(C,g[0],g[1]);if(i<0)return false;const q=C.nav.nodes[i];if(Math.hypot(q[0]-g[0],q[2]-g[1])>1.5||nmPlant(C,q[0],q[2])!==site)return false;out[site]=[q[0],q[2]];return true;};if(put(su/n,sv/n))continue;outer:for(const v of Object.keys(C.plants.rows))for(const r of C.plants.rows[v]){if(r[2]!==site)continue;for(let u=r[0];u<r[1];u+=2)if(put(u,+v))break outer;}}C.siteGoals=out;}
// A* follows only edges sampled from the original walkable mesh. No legacy lane waypoints are used.
function nmPath(C,start,end,banned){const cacheKey=start+'>'+end,noCache=banned&&banned.size>0;if(!noCache&&NM.routeCache.has(cacheKey))return NM.routeCache.get(cacheKey);const N=C.nav.nodes,A=C.nav.adj,cost=new Float32Array(N.length);cost.fill(Infinity);cost[start]=0;const prev=new Int32Array(N.length),closed=new Uint8Array(N.length);prev.fill(-1);const heap=[],push=(i,s)=>{let k=heap.length;heap.push([i,s]);while(k){const p=(k-1)>>1;if(heap[p][1]<=s)break;heap[k]=heap[p];k=p;}heap[k]=[i,s];},pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[k]=heap[c];k=c;}heap[k]=last;}return first[0];},heur=i=>Math.hypot(N[i][0]-N[end][0],N[i][2]-N[end][2]);push(start,heur(start));let found=false,steps=0;
 while(heap.length&&steps++<N.length*12){const a=pop();if(closed[a])continue;closed[a]=1;if(a===end){found=true;break;}for(const b of A[a]){if(closed[b]||(banned&&banned.has(a+'>'+b)))continue;const d=cost[a]+Math.hypot(N[a][0]-N[b][0],N[a][2]-N[b][2])+Math.abs(N[a][1]-N[b][1])*.2;if(d<cost[b]){cost[b]=d;prev[b]=a;push(b,d+heur(b));}}}
 const path=[];if(found)for(let i=end;i>=0;i=prev[i]){path.push(i);if(i===start)break;}path.reverse();if(noCache)return path;if(NM.routeCache.size>200)NM.routeCache.clear();NM.routeCache.set(cacheKey,path);return path;
}
// Smoothing follows support height at every sample. Wall clearance alone would
// cut corners across open drops and strand units beneath the intended path Validated at the motor's own collision radius (0.45): a 0.43 probe passed sub-0.9 u gaps the motor cannot traverse (haven C approach pocket).
function nmSegment(C,p,n){const d=Math.hypot(n[0]-p.x,n[2]-p.z),steps=Math.max(1,Math.ceil(d/.18));let y=p.y;for(let k=1;k<=steps;k++){const x=p.x+(n[0]-p.x)*k/steps,z=p.z+(n[2]-p.z)*k/steps,h=nmHeight(C,x,z,y);if(h-y>.321||y-h>.35||nmBlocked(C,x,z,.45,Math.max(y,h)+.32))return false;y=h;}return Math.abs(y-n[1])<.35;}
function nmSegDrop(C,p,n){const d=Math.hypot(n[0]-p.x,n[2]-p.z),st=Math.max(1,Math.ceil(d/.18));let y=p.y;for(let k=1;k<=st;k++){const x=p.x+(n[0]-p.x)*k/st,z=p.z+(n[2]-p.z)*k/st,h=nmHeight(C,x,z,y);if(h-y>.321||nmBlocked(C,x,z,.45,Math.max(y,h)+.32))return false;y=h;}return true;}
// nmSegDrop is nmSegment without the descent rejection, used ONLY for the first graph edge:
// adjacency across a ledge is traversable by falling, and rejecting it parked units on upper
// levels (ascent east balcony, y 9.1). Skip-ahead past the first edge still uses strict
// nmSegment so routing never cuts corners across open drops and strands units beneath.
// nmNext validates EVERY hop from the unit's actual position (breeze west edge: the nearest graph
// edge sat behind a wall corner from off-mesh ground, parking the unit in a blocked 0.4 s re-plan
// loop). It also never targets a node the unit already stands on: the movement floor (sd > 0.5)
// and the planner's arrive threshold (dist < 0.55) deadlocked units 0.5 u short of their waypoint
// on haven. With no clear hop onto the path it steers at the goal itself so collision sliding and
// xUn re-approach instead of freezing on an unreachable or already-reached node. When no hop
// clears and the unit sits off its nearest node's corridor, it first steps back onto that node:
// graph edges are walkable FROM the node, and goal-steering from off-corridor ground just grinds
// walls (split west spawn, both allies blk=1 under xUn step-backs).
// Anchor routing to the unit's own level: under a bridge or beside an overpass the plain
// nearest node sits on the deck overhead (breeze B approach: units at y=7 anchored to the
// y=7.45 walkway; every hop aimed 0.45 u up - unclimbable, park-forever). Band the start
// anchor to the walkable step range and fall back to the plain nearest node only when no
// on-level node exists nearby (mid-drop units resolve on landing).
// Stall breaker: when the first hop fails validation on the same directed edge across
// consecutive re-plans (A* + route cache otherwise re-serve it forever), blacklist that edge
// for this unit and re-plan around it. Per-unit so shared chokepoints are unaffected; the
// graph itself is never mutated (breeze defender-spawn descents proved the sweep model is
// stricter than the live motor, so static pruning was deferred). Bans expire (30 s): a
// transient blockage (door, body in the choke, off-mesh approach) must not cost the unit a
// valid route for the rest of its life - a static failure simply re-bans after one retry.
// If bans ever consume every route, they are all dropped and routing retries unfiltered:
// blacklisting may never leave a unit more parked than the original graph.
function nmNext(C,u,gx,gz){const p=u.g.position,N=C.nav.nodes;let s=nmNear(C,p.x,p.z,p.y,.35);if(s<0||Math.hypot(N[s][0]-p.x,N[s][2]-p.z)>6)s=nmNear(C,p.x,p.z,p.y);const e=nmNear(C,gx,gz);
 if(u.xb){const now=performance.now();for(const [k,t]of u.xb)if(t<now)u.xb.delete(k);}
 let path=nmPath(C,s,e,u.xb);if(!path.length){if(u.xb&&u.xb.size){u.xb.clear();path=nmPath(C,s,e);}if(!path.length)return [p.x,p.z];}
 u.xfe=path.length>1?path[0]+'>'+path[1]:null;
 if(path.length>1){const k1=path[0]+'>'+path[1],n1b=N[path[1]];if(Math.hypot(n1b[0]-p.x,n1b[2]-p.z)>=0.8&&!nmSegment(C,p,n1b)&&!nmSegDrop(C,p,n1b)){if(u.xfE===k1)u.xf=(u.xf||0)+1;else{u.xfE=k1;u.xf=1;}if(u.xf>=3){(u.xb=u.xb||new Map()).set(k1,performance.now()+30000);u.xf=0;u.xfE=null;return nmNext(C,u,gx,gz);}}else if(u.xfE){u.xf=0;u.xfE=null;}}if(path.length>1){const n1=N[path[1]];if(Math.hypot(n1[0]-p.x,n1[2]-p.z)>=0.8){if(nmSegment(C,p,n1)){let target=n1;for(let i=2;i<Math.min(path.length,10);i++){const n=N[path[i]];if(Math.hypot(n[0]-p.x,n[2]-p.z)<0.8)continue;if(!nmSegment(C,p,n))break;target=n;}return [target[0],target[2]];}if(nmSegDrop(C,p,n1))return [n1[0],n1[2]];}}let target=null;for(let i=1;i<Math.min(path.length,10);i++){const n=N[path[i]];if(Math.hypot(n[0]-p.x,n[2]-p.z)<0.8)continue;if(nmSegment(C,p,n))target=n;}if(target)return [target[0],target[2]];const sn=N[s];if(s>=0&&Math.hypot(sn[0]-p.x,sn[2]-p.z)>0.6)return [sn[0],sn[2]];return [gx,gz];}

// Motor-stage failures feed the same per-unit ban map: the chord can validate while the
// axis-split motor still cannot walk it (breeze B-approach stall), so three consecutive
// re-plans with no progress (<0.25 u) while blocked also ban the recorded first-hop edge.
{const p=xPath;xPath=function(u,dt,gx,gz,out){const C=nmActive();if(!C)return p.apply(this,arguments);u.xr=[];u.npT=(u.npT||0)-dt;const replan=!u.np||u.npT<=0||u.blk||Math.hypot(u.np[0]-u.g.position.x,u.np[1]-u.g.position.z)<.55||!u.ng||Math.hypot(u.ng[0]-gx,u.ng[1]-gz)>3;
 if(replan&&u.np&&u.xfe){const moved=u.xpp?Math.hypot(u.g.position.x-u.xpp[0],u.g.position.z-u.xpp[1]):9;
  // Wiggle is not progress: only a real advance (>=0.75 u between re-plans) clears the streak,
  // otherwise unstick strafing inside a pocket resets the count forever (breeze B approach).
  if(moved<.75){if(u.xfK===u.xfe)u.xfm=(u.xfm||0)+1;else{u.xfK=u.xfe;u.xfm=1;}if(u.xfm>=3){(u.xb=u.xb||new Map()).set(u.xfe,performance.now()+30000);u.xfm=0;u.xfK=null;}}else{u.xfm=0;u.xfK=null;}}
 if(replan){u.xpp=[u.g.position.x,u.g.position.z];u.np=nmNext(C,u,gx,gz);u.ng=[gx,gz];u.npT=.4;u.blk=0;}return u.np;};}
{const goal=xGoal;xGoal=function(u,team,atk,out){const C=nmActive();if(!C||mode!=='five')return goal.apply(this,arguments);const s=FV.sp;if(!s)return null;u.xr=[];s.xr='native';if(s.st==='plant')return x2(out,s.x,s.z);if(atk&&s.st==='drop')return x2(out,s.x,s.z);const names=Object.keys(C.meta.sites),name=atk?s.site:(s.seen||names[Math.max(0,team.indexOf(u))%names.length]),p=C.meta.sites[name]||C.meta.sites[names[0]],g=atk&&C.siteGoals&&(C.siteGoals[name]||C.siteGoals[names[0]]);return g?x2(out,g[0],g[1]):x2(out,p[0],p[2]);};}
{const step=xStep;xStep=function(){return nmActive()?false:step.apply(this,arguments);};const clear=xClear;xClear=function(x,z){const C=nmActive();if(!C)return clear(x,z);const p=C.nav.nodes[nmNear(C,x,z)];return [p[0],p[2]];};const nudge=xNudgeAll;xNudgeAll=function(){if(!nmActive())return nudge.apply(this,arguments);};}
// Native scenes are already material-batched; legacy merging/shadow fitting is destructive and wasteful here.
{const freeze=xFreeze;xFreeze=function(g){if(g&&g.userData.nativeMap){g.updateMatrixWorld(true);return;}return freeze(g);};}
// Match startup waits for the complete scene and collisions. Failure keeps the map unstarted.
function nmLaunch(fn,self,args,key){return nmEnsure(key).then(()=>{const result=fn.apply(self,args);nmOverlay(null);return result;});}
function nmWrap(fn,retake){return function(){let key=retake?'ascent':FV.pick||'ascent';if(key==='random')key=['ascent','bind','haven','split','lotus','breeze'][Math.floor(Math.random()*6)];if(!retake)FV.pick=key;const self=this,args=arguments;return nmLaunch(fn,self,args,key);};}
startFive=nmWrap(startFive);dmStart0=nmWrap(dmStart0);start=nmWrap(start,true);
{const build=ensureMapBuilt;ensureMapBuilt=function(n){if(NM.current&&(n==='five'||n==='retake'))return;return build.apply(this,arguments);};}
{const build=xBuildMap;xBuildMap=function(k){if(NM.current&&NM.current.key===k)return;return build.apply(this,arguments);};const dress=xDressMap;xDressMap=function(k){if(NM.current&&(k===NM.current.key||k==='retake'))return null;return dress.apply(this,arguments);};}
fUseMap=function(){const C=NM.current;if(!C||C.key!==FV.map)throw new Error('Original map has not loaded');for(const k in FMAP)if(FMAP[k].g)FMAP[k].g.visible=false;FMAP[FV.map]=C.M;MAPS.five=C.M;C.M.g.add(fsM,XCALL);XCALL.clear();for(const k in SITES)delete SITES[k];for(const [k,p]of Object.entries(C.meta.sites))SITES[k]=[p[0],p[2]];SROPES=null;LG.on=false;delete mmB.five;};
{const use=useMap;useMap=function(n){const C=NM.current;if(C&&n==='retake'){MAPS.retake=C.M;C.M.g.add(spike);const p=C.meta.sites.B;spike.position.set(p[0],p[1]+.4,p[2]);}const result=use.apply(this,arguments);if(C&&(n==='five'||n==='retake')){C.M.g.visible=true;scene.fog.near=95;scene.fog.far=260;camera.far=500;camera.updateProjectionMatrix();C.M.g.updateMatrixWorld(true);}return result;};}
{const spawn=xSpawn;xSpawn=function(k){const C=NM.current;if(C&&C.key===k){const a=C.meta.attacker,d=C.meta.defender;return {atk:a[2],def:d[2],edge:Math.min(Math.abs(a[2]),Math.abs(d[2]))-7,w:20};}return spawn(k);};}
function nmPlace(u,C,point,index){
 const occupied=[player].concat(allies,bots).filter(v=>v&&v!==u&&(v===player?v.hp>0:v.alive)).map(v=>v===player?[v.x,v.y,v.z]:[v.g.position.x,v.g.position.y,v.g.position.z]);
 const anchor=nmNear(C,point[0],point[2],point[1]);if(anchor<0)throw Error('No valid spawn anchor');
 const wanted=[point[0]+((index%3)-1)*1.2,point[1],point[2]+Math.floor(index/3)*1.1];
 const candidates=C.nav.nodes.map((p,i)=>({p,i,d:(p[0]-wanted[0])**2+(p[2]-wanted[2])**2+4*(p[1]-point[1])**2})).filter(v=>(C.playable?C.playable[v.i]:(!C.nav.valid||C.nav.valid[v.i]))&&Math.abs(v.p[1]-point[1])<1&&v.d<225).sort((a,b)=>a.d-b.d);
 let position=null;
 for(const {p,i}of candidates){if(occupied.some(o=>Math.abs(o[1]-p[1])<1.8&&Math.hypot(o[0]-p[0],o[2]-p[2])<.9))continue;const y=nmHeight(C,p[0],p[2],p[1]);if(Math.abs(y-p[1])>.15||nmBlocked(C,p[0],p[2],.43,y,1.92)||!nmPath(C,anchor,i).length)continue;
 // Never place a unit on a trap node: at least one exit edge must be traversable.
 if(!C.nav.adj[i].some(b=>{const n=C.nav.nodes[b];return nmSegment(C,{x:p[0],y:y,z:p[2]},n)||nmSegDrop(C,{x:p[0],y:y,z:p[2]},n);}))continue;
 position=[p[0],y,p[2]];break;}
 if(!position)throw Error('No clear unoccupied spawn on '+C.key);
 const p=position;if(u===player){Object.assign(u,{x:p[0],z:p[2],y:p[1],vy:0,vx:0,vz:0,air:false,ch:0,eyeOffset:0,jumpBuffer:0,jumpHeld:false});}else{u.g.position.set(...p);u.xr=[];u.np=null;u.xp={x:p[0],z:p[2]};u.kg=null;u.xk=u.xj=null;u.xb=null;u.xf=0;u.xfE=null;}return p;
}
{const spawn=fSpawn;fSpawn=function(){const r=spawn.apply(this,arguments),C=nmActive();if(C){const a=FV.atk?C.meta.attacker:C.meta.defender,b=FV.atk?C.meta.defender:C.meta.attacker;nmPlace(player,C,a,1);allies.forEach((u,i)=>nmPlace(u,C,a,i+2));bots.forEach((u,i)=>nmPlace(u,C,b,i));}return r;};}
{const spawn=spawnBots;spawnBots=function(){const r=spawn.apply(this,arguments),C=nmActive();if(C&&mode==='retake'){const site=C.meta.sites.B,entry=C.meta.callouts.find(c=>/B (Main|Lobby)/.test(c.name));nmPlace(player,C,entry?entry.position:C.meta.attacker,1);allies.forEach((u,i)=>nmPlace(u,C,entry?entry.position:C.meta.attacker,i+2));bots.forEach((u,i)=>nmPlace(u,C,site,i));}return r;};}
{const pts=dmPts;dmPts=function(){const C=nmActive();return C?C.nav.nodes.filter((_,i)=>(C.playable?C.playable[i]:(!C.nav.valid||C.nav.valid[i]))&&i%Math.max(1,Math.floor(C.nav.nodes.length/150))===0).map(p=>[p[0],p[2]]):pts();};const spawnB=dmSpawnB,spawnP=dmSpawnP;dmSpawnB=function(b){const r=spawnB.apply(this,arguments),C=nmActive();if(C)nmPlace(b,C,C.nav.nodes[nmNear(C,b.g.position.x,b.g.position.z)],1);return r;};dmSpawnP=function(){const r=spawnP.apply(this,arguments),C=nmActive();if(C)nmPlace(player,C,C.nav.nodes[nmNear(C,player.x,player.z)],1);return r;};}
// DM bypasses the agent ability tick that formerly grounded bots. Ground every live
// native-map unit independently, preserving explicit knock-up/rope animations.
(window.XHK||(window.XHK=[])).push(function nmGroundUnits(){const C=nmActive();if(!C||!running||paused)return;for(const b of bots.concat(allies)){if(b.nt||!b.alive||!b.g||b.ku>0||b.xk!=null||b.xj!=null)continue;const p=b.g.position;p.y=nmHeight(C,p.x,p.z,p.y+.01);}});
// Accurate map overview from Riot's minimap projection, rotated by exactly the scene's rigid transform.
function nmMapProjection(C,W,H){const pad=8,b=C.bounds,s=(Math.min(W,H)-pad*2)/Math.max(b.x2-b.x1,b.z2-b.z1),ox=(W-(b.x2-b.x1)*s)/2,oz=(H-(b.z2-b.z1)*s)/2;return {s,ox,oz,X:x=>ox+(x-b.x1)*s,Z:z=>oz+(z-b.z1)*s,world:(x,z)=>[b.x1+(x-ox)/s,b.z1+(z-oz)/s]};}
// Team spotting for the native minimap (legacy parity): an enemy shows while any living teammate or the
// player has line of sight (eye to chest, at native floor height), while revealed by Recon Bolt, Cypher
// or Fade (J.rv) or a fresh enemy ping; when it drops out of sight, a last-seen marker stays for 2 s where it was last seen.
const NM_SPOT_RANGE=60;
function nmSpot(now){
 if(now-(nmSpot.t||0)<150&&nmSpot.v)return nmSpot.v;nmSpot.t=now;const V=THREE.Vector3,vis=new Set(),eyes=[];
 if(player.hp>0)eyes.push(typeof pEye==='function'?pEye():new V(player.x,(player.y||0)+1.5,player.z));
 for(const a of allies)if(a.alive)eyes.push(new V(a.g.position.x,a.g.position.y+1.5,a.g.position.z));
 for(const b of bots){if(!b.alive)continue;const p=b.g.position,e=new V(p.x,p.y+1.4,p.z);for(const y of eyes){if(Math.hypot(y.x-p.x,y.z-p.z)<NM_SPOT_RANGE&&los(y,e)){vis.add(b);break;}}}
 if(typeof J!=='undefined'&&J.rvT>0&&J.rv)for(const b of J.rv)if(b&&b.alive)vis.add(b);
 if(window.xPG)for(const q of window.xPG.s)if(q.b&&q.b.alive&&now<q.rv)vis.add(q.b);
 for(const b of bots)if(b.alive&&b.netRvUntil>now)vis.add(b); // online: server ult reveals (Hunter's Fury hits, Neural Theft)
 const seen=nmSpot.seen||(nmSpot.seen=new WeakMap());for(const b of mmPrev)if(!vis.has(b)&&b.alive&&b.g){const l=seen.get(b)||b.g.position;mmLost.set(b,{t:now,x:l.x,z:l.z});}for(const b of vis){mmLost.delete(b);const l=seen.get(b);if(l){l.x=b.g.position.x;l.z=b.g.position.z;}else seen.set(b,{x:b.g.position.x,z:b.g.position.z});}mmPrev=vis;mmVis=vis;
 return nmSpot.v=vis;
}
function nmMinimap(C){const g=$('game'),show=running&&player&&(mode==='five'||mode==='retake');g.classList.toggle('x-mm',!!show);g.classList.toggle('x-five',mode==='five');XCALL.visible=false;if(!show)return;const now=performance.now();if(now-(nmMinimap.last||0)<80)return;nmMinimap.last=now;const ctx=mmx,W=MM.width,H=MM.height,px=W/(MM.getBoundingClientRect().width||W/2),{s,X,Z}=nmMapProjection(C,W,H);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#101c26';ctx.fillRect(0,0,W,H);
 if(C.image.complete&&C.image.naturalWidth){const t=C.meta.transform,p=C.meta.apiProjection,ca=Math.cos(t.angle),sa=Math.sin(t.angle),point=(u,v)=>{const x=(u/1024-p.xScalarToAdd)/(p.xMultiplier*100)-t.cx,z=-(v/1024-p.yScalarToAdd)/(p.yMultiplier*100)-t.cz;return [ca*x+sa*z,-sa*x+ca*z];},o=point(0,0),a=point(1,0),d=point(0,1);ctx.save();ctx.setTransform((a[0]-o[0])*s,(a[1]-o[1])*s,(d[0]-o[0])*s,(d[1]-o[1])*s,X(o[0]),Z(o[1]));ctx.drawImage(C.image,0,0,1024,1024);ctx.restore();}
 ctx.font='bold '+Math.max(10,W/15,10*px)+'px Arial';ctx.textAlign='center';ctx.fillStyle='#f3efcf';for(const [k,p]of Object.entries(C.meta.sites)){const r=Math.max(7,W/32,6*px),x=Math.max(r+2,Math.min(W-r-2,X(p[0]))),z=Math.max(r+2,Math.min(H-r-2,Z(p[2])));ctx.fillStyle='#18242e';ctx.beginPath();ctx.arc(x,z,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f3efcf';ctx.fillText(k,x,z+Math.max(3,W/48,3.5*px));}const dot=(x,z,color,r)=>{ctx.beginPath();ctx.arc(X(x),Z(z),r*px,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};const dia=(x,z,r)=>{const cx=X(x),cz=Z(z);r*=px;ctx.beginPath();ctx.moveTo(cx,cz-r);ctx.lineTo(cx+r,cz);ctx.lineTo(cx,cz+r);ctx.lineTo(cx-r,cz);ctx.closePath();};
 const vis=nmSpot(now);for(const u of allies)if(u.alive)dot(u.g.position.x,u.g.position.z,'#5fe4df',2.5);for(const u of bots)if(u.alive&&vis.has(u))dot(u.g.position.x,u.g.position.z,'#ff4655',2.5);
 // Last-seen: a fading red "?" for 2 s where a spotted enemy dropped out of the team's sight.
 ctx.font='bold '+Math.max(9,7*px)+'px Arial';for(const [b,l]of mmLost){const f=1-(now-l.t)/2000;if(f<=0||!b.alive){mmLost.delete(b);continue;}ctx.globalAlpha=f;ctx.fillStyle='#ff4655';ctx.fillText('?',X(l.x),Z(l.z)+3*px);ctx.globalAlpha=1;}
 // Orbs, call-out rings and pings use the same world-to-map transform as the players.
 if(mode==='five'&&window.xOrbs)for(const o of window.xOrbs){if(!o.on)continue;dia(o.x,o.z,2.5);ctx.fillStyle='#9ffff0';ctx.fill();}
 if(window.xCMk)for(const q of window.xCMk){if(!q.on)continue;const f=1-(now-q.t)/4000;if(f<=0){q.on=false;continue;}ctx.globalAlpha=f;ctx.beginPath();ctx.arc(X(q.x),Z(q.z),5*px,0,Math.PI*2);ctx.strokeStyle=q.en?'#ff4655':'#7fd8ff';ctx.lineWidth=1.5*px;ctx.stroke();ctx.globalAlpha=1;}
 if(window.xPG)for(const q of window.xPG.s){if(!q.on)continue;ctx.globalAlpha=q.a==null?1:q.a;dia(q.x,q.z,3.5);ctx.strokeStyle=q.en?'#ff4655':'#ffd84a';ctx.lineWidth=1.5*px;ctx.stroke();ctx.globalAlpha=1;}
 ctx.lineWidth=1;dot(player.x,player.z,'#ffffff',3);ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(X(player.x),Z(player.z));ctx.lineTo(X(player.x-Math.sin(yaw)*4),Z(player.z-Math.cos(yaw)*4));ctx.stroke();if(mode==='five'&&FV.sp&&(FV.sp.st==='plant'||FV.sp.st==='drop'&&(FV.atk||FV.sp.seen)))dot(FV.sp.x,FV.sp.z,'#ffe269',3);else if(mode==='five'&&FV.sp&&FV.sp.st==='carry'&&FV.sp.c&&FV.sp.c!==player&&allies.includes(FV.sp.c)&&FV.sp.c.g)dot(FV.sp.c.g.position.x,FV.sp.c.g.position.z,'#ffe269',1.6);
}
{const map=minimap;minimap=function(){const C=nmActive();return C?nmMinimap(C):map.apply(this,arguments);};const bounds=mmBounds;mmBounds=function(n){const C=nmActive();return C?C.bounds:bounds(n);};const loc=xLoc;xLoc=function(x,z){const C=nmActive();if(!C)return loc(x,z);let best='',d=Infinity;for(const c of C.meta.callouts){const r=Math.hypot(c.position[0]-x,c.position[2]-z);if(r<d){d=r;best=c.name;}}return best;};}
// Existing hooks keep their original function references, so add the native minimap after them.
{const hooks=window.XHK||[],original=hooks.findIndex(f=>f.name==='minimap');if(original>=0)hooks.splice(original,1);}
(window.XHK||(window.XHK=[])).push(()=>{const C=nmActive();if(!C){minimap();return;}if(!running)return;nmMinimap(C);if(fsM.visible)fsM.position.y=nmHeight(C,fsM.position.x,fsM.position.z)+.4;for(const d of XD.L)d.m.position.y=nmHeight(C,d.x,d.z)+.08;});
// Bind's source teleporter entrances/exits replace the legacy pads and their coordinates.
function nmTeleports(C){if((typeof NET!=='undefined'&&NET.socket)||C.key!=='bind'||!running||paused)return;const now=performance.now();if(!C.teleporters){const find=name=>C.meta.callouts.find(c=>c.name===name).position;C.teleporters=[['A Teleporter','B Exit'],['B Teleporter','A Exit']].map(([a,b])=>({entry:find(a),exit:find(b)}));}for(const u of [player].concat(bots,allies)){if(u!==player&&!u.alive)continue;if((u.nmTP||0)>now)continue;const p=u===player?[u.x,u.y,u.z]:u.g.position.toArray();const gate=C.teleporters.find(t=>Math.hypot(p[0]-t.entry[0],p[2]-t.entry[2])<2&&Math.abs(p[1]-nmHeight(C,t.entry[0],t.entry[2]))<1.5);if(!gate){u.nmTPStart=0;continue;}if(!u.nmTPStart){u.nmTPStart=now;continue;}if(now-u.nmTPStart<400)continue;nmPlace(u,C,gate.exit,1);u.nmTP=now+1800;u.nmTPStart=0;if(u===player){SFX.tp();say('Teleporter',700);}}}
{const hooks=window.XHK||[],i=hooks.findIndex(f=>f.name==='tpLoop');if(i>=0){const legacy=hooks[i];hooks[i]=function(){const C=nmActive();return C?nmTeleports(C):legacy();};}}
// The legacy bot pad check (xTpBots) uses the blockout's pad coordinates: on native Bind those are ordinary floor (-27.5,8 and
// 25,20), so a bot walking over either was thrown to 13,18 (5.8 m from any walkable node) or -20,20 at its old height.
// Native pads (nmTeleports, above) move bots and the player; the legacy check only runs on the blockout.
{const legacy=xTpBots;xTpBots=function(){if(nmActive())return;return legacy.apply(this,arguments);};}
window.xNativeMaps={state:NM,ensure:nmEnsure,cancel:nmCancel,near:nmNear,path:nmPath,height:nmHeight,blocked:nmBlocked,activate(key){FV.pick=FV.map=key;mode='five';fUseMap();useMap('five');return NM.current.meta;},memory(){const C=NM.current;return C&&C.memory?Object.assign({},C.memory,{textures:C.memory.textures.length}):null;},probe(){const C=nmActive();return C?{key:C.key,objects:C.meta.objects,navigation:C.nav.validation,player:[player.x,player.y,player.z],sites:C.meta.sites}:null;}};
{const remake=xRemake;xRemake=function(){const before=renderer,result=remake.apply(this,arguments);if(renderer!==before){nmWatchContext(renderer);nmRehydrate();}return result;};nmWatchContext(renderer);}
// Native warmup compiles the visible scene plus the pooled hit-path effects that stay hidden until first use (tracer
// lines, localized hit impacts, spark/decal pools): without them the first shot / first hit of a match compiled their
// programs mid-fight. Only invisible leaf objects parented to the scene are flipped (never the hidden collision meshes
// inside the map group, whose programs nothing ever draws).
{const precompile=xPrecompile;xPrecompile=function(){if(!nmActive())return precompile();xPC=true;const hid=[];try{if(!BFX.ok)bfxInit();if(typeof xHitInit==='function')xHitInit();for(const o of scene.children)if(!o.visible&&(o.isMesh||o.isLine||o.isPoints||o.isSprite)){hid.push(o);o.visible=true;}renderer.compile(scene,camera);}catch(e){console.warn('Native shader warmup',e);}for(const o of hid)o.visible=false;};}
// ---- END ORIGINAL VALORANT MAPS ----
