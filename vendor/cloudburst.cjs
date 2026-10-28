// Jett Cloudburst flight, shared by the offline client (inlined by work/install_valorant.py as window.Cloudburst) and the
// trusted server (server/src/abilities.js). Valorant (wiki.playvalorant.com/en-us/Cloudburst): cast INSTANTLY, the
// projectile is thrown forward; holding the ability key turns it into a missile that follows the crosshair; on release
// it falls again (gravity), and it cannot be steered again after that. It becomes the smoke where it hits a surface or
// after 2 s in the air (wiki "maximum travel time in air"); smoke 2.5 s (includes 0.6 s deployment), radius 3.35 m.
// Throw speed, steer speed, turn rate and gravity are not on the wiki: this project's values (a flat tap lands ~10 m ahead).
// Steering CURVES the flight (playvalorant.com Jett: "HOLD the ability key to curve the cloud in the direction of your
// crosshair"): the velocity turns toward the crosshair at most CB.turn rad/s (~230 deg/s, a ~3.5 m turning circle at 14 m/s),
// it no longer snaps onto the crosshair in one step (user 2026-10-27 "Jett's smoke C ability isn't supposed to be like that").
// The projectile leaves Jett's throwing hand (CB.hand: forward / right / down of the eye), not the middle of the screen.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Cloudburst=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CB={speed:18,steer:14,turn:4,g:9,maxT:2,life:2.5,radius:3.35,lo:1.5,hi:4,back:.3,hand:[.35,.16,-.2]};
 // o: eye [x,y,z], d: unit aim. held: the key is down at the cast (it is, for a key press); it drops for good on release.
 // hand(o, d): the throwing hand for eye o and unit aim d (forward CB.hand[0], right CB.hand[1], up CB.hand[2] in the view frame)
 function hand(o,d){const f=CB.hand,h=Math.hypot(d[0],d[2]),r=h>1e-6?[-d[2]/h,0,d[0]/h]:[1,0,0],u=[r[1]*d[2]-r[2]*d[1],r[2]*d[0]-r[0]*d[2],r[0]*d[1]-r[1]*d[0]];
 return [o[0]+d[0]*f[0]+r[0]*f[1]+u[0]*f[2],o[1]+d[1]*f[0]+r[1]*f[1]+u[1]*f[2],o[2]+d[2]*f[0]+r[2]*f[1]+u[2]*f[2]];}
 function start(o,d){const p=hand(o,d);return {o:[o[0],o[1],o[2]],p,v:[d[0]*CB.speed,d[1]*CB.speed,d[2]*CB.speed],t:0,held:true};}
// turn unit vector a toward unit vector b by at most ang radians (slerp in their plane; b exactly when within ang)
 function turnToward(a,b,ang){const c=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])),th=Math.acos(c);if(th<=ang||th<1e-6)return [b[0],b[1],b[2]];
 let w=[b[0]-a[0]*c,b[1]-a[1]*c,b[2]-a[2]*c],wl=Math.hypot(w[0],w[1],w[2]);if(wl<1e-6){w=Math.abs(a[1])<.9?[a[2],0,-a[0]]:[0,a[2],-a[1]];wl=Math.hypot(w[0],w[1],w[2])||1;}
 const k=Math.cos(ang),q=Math.sin(ang)/wl;return [a[0]*k+w[0]*q,a[1]*k+w[1]*q,a[2]*k+w[2]*q];}
 // One step. aim: the caster's current unit aim while the key is held, null otherwise (ends steering for good).
 // ray(o,d,max) -> hit distance (Infinity / > max: none); ground(x,z,y) -> floor height under y (or -Infinity).
 // Returns the landing point [x,y,z] (the projectile stops) or null while it flies.
 function step(st,dt,aim,ray,ground){
  if(!(dt>0))return null;
  if(st.held&&aim&&aim.every(Number.isFinite)){const l=Math.hypot(aim[0],aim[1],aim[2])||1,vl=Math.hypot(st.v[0],st.v[1],st.v[2])||1,n=turnToward([st.v[0]/vl,st.v[1]/vl,st.v[2]/vl],[aim[0]/l,aim[1]/l,aim[2]/l],CB.turn*dt);st.v=[n[0]*CB.steer,n[1]*CB.steer,n[2]*CB.steer];}
  else{st.held=false;st.v[1]-=CB.g*dt;}
  const p=st.p,q=[p[0]+st.v[0]*dt,p[1]+st.v[1]*dt,p[2]+st.v[2]*dt],s=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],len=Math.hypot(s[0],s[1],s[2])||1e-9,u=[s[0]/len,s[1]/len,s[2]/len];
  let hit=ray?ray(p,u,len):Infinity;if(!(Number.isFinite(hit)&&hit<=len))hit=null;
  if(hit==null&&ground){const gy=ground(q[0],q[2],p[1]+.05);if(Number.isFinite(gy)&&q[1]<gy){hit=len*Math.max(0,Math.min(1,(p[1]-gy)/Math.max(1e-9,p[1]-q[1])));}}
  if(hit!=null){const b=Math.min(CB.back,hit);st.p=[p[0]+u[0]*(hit-b),p[1]+u[1]*(hit-b),p[2]+u[2]*(hit-b)];st.t+=dt*hit/len;st.held=false;return st.p.slice();}
  st.p=q;st.t+=dt;if(st.t>=CB.maxT){st.held=false;return st.p.slice();}
  return null;
 }
 // Smoke centre height for a landing point: between floor + lo and floor + hi (a floor landing still smokes at head height).
 function centreY(y,floor){const f=Number.isFinite(floor)?floor:0;return Math.max(f+CB.lo,Math.min(f+CB.hi,y));}
 return {CB,start,step,centreY,hand,turnToward};
});
