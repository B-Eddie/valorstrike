// Jett Cloudburst flight, shared by the offline client (inlined by work/install_valorant.py as window.Cloudburst) and the
// trusted server (server/src/abilities.js). Valorant (wiki.playvalorant.com/en-us/Cloudburst): cast INSTANTLY, the
// projectile is thrown forward; holding the ability key turns it into a missile that follows the crosshair; on release
// it falls again (gravity), and it cannot be steered again after that. It becomes the smoke where it hits a surface or
// after 2 s in the air (wiki "maximum travel time in air"); smoke 2.5 s (includes 0.6 s deployment), radius 3.35 m.
// Throw speed, steer speed and gravity are not on the wiki: this project's values (a flat tap lands ~10 m ahead).
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Cloudburst=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CB={speed:18,steer:14,g:9,maxT:2,life:2.5,radius:3.35,lo:1.5,hi:4,back:.3};
 // o: eye [x,y,z], d: unit aim. held: the key is down at the cast (it is, for a key press); it drops for good on release.
 function start(o,d){return {o:[o[0],o[1],o[2]],p:[o[0],o[1],o[2]],v:[d[0]*CB.speed,d[1]*CB.speed,d[2]*CB.speed],t:0,held:true};}
 // One step. aim: the caster's current unit aim while the key is held, null otherwise (ends steering for good).
 // ray(o,d,max) -> hit distance (Infinity / > max: none); ground(x,z,y) -> floor height under y (or -Infinity).
 // Returns the landing point [x,y,z] (the projectile stops) or null while it flies.
 function step(st,dt,aim,ray,ground){
  if(!(dt>0))return null;
  if(st.held&&aim&&aim.every(Number.isFinite)){const l=Math.hypot(aim[0],aim[1],aim[2])||1;st.v=[aim[0]/l*CB.steer,aim[1]/l*CB.steer,aim[2]/l*CB.steer];}
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
 return {CB,start,step,centreY};
});
