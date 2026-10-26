// Third-person animation simulator (no browser): the shipped xUbAnim state machine + packed retargeted clips + the native
// post passes (contact, airborne pelvis, crouch IK) on a real agent skin, driven by a scripted unit (position per frame).
// Used by test_tp_jump.cjs / test_tp_gait.cjs and by tp_motion_sheet.cjs (before/after pose strips).
const vm=require('node:vm'),{runtime,build,T,html,cut}=require('./tp_body_harness.cjs');
async function sim(slug='jett'){
 const R=await build(slug),c=R.c;
 c.groundAt=(x,z)=>c.__floor||0;c.mode='dm';c.FV={};c.WEAP={};c.xFvOK=false;c.window={};
 const src=cut(html,'const XUB_NAT','// one-shot triggers')+cut(html,'// one-shot triggers','function xUbW(');
 const extra=html.indexOf('// Landing knee give')>=0?cut(html,'// Landing knee give','// one-shot triggers'):'';
 vm.runInContext(src+';globalThis.api2={xUbAnim,xUbLoco,XUB_NAT,XUB_RATE'+(extra?',xUbLandStart,xUbLandEnv,XUB_LAND':'')+'};'+
  (html.indexOf('var XUG')>=0?cut(html,'var XUG','// ---- END XUG ----')+';Object.assign(api2,{XUG,xUgGait:typeof xUgGait==="function"?xUgGait:null});':''),c);
 const {M,X}=R,b={g:{position:new T.Vector3(),rotation:{y:0}},hp:100,alive:true};M.m.position.set(0,0,0);
 X.sc.traverse(o=>{if(o.isSkinnedMesh)o.boneTransform=o.applyBoneTransform;});
 let last=null;
 // one frame: move the unit to (x,y,z) facing yaw, then animate exactly as xVisB + the page mixer loop do
 const frame=(dt,x,y,z,yaw=0,opt={})=>{const P=b.g.position,sp=last?Math.min(8,Math.hypot(x-last.x,z-last.z)/dt):0;P.set(x,y,z);b.g.rotation.y=yaw;b.cr=!!opt.cr;
  M.m.position.set(x,y,z);M.m.rotation.y=yaw;M.m.updateMatrixWorld(true);last={x,z};c.__floor=opt.floor||0;
  c.api2.xUbAnim(b,M,sp,dt);X.poseDt=dt;c.api.xUbPre(M);X.mx.update(dt);c.api.xUbPost(M);M.m.updateMatrixWorld(true);return sp;};
 const at=n=>R.bone(n).getWorldPosition(new T.Vector3());
 return {...R,b,frame,at,api2:c.api2};
}
module.exports={sim,T};
