// Packed map geometry (perf lane B, 2026-11-22): scene-packed.gltf + geometry-packed-NN.bin beside each map's scene.gltf.
// The page loads the packed copy (nmLoadScene / the map prefetch, when the asset table lists it); scene.gltf and the raw
// geometry-NN.bin stay for the offline tools and tests. Nothing the GPU receives changes (checked here, view by view):
//  - POSITION / TEXCOORD / indices are LOSSLESS: every decoded byte equals the source bufferView byte.
//    POSITION: per-component delta of the float32 bit patterns ('delta32'), indices: zigzag delta ('zigzag32'), both then
//    split into byte planes so the server's brotli sees runs of similar bytes; TEXCOORD_0 is stored as is ('none': brotli on
//    the raw floats beat every transform tried).
//  - NORMAL is stored as the normalized Int8x4 nmPackGeometry already makes of it on load (round(c * 127 / |n|), w = 0):
//    the same formula, so the GPU gets the same bytes; the page just skips the conversion (accessor BYTE, normalized, VEC4).
//    Never used on the CPU before that (collision / raycasts use the collision mesh).
// Lossy quantization (KHR_mesh_quantization / meshopt filters: ~1-2 mm position error) was rejected: the z-fight layers
// sit 0.2-10 mm apart (NM_ZFIX). Lossless meshopt (vertex codec v1 + index sequence) was measured too: Ascent 83.6 MB after
// brotli vs 65.8 MB for the raw files, i.e. worse than serving the raw floats.
// Each view carries extensions.VS_packed_view {filter, stride, count}; nmUnpack (work/native_maps_runtime.js, extracted and
// run here) decodes it. File k of the packed set holds the views of source file k, in the same order (nmBufRelease still
// takes the files one at a time).
//   node work/build_packed_geometry.cjs [map ...]      (default: all six maps; rewrites the packed files of those maps)
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),MAPS=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','breeze','haven','lotus','split'];
const rt=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),m=rt.match(/\nfunction nmUnpack\([\s\S]*?\n(?=\/\/|function )/);
if(!m)throw Error('nmUnpack not found in native_maps_runtime.js');const ctx={};vm.createContext(ctx);vm.runInContext(m[0],ctx);const nmUnpack=ctx.nmUnpack;
function planes(u8,stride){const n=u8.length/stride,o=new Uint8Array(u8.length);for(let b=0;b<stride;b++){const p=b*n;for(let i=0,j=b;i<n;i++,j+=stride)o[p+i]=u8[j];}return o;}
function enc(src,filter,stride){const n=src.length/stride;if(filter==='none')return Uint8Array.from(src);const u=new Uint32Array(src.buffer.slice(src.byteOffset,src.byteOffset+src.length)),o=new Uint32Array(u.length);
 if(filter==='delta32'){const c=stride>>2;for(let i=0;i<u.length;i++)o[i]=i<c?u[i]:(u[i]-u[i-c])>>>0;}
 else if(filter==='zigzag32'){let p=0;for(let i=0;i<u.length;i++){const d=(u[i]-p)|0;o[i]=((d<<1)^(d>>31))>>>0;p=u[i];}}
 else throw Error(filter);return planes(new Uint8Array(o.buffer),stride);}
function normals8(src){const f=new Float32Array(src.buffer.slice(src.byteOffset,src.byteOffset+src.length)),c=f.length/3,q=new Int8Array(c*4);
 for(let i=0,j=0,k=0;i<c;i++,j+=3,k+=4){const x=f[j],y=f[j+1],z=f[j+2],l=127/(Math.sqrt(x*x+y*y+z*z)||1);q[k]=Math.round(x*l);q[k+1]=Math.round(y*l);q[k+2]=Math.round(z*l);}return new Uint8Array(q.buffer);}/* = nmPackGeometry */
const report={};
for(const key of MAPS){const dir=path.join(root,'models/valorant/maps',key),g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8'));
 const bufs=g.buffers.map(b=>fs.readFileSync(path.join(dir,b.uri)));
 const sem=new Map();for(const me of g.meshes)for(const p of me.primitives){for(const [a,ai] of Object.entries(p.attributes))sem.set(ai,a);if(p.indices!=null)sem.set(p.indices,'INDICES');}
 const viewAcc=new Map();g.accessors.forEach((a,i)=>{if(a.bufferView==null)return;if(viewAcc.has(a.bufferView))throw Error(key+': bufferView '+a.bufferView+' shared by two accessors');viewAcc.set(a.bufferView,i);});
 const out=JSON.parse(JSON.stringify(g)),parts=g.buffers.map(()=>[]),len=g.buffers.map(()=>0),st={raw:0,packed:0,views:0};
 const order=g.bufferViews.map((v,i)=>i).sort((a,b)=>g.bufferViews[a].buffer-g.bufferViews[b].buffer||(g.bufferViews[a].byteOffset||0)-(g.bufferViews[b].byteOffset||0));
 for(const vi of order){const v=g.bufferViews[vi],ai=viewAcc.get(vi),a=g.accessors[ai],s=sem.get(ai);if(v.byteStride||(a.byteOffset||0))throw Error(key+': view '+vi+' is strided / offset');
  const b=bufs[v.buffer],src=new Uint8Array(b.buffer,b.byteOffset+(v.byteOffset||0),v.byteLength);let filter,stride,data,want=src;
  if(s==='POSITION'&&a.componentType===5126&&a.type==='VEC3'){filter='delta32';stride=12;data=enc(src,filter,stride);}
  else if(s==='NORMAL'&&a.componentType===5126&&a.type==='VEC3'){filter='none';stride=4;want=normals8(src);data=Uint8Array.from(want);const oa=out.accessors[ai];oa.componentType=5120;oa.normalized=true;oa.type='VEC4';delete oa.min;delete oa.max;}
  else if(s==='INDICES'&&a.componentType===5125){filter='zigzag32';stride=4;data=enc(src,filter,stride);}
  else if(/^TEXCOORD_/.test(s)&&a.componentType===5126){filter='none';stride=a.type==='VEC2'?8:4;data=Uint8Array.from(src);}
  else{filter='none';stride=4;if(src.length%4)throw Error(key+': view '+vi+' not 4-byte sized');data=Uint8Array.from(src);}
  const count=want.length/stride,dec=new Uint8Array(nmUnpack(data,{filter,stride,count}));
  if(dec.length!==want.length||Buffer.compare(Buffer.from(dec.buffer,dec.byteOffset,dec.length),Buffer.from(want.buffer,want.byteOffset,want.length))!==0)throw Error(key+': view '+vi+' ('+s+') does not decode to the same bytes');
  const k=v.buffer,off=len[k];parts[k].push(data);len[k]+=data.length;const pad=(4-len[k]%4)%4;if(pad){parts[k].push(new Uint8Array(pad));len[k]+=pad;}
  out.bufferViews[vi]={buffer:k,byteOffset:off,byteLength:data.length,extensions:{VS_packed_view:{filter,stride,count}}};if(v.target)out.bufferViews[vi].target=v.target;
  st.raw+=v.byteLength;st.packed+=data.length;st.views++;}
 out.buffers=g.buffers.map((b,k)=>({uri:b.uri.replace(/^geometry-/,'geometry-packed-'),byteLength:len[k]}));
 if(out.buffers.some((b,k)=>b.uri===g.buffers[k].uri))throw Error(key+': unexpected buffer name');
 out.extensionsUsed=[...new Set([...(g.extensionsUsed||[]),'VS_packed_view'])];out.asset=Object.assign({},g.asset,{extras:Object.assign({},g.asset&&g.asset.extras,{packedFrom:'scene.gltf',packer:'work/build_packed_geometry.cjs'})});
 for(const f of fs.readdirSync(dir))if(/^geometry-packed-\d+\.bin$/.test(f))fs.unlinkSync(path.join(dir,f));
 out.buffers.forEach((b,k)=>fs.writeFileSync(path.join(dir,b.uri),Buffer.concat(parts[k].map(p=>Buffer.from(p.buffer,p.byteOffset,p.length)))));
 fs.writeFileSync(path.join(dir,'scene-packed.gltf'),JSON.stringify(out));report[key]=st;console.log(key,JSON.stringify(st));}
