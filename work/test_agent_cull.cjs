// Character draw calls (item 3 lag): VALORANT agent meshes were frustumCulled=false, so every bot's and ally's 2-6 skinned
// meshes were submitted every frame even behind the camera. xvCull gives each skinned geometry one cull sphere, measured
// once from the skinned idle pose in mesh space (works with r149 boneTransform and r151+ applyBoneTransform) and padded
// to the full idle diagonal; corpses switch culling off again in xDie. Checked on a rig with the GLTF/FBX layout
// (z-up centimetre geometry under a rotated 0.01 armature): idle, crouch, lying and reaching poses stay inside the sphere
// wherever the unit stands, a unit behind the camera is culled, one in view is not.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const rt=fs.readFileSync(path.join(root,'work/valorant_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=rt.indexOf('function xvCull('),b=rt.indexOf('\nfunction xvAgent(',a);assert(a>=0&&b>a,'xvCull defined before xvAgent');const src=rt.slice(a,b);
assert(html.includes(src),'index.html carries the regenerated runtime');
assert(rt.includes('cull = []; sc.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false; cull.push(o);')&&rt.includes('M.m.updateMatrixWorld(true); X.cull = xvCull(cull);'),'xvAgent measures after the idle pose is applied');
assert(/c\.dead = 1; if \(c\.sx && c\.sx\.cull\) for \(const o of c\.sx\.cull\) o\.frustumCulled = false;/.test(html),'xDie turns culling off for corpses');
const ctx={THREE,Number,Math};vm.createContext(ctx);vm.runInContext(src+';globalThis.xvCull=xvCull;',ctx);
const ABT=THREE.SkinnedMesh.prototype.applyBoneTransform;
function rig(r149){const M=new THREE.Group(),wr=new THREE.Group(),A=new THREE.Group();M.add(wr);wr.add(A);A.rotation.x=-Math.PI/2;A.scale.setScalar(.01);
 const b0=new THREE.Bone(),b1=new THREE.Bone(),b2=new THREE.Bone();b1.position.set(0,0,96);b2.position.set(0,0,50);b0.add(b1);b1.add(b2);A.add(b0);
 const g=new THREE.BoxGeometry(50,30,192,4,4,24);g.translate(0,0,96);const P=g.attributes.position,si=[],sw=[];
 for(let i=0;i<P.count;i++){const z=P.getZ(i);si.push(z<96?0:z<146?1:2,0,0,0);sw.push(1,0,0,0);}
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
 const m=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial());A.add(m);M.updateMatrixWorld(true);m.bind(new THREE.Skeleton([b0,b1,b2]),m.matrixWorld);
 if(r149){/* r149: boneTransform(index,target) reads the position itself and overwrites target; no applyBoneTransform */m.applyBoneTransform=undefined;m.boneTransform=function(i,t){t.set(9e9,9e9,9e9);return ABT.call(this,i,t.fromBufferAttribute(this.geometry.attributes.position,i));};}
 return {M,m,b0,b1,b2};}
const inside=(R)=>{R.M.updateMatrixWorld(true);const S=R.m.geometry.boundingSphere.clone().applyMatrix4(R.m.matrixWorld);S.radius+=1e-6;const v=new THREE.Vector3(),P=R.m.geometry.attributes.position;let worst=0;
 for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i);ABT.call(R.m,i,v);v.applyMatrix4(R.m.matrixWorld);worst=Math.max(worst,v.distanceTo(S.center)/S.radius);}return worst;};
const out=[];
for(const r149 of [false,true]){const R=rig(r149);R.M.position.set(12,3,-7);R.M.rotation.y=1.1;R.M.updateMatrixWorld(true);const L=ctx.xvCull([R.m,new THREE.Mesh()]);
 assert.equal(L.length,1,'skinned meshes only');assert.equal(R.m.frustumCulled,true);const S=R.m.geometry.userData.xvCull;assert(S&&S.radius>150&&S.radius<260,'sphere in mesh units (cm): '+(S&&S.radius));
 assert(Math.abs(S.center.z-96)<2&&Math.abs(S.center.x)<1,'centred on the idle body');if(!r149)assert(R.m.boundingSphere&&R.m.boundingSphere.equals(S),'r151+ mesh sphere set too');
 const poses={idle:()=>{},crouch:()=>{R.b1.position.z=55;R.b1.rotation.x=.5;},lying:()=>{R.b1.position.z=20;R.b1.rotation.x=Math.PI/2;R.b0.position.y=40;},reach:()=>{R.b1.rotation.set(0,0,0);R.b1.position.z=96;R.b2.rotation.x=1.2;R.b0.position.set(0,0,0);}};
 let worst=0;for(const [n,f] of Object.entries(poses)){f();for(const [x,z,ry] of [[0,0,0],[40,-25,2.5],[-60,80,-1]]){R.M.position.set(x,0,z);R.M.rotation.y=ry;worst=Math.max(worst,inside(R));}assert(worst<=1,n+' pose leaves the cull sphere: '+worst.toFixed(3));}
 // A second unit of the same kit reuses the measured sphere.
 const R2=rig(r149);R2.m.geometry=R.m.geometry;ctx.xvCull([R2.m]);assert.equal(R2.m.geometry.userData.xvCull,S,'one measurement per geometry');
 // Frustum: in front of the camera drawn, behind it culled.
 R.M.position.set(0,0,0);R.M.rotation.y=0;R.b1.rotation.set(0,0,0);R.b2.rotation.set(0,0,0);R.M.updateMatrixWorld(true);const cam=new THREE.PerspectiveCamera(70,16/9,.1,500);
 const vis=(px,pz,lx,lz)=>{cam.position.set(px,1.6,pz);cam.lookAt(lx,1.6,lz);cam.updateMatrixWorld(true);const F=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));return F.intersectsObject(R.m);};
 assert.equal(vis(0,10,0,0),true,'unit in view drawn');assert.equal(vis(0,10,0,20),false,'unit behind the camera culled');assert.equal(vis(0,1.2,0,8),true,'camera hugging the unit (sphere padding) still draws it');
 out.push((r149?'r149 boneTransform':'r151+ applyBoneTransform')+' worst pose '+(worst*100).toFixed(0)+'% of the radius');}
// Near camera (browser perf_cull4: Reyna's body mesh undrawn at the screen edge at 3 m while one of its skinned vertices was in view):
// live agents inside XSOL_NEAR of the camera skip the frustum test; beyond it the idle sphere culls again. Run the real xSolTick.
{const i1=html.indexOf('function xSolTick(d) {'),i0=html.indexOf('const XSOL_NEAR = ',i1),i2=html.indexOf('\n}\n',i1);assert(i1>=0&&i0>i1&&i2>i0,'XSOL_NEAR inside xSolTick in index.html');
 const near=+html.slice(i0).match(/XSOL_NEAR = ([0-9.]+)/)[1];assert(near>=4&&near<=10,'near radius '+near);
 const c2={THREE,Math,running:true,paused:false,XS:{lod:40},XSOL:{mx:[]},camera:new THREE.PerspectiveCamera(70,16/9,.1,500),xrHitboxes:null,xUbPre(){},xUbPost(){},xUbDead(){return false;}};vm.createContext(c2);
 vm.runInContext(html.slice(i1,i2+3)+';globalThis.xSolTick=xSolTick;',c2);
 const sc=new THREE.Scene(),mk=()=>{const M={m:new THREE.Group(),sx:{mx:{update(){}},cull:[new THREE.Mesh(),new THREE.Mesh()]}};M.sx.cull.forEach(o=>{o.frustumCulled=true;M.m.add(o);});sc.add(M.m);c2.XSOL.mx.push(M);return M;};
 const A=mk(),B=mk(),D=mk();D.dead=1;D.sx.cull.forEach(o=>o.frustumCulled=false);
 c2.camera.position.set(0,1.6,0);c2.camera.lookAt(0,1.6,-10);
 const at=(M,x,z)=>{M.m.position.set(x,0,z);M.m.updateMatrixWorld(true);};
 at(A,3,0);at(B,0,-near-4);at(D,1,0);c2.xSolTick(1/60);
 assert(A.sx.cull.every(o=>o.frustumCulled===false),'agent 3 m from the camera (off to the side) is never frustum-culled');
 assert(B.sx.cull.every(o=>o.frustumCulled===true),'agent beyond XSOL_NEAR keeps its cull sphere');
 assert(D.sx.cull.every(o=>o.frustumCulled===false),'corpse culling stays off');
 at(A,near+5,0);c2.xSolTick(1/60);assert(A.sx.cull.every(o=>o.frustumCulled===true),'walking away re-enables culling');
 at(A,-2,1);c2.xSolTick(1/60);assert(A.sx.cull.every(o=>o.frustumCulled===false),'behind the camera but close: drawn (turning past it cannot pop)');
 out.push('near-camera agents (< '+near+' m) unculled, culled again beyond');}
console.log('Agent cull: '+out.join('; ')+'; behind-camera unit culled, corpses unculled in xDie');
