// Procedural FP handling must follow measured movement, settle quickly after peeks, and remain stable while aiming.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const THREE=require(require.resolve('three',{paths:[path.join(__dirname,'../server')]})),source=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8');
const start=source.indexOf('function vfViewDrift('),end=source.indexOf('// Preload the selected loadout',start);
assert(start>=0&&end>start,'view motion source');
function harness(){const root=new THREE.Group(),view={scene:new THREE.Scene(),phase:0,lastAir:false,land:0,swayX:0,swayY:0,bob:0},P={hp:100,vx:0,vz:0,vy:0,air:false,mv:false},F={root,origin:new THREE.Vector3(),ws:root};
 const C={THREE,Math,player:P,yaw:0,VF_VIEW:view,VM:{sx:0,sy:0},xAD:{k:0},VF:{model:{damp:(v,t,k,dt)=>t+(v-t)*Math.exp(-k*dt)}}};vm.createContext(C);vm.runInContext(source.slice(start,end)+';globalThis.tick=vfViewTick;',C);
 return {C,P,F,view,tick:dt=>C.tick(F,dt),run:(seconds,fps=120)=>{for(let n=0;n<Math.round(seconds*fps);n++)C.tick(F,1/fps);}};}
const near=(a,b,t,m)=>assert(Math.abs(a-b)<=t,m+': '+a+' vs '+b);
// No input-driven or time-driven drift while standing still, including input against a wall.
const idle=harness();idle.tick(0);const rest=idle.F.root.position.clone(),restRot=idle.F.root.rotation.clone();idle.P.mv=true;idle.run(2);
assert(idle.F.root.position.equals(rest),'stationary gun position drifts');near(idle.F.root.rotation.z,restRot.z,1e-12,'stationary gun roll');
function side(sign,yaw=0){const h=harness();h.C.yaw=yaw;h.P.vx=sign*5.4*Math.cos(yaw);h.P.vz=-sign*5.4*Math.sin(yaw);h.P.mv=true;h.run(.1);return h;}
const right=side(1),left=side(-1),bob=Math.sin(right.view.phase)*.003*right.view.bob;
near(right.F.root.position.x-.045-bob,-(left.F.root.position.x-.045-bob),1e-12,'left/right translation mirrors');
near(right.F.root.rotation.z-Math.sin(right.view.phase)*.002*right.view.bob,-(left.F.root.rotation.z-Math.sin(left.view.phase)*.002*left.view.bob),1e-12,'left/right roll mirrors');
assert(right.F.root.position.x-.045-bob<0,'right strafe should lag the gun left');assert(Math.abs(right.F.root.rotation.z)<=.012,'movement roll exceeds .7 degrees');
const turned=side(1,Math.PI/2);near(turned.F.root.position.x,right.F.root.position.x,1e-12,'movement follows camera-local axes');
// A release/counter-strafe crosses a small inertial handoff and returns to the planted firing pose.
right.run(.9);right.P.vx=right.P.vz=0;right.P.mv=false;right.run(.1);
assert(right.F.root.position.x>.045,'stopping has no inertial handoff');right.run(.2);
near(right.F.root.position.x,.045,.0008,'stop settles within 0.3 s');near(right.F.root.rotation.z,0,.001,'stop roll settles');
const reverse=side(1);reverse.P.vx=-5.4;reverse.run(.2);assert(reverse.view.moveX<-.99,'reversal still follows the old direction');assert(Math.abs(reverse.F.root.rotation.z)<=.012,'reversal roll exceeds .7 degrees');
// Exact two-stage integration prevents 30 Hz movement from changing the handling relative to 144 Hz.
function sample(fps){const h=harness();h.P.vx=5.4;h.P.vz=-2;h.run(.5,fps);h.P.vx=-3;h.P.vz=0;h.run(.5,fps);h.P.vx=0;h.run(.5,fps);return h;}
const slow=sample(30),fast=sample(144);for(const axis of ['x','y','z'])near(slow.F.root.position[axis],fast.F.root.position[axis],1e-10,'frame rate stable position '+axis);for(const axis of ['x','y','z'])near(slow.F.root.rotation[axis],fast.F.root.rotation[axis],1e-10,'frame rate stable rotation '+axis);
// ADS damps procedural motion to 20%; the optic itself still aligns exactly with the separate view camera.
const hip=side(1),ads=side(1);ads.C.xAD.k=1;ads.tick(0);near(ads.F.root.rotation.z,hip.F.root.rotation.z*.2,1e-12,'ADS roll damping');
const optic=new THREE.Object3D();optic.name='Reflex';optic.position.set(.2,.3,-.4);ads.F.root.add(optic);ads.tick(0);const optical=optic.getWorldPosition(new THREE.Vector3());near(optical.x,0,1e-10,'ADS optic horizontal alignment');near(optical.y,-.025,1e-10,'ADS optic vertical alignment');
// Life changes clear old movement/landing state, while a newly loaded weapon retains the current local movement.
const respawn=side(1);respawn.C.player={hp:100,vx:0,vz:0,vy:0,air:false,mv:false};respawn.tick(0);near(respawn.F.root.position.x,.045,1e-12,'respawn clears old lateral motion');near(respawn.F.root.position.y,-.035,1e-12,'respawn clears old landing/bob');
const revive=side(1);revive.P.hp=0;revive.tick(0);Object.assign(revive.P,{hp:100,vx:0,vz:0});revive.tick(0);near(revive.F.root.position.x,.045,1e-12,'same-player revival clears old motion');
const switching=side(1),next={root:new THREE.Group(),origin:new THREE.Vector3(),ws:new THREE.Group()},before=switching.F.root.position.clone();switching.C.tick(next,0);assert(next.root.position.equals(before),'weapon switch changes current movement response');
console.log('FP view motion: measured camera-local velocity, mirrored strafes, stop/reversal settle, <=.7 degree roll, zero idle drift, 30/144 Hz agreement, ADS damping/alignment, and respawn reset');
