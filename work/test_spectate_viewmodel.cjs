// Spectated teammate's first-person viewmodel framing (work/spectate_runtime.js, as installed in index.html).
// (1) user: "when spectating, the spectated player model looks squished horizontally". The rig root is turned PI/2 about
//     Y (the native rig faces +X), so its LOCAL x is camera depth and its local z is camera horizontal. The FOV match
//     scaled it (s, s, 1) in local space = depth and height by s = tan(fov/2)/tan(43.383/2) (~1.93 at 75 deg) but never the
//     width: the gun and arms drew at ~half their width, the gun pitched up and the arms were pushed off screen. The match
//     must scale camera width and height alike (local (1, s, s), as ability_fp_runtime xAfFov) and keep the eye at the eye.
// (2) user: "first-person spectate of a teammate/bot shows a floating gun with no arms/hands". The rig drew in the world pass
//     on the world camera (0.1 m near plane on native maps, world depth: whatever stands in front of the teammate's eye
//     covers the hands) with the framing above. It now draws exactly like the player's own viewmodel: in the feel pass's
//     VF_VIEW layer (own 55 deg camera, 1.5 cm near plane, own lights, after a depth clear) at the own rest framing (scale 1,
//     +4.5 cm right, -3.5 cm down), and the renderer draws that layer while a spectate rig shows (player dead). On the real
//     Sage / Jett / Breach rigs the support hand is then on screen in front of the near plane, as in the player's own view.
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
{ // (2) the player's own viewmodel layer and framing
 const V={scene:new T.Scene(),camera:new T.PerspectiveCamera(55,16/9,.015,10)};const c=sandbox({VF_VIEW:V}),F=c.xSpectatePov.F;
 assert.equal(F.root.parent,V.scene,'spectate rig drawn in the own viewmodel layer (VF_VIEW), not the world pass');assert.ok(F.root.visible);
 assert.deepEqual(F.root.scale.toArray(),[1,1,1],'own framing: unscaled through the 55 deg lens');
 assert.ok(Math.abs(F.root.rotation.y-Math.PI/2)<1e-9&&F.root.rotation.x===0&&F.root.rotation.z===0,'faces forward');
 assert.ok(F.root.position.distanceTo(new T.Vector3(ORIGIN.x+.045,ORIGIN.y-.035,ORIGIN.z))<1e-9,'own rest offset (+4.5 cm right, -3.5 cm down)');
 // the renderer draws the layer while the spectate rig shows (player dead), and not once it is hidden
 const fl=s.split('\n').find(l=>l.startsWith('function vfBindRenderer('))||'',sv=s.split('\n').find(l=>l.startsWith('function vfSpecView('))||'function vfSpecView(){return false;}';assert.ok(fl,'vfBindRenderer installed');
 const draws=[],r={userData:{},info:{autoReset:true,reset(){},render:{}},autoClear:true,clearDepth(){},render(sc,cam){draws.push(sc===V.scene?'view':sc===c.scene?'world':'?');}};
 c.scene=new T.Scene();c.VF={};c.paused=false;vm.runInContext(fl+'\n'+sv,c);c.vfBindRenderer(r);
 r.render(c.scene,c.camera);assert.deepEqual(draws,['world','view'],'dead + spectating: own viewmodel layer drawn after the world');
 F.root.visible=false;draws.length=0;r.render(c.scene,c.camera);assert.deepEqual(draws,['world'],'no spectate rig shown: world only');F.root.visible=true;
 c.player.hp=100;c.vmTick(.05);draws.length=0;r.render(c.scene,c.camera);assert.deepEqual(draws,['world'],'alive again: spectate rig dropped, the layer only for the own rig');
}
// (3) real rigs: the support hand on screen, in front of the near plane, through the layer camera
(async()=>{
 const FP=await import(path.join(__dirname,'..','server','tools','fp-view.mjs'));
 for(const [ag,w] of [['sage','vandal'],['jett','classic'],['breach','phantom']]){
  const R=await FP.build(ag,w),RF=R.F;RF.kind=null;
  const V={scene:new T.Scene(),camera:new T.PerspectiveCamera(55,16/9,.015,10)};V.camera.updateMatrixWorld(true);
  const c=sandbox({VF_VIEW:V,xvFPGet:()=>({then(f){f(RF);return {catch(){}};}}),xvFPPlay(F,k){F.kind=k;R.api.xvFPPlay(F,k==='equip'?'idle':k,.5);}});
  assert.equal(c.xSpectatePov.F,RF);R.api.xvFPPlay(RF,'idle',.5);V.scene.updateMatrixWorld(true);
  for(const side of ['L']){/* the support hand on the handguard; the grip hand sits below the frame in the own view too */const h=RF.sc.getObjectByName(side+'_Hand'),m=RF.sc.getObjectByName(side+'_Middle1');const p=h.getWorldPosition(new T.Vector3()).lerp(m.getWorldPosition(new T.Vector3()),.55);
   const n=new T.Vector3(p.x,p.y,p.z).project(V.camera);
   assert.ok(-p.z>.015&&Math.abs(n.x)<=1&&Math.abs(n.y)<=1,`${ag}/${w} ${side} hand on screen in the spectate view (ndc ${n.x.toFixed(2)}, ${n.y.toFixed(2)}, depth ${(-p.z).toFixed(3)} m)`);}
 }
 console.log('Spectate viewmodel: FOV match scales camera width = height (no horizontal squish), depth kept, eye at the camera; drawn in the own viewmodel layer with the own framing (renderer draws it while dead + spectating); the support hand on screen on real Sage / Jett / Breach rigs');
})().catch(e=>{console.error(e);process.exit(1);});
