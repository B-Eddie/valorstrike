// #10: derived runtime agent assets. Manifest sizes/hashes match; each optimized model keeps the source rig and geometry
// (same vertices, skin, node hierarchy) without the character-select clips; the shared locomotion file, rebuilt by the
// runtime's own xvaClips on the optimized rig, reproduces every agent's retargeted clips.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict'),{T,parse}=require('./valorant_rigs'),{readGlb,AGENTS}=require('./build_agent_assets.cjs');
const D=path.join(__dirname,'../models/valorant/'),OUT=D+'agents/',w={};vm.runInNewContext(fs.readFileSync(OUT+'manifest.js','utf8'),{window:w});const files=w.VALORANT_AGENT_FILES.files;
assert.deepEqual(Object.keys(files).sort(),AGENTS.map(a=>a+'.glb').concat(['locomotion.json','locomotion.bin']).sort());
let before=0,after=0;for(const [f,m] of Object.entries(files)){const b=fs.readFileSync(OUT+f);assert.equal(b.length,m.bytes,f);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),m.sha256,f);after+=b.length;}
for(const a of AGENTS)before+=fs.statSync(D+a+'.glb').size+fs.statSync(D+a+'-locomotion.json').size;
assert(after*4<before,'agent payload at least 4x smaller: '+before+' -> '+after);
const src=fs.readFileSync(__dirname+'/valorant_runtime.js','utf8'),a0=src.indexOf('function xvaClips('),a1=src.indexOf('function xvaKit(',a0);const ctx={THREE:T};vm.createContext(ctx);vm.runInContext(src.slice(a0,a1)+';globalThis.xvaClips=xvaClips;',ctx);
const H=JSON.parse(fs.readFileSync(OUT+'locomotion.json')),bin=fs.readFileSync(OUT+'locomotion.bin'),F=new Float32Array(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.length)),L={h:H,f:F};assert.equal(F.length,H.floats);
const qd=(a,i,b,j)=>Math.min(Math.hypot(a[i]-b[j],a[i+1]-b[j+1],a[i+2]-b[j+2],a[i+3]-b[j+3]),Math.hypot(a[i]+b[j],a[i+1]+b[j+1],a[i+2]+b[j+2],a[i+3]+b[j+3]));
(async()=>{let worst=0,tracks=0;for(const ag of AGENTS){
  const o=readGlb(OUT+ag+'.glb'),s=readGlb(D+ag+'.glb');assert(!o.json.animations,'no clips in '+ag);assert.equal(o.json.nodes.length,s.json.nodes.length);assert.deepEqual(o.json.nodes.map(n=>[n.name,n.rotation,n.translation,n.children]),s.json.nodes.map(n=>[n.name,n.rotation,n.translation,n.children]));
  assert.deepEqual(o.json.skins.map(k=>k.joints),s.json.skins.map(k=>k.joints));assert(o.json.images.every(i=>i.mimeType==='image/webp'));
  o.json.meshes.forEach((m,i)=>m.primitives.forEach((p,j)=>{const q=s.json.meshes[i].primitives[j];assert.deepEqual(Object.keys(p.attributes).sort(),['JOINTS_0','NORMAL','POSITION','TEXCOORD_0','WEIGHTS_0']);assert.equal(o.json.accessors[p.attributes.POSITION].count,s.json.accessors[q.attributes.POSITION].count,'vertex order/count kept (contact probes index vertices)');assert.equal(o.json.accessors[p.indices].count,s.json.accessors[q.indices].count);}));
  const gl=await parse(OUT+ag+'.glb');const clips=ctx.xvaClips(L,ag,gl.scene),ref=JSON.parse(fs.readFileSync(D+ag+'-locomotion.json'));assert.deepEqual(clips.map(c=>c.name),ref.map(c=>c.name));
  clips.forEach((c,i)=>{assert.deepEqual(c.tracks.map(t=>t.name),ref[i].tracks.map(t=>t.name),ag+' track order');assert(Math.abs(c.duration-ref[i].duration)<1e-6);c.tracks.forEach((t,k)=>{const r=ref[i].tracks[k];tracks++;assert.equal(t.times.length,r.times.length);
    for(let f=0;f<r.times.length;f++){assert(Math.abs(t.times[f]-r.times[f])<1e-5);if(r.type==='quaternion')worst=Math.max(worst,qd(t.values,f*4,r.values,f*4));else for(let e=0;e<3;e++)assert(Math.abs(t.values[f*3+e]-r.values[f*3+e])<1e-5,ag+' pelvis');}});});
  const sk=[];gl.scene.traverse(x=>{if(x.isSkinnedMesh)sk.push(x);});assert(sk.length);for(const p of H.agents[ag].contactProbes)assert(sk.some(m=>m.name===p.mesh&&p.indices.every(i=>i<m.geometry.attributes.position.count)),'contact probe mesh '+p.mesh);
  const wsum=sk[0].geometry.attributes.skinWeight;for(let v=0;v<wsum.count;v+=97){const s4=wsum.getX(v)+wsum.getY(v)+wsum.getZ(v)+wsum.getW(v);assert(Math.abs(s4-1)<1e-4,'normalized weights sum to 1');}}
 assert(worst<5e-4,'local rotation error '+worst);console.log('Agent assets: '+(before/1e6).toFixed(1)+' MB -> '+(after/1e6).toFixed(1)+' MB; manifest hashes, rigs, vertices, weights and '+tracks+' rebuilt locomotion tracks match (max quaternion error '+worst.toExponential(1)+')');
})().catch(e=>{console.error(e);process.exit(1)});
