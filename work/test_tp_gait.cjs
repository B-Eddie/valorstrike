// Third-person procedural gait (feet_runtime.js XUG) through the shipped xUbAnim + native post passes (tp_anim_sim.cjs).
// Before: the retargeted Quaternius jog (a bounding sprint stride) played 1.86x at 5.4 m/s (4.0 steps/s; VALORANT reads
// ~3 steps/s), the planted foot skated 15-30 cm per contact, strafes twisted the hips 72 deg onto the forward jog and a
// backpedal ran it in reverse; Breach's shoes (skinned to *_IK_FootTarget) stretched back to the bind spot every stride.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{sim,T}=require('./tp_anim_sim.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert.ok(/xUbLoco\(sp, cw, back, air, gait\)/.test(html),'xUbAnim passes the gait flag');
const vel=(fn,t,dt)=>{const a=fn(t),b=fn(t+dt);return Math.hypot(b.x-a.x,b.z-a.z)/dt;};
async function drive(S,fn,dur,hz,opt={}){const dt=1/hz,R={contacts:[],steps:0,lifts:0,prev:[0,0],minGap:9,reach:0,yaw:0,shoe:0};
 for(let i=0;i<hz;i++)S.frame(dt,0,0,0,0,opt);const fy0=Math.min(S.at('L_Foot').y,S.at('R_Foot').y),pl=[null,null];
 for(let i=1;i<=Math.round(dur*hz);i++){const t=i*dt,p=fn(t);S.frame(dt,p.x,0,p.z,p.yaw||0,opt);const G=S.X.ug;
  const F=[S.at('L_Foot'),S.at('R_Foot')];if(G&&G.f)for(let k=0;k<2;k++){if(t>.3&&G.f[k].sw&&!R.prev[k])R.lifts++;R.prev[k]=G.f[k].sw;}if(t>.3){R.minGap=Math.min(R.minGap,Math.hypot(F[0].x-F[1].x,F[0].z-F[1].z));R.yaw=Math.max(R.yaw,Math.abs(S.X.yaw||0));}
  if(G&&G.w>.99&&t>.3)for(let k=0;k<2;k++)if(G.f[k].cur&&!G.f[k].sw)R.reach=Math.max(R.reach,F[k].distanceTo(new T.Vector3(G.f[k].cur.x,F[k].y,G.f[k].cur.z)));
  for(let k=0;k<2;k++){const low=G&&G.w>.99?!G.f[k].sw&&!G.f[k].settle:F[k].y<fy0+.012; /* planted per the gait state (heel-off lifts the ankle mid-stance) */if(low){if(!pl[k]){pl[k]={x:F[k].x,z:F[k].z,d:0,t};}else pl[k].d=Math.max(pl[k].d,Math.hypot(F[k].x-pl[k].x,F[k].z-pl[k].z));}else if(pl[k]){if(pl[k].t>.3)R.contacts.push(pl[k].d);R.steps+=pl[k].t>.3?1:0;pl[k]=null;}}
  if(S.X.ikT&&t>.3)for(const e of S.X.ikT.list){e.f.updateWorldMatrix(true,false);const m=new T.Matrix4().multiplyMatrices(e.f.matrixWorld,e.rel);R.shoe=Math.max(R.shoe,new T.Vector3().setFromMatrixPosition(m).distanceTo(e.t.getWorldPosition(new T.Vector3())));}}
 return R;}
(async()=>{const rows=[];
 // gait parameters
 const S0=await sim('jett'),{xUgGait,XUG}=S0.api2;assert.ok(xUgGait,'XUG present');
 const g54=xUgGait(5.4,0),g32=xUgGait(3.24,0),g2c=xUgGait(2,1),g675=xUgGait(6.75,0);
 assert.ok(g54.cad>=3&&g54.cad<=3.5,`5.4 m/s: ${g54.cad.toFixed(2)} steps/s (was 4.0)`);
 assert.ok(g32.cad>=2.5&&g32.cad<=3.4,`3.24 m/s shift-walk: ${g32.cad.toFixed(2)} steps/s`);
 assert.ok(g2c.cad>=3&&g2c.stance<=XUG.crouch.D+1e-9,'crouch-walk: quick short steps');
 for(const g of [g54,g32,g675])assert.ok(g.stance<=XUG.stand.D+1e-9,'stance never outgrows the leg');
 assert.ok(g54.duty<g32.duty&&g32.duty<xUgGait(1,0).duty,'duty falls with speed (walk -> run with flight)');
 // the clip path is the fallback only: with the gait the standing pose stays under the steps
 const L=S0.api2.xUbLoco(5.4,0,false,false,true);assert.equal(L.T.idle,1);assert.ok(!L.T.run&&!L.T.walk,'gait: no jog / walk clip');
 const sc={run:t=>({x:0,z:5.4*t}),walk:t=>({x:0,z:3.24*t}),strafe:t=>({x:5.4*t,z:0}),diag:t=>({x:3.82*t,z:3.82*t}),back:t=>({x:0,z:-5.4*t}),crouch:t=>({x:0,z:2*t})};
 for(const ag of ['jett','breach','sage'])for(const hz of [60,144])for(const n in sc){const S=await sim(ag),R=await drive(S,sc[n],3.3,hz,{cr:n==='crouch'});
  const slide=Math.max(...R.contacts),sp=vel(sc[n],1,1e-3),cad=xUgGait(sp,n==='crouch'?S.X.cb:0).cad,rate=R.lifts/3.0;
  assert.ok(R.contacts.length>=3,`${ag} ${n}: feet plant (${R.contacts.length} contacts)`);
  assert.ok(slide<.015,`${ag} ${n} ${hz}Hz: planted foot slide ${(slide*100).toFixed(1)} cm`);
  assert.ok(Math.abs(rate-cad)/cad<.1,`${ag} ${n}: ${rate.toFixed(2)} steps/s vs cadence ${cad.toFixed(2)} (${hz} Hz, steps ${R.steps}, cb ${S.X.cb.toFixed(2)}, sp ${sp.toFixed(2)})`);
  assert.ok(R.reach<.03,`${ag} ${n}: planted foot reaches its target (${(R.reach*100).toFixed(1)} cm short)`);
  assert.ok(R.minGap>.08,`${ag} ${n}: feet never pass through each other (${R.minGap.toFixed(2)} m)`);
  assert.ok(R.yaw<=.8+1e-6,`${ag} ${n}: hips lead by at most 0.8 rad (${R.yaw.toFixed(2)})`);
  if(ag==='breach')assert.ok(R.shoe<1e-3,'Breach IK foot targets ride the feet');
  if(hz===60)rows.push(`${ag} ${n} ${(slide*100).toFixed(1)}cm ${rate.toFixed(1)}/s`);}
 // stop (VALORANT release friction ~84 ms) and counter-strafe: planted at once, settled within 0.5 s; turning in place steps
 for(const ag of ['jett','breach']){const S=await sim(ag),dt=1/60;let z=0,v=5.4;for(let i=0;i<60;i++)S.frame(dt,0,0,0);for(let i=0;i<48;i++){z+=v*dt;S.frame(dt,0,0,z);}
  for(let i=0;i<30;i++){v=Math.max(0,v-(7.3625*v+46.5)*dt);z+=v*dt;S.frame(dt,0,0,z);}const G=S.X.ug;
  assert.ok(!G.f[0].settle&&!G.f[1].settle&&!G.f[0].sw&&!G.f[1].sw,`${ag}: settled 0.5 s after release`);
  const S2=await sim(ag);for(let i=0;i<60;i++)S2.frame(dt,0,0,0);for(let i=1;i<=50;i++)S2.frame(dt,0,0,0,Math.min(1,i/15)*Math.PI/2);
  const G2=S2.X.ug;for(const f of G2.f)assert.ok(Math.abs(Math.atan2(Math.sin(Math.PI/2-f.yaw),Math.cos(Math.PI/2-f.yaw)))<.61,`${ag}: turning in place steps the feet round`);}
 console.log('tp gait: cadence 5.4 m/s '+g54.cad.toFixed(2)+' steps/s, 3.24 '+g32.cad.toFixed(2)+', crouch 2.0 '+g2c.cad.toFixed(2)+'; '+rows.join(', '));
})().catch(e=>{console.error(e);process.exit(1);});
