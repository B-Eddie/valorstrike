// Third-person upper body + terrain over the procedural gait (anim-jump-2, feet_runtime.js xUgTorso / xUgAim / xfPose):
// lean into the move (knife > run > walk), lean into a start, head kept level and following the aim pitch, pelvis turning with
// the stride, standing aim turns twist the upper body over planted feet before the hips / feet follow, knife arms pump,
// stairs / slopes: planted feet on their tread (no hover, no sinking), stepping feet never through a riser.
const assert=require('node:assert/strict'),{sim,T}=require('./tp_anim_sim.cjs');
const up=(S,n)=>new T.Vector3(0,1,0).applyQuaternion(S.bone(n).getWorldQuaternion(new T.Quaternion()));
const fwdTilt=(S,n,u0)=>{const u=up(S,n);return Math.atan2(u.z,u.y)-Math.atan2(u0.z,u0.y);}; // + = top toward +z (the move)
function stairs(x,z){return z<1?0:Math.min(8,Math.floor((z-1)/.3)+1)*.2;}
(async()=>{const dt=1/60,out=[];
 // lean by gait (average over a second of steady motion, facing +z)
 const lean={};for(const [n,sp,w] of [['walk',3.24],['run',5.4],['knife',6.75,'Knife']]){const S=await sim('jett'),O={w:w||'Vandal'};for(let i=0;i<60;i++)S.frame(dt,0,0,0,0,O);
  const u0=up(S,'Spine3'),h0=up(S,'Head');let a=0,hd=0,n0=0,pel=[];for(let i=1;i<=120;i++){S.frame(dt,0,0,sp*i*dt,0,O);if(i>60){a+=fwdTilt(S,'Spine3',u0);hd+=fwdTilt(S,'Head',h0);n0++;const q=new T.Vector3(0,0,1).applyQuaternion(S.bone('Pelvis').getWorldQuaternion(new T.Quaternion()));pel.push(Math.atan2(q.x,q.z));}}
  lean[n]={chest:a/n0,head:hd/n0,pelvis:Math.max(...pel)-Math.min(...pel)};}
 assert.ok(lean.walk.chest>.005&&lean.run.chest>lean.walk.chest+.02&&lean.knife.chest<-.03,'lean run > walk > 0; the knife run straightens its hunched sword clip: '+JSON.stringify(lean));
 for(const n in lean){assert.ok(Math.abs(lean[n].head)<.5*Math.abs(lean[n].chest)+.01,n+': head stays level ('+lean[n].head.toFixed(3)+' vs chest '+lean[n].chest.toFixed(3)+')');}
 assert.ok(lean.run.pelvis>.08&&lean.run.pelvis<.4,'pelvis turns with the stride ('+lean.run.pelvis.toFixed(2)+' rad p-p)');
 out.push('lean walk '+lean.walk.chest.toFixed(3)+' run '+lean.run.chest.toFixed(3)+' knife '+lean.knife.chest.toFixed(3));
 // acceleration: leaning into a start more than in the steady run, then easing back
 {const S=await sim('jett');for(let i=0;i<60;i++)S.frame(dt,0,0,0);const u0=up(S,'Spine3');let z=0,v=0,peak=0;for(let i=1;i<=60;i++){v=Math.min(5.4,v+5.4/.288*dt);z+=v*dt;S.frame(dt,0,0,z);if(i<=20)peak=Math.max(peak,fwdTilt(S,'Spine3',u0));}
  const end=fwdTilt(S,'Spine3',u0);assert.ok(peak>end+.015,'start: leans in ('+peak.toFixed(3)+') then eases to the run lean ('+end.toFixed(3)+')');out.push('start lean '+peak.toFixed(3));}
 // head follows the full aim pitch (spine 80 % + neck 20 %)
 {const S=await sim('jett');for(let i=0;i<40;i++)S.frame(dt,0,0,0,0,{pit:0});const h0=up(S,'Head');for(let i=0;i<40;i++)S.frame(dt,0,0,0,0,{pit:.6});const p=-fwdTilt(S,'Head',h0);assert.ok(p>.5&&p<.7,'head pitches with the aim ('+p.toFixed(2)+' for 0.6)');}
 // standing aim turn: 30 deg twists the upper body only (feet planted, hips stay); 60 deg: hips follow, feet step round
 for(const ag of ['jett','breach']){const S=await sim(ag);for(let i=0;i<60;i++)S.frame(dt,0,0,0);const G=S.X.ug,f0=G.f.map(f=>f.p.clone());
  for(let i=1;i<=40;i++)S.frame(dt,0,0,0,Math.min(1,i/15)*Math.PI/6);assert.ok(Math.abs(S.X.yaw+Math.PI/6)<.02,ag+': 30 deg turn twists the torso, hips stay ('+S.X.yaw.toFixed(2)+')');
  assert.ok(G.f.every((f,k)=>f.p.distanceTo(f0[k])<1e-6&&!f.settle),ag+': feet stay planted');
  for(let i=1;i<=60;i++)S.frame(dt,0,0,0,Math.PI/6+Math.min(1,i/15)*Math.PI/6);assert.ok(Math.abs(S.X.yaw)<.05,ag+': past 43 deg the hips catch up ('+S.X.yaw.toFixed(2)+')');
  assert.ok(G.f.some((f,k)=>f.p.distanceTo(f0[k])>.02),ag+': and the feet step round');}
 // knife: arms pump with the stride; gun: arms held (the grip owns them in game)
 {const S=await sim('jett');const O={w:'Knife'};for(let i=0;i<60;i++)S.frame(dt,0,0,0,0,O);let lo=9,hi=-9;for(let i=1;i<=90;i++){S.frame(dt,0,0,6.75*i*dt,0,O);if(i>40){const h=S.at('R_Hand'),r=S.M.m.getWorldPosition(new T.Vector3());lo=Math.min(lo,h.z-r.z);hi=Math.max(hi,h.z-r.z);}}
  assert.ok(hi-lo>.08,'knife run: right hand pumps '+((hi-lo)*100).toFixed(0)+' cm');out.push('knife arm '+((hi-lo)*100).toFixed(0)+'cm');}
 // stairs up / down, slope across: planted ankle on its floor, stepping foot never below the floor under it
 for(const [nm,ff,dir] of [['up',stairs,1],['down',(x,z)=>stairs(x,-z),-1],['slope',(x,z)=>.25*x,1]])for(const ag of ['jett','sage']){const S=await sim(ag),O={ff};for(let i=0;i<60;i++)S.frame(dt,0,0,0,0,{});
  const fy0=Math.min(S.at('L_Foot').y,S.at('R_Foot').y);for(let i=0;i<30;i++)S.frame(dt,0,0,0,dir<0?Math.PI:0,O); /* ankle height measured on flat ground */let ry=0,hov=0,sink=0,clip=0;
  for(let i=1;i<=100;i++){const z=dir*3.24*i*dt;ry+=(ff(0,z)-ry)*(1-Math.exp(-dt*20));S.frame(dt,0,ry,z,dir<0?Math.PI:0,O);const G=S.X.ug;if(i<15||S.X.air)continue;
   for(let k=0;k<2;k++){const f=S.at(k?'R_Foot':'L_Foot'),e=f.y-ff(f.x,f.z)-fy0,g=G.f[k];if(!g.sw&&!g.settle){if(G.f[k].u<G.f[k].u+1&&e>hov&&(g.u/Math.max(.05,0.4))<.55)hov=Math.max(hov,e);sink=Math.min(sink,e);}else clip=Math.min(clip,e);}}
  assert.ok(sink>-.035,`${ag} stairs ${nm}: planted foot sinks ${(sink*100).toFixed(1)} cm`);assert.ok(hov<.03,`${ag} stairs ${nm}: planted foot hovers ${(hov*100).toFixed(1)} cm`);assert.ok(clip>-.025,`${ag} stairs ${nm}: stepping foot through the floor ${(clip*100).toFixed(1)} cm`);
  if(nm==='slope'){const n=S.X.ft.n;assert.ok(n&&n.some(v=>v.x<-.15),ag+': feet tilt to the slope ('+(n?n.map(v=>v.x.toFixed(2)):'-')+')');}
  if(ag==='jett')out.push(`${nm} sink ${(sink*100).toFixed(1)} hover ${(hov*100).toFixed(1)} clip ${(clip*100).toFixed(1)} cm`);}
 console.log('tp body motion: '+out.join(', '));
})().catch(e=>{console.error(e);process.exit(1);});
