// Node harness for the whole third-person pose of the page, per frame, for several agents at once: the page's own source
// (index.html / work/*_runtime.js) for the gait and clip selection (xUbAnim), xSolTick (mixer, xUbPre / xUbPost, hit volumes),
// and every xUbPost follow-up that runs in locomotion, wrapped in the page's order: base upper-body offsets, native foot
// contact, native crouch IK, weapon grip (work/grip_runtime.js), terrain foot planting (work/feet_runtime.js, on a stub
// floor with stairs) and the movement overlay with its stance foot plant (work/rocklan_movement_runtime.js). The rope /
// spike plant / ability cast / bullet-time hand follow-ups only act in those states and are not loaded. After xSolTick a
// render pass does what WebGLRenderer does to the rigs: scene.updateMatrixWorld() and one skeleton.update() per skeleton.
// Real three.js (server/node_modules, r160; GLB nodes come from its ES module copy), real agent kits (models/valorant/agents).
//   const H=await runtime({edit}); const U=await H.agent('jett',{x,z}); H.frame(1/60,[{unit,speed,...}]);
const fs=require('fs'),path=require('path'),vm=require('vm'),{pathToFileURL}=require('url');
const {T,parse}=require('./valorant_rigs');const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<0)throw Error('missing source '+a);return s.slice(i,j);};
// edit(name, source) -> source: lets a test run a variant of one piece (e.g. the code before a change)
async function runtime({edit=(n,s)=>s,floor=null}={}){
 const html=read('index.html'),base=path.dirname(require.resolve('three',{paths:[path.join(root,'server')]}));
 const SkeletonUtils=await import(pathToFileURL(path.join(base,'../examples/jsm/utils/SkeletonUtils.js')).href);
 const floorAt=floor||((x,z)=>0);
 const c={THREE:{...T,SkeletonUtils},console,performance:{now:()=>0},Math,Number,Map,Set,WeakMap,Array,Object,JSON,Float32Array,Float64Array,Int32Array,Uint16Array,Uint32Array,Infinity,NaN,isNaN,
  XSOL:{mx:[]},XNR(){},xRimM(){},XGM:{T:{}},mode:'dm',FV:{},WEAP:{},xFvOK:false,window:{},
  groundAt:(x,z)=>floorAt(x,z),camera:new T.PerspectiveCamera(70,16/9,.05,500)};
 // feet_runtime floor probe: a bvh stand-in without packed roots takes the library path (raycastFirst)
 c.nmActive=()=>({bvh:{raycastFirst:(R)=>{const y=floorAt(R.origin.x,R.origin.z);return y<=R.origin.y?{point:{y},face:{normal:{y:1}}}:null;}}});
 vm.createContext(c);
 const src='function xvStatic(){}function xGmTpl(){}function xGmSwap(){}function xvFind(){return null;}\n'+
  edit('core',cut(html,'var XUB =','// any weapon sound'))+'\n'+edit('sol',cut(html,'function xSolTick(','// agent root:'))+'\n'+
  cut(html,'function xvaClips(','function xvaParse(')+'\n'+edit('agent',cut(html,'function xvCull(','// #11: no stand-in'))+'\n'+
  edit('contact',cut(html,'{const pre=xUbPre,post=xUbPost;','// Native first-person'))+'\n'+
  edit('crouch',cut(html,'// Native rigs (nativeContact)','{const update=xVisB;'))+'\n'+
  edit('grip',read('work/grip_runtime.js'))+'\n'+edit('feet',read('work/feet_runtime.js'))+'\n';
 vm.runInContext(src,c,{filename:'pose_chain'});
 const b=fs.readFileSync(path.join(root,'models/valorant/agents/locomotion.bin')),mb=fs.readFileSync(path.join(root,'models/valorant/movement/movement.bin'));
 c.packed={h:JSON.parse(read('models/valorant/agents/locomotion.json')),f:new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
 c.packed.movement={h:JSON.parse(read('models/valorant/movement/movement.json')),f:new Float32Array(mb.buffer.slice(mb.byteOffset,mb.byteOffset+mb.byteLength))};
 vm.runInContext(edit('movement',read('work/rocklan_movement_runtime.js'))+'\n;globalThis.api={xvaKit,xvAgent,xUbAnim,xSolTick,xrHitboxes,xUbPre,xUbPost};',c,{filename:'pose_chain_movement'});
 const scene=new T.Scene();scene.add(c.camera);const units=[];let frameNo=0;
 const kits={};
 async function agent(slug,{x=0,z=0,yaw=0,w='Vandal'}={}){
  const gl=kits[slug]||(kits[slug]=await parse(path.join(root,'models/valorant/agents',slug+'.glb')));
  const kit=c.api.xvaKit(gl,c.packed,slug);
  // a held rifle with the grip sockets xgTemplate writes (template space: muzzle toward -Z)
  const gun=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.05,.1,.9));body.position.z=-.3;gun.add(body);gun.userData.grip={rh:[0,-.07,-.12],lh:[0,-.03,-.45],st:[0,0,.18],side:false};
  const M={m:new T.Group(),mats:[],nm:slug,gun,w};
  const g=new T.Group(),hb=new T.Mesh(new T.CapsuleGeometry(.4,1,4,10)),hh=new T.Mesh(new T.SphereGeometry(.25,12,10));hb.position.y=.9;hh.position.y=1.75;g.add(hb,hh,M.m);
  g.position.set(x,floorAt(x,z),z);g.rotation.y=yaw;scene.add(g);scene.updateMatrixWorld(true);
  c.api.xvAgent(M,kit);
  const u={slug,M,X:M.sx,g,body:hb,head:hh,xm:M,hp:100,alive:true,cr:false,last:g.position.clone()};M.unit=u;
  u.skins=[];M.sx.sc.traverse(o=>{if(o.isSkinnedMesh){u.skins.push(o);o.boneTransform=o.applyBoneTransform;}}); units.push(u);return u; // boneTransform: the r149 page API name
 }
 // one game frame: units move (s.x / s.z / s.y / s.yaw / s.cr / s.pit / s.shoot / s.reload / s.knife / s.dead), xUbAnim per
 // unit, xSolTick, then the render pass
 function frame(dt,states,{render=true,hooks={}}={}){
  frameNo++;
  for(const s of states){const u=s.unit,P=u.g.position;
   const y=s.y!=null?s.y:floorAt(s.x,s.z)+(s.lift||0);P.set(s.x,y,s.z);if(s.yaw!=null)u.g.rotation.y=s.yaw;u.cr=!!s.cr;u.M.xap=s.pit||0;
   if(s.shoot)u.xsh=(u.xsh||0)+1;if(s.reload!=null)u.xAmRn=s.reload;u.M.w=s.knife?'Knife':'Vandal';if(s.dead&&!u.M.dead){u.M.dead=1;}
   const sp=Math.hypot(P.x-u.last.x,P.z-u.last.z)/dt;u.last.copy(P);
   if(!u.M.dead)c.api.xUbAnim(u,u.M,sp,dt);}
  if(hooks.sol)hooks.sol(true);c.api.xSolTick(dt);if(hooks.sol)hooks.sol(false);
  if(render){if(hooks.render)hooks.render(true);scene.updateMatrixWorld();for(const u of units)for(const o of u.skins)if(o.skeleton.frame!==frameNo){o.skeleton.update();o.skeleton.frame=frameNo;}if(hooks.render)hooks.render(false);}
 }
 function nodes(u){let n=0;u.M.m.traverse(()=>n++);return n;}
 return {c,T,scene,units,agent,frame,nodes,camera:c.camera,floorAt};
}
// the game's movement script for a unit: 12 phases (stand, walk, jog, strafes, backpedal, crouch, crouch-walk, jump, stairs,
// turn in place, aim sweep, knife), offset per unit so units are in different phases on the same frame
function script(u,f,{x0=0,z0=0,yaw0=0,phase=0}={}){
 const L=60,k=(f+phase*L/2)%(12*L),p=Math.floor(k/L),t=(k%L)/L,s={unit:u,yaw:yaw0,pit:0};
 u.sp=u.sp||{x:x0,z:z0};const fw=(v,ang)=>{u.sp.x+=-Math.sin(yaw0+ang)*v/60;u.sp.z+=Math.cos(yaw0+ang)*v/60;};
 // walk speeds of the page's movement (m/s): walk 2.5-3.1, run 5.4-6.75, crouch 2
 if(p===1)fw(2.9,0);else if(p===2)fw(5.6,0);else if(p===3)fw(5.4,Math.PI/2);else if(p===4)fw(3.1,-Math.PI/2);else if(p===5)fw(2.5,Math.PI);
 else if(p===6)s.cr=true;else if(p===7){s.cr=true;fw(2,Math.PI/4);}else if(p===8){fw(5.4,0);s.lift=t<.8?4*1.1*(t/.8)*(1-t/.8):0;}
 else if(p===9)fw(3.2,0);else if(p===10)s.yaw=yaw0+t*2.5;else if(p===11)s.pit=Math.sin(t*6.283)*.9;
 if(f%7===0&&p!==6)s.shoot=true;if(p===11&&t>.5)s.knife=true;
 s.x=u.sp.x;s.z=u.sp.z;return s;
}
module.exports={runtime,script,cut,read,root,T};
