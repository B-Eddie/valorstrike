const assert=require('assert/strict'),crypto=require('crypto'),THREE=require(require.resolve('three',{paths:[require('path').resolve(__dirname,'../../server')]})),{encode,decode}=require('./geometry-cache.cjs');
const bytes=a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
for(const g of [new THREE.BoxGeometry(2,3,4),new THREE.TorusGeometry(2,.4,8,17)]){
 const n=g.attributes.normal,p=new Int8Array(n.count*4);for(let i=0;i<n.count;i++)for(let k=0;k<3;k++)p[i*4+k]=Math.round(n.array[i*3+k]*127);g.setAttribute('normal',new THREE.BufferAttribute(p,4,true));g.setAttribute('nmM',new THREE.Uint16BufferAttribute(new Uint16Array(g.attributes.position.count).fill(137),1));g.computeBoundingBox();g.computeBoundingSphere();g.setDrawRange(3,6);const{manifest,blob}=encode(g),d=decode(THREE,JSON.parse(JSON.stringify(manifest)),blob);
 for(const k of Object.keys(g.attributes)){assert(bytes(g.attributes[k]).equals(bytes(d.attributes[k])));assert.equal(d.attributes[k].normalized,g.attributes[k].normalized);assert.equal(d.attributes[k].array.constructor,g.attributes[k].array.constructor);}
 assert(bytes(g.index).equals(bytes(d.index)));assert.deepEqual(d.groups,g.groups);assert.deepEqual(d.drawRange,g.drawRange);assert(d.boundingBox.equals(g.boundingBox));assert(d.boundingSphere.equals(g.boundingSphere));
 const bad=Buffer.from(blob);bad[0]^=1;assert.throws(()=>decode(THREE,manifest,bad));const stale={...manifest,version:2};assert.throws(()=>decode(THREE,stale,blob));d.dispose();g.dispose();}
console.log('QA geometry codec exact packed attributes/index/groups/bounds/drawRange + corrupt/version reject: PASS; not full-map material/strip/cache loader or gameplay proof');

const infinite=new THREE.BoxGeometry();const enc=encode(infinite),decoded=decode(THREE,JSON.parse(JSON.stringify(enc.manifest)),enc.blob);assert.equal(decoded.drawRange.count,Infinity,'JSON transport preserves unbounded draw range');decoded.dispose();infinite.dispose();
console.log('QA geometry manifest actual JSON roundtrip preserves Infinity draw range: PASS');
