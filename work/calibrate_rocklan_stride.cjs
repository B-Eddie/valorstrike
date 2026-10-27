// Stride calibration for the Rocklan movement layer (no source pack needed: reads the baked movement.json / movement.bin).
// The builder's naturalSpeed estimate ((|lower-foot travel| + 2 x left-foot excursion) / 2 x duration) counts forward swing travel
// and flight frames, so the cycles ran 12-52 % fast for the ground speed (the planted foot moonwalked, and the support-foot IK let
// go after a few frames once its correction passed 0.22 m). This measures what the runtime actually does: each directional gait
// clip on each rig, at a speed that selects that clip alone, with the support-foot IK off; the support foot's ground-plane speed
// relative to the body while its lowest skinned sole sample is within 1.5 cm of the floor (median). The cycle rate scales the foot
// speed linearly, so stanceSpeed = naturalSpeed x measured foot speed / ground speed is the speed at which the planted foot
// stands still. Written as contact.stanceSpeed next to the builder's estimates (naturalSpeed is kept); the runtime prefers it.
// usage: node work/calibrate_rocklan_stride.cjs [rig ...]   (no args: all twelve rigs). Rewrites models/valorant/movement/movement.json.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {runtime,build,T,root}=require('./rocklan_movement_harness.cjs');
const FILE=path.join(root,'models/valorant/movement/movement.json');
const DIRS=['N','NE','E','SE','S','SW','W','NW'];
// Speeds that select one gait alone in xrmGround (walk < 3.5, power walk at 4.05, run >= 4.7, knife sprint >= 5.3; crouch any).
const GAITS={walk:{speed:3.24},powerWalk:{speed:4.05},run:{speed:5.4},sprint:{speed:6.75,knife:true},crouchWalk:{speed:2,cr:true}};
function feet(X){const out={L:[],R:[]};for(const {o,indices}of X.contactProbes){const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight;
 for(const i of indices)for(const s of ['L','R']){let w=0;for(let k=0;k<4;k++){const n=o.skeleton.bones[si.array[i*4+k]].name;if(n===s+'_Foot'||n===s+'_Toe')w+=sw.array[i*4+k];}if(w>.9)out[s].push({o,i});}}return out;}
function vtx(o,i){const v=new T.Vector3().fromBufferAttribute(o.geometry.attributes.position,i);(o.applyBoneTransform||o.boneTransform).call(o,i,v);return v.applyMatrix4(o.matrixWorld);}
// Median support-foot speed relative to the body along the travel direction (m/s), IK off.
async function measure(c,slug,gait,d,frames=120,witness=null){
 const R=await build(slug,c),g=GAITS[gait],angle=d*Math.PI/4,dir=[-Math.sin(angle),Math.cos(angle)],pose=c.xrmPlantPose;
 c.xrmPlantPose=()=>{};
 try{
  R.M.w=g.knife?'Knife':'Vandal';R.advance(40,{cr:!!g.cr});R.advance(60,{speed:g.speed,angle,cr:!!g.cr});
  // Two witnesses per frame: the ankle (Foot bone) of the support foot, i.e. the lower Foot bone by >= 2 cm, and the lowest skinned
  // sole sample of that foot when it is within 1.5 cm of the floor (the contact point; a toe pivoting about the ankle moves it).
  // The calibration uses the contact point when it has >= 40 samples (what the eye reads as slip), else the ankle (crouch-walks on
  // some rigs, whose swing toe passes within a centimetre of the floor, leave the sole witness with too few clean samples).
  const F=feet(R.X),v=[],sole=[];let prev=null;
  for(let f=0;f<frames;f++){
   R.advance(1,{speed:g.speed,angle,cr:!!g.cr});for(const {o}of R.X.contactProbes)o.skeleton.update();
   const A={L:R.at('L_Foot'),R:R.at('R_Foot')},P={L:F.L.map(W=>vtx(W.o,W.i)),R:F.R.map(W=>vtx(W.o,W.i))},pos=R.position;
   const s=A.L.y<A.R.y?'L':'R',o=s==='L'?'R':'L';
   if(prev&&prev.s===s&&A[o].y-A[s].y>=.02){
    const rel=(p,q)=>-((p.x-q.x-(pos.x-prev.pos.x))*dir[0]+(p.z-q.z-(pos.z-prev.pos.z))*dir[1])*60;
    v.push(rel(A[s],prev.A[s]));
    const Q=prev.P[s];let li=0;for(let i=1;i<Q.length;i++)if(Q[i].y<Q[li].y)li=i;
    if(Q[li].y<.015&&P[s][li].y<.015)sole.push(rel(P[s][li],Q[li]));
   }
   prev={A,P,pos,s};
  }
  sole.sort((a,b)=>a-b);
  v.sort((a,b)=>a-b);const ankle=v.length?v[Math.floor(v.length/2)]:NaN,soleK=sole.length?sole[Math.floor(sole.length/2)]:NaN,useSole=witness?witness==='sole':sole.length>=40;
  return {speed:g.speed,foot:useSole?soleK:ankle,witness:useSole?'sole':'ankle',samples:useSole?sole.length:v.length,ankle,sole:soleK,soleSamples:sole.length,meta:R.X.rm.meta[gait+DIRS[d]]};
 } finally {c.xrmPlantPose=pose;}
}
module.exports={measure,GAITS,DIRS};
if(require.main===module)(async()=>{
 const h=JSON.parse(fs.readFileSync(FILE,'utf8')),rigs=process.argv.slice(2).length?process.argv.slice(2):Object.keys(h.agents);
 const c=await runtime();
 for(const slug of rigs){
  const clips=new Map(h.agents[slug].clips.map(x=>[x.name,x]));
  for(const gait of Object.keys(GAITS))for(let d=0;d<8;d++){
   const name=gait+DIRS[d],clip=clips.get(name);
   // measure against the builder's estimate (the harness reads the header it was given; drop any earlier calibration first)
   const m=c.packed.movement.h.agents[slug].clips.find(x=>x.name===name);delete m.contact.stanceSpeed;delete m.contact.stanceWitness;
   const r=await measure(c,slug,gait,d);
   if(!(r.samples>=20&&r.foot>0))throw Error(slug+' '+name+' no usable stance ('+r.samples+' samples)');
   clip.contact.stanceSpeed=+(clip.naturalSpeed*r.foot/r.speed).toFixed(6);
   clip.contact.stanceWitness=r.witness;
   console.log(slug,name,r.witness,'k',(r.foot/r.speed).toFixed(3),'stanceSpeed',clip.contact.stanceSpeed);
   // The contact point's roll timing shifts with the rate, so its response is not exactly linear: refine at the new rate
   // (same witness) until within 4 %, at most three times.
   for(let pass=0;pass<3;pass++){
    m.contact.stanceSpeed=clip.contact.stanceSpeed;const q=await measure(c,slug,gait,d,120,r.witness),k=q.foot/q.speed;
    if(!(q.samples>=15&&k>0))break;if(Math.abs(k-1)<=.04)break;
    clip.contact.stanceSpeed=+(clip.contact.stanceSpeed*k).toFixed(6);console.log('  refine',slug,name,'k',k.toFixed(3),'->',clip.contact.stanceSpeed);
   }
  }
  fs.writeFileSync(FILE,JSON.stringify(h));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
