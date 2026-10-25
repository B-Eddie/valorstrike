// Native rigs: the rendered crouched head must match the authoritative head volume (server/src/hitboxes.js), which
// drops by ch (0.45 m at full crouch) from the upright head. Real Jett/Breach/Sage rigs, the xUbAnim blend
// (lower: idle/walk with crouch weight 0.62 * cb, upper: Pistol_Aim_Neutral), the repair-runtime correction in a VM.
const assert=require('assert/strict'),path=require('path'),{T,agent,section,context}=require('./rig_harness.cjs');
(async()=>{
 const {hitVolumes}=await import(path.join(__dirname,'../server/src/hitboxes.js')),V=(await import(path.join(__dirname,'../server/src/hitboxes.js'))).HITBOX.volumes;
 const up=/^(Spine[234]|Neck|Head|[LR]_(Clavicle|Shoulder|Elbow|Hand|Thumb|Index|Middle|Ring|Pinky))/;const out=[];
 for(const slug of ['jett','breach','sage']){
  const A=await agent(slug,null),{sc,m,mx,clips}=A,M={m,valorant:true,sx:{sc,mx,b:{},nativeContact:true,cb:0,w:{}}},X=M.sx;
  const c=context({xUbPre(){},xUbPost(){}});c.THREE=T;require('vm').runInContext(section('repair_runtime.js','// Native rigs (nativeContact)','function xrHitboxes')+';globalThis.pre=xUbPre;globalThis.post=xUbPost;',c);
  const L=n=>new T.AnimationClip(n+'_L',clips[n].duration,clips[n].tracks.filter(t=>!up.test(t.name))),U=n=>new T.AnimationClip(n+'_U',clips[n].duration,clips[n].tracks.filter(t=>up.test(t.name)));
  const idle=mx.clipAction(L('Idle_Loop')),crouch=mx.clipAction(L('Crouch_Idle_Loop')),aim=mx.clipAction(U('Pistol_Aim_Neutral'));for(const a of [idle,crouch,aim])a.play();
  const head=sc.getObjectByName('Head'),spine=sc.getObjectByName('Spine1'),foot=sc.getObjectByName('L_Foot'),v=new T.Vector3();
  const frame=(cb,dt=1/60)=>{X.cb=cb;c.pre(M);idle.setEffectiveWeight(1-.62*cb);crouch.setEffectiveWeight(.62*cb);mx.update(dt);m.updateMatrixWorld(true);const raw={head:head.getWorldPosition(v).y,foot:foot.getWorldPosition(new T.Vector3()).y};c.post(M);m.updateMatrixWorld(true);return {raw,head:head.getWorldPosition(new T.Vector3()).y,foot:foot.getWorldPosition(new T.Vector3()).y};};
  let st;for(let i=0;i<30;i++)st=frame(0);const standHead=st.head;assert(!X.ncRestore,'no correction standing');
  for(const cb of [.5,1]){let f;for(let i=0;i<10;i++)f=frame(cb);
   const want=standHead-.45*cb;assert(Math.abs(f.head-want)<.015,`${slug} cb ${cb}: head ${f.head.toFixed(3)} want ${want.toFixed(3)} (uncorrected ${f.raw.head.toFixed(3)})`);
   assert(Math.abs(f.foot-f.raw.foot)<1e-6,'feet untouched');
   // Server head sphere for the same crouch (ch = 0.45 * cb) vs the rendered head bone + the client sphere offset.
   const hv=ch=>hitVolumes({x:0,y:0,z:0,look:0,ch,vx:0,vz:0}).head.c[1],sv=hv(.45*cb),sdrop=hv(0)-sv;assert(Math.abs((standHead-f.head)-sdrop)<.015,`${slug} cb ${cb}: render drop ${(standHead-f.head).toFixed(3)} vs server ${sdrop.toFixed(3)}`);assert(Math.abs(f.head+V.headOffsetY-sv)<.07,`${slug} cb ${cb}: render head ${(f.head+V.headOffsetY).toFixed(3)} vs server ${sv.toFixed(3)} (shared table, per-agent spread ≤6 cm)`);
   if(cb===1)out.push(`${slug} ${(standHead-f.raw.head).toFixed(2)}→${(standHead-f.head).toFixed(2)} m`);}
  // Undone before the next mixer pass (Spine1 has no position track, so nothing else would reset it).
  const rest=spine.position.clone();frame(1);c.pre(M);assert(spine.position.distanceTo(rest)<1e-9||X.ncRestore===null);
  let f;for(let i=0;i<40;i++)f=frame(0);assert(Math.abs(f.head-standHead)<.01,'stands back up');
  X.cb=1;M.dead=true;c.pre(M);mx.update(1/60);m.updateMatrixWorld(true);const d0=head.getWorldPosition(new T.Vector3()).y;c.post(M);m.updateMatrixWorld(true);assert.equal(head.getWorldPosition(new T.Vector3()).y,d0,'dead skipped');M.dead=false;
 }
 console.log('Native crouch: rendered head drops 0.45 m × crouch blend like the server head volume (head drop at full crouch '+out.join(', ')+'); feet untouched, undone before the mixer, skipped standing/dead');
})().catch(e=>{console.error(e);process.exit(1);});
