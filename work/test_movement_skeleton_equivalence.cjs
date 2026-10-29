// The movement stance plant (work/rocklan_movement_runtime.js xrmPlantPoint) skins one sole vertex for every probe it reads
// (all of a foot's probes on a stance-side switch, then the anchor and the contact every planted frame) and ran
// skeleton.update() before each one. That call is redundant (user, 29 Oct 2026: removed only if the animation is
// bit-identical): three's SkinnedMesh.boneTransform (r149 on the page, applyBoneTransform r160 here) multiplies
// skeleton.bones[i].matrixWorld by the bone inverse itself and never reads skeleton.boneMatrices; Skeleton.update only writes
// boneMatrices (and flags the bone texture), and WebGLRenderer rebuilds them for every visible skinned mesh once per render()
// (skeleton.frame, before its frustum test) before anything is drawn. No page code reads boneMatrices / boneTexture.
// Two copies of the page's whole third-person pose chain (work/pose_chain_harness.cjs) run side by side on the same inputs:
// A is the shipped code, B puts the skeleton.update() back. All twelve agents, four and eight in a scene at once, through
// stand / walk / run / strafes / backpedal / crouch / crouch-walk / jump / stairs / turn / aim / knife, shooting and
// reloading, weapon swaps (Vandal / Classic / Phantom / Knife: xgHeldSync puts a new gun in the hand and resets the grip), a
// stretch with no camera and units moved without a matrix update, and a death. After xSolTick and again after the render
// pass, bit for bit (Object.is): every node's local and world matrix, bind inverses, the movement stance plant (side,
// anchor, target), the terrain foot plant, contact shift, crouch reference, grip state, hit volumes; after the render pass
// also every bone matrix and the skinned vertices (all of them every 30 frames, a sample otherwise). The bone matrices are not
// compared after xSolTick: in B they hold the half-posed skeleton xrmPlantPoint wrote mid-frame, which nothing reads and the
// render pass overwrites - that write is exactly what was removed.
// Also counted: skeleton updates per agent per frame inside xSolTick, A vs B (B's extra updates = the probe skins the plant
// did, which must be > 0, i.e. the probe path ran).
// Mutation self-check (run by hand): MUTATE=probe (the plant reads the foot bone instead of its sole probe), MUTATE=eps (a probe
// point 1e-9 m off) and MUTATE=stale (both copies skin the probe from skeleton.boneMatrices, so the removed update would matter)
// must each make the run fail (exit 1).
const assert=require('assert/strict');const {runtime,script,T}=require('./pose_chain_harness.cjs');
const SHIPPED="const W=L.probe;if(!W)return L.hand.getWorldPosition(out);\n  out.fromBufferAttribute(W.o.geometry.attributes.position,W.i);";
const BEFORE="const W=L.probe;if(!W)return L.hand.getWorldPosition(out);\n  W.o.skeleton.update();out.fromBufferAttribute(W.o.geometry.attributes.position,W.i);";
const MUT={probe:["const W=L.probe;if(!W)return","const W=null;if(!W)return"],
 eps:["skin.call(W.o,W.i,out);return out.applyMatrix4(W.o.matrixWorld);","skin.call(W.o,W.i,out);out.applyMatrix4(W.o.matrixWorld);out.x+=1e-9;return out;"],
 // both copies skin the probe from skeleton.boneMatrices (what skeleton.update writes) instead of bone.matrixWorld: then the
 // update is NOT redundant and A, which no longer runs it, reads last frame's bone matrices
 stale:["const skin=W.o.applyBoneTransform||W.o.boneTransform;skin.call(W.o,W.i,out);","{const a=W.o.geometry.attributes,bm=W.o.skeleton.boneMatrices,b=out.clone().applyMatrix4(W.o.bindMatrix),t=new THREE.Vector3(),m=new THREE.Matrix4(),si=new THREE.Vector4().fromBufferAttribute(a.skinIndex,W.i),sw=new THREE.Vector4().fromBufferAttribute(a.skinWeight,W.i);out.set(0,0,0);for(let k=0;k<4;k++){const w=sw.getComponent(k);if(w){m.fromArray(bm,si.getComponent(k)*16);out.addScaledVector(t.copy(b).applyMatrix4(m),w);}}out.applyMatrix4(W.o.bindMatrixInverse);}",true]};
const one=(s,a,b,what)=>{assert.equal(s.split(a).length,2,what+': '+a.slice(0,70));return s.replace(a,b);};
const shipped=(n,s)=>{if(n!=='movement')return s;one(s,SHIPPED,SHIPPED,'shipped movement code');const m=MUT[process.env.MUTATE];return m?one(s,m[0],m[1],'mutation '+process.env.MUTATE):s;};
const before=(n,s)=>{if(n!=='movement')return s;s=one(s,SHIPPED,BEFORE,'shipped movement code');const m=MUT[process.env.MUTATE];return m&&m[2]?one(s,m[0],m[1],'mutation '+process.env.MUTATE):s;};
const stairs=(x,z)=>Math.max(0,Math.min(12,Math.floor((z-3)/.32)))*.16+(x>6?.4:0);
const same=(x,y)=>Object.is(x,y);
let checks=0,verts=0,frames=0;const SK={A:0,B:0,agentFrames:0};
function cmpArr(a,b,what){assert.equal(a.length,b.length,what+' length');for(let i=0;i<a.length;i++)if(!same(a[i],b[i]))assert.fail(`${what}[${i}]: ${a[i]} vs ${b[i]} (shipped vs before)`);checks+=a.length;}
function nodes(u){const L=[];u.M.m.traverse(o=>L.push(o));return L;}
function compareRigs(ua,ub,tag,{full=false,skin=false}={}){
 const A=nodes(ua),B=nodes(ub);assert.equal(A.length,B.length,tag+' node count');
 for(let i=0;i<A.length;i++){const a=A[i],b=B[i],w=`${tag} node ${i} ${a.name||a.type}`;cmpArr(a.matrixWorld.elements,b.matrixWorld.elements,w+' matrixWorld');cmpArr(a.matrix.elements,b.matrix.elements,w+' matrix');
  if(a.isSkinnedMesh){cmpArr(a.bindMatrixInverse.elements,b.bindMatrixInverse.elements,w+' bindMatrixInverse');if(skin)cmpArr(a.skeleton.boneMatrices,b.skeleton.boneMatrices,w+' bone matrices');}}
 if(skin){const va=new T.Vector3(),vb=new T.Vector3();for(let k=0;k<ua.skins.length;k++){const a=ua.skins[k],b=ub.skins[k],P=a.geometry.attributes.position,st=full?1:Math.max(1,Math.floor(P.count/97));
  for(let i=0;i<P.count;i+=st){va.fromBufferAttribute(P,i);a.applyBoneTransform(i,va).applyMatrix4(a.matrixWorld);vb.fromBufferAttribute(b.geometry.attributes.position,i);b.applyBoneTransform(i,vb).applyMatrix4(b.matrixWorld);
   if(!same(va.x,vb.x)||!same(va.y,vb.y)||!same(va.z,vb.z))assert.fail(`${tag} skin ${k} vertex ${i}: ${va.toArray()} vs ${vb.toArray()}`);verts++;}}}
 const st=X=>[X.ft?[...X.ft.d,X.ft.p]:[],X.rm&&X.rm.plant?[X.rm.plant.side==='L'?1:X.rm.plant.side==='R'?2:0,+!!X.rm.plant.active,+!!X.rm.plant.clamped,X.rm.plant.age||0,...X.rm.plant.anchor.toArray(),...(X.rm.plant.target?X.rm.plant.target.toArray():[])]:[],X.contactRestore?X.contactRestore.toArray():[9],[X.ncStand==null?-1:X.ncStand,X.grip?X.grip.w:-1,X.grip&&X.grip.slide||0,X.cb,X.yaw]].flat();
 cmpArr(st(ua.X),st(ub.X),tag+' plant / contact / grip state');
 cmpArr([ua.M.w,ua.M.gun.position.toArray(),ua.M.gun.quaternion.toArray(),ua.M.gun.matrixWorld.elements].flat().map(v=>typeof v==='string'?v.length:v),[ub.M.w,ub.M.gun.position.toArray(),ub.M.gun.quaternion.toArray(),ub.M.gun.matrixWorld.elements].flat().map(v=>typeof v==='string'?v.length:v),tag+' held gun');
 assert.equal(ua.M.w,ub.M.w,tag+' held weapon');
 cmpArr([...ua.body.position.toArray(),...ua.body.scale.toArray(),...ua.head.position.toArray(),...ua.head.scale.toArray(),...ua.body.matrixWorld.elements,...ua.head.matrixWorld.elements],[...ub.body.position.toArray(),...ub.body.scale.toArray(),...ub.head.position.toArray(),...ub.head.scale.toArray(),...ub.body.matrixWorld.elements,...ub.head.matrixWorld.elements],tag+' hit volumes');
}
// weapon swaps: the page's xgHeldSync swaps the held gun when xWeapOf(unit) differs from M.w (xGun builds the new one)
const GRIP={Vandal:{rh:[0,-.07,-.12],lh:[0,-.03,-.45],st:[0,0,.18],side:false,len:.9},Phantom:{rh:[0,-.07,-.1],lh:[0,-.035,-.42],st:[0,0,.17],side:false,len:.85},
 Classic:{rh:[0,-.06,-.05],lh:[0,-.06,-.07],st:[0,0,.05],side:false,len:.25},Knife:{rh:[0,0,0],lh:[0,0,0],st:[0,0,0],side:false,len:.2}};
function weapons(H){
 H.c.xGun=w=>{const G=GRIP[w]||GRIP.Vandal,g=new T.Group(),m=new T.Mesh(new T.BoxGeometry(.05,.1,G.len));m.position.z=-G.len/3;g.add(m);g.userData.grip={rh:G.rh,lh:G.lh,st:G.st,side:G.side};g.name=w;return g;};
 H.c.xWeapOf=u=>u.want||'Vandal';
 // the harness writes M.w each frame (its knife flag); the held weapon is what xgHeldSync last put in the hand
 const sol=H.c.api.xSolTick;H.c.api.xSolTick=function(dt){for(const u of H.units)u.M.w=u.held||'Vandal';try{return sol.apply(this,arguments);}finally{for(const u of H.units)u.held=u.M.w;}};
}
const want=(i,f,s)=>s.knife?'Knife':['Vandal','Classic','Vandal','Phantom'][Math.floor((f+i*37)/150)%4];
async function group(slugs,F){
 const HA=await runtime({floor:stairs,edit:shipped}),HB=await runtime({floor:stairs,edit:before});
 for(const H of [HA,HB]){H.camera.position.set(0,1.6,-7);H.camera.lookAt(0,1,5);H.camera.updateMatrixWorld();weapons(H);}
 const UA=[],UB=[];for(let i=0;i<slugs.length;i++){const o={x:(i%4-1.5)*1.7,z:Math.floor(i/4)*2.5};UA.push(await HA.agent(slugs[i],o));UB.push(await HB.agent(slugs[i],o));}
 // count Skeleton.update calls inside xSolTick (the GLB loader's three is its own module copy: hook the prototypes in play)
 let on=null;const seen=new Set();for(const u of [...UA,...UB])for(const o of u.skins){const p=Object.getPrototypeOf(o.skeleton);if(seen.has(p))continue;seen.add(p);const f=p.update;p.update=function(){if(on)SK[on]++;return f.call(this);};}
 const states=(U,f)=>U.map((u,i)=>{const s=script(u,f,{x0:(i%4-1.5)*1.7,z0:Math.floor(i/4)*2.5,phase:i*1.7|0});
  if(f%240>=200&&f%240<205)s.reload=Math.floor(f/240)+1; // reload: the grip blends out and back in
  if(i===0&&F>=120&&f>=F-40)s.dead=true;u.want=want(i,f,s);return s;});
 const swaps={n:0};
 for(let f=0;f<F;f++){
  const stale=f>=F/2&&f<F/2+40; // no camera, units moved without any matrix update before the pose
  for(const H of [HA,HB])H.c.camera=stale?null:H.camera;
  const sa=states(UA,f),sb=states(UB,f),gunsA=UA.map(u=>u.M.gun);
  on='A';HA.frame(1/60,sa,{render:false});on='B';HB.frame(1/60,sb,{render:false});on=null;SK.agentFrames+=UA.length;
  swaps.n+=UA.filter((u,i)=>u.M.gun!==gunsA[i]).length;
  for(let i=0;i<UA.length;i++)compareRigs(UA[i],UB[i],`${slugs[i]} frame ${f} after xSolTick`);
  HA.draw();HB.draw();
  const full=f%30===0;for(let i=0;i<UA.length;i++)compareRigs(UA[i],UB[i],`${slugs[i]} frame ${f} rendered`,{skin:true,full});frames++;
 }
 return {A:HA,B:HB,UA,UB,swaps:swaps.n};
}
module.exports={SHIPPED,BEFORE,shipped,before,weapons,want};
if(require.main===module)(async()=>{
 const F=+(process.env.FRAMES||720);
 const g1=await group(['jett','reyna','sage','breach'],F);
 const g2=await group(['phoenix','sova','raze','killjoy','omen','skye','chamber','cypher'],Math.round(F/2));
 for(const g of [g1,g2])for(const u of g.UA)assert(u.X.grip&&u.X.grip.ok&&u.X.ft&&u.X.ft.ok&&u.X.rm&&u.X.rm.plant,u.slug+': grip, feet and movement plant were live');
 assert(g1.UA[0].M.dead||F<120,'the death was played');
 assert(g1.swaps+g2.swaps>0,'weapon swaps happened');
 const a=SK.A/SK.agentFrames,b=SK.B/SK.agentFrames;
 console.log(`  ${frames} frames x 4 / 8 agents, ${g1.swaps+g2.swaps} weapon swaps: ${checks} matrix / state values and ${verts} skinned vertices identical, shipped vs before`);
 console.log(`  skeleton updates per agent per frame in xSolTick: before ${b.toFixed(3)} (${SK.B} total), now ${a.toFixed(3)} (${SK.A} total)`);
 assert(SK.B-SK.A>F,'the stance plant skinned its sole probes (the removed calls ran in the reference)');
 assert.equal(SK.A,0,'no skeleton update inside xSolTick (the renderer does it)');
 console.log('Movement stance plant without skeleton.update: every bone, bone matrix, skinned vertex, gun, hit volume and foot plant bit-identical');
})().catch(e=>{console.error(e);process.exit(1);});
