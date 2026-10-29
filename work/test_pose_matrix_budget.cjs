// Many enemies on screen (user, 28 Oct 2026: "fps 60 -> 20 when I meet many enemies"; 75 Hz monitor, wants a steady max fps).
// The per-enemy CPU cost was the pose follow-ups: after the mixer, the native foot contact probe and the crouch IK each
// brought the agent's whole tree up to date (M.m.updateMatrixWorld(true), twice and once more), and the weapon grip walked a
// 10-14 bone chain up to the scene for every world position or rotation it read (~30 chain walks per hand), ~2.2k node
// updates per agent per frame for a ~280-node rig. Budget, on the page's own pose code with real rigs
// (work/pose_chain_harness.cjs: gait + clip selection, xSolTick, every locomotion follow-up, then the renderer's
// scene.updateMatrixWorld + skeleton.update), 1 / 4 / 8 agents walking / jogging / strafing / crouching / jumping /
// climbing stairs / turning / aiming / shooting; counted: Object3D.updateMatrix calls (one per node update):
//  - xSolTick: at most 4 node updates per rig node per agent per frame (one whole-tree pass after the contact shift, the
//    probe's own bones, the subtrees each IK step moves; the terrain feet and the movement stance plant keep their own
//    passes) and at most 45 % of the same code before the change (the reversed edits of work/test_pose_equivalence.cjs,
//    which checks the pose is bit-identical);
//  - the render pass stays one update per node (three's renderer), skeleton.update once per agent (shared Skeleton:
//    the bone texture is uploaded once per agent, not once per skinned mesh);
const assert=require('assert/strict');const {runtime,script,T}=require('./pose_chain_harness.cjs');const {before}=require('./test_pose_equivalence.cjs');
const stairs=(x,z)=>Math.max(0,Math.min(12,Math.floor((z-3)/.32)))*.16;
const AG=['jett','reyna','sage','breach','omen','raze','sova','killjoy'];
async function measure(N,F,edit){
 const H=await runtime({floor:stairs,edit});H.camera.position.set(0,1.6,-6);H.camera.lookAt(0,1,5);H.camera.updateMatrixWorld();
 const U=[];for(let i=0;i<N;i++)U.push(await H.agent(AG[i%AG.length],{x:(i%4-1.5)*1.6,z:Math.floor(i/4)*2}));
 let um=0,sk=0,on=false;const seen=new Set();
 // every Object3D / Skeleton prototype in play (the GLB loader's three and the harness's three are separate module copies)
 const hook=o=>{let p=o;while(p&&!Object.prototype.hasOwnProperty.call(p,'updateMatrix'))p=Object.getPrototypeOf(p);if(p&&!seen.has(p)){seen.add(p);const f=p.updateMatrix;p.updateMatrix=function(){if(on)um++;return f.call(this);};}};
 const hookS=s=>{const p=Object.getPrototypeOf(s);if(seen.has(p))return;seen.add(p);const f=p.update;p.update=function(){if(on)sk++;return f.call(this);};};
 hook(new T.Object3D());for(const u of U){u.M.m.traverse(hook);for(const o of u.skins)hookS(o.skeleton);}
 const st=f=>U.map((u,i)=>script(u,f,{x0:u.g.position.x,z0:u.g.position.z,phase:i}));
 for(let f=0;f<20;f++)H.frame(1/60,st(f));
 let sol=0,ren=0,skr=0,cpu=0;
 for(let f=20;f<20+F;f++){const c0=process.cpuUsage();on=true;H.frame(1/60,st(f),{render:false});sol+=um;um=0;sk=0;H.draw();ren+=um;skr+=sk;um=sk=0;on=false;const c=process.cpuUsage(c0);cpu+=(c.user+c.system)/1000;}
 assert(U.every(u=>u.X.grip&&u.X.grip.ok&&u.X.ft&&u.X.ft.ok&&u.X.rm),'every follow-up is live on every rig (grip, feet, movement plant)');
 return {N,nodes:U.reduce((a,u)=>a+H.nodes(u),0)/N,sol:sol/F/N,render:ren/F/N,skel:skr/F/N,skins:U.reduce((a,u)=>a+u.skins.length,0)/N,cpuMsPerFrame:cpu/F};
}
(async()=>{
 const F=+(process.env.FRAMES||150),R=[],B=[];
 for(const N of [1,4,8])R.push(await measure(N,N===4?F:Math.round(F/2)));
 for(const N of [1,4,8])B.push(await measure(N,N===4?F:Math.round(F/2),before));
 const line=(r,t)=>`  ${t} ${r.N} agent(s): ${r.sol.toFixed(0)} node updates / agent / frame in xSolTick, ${r.render.toFixed(0)} in the render pass (${r.nodes.toFixed(0)} nodes per rig, mean), ${r.skel.toFixed(2)} skeleton updates / agent (${r.skins.toFixed(1)} skinned meshes), ${r.cpuMsPerFrame.toFixed(2)} ms CPU per frame`;
 for(let i=0;i<R.length;i++){console.log(line(B[i],'before'));console.log(line(R[i],'now   '));}
 for(let i=0;i<R.length;i++){const r=R[i],b=B[i];
  assert(r.sol<=4*r.nodes,`${r.N} agents: xSolTick updates ${r.sol.toFixed(0)} nodes per agent per frame (budget ${(4*r.nodes).toFixed(0)} = 4 per rig node, mean rig ${r.nodes.toFixed(0)})`);
  assert(r.sol<=.45*b.sol,`${r.N} agents: ${r.sol.toFixed(0)} node updates per agent per frame vs ${b.sol.toFixed(0)} before (budget 45 %)`);
  assert(r.render<=1.05*r.nodes,`${r.N} agents: render pass ${r.render.toFixed(0)} node updates per agent`);
  assert(r.skel<=1.0001,`${r.N} agents: ${r.skel.toFixed(2)} skeleton updates per agent per frame (one shared Skeleton)`);
  assert(b.skel>=r.skel,'before: one skeleton per skinned mesh');
 }
 console.log('Pose matrix budget: one whole-tree pass per agent in xSolTick (plus the bones each IK step moves), one skeleton update per agent');
})().catch(e=>{console.error(e);process.exit(1);});
