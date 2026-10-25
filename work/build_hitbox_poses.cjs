// Samples the rendered third-person agent pose the way the client builds it (xvaKit lower/upper track split,
// xUbAnim crouch weight 0.62, Pistol_Aim_Neutral upper layer) and writes the
// authoritative hit-volume table the server uses: server/src/hitboxes.json.
// Usage (from repo root): node work/build_hitbox_poses.cjs [agent ...]   (one process per agent keeps memory low)
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),{T,parse}=require('./valorant_rigs');
const root=path.join(__dirname,'..'),out=path.join(root,'server/src/hitboxes.json');
const AGENTS=['breach','chamber','cypher','jett','killjoy','omen','phoenix','raze','reyna','sage','skye','sova'];
const up=/^(Spine[234]|Neck|Head|[LR]_(Clavicle|Shoulder|Elbow|Hand|Thumb|Index|Middle|Ring|Pinky))/;
// Lower-body weights per pose, as xUbAnim sets them (cw = 0.62 * crouch blend).
const CW=.62,POSES={stand:{Idle_Loop:1},crouch:{Idle_Loop:1-CW,Crouch_Idle_Loop:CW},walk:{Walk_Loop:1},run:{Jog_Fwd_Loop:1},crouchWalk:{Walk_Loop:1-CW,Crouch_Fwd_Loop:CW},air:{Jump_Loop:1}};
async function sample(slug){
 const gl=await parse(path.join(root,'models/valorant',slug+'.glb')),sc=gl.scene,wr=new T.Group(),m=new T.Group();wr.add(sc);sc.updateMatrixWorld(true);
 const bx=new T.Box3().setFromObject(sc),scale=1.92/(bx.max.y-bx.min.y);wr.scale.setScalar(scale);wr.position.y=-bx.min.y*scale;m.add(wr);
 const clips={};for(const j of JSON.parse(fs.readFileSync(path.join(root,'models/valorant',slug+'-locomotion.json')))){const c=T.AnimationClip.parse(j);clips[c.name]=c;}
 const L=n=>new T.AnimationClip(n+'_L',clips[n].duration,clips[n].tracks.filter(t=>!up.test(t.name))),U=n=>new T.AnimationClip(n+'_U',clips[n].duration,clips[n].tracks.filter(t=>up.test(t.name)));
 const bone=n=>sc.getObjectByName(n),v=new T.Vector3(),res={};
 for(const [pose,w]of Object.entries(POSES)){
  const acc={head:[0,0,0],pelvis:[0,0,0],neck:[0,0,0]};let n=0;
  for(const phase of [0,.125,.25,.375,.5,.625,.75,.875]){
   const mx=new T.AnimationMixer(sc);for(const [c,wt]of Object.entries(w)){const a=mx.clipAction(L(c));a.setEffectiveWeight(wt);a.play();a.time=phase*clips[c].duration;}
   const ai=mx.clipAction(U('Pistol_Aim_Neutral'));ai.play();mx.update(0);m.updateMatrixWorld(true);
   // Support-foot contact is left out: retargeted grounded clips are authored on the floor (contactFloor), and the
   // runtime correction is a few cm; jog flight is authored lift. Bone positions are taken straight from the mixer.
   const dy=0;
   for(const [k,b]of [['head','Head'],['pelvis','Pelvis'],['neck','Neck']]){bone(b).getWorldPosition(v);acc[k][0]+=v.x;acc[k][1]+=v.y+dy;acc[k][2]+=v.z;}
   n++;mx.stopAllAction();mx.uncacheRoot(sc);
  }
  res[pose]=Object.fromEntries(Object.entries(acc).map(([k,a])=>[k,a.map(x=>+(x/n).toFixed(3))]));
 }
 return res;
}
(async()=>{
 const args=process.argv.slice(2);
 if(args[0]==='--one'){process.stdout.write(JSON.stringify(await sample(args[1])));return;}
 const list=args.length?args:AGENTS,per={};
 for(const a of list){const r=spawnSync(process.execPath,[__filename,'--one',a],{encoding:'utf8',maxBuffer:1<<24});if(r.status!==0){process.stderr.write(r.stderr);process.exit(1);}per[a]=JSON.parse(r.stdout);console.error('sampled',a);}
 // One shared table: agents are all normalised to 1.92 m, so the mean pose is within a few cm of each.
 const poses={},spread={};for(const p of Object.keys(POSES)){poses[p]={};for(const k of ['head','pelvis','neck']){poses[p][k]=[0,1,2].map(i=>+(list.reduce((s,a)=>s+per[a][p][k][i],0)/list.length).toFixed(3));spread[p+'.'+k]=+Math.max(...list.map(a=>Math.hypot(...[0,1,2].map(i=>per[a][p][k][i]-poses[p][k][i])))).toFixed(3);}}
 const table={_source:'work/build_hitbox_poses.cjs: rendered agent pose (lower clip blend + Pistol_Aim_Neutral upper layer), model frame: +Y up, +Z facing. Re-run after animation changes.',crouchWeight:CW,agents:list,maxAgentDeviation:spread,poses,
  volumes:{headOffsetY:.08,headRadius:.195,bodyRadius:.288,bodyBottom:.06,bodyTopBelowHead:.13,legsBelow:.9}};
 fs.writeFileSync(out,JSON.stringify(table,null,1)+'\n');console.error('wrote',out);
})().catch(e=>{console.error(e);process.exit(1);});
