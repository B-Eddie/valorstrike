// Sova Recon Bolt / Shock Bolt flight, shared by the offline client (inlined by work/install_valorant.py as window.SovaBolt)
// and the trusted server (server/src/abilities.js). Valorant (wiki.playvalorant.com/en-us/Sova): HOLD FIRE to extend the
// range of the bolt, ALT FIRE to add up to two bounces. The charge time, speeds, gravity and bounce loss are not on the
// wiki; the values below are this project's (tap ~ 12 m on flat ground, full charge carries across a site).
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SovaBolt=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const BOLT={charge:1,vMin:20,vMax:50,g:12,keep:.8,maxBounces:2,maxT:5,step:1/30};
 // power 0..1 from the time FIRE was held (BOLT.charge s = full)
 function power(held){return Math.max(0,Math.min(1,(+held||0)/BOLT.charge));}
 function bounces(n){n=Math.floor(+n||0);return Math.max(0,Math.min(BOLT.maxBounces,n));}
 function speed(pw){return BOLT.vMin+(BOLT.vMax-BOLT.vMin)*Math.max(0,Math.min(1,+pw||0));}
 // o: start [x,y,z], d: unit aim, pw: 0..1, nb: bounces 0..2.
 // rayN(o,d,max) -> {distance, normal:[x,y,z]} | null for the map; ground(x,z,y) -> floor height under y (or -Infinity).
 // Returns {end:[x,y,z], t: flight time, pts:[[x,y,z,t],...] (start, every bounce, end), tr: the same plus a point every
 // step (for drawing the arc), n: surface normal at the end}.
 function path(o,d,pw,nb,rayN,ground){
  const v0=speed(pw);let p=[o[0],o[1],o[2]],v=[d[0]*v0,d[1]*v0,d[2]*v0],t=0,left=bounces(nb);const pts=[[p[0],p[1],p[2],0]],tr=[[p[0],p[1],p[2],0]];let n=null;
  while(t<BOLT.maxT){
   const dt=BOLT.step,q=[p[0]+v[0]*dt,p[1]+v[1]*dt-BOLT.g*dt*dt/2,p[2]+v[2]*dt],s=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],len=Math.hypot(s[0],s[1],s[2])||1e-9,u=[s[0]/len,s[1]/len,s[2]/len];
   let hit=rayN?rayN(p,u,len):null;
   if(!hit&&ground){const gy=ground(q[0],q[2],p[1]+.05);if(Number.isFinite(gy)&&q[1]<gy){const f=Math.max(0,Math.min(1,(p[1]-gy)/Math.max(1e-9,p[1]-q[1])));hit={distance:len*f,normal:[0,1,0]};}}
   if(hit&&hit.distance<=len){
    const f=hit.distance/len;t+=dt*f;let nn=hit.normal||[-u[0],-u[1],-u[2]];const nl=Math.hypot(nn[0],nn[1],nn[2])||1;nn=[nn[0]/nl,nn[1]/nl,nn[2]/nl];
    if(nn[0]*u[0]+nn[1]*u[1]+nn[2]*u[2]>0)nn=[-nn[0],-nn[1],-nn[2]];// face the bolt
    p=[p[0]+u[0]*hit.distance+nn[0]*.03,p[1]+u[1]*hit.distance+nn[1]*.03,p[2]+u[2]*hit.distance+nn[2]*.03];
    v[1]-=BOLT.g*dt*f;
    if(left>0){left--;const k=v[0]*nn[0]+v[1]*nn[1]+v[2]*nn[2];v=[(v[0]-2*k*nn[0])*BOLT.keep,(v[1]-2*k*nn[1])*BOLT.keep,(v[2]-2*k*nn[2])*BOLT.keep];pts.push([p[0],p[1],p[2],t]);tr.push([p[0],p[1],p[2],t]);continue;}
    n=nn;break;}
   p=q;v[1]-=BOLT.g*dt;t+=dt;tr.push([p[0],p[1],p[2],t]);}
  const r=v=>Math.round(v*1000)/1000;p=p.map(r);t=Math.round(t*1000)/1000;pts.push([p[0],p[1],p[2],t]);tr.push([p[0],p[1],p[2],t]);
  return {end:p,t,pts:pts.map(a=>a.map(r)),tr,n};
 }
 function at(tr,t,out){let i=1;while(i<tr.length-1&&tr[i][3]<t)i++;const a=tr[i-1],b=tr[i]||a,k=b[3]>a[3]?Math.max(0,Math.min(1,(t-a[3])/(b[3]-a[3]))):1;out[0]=a[0]+(b[0]-a[0])*k;out[1]=a[1]+(b[1]-a[1])*k;out[2]=a[2]+(b[2]-a[2])*k;return out;}
 // Sage Slow Orb (wiki Slow_Orb: Class 3 projectile, "detonates on contact with horizontal terrain"): the uncharged (Class 3) bolt arc, no
 // bounce; a wall contact drops it straight down to the floor below. Returns {end, t (flight + drop), tr}.
 function orb(o,d,rayN,ground){const P=path(o,d,0,0,rayN,ground);if(P.n&&P.n[1]<.7&&ground){const gy=ground(P.end[0],P.end[2],P.end[1]);if(Number.isFinite(gy)&&gy<P.end[1]){const h=P.end[1]-gy,dt=Math.sqrt(2*h/BOLT.g),r=v=>Math.round(v*1000)/1000;P.t=r(P.t+dt);P.end=[P.end[0],r(gy),P.end[2]];P.tr.push([P.end[0],P.end[1],P.end[2],P.t]);}}return P;}
 return {BOLT,power,bounces,speed,path,at,orb};
});
