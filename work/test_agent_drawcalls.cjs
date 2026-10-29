// Agent draw calls (user, 28 Oct 2026: "fps 60 -> 20 when I meet many enemies"). GLTFLoader makes one SkinnedMesh per
// primitive and an agent's primitives often share a material, so each agent drew once per primitive. xvaMerge
// (work/valorant_runtime.js, run by xvaKit) concatenates opaque same-material primitives that share bones / bind matrix /
// parent / layout into one mesh. Checks, per agent model (models/valorant/agents/*.glb, textures stripped):
//  - draws per agent (skinned meshes) go down to one per opaque material (+ each transparent primitive), never up;
//  - locomotion output is unchanged: the same retargeted clips (xvaClips) at several times give bit-identical bone
//    matrices on the merged and the original scene, and every original vertex skins to the same position (boneTransform)
//    in the merged mesh at its offset - so the rendered body is the same;
//  - contact probes are re-pointed: each probe vertex skins to the same position as before;
//  - materials and transparent primitives are untouched; the page carries the runtime's xvaMerge and xvaKit calls it.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{T,parse}=require('./valorant_rigs'),{AGENTS}=require('./build_agent_assets.cjs');
const OUT=path.join(__dirname,'../models/valorant/agents/'),src=fs.readFileSync(__dirname+'/valorant_runtime.js','utf8'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);assert(i>=0&&j>i,a);return src.slice(i,j);};
const ctx={THREE:T};vm.createContext(ctx);vm.runInContext(cut('function xvaClips(','function xvaMerge(')+cut('function xvaMerge(','function xvaKit(')+';globalThis.xvaClips=xvaClips;globalThis.xvaMerge=xvaMerge;',ctx);
assert(/const S = L\.h\.agents\[slug\], probes = xvaMerge\(gl\.scene, S\.contactProbes \|\| \[\]\);/.test(src),'xvaKit merges the kit scene');
assert(html.includes(cut('function xvaMerge(','function xvaKit(').trim()),'index.html carries the runtime xvaMerge (run work/install_valorant.py)');
const H=JSON.parse(fs.readFileSync(OUT+'locomotion.json')),bin=fs.readFileSync(OUT+'locomotion.bin'),L={h:H,f:new Float32Array(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.length))};
const skins=s=>{const a=[];s.traverse(o=>{if(o.isSkinnedMesh)a.push(o);});return a;};
const bt=(m,i,v)=>{v.fromBufferAttribute(m.geometry.attributes.position,i);return (m.applyBoneTransform||m.boneTransform).call(m,i,v);};
const rows=[];let tot0=0,tot1=0;
(async()=>{for(const ag of AGENTS){
 const A=await parse(OUT+ag+'.glb'),B=await parse(OUT+ag+'.glb');const clipsA=ctx.xvaClips(L,ag,A.scene),clipsB=ctx.xvaClips(L,ag,B.scene);
 const m0=skins(B.scene),before=m0.map(o=>({name:o.name,n:o.geometry.attributes.position.count,mat:o.material.name,tr:o.material.transparent}));
 const probes=ctx.xvaMerge(B.scene,H.agents[ag].contactProbes||[]),m1=skins(B.scene),SA=skins(A.scene);
 const opaqueMats=new Set(before.filter(b=>!b.tr).map(b=>b.mat)),want=opaqueMats.size+before.filter(b=>b.tr).length;
 assert.equal(m1.length,want,ag+': one draw per opaque material ('+before.length+' -> '+m1.length+', want '+want+')');
 m1.forEach(o=>{const a=SA.find(x=>x.name===o.name);assert(a,ag+' kept mesh '+o.name);assert.equal(o.material.name,a.material.name);assert.equal(o.material.transparent,a.material.transparent);assert.equal(o.skeleton.bones.length,a.skeleton.bones.length);});
 // where every original primitive went: merged mesh + vertex offset
 const where={};for(const o of m1){let off=0;const g=o.geometry;for(const b of before){if(b.mat!==o.material.name||b.tr)continue;}}
 const map={};{const by={};for(const b of before){const k=b.tr?b.name:b.mat;(by[k]=by[k]||[]).push(b);}for(const k in by){let off=0;for(const b of by[k]){map[b.name]={mesh:by[k][0].name,off};off+=b.n;}}}
 for(const o of m1)assert.equal(o.geometry.attributes.position.count,before.filter(b=>map[b.name].mesh===o.name).reduce((a,b)=>a+b.n,0),ag+' vertex count of '+o.name);
 // locomotion: same clips, same time -> identical bone matrices and skinned vertices
 const mxA=new T.AnimationMixer(A.scene),mxB=new T.AnimationMixer(B.scene);const names=['Idle_Loop','Jog_Fwd_Loop','Walk_Loop','Crouch_Fwd_Loop'].filter(n=>clipsA.some(c=>c.name===n));const pick=names.length?names:[clipsA[0].name];
 const va=new T.Vector3(),vb=new T.Vector3();let worst=0,checked=0;
 for(const n of pick){mxA.stopAllAction();mxB.stopAllAction();mxA.clipAction(clipsA.find(c=>c.name===n)).play();mxB.clipAction(clipsB.find(c=>c.name===n)).play();
  for(const t of [0,0.13,0.41]){mxA.setTime(t);mxB.setTime(t);A.scene.updateMatrixWorld(true);B.scene.updateMatrixWorld(true);
   for(const a of SA){a.skeleton.update();const b=m1.find(o=>o.name===map[a.name].mesh);b.skeleton.update();
    assert.deepEqual(Array.from(b.skeleton.boneMatrices),Array.from(a.skeleton.boneMatrices),ag+' '+n+' t'+t+': bone matrices differ');
    const step=Math.max(1,Math.floor(a.geometry.attributes.position.count/150));
    for(let i=0;i<a.geometry.attributes.position.count;i+=step){bt(a,i,va);bt(b,i+map[a.name].off,vb);worst=Math.max(worst,va.distanceTo(vb));checked++;}}}}
 assert.equal(worst,0,ag+': skinned vertices moved ('+worst+')');
 // contact probes
 mxA.setTime(0.2);mxB.setTime(0.2);A.scene.updateMatrixWorld(true);B.scene.updateMatrixWorld(true);
 (H.agents[ag].contactProbes||[]).forEach((p,k)=>{const q=probes[k],a=SA.find(x=>x.name===p.mesh),b=m1.find(x=>x.name===q.mesh);assert(a&&b,ag+' probe mesh');a.skeleton.update();b.skeleton.update();
  p.indices.forEach((i,j)=>{bt(a,i,va);bt(b,q.indices[j],vb);assert.equal(va.distanceTo(vb),0,ag+' probe vertex');});});
 rows.push(ag+' '+before.length+'->'+m1.length);tot0+=before.length;tot1+=m1.length;}
 console.log('agent draws: '+rows.join(', ')+'; total '+tot0+' -> '+tot1+' (avg '+(tot0/AGENTS.length).toFixed(2)+' -> '+(tot1/AGENTS.length).toFixed(2)+' per agent body)');
 assert(tot1<tot0);console.log('agent drawcalls: OK');})().catch(e=>{console.error(e);process.exit(1);});
