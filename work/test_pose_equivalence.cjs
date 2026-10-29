// Pose matrix reuse must not change the animation (user, 28 Oct 2026: perf work next to the locomotion only when the animation is
// identical). Two copies of the page's whole third-person pose chain (work/pose_chain_harness.cjs: xUbAnim gait and clip
// selection, xSolTick, native foot contact, crouch IK, weapon grip, terrain feet, movement stance plant, hit volumes, then the
// renderer's scene.updateMatrixWorld + skeleton.update) run side by side on the same inputs: A is the shipped code, B the
// code before the change (the edits below, reversed: whole-tree pass in the contact probe with skeleton.update, crouch IK
// pass always, grip chain walks always, one Skeleton per skinned mesh). All twelve agents, four or eight in a scene at
// once, each through stand / walk / jog / strafes / backpedal / crouch / crouch-walk / jump / stairs / turn / aim sweep /
// knife, shooting and reloading (grip blends out and back), a stretch with no camera and the units moved without a matrix
// update (stale ancestors when the poses start), and a death. After xSolTick and again after the
// render pass, bit for bit (Object.is, so -0 and +0 differ):
//  - every node's local and world matrix in each rig, each skinned mesh's bind inverse;
//  - every skinned mesh's bone matrices (A's meshes share a Skeleton where B has one each) and skinned vertices (all of them
//    every 30 frames, a sample otherwise);
//  - the hit volumes (position, scale, world matrix), the terrain foot plant (offsets, body drop), the movement stance
//    plant (side, anchor, target), the contact shift, the crouch reference, the grip weight and support-hand slide.
// Also: A does fewer node updates (the budget is work/test_pose_matrix_budget.cjs).
// MUTATE=crouch (the crouch IK pass trusts X.mwOk and skips the whole-tree update it owes when the tree is not current) or
// MUTATE=grip (a grip rotation no longer updates the subtree it moves, which the direct matrixWorld reads rely on; the chain
// walks before the change did not) runs A with that bug: the run must then fail (exit 1). Both are detected at 720 frames
// (the test's mutation self-check, run by hand). Not reachable here: the grip's fresh-ancestor fallback (xvFresh false) -
// the crouch IK pass reads M.m.getWorldPosition before the grip runs, which brings M.m's ancestors up to date, so the
// stale-ancestor stretch below checks the contact and crouch passes; the grip's xvFresh check stays as a guard.
const assert=require('assert/strict');const {runtime,script,T}=require('./pose_chain_harness.cjs');
// [piece, shipped text, text before the change]
const REV=[
 ['agent',"wr.add(sc); xvShareSkeletons(sc);\n","wr.add(sc);\n"],
 ['contact',"xUbPre=function(M){const X=M.sx;if(X){X.mwOk=false;if(X.contactRestore){(X.contactRoot||X.cs||X.b.pelvis).position.copy(X.contactRestore);X.contactRestore=null;}}return pre(M);};","xUbPre=function(M){const X=M.sx;if(X&&X.contactRestore){(X.contactRoot||X.cs||X.b.pelvis).position.copy(X.contactRestore);X.contactRestore=null;}return pre(M);};"],
 ['contact',"return;xvContactPass(M,X);const v=X.contactV","return;M.m.updateMatrixWorld(true);const v=X.contactV"],
 ['contact',"for(const {o,indices}of X.contactProbes){for(const i of indices)","for(const {o,indices}of X.contactProbes){o.skeleton.update();for(const i of indices)"],
 ['contact',"X.contactRestore=(X.contactRestoreV||(X.contactRestoreV=new THREE.Vector3())).copy((X.contactRoot||X.cs||X.b.pelvis).position);","X.contactRestore=(X.contactRoot||X.cs||X.b.pelvis).position.clone();"],
 ['contact',"worldToLocal(v));M.m.updateMatrixWorld(true);X.mwOk=true;};}","worldToLocal(v));M.m.updateMatrixWorld(true);};}"],
 ['crouch',"if(!X.mwOk){M.m.updateMatrixWorld(true);X.mwOk=true;}X.ncFresh=typeof xvFresh==='function'&&xvFresh(M.m);const v=X.ncV","M.m.updateMatrixWorld(true);const v=X.ncV"],
 ['crouch'," X.mwOk=false;X.ncRestore="," X.ncRestore="],
 ['crouch',"xgSetWorldQ(L.hand,L.fq);}\n if(!X.ncFresh)M.m.updateMatrixWorld(true);X.mwOk=true;\n};}","xgSetWorldQ(L.hand,L.fq);}\n M.m.updateMatrixWorld(true);\n};}"],
 ['grip',"function xgWorldQ(o, q) { if (!XGRIP.cur) o.updateWorldMatrix(true, false);","function xgWorldQ(o, q) { o.updateWorldMatrix(true, false);"],
 ['grip',"xgWP(A.up, a); xgWP(A.lo, bb); xgWP(A.hand, c);","A.up.getWorldPosition(a); A.lo.getWorldPosition(bb); A.hand.getWorldPosition(c);"],
 ['grip',"  xgWP(A.lo, bb); xgWP(A.hand, c);\n","  A.lo.getWorldPosition(bb); A.hand.getWorldPosition(c);\n"],
 ['grip',"  const held = M.gun; xgHeldSync(M); if (M.gun !== held) { XGRIP.cur = false; if (M.sx) M.sx.mwOk = false; } // a new gun is not placed yet\n","  xgHeldSync(M);\n"],
 ['grip',"M.gun.quaternion.copy(G.gq); X.mwOk = false; return; }","M.gun.quaternion.copy(G.gq); return; }"],
 ['grip',"root = M.m; if (!XGRIP.cur) root.updateWorldMatrix(true, false);","root = M.m; root.updateWorldMatrix(true, false);"],
 ['grip',"xgWP(G.R.up, gp); xgWP(G.L.up, tmp); gp.add(tmp)","G.R.up.getWorldPosition(gp); G.L.up.getWorldPosition(tmp); gp.add(tmp)"],
 ['grip',"xgWP(G.R.up, gp); gp.addScaledVector(axis(1, 0, 0, tmp)","G.R.up.getWorldPosition(gp); gp.addScaledVector(axis(1, 0, 0, tmp)"],
 ['grip',"xgWP(G.R.hand, hw); gp.add(hw.sub(wt));","G.R.hand.getWorldPosition(hw); gp.add(hw.sub(wt));"],
 ['grip',"if (!XGRIP.cur) M.gun.parent.updateWorldMatrix(true, false); const local","M.gun.parent.updateWorldMatrix(true, false); const local"],
 ['grip',"const sh = xgWP(G.L.up, G.v[6]), reach = (G.reach || (G.reach = xgWP(G.L.up, G.v[7]).distanceTo(xgWP(G.L.lo, G.v[8])) + xgWP(G.L.lo, G.v[8]).distanceTo(xgWP(G.L.hand, G.v[7])))) * 0.985;","const sh = G.L.up.getWorldPosition(G.v[6]), reach = (G.reach || (G.reach = G.L.up.getWorldPosition(G.v[7]).distanceTo(G.L.lo.getWorldPosition(G.v[8])) + G.L.lo.getWorldPosition(G.v[8]).distanceTo(G.L.hand.getWorldPosition(G.v[7])))) * 0.985;"],
 ['grip',"M.gun.quaternion.slerp(G.gq, 1 - G.w); X.mwOk = false; } // blended bones: matrices not refreshed\n","M.gun.quaternion.slerp(G.gq, 1 - G.w); }\n"],
 ['grip',"if (M && M.valorant && M.sx && !M.dead) { const X = M.sx; XGRIP.cur = X.mwOk === true && typeof xvFresh === 'function' && xvFresh(M.m); try { xgPose(M, 1 / 60); } catch (e) { X.mwOk = false; if (!XGRIP.err++) console.warn('weapon grip disabled for a frame', e); } finally { XGRIP.cur = false; } } }; }","if (M && M.valorant && M.sx && !M.dead) try { xgPose(M, 1 / 60); } catch (e) { if (!XGRIP.err++) console.warn('weapon grip disabled for a frame', e); } }; }"],
];
const MUT={crouch:['crouch',"if(!X.mwOk){M.m.updateMatrixWorld(true);X.mwOk=true;}","X.mwOk=true;"],
 grip:['grip',"bn.quaternion.copy(pq.invert().multiply(qw)); bn.updateMatrixWorld(true); }","bn.quaternion.copy(pq.invert().multiply(qw)); }"]};
const mutate=(n,s)=>{const m=MUT[process.env.MUTATE];if(!m||m[0]!==n)return s;assert.equal(s.split(m[1]).length,2,'mutation target '+process.env.MUTATE);return s.replace(m[1],m[2]);};
const before=(n,s)=>{for(const [k,a,b] of REV)if(k===n){assert.equal(s.split(a).length,2,'shipped '+n+' code carries: '+a.slice(0,70));s=s.replace(a,b);}return s;};
const stairs=(x,z)=>Math.max(0,Math.min(12,Math.floor((z-3)/.32)))*.16+(x>6?.4:0);
const same=(x,y)=>Object.is(x,y);
let checks=0,verts=0,frames=0;
function cmpArr(a,b,what){assert.equal(a.length,b.length,what+' length');for(let i=0;i<a.length;i++)if(!same(a[i],b[i]))assert.fail(`${what}[${i}]: ${a[i]} vs ${b[i]} (shipped vs before)`);checks+=a.length;}
function nodes(u){const L=[];u.M.m.traverse(o=>L.push(o));return L;}
function compareRigs(ua,ub,tag,{full=false,skin=false}={}){
 const A=nodes(ua),B=nodes(ub);assert.equal(A.length,B.length,tag+' node count');
 for(let i=0;i<A.length;i++){const a=A[i],b=B[i],w=`${tag} node ${i} ${a.name||a.type}`;cmpArr(a.matrixWorld.elements,b.matrixWorld.elements,w+' matrixWorld');cmpArr(a.matrix.elements,b.matrix.elements,w+' matrix');
  if(a.isSkinnedMesh){cmpArr(a.bindMatrixInverse.elements,b.bindMatrixInverse.elements,w+' bindMatrixInverse');if(skin)cmpArr(a.skeleton.boneMatrices,b.skeleton.boneMatrices,w+' bone matrices');}}
 if(skin){const va=new T.Vector3(),vb=new T.Vector3();for(let k=0;k<ua.skins.length;k++){const a=ua.skins[k],b=ub.skins[k],P=a.geometry.attributes.position,st=full?1:Math.max(1,Math.floor(P.count/97));
  for(let i=0;i<P.count;i+=st){va.fromBufferAttribute(P,i);a.applyBoneTransform(i,va).applyMatrix4(a.matrixWorld);vb.fromBufferAttribute(b.geometry.attributes.position,i);b.applyBoneTransform(i,vb).applyMatrix4(b.matrixWorld);
   if(!same(va.x,vb.x)||!same(va.y,vb.y)||!same(va.z,vb.z))assert.fail(`${tag} skin ${k} vertex ${i}: ${va.toArray()} vs ${vb.toArray()}`);verts++;}}}
 const XA=ua.X,XB=ub.X,st=X=>[X.ft?[...X.ft.d,X.ft.p]:[],X.rm&&X.rm.plant?[X.rm.plant.side==='L'?1:X.rm.plant.side==='R'?2:0,+!!X.rm.plant.active,...X.rm.plant.anchor.toArray(),...(X.rm.plant.target?X.rm.plant.target.toArray():[])]:[],X.contactRestore?X.contactRestore.toArray():[9],[X.ncStand==null?-1:X.ncStand,X.grip?X.grip.w:-1,X.grip&&X.grip.slide||0,X.cb,X.yaw]].flat();
 cmpArr(st(XA),st(XB),tag+' plant / contact / grip state');
 cmpArr([...ua.body.position.toArray(),...ua.body.scale.toArray(),...ua.head.position.toArray(),...ua.head.scale.toArray(),...ua.body.matrixWorld.elements,...ua.head.matrixWorld.elements],[...ub.body.position.toArray(),...ub.body.scale.toArray(),...ub.head.position.toArray(),...ub.head.scale.toArray(),...ub.body.matrixWorld.elements,...ub.head.matrixWorld.elements],tag+' hit volumes');
}
async function group(slugs,F){
 const HA=await runtime({floor:stairs,edit:mutate}),HB=await runtime({floor:stairs,edit:before});
 for(const H of [HA,HB]){H.camera.position.set(0,1.6,-7);H.camera.lookAt(0,1,5);H.camera.updateMatrixWorld();}
 const UA=[],UB=[];for(let i=0;i<slugs.length;i++){const o={x:(i%4-1.5)*1.7,z:Math.floor(i/4)*2.5};UA.push(await HA.agent(slugs[i],o));UB.push(await HB.agent(slugs[i],o));}
 assert(UA.some(u=>new Set(u.skins.map(o=>o.skeleton)).size<u.skins.length),'shipped rigs share skeletons across their skinned meshes');
 assert(UB.every(u=>new Set(u.skins.map(o=>o.skeleton)).size===u.skins.length),'reference rigs keep one skeleton per mesh');
 const states=(U,f)=>U.map((u,i)=>{const s=script(u,f,{x0:(i%4-1.5)*1.7,z0:Math.floor(i/4)*2.5,phase:i*1.7|0});
  if(f%240>=200&&f%240<205)s.reload=Math.floor(f/240)+1; // reload: the grip blends out and back in
  if(i===0&&F>=120&&f>=F-40)s.dead=true;return s;});
 for(let f=0;f<F;f++){
  const stale=f>=F/2&&f<F/2+40; // no camera, units moved without any matrix update before the pose
  for(const H of [HA,HB])H.c.camera=stale?null:H.camera;
  const sa=states(UA,f),sb=states(UB,f);
  HA.frame(1/60,sa,{render:false});HB.frame(1/60,sb,{render:false});
  for(let i=0;i<UA.length;i++)compareRigs(UA[i],UB[i],`${slugs[i]} frame ${f} after xSolTick`);
  HA.draw();HB.draw();
  const full=f%30===0;for(let i=0;i<UA.length;i++)compareRigs(UA[i],UB[i],`${slugs[i]} frame ${f} rendered`,{skin:true,full});frames++;
 }
 return {A:HA,B:HB,UA,UB};
}
module.exports={REV,before};
if(require.main===module)(async()=>{
 const F=+(process.env.FRAMES||720);
 const g1=await group(['jett','reyna','sage','breach'],F);
 const g2=await group(['phoenix','sova','raze','killjoy','omen','skye','chamber','cypher'],Math.round(F/2));
 for(const g of [g1,g2])for(const u of g.UA)assert(u.X.grip&&u.X.grip.ok&&u.X.ft&&u.X.ft.ok&&u.X.rm,u.slug+': grip, feet and movement plant were live');
 assert(g1.UA[0].M.dead||F<120,'the death was played');
 console.log(`  ${frames} frames x 4 / 8 agents: ${checks} matrix / state values and ${verts} skinned vertices identical, shipped vs before`);
 console.log('Pose matrix reuse: every bone, bone matrix, skinned vertex, hit volume and foot plant bit-identical on all locomotion');
})().catch(e=>{console.error(e);process.exit(1);});
