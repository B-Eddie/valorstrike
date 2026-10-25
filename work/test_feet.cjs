// Foot planting regression (ledger row 6): on a step up/down, a slope and flat ground, both feet land on their own
// floor (two-bone IK + body drop on the native rig), leg bone lengths never stretch, the offsets clear on flat ground
// and in the air, and the pose does not accumulate across frames. Generated index.html carries the block once, after
// the grip block it depends on.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
console.warn=((w)=>(...a)=>{if(!/boneTransform/.test(String(a[0])))w(...a);})(console.warn);
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),src=fs.readFileSync(path.join(__dirname,'feet_runtime.js'),'utf8').replace(/\n+$/,'');
 assert(html.includes(src),'index.html carries work/feet_runtime.js');assert.equal(html.split('// ---- FOOT PLANTING ----').length,2);
 assert(html.indexOf('// ---- FOOT PLANTING ----')>html.indexOf('// ---- END WEAPON GRIP ----'),'feet installed after the grip helpers');
 const G=await import(path.join(root,'server/tools/grip-view.mjs'));
 let floor=()=>0;const C={bvh:{raycastFirst:(r)=>{const y=floor(r.origin.x,r.origin.z);return y<r.origin.y?{point:{y},face:{normal:{y:1}}}:null;}}};
 const api=G.runtime({feet:true,C});
 for(const [agent,weapon] of [['jett','vandal'],['breach','classic'],['sage','operator']]){
  const R=await G.build(agent,weapon,api),b=R.bone,v=n=>b(n).getWorldPosition(new (require('./rig_harness.cjs').T.Vector3)());
  const len=s=>[v(s+'_Hip').distanceTo(v(s+'_Knee')),v(s+'_Knee').distanceTo(v(s+'_Foot'))];
  const settle=(n=40)=>{R.step(1,1/30);for(let i=0;i<n;i++)R.step(1,0);};
  R.play('idle','aim');floor=()=>0;settle();const L0=v('L_Foot').y,R0=v('R_Foot').y,len0=len('L').concat(len('R'));
  const lx=v('L_Foot').x,rx=v('R_Foot').x;assert(lx*rx<0,'feet either side of the midline');const left=x=>(x>0)===(lx>0);
  for(const step of [0.2,-0.2,0.35]){floor=(x)=>left(x)?step:0;settle();
   const dl=v('L_Foot').y-L0,dr=v('R_Foot').y-R0,tag=agent+' step '+step;
   assert(Math.abs(dl-Math.max(step,0)-Math.min(0,step))<0.02&&Math.abs(dr)<0.02,tag+': left '+dl.toFixed(3)+' right '+dr.toFixed(3));
   const l=len('L').concat(len('R'));l.forEach((x,i)=>assert(Math.abs(x-len0[i])<1e-3,tag+' leg bones keep length'));}
  // slope: both feet follow the plane
  floor=(x,z)=>0.15*x+0.1*z;settle();for(const s of ['L','R']){const f=v(s+'_Foot'),want=floor(f.x,f.z);const base=s==='L'?L0:R0;assert(Math.abs(f.y-base-want)<0.03,agent+' slope '+s+' foot '+(f.y-base).toFixed(3)+' vs '+want.toFixed(3));}
  // beyond a stair rise the offset is clamped, not followed
  floor=(x)=>left(x)?1.5:0;settle();assert(v('L_Foot').y-L0<0.45,'ledge clamped');
  // flat again: back to the authored pose; airborne: no planting
  floor=()=>0;settle(80);assert(Math.abs(v('L_Foot').y-L0)<2e-3&&Math.abs(v('R_Foot').y-R0)<2e-3,agent+' flat restores the authored feet');
  floor=(x)=>left(x)?0.3:0;R.X.air=true;settle();assert(Math.abs(v('L_Foot').y-L0)<2e-3,agent+' no planting in the air');R.X.air=false;
  floor=(x)=>left(x)?0.2:0;settle();const a=v('L_Foot').y;for(let i=0;i<60;i++)R.step(1,0);assert(Math.abs(v('L_Foot').y-a)<1e-4,agent+' stable over frames');
  // grip still holds after the body drop
  const m=G.measure(R);assert(m.right<0.04&&m.left<0.05,agent+' grip survives foot planting');
 }
 console.log('foot planting ok');
})().catch(e=>{console.error(e);process.exit(1);});
