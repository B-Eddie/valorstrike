// Full native runtime: crouch moves both waist halves and re-plants feet; jog cannot poison the idle reference.
const assert=require('node:assert/strict'),path=require('node:path'),{runtime,build,T}=require('./tp_body_harness.cjs');
(async()=>{
 const {hitVolumes,HITBOX}=await import(path.join(__dirname,'../server/src/hitboxes.js')),c=await runtime(),out=[];
 for(const slug of Object.keys(c.packed.h.agents)){
  const {M,X,play,step,at,bone}=await build(slug,c);
  play();for(let i=0;i<60;i++)step();const stand=X.ncStand;assert(Number.isFinite(stand),slug+' idle reference');
  // Running upright must never update ncStand, even at the bottom of its bob.
  play('run');for(let i=0;i<90;i++)step();assert.equal(X.ncStand,stand,slug+' jog reference unchanged');
  let worstFoot=0;
  for(const lo of ['idle','walk'])for(const cb of [.5,1]){
   play(lo,cb);for(let i=0;i<60;i++){
    step();const head=at('Head').y-M.m.getWorldPosition(new T.Vector3()).y,want=stand-.45*cb;
    assert(Math.abs(head-want)<.015,`${slug} ${lo} ${cb}: head ${head.toFixed(3)} want ${want.toFixed(3)}`);
    if(X.ncRestore)for(const L of X.ncLegs){const d=L.hand.getWorldPosition(new T.Vector3()).distanceTo(L.target);worstFoot=Math.max(worstFoot,d);assert(d<.015,`${slug} ${lo} foot replant ${d}`);}
    const hv=ch=>hitVolumes({x:0,y:0,z:0,look:0,ch,vx:0,vz:0}).head.c[1];
    assert(Math.abs(stand-head-(hv(0)-hv(.45*cb)))<.015,slug+' authoritative crouch drop');
    assert(Math.abs(head+HITBOX.volumes.headOffsetY-hv(.45*cb))<.09,`${slug} rendered/server head spread`);
   }
  }
  // Restore positions and leg rotations even on a zero-time mixer pass, without stacking corrections.
  const restore=X.ncRestore.map(([b,p])=>[b,p.clone()]),legs=X.ncLegs.map(L=>({L,q:L.saved.map(q=>q.clone())}));
  c.xfSetup(M); // Terrain registers these bones after crouch IK on its first frame.
  c.api.xUbPre(M);for(const [b,p]of restore)if(b!==X.b.spine_01)assert(b.position.distanceTo(p)<1e-9);
  assert(X.b.spine_01.position.distanceTo(X.follow.bind)<1e-9);
  for(const {L,q}of legs)[L.up,L.lo,L.hand].forEach((b,i)=>assert(b.quaternion.equals(q[i]),'IK undo'));
  step(0);const stable=at('Head'),foot=at('L_Foot');for(let i=0;i<20;i++)step(0);assert(at('Head').distanceTo(stable)<1e-6,slug+' unchanged mixer head');assert(at('L_Foot').distanceTo(foot)<1e-6,slug+' unchanged mixer foot');
  play();for(let i=0;i<60;i++)step();assert(Math.abs(at('Head').y-stand)<.015,slug+' stands back up');
  X.cb=1;X.dd=1;M.dead=true;c.api.xUbPre(M);X.mx.update(1/60);M.m.updateMatrixWorld(true);const before=at('Head').y;c.api.xUbPost(M);assert.equal(at('Head').y,before,'dead skipped');
  out.push({agent:slug,stand:+stand.toFixed(3),drop:.45,footErrorCm:+(worstFoot*100).toFixed(2)});
 }
 console.log('Native crouch after jog, paired waist shift, planted feet, idle-only reference, undo and death skip: '+JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1);});
