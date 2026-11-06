/* Shared Barrier Mesh state/queries. Not installed into game until server+offline+visual consumers agree.
 * Source: https://wiki.playvalorant.com/en-us/Barrier_Mesh (read 2026-11-06).
 * Four max-10m arms, central/outer health, deployment 1s, fortify 3s, decay 25..30s.
 * Wall thickness, node radii/height and cardinal orientation are project approximations, not measured source facts.
 * Placement resolver owns terrain feasibility and endpoints; no inferred flat-ground fallback for missing nodes.
 */
(function(root,factory){const M=factory();if(typeof module==='object'&&module.exports)module.exports=M;else root.BarrierMesh=M;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const C=Object.freeze({arm:10,deploy:1,fortify:3,decay:25,life:30,central:680,centralFort:1200,outer:320,outerFort:480,height:3,thickness:.08,centralRadius:.28,outerRadius:.2,nodeLift:.2});
 const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
 function create(p,yaw=0,resolve){if(!finitePoint(p)||!Number.isFinite(yaw)||typeof resolve!=='function')throw Error('Barrier Mesh needs finite centre/yaw and a terrain resolver');
  const nodes=[{p:p.slice(),hp:C.central,max:C.central,r:C.centralRadius}];
  for(let i=0;i<4;i++){const a=yaw+i*Math.PI/2,target=[p[0]+Math.cos(a)*C.arm,p[1],p[2]-Math.sin(a)*C.arm],q=resolve(p.slice(),target.slice(),i);
   if(q==null){nodes.push(null);continue;}if(!finitePoint(q))throw Error('Invalid Barrier Mesh endpoint');const dx=q[0]-p[0],dz=q[2]-p[2],len=Math.hypot(dx,dz);if(len>C.arm+1e-6||len<.01||dx*Math.cos(a)-dz*Math.sin(a)<len-1e-6)throw Error('Barrier Mesh endpoint must stay on its bounded arm');
   nodes.push({p:q.slice(),hp:C.outer,max:C.outer,r:C.outerRadius});}
  return {age:0,fortified:false,dead:false,nodes};
 }
 // Collision adapter: use an actual downward triangle hit with an upward-facing normal.
 // world.ground may silently return a nav fallback or y-10 sentinel, so it cannot prove support.
 // Probe/drop/clearance are explicit project approximations. This is not the thrown-disc flight.
 function terrainResolver(world,{probe=3,drop=6,clearance=.3}={}){
  if(!world||typeof world.ray!=='function'||typeof world.rayN!=='function')throw Error('Barrier Mesh terrain requires ray and rayN');
  if(![probe,drop,clearance].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid Barrier Mesh terrain query limits');
  return (p,q)=>{const dx=q[0]-p[0],dz=q[2]-p[2],len=Math.hypot(dx,dz);if(!(len>clearance))return null;
   const d=[dx/len,0,dz/len],hit=world.ray([p[0],p[1]+C.nodeLift,p[2]],d,len+clearance);
   if(hit!==Infinity&&!(Number.isFinite(hit)&&hit>=0))return null;
   const run=Math.min(len,hit-clearance);if(!(run>clearance))return null;
   const x=p[0]+d[0]*run,z=p[2]+d[2]*run,top=p[1]+probe,h=world.rayN([x,top,z],[0,-1,0],drop);
   if(!h||!Number.isFinite(h.distance)||h.distance<0||h.distance>drop||!finitePoint(h.normal)||h.normal[1]<.45)return null;
   const y=top-h.distance;if(Math.abs(y-p[1])>probe)return null;
   return [x,y,z];};
 }
 function advance(s,age){if(!Number.isFinite(age)||age<s.age)throw Error('Barrier Mesh age must advance monotonically');if(s.dead){s.age=age;return s;}const prev=s.age;
  if(!s.fortified&&age>=C.fortify){s.nodes.forEach((n,i)=>{if(n&&n.hp>0){const max=i?C.outerFort:C.centralFort;n.hp+=max-n.max;n.max=max;}});s.fortified=true;}
  if(age>C.decay){const oldLeft=C.life-Math.max(C.decay,prev),left=Math.max(0,C.life-age),ratio=oldLeft>0?left/oldLeft:0;s.nodes.forEach(n=>{if(n)n.hp*=ratio;});}
  s.age=age;if(age>=C.life||!(s.nodes[0].hp>0)){s.dead=true;s.nodes.forEach(n=>{if(n)n.hp=0;});}return s;
 }
 function damage(s,index,amount){const n=s.nodes[index];if(!n||s.dead||!(amount>0)||!Number.isFinite(amount))return false;n.hp=Math.max(0,n.hp-amount);if(index===0&&n.hp===0){s.dead=true;s.nodes.forEach(x=>{if(x)x.hp=0;});}return true;}
 function arms(s){if(s.dead||s.age<C.deploy)return [];const a=s.nodes[0].p;return s.nodes.slice(1).flatMap((n,i)=>n&&n.hp>0?[{index:i+1,a:a.slice(),b:n.p.slice(),h:C.height}]:[]);}
 function blocked(s,x,z,r,y,height=1.8){for(const e of arms(s)){const dx=e.b[0]-e.a[0],dz=e.b[2]-e.a[2],t=Math.max(0,Math.min(1,((x-e.a[0])*dx+(z-e.a[2])*dz)/(dx*dx+dz*dz))),floor=e.a[1]+(e.b[1]-e.a[1])*t;if(y>=floor+e.h||y+height<=floor)continue;if(Math.hypot(x-e.a[0]-dx*t,z-e.a[2]-dz*t)<r+C.thickness/2)return true;}return false;}
 // Shooting query hits orbs only. Transparent arms never stop shots or LOS/projectiles.
 function ray(s,o,d,max=Infinity){if(s.dead||!finitePoint(o)||!finitePoint(d))return null;const A=d.reduce((n,v)=>n+v*v,0);if(!(A>0))return null;let out=null,limit=max;
  s.nodes.forEach((n,i)=>{if(!n||!(n.hp>0))return;const q=[o[0]-n.p[0],o[1]-n.p[1]-C.nodeLift,o[2]-n.p[2]],B=q.reduce((n,v,k)=>n+v*d[k],0),cc=q.reduce((n,v)=>n+v*v,0)-n.r*n.r,disc=B*B-A*cc;if(disc<0)return;const t=Math.max(0,(-B-Math.sqrt(disc))/A);if(t<limit&&(-B+Math.sqrt(disc))/A>=0){limit=t;out={index:i,distance:t};}});return out;}
 // Explicit JSON transport: validate before rendering/prediction; never share mutable server node objects.
 function toRow(s){return {v:1,age:s.age,fortified:!!s.fortified,dead:!!s.dead,nodes:s.nodes.map(n=>n?{p:n.p.slice(),hp:n.hp,max:n.max,r:n.r}:null)};}
 function fromRow(r){if(!r||r.v!==1||!Number.isFinite(r.age)||r.age<0||!Array.isArray(r.nodes)||r.nodes.length!==5)throw Error('Invalid Barrier Mesh row');
  const nodes=r.nodes.map((n,i)=>{if(n===null&&i)return null;if(!n||!finitePoint(n.p)||![n.hp,n.max,n.r].every(Number.isFinite)||n.hp<0||n.max<=0||n.hp>n.max||n.r<=0||n.r>1)throw Error('Invalid Barrier Mesh node');return {p:n.p.slice(),hp:n.hp,max:n.max,r:n.r};});
  return {age:r.age,fortified:!!r.fortified,dead:!!r.dead,nodes};}
 function points(s){return s.dead?[]:s.nodes.flatMap(n=>n&&n.hp>0?[[n.p[0],n.p[1]+C.nodeLift,n.p[2]]]:[]);}
 return {C,create,terrainResolver,advance,damage,arms,blocked,ray,points,toRow,fromRow};
});
