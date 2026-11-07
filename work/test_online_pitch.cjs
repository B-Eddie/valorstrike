// Online aim pitch: the client camera, the input message and the authoritative server shot must agree on "up".
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8'),a=s.indexOf('function netInputMsg'),b=s.indexOf('\nlet netWeapon',a);
assert(a>0&&b>a,'netInputMsg must exist');
assert(!/p:-pitch/.test(s),'online input must not negate pitch');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');assert(html.includes('camera.rotation.set(pitch + rcl, yaw - rclH'),'camera uses pitch directly');
(async()=>{
 const T=await import(path.join(__dirname,'..','server','node_modules','three','build','three.module.js'));
 const {Simulation}=await import(path.join(__dirname,'..','server','src','simulation.js'));
 const c={NET:{seq:0,firePulse:0},J:{pick:'Phoenix'},FV:{buy:0},WEAP:{Vandal:{}},fireHeld:true,ads:false,performance:{now:()=>0},yaw:0,pitch:0};vm.createContext(c);vm.runInContext(s.slice(a,b),c);
 for(const dy of [-3,3]){
  // Shooter eye at 1.6 m; target 10 m ahead (-Z) on a floor dy metres lower/higher. Aim at the body centre.
  const dist=10,aim=Math.atan2(dy+.95-1.6,dist);c.pitch=aim;c.yaw=0;
  const cam=new T.Vector3(0,0,-1).applyEuler(new T.Euler(aim,0,0,'YXZ'));
  assert.equal(Math.sign(cam.y),Math.sign(dy+.95-1.6),'camera forward follows pitch sign');
  const m=vm.runInContext('netInputMsg({},"Vandal")',c);assert.equal(m.t,'in');assert.equal(m.fire,1);
  const W={map:{attacker:[0,0,0],defender:[0,0,-2]},nav:{nodes:[[0,0,0],[0,dy,-dist]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};
  const sim=new Simulation(W,'tdm','ascent',()=>.5),u=sim.add('shooter'),v=sim.add('target');sim.start(false);
  Object.assign(u,{x:0,y:0,z:0,protectedUntil:0,fireAt:0,team:0});Object.assign(v,{x:0,y:dy,z:-dist,protectedUntil:0,armor:0,team:1,hp:100});
  assert.equal(sim.command(u,m),true);
  const d=[-Math.sin(u.look)*Math.cos(u.pitch),Math.sin(u.pitch),-Math.cos(u.look)*Math.cos(u.pitch)];
  for(const k of [0,1,2])assert(Math.abs(d[k]-[cam.x,cam.y,cam.z][k])<1e-9,'server aim equals client camera forward');
  assert.equal(sim.fire(u),true);assert(v.hp<100,'shot at a target '+(dy<0?'below':'above')+' must hit');
 }
 console.log('Online pitch: client camera forward, input message and server shot agree; targets below and above are hit');
})().catch(e=>{console.error(e);process.exit(1);});
