// Third-person crouch stance and moving landings (anim-jump-3, feet_runtime.js XUG.crouchPose / xUgReset re-entry):
// crouched still, the chest is up over the hips (the retargeted Crouch_Idle_Loop hunched 0.27 m over the knees) with the head
// keeping its 0.45 m crouch drop, the front foot flat on the floor and the back heel up; crouch-walking keeps the feet side by
// side; landing a run / strafe / backpedal / diagonal jump picks the stride up mid-cycle, so no planted foot is left reaching
// behind (it was dragged to the 0.78 m reach limit: a split-legged straddle on every moving landing).
const assert=require('node:assert/strict'),{sim,T}=require('./tp_anim_sim.cjs');
function arc(t){if(t<=0)return 0;return Math.max(0,6.902*t-.5*20.45*t*t);}
(async()=>{const dt=1/60,out=[];
 for(const ag of ['jett','breach','sage']){const S=await sim(ag);for(let i=0;i<60;i++)S.frame(dt,0,0,0,0,{});const stand=S.at('Head').y,ank=Math.min(S.at('L_Foot').y,S.at('R_Foot').y);
  for(let i=0;i<90;i++)S.frame(dt,0,0,0,0,{cr:1});
  const H=S.at('Head'),P=S.at('Pelvis'),L=S.at('L_Foot'),R=S.at('R_Foot'),fwd=H.z-P.z,drop=stand-H.y;
  assert.ok(Math.abs(drop-.45)<.03,ag+': crouch head drop '+drop.toFixed(3)+' m (hitbox 0.45)');
  assert.ok(fwd<.17,ag+': crouched chest up over the hips (head '+fwd.toFixed(3)+' m ahead of the pelvis)');
  const front=L.z>R.z?L:R,back=L.z>R.z?R:L;
  assert.ok(front.y-ank<.06,ag+': front foot on the floor (ankle '+((front.y-ank)*100).toFixed(1)+' cm over standing; the crouch clip holds it ~5 cm)');
  assert.ok(back.y-front.y>.03&&back.y-front.y<.08,ag+': back heel up (ankle '+((back.y-front.y)*100).toFixed(1)+' cm over the front one)');
  assert.ok(front.z-back.z>.45&&front.z-back.z<.8,ag+': staggered stance '+(front.z-back.z).toFixed(2)+' m');
  // crouch-walk: no stagger offset, the gait's feet side by side
  let lat=9;for(let i=1;i<=90;i++){S.frame(dt,0,0,2*i*dt,0,{cr:1});if(i>45){const a=S.at('L_Foot'),b=S.at('R_Foot');lat=Math.min(lat,a.x-b.x);}}
  assert.ok(lat>.05,ag+': crouch-walk feet stay apart ('+lat.toFixed(2)+')');
  if(ag==='jett')out.push(`crouch head drop ${drop.toFixed(3)} fwd ${fwd.toFixed(3)} back heel ${((back.y-front.y)*100).toFixed(1)}cm`);}
 for(const ag of ['jett','breach'])for(const [nm,vx,vz] of [['run',0,5.4],['back',0,-5.4],['diag',3.82,3.82],['strafe',5.4,0]]){const S=await sim(ag);for(let i=0;i<60;i++)S.frame(dt,0,0,0,0,{});
  let land=0,steady=0;for(let i=1;i<=150;i++){const t=i*dt;S.frame(dt,vx*t,arc(t-.8),vz*t,0,{});const G=S.X.ug;if(!G||!G.f||S.X.air)continue;
   for(const f of G.f){if(f.sw||f.settle||!f.set)continue;const d=Math.hypot(f.p.x-vx*t,f.p.z-vz*t);if(t>1.47&&t<1.85)land=Math.max(land,d);if(t>.3&&t<.8)steady=Math.max(steady,d);}}
  assert.ok(land<steady+.05&&land<.76,`${ag} ${nm} landing: planted foot reach ${land.toFixed(2)} m (steady ${steady.toFixed(2)}, limit 0.78)`);
  if(ag==='jett')out.push(`${nm} land reach ${land.toFixed(2)}/${steady.toFixed(2)}`);}
 console.log('tp crouch / landing: '+out.join(', '));
})().catch(e=>{console.error(e);process.exit(1);});
