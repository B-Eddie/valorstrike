// Exercise the shipped packed clips, native attachment, contact pass and crouch IK with real skins.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const {T,parse,context,root}=require('./rig_harness.cjs');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<0)throw Error('missing source '+a);return s.slice(i,j);};
async function runtime(){
 const base=path.dirname(require.resolve('three',{paths:[path.join(root,'server')]}));
 const SkeletonUtils=await import(pathToFileURL(path.join(base,'../examples/jsm/utils/SkeletonUtils.js')).href);
 const c=context({THREE:{...T,SkeletonUtils},XSOL:{mx:[]},XNR(){},xRimM(){},XGRIP:{}});
 const grip=fs.readFileSync(path.join(root,'work/grip_runtime.js'),'utf8');
 vm.runInContext(cut(html,'var XUB =','// Third-person locomotion')+cut(html,'function xUbW(','// any weapon sound')+
  cut(html,'function xvaClips(','function xvaParse(')+cut(html,'function xvCull(','// #11: no stand-in')+
  cut(html,'{const pre=xUbPre,post=xUbPost;', '// Native first-person')+
  cut(grip,'function xgWorldQ(','// Desired hand world rotation')+
  cut(html,'// Native rigs (nativeContact)','function xrHitboxes')+
  fs.readFileSync(path.join(root,'work/feet_runtime.js'),'utf8')+
  ';globalThis.api={xvAgent,xvaKit,xUbPre,xUbPost,xUbDead,xUbFollow,xUbCarry,xUbRot};',c);
 const b=fs.readFileSync(path.join(root,'models/valorant/agents/locomotion.bin'));
 c.packed={h:JSON.parse(fs.readFileSync(path.join(root,'models/valorant/agents/locomotion.json'))),f:new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
 return c;
}
async function build(slug,c){
 c ||= await runtime();const gl=await parse(path.join(root,'models/valorant/agents',slug+'.glb'));
 const kit=c.api.xvaKit(gl,c.packed,slug),M={m:new T.Group(),mats:[],nm:slug};c.api.xvAgent(M,kit);const X=M.sx;
 // r147 page API, equivalent to applyBoneTransform in the Node r160 harness.
 X.sc.traverse(o=>{if(o.isSkinnedMesh)o.boneTransform=o.applyBoneTransform;});
 const play=(lo='idle',cb=0,yaw=0,pit=0)=>{
  c.api.xUbPre(M);X.cb=cb;X.yaw=yaw;X.pit=pit;
  for(const n in X.a){const w=n===lo?1-.62*cb:n===(lo==='idle'?'crouch':'crouchWalk')?.62*cb:n==='aim'?1:0;X.w[n]=w;X.a[n].setEffectiveWeight(w);if(w)X.a[n].play();else X.a[n].stop();}
 };
 const step=(dt=1/60)=>{c.api.xUbPre(M);X.mx.update(dt);c.api.xUbPost(M);M.m.updateMatrixWorld(true);};
 const bone=n=>X.sc.getObjectByName(n),at=n=>bone(n).getWorldPosition(new T.Vector3());
 return {c,M,X,kit,play,step,bone,at};
}
module.exports={runtime,build,T,html,cut};
