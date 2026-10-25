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
// A capsule already embedded in geometry where it stands is not supported by it (it would hang inside a wall and
// could jump again from there, climbing it: Ascent -56,-22 wall, bots 2.5 m up inside the building).
// Vertical probes use a 2 cm thinner capsule than horizontal moves (.4): horizontal movement accepts a capsule grazing a
// wall at its .388 tolerance, where a same-radius blocked() flips with float noise as the capsule moves up or down. That made
// any wall corner read as a floor (hanging mid-air beside it and jumping again from there).
const VR=.38;
// A grazed wall reads blocked at y-.03 as often as not, so contact alone is not support: there must also be a floor under
// the capsule's footprint within a riser and a bit (a nosing's tread, a box edge), never a wall face mid-air.
function supported(P,world,y,height){if(!world.blocked(P.x,P.z,.4,y-.03,height)||world.blocked(P.x,P.z,VR,y,height))return false;if(world.ground(P.x,P.z,y+.05)>y-.45)return true;for(let k=0;k<8;k++){const a=k*Math.PI/4;if(world.ground(P.x+Math.cos(a)*.34,P.z+Math.sin(a)*.34,y+.05)>y-.45)return true;}return false;}
// Highest floor within 20 cm of the centre: seams between stair meshes read as deep holes at a single point. Also the
// footprint ring supported() stands on (.34 m): a capsule walking a stair's open side with its centre past the edge (Ascent
// A stairs, west rim over the 8 m pit) stands on the tread under its rim, not on the pit floor; measuring the next riser
// from the pit refused every step (10 m 'climb'), so it pressed into the riser corner until the unwedge moved it.
// Only floors at or below the feet count, so a wall top beside the capsule never becomes its base.
function floorNear(world,x,z,y){let f=world.ground(x,z,y+.05);for(const [ox,oz]of [[.2,0],[-.2,0],[0,.2],[0,-.2]])f=Math.max(f,world.ground(x+ox,z+oz,y+.05));if(f<y-.45)for(let k=0;k<8;k++){const a=k*Math.PI/4;f=Math.max(f,world.ground(x+Math.cos(a)*.34,z+Math.sin(a)*.34,y+.05));}return f;}
// Player clips: invisible walls over open map edges the source collision leaves open (Ascent A: a hole beside the A ramp,
// open on every side, no floor below). Movement only: the client's nmBlocked and the server world's blocked() both ask
// clipBlocked, while shots, sight and floor rays never see a clip. Each clip is a vertical prism: polygon p of [x,z]
// (the void's outline, measured on the collision mesh) from y[0] to y[1]; a capsule (radius r, feet y, height) is blocked
// when its footprint comes within r of the polygon and the heights overlap, exactly as a wall standing on the rim would.
const CLIPS={ascent:[{name:'A ramp pit',y:[-60,15],p:[[42.55,-25.15],[42.62,-24.95],[42.78,-24.25],[42.98,-23.25],[42.5,-23.13],[41,-22.83],[39.5,-22.52],[38,-22.2],[37.3,-22.18],[37.22,-22.7],[37.12,-23.1],[37,-23.55],[36.97,-23.82],[37.45,-23.92],[37.95,-24.02],[38.15,-24.25],[38.75,-24.42],[39.65,-24.62],[40.7,-24.82],[41.7,-25.02]]}]};
for(const k in CLIPS)for(const c of CLIPS[k]){let a=1e9,b=-1e9,e=1e9,f=-1e9;for(const [x,z]of c.p){a=Math.min(a,x);b=Math.max(b,x);e=Math.min(e,z);f=Math.max(f,z);}c.b=[a,b,e,f];}
function polyDist(p,x,z){let inside=false,d=Infinity;for(let i=0,j=p.length-1;i<p.length;j=i++){const [ax,az]=p[j],[bx,bz]=p[i];if((bz>z)!==(az>z)&&x<(ax-bx)*(z-bz)/(az-bz)+bx)inside=!inside;const ex=bx-ax,ez=bz-az,t=Math.max(0,Math.min(1,((x-ax)*ex+(z-az)*ez)/(ex*ex+ez*ez||1)));d=Math.min(d,Math.hypot(ax+ex*t-x,az+ez*t-z));}return inside?0:d;}
function clipBlocked(map,x,z,r,y,height=1.8){const L=CLIPS[map];if(!L)return false;const y0=y+.025,y1=y+height;for(const c of L){if(y1<=c.y[0]||y0>=c.y[1]||x<c.b[0]-r||x>c.b[1]+r||z<c.b[2]-r||z>c.b[3]+r)continue;if(polyDist(c.p,x,z)<r)return true;}return false;}
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
  // Rising into geometry beside the axis (an overhang, a wall lip) the centre ceiling ray misses: stop at the highest free height.
  if(next>oldY&&world.blocked(P.x,P.z,VR,next,height)&&!world.blocked(P.x,P.z,VR,oldY,height)){let lo=oldY,hi=next;for(let n=0;n<10;n++){const mid=(lo+hi)/2;if(world.blocked(P.x,P.z,VR,mid,height))hi=mid;else lo=mid;}next=lo;vy=Math.min(vy,0);}
  if(next<=gy){next=gy;if(P.air&&vy<-.5){landed=true;P.lp=C.landingLock;P.landImpact=Math.min(1,-vy/10);P.vx*=.85;P.vz*=.85;}vy=0;}
  // Descending beside a riser must not settle the capsule inside the stair face.
  // (Thin probe up the wall, full radius in the last 45 cm above the floor so a landing beside a nosing never ends inside it.)
  if(next<oldY&&!world.blocked(P.x,P.z,VR,oldY,height)&&(world.blocked(P.x,P.z,VR,next,height)||(next-gy<.45&&world.blocked(P.x,P.z,.4,next,height)))){let lo=next,hi=oldY;for(let n=0;n<10;n++){const mid=(lo+hi)/2;if(world.blocked(P.x,P.z,.4,mid,height))lo=mid;else hi=mid;}next=hi;vy=0;}
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
return {C,step,velocity,spread,disk,damp,approach,clipBlocked,CLIPS};
});
