// Wall slide in the shared motor (server/src/motor.cjs == vendor/valorant-feel.js, so the page predicts the same slide).
// The axis-separated move stopped dead against any wall that is not world-axis aligned (hark-33: Ascent's slanted wall at
// (-12.5, 7.07, 38)); VALORANT slides along it at ~cos of the angle between the walk and the wall.
// Checks on synthetic worlds (flat floor, capsule radius 0.4): a walk into a 30 / 45 / 60 deg wall slides at
// 6.75 * cos(angle) (+-4 %) and never ends inside the wall; a head-on wall and an axis-aligned wall keep their old
// behaviour; a thin slanted wall is never crossed at server (0.05 s) or page (1/60 s) ticks; a capsule pushed into a 90 /
// 60 / 120 deg corner settles (no jitter); the two motor copies are byte-identical.
import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Motor=require('./src/motor.cjs');
assert.equal(fs.readFileSync(new URL('./src/motor.cjs',import.meta.url),'utf8'),fs.readFileSync(new URL('../vendor/valorant-feel.js',import.meta.url),'utf8'),'motor pair identical');
const R=.4,rad=d=>d*Math.PI/180;
// Half-plane wall through w with unit normal n pointing to the free side.
const plane=(w,n)=>({d:(x,z)=>(x-w[0])*n[0]+(z-w[1])*n[1]});
// Thin wall: a segment a-b of thickness t (distance from the capsule axis to the segment minus t / 2).
const segment=(a,b,t)=>({d:(x,z)=>{const ex=b[0]-a[0],ez=b[1]-a[1],k=Math.max(0,Math.min(1,((x-a[0])*ex+(z-a[1])*ez)/(ex*ex+ez*ez)));return Math.hypot(x-a[0]-ex*k,z-a[1]-ez*k)-t/2;}});
const world=walls=>({ground:()=>0,blocked:(x,z,r)=>walls.some(w=>w.d(x,z)<r-1e-9),ray:()=>Infinity});
const unit=(x=0,z=0)=>({x,y:0,z,vx:0,vy:0,vz:0,ch:0,air:false});
const walk=(P,W,input,seconds,dt,each)=>{for(let t=0;t<seconds-1e-9;t+=dt){Motor.step(P,{speed:6.75,...input},dt,W);if(each)each(P,t);}};
// 1. Slanted walls: walking -z into a wall whose surface is at angle a to the walk (tangent (sin a, -cos a)).
for(const a of [30,45,60])for(const dt of [.05,1/60]){
 const th=rad(a),n=[Math.cos(th),Math.sin(th)],w=plane([0,-2],n),W=world([w]),P=unit();let minD=Infinity;
 walk(P,W,{x:0,z:-1},1.5,dt,p=>{minD=Math.min(minD,w.d(p.x,p.z));});const x0=P.x,z0=P.z;walk(P,W,{x:0,z:-1},1,dt,p=>{minD=Math.min(minD,w.d(p.x,p.z));});
 const along=(P.x-x0)*Math.sin(th)-(P.z-z0)*Math.cos(th),want=6.75*Math.cos(th);
 assert.ok(Math.abs(along-want)/want<.04,`${a} deg wall (dt ${dt.toFixed(3)}): slide ${along.toFixed(3)} m/s, want ${want.toFixed(3)}`);
 assert.ok(minD>=R-1e-6,`${a} deg wall: never inside it (clearance ${minD.toFixed(4)})`);
 assert.ok(Math.abs(Math.hypot(P.vx,P.vz)-want)/want<.04,`${a} deg wall: the velocity is the slide's (${Math.hypot(P.vx,P.vz).toFixed(3)})`);
 // The mirrored wall slides the other way at the same speed.
 const m=plane([0,-2],[-Math.cos(th),Math.sin(th)]),M=world([m]),Q=unit();walk(Q,M,{x:0,z:-1},1.5,dt);const qx=Q.x,qz=Q.z;walk(Q,M,{x:0,z:-1},1,dt);
 const back=-(Q.x-qx)*Math.sin(th)-(Q.z-qz)*Math.cos(th);assert.ok(Math.abs(back-want)/want<.04,`${a} deg mirrored wall: ${back.toFixed(3)}`);
 console.log(`slide ${a} deg (dt ${dt.toFixed(3)}): ${along.toFixed(3)} m/s (cos: ${want.toFixed(3)}), clearance ${minD.toFixed(4)}`);}
// 2. Head-on (perpendicular) wall: stops, no sideways drift. Axis-aligned wall walked diagonally: slides on the free axis as before.
{const w=plane([0,-2],[0,1]),W=world([w]),P=unit();walk(P,W,{x:0,z:-1},2,.05);assert.ok(Math.abs(P.x)<1e-9&&w.d(P.x,P.z)>=R-1e-6,'head-on: stops, no drift');
 const Q=unit();const s=Math.SQRT1_2;walk(Q,W,{x:s,z:-s},1.5,.05);const x0=Q.x;walk(Q,W,{x:s,z:-s},1,.05);assert.ok(Math.abs(Q.x-x0-6.75*s)<.05,`axis-aligned wall, diagonal walk: x speed ${(Q.x-x0).toFixed(3)} (~${(6.75*s).toFixed(3)})`);}
// 3. No tunneling: a 2 cm thin wall at 30 deg, knife speed, server and page ticks, walking into it for 3 s.
for(const dt of [.05,1/60,.1]){const th=rad(30),seg=segment([-40*Math.sin(th),-2+40*Math.cos(th)],[40*Math.sin(th),-2-40*Math.cos(th)],.02),W=world([seg]),P=unit();
 const side=(x,z)=>(x-0)*Math.cos(th)+(z+2)*Math.sin(th);walk(P,W,{x:0,z:-1},3,dt,p=>{assert.ok(side(p.x,p.z)>0,'never crosses the thin wall');assert.ok(seg.d(p.x,p.z)>=R-1e-6,'never inside the thin wall');});}
// 4. Corners settle: pushed into a 90 / 60 / 120 deg concave corner (and slightly off its bisector) the capsule stops moving.
for(const [open,off] of [[90,0],[90,.2],[60,0],[120,0],[120,-.3]]){const h=rad(open/2),A=plane([0,-2],[Math.cos(h),Math.sin(h)]),B=plane([0,-2],[-Math.cos(h),Math.sin(h)]),W=world([A,B]),P=unit(.1,0);
 walk(P,W,{x:off,z:-1},2,.05);const pts=[];walk(P,W,{x:off,z:-1},.5,.05,p=>pts.push([p.x,p.z]));
 const spread=Math.max(...pts.map(q=>Math.hypot(q[0]-pts[0][0],q[1]-pts[0][1])));assert.ok(spread<1e-3,`${open} deg corner (input x ${off}): settles (moved ${spread.toFixed(5)} m in 0.5 s)`);
 assert.ok(A.d(P.x,P.z)>=R-1e-6&&B.d(P.x,P.z)>=R-1e-6,`${open} deg corner: outside both walls`);}
// 5. Convex corner (a pillar edge): sliding along a slanted face, then past its end, carries on without a snag.
{const th=rad(45),w=plane([0,-2],[Math.cos(th),Math.sin(th)]),cut={d:(x,z)=>Math.max(w.d(x,z),x-2)},W=world([cut]),P=unit();walk(P,W,{x:0,z:-1},3,.05);assert.ok(P.x>2,'slides off the end of the face');}
// 6. Real map (hk-36): Ascent (-57.37, 4.03, -15.26), a wall the capsule grazes beside it (clear at r .395, blocked at .4): the
// step-up's lift search never found a free height and took its top, so a walk lifted the feet 0.40 m in one tick onto nothing
// (a camera hop; qa-30's hop scan: 1 of 234 walks on eaf28e2). A lift that is still blocked at the top of its search is refused
// unless it is a lean-wall lift of a few cm. Hop scan around that wall (234 walks, 20 / 60 Hz): no lift over 0.15 m above the floor.
{const {loadWorld}=await import('./src/world.js'),cwd=process.cwd();process.chdir(new URL('.',import.meta.url).pathname);
 const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))},w=await loadWorld(assets,'ascent');process.chdir(cwd);
 let runs=0,worst=0;for(let a=-60;a<=60;a+=10)for(const x0 of [-57,-56.5,-56])for(const z0 of [-16.5,-16,-15.6])for(const dt of [1/20,1/60]){const r=rad(a),P={x:x0,z:z0,y:w.ground(x0,z0,4.5),vx:0,vz:0,vy:0,ch:0};
  for(let t=0;t<1.5-1e-9;t+=dt){Motor.step(P,{x:Math.cos(r),z:Math.sin(r),speed:6.75},dt,w);worst=Math.max(worst,P.y-w.ground(P.x,P.z,P.y+.5));}runs++;}
 assert.ok(worst<.15,`Ascent wall at (-55.4, -15.3): a walk lifted the feet ${worst.toFixed(3)} m above the floor`);console.log(`Ascent hop scan: ${runs} walks, highest feet over the floor ${worst.toFixed(3)} m`);}
// 7. The notch (qa-30 / hk-35): Ascent (-57.46, 4.05, -20.07) walking (0.924, 0.383) pinned the capsule on a cm-scale step of the
// wall at (-55.88, 4.05, -16.31) at 60 Hz (0 m/s) while 20 Hz slid on (3.27 m/s): the probes found the tangent but every short
// move along it was blocked. slide() retries from a point backed off the wall 1 / 2 / 4 cm: every tick now slides past it at
// full speed, feet level. A backed-off slide is taken only when it moves at least 1 mm farther than the plain result (at the
// Ascent plinth (-12.5, 7.07, 38) the back-off re-ground the capsule into the wall and pinned it: test-map-bounds 'slides').
{const {loadWorld}=await import('./src/world.js'),cwd=process.cwd();process.chdir(new URL('.',import.meta.url).pathname);
 const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))},w=await loadWorld(assets,'ascent'),b=await loadWorld(assets,'breeze');process.chdir(cwd);
 const ends=[];for(const dt of [1/20,1/30,1/60]){const P={x:-57.46,z:-20.07,y:w.ground(-57.46,-20.07,4.15),vx:0,vz:0,vy:0,ch:0},y0=P.y,tr=[];let dy=0;
  for(let t=0;t<2.5-1e-9;t+=dt){Motor.step(P,{x:.924,z:.383,speed:6.75},dt,w);dy=Math.max(dy,P.y-y0);tr.push([t,P.x,P.z]);}
  const a=tr.find(r=>r[0]>=1.9-1e-9),e=tr[tr.length-1],v=Math.hypot(e[1]-a[1],e[2]-a[2])/(e[0]-a[0]);
  assert.ok(v>6,`notch at ${Math.round(1/dt)} Hz: ${v.toFixed(2)} m/s over the last 0.6 s`);assert.ok(dy<.15,`notch walk feet rise ${dy.toFixed(3)}`);ends.push([P.x,P.z]);}
 assert.ok(Math.hypot(ends[0][0]-ends[2][0],ends[0][1]-ends[2][1])<1.5,'20 Hz and 60 Hz end within 1.5 m: '+JSON.stringify(ends));
 // 8. Breeze defender spawn rim (hk-36): walking at the 12 m platform's north-east edge rode a thin sloped rim up 0.5 m and ended
 // embedded (113 / 528 walks on main), worse with the slide; a CLIPS.breeze strip on the rim line keeps the capsule on the floor.
 let n=0,emb=0;for(let a=0;a<360;a+=15)for(const x0 of [-0.6,-1,-1.5,-2,-2.5])for(const z0 of [-45.9,-45.5,-45.2])for(const dt of [1/20,1/60]){const y0=b.ground(x0,z0,12.5);if(b.blocked(x0,z0,.4,y0,1.8))continue;const r=rad(a),P={x:x0,z:z0,y:y0,vx:0,vz:0,vy:0,ch:0};n++;
  for(let t=0;t<1.2-1e-9;t+=dt){Motor.step(P,{x:Math.cos(r),z:Math.sin(r),speed:6.75},dt,b);if(b.blocked(P.x,P.z,.4,P.y,1.8)){emb++;break;}}}
 assert.equal(emb,0,`Breeze spawn rim: ${emb} of ${n} walks embedded`);console.log(`notch: ${ends.length} ticks slide on; Breeze spawn rim: ${n} walks, 0 embedded`);}
console.log('wall slide: 30 / 45 / 60 deg walls slide at cos(angle) both ways, server and page ticks; head-on stops; axis-aligned unchanged; thin wall never crossed; corners settle; motor pair identical');
