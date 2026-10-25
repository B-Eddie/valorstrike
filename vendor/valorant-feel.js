// Shared deterministic character motor and accuracy model. Metres, seconds, radians.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ValorantFeel=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const C={stepHeight:.4,knifeSpeed:6.75,walk:.6,crouch:.45,groundAcceleration:56.25,groundBraking:80,airAcceleration:3.5,jumpSpeed:7.25,gravity:22,landingLock:.2,crouchEye:.45,crouchDown:.12,crouchUp:.18,deadzone:.275,operatorDeadzone:.15,eyeHeight:1.6,referenceAspect:16/9,horizontalFov:103};
C.verticalFov=2*Math.atan(Math.tan(C.horizontalFov*Math.PI/360)/C.referenceAspect)*180/Math.PI;
function approach(v,t,d){return v<t?Math.min(t,v+d):Math.max(t,v-d);}
function damp(v,t,k,dt){return t+(v-t)*Math.exp(-k*dt);}
function velocity(vx,vz,tx,tz,rate,dt){const dx=tx-vx,dz=tz-vz,d=Math.hypot(dx,dz);if(d<1e-8)return {vx:tx,vz:tz,dx:tx*dt,dz:tz*dt};const t=Math.min(dt,d/Math.max(1e-6,rate)),ax=dx/d*rate,az=dz/d*rate;return {vx:vx+ax*t,vz:vz+az*t,dx:vx*t+.5*ax*t*t+tx*(dt-t),dz:vz*t+.5*az*t*t+tz*(dt-t)};}
// A capsule whose rounded base rests on a stair nosing cannot sink, so it is supported even though
// the floor under its centre is lower; treating that as airborne stalled every staircase.
function supported(P,world,y,height){return world.blocked(P.x,P.z,.4,y-.03,height);}
// Highest floor within 20 cm of the centre: seams between stair meshes read as deep holes at a single point.
function floorNear(world,x,z,y){let f=world.ground(x,z,y+.05);for(const [ox,oz]of [[.2,0],[-.2,0],[0,.2],[0,-.2]])f=Math.max(f,world.ground(x+ox,z+oz,y+.05));return f;}
function step(P,input,dt,world){
 const dt0=Math.max(0,Math.min(.1,dt)),parts=Math.max(1,Math.ceil(dt0*128)),h=dt0/parts;let landed=false,jumped=false;
 const press=!!input.jump&&!P.jumpHeld;P.jumpHeld=!!input.jump;if(press)P.jumpBuffer=.07;
 for(let k=0;k<parts;k++){
  const floor=world.ground(P.x,P.z,P.y),grounded=(P.vy||0)<=0&&(P.y<=floor+.025||supported(P,world,P.y,1.8-(P.ch||0)));
  P.lp=Math.max(0,(P.lp||0)-h);P.jumpBuffer=Math.max(0,(P.jumpBuffer||0)-h);P.duckFatigue=Math.max(0,(P.duckFatigue||0)-h*.55);
  if(!!input.duck!==!!P.duckHeld){if(input.duck)P.duckFatigue=Math.min(.65,(P.duckFatigue||0)+.08);P.duckHeld=!!input.duck;}
  const chTarget=input.duck?C.crouchEye:0,allowed=chTarget>=(P.ch||0)||(!world.blocked(P.x,P.z,.4,P.y,C.eyeHeight+.2)&&(!world.ceiling||!world.ceiling(P.x,P.z,P.y+1.8-(P.ch||0),P.y+1.8)));if(allowed)P.ch=approach(P.ch||0,chTarget,C.crouchEye/((input.duck?C.crouchDown:C.crouchUp)*(1+(P.duckFatigue||0)))*h);
  P.cr=(P.ch||0)>C.crouchEye*.5;P.wk=!!input.walk;
  let mx=input.x||0,mz=input.z||0,l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l;l=1;}
  const duckK=1-(1-C.crouch)*(P.ch||0)/C.crouchEye,max=input.speed*Math.min(duckK,input.walk?C.walk:1)*(input.tag||1);let tx=input.hold?0:mx*max,tz=input.hold?0:mz*max;
  let rate=grounded?(Math.hypot(tx,tz)<Math.hypot(P.vx||0,P.vz||0)||tx*(P.vx||0)+tz*(P.vz||0)<0?C.groundBraking:C.groundAcceleration):C.airAcceleration;
  if(!grounded&&!l){tx=P.vx||0;tz=P.vz||0;}
  if(!grounded){const cap=Math.max(P.takeoffSpeed||input.speed,.1),v=Math.hypot(tx,tz);if(v>cap){tx*=cap/v;tz*=cap/v;}}
  const v=velocity(P.vx||0,P.vz||0,tx,tz,rate,h),height=1.8-(P.ch||0);P.vx=v.vx;P.vz=v.vz;
  const moveAxis=(dx,dz)=>{const x=P.x+dx,z=P.z+dz;if(!world.blocked(x,z,.4,P.y,height)){P.x=x;P.z=z;return true;}
   // A grounded capsule may step onto a low stair, never teleport onto a tall box.
   // Lift by the step height, move, then settle onto the lowest free height above the destination floor.
   if(grounded&&(P.vy||0)<=0){const top=P.y+C.stepHeight,support=world.ground(x,z,top);if(support>top+.001||world.blocked(x,z,.4,top,height)||(world.ceiling&&world.ceiling(P.x,P.z,P.y+height,top+height)))return false;
    // Riser test: sampled every 10 cm ahead, no single rise may exceed the step height (stairs pass, a 60 cm box does not).
    {const sx=Math.sign(dx),sz=Math.sign(dz);let prev=Math.max(world.ground(P.x,P.z,top),P.y-.2);for(let d=.1;d<.55;d+=.1){const g=world.ground(P.x+sx*d,P.z+sz*d,top);if(g<prev-1)continue;if(g-prev>C.stepHeight+.01)return false;prev=g;}} /* samples through seams between stair meshes are ignored */let lo=Math.max(P.y,support),hi=top;if(!world.blocked(x,z,.4,lo,height))hi=lo;else for(let n=0;n<10;n++){const mid=(lo+hi)/2;if(world.blocked(x,z,.4,mid,height))lo=mid;else hi=mid;}const base=floorNear(world,P.x,P.z,P.y);if(hi-base>C.stepHeight+.12)return false;const rise=hi-P.y;P.x=x;P.z=z;P.y=hi;P.vy=0;if(rise>0)P.eyeOffset=(P.eyeOffset||0)-rise;return true;}return false;};
  if(!moveAxis(v.dx,0))P.vx=0;
  if(!moveAxis(0,v.dz))P.vz=0;
  let gy=world.ground(P.x,P.z,P.y),vy=P.vy||0;
  if(grounded&&P.jumpBuffer>0&&!input.duck&&!input.hold){vy=C.jumpSpeed;P.jumpBuffer=0;P.takeoffSpeed=Math.hypot(P.vx,P.vz);P.air=true;jumped=true;}
  const oldY=P.y;let next=P.y+vy*h-.5*C.gravity*h*h;vy-=C.gravity*h;
  if(vy>0&&world.ceiling&&world.ceiling(P.x,P.z,P.y+height,next+height)){vy=0;next=P.y;}
  if(next<=gy){next=gy;if(P.air&&vy<-.5){landed=true;P.lp=C.landingLock;P.landImpact=Math.min(1,-vy/10);P.vx*=.85;P.vz*=.85;}vy=0;}
  // Descending beside a riser must not settle the capsule inside the stair face.
  if(next<oldY&&world.blocked(P.x,P.z,.4,next,height)){let lo=next,hi=oldY;for(let n=0;n<10;n++){const mid=(lo+hi)/2;if(world.blocked(P.x,P.z,.4,mid,height))lo=mid;else hi=mid;}next=hi;vy=0;}
  if(grounded&&!jumped&&next>oldY&&next-oldY<.5)P.eyeOffset=(P.eyeOffset||0)-(next-oldY);
  P.eyeOffset=damp(P.eyeOffset||0,0,18,h);P.y=next;P.vy=vy;P.air=vy>0||(next>gy+.00001&&!supported(P,world,next,height));
 }
 const speed=Math.hypot(P.vx||0,P.vz||0);P.mv=speed>.1;P.sf=speed/Math.max(.001,input.speed);P.speed=speed;return {landed,jumped,speed};
}
function spread(state,weapon,stats){
 const dead=weapon==='Operator'?C.operatorDeadzone:C.deadzone,speed=state.sf!=null?state.sf:(state.mv?1:0),moving=speed>dead,rifle=['Vandal','Phantom','Bulldog','Guardian'].includes(weapon),heavy=weapon==='Ares'||weapon==='Odin',smg=['Stinger','Spectre','Frenzy'].includes(weapon),snp=['Operator','Marshal','Outlaw'].includes(weapon);
 let base=Math.max(0,stats.firstBulletAccuracy||0),error=0;if(state.ads&&stats.adsStats)base=Math.max(0,stats.adsStats.firstBulletAccuracy||0);
 if(state.air)error=snp?10:smg?7:12;else if(state.lp>0)error=snp?7:5;else if(moving){const duck=state.cr,walk=state.wk||speed<.65;error=duck?(rifle?.8:.5):walk?(rifle||heavy?3:1.1):rifle?6:heavy?6.5:smg?3:2.3;}
 if(state.cr&&!moving&&!state.air&&!state.lp)base*=.8;
 return Math.tan((base+error)*Math.PI/180);
}
function disk(random=Math.random){const a=random()*Math.PI*2,r=Math.sqrt(random());return [Math.cos(a)*r,Math.sin(a)*r];}
return {C,step,velocity,spread,disk,damp,approach};
});
