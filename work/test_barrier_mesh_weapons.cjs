const assert=require('assert/strict'),H=require('./page_harness.cjs').boot({real3:true}),xe=H.xe;
xe('NET.socket=null;window.meshWorld={ray:()=>Infinity,rayN:(o,d,max)=>({distance:o[1],normal:[0,1,0]})};window.fresh=()=>{a18Reset();window.e=a18MeshCreate([0,0,0],0,window.meshWorld);};window.fresh();true');
// Actual gun/knife shoot() wrappers, with deterministic shot direction only. No fake damage dispatch.
xe('mode=`range`;running=true;paused=false;player={hp:100,x:10,y:0,z:1,ch:0,vx:0,vz:0};player.x=10;player.y=0;player.z=1;J.pick=`Deadlock`;J.a18.drift=0;VM.sw=0;ray.setFromCamera=function(){this.set(new THREE.Vector3(10,.2,1),new THREE.Vector3(0,0,-1));};gFire=function(){};bFx=function(){};vmFire=function(){};xWall=function(){return null;};true');
const before=xe('window.e.state.nodes[1].hp');
xe('rw=`pri`;S.weapon=`Vandal`;ammo=25;fcd=0;reloading=0;shoot();true');assert(xe('window.e.state.nodes[1].hp')<before,'actual gun shot damages node');assert.equal(xe('window.e.state.nodes[2].hp'),320);
xe('window.fresh();rw=`knife`;kSwing=0;fcd=0;VM.sw=0;shoot();true');assert(xe('window.e.state.nodes[1].hp')<320,'actual knife damages node');
// Actual shotgun loop using a narrow deterministic cone directed at one outer orb.
xe('window.fresh();ray.set(new THREE.Vector3(10,.2,1),new THREE.Vector3(0,0,-1));ray.far=200;ads=0;window.W={...WEAP.Bucky,pel:5,cone:0};xPellets(window.W,[]);true');assert(xe('window.e.state.nodes[1].hp')<320,'actual pellet loop damages orb');assert.equal(xe('window.e.state.nodes[2].hp'),320);
// None of those weapons should damage a transparent arm away from nodes.
xe('window.fresh();ray.setFromCamera=function(){this.set(new THREE.Vector3(5,1,1),new THREE.Vector3(0,0,-1));};rw=`pri`;S.weapon=`Vandal`;ammo=25;fcd=0;reloading=0;kSwing=0;VM.sw=0;shoot();true');assert.equal(xe('window.e.state.nodes.reduce((n,p)=>n+(p?p.hp:0),0)'),1960);
xe('a18Reset();true');assert.equal(xe('XLDH.length'),0);assert.equal(xe('dlxLive.length'),0);console.log('offline actual weapon damage paths: gun, knife, shotgun pellets damage only intended mesh orb; arm remains transparent; reset clear PASS (explicit helper, deterministic shot direction)');
