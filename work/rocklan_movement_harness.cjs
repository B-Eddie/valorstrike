// Node-only evaluation of the shipped native animator plus the movement overlay.
// Existing harnesses and the mixed source animation library remain unchanged.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=require('./tp_body_harness.cjs');
const {T,html,cut}=base,root=path.join(__dirname,'..');
async function runtime(){
 const c=await base.runtime();
 Object.assign(c,{groundAt:()=>c.__floor||0,mode:'dm',FV:{},WEAP:{},xFvOK:false,window:{}});
 // Define landing and the complete base state machine BEFORE wrapping either function.
 vm.runInContext(cut(html,'const XUB_NAT','// one-shot triggers')+
  cut(html,'// one-shot triggers','function xUbW(')+
  ';globalThis.originalApi={xvaKit,xvAgent,xUbAnim,xUbLand,xUbW,mappings:JSON.stringify(XUB_ST)};',c);
 const b=fs.readFileSync(path.join(root,'models/valorant/movement/movement.bin'));
 c.packed.movement={h:JSON.parse(fs.readFileSync(path.join(root,'models/valorant/movement/movement.json'))),
  f:new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'rocklan_movement_runtime.js'),'utf8')+
  ';Object.assign(api,{xvaKit,xvAgent,xUbPre,xUbPost,xUbAnim,xUbLand,xUbW,xrmGround,xrmDirections,xrmClips,xrmCycle});'+
  ';globalThis.movementMappings=()=>JSON.stringify(XUB_ST);',c);
 return c;
}
async function build(slug='jett',c){
 c ||= await runtime();
 const R=await base.build(slug,c),{M,X}=R;
 M.w='Vandal';
 const originalKit=c.originalApi.xvaKit(R.kit.gl,c.packed,slug);
 const b={g:{position:new T.Vector3(),rotation:{y:0}},hp:100,alive:true};
 let last={x:0,y:0,z:0};X.px=X.py=X.pz=0;
 const frame=(dt,x,y,z,yaw=0,opt={})=>{
  const sp=Math.hypot(x-last.x,z-last.z)/dt;
  b.g.position.set(x,y,z);b.g.rotation.y=yaw;b.cr=!!opt.cr;
  b.xkr=!!opt.rope;b.xk=opt.rope?(opt.ropeAxis||'vertical'):null;
  M.m.position.set(x,y,z);M.m.rotation.y=yaw;M.m.updateMatrixWorld(true);
  c.__floor=opt.floor||0;c.api.xUbAnim(b,M,sp,dt);
  X.poseDt=dt;c.api.xUbPre(M);X.mx.update(dt);c.api.xUbPost(M);M.m.updateMatrixWorld(true);
  last={x,y,z};return sp;
 };
 const advance=(n,{speed=0,angle=0,dy=0,yaw=0,dt=1/60,...opt}={})=>{
  for(let i=0;i<n;i++)frame(dt,last.x-Math.sin(angle)*speed*dt,last.y+dy*dt,last.z+Math.cos(angle)*speed*dt,yaw,opt);
 };
 const sole=()=>{
  let low=Infinity;const v=new T.Vector3();
  for(const {o,indices}of X.contactProbes){o.skeleton.update();for(const i of indices){
   v.fromBufferAttribute(o.geometry.attributes.position,i);o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);low=Math.min(low,v.y);
  }}
  return low-M.m.getWorldPosition(new T.Vector3()).y;
 };
 return {...R,b,frame,advance,sole,originalKit,get position(){return {...last};}};
}
module.exports={runtime,build,T,root};
