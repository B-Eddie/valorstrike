// QA-only codec for already-prepared immutable map geometry. No material/texture serialization.
// Each unique BufferGeometry is one independently loadable blob, so a future loader can upload
// and drop it before fetching the next. Does not implement a complete map loader.
const assert=require('assert/strict'),crypto=require('crypto');
const types={Float32Array,Uint32Array,Uint16Array,Uint8Array,Int8Array,Int16Array,Int32Array};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function encode(g){assert(!Object.keys(g.morphAttributes).length,'morph not immutable static map');const parts=[],entries=[];let size=0;
 const add=(name,a)=>{assert(a&&!a.isInterleavedBufferAttribute&&a.array&&types[a.array.constructor.name],'unsupported or already released array');assert(a.count*a.itemSize===a.array.length);const pad=(4-size%4)%4;if(pad){parts.push(Buffer.alloc(pad));size+=pad;}const b=Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);entries.push({name,type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,count:a.count,offset:size,bytes:b.length,hash:hash(b)});parts.push(b);size+=b.length;};
 for(const k of Object.keys(g.attributes))add(k,g.attributes[k]);if(g.index)add('$index',g.index);
 const blob=Buffer.concat(parts),manifest={version:1,bytes:blob.length,hash:hash(blob),entries,groups:g.groups.map(v=>({...v})),drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:null},sphere:g.boundingSphere?{c:g.boundingSphere.center.toArray(),r:g.boundingSphere.radius}:null,box:g.boundingBox?{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}:null};return{manifest,blob};}
function decode(THREE,m,blob){assert(m.version===1&&m.bytes===blob.byteLength&&m.hash===hash(blob),'cache integrity');const g=new THREE.BufferGeometry();
 try{for(const e of m.entries){const C=types[e.type];assert(C&&Number.isSafeInteger(e.offset)&&e.offset>=0&&e.offset%4===0&&Number.isSafeInteger(e.bytes)&&e.bytes>=0&&e.offset+e.bytes<=blob.byteLength);assert(e.bytes===e.count*e.itemSize*C.BYTES_PER_ELEMENT);const view=blob.subarray(e.offset,e.offset+e.bytes);assert(hash(view)===e.hash);const copy=new Uint8Array(e.bytes);copy.set(view);const a=new THREE.BufferAttribute(new C(copy.buffer),e.itemSize,e.normalized);if(e.name==='$index'){assert(e.itemSize===1);g.setIndex(a);}else g.setAttribute(e.name,a);}
  g.groups=m.groups.map(v=>({...v}));g.drawRange={start:m.drawRange.start,count:m.drawRange.count===null?Infinity:m.drawRange.count};if(m.sphere)g.boundingSphere=new THREE.Sphere(new THREE.Vector3(...m.sphere.c),m.sphere.r);if(m.box)g.boundingBox=new THREE.Box3(new THREE.Vector3(...m.box.min),new THREE.Vector3(...m.box.max));return g;
 }catch(e){g.dispose();throw e;}}
module.exports={encode,decode};
