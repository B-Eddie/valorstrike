// Visible skeletons must sample the current movement frame at every distance.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {T}=require('./valorant_rigs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const start=html.indexOf('function xSolTick(d)'),end=html.indexOf('// agent root:',start);
assert(start>0&&end>start);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(70,16/9,.1,100);
camera.position.set(0,1,0);camera.updateMatrixWorld(true);
let pre=0,post=0,updates=[];
const ctx={THREE:T,XSOL:{mx:[]},XS:{lod:60},camera,running:true,paused:false,
 xUbPre(){pre++;},xUbPost(M){post++;assert.equal(M.sx.poseDt,updates.at(-1));},xUbDead(){return false;}};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
const M={m:new T.Group(),ub:1,sx:{mx:{update(d){updates.push(d);}}}};scene.add(M.m);ctx.XSOL.mx.push(M);
for(const distance of [5,35,55]){
 M.m.position.set(0,0,-distance);scene.updateMatrixWorld(true);
 updates=[];
 for(let i=0;i<20;i++)ctx.xSolTick(1/120);
 assert.equal(updates.length,20,distance+' m: no alternating held poses');
 assert(Math.abs(updates.reduce((a,b)=>a+b,0)-20/120)<1e-9,'elapsed animation time');
}
M.m.position.z=80;scene.updateMatrixWorld(true);updates=[];ctx.xSolTick(.02);
assert.equal(updates.length,0,'offscreen rig remains culled');
M.m.position.z=-5;scene.updateMatrixWorld(true);ctx.paused=true;ctx.xSolTick(.02);
assert.equal(updates.length,0,'pause freezes pose');ctx.paused=false;ctx.xSolTick(.02);
assert.equal(updates.length,1);assert.equal(pre,post);
assert(!html.includes('requestAnimationFrame(xSolTick)'),'no competing skeleton clock');
const loop=html.slice(html.indexOf('function loop()'),html.indexOf('const XTK ='));
assert(loop.indexOf('xSolTick(rt)')>loop.indexOf('xVis(rt)'),'weights follow movement before mixer');
assert(loop.indexOf('renderer.render(scene, camera)')>loop.indexOf('xSolTick(rt)'),'pose ready before drawing');
console.log('movement sampling: current-frame poses at 120 Hz at 5/35/55 m; culling, pause and render order passed');
// Online prediction previously discarded all time beyond 50 ms on every frame,
// slowing the motor at <20 fps and forcing the server to pull it forward.
const Motor=require('../vendor/valorant-feel.js'),world={ground:()=>0,blocked:()=>false};
const runSource=html.slice(html.indexOf('function xSimRun('),html.indexOf('function xCov()'));
for(const fps of [4,10,20,60,144]){
 const P={x:0,y:0,z:0},times=[];
 const c={MP:{on:true},XRT:{step:.05,max:4,budget:250,debt:0,now:()=>0},performance:{now:()=>c.now},now:0,running:true,paused:false};
 vm.createContext(c);vm.runInContext(runSource,c);
 for(let frame=0;frame<fps;frame++){
  c.now=(frame+1)*1000/fps;
  const advanced=c.xSimRun(1/fps,d=>{
   assert(d<=.05+1e-9,'motor receives bounded steps');
   times.push(c.XRT.at==null?c.now:c.XRT.at);
   Motor.step(P,{x:1,z:0,speed:5.4},d,world);
  });
  assert(Math.abs(advanced-1/fps)<1e-9,'online advances elapsed time at '+fps+' fps');
 }
 assert(Math.abs(P.x-(5.4*(1-.288/2)))<.002,'same acceleration and distance at '+fps+' fps');
 assert(times.every((t,i)=>!i||t>times[i-1]),'ordered prediction timestamps at '+fps+' fps');
}
console.log('online movement: identical distance/acceleration at 4/10/20/60/144 fps, bounded steps and ordered prediction timestamps');
