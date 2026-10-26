// useMap's legacy-map GPU free (hk-31). Since 2eaf3b6 the page had two top-level `function xFreeMap` declarations (useMap's
// (o, keep) and the Split / Lotus / Breeze rebuild's (k, call)); the later one won, so useMap's call threw inside its try and
// never freed the previous legacy map. It is now xFreeLegacyMap. This test runs the page's own xFreeLegacyMap / xMapRes /
// useMap free line on real three.js objects: the previous map's own geometries / materials / textures are disposed; what the
// next map or the rest of the scene still uses, shared pieces and native-map pieces (CPU copies dropped after upload) are not;
// the native map root itself is never freed here (nmFree owns it).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('function xFreeLegacyMap(o, keep) {'),b=html.indexOf('function useMap(n) {');
assert(a>0&&b>a,'xFreeLegacyMap + xMapRes precede useMap');
const src=html.slice(a,b);
const um=html.slice(b,html.indexOf('\n}',b));
assert(/xFreeLegacyMap\(prev, xMapRes\(next\)\)/.test(um),'useMap frees the previous map with xFreeLegacyMap');
assert(!/xFreeMap\(prev/.test(um),'useMap no longer calls the shadowed xFreeMap');
assert.equal((html.match(/^function xFreeMap\(/mg)||[]).length,1,'one xFreeMap declaration (Split / Lotus / Breeze rebuild)');
function world(){
 const scene=new THREE.Scene(),disposed=new Set(),track=(o)=>{const d=o.dispose.bind(o);o.dispose=()=>{disposed.add(o);d();};return o;};
 const sharedMat=track(new THREE.MeshLambertMaterial()),sharedGeo=track(new THREE.BoxGeometry(1,1,1));sharedGeo.userData.shared=true;
 const nextMat=track(new THREE.MeshLambertMaterial()),agentMat=track(new THREE.MeshLambertMaterial());
 const ownTex=track(new THREE.Texture({width:2,height:2})),ownMat=track(new THREE.MeshLambertMaterial({map:ownTex})),ownGeo=track(new THREE.BoxGeometry(2,2,2));
 const keepTex=track(new THREE.Texture({width:2,height:2}));keepTex.userData.shared=true;const xdMat=track(new THREE.MeshLambertMaterial({map:keepTex}));xdMat.userData.xdShared=true;
 const nmGeo=track(new THREE.BoxGeometry(1,1,1));nmGeo.userData.nmReleased=true;const nmTex=track(new THREE.Texture({width:2,height:2}));nmTex.source.nmRefs=0;
 const nmMat=track(new THREE.MeshLambertMaterial({map:nmTex}));
 const usedGeo=track(new THREE.BoxGeometry(3,3,3));
 const prev=new THREE.Group(),next=new THREE.Group(),agent=new THREE.Group();
 prev.add(new THREE.Mesh(ownGeo,ownMat),new THREE.Mesh(sharedGeo,sharedMat),new THREE.Mesh(usedGeo,agentMat),new THREE.Mesh(nmGeo,nmMat),new THREE.Mesh(ownGeo,xdMat),new THREE.Mesh(usedGeo,nextMat));
 next.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),nextMat));agent.add(new THREE.Mesh(usedGeo,agentMat));
 scene.add(prev,next,agent);
 return {scene,prev,next,disposed,o:{sharedMat,sharedGeo,nextMat,agentMat,ownTex,ownMat,ownGeo,keepTex,xdMat,nmGeo,nmTex,nmMat,usedGeo}};
}
function run(w,NM){const c={scene:w.scene,Set,console};if(NM)c.NM=NM;vm.createContext(c);vm.runInContext(src,c);c.xFreeLegacyMap(w.prev,c.xMapRes(w.next));}
const w=world();run(w);const d=w.disposed,o=w.o;
for(const k of ['ownGeo','ownMat','ownTex','nmMat'])assert(d.has(o[k]),k+' (only the previous map uses it) is disposed');
assert(!d.has(o.sharedGeo),'userData.shared geometry kept');
assert(!d.has(o.nextMat),'material the next map uses kept');
assert(!d.has(o.agentMat)&&!d.has(o.usedGeo),'geometry / material the rest of the scene (an agent) uses kept');
assert(!d.has(o.xdMat)&&!d.has(o.keepTex),'xdShared material and shared texture kept');
assert(!d.has(o.nmGeo),'native map geometry (CPU arrays dropped after upload) never disposed here');
assert(!d.has(o.nmTex),'native map texture (source data closed after upload) never disposed here');
// the current native map root is never freed by useMap (nmFree owns its lifetime)
const w2=world();run(w2,{current:{M:{g:w2.prev}}});assert.equal(w2.disposed.size,0,'current native map root left alone');
// a freed legacy map still renders after a switch back: its geometry kept its CPU arrays (three re-uploads on next draw)
assert(o.ownGeo.attributes.position.array&&o.ownGeo.attributes.position.array.length>0,'freed geometry keeps CPU data for re-upload');
console.log('legacy map free: previous map own geometry/material/texture disposed; next-map, scene-shared, shared-flag and native-map pieces kept; native root skipped');
