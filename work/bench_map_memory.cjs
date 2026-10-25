// Native-map memory/startup bench (rows 1 and 12), headless. Runs the page's own nmPackGeometry/nmTexCap on the
// real assets of every map and models what a match keeps resident before and after the memory budget:
//   page (renderer process): GLTF typed arrays + decoded images (+ collision), which the old loader kept forever;
//   GPU: vertex/index buffers + textures with mip chains (SwiftShader/ANGLE keep these in process memory too).
// Timings are this sandbox's CPU (sharp for PNG decode as a proxy for the browser's image decode), not a device.
// Usage: node work/bench_map_memory.cjs [map...]   -> work/validation/map-memory.json
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]})),sharp=require(path.join(root,'server/node_modules/sharp'));
const MeshBVHLib=require(require.resolve('three-mesh-bvh',{paths:[path.join(root,'server')]}));
const pick=n=>{const i=src.indexOf('function '+n+'(');return src.slice(i,src.indexOf('\n',i));};
const block=n=>{const i=src.indexOf('function '+n+'(');let j=src.indexOf('\nfunction ',i+1),k=src.indexOf('\nasync function ',i+1);if(k>0&&k<j)j=k;return src.slice(i,j);};
// new Function, not vm: global lookups (Math) through a vm context are ~15x slower and would distort the timing.
const {nmPackGeometry,nmTexCap,nmTexBytes}=new Function('THREE',['nmBytes','nmTexBytes','nmDropArray','nmTexCap'].map(pick).join('\n')+'\n'+block('nmPackGeometry')+';return {nmPackGeometry,nmTexCap,nmTexBytes};')(THREE);
const MB=b=>Math.round(b/1e5)/10,now=()=>Number(process.hrtime.bigint())/1e6;
const SIZE={5126:4,5125:4,5123:2,5121:1},N={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},TYPE={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array};
(async()=>{const keys=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','breeze','haven','lotus','split'],out={generated:new Date().toISOString(),note:'Headless model from real assets; page-process = typed arrays + decoded images + collision; GPU = buffers + textures with mips. Timings are sandbox CPU, sharp decode stands in for browser image decode.',maps:{}};
 for(const key of keys){const dir=path.join(root,'models/valorant/maps',key),t0=now(),g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8')),bufs=g.buffers.map(b=>fs.readFileSync(path.join(dir,b.uri))),tRead=now()-t0;
  const acc=i=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView],b=bufs[v.buffer],n=a.count*N[a.type],T=TYPE[a.componentType],off=b.byteOffset+(v.byteOffset||0)+(a.byteOffset||0);return new T(b.buffer.slice(off,off+n*T.BYTES_PER_ELEMENT));};
  let before=0,after=0,verts=0,u16=0,packMs=0;const t1=now();
  for(const mesh of g.meshes)for(const p of mesh.primitives){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(acc(p.attributes.POSITION),3));if(p.attributes.NORMAL!=null)geo.setAttribute('normal',new THREE.BufferAttribute(acc(p.attributes.NORMAL),3));if(p.attributes.TEXCOORD_0!=null)geo.setAttribute('uv',new THREE.BufferAttribute(acc(p.attributes.TEXCOORD_0),2));if(p.indices!=null)geo.setIndex(new THREE.BufferAttribute(acc(p.indices),1));
   {const a=g.accessors[p.attributes.POSITION];if(a.min&&a.max){geo.boundingBox=new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max));geo.boundingSphere=geo.boundingBox.getBoundingSphere(new THREE.Sphere());}} // GLTFLoader sets bounds from accessor min/max
   verts+=geo.attributes.position.count;const tp=now();const [a,b]=nmPackGeometry(geo);packMs+=now()-tp;before+=a;after+=b;if(geo.index&&geo.index.array instanceof Uint16Array)u16++;}
  const tPack=packMs;
  // Textures: decode every image (browser decode proxy), and resize to the LOW cap.
  let texBefore=0,texLow=0,decodeMs=0,resizeMs=0;const cap=nmTexCap('low',8);
  for(const im of g.images){const file=path.join(dir,im.uri),a=now(),img=sharp(file),{width,height}=await img.metadata();await sharp(file).ensureAlpha().raw().toBuffer();decodeMs+=now()-a;texBefore+=nmTexBytes(width,height,true);
   const s=Math.min(1,cap/Math.max(width,height)),W=Math.max(1,Math.round(width*s)),H=Math.max(1,Math.round(height*s));if(s<1){const b=now();await sharp(file).ensureAlpha().resize(W,H,{fit:'fill'}).raw().toBuffer();resizeMs+=now()-b;}texLow+=nmTexBytes(W,H,true);}
  // Collision as the client loads it (server worlds: position/index + serialized BVH).
  const wdir=path.join(root,'server/worlds',key),meta=JSON.parse(fs.readFileSync(path.join(wdir,'meta.json'),'utf8')),c0=now(),pos=fs.readFileSync(path.join(wdir,'position.bin')),ind=fs.readFileSync(path.join(wdir,'index.bin')),roots=Array.from({length:meta.roots},(_,i)=>fs.readFileSync(path.join(wdir,'bvh'+i+'.bin')));
  const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos.buffer.slice(pos.byteOffset,pos.byteOffset+pos.length)),3));cg.setIndex(new THREE.BufferAttribute(new Uint32Array(ind.buffer.slice(ind.byteOffset,ind.byteOffset+ind.length)),1));
  MeshBVHLib.MeshBVH.deserialize({index:cg.index.array,roots:roots.map(r=>r.buffer.slice(r.byteOffset,r.byteOffset+r.length))},cg,{setIndex:false});const tCol=now()-c0,colBytes=pos.length+ind.length+roots.reduce((n,r)=>n+r.length,0);
  const decoded=g.images.length?texBefore*3/4:0; // base level only, as an ImageBitmap/HTMLImage holds it
  const R={meshes:g.meshes.length,vertices:verts,uint16IndexMeshes:u16,images:g.images.length,
   bytesMB:{geometryBefore:MB(before),geometryAfter:MB(after),texturesGpuBefore:MB(texBefore),texturesGpuLow:MB(texLow),decodedImagesBefore:MB(decoded),collision:MB(colBytes)},
   residentMB:{before:{page:MB(before+decoded+colBytes),gpu:MB(before+texBefore),total:MB(before*2+decoded+texBefore+colBytes)},
    afterMediumHigh:{page:MB(colBytes),gpu:MB(after+texBefore),total:MB(after+texBefore+colBytes)},
    afterLow:{page:MB(colBytes),gpu:MB(after+texLow),total:MB(after+texLow+colBytes)}},
   timingsMs:{readAndParse:Math.round(tRead),packGeometry:Math.round(tPack),decodeAllImages:Math.round(decodeMs),resizeToLowCap:Math.round(resizeMs),collisionDeserialize:Math.round(tCol)}};
  out.maps[key]=R;console.log(key,JSON.stringify(R));}
 const file=path.join(__dirname,'validation/map-memory.json');try{const old=JSON.parse(fs.readFileSync(file,'utf8'));out.maps=Object.assign(old.maps||{},out.maps);}catch(e){}fs.writeFileSync(file,JSON.stringify(out,null,1)+'\n');console.log('wrote',path.relative(root,file));
})().catch(e=>{console.error(e);process.exit(1);});
