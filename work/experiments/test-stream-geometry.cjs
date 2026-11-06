const assert=require('assert/strict'),THREE=require(require.resolve('three',{paths:[require('path').resolve(__dirname,'../../server')]})),{encode}=require('./geometry-cache.cjs'),{stage}=require('./stream-geometry.cjs');
(async()=>{const entries=[new THREE.BoxGeometry(),new THREE.SphereGeometry(1,8,6),new THREE.TorusGeometry(1,.2,5,9)].map(g=>{const d=encode(g);g.dispose();return d;});let order=[],active=0,peak=0;
const opts={fetch:async(m,i)=>{order.push('fetch'+i);active++;peak=Math.max(peak,active);return entries[i].blob;},upload:async(g,i)=>{order.push('upload'+i);for(const a of [...Object.values(g.attributes),g.index].filter(Boolean))a.array=null;active--;}};
const made=await stage(THREE,entries.map(e=>JSON.parse(JSON.stringify(e.manifest))),opts);assert.equal(peak,1);assert.deepEqual(order,['fetch0','upload0','fetch1','upload1','fetch2','upload2']);made.forEach(g=>g.dispose());
let disposed=0;const original=THREE.BufferGeometry.prototype.dispose;THREE.BufferGeometry.prototype.dispose=function(){disposed++;return original.call(this);};
try{const ac=new AbortController();await assert.rejects(stage(THREE,entries.map(e=>e.manifest),{...opts,signal:ac.signal,upload:async(g,i)=>{await opts.upload(g,i);if(i===1)ac.abort(new Error('map changed'));}}),/map changed/);assert.equal(disposed,2,'all built geometries disposed on map change');
 disposed=0;await assert.rejects(stage(THREE,entries.map(e=>e.manifest),{...opts,upload:async()=>{throw new Error('GL upload failed');}}),/GL upload failed/);assert.equal(disposed,1);
 disposed=0;await assert.rejects(stage(THREE,entries.map(e=>e.manifest),{...opts,upload:async()=>{}}),/did not release/);assert.equal(disposed,1);
 disposed=0;const done=new AbortController();done.abort();await assert.rejects(stage(THREE,entries.map(e=>e.manifest),{...opts,signal:done.signal}));assert.equal(disposed,0);
}finally{THREE.BufferGeometry.prototype.dispose=original;}
console.log('QA geometry sequential fetch/upload/drop peak1, cancellation/error/missing-release cleanup: PASS; upload stub only, not GPU/full-map/memory proof');})().catch(e=>{console.error(e);process.exitCode=1});
