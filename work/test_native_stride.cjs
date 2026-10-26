// Measure the actual packed runtime's skinned support feet, not just a rate formula.
const assert=require('node:assert/strict');
const {runtime,build,T}=require('./tp_body_harness.cjs');
(async()=>{
 const c=await runtime(),rows=[];
 for(const slug of Object.keys(c.packed.h.agents)){
  const R=await build(slug,c),{X}=R;R.play('run');X.a.run.timeScale=5.4/2.9;
  const v=new T.Vector3();let max=0;
  for(let i=0;i<120;i++){
   R.step(1/120);let low=Infinity;
   for(const {o,indices}of X.contactProbes){o.skeleton.update();for(const j of indices){
    v.fromBufferAttribute(o.geometry.attributes.position,j);o.applyBoneTransform(j,v);
    v.applyMatrix4(o.matrixWorld);low=Math.min(low,v.y);
   }}
   const lift=low-R.M.m.getWorldPosition(new T.Vector3()).y;assert(lift>-.001,slug+' support foot never sinks');max=Math.max(max,lift);
  }
  assert(max<=.0201,slug+' stride support lift '+max);
  // Airborne state must retain the jump pose without pulling it toward the floor.
  c.api.xUbPre(R.M);X.air=true;X.contactRestore=null;c.api.xUbPost(R.M);
  assert.equal(X.contactRestore,null,'airborne bypasses grounded correction');
  rows.push(slug+' '+(max*100).toFixed(2)+' cm');
 }
 console.log('native stride support lift at rifle speed: '+rows.join(', ')+'; actual jumps bypass correction');
})().catch(e=>{console.error(e);process.exit(1);});
