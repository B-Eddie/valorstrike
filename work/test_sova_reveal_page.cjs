// Full real page composition in fake DOM + real THREE/noGL, not browser gameplay.
const assert=require('assert/strict'),{boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:11}),x=H.xe;
x('window.__sr={see:xRcnSees,ring:xRcnRings};xRcnSees=()=>true;xRcnRings=()=>{};J.rv=[];J.rvT=0;window.__rb={alive:true,g:new THREE.Group(),body:new THREE.Mesh(new THREE.BoxGeometry(.5,1,.3)),head:new THREE.Mesh(new THREE.SphereGeometry(.2))};bots.push(window.__rb);jRcnPulse(new THREE.Vector3());true');
assert.equal(x('__rb.rvO[0].material===svxRvMat'),true,'full page Recon orange');
x('jUnreveal();xHfRv([__rb],1,svxRvMat);true');assert.equal(x('__rb.rvO[0].material===svxRvMat'),true);
x('jUnreveal();xHfRv([__rb],1);true');assert.equal(x('__rb.rvO[0].material===rvMat'),true);
x('jUnreveal();xRcnSees=__sr.see;xRcnRings=__sr.ring;true');assert.equal(x('__rb.body.children.length'),0);
console.log('full-page Sova reveal calls: orange material present after actual script composition; shared default red; removed (noGL, LOS/rings stubbed)');
