// Derive the runtime agent assets (issue #10) from the source agent GLBs and retargeted locomotion JSON.
//   models/valorant/agents/<agent>.glb  third-person model only: no character-select clips, no unused vertex
//                                       streams (COLOR_0 masks, extra UV sets), WebP textures, 16-bit weights/UVs/indices
//   models/valorant/agents/locomotion.bin + locomotion.json
//                                       the twelve ~1.85 MB per-agent locomotion files stored once: shared bone-world
//                                       rotations plus a constant per-agent, per-bone offset (exact up to float rounding)
//   models/valorant/agents/manifest.js  byte sizes and SHA-256 per file, used for cache keys and integrity
// Usage (repository root): node work/build_agent_assets.cjs        (needs ImageMagick `magick` with WebP)
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'models/valorant'),OUT=path.join(SRC,'agents');
const AGENTS=['jett','phoenix','sova','sage','reyna','raze','killjoy','omen','skye','chamber','breach','cypher','astra','brimstone','clove','harbor','miks','viper','hush','iso','neon','waylay','yoru','fade','gekko','kayo','tejo','deadlock','veto','vyse'];
const KEEP=new Set(['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']);
const COMP={5120:[1,Int8Array],5121:[1,Uint8Array],5122:[2,Int16Array],5123:[2,Uint16Array],5125:[4,Uint32Array],5126:[4,Float32Array]};
const NUM={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};

function readGlb(file){const b=fs.readFileSync(file),jl=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+jl).toString()),bl=b.readUInt32LE(20+jl),bin=b.subarray(28+jl,28+jl+bl);return {json,bin};}
function writeGlb(json,bin){let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+j.length+bin.length,8);head.writeUInt32LE(j.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([head,j,bh,bin]);}
// Read an accessor as a dense typed array (tightly packed, any byteStride honoured).
function readAccessor(json,bin,i){const a=json.accessors[i],[size,T]=COMP[a.componentType],n=NUM[a.type],v=json.bufferViews[a.bufferView],stride=v.byteStride||size*n,out=new T(a.count*n),base=v.byteOffset+(a.byteOffset||0);
  const dv=new DataView(bin.buffer,bin.byteOffset);const get={1:(o)=>T===Int8Array?dv.getInt8(o):dv.getUint8(o),2:(o)=>T===Int16Array?dv.getInt16(o,true):dv.getUint16(o,true),4:(o)=>T===Float32Array?dv.getFloat32(o,true):dv.getUint32(o,true)}[size];
  for(let e=0;e<a.count;e++)for(let c=0;c<n;c++)out[e*n+c]=get(base+e*stride+c*size);return out;}
function webp(png){return execFileSync('magick',['png:-','-alpha','off','-quality','85','-define','webp:method=6','webp:-'],{input:png,maxBuffer:1<<28});}

function buildModel(ag){
  const {json,bin}=readGlb(path.join(SRC,ag+'.glb')),chunks=[],views=[],accessors=[],remap=new Map();let off=0;
  const push=(buf,target)=>{const pad=(4-off%4)%4;if(pad){chunks.push(Buffer.alloc(pad));off+=pad;}chunks.push(buf);const v={buffer:0,byteOffset:off,byteLength:buf.length};if(target)v.target=target;views.push(v);off+=buf.length;return views.length-1;};
  const add=(i,kind)=>{const key=i+'|'+kind;if(remap.has(key))return remap.get(key);const a=json.accessors[i],src=readAccessor(json,bin,i),acc={componentType:a.componentType,count:a.count,type:a.type};let data=src;
    if(kind==='WEIGHTS_0'&&a.componentType===5126){ // normalized uint16, each vertex re-summed to exactly 1
      data=new Uint16Array(src.length);for(let e=0;e<a.count;e++){let s=0,big=0;for(let c=0;c<4;c++)s+=src[e*4+c];s=s||1;let t=0;for(let c=0;c<4;c++){data[e*4+c]=Math.round(src[e*4+c]/s*65535);t+=data[e*4+c];if(data[e*4+c]>data[e*4+big])big=c;}data[e*4+big]+=65535-t;}
      acc.componentType=5123;acc.normalized=true;}
    else if(kind==='TEXCOORD_0'&&a.componentType===5126&&src.every((x)=>x>=0&&x<=1)){data=Uint16Array.from(src,(x)=>Math.round(x*65535));acc.componentType=5123;acc.normalized=true;}
    else if(kind==='indices'&&a.componentType===5125&&src.every((x)=>x<65536)){data=Uint16Array.from(src);acc.componentType=5123;}
    else{if(a.min)acc.min=a.min;if(a.max)acc.max=a.max;if(a.normalized)acc.normalized=true;}
    if(kind==='POSITION'){acc.min=a.min;acc.max=a.max;}
    acc.bufferView=push(Buffer.from(data.buffer,data.byteOffset,data.byteLength),kind==='indices'?34963:kind==='ibm'?undefined:34962);accessors.push(acc);remap.set(key,accessors.length-1);return accessors.length-1;};
  for(const m of json.meshes)for(const p of m.primitives){for(const k of Object.keys(p.attributes)){if(!KEEP.has(k)){delete p.attributes[k];continue;}p.attributes[k]=add(p.attributes[k],k);}if(p.indices!=null)p.indices=add(p.indices,'indices');delete p.targets;}
  for(const s of json.skins||[])if(s.inverseBindMatrices!=null)s.inverseBindMatrices=add(s.inverseBindMatrices,'ibm');
  json.images=json.images.map((im)=>{const v=json.bufferViews[im.bufferView],png=bin.subarray(v.byteOffset,v.byteOffset+v.byteLength);return {bufferView:push(webp(png)),mimeType:'image/webp'};});
  json.textures=json.textures.map((t)=>{const o={extensions:{EXT_texture_webp:{source:t.source}}};if(t.sampler!=null)o.sampler=t.sampler;return o;});
  delete json.animations;json.accessors=accessors;json.bufferViews=views;json.buffers=[{byteLength:off}];
  json.extensionsUsed=[...new Set([...(json.extensionsUsed||[]),'EXT_texture_webp'])];json.extensionsRequired=[...new Set([...(json.extensionsRequired||[]),'EXT_texture_webp'])];
  for(const mat of json.materials||[])if(mat.extras)delete mat.extras;
  const glb=writeGlb(json,Buffer.concat(chunks));fs.writeFileSync(path.join(OUT,ag+'.glb'),glb);return {json,bytes:glb.length};
}

// ---- quaternion helpers ([x,y,z,w]) ----
const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qinv=(a)=>[-a[0],-a[1],-a[2],a[3]],qnorm=(a)=>{const l=Math.hypot(...a)||1;return a.map((x)=>x/l);};
const qdist=(a,b)=>Math.min(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2],a[3]-b[3]),Math.hypot(a[0]+b[0],a[1]+b[1],a[2]+b[2],a[3]+b[3]));
// Rest hierarchy of a GLB: name -> {parent name, rest local quaternion}
function hierarchy(json){const parent={};json.nodes.forEach((n,i)=>(n.children||[]).forEach((c)=>parent[c]=i));const by={};json.nodes.forEach((n,i)=>{by[n.name]={i,parent:parent[i]==null?null:json.nodes[parent[i]].name,rest:n.rotation||[0,0,0,1]};if(n.matrix)throw new Error('matrix nodes unsupported: '+n.name);});return by;}
// Bone-world rotations for every frame of a clip from its local tracks (unanimated ancestors stay at rest).
function worlds(H,clip,bones){const frames=clip.tracks[0].times.length,out=bones.map(()=>[]);const ti={};clip.tracks.forEach((t)=>{if(t.type==='quaternion')ti[t.name.split('.')[0]]=t;});
  for(let f=0;f<frames;f++){const memo={};const W=(name)=>{if(name==null)return [0,0,0,1];if(memo[name])return memo[name];const h=H[name],t=ti[name],l=t?t.values.slice(f*4,f*4+4):h.rest;return memo[name]=qnorm(qmul(W(h.parent),l));};bones.forEach((b,k)=>out[k].push(W(b)));}return out;}

function buildLocomotion(models){
  const data={},H={};for(const ag of AGENTS){data[ag]=JSON.parse(fs.readFileSync(path.join(SRC,ag+'-locomotion.json')));H[ag]=hierarchy(models[ag].json);}
  const ref=data.jett,clips=ref.map((c)=>c.name),bones=ref[0].tracks.filter((t)=>t.type==='quaternion').map((t)=>t.name.split('.')[0]);
  for(const ag of AGENTS){const d=data[ag];if(d.map((c)=>c.name).join()!==clips.join())throw new Error(ag+': clip set differs');d.forEach((c,i)=>{const names=c.tracks.map((t)=>t.name).sort().join();if(names!==ref[i].tracks.map((t)=>t.name).sort().join()||c.tracks.map((t)=>t.name).join()!==d[0].tracks.map((t)=>t.name).join())throw new Error(ag+' '+c.name+': track set differs');if(c.tracks.some((t)=>t.times.join()!==ref[i].tracks[0].times.join()))throw new Error(ag+' '+c.name+': key times differ');});}
  const floats=[],pushF=(arr)=>{const at=floats.length;for(const x of arr)floats.push(x);return at;};
  // Shared part: Jett's bone-world rotations (sign-continuous per bone).
  const baseW=ref.map((c)=>worlds(H.jett,c,bones));
  const header={version:1,bones,clips:ref.map((c,i)=>{const times=c.tracks[0].times;baseW[i].forEach((frames)=>{for(let f=1;f<frames.length;f++){const a=frames[f-1],b=frames[f];if(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]<0)frames[f]=b.map((x)=>-x);}});
    return {name:c.name,duration:c.duration,frames:times.length,times:pushF(times),world:pushF(baseW[i].flatMap((frames)=>frames.flat()))};}),agents:{}};
  let worst=0;
  for(const ag of AGENTS){const d=data[ag],W0=worlds(H[ag],d[0],bones),D=bones.map((b,k)=>qnorm(qmul(qinv(baseW[0][k][0]),W0[k][0])));
    // Verify: every stored local rotation is reproduced by inv(parentWorld) * baseWorld * D.
    d.forEach((c,i)=>{const Wa=worlds(H[ag],c,bones);bones.forEach((b,k)=>{for(let f=0;f<c.tracks[0].times.length;f++){const want=Wa[k][f],got=qmul(baseW[i][k][f],D[k]);worst=Math.max(worst,qdist(want,got));}});});
    const lift=(d.find((c)=>c.contactLift)||{}),pel=d.map((c)=>{const t=c.tracks.find((x)=>x.name==='Pelvis.position');return t?pushF(t.values):-1;});
    header.agents[ag]={order:d[0].tracks.map((t)=>t.name),offset:D.map((q)=>q.map((x)=>+x.toFixed(8))),pelvis:pel,contactProbes:d[0].contactProbes||[],contactLift:lift.contactLift?{clip:lift.name,times:lift.contactLift.times,values:lift.contactLift.values}:null};}
  if(worst>2e-4)throw new Error('locomotion reconstruction error '+worst);
  header.floats=floats.length;const bin=Buffer.from(Float32Array.from(floats).buffer);fs.writeFileSync(path.join(OUT,'locomotion.bin'),bin);fs.writeFileSync(path.join(OUT,'locomotion.json'),JSON.stringify(header));
  return {worst,bin:bin.length,json:fs.statSync(path.join(OUT,'locomotion.json')).size};
}

if(require.main===module){
  fs.mkdirSync(OUT,{recursive:true});const models={},report={};
  for(const ag of AGENTS){models[ag]=buildModel(ag);report[ag]=[fs.statSync(path.join(SRC,ag+'.glb')).size,models[ag].bytes];}
  const loco=buildLocomotion(models);
  const files={};for(const f of AGENTS.map((a)=>a+'.glb').concat(['locomotion.json','locomotion.bin'])){const b=fs.readFileSync(path.join(OUT,f));files[f]={bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};}
  fs.writeFileSync(path.join(OUT,'manifest.js'),'// Generated by work/build_agent_assets.cjs. Runtime agent assets: byte sizes and SHA-256 (cache keys, integrity).\nwindow.VALORANT_AGENT_FILES = '+JSON.stringify({version:1,files})+';\n');
  console.log(JSON.stringify({models:report,locomotion:loco},null,1));
}
module.exports={readGlb,hierarchy,worlds,qmul,qinv,qdist,AGENTS};
