// Grip pose: the third-person weapon must sit in the right palm with the muzzle
// facing the character's forward, and must track the hand through animation
// (the old body-locked attach left the gun floating level while the arms moved).
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {T,parse}=require('./valorant_rigs');
const {pathToFileURL}=require('url');
const threePath=require.resolve('three',{paths:[path.join(__dirname,'../server'),__dirname]});
const SK_URL=pathToFileURL(path.join(path.dirname(threePath),'../examples/jsm/utils/SkeletonUtils.js')).href;
const UP=/^(Spine[234]|Neck|Head|[LR]_(Clavicle|Shoulder|Elbow|Hand|Thumb|Index|Middle|Ring|Pinky))/;
const ST={idle:'Idle_Loop',walk:'Walk_Loop',run:'Jog_Fwd_Loop',strafeL:'Walk_Loop',strafeR:'Walk_Loop',back:'Walk_Loop',crouch:'Crouch_Idle_Loop',crouchWalk:'Crouch_Fwd_Loop',jump:'Jump_Start',fall:'Jump_Loop',land:'Jump_Land',aim:'Pistol_Aim_Neutral',fire:'Pistol_Shoot',reload:'Pistol_Reload',cast:'Spell_Simple_Shoot',throw:'OverhandThrow',hit:'Hit_Chest',hitHead:'Hit_Head',plant:'Fixing_Kneeling',defuse:'Fixing_Kneeling',knife:'Sword_Idle',death1:'Death01',death2:'Death02'};
async function kit(ag){
 const gl=await parse(path.join(__dirname,'../models/valorant/'+ag+'.glb'));
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../models/valorant/'+ag+'-locomotion.json')));
 const C={},L={},U={},A={};
 data.forEach(j=>{const c=T.AnimationClip.parse(j);c.uuid=T.MathUtils.generateUUID();C[c.name]=c;
  L[c.name]=new T.AnimationClip(c.name+'_L',c.duration,c.tracks.filter(t=>!UP.test(t.name)));
  U[c.name]=new T.AnimationClip(c.name+'_U',c.duration,c.tracks.filter(t=>UP.test(t.name)));});
 ['Pistol_Shoot','Hit_Chest','Hit_Head'].forEach(n=>{A[n]=T.AnimationUtils.makeClipAdditive(U[n].clone());});
 return {gl,C,L,U,A,contactLift:null,contactProbes:[]};
}
(async()=>{
 T.SkeletonUtils=await import(SK_URL);
 const src=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8');
 const a=src.indexOf('function xvAgent(M, kit)'),b=src.indexOf('// No third-party fallback visuals');
 assert(a>0&&b>a,'xvAgent source found');
 const XSOL={up:[],mx:[]},XUB={up:new T.Vector3(0,1,0),rt:new T.Vector3(1,0,0)};
 const c={THREE:T,console,XSOL,XUB,XUB_ST:ST,XUB_LO:['idle','walk','run','crouch','crouchWalk','fall','jump','land'],XUB_UPN:['aim','knife','reload','cast','throw'],XUB_FU:['plant','death1','death2'],XNR:()=>{},xRimM:()=>new T.MeshBasicMaterial()};
 vm.createContext(c);
 vm.runInContext(src.slice(a,b)+';this.xvAgent=xvAgent;',c);
 for(const ag of ['jett','phoenix','raze']){
  const k=await kit(ag);
  const m=new T.Group(),gun=new T.Group();
  const gbox=new T.Mesh(new T.BoxGeometry(0.06,0.2,0.7));gun.add(gbox); // stand-in weapon mesh
  m.add(gun);
  const ring=new T.Mesh(new T.RingGeometry(0.4,0.5,8));m.add(ring);
  const M={m,gun,ring,nm:ag,dead:0,mats:[],rim:0xff4655};
  c.xvAgent(M,k);
  assert.equal(M.valorant,1,ag+': native applied');
  m.updateMatrixWorld(true);
  // muzzle (-Z of gun) faces character forward (+Z of M.m)
  const fwd=new T.Vector3(0,0,1).applyQuaternion(m.getWorldQuaternion(new T.Quaternion()));
  const mz=new T.Vector3(0,0,-1).applyQuaternion(gun.getWorldQuaternion(new T.Quaternion()));
  assert(mz.dot(fwd)>0.98,ag+': muzzle aligns with facing, dot='+mz.dot(fwd).toFixed(3));
  // gun up roughly world-up in the neutral stance
  const upv=new T.Vector3(0,1,0).applyQuaternion(gun.getWorldQuaternion(new T.Quaternion()));
  assert(upv.y>0.9,ag+': gun upright, up.y='+upv.y.toFixed(3));
  // grip seated at the palm (middle finger base), not the wrist
  const sc=M.sx.sc,gp=new T.Vector3(),pp=new T.Vector3();
  gun.getWorldPosition(gp);sc.getObjectByName('R_Middle1').getWorldPosition(pp);
  assert(gp.distanceTo(pp)<0.06,ag+': grip in palm, d='+gp.distanceTo(pp).toFixed(3));
  // gun tracks the hand: play the run cycle forward and confirm the gun-hand relation is rigid
  const rel0=sc.getObjectByName('R_Hand').matrixWorld.clone().invert().multiply(gun.matrixWorld);
  M.sx.a.run.reset().play();M.sx.mx.update(0.31);m.updateMatrixWorld(true);
  const rel1=sc.getObjectByName('R_Hand').matrixWorld.clone().invert().multiply(gun.matrixWorld);
  for(let i=0;i<16;i++)assert(Math.abs(rel0.elements[i]-rel1.elements[i])<1e-6,ag+': rigid grip through run cycle');
  const hp=new T.Vector3();sc.getObjectByName('R_Hand').getWorldPosition(hp);
  const g2=new T.Vector3();gun.getWorldPosition(g2);
  assert(g2.distanceTo(hp)<0.35,ag+': gun stays at the moving hand');
 }
 console.log('grip pose: muzzle faces forward, gun upright, grip in palm, rigid hand tracking across jett/phoenix/raze');
})().catch(e=>{console.error(e);process.exit(1)});
