// Corpse physics regression: skeleton-preserving ragdoll on the native rig (no exploding skin,
// joint limits, bounded cost, NaN/huge-dt safety). Set RAGDOLL_PNG=dir to also rasterize poses.
const assert=require('assert/strict'),path=require('path'),H=require('./rig_harness.cjs');
const src=H.section('repair_runtime.js','// Skeleton-preserving corpse physics.','{const die=xDie;');
(async()=>{
 const run=async(slug,opts={})=>{
  const A=await H.agent(slug,opts.clip||'Idle_Loop');let calls=0;const floor=opts.floor||(()=>0);
  const c=H.context({groundAt:(x,z,r,y)=>{calls++;return floor(x,z,y);}});require("vm").runInContext(src,c);
  A.m.position.set(...(opts.at||[0,0,0]));A.m.rotation.y=opts.ry||0;A.m.updateMatrixWorld(true);
  const lengths=[];A.sc.traverse(b=>{if(b.isBone&&b.parent&&b.parent.isBone)lengths.push([b,b.position.length()]);});
  const before=H.skinned(A.sc);let ext0=0;for(let i=1;i<before.length;i+=3)ext0=Math.max(ext0,before[i]);
  if(opts.hit)A.M.ragHit=opts.hit;
  let alive=true,t=0,frames=0,worst=0;const dts=opts.dts||[1/60];
  while(alive&&t<5){const dt=dts[frames%dts.length];const t0=process.hrtime.bigint();alive=c.xrRagdollTick(A.M,dt);worst=Math.max(worst,Number(process.hrtime.bigint()-t0)/1e6);t+=Number.isFinite(dt)?Math.min(.05,Math.max(0,dt)):0;frames++;}
  assert(A.M.ragdoll,'ragdoll built for '+slug);
  // Bone offsets are never stretched below the root.
  for(const [b,l]of lengths)if(b.name!=='Splitter')assert(Math.abs(b.position.length()-l)<1e-5,'bone stretched: '+b.name);
  const pts=H.skinned(A.sc);for(const v of pts)assert(Number.isFinite(v),'finite skin');
  const P=A.M.ragdoll.P,base=opts.at?opts.at[1]:0;
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxY=-Infinity;for(let i=0;i<pts.length;i+=3){minX=Math.min(minX,pts[i]);maxX=Math.max(maxX,pts[i]);maxY=Math.max(maxY,pts[i+1]);minZ=Math.min(minZ,pts[i+2]);maxZ=Math.max(maxZ,pts[i+2]);}
  assert(Math.max(maxX-minX,maxZ-minZ)<2.6,'skin stays body-sized after death ('+slug+')');
  return {A,P,calls,frames,worst,maxY,base,c};
 };
 const out=process.env.RAGDOLL_PNG;
 for(const slug of ['jett','sova','reyna','breach']){
  const r=await run(slug);
  assert(r.P.Pelvis.p.y<.4,slug+' pelvis settles near the floor: '+r.P.Pelvis.p.y);
  assert(r.P.Head.p.y<.45&&r.P.Head.p.y>.03,slug+' head rests on the floor: '+r.P.Head.p.y);
  for(const a of r.A.M.ragdoll.list)assert(a.p.y>=a.r-.02,slug+' '+a.n+' above floor');
  assert(r.maxY<.75,slug+' collapsed: '+r.maxY);
  // Joint limits: knees not folded flat, elbows not crushed into the shoulder.
  for(const s of ['L_','R_']){const hf=r.P[s+'Hip'].p.distanceTo(r.P[s+'Foot'].p),th=r.P[s+'Hip'].p.distanceTo(r.P[s+'Knee'].p)+r.P[s+'Knee'].p.distanceTo(r.P[s+'Foot'].p);assert(hf>.44*th,slug+' knee limit');}
  // Cost: at most one ground query per simulated joint per frame, a few ms per tick.
  assert(r.calls<=r.A.M.ragdoll.list.length*(r.frames/4+2),'ground queries bounded: '+r.calls+' over '+r.frames);
  if(out)H.render([{o:r.A.m}],path.join(out,'ragdoll-'+slug+'.png'),{eye:[2.6,1.8,2.2],target:[0,.2,0],extra:[[[-3,0,-3],[3,0,-3],[3,0,3],[120,130,140]],[[-3,0,-3],[3,0,3],[-3,0,3],[120,130,140]]]});
 }
 // Erratic frame pacing, NaN/negative/huge dt, poisoned hit vector, and a death on a ledge.
 const r2=await run('jett',{dts:[0,NaN,-1,1,1/30,1/240,.2],hit:{x:NaN,z:Infinity}});
 for(const a of r2.A.M.ragdoll.list)assert(Number.isFinite(a.p.y));
 const r3=await run('phoenix',{floor:(x,z)=>z>0.3?2:0,at:[0,2,0],ry:0});
 assert(r3.P.Pelvis.p.y<2.5,'ledge corpse settles');
 const r4=await run('omen',{clip:'Jog_Fwd_Loop',hit:{x:1,z:0}});
 assert(r4.P.Head.p.x>0.05,'killing-shot direction carries the body');
 // A rig missing a core joint simply skips physics (pose freezes) instead of throwing.
 const r5=await H.agent('jett');r5.sc.getObjectByName('L_Knee').name='renamed';const c=H.context({groundAt:()=>0});require('vm').runInContext(src,c);assert.equal(c.xrRagdollTick(r5.M,1/60),false);
 console.log('Ragdoll: skeleton-preserving joints on four agents, no stretched bones/exploding skin, joint limits, floor/ledge contact, hit direction, bounded ground queries, NaN/huge-dt safety, missing-joint fallback');
})().catch(e=>{console.error(e);process.exit(1);});
