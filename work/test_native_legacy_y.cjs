// hk-33: legacy base-game probes pass blocked(x, z, r, 0) meaning "the floor here" (old maps' floor is y 0). On a native map
// y 0 is under the floor (Ascent 7.05): the leash refused it and every probe read blocked - browser qa_recent2: the
// offline Trapwire spanned 0.6 m (cyWire's wall search hit "walls" at 0.25 m) and its mesh sat at y 0.35, under the floor.
// Checks (generated page, vm with a stub native map: floor 7.05, walls only at |x| >= 3): blocked(x, z, r, 0) asks the floor
// height (free in the lane, blocked in the wall); a real height still works; cyWire spans wall to wall at the floor height;
// sgLook (Sage Resurrection / Healing Orb target) finds a fallen ally 5 m ahead on a floor at 7.05 (it aimed at y 1).
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a);assert(i>=0,'missing '+a);const j=html.indexOf(b,i);assert(j>i,'missing end of '+a);return html.slice(i,j);};
const wrap=cut('{const b=blocked,g=groundAt;blocked=function(x,z,r,y)','\n');
const wire=cut('function cyWire(','function cyD(');
const FLOOR=7.05,C={key:'stub'};
const objs=[];class Obj{constructor(){this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={z:1};this.rotation={y:0};this.userData={};}}
const ctx={Math,Number,Infinity,player:{x:0,y:FLOOR,z:0},BC:{cw:[]},XTRAP:{deploy:1.5},scene:{add:o=>objs.push(o)},THREE:{Mesh:Obj},xG:()=>null,fireMat:()=>null,
 blocked:()=>{throw Error('legacy blocked called on a native map');},groundAt:()=>0,nmActive:()=>C,sgBlk:()=>false,
 nmHeight:()=>FLOOR,nmLeash:(C,x,z,y)=>Math.abs(y-FLOOR)<1,nmBlocked:(C,x,z,r,y)=>Math.abs(x)+r>=3||y<FLOOR-.05};
vm.createContext(ctx);vm.runInContext(wrap+'\n'+wire+'\nglobalThis.cyWire=cyWire;',ctx);
assert.equal(ctx.blocked(0,0,.05,0),false,'y 0 = the floor here: the open lane is free');
assert.equal(ctx.blocked(2.99,0,.05,0),true,'y 0: the wall is still a wall');
assert.equal(ctx.blocked(0,0,.05,FLOOR),false,'a real height still works');
assert.equal(ctx.blocked(0,0,.05,FLOOR-3),true,'a real height under the floor is still refused by the leash');
const W=ctx.cyWire(0,5,1,0,null),len=Math.hypot(W.a.x-W.b.x,W.a.z-W.b.z);
assert.ok(len>5&&len<6,'wire spans wall to wall (x -3..3 less the end margins): '+len);
assert.ok(Math.abs(W.m.position.y-(FLOOR+.35))<1e-9&&W.an.every(o=>Math.abs(o.position.y-(FLOOR+.35))<1e-9),'wire and anchors 0.35 m over the floor: '+W.m.position.y);
{const T=require(require.resolve('three',{paths:[path.join(__dirname,'..','server')]}));const look=cut('function sgLook(','function sgKey(');
 const c2={THREE:T,Math,PE_V:new T.Vector3(),pEyeTo:v=>v.set(0,FLOOR+1.6,0),jAim:()=>new T.Vector3(0,-.05,-1).normalize()};vm.createContext(c2);vm.runInContext(look+'\nglobalThis.sgLook=sgLook;',c2);
 const ally={g:{position:new T.Vector3(0,FLOOR,-5)}};assert.equal(c2.sgLook([ally],12,.8),ally,'Resurrection: fallen ally 5 m ahead on a 7.05 m floor is in sight');
 const side={g:{position:new T.Vector3(5,FLOOR,0)}};assert.equal(c2.sgLook([side],12,.8),undefined,'an ally off to the side is not');}
console.log('native legacy y: sgLook finds the ally on a raised floor; blocked(.., 0) = floor here (lane free, wall blocked); Trapwire',len.toFixed(2),'m at y',W.m.position.y.toFixed(2));
