// Real triangle raycasts exercise the same API contract as server/src/world.js, not canned hit values.
const assert=require('assert/strict'),T=require('../server/node_modules/three/build/three.cjs'),M=require('../vendor/barrier-mesh.cjs');
const floor=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshBasicMaterial({side:T.DoubleSide}));floor.rotation.x=-Math.PI/2;
const wall=new T.Mesh(new T.BoxGeometry(.2,3,8),new T.MeshBasicMaterial({side:T.DoubleSide}));wall.position.set(4,1.5,0);
const objects=[floor,wall];objects.forEach(o=>o.updateMatrixWorld(true));const r=new T.Raycaster();
const cast=(o,d,max)=>{r.set(new T.Vector3(...o),new T.Vector3(...d));r.near=0;r.far=max;return r.intersectObjects(objects,false)[0];};
const W={ray(o,d,max){return cast(o,d,max)?.distance??Infinity;},rayN(o,d,max){const h=cast(o,d,max);return h?{distance:h.distance,normal:h.face.normal.clone().transformDirection(h.object.matrixWorld).toArray()}:null;},ground(){throw Error('no nav fallback');}};
let s=M.create([0,0,0],0,M.terrainResolver(W));assert.equal(s.nodes.filter(Boolean).length,5);assert.ok(Math.abs(s.nodes[1].p[0]-3.6)<1e-6);assert.equal(s.nodes[3].p[0],-10);assert.ok(s.nodes.every(n=>Math.abs(n.p[1])<1e-6));M.advance(s,1);assert(M.blocked(s,3,0,.4,0));assert(!M.blocked(s,5,0,.4,0));assert.equal(M.ray(s,[2,1,4],[0,0,-1]),null,'movement arm does not become bullet wall');
objects.splice(0,1);s=M.create([0,0,0],0,M.terrainResolver(W));assert.equal(s.nodes.filter(Boolean).length,1,'all unsupported outer nodes omitted');assert.equal(M.arms(M.advance(s,1)).length,0);
// Elevated terrain belongs to the endpoint, and queries interpolate between floor levels.
floor.position.y=1;floor.updateMatrixWorld(true);objects.unshift(floor);s=M.create([0,1,0],Math.PI/4,M.terrainResolver(W));assert.equal(s.nodes.filter(Boolean).length,5);assert.ok(s.nodes.every(n=>Math.abs(n.p[1]-1)<1e-6));
objects.forEach(o=>{o.geometry.dispose();o.material.dispose();});console.log('Barrier Mesh terrain adapter real THREE triangle rays: bounded wall shortening, flat/elevated floor support, absent floor omission, no bullet-wall hit PASS (not real map, not installed)');
