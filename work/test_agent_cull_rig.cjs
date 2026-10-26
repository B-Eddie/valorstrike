// Agent cull spheres on the real rigs (browser perf_cull4: Reyna's small mesh CS_Vampire_S0_Skelmeshmd was culled on screen at 3 m).
// xvCull used to pad each skinned mesh's sphere to that mesh's own idle diagonal; a small piece riding a limb left it by 1.7x its
// radius while running / reloading. Every mesh of a rig now shares the rig's idle box (centre + full diagonal). Built like xvAgent
// (server/tools/grip-view.mjs), measured at the idle pose, then every vertex of every mesh must stay inside its sphere through
// run + reload, crouch + knife and walk + aim, wherever the unit stands.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');const root=path.join(__dirname,'..');
console.warn=((w)=>(...a)=>{if(!/boneTransform/.test(String(a[0])))w(...a);})(console.warn);
(async()=>{
 const G=await import(path.join(root,'server/tools/grip-view.mjs')),THREE=await import(require.resolve('three',{paths:[path.join(root,'server')]}));
 const rt=fs.readFileSync(path.join(root,'work/valorant_runtime.js'),'utf8'),a=rt.indexOf('function xvCull('),b=rt.indexOf('\nfunction xvAgent(',a);
 const xvCull=new Function('THREE','return '+rt.slice(a,b))(THREE);const v=new THREE.Vector3(),out=[];
 for(const ag of ['reyna','jett','sova']){const R=await G.build(ag,'vandal');const {M,step,play}=R;const L=[];M.m.traverse(o=>{if(o.isSkinnedMesh)L.push(o);});
  assert(L.length>=2,ag+' has several skinned meshes');M.m.position.set(10,8,-5);M.m.updateMatrixWorld(true);
  for(const m of L)delete m.geometry.userData.xvCull;assert.equal(xvCull(L).length,L.length);
  let worst=0,wn='';const check=()=>{M.m.updateMatrixWorld(true);for(const m of L){const S=m.geometry.boundingSphere.clone().applyMatrix4(m.matrixWorld),P=m.geometry.attributes.position,bt=m.applyBoneTransform||m.boneTransform;
   for(let i=0;i<P.count;i+=3){v.fromBufferAttribute(P,i);bt.call(m,i,v);v.applyMatrix4(m.matrixWorld);const q=v.distanceTo(S.center)/S.radius;if(q>worst){worst=q;wn=m.name;}}}};
  check();for(const [lo,up,x,z,ry] of [['run','reload',-40,60,2],['crouch','knife',5,-30,-1],['walk','aim',0,0,0.5]]){M.m.position.set(x,3,z);M.m.rotation.y=ry;play(lo,up);for(let k=0;k<4;k++){step(8);check();}}
  assert(worst<=1,`${ag}: ${wn} leaves its cull sphere (${worst.toFixed(2)} x radius)`);out.push(`${ag} ${L.length} meshes worst ${(worst*100).toFixed(0)}%`);}
 console.log('Agent cull on real rigs: '+out.join('; '));
})().catch(e=>{console.error(e);process.exit(1);});
