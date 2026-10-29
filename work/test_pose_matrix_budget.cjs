// Many enemies on screen (user, 28 Oct 2026: "fps 60 -> 20 when I meet many enemies"; 75 Hz monitor, wants a steady max fps).
// The per-enemy CPU cost was the pose follow-ups: after the mixer, each xUbPost pass (native foot contact, crouch IK, weapon
// grip, terrain feet, movement stance plant) and the hit volumes brought the agent's whole tree up to date again
// (updateMatrixWorld(true) on the rig, updateWorldMatrix(true, false) up every bone chain an IK step reads), ~2.8k
// local-matrix composes per agent per frame for a ~280-node rig. Budget, on the page's own pose code with real rigs
// (work/pose_chain_harness.cjs: gait + clip selection, xSolTick, every locomotion follow-up, then the renderer's
// scene.updateMatrixWorld + skeleton.update), 4 agents walking / jogging / strafing / crouching / jumping / climbing
// stairs / turning / aiming / shooting:
//  - xSolTick composes at most 1.5 local matrices per rig node per agent per frame (each moved bone once, plus the bones
//    the IK steps move again), and the render pass after it at most 0.1 per node (nothing left to recompose);
//  - the number does not grow with the number of agents (1 / 4 / 8 agents: per-agent cost within 25 %).
// That the pose itself is unchanged by this is work/test_pose_memo_equivalence.cjs.
const assert=require('assert/strict');const {runtime,script,T}=require('./pose_chain_harness.cjs');
const stairs=(x,z)=>Math.max(0,Math.min(12,Math.floor((z-3)/.32)))*.16;
const AG=['jett','reyna','sage','breach','omen','raze','sova','killjoy'];
async function measure(N,F){
 const H=await runtime({floor:stairs});H.camera.position.set(0,1.6,-6);H.camera.lookAt(0,1,5);H.camera.updateMatrixWorld();
 const U=[];for(let i=0;i<N;i++)U.push(await H.agent(AG[i%AG.length],{x:(i%4-1.5)*1.6,z:Math.floor(i/4)*2}));
 let comp=0,on=false;const seen=new Set();
 const hook=M4=>{if(seen.has(M4))return;seen.add(M4);const c0=M4.prototype.compose;M4.prototype.compose=function(){if(on)comp++;return c0.apply(this,arguments);};};
 hook(T.Matrix4);hook(U[0].X.sc.matrix.constructor);
 const st=f=>U.map((u,i)=>script(u,f,{x0:u.g.position.x,z0:u.g.position.z,phase:i}));
 for(let f=0;f<20;f++)H.frame(1/60,st(f));
 let sol=0,ren=0,cpu=0;
 for(let f=20;f<20+F;f++){const c0=process.cpuUsage();H.frame(1/60,st(f),{hooks:{sol:b=>{on=b;if(!b){sol+=comp;comp=0;}},render:b=>{on=b;if(!b){ren+=comp;comp=0;}}}});const c=process.cpuUsage(c0);cpu+=(c.user+c.system)/1000;}
 assert(U.every(u=>u.X.grip&&u.X.grip.ok&&u.X.ft&&u.X.ft.ok&&u.X.rm),'every follow-up is live on every rig (grip, feet, movement plant)');
 return {N,nodes:H.nodes(U[0]),sol:sol/F/N,render:ren/F/N,cpuMsPerFrame:cpu/F};
}
(async()=>{
 const F=+(process.env.FRAMES||150),R=[];for(const N of [1,4,8])R.push(await measure(N,N===4?F:Math.round(F/2)));
 for(const r of R)console.log(`  ${r.N} agent(s): ${r.sol.toFixed(0)} composes / agent / frame in xSolTick, ${r.render.toFixed(1)} in the render pass (${r.nodes} nodes per rig), ${r.cpuMsPerFrame.toFixed(2)} ms CPU per frame`);
 for(const r of R){
  assert(r.sol<=1.5*r.nodes,`${r.N} agents: xSolTick composes ${r.sol.toFixed(0)} local matrices per agent per frame (budget ${(1.5*r.nodes).toFixed(0)} = 1.5 per rig node)`);
  assert(r.render<=0.1*r.nodes,`${r.N} agents: the render pass recomposes ${r.render.toFixed(0)} per agent (budget ${(0.1*r.nodes).toFixed(0)})`);
 }
 const base=R[0].sol;for(const r of R)assert(r.sol<=base*1.25,`per-agent cost grows with agents: ${r.N} -> ${r.sol.toFixed(0)} vs ${base.toFixed(0)}`);
 console.log('Pose matrix budget: xSolTick recomposes each moved bone once per frame, the render pass nothing; flat per agent');
})().catch(e=>{console.error(e);process.exit(1);});
