// Third-person weapon grip regression (ledger row 4): with the game's own rig/upper-body code and
// work/grip_runtime.js, both hands stay on the gun (right on the grip, left on the handguard or cupping a
// sidearm), the muzzle follows the aim pitch, fingers curl, the pose never stacks across frames, and the grip
// fades out for the knife; a reload keeps the gun in the right hand (work/test_tp_gun_hold.cjs checks the reload pose). Also checks the generated index.html carries the grip block verbatim.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const _w=console.warn,_l=console.log;console.warn=(...a)=>{if(!/boneTransform/.test(String(a[0])))_w(...a);};
(async()=>{
 const G=await import(path.join(root,'server/tools/grip-view.mjs'));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),grip=fs.readFileSync(path.join(__dirname,'grip_runtime.js'),'utf8').replace(/\n+$/,'');
 assert(html.includes(grip),'index.html carries work/grip_runtime.js (rerun python3 work/install_valorant.py)');
 assert.equal(html.split('// ---- WEAPON GRIP ----').length,2,'grip block installed exactly once');
 const api=G.runtime();
 const cases=[['jett','vandal'],['jett','phantom'],['jett','spectre'],['jett','stinger'],['jett','operator'],['jett','marshal'],['jett','judge'],['jett','bucky'],['jett','odin'],['jett','classic'],['jett','sheriff'],['jett','ghost'],['breach','vandal'],['sage','operator'],['reyna','sheriff']];
 for(const [agent,weapon] of cases){const R=await G.build(agent,weapon,api);
  for(const st of ['idle','walk','crouch'])for(const pit of [-0.6,0,0.6]){R.play(st,'aim');R.X.pit=pit;R.step(30);const m=G.measure(R),tag=agent+'/'+weapon+'/'+st+'/'+pit;
   assert(m.right<0.04,tag+' right hand on grip '+m.right.toFixed(3));
   assert(m.left<0.05,tag+' left hand on gun '+m.left.toFixed(3));
   assert(m.aimErr<0.01,tag+' muzzle follows aim '+m.aimErr.toFixed(4));
   assert.equal(m.side,['classic','sheriff','ghost'].includes(weapon),tag+' sidearm stance');
   const slide=R.X.grip.slide||0;assert(slide<=0.3,tag+' support hand stays on the handguard');}
  // Fingers curl from the bind pose; repeated frames do not stack offsets.
  R.play('idle','aim');R.X.pit=0.3;R.step(30);R.step(1,0);const a=G.measure(R),q=R.bone("R_Middle2").quaternion.clone();R.step(120,0);const b=G.measure(R);
  assert(Math.abs(a.right-b.right)<1e-3&&Math.abs(a.left-b.left)<1e-3&&Math.abs(a.gunY-b.gunY)<1e-3,agent+'/'+weapon+' pose is stable over frames');
  assert(q.angleTo(R.bone('R_Middle2').quaternion)<1e-3,'finger pose stable');
  const fing=R.X.grip.R.fingers.find(f=>f.f==='Middle'&&f.j===2);assert(fing.bn.quaternion.angleTo(fing.rest)>0.8,agent+'/'+weapon+' middle finger curls round the grip');
 }
 // The knife hands the arms back to the authored clip (grip weight fades to zero); a reload keeps the gun gripped.
 const R=await G.build('jett','vandal',api);R.play('idle','reload');R.step(30);assert(R.X.grip.w>0.99,'a reload keeps the grip (third-person reload pose)');assert(G.measure(R).right<0.04,'reload: the gun stays in the right hand');
 R.play('idle','aim');R.step(30);assert(R.X.grip.w>0.99,'grip returns after reload');
 R.M.w='Knife';R.play('idle','knife');R.step(30);assert.equal(R.X.grip.w,0,'knife is not gripped two-handed');
 R.M.w='Vandal';R.M.dead=1;R.step(5);R.M.dead=0;
 // Missing hand bones or no gun: no grip, no throw.
 const R2=await G.build('jett','vandal',api);R2.M.gun=null;R2.X.grip=undefined;assert.doesNotThrow(()=>api.xgPose(R2.M,1/60));
 _l('grip ok: '+cases.length+' agent/weapon pairs x 3 states x 3 pitches');
})().catch(e=>{console.error(e);process.exit(1);});
