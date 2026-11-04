// Authoritative hit volumes that follow the rendered third-person pose.
// hitboxes.json is sampled from the real agent rigs by work/build_hitbox_poses.cjs (model frame: +Y up, +Z facing).
// The volume sizes mirror the client's bone-following hitboxes (work/repair_runtime.js xrHitboxes): a head sphere
// 0.08 m above the Head bone, a body capsule from 0.06 m to 0.13 m below the Head bone, legs below the hip line.
// Crouch lowers the head by the same amount the first-person eye drops (Motor ch, up to Motor C.crouchEye = 0.40 m).
import table from './hitboxes.json' with {type:'json'};
export const HITBOX=table;
const P=table.poses,V=table.volumes,CROUCH=.4;/* = Motor C.crouchEye (Stark 40 u) */
const mix=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
function blend(name,a,b,t){return {head:mix(a.head,b.head,t),pelvis:mix(a.pelvis,b.pelvis,t),neck:mix(a.neck,b.neck,t),name};}
// Pose as the client animates it: xUbAnim walk/run blend by ground speed, crouch blend, fall pose while airborne.
export function poseOf(v){
 const sp=Math.hypot(v.vx||0,v.vz||0),k=Math.max(0,Math.min(1,(v.ch||0)/CROUCH));
 if(v.air)return {...P.air,k:0,name:'air'};
 const moving=sp>.35,run=Math.max(0,Math.min(1,(sp-2.7)/2.1)),upright=moving?blend('move',P.walk,P.run,run):P.stand,low=moving?P.crouchWalk:P.crouch;
 return {...blend(k>0?'crouch':moving?'move':'stand',upright,low,k),uprightHeadY:upright.head[1],k};
}
export function hitVolumes(v){
 const pose=poseOf(v),ch=v.ch||0,c=Math.cos(v.look||0),s=Math.sin(v.look||0);
 const at=(x,y,z)=>[v.x+x*-c+z*-s,v.y+y,v.z+x*s+z*-c];
 const headBone=(pose.uprightHeadY??pose.head[1])-ch,standHead=P.stand.head[1];
 return {
  head:{c:at(pose.head[0],headBone+V.headOffsetY,pose.head[2]),r:V.headRadius},
  // The client's body is a capsule scaled to span bottom..top including its caps; inset the segment by the radius.
  body:{a:at(pose.pelvis[0],V.bodyBottom+V.bodyRadius,pose.pelvis[2]),b:at(pose.neck[0],headBone-V.bodyTopBelowHead-V.bodyRadius,pose.neck[2]),r:V.bodyRadius},
  legsBelow:V.legsBelow*headBone/standHead,pose:pose.name
 };
}
// Ray (o + d t, |d| = 1) against a sphere: entry distance or Infinity.
export function raySphere(o,d,c,r){const q=[c[0]-o[0],c[1]-o[1],c[2]-o[2]],t=q[0]*d[0]+q[1]*d[1]+q[2]*d[2],m=q[0]*q[0]+q[1]*q[1]+q[2]*q[2]-t*t;if(m>r*r)return Infinity;const near=t-Math.sqrt(r*r-m);return near>=0?near:(t+Math.sqrt(r*r-m)>=0?0:Infinity);}
// Ray against a capsule (segment a-b, radius r): entry distance or Infinity.
export function rayCapsule(o,d,a,b,r){
 const ba=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],oa=[o[0]-a[0],o[1]-a[1],o[2]-a[2]],dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
 const baba=dot(ba,ba),bard=dot(ba,d),baoa=dot(ba,oa),rdoa=dot(d,oa),oaoa=dot(oa,oa),A=baba-bard*bard,B=baba*rdoa-baoa*bard,C=baba*oaoa-baoa*baoa-r*r*baba;let best=Infinity;
 if(Math.abs(A)>1e-9){const h=B*B-A*C;if(h>=0){const t=(-B-Math.sqrt(h))/A,y=baoa+t*bard;if(t>=0&&y>0&&y<baba)best=t;}}
 for(const e of [a,b]){const t=raySphere(o,d,e,r);if(t<best)best=t;}return best;
}
// Nearest volume a ray enters: {part:'head'|'body'|'legs', distance} or null.
export function rayHit(v,o,d,max=Infinity){
 const H=hitVolumes(v),th=raySphere(o,d,H.head.c,H.head.r),tb=rayCapsule(o,d,H.body.a,H.body.b,H.body.r);
 if(th<=tb&&th<max)return {part:'head',distance:th};
 if(tb<max){const y=o[1]+d[1]*tb-v.y;return {part:y<H.legsBelow?'legs':'body',distance:tb};}
 return null;
}
