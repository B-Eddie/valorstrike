// Spectator third-person follow cam on elevated native floors (browser-found on Lotus: the camera height was an
// absolute 1.75-1.9 m, so on floors at y≈6 m it sat inside the terrain, 4+ m below the spectated player).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const T=require(require.resolve('three',{paths:[path.join(__dirname,'..','server')]})),s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i=s.indexOf('function xTPCam(a, dt) {'),j=s.indexOf('\n}\n',i)+3;assert(i>0&&j>i,'xTPCam missing');
const ctx=vm.createContext({THREE:T,Math,solids:[],xBoxHit:()=>false,xAng:a=>Math.atan2(Math.sin(a),Math.cos(a))});
vm.runInContext('const XLR=new THREE.Raycaster(),XLH=[];const xTP={on:true,init:false,t:0,d:3,o:new THREE.Vector3(),dir:new THREE.Vector3(),v:new THREE.Vector3()};'+s.slice(i,j)+';globalThis.api={xTPCam,xTP};',ctx);
const {xTPCam,xTP}=ctx.api;
for(const y of [0,6.33,-3.2]){const a={g:new T.Object3D()};a.g.position.set(10,y,-4);a.g.rotation.y=.7;xTP.init=false;xTP.t=0;xTPCam(a,1/60);
 assert(Math.abs(xTP.y-(y+1.9))<.01,'camera '+xTP.y.toFixed(2)+' for a target standing at y='+y);assert(Math.hypot(xTP.x-10,xTP.z+4)<3.2,'stays behind the target');}
console.log('third-person follow cam keeps the target floor height');
