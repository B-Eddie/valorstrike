// Packed map geometry (work/build_packed_geometry.cjs, perf lane B): for every map that ships scene-packed.gltf,
//  1. the JSON is scene.gltf apart from bufferViews / buffers / the NORMAL accessors / extensionsUsed / asset.extras;
//  2. every view decoded by the page's own nmUnpack (extracted from work/native_maps_runtime.js) is byte-identical to the
//     source view (POSITION, TEXCOORD_0, indices), and NORMAL equals the Int8x4 nmPackGeometry makes of the float normal
//     (so the GPU receives the same bytes as before);
//  3. the page loads the packed copy only when the asset table lists it (nmSceneFile), and nmBufRelease decodes packed views;
//  4. reports raw / brotli (q4, the server's on-the-fly level is unknown) bytes and the decode time.
//   QUICK=1: brotli sizes skipped.
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),rt=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const pick=n=>{const m=rt.match(new RegExp('\\nfunction '+n+'\\([\\s\\S]*?\\n(?=//|function )'));assert.ok(m,n+' in runtime');return m[0];};
const ctx={};vm.createContext(ctx);vm.runInContext(pick('nmUnpack')+pick('nmSceneFile'),ctx);
const pack=pick('nmPackGeometry');assert.ok(/n\.array instanceof Float32Array/.test(pack),'nmPackGeometry only converts float normals (packed Int8x4 normals pass through)');
assert.ok(/l=127\/\(Math\.sqrt\(x\*x\+y\*y\+z\*z\)\|\|1\);q\[k\]=Math\.round\(x\*l\);q\[k\+1\]=Math\.round\(y\*l\);q\[k\+2\]=Math\.round\(z\*l\)/.test(pack),'nmPackGeometry formula = the packer formula');
assert.ok(/loadAsync\(base\+nmSceneFile\(base\)\)/.test(rt)&&/VS_packed_view/.test(pick('nmBufRelease')),'nmLoadScene asks nmSceneFile; nmBufRelease decodes packed views');
ctx.vsAssetHas=p=>p==='models/valorant/maps/ascent/scene-packed.gltf';assert.equal(ctx.nmSceneFile('models/valorant/maps/ascent/'),'scene-packed.gltf');assert.equal(ctx.nmSceneFile('models/valorant/maps/bind/'),ctx.vsAssetHas('models/valorant/maps/bind/scene-packed.gltf')?'scene-packed.gltf':'scene.gltf');
delete ctx.vsAssetHas;assert.equal(ctx.nmSceneFile('models/valorant/maps/ascent/'),'scene.gltf','no asset table: scene.gltf');
const br=b=>zlib.brotliCompressSync(b,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4,[zlib.constants.BROTLI_PARAM_SIZE_HINT]:b.length}}).length;
const out=[];let maps=0;
for(const key of fs.readdirSync(path.join(root,'models/valorant/maps'))){const dir=path.join(root,'models/valorant/maps',key);if(!fs.existsSync(path.join(dir,'scene-packed.gltf')))continue;maps++;
 const g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8')),p=JSON.parse(fs.readFileSync(path.join(dir,'scene-packed.gltf'),'utf8'));
 for(const k of Object.keys(g))if(!['bufferViews','buffers','accessors','extensionsUsed','asset'].includes(k))assert.deepEqual(p[k],g[k],key+': '+k+' unchanged');
 assert.equal(p.accessors.length,g.accessors.length);const sem=new Map();for(const me of g.meshes)for(const pr of me.primitives){for(const [a,ai] of Object.entries(pr.attributes))sem.set(ai,a);if(pr.indices!=null)sem.set(pr.indices,'INDICES');}
 p.accessors.forEach((a,i)=>{const s=sem.get(i);if(s==='NORMAL'){assert.deepEqual([a.componentType,a.normalized,a.type,a.count,a.bufferView],[5120,true,'VEC4',g.accessors[i].count,g.accessors[i].bufferView]);}else assert.deepEqual(a,g.accessors[i],key+' accessor '+i);});
 const gb=g.buffers.map(b=>fs.readFileSync(path.join(dir,b.uri))),pb=p.buffers.map(b=>fs.readFileSync(path.join(dir,b.uri)));
 pb.forEach((b,k)=>assert.equal(b.length,p.buffers[k].byteLength,key+' '+p.buffers[k].uri+' length'));
 let dt=0,raw=0,packed=0,views=0;
 g.accessors.forEach((a,i)=>{const v=g.bufferViews[a.bufferView],q=p.bufferViews[a.bufferView],x=q.extensions&&q.extensions.VS_packed_view;assert.ok(x,key+' view packed');assert.equal(q.buffer,v.buffer,'same file index');
  const src=new Uint8Array(gb[v.buffer].buffer,gb[v.buffer].byteOffset+(v.byteOffset||0),v.byteLength);const t=process.hrtime.bigint();const dec=new Uint8Array(ctx.nmUnpack(new Uint8Array(pb[q.buffer].buffer,pb[q.buffer].byteOffset+q.byteOffset,q.byteLength),x));dt+=Number(process.hrtime.bigint()-t)/1e6;
  let want=src;if(sem.get(i)==='NORMAL'){const f=new Float32Array(src.buffer.slice(src.byteOffset,src.byteOffset+src.length)),c=f.length/3,w=new Int8Array(c*4);for(let n=0,j=0,k=0;n<c;n++,j+=3,k+=4){const X=f[j],Y=f[j+1],Z=f[j+2],l=127/(Math.sqrt(X*X+Y*Y+Z*Z)||1);w[k]=Math.round(X*l);w[k+1]=Math.round(Y*l);w[k+2]=Math.round(Z*l);}want=new Uint8Array(w.buffer);}
  assert.equal(Buffer.compare(Buffer.from(dec.buffer,0,dec.length),Buffer.from(want.buffer,want.byteOffset,want.length)),0,key+' view '+a.bufferView+' ('+sem.get(i)+') decodes to the source bytes');
  raw+=v.byteLength;packed+=q.byteLength;views++;});
 const r={key,views,raw,packed,decodeMs:Math.round(dt)};if(!process.env.QUICK){r.rawBr=gb.reduce((s,b)=>s+br(b),0);r.packedBr=pb.reduce((s,b)=>s+br(b),0);}out.push(r);console.log(JSON.stringify(r));}
assert.ok(maps>=1,'at least one map ships packed geometry');
// 5. through the real loader (three r149 + GLTFLoader r147, as the page): scene-packed.gltf with nmBufRelease gives the same
// meshes as scene.gltf (positions / uvs / indices identical, normals = the Int8x4 nmPackGeometry makes of the float normals).
(async()=>{const D=process.env.REAL3_DIR||'/workspace/work/qa',key=process.env.PACKED_MAP||'lotus',dir='models/valorant/maps/'+key+'/';
 if(!fs.existsSync(path.join(D,'GLTFLoader.js'))||!fs.existsSync(path.join(root,dir,'scene-packed.gltf'))){console.log('  (loader check skipped: no '+D+'/GLTFLoader.js or no packed '+key+')');return;}
 const c={console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,queueMicrotask,TextDecoder,TextEncoder,Blob,URL,Headers,Response,navigator:{userAgent:'node'},NM:{}};vm.createContext(c);
 c.Request=class extends Request{constructor(u,o){super(typeof u==='string'?new URL(u,'http://localhost/').href:u,o);}};
 c.fetch=async u=>{u=(typeof u==='string'?u:u.url).replace('http://localhost/','');const f=path.join(root,u);return fs.existsSync(f)?new Response(fs.readFileSync(f)):new Response('',{status:404});};
 vm.runInContext(fs.readFileSync(path.join(D,'three.min.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(D,'GLTFLoader.js'),'utf8'),c);vm.runInContext(pick('nmUnpack')+pick('nmBufRelease'),c);
 const strip=j=>{for(const m of j.materials||[])if(m.pbrMetallicRoughness)delete m.pbrMetallicRoughness.baseColorTexture;delete j.images;delete j.textures;delete j.samplers;return j;};/* geometry only: no textures in node */
 const load=async(file,plugin)=>{const j=strip(JSON.parse(fs.readFileSync(path.join(root,dir,file),'utf8'))),L=new c.THREE.GLTFLoader();if(plugin)L.register(c.nmBufRelease);return new Promise((ok,no)=>L.parse(JSON.stringify(j),'http://localhost/'+dir,ok,no));};
 const t0=Date.now(),a=await load('scene.gltf',false),t1=Date.now(),b=await load('scene-packed.gltf',true),t2=Date.now();
 const ma=[],mb=[];a.scene.traverse(o=>{if(o.isMesh)ma.push(o.geometry);});b.scene.traverse(o=>{if(o.isMesh)mb.push(o.geometry);});assert.equal(mb.length,ma.length,'same mesh count');
 const same=(x,y)=>x.length===y.length&&Buffer.compare(Buffer.from(x.buffer,x.byteOffset,x.byteLength),Buffer.from(y.buffer,y.byteOffset,y.byteLength))===0;
 for(let i=0;i<ma.length;i++){const A=ma[i],B=mb[i];assert.ok(same(A.attributes.position.array,B.attributes.position.array),'position '+i);assert.ok(same(A.attributes.uv.array,B.attributes.uv.array),'uv '+i);assert.ok(same(A.index.array,B.index.array),'index '+i);
  const n=B.attributes.normal;assert.ok(n.array instanceof vm.runInContext('Int8Array',c)&&n.itemSize===4&&n.normalized,'packed normal Int8x4 normalized');const f=A.attributes.normal.array,q=n.array;
  for(let v=0,j=0,k=0;v<A.attributes.normal.count;v++,j+=3,k+=4){const X=f[j],Y=f[j+1],Z=f[j+2],l=127/(Math.sqrt(X*X+Y*Y+Z*Z)||1);if(q[k]!==Math.round(X*l)||q[k+1]!==Math.round(Y*l)||q[k+2]!==Math.round(Z*l)||q[k+3]!==0)assert.fail('normal '+i+'/'+v);}}
 console.log('  loader: '+key+' scene-packed.gltf through GLTFLoader + nmBufRelease = scene.gltf, '+ma.length+' meshes (raw '+(t1-t0)+' ms, packed '+(t2-t1)+' ms in node)');})().catch(e=>{console.error(e);process.exit(1);});
console.log('Packed geometry: '+maps+' maps, every view decodes to the GPU bytes of scene.gltf (positions / uvs / indices lossless, normals = nmPackGeometry Int8x4)');
