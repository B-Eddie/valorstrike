// Spectated teammate's first-person viewmodel framing (work/spectate_runtime.js, as installed in index.html).
// (1) user: "when spectating, the spectated player model looks squished horizontally". The rig root is turned PI/2 about
//     Y (the native rig faces +X), so its LOCAL x is camera depth and its local z is camera horizontal. The FOV match
//     scaled it (s, s, 1) in local space = depth and height by s = tan(fov/2)/tan(43.383/2) (~1.93 at 75 deg) but never the
//     width: the gun and arms drew at ~half their width, the gun pitched up and the arms were pushed off screen. The match
//     must scale camera width and height alike (local (1, s, s), as ability_fp_runtime xAfFov) and keep the eye at the eye.
// Checks run the installed block in a sandbox (page functions stubbed) on a real three.js rig root.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const T=require('./rig_harness.cjs').T,s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a0=s.indexOf('// ---- SPECTATE POV ----'),b0=s.indexOf('// ---- END SPECTATE POV ----');assert(a0>0&&b0>a0,'spectate POV block installed');
const ORIGIN=new T.Vector3(0,-1.6735,0);
const mkF=(ag,w)=>{const root=new T.Group();root.rotation.y=Math.PI/2;root.visible=false;return {ag,w,root,origin:ORIGIN.clone(),am:{update(){}},gm:{update(){}},kind:null,age:0,action:{getClip:()=>({duration:.3})}};};
function sandbox(extra){
 class El{constructor(){this.style={cssText:'',opacity:''};}}
 const camera=new T.PerspectiveCamera(75,16/9,.1,500);camera.updateProjectionMatrix();
 const c={console,Math,JSON,Promise,Number,String,Array,Object,isFinite,performance:{now:()=>0},document:{createElement:()=>new El(),body:{appendChild(){}}},
  THREE:T,running:true,player:{hp:0},xKL:{sp:true},XOB:{fp:null},allies:[],bots:[],MP:{on:false,me:0},
  WEAP:{Vandal:{rld:2.5,mag:25},Classic:{rld:1.75,mag:12}},XSZ:{},XZ:{Vandal:1.25},xSC:{z:1},xSCf:z=>2*Math.atan(Math.tan(37.5*Math.PI/180)/z)*180/Math.PI,
  hudS(){},$:()=>new El(),setT(){},camera,XV:{fp:null,failures:{}},XSK:{net:{}},xAg:u=>u.agent,xWeapOf:u=>u.w,xskValidFor:()=>true,
  xskGet:()=>'standard',xvFPKey:(ag,w)=>ag+'|'+w,xvFPGet:(ag,w)=>({then(f){f(mkF(ag,w));return {catch(){}};}}),xvFPPlay(F,k){F.kind=k;F.age=0;},xvFPClear(){},
  bfxBot(){},mpCliRS(){},mpCliSnap(){},vmTick(){},xHud(){},...extra};
 c.window=c;vm.createContext(c);vm.runInContext(s.slice(a0,b0+29),c);
 const mate={name:'Sage',agent:'Sage',alive:true,w:'Vandal',nid:7,g:{position:{x:5,y:0,z:5}}};c.allies.push(mate);c.XOB.fp=mate;
 for(let i=0;i<3;i++)c.vmTick(.05);return c;}
// camera-space stretch of the rig along camera x (width), y (height), z (depth): row norms of the root's linear part
function stretch(root){root.updateMatrix();const e=root.matrix.elements;return [Math.hypot(e[0],e[4],e[8]),Math.hypot(e[1],e[5],e[9]),Math.hypot(e[2],e[6],e[10])];}
// the rig's own eye point (its Camera bone: root-parent position -origin before any scale) after the transform
function eye(F){F.root.updateMatrix();const local=ORIGIN.clone().negate().applyQuaternion(F.root.quaternion.clone().invert());return local.applyMatrix4(F.root.matrix);}
{ // (1) world-camera path (no feel layer): width scaled like height
 const c=sandbox({}),F=c.xSpectatePov.F;assert.ok(F&&F.root.visible,'spectate rig shown');assert.equal(F.root.parent,c.camera,'world camera path');
 const [sx,sy,sz]=stretch(F.root),k=Math.tan(75*Math.PI/360)/Math.tan(43.383*Math.PI/360);
 assert.ok(Math.abs(sx-sy)<1e-6,`spectate viewmodel not squished: camera width x${sx.toFixed(3)} = height x${sy.toFixed(3)}`);
 assert.ok(Math.abs(sx-k)<1e-6&&Math.abs(sz-1)<1e-6,`FOV match across and up (x${k.toFixed(3)}), depth kept (${sz.toFixed(3)})`);
 assert.ok(eye(F).length()<1e-6,'the rig\'s eye stays at the camera ('+eye(F).toArray().map(v=>v.toFixed(3))+')');
}
console.log('Spectate viewmodel: FOV match scales camera width = height (no horizontal squish), depth kept, eye at the camera');
