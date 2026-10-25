// Ragdoll solver hardening: bones must stay finite and near the death spot,
// even with injected velocity spikes and NaN floor queries.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{T,parse}=require('./valorant_rigs');
(async()=>{
 const src=fs.readFileSync(path.join(__dirname,'repair_runtime.js'),'utf8');
 const a=src.indexOf('function xrRagdoll(M){'),b=src.indexOf('{const die=xDie;');
 assert(a>0&&b>a,'ragdoll source found');
 const groundAt=(x,z,d,f)=>f; // flat floor at the death height
 const fn=new Function('THREE','groundAt','performance',src.slice(a,b)+';return {xrRagdoll,xrRagdollTick};');
 const {xrRagdollTick}=fn(T,groundAt,performance);
 const sc=(await parse(path.join(__dirname,'../models/valorant/jett.glb'))).scene;
 const root=new T.Group();root.add(sc);root.position.set(3,0.4,-2);root.updateMatrixWorld(true);
 const M={m:root,sx:{sc,mx:{stopAllAction(){}}},dead:1,nm:'Jett',ragdoll:null};
 // Freeze a starting pose, then tick 3 s at 60 Hz.
 for(let i=0;i<180;i++){
  if(i===2&&M.ragdoll){const p=M.ragdoll.points[5];p.old.copy(p.p).add(new T.Vector3(50,20,-50));} // velocity spike ~ mach 8
  if(i===4&&M.ragdoll){const p=M.ragdoll.points[7];p.p.set(NaN,NaN,NaN);} // NaN injection
  const alive=xrRagdollTick(M,1/60);
  for(const p of M.ragdoll.points){
   assert(Number.isFinite(p.p.x+p.p.y+p.p.z),'bone finite at tick '+i);
   const d=Math.hypot(p.p.x-3,p.p.z+2);
   assert(d<6,'bone near death spot at tick '+i+': '+d);
   assert(p.p.y>-1&&p.p.y<6,'bone height sane at tick '+i+': '+p.p.y);
  }
  if(!alive){assert(i>150,'ragdoll lives ~2.8 s, got '+i);break;}
 }
 // Bone matrices after write-back must be finite too.
 let bad=0;sc.traverse(o=>{if(o.isBone){const e=o.matrixWorld.elements;for(const v of e)if(!Number.isFinite(v))bad++;}});
 assert(!bad,'all bone matrices finite');
 console.log('ragdoll hardening: finite, bounded, survives velocity spike and NaN injection');
})().catch(e=>{console.error(e);process.exit(1)});
