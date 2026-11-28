// Rocklan first-person ability animations (fan-extracted pack) -> donor glb for work/ability_fp_runtime.js.
// Same direct ActorX PSA parsing as work/build_rocklan_movement.cjs; target rig is the agent's native FP arms
// (models/valorant/<agent>-fp.glb), whose bone names match the pack 104/104 for Jett (verified).
// LOCAL ONLY: the output glb is a converted copied asset and must not be committed or published.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {T,parse}=require('./valorant_rigs');
const ROOT=path.join(__dirname,'..');
const SRC=process.env.ROCKLAN_FP||'/home/sandbox/rocklan/jett-fp';
const AGENT=process.env.ROCKLAN_AGENT||'jett';
const OUT=path.join(ROOT,'models/valorant/animations','fp-rocklan-'+AGENT+'.glb');
const EXCLUDE=/^(Camera|Camera_Root|VFX|VFX_Camera|Splitter)$/;
const cache=new Map();
function readPSA(name){
 const file=path.join(SRC,name+'.psa');if(cache.has(file))return cache.get(file);
 if(!fs.existsSync(file))throw Error('missing '+file);
 const b=fs.readFileSync(file),chunks={};let offset=0;
 while(offset<b.length){
  if(offset+32>b.length)throw Error('Truncated PSA header: '+name);
  const id=b.toString('utf8',offset,offset+20).replace(/\0.*$/,''),size=b.readInt32LE(offset+24),count=b.readInt32LE(offset+28);offset+=32;
  if(size<0||count<0||offset+size*count>b.length)throw Error('Invalid PSA chunk: '+name);
  chunks[id]={size,count,data:b.subarray(offset,offset+size*count)};offset+=size*count;
 }
 const bn=chunks.BONENAMES,an=chunks.ANIMINFO,ky=chunks.ANIMKEYS;
 if(!bn||!an||!ky||an.count!==1||ky.size!==32)throw Error('Unsupported PSA: '+name);
 const names=Array.from({length:bn.count},(_,i)=>bn.data.toString('utf8',i*bn.size,i*bn.size+64).replace(/\0.*$/,''));
 const fps=an.data.readFloatLE(152),frames=an.data.readInt32LE(164),first=an.data.readInt32LE(160);
 if(!(fps>0&&frames>0)||ky.count<(first+frames)*bn.count)throw Error('Invalid PSA cadence: '+name);
 const r={name,file,names,index:Object.fromEntries(names.map((n,i)=>[n,i])),fps,frames,duration:(frames-1)/fps,
  sha256:crypto.createHash('sha256').update(b).digest('hex'),
  key(bone,frame){const i=this.index[bone];if(i==null)return null;const at=((first+Math.min(frames-1,Math.max(0,frame)))*names.length+i)*32;return Array.from({length:7},(_,j)=>ky.data.readFloatLE(at+j*4));}};
 cache.set(file,r);return r;
}
const rawQ=key=>key?new T.Quaternion(-key[3],-key[4],-key[5],key[6]).normalize():new T.Quaternion();
const rounded=x=>+x.toFixed(7);
function convert(name,scene){
 const source=readPSA(name);
 const bones=source.names.filter(n=>!EXCLUDE.test(n)&&scene.getObjectByName(n));
 const times=Array.from({length:source.frames},(_,f)=>f/source.fps);
 const q=new T.Quaternion();
 const tracks=[];
 for(const bone of bones){
  const values=[],pos=[];
  for(let f=0;f<source.frames;f++){const k=source.key(bone,f);q.copy(rawQ(k));values.push(...q.toArray().map(rounded));pos.push(rounded(k[0]/100),rounded(k[1]/100),rounded(k[2]/100));}
  tracks.push({name:bone+'.quaternion',type:'quaternion',times,values});
  tracks.push({name:bone+'.position',type:'vector',times,values:pos});
 }
 return {name:source.name,duration:Math.max(1/source.fps,source.duration),fps:source.fps,frames:source.frames,tracks};
}
function writeGLB(source,clips,file){
 const src=fs.readFileSync(source),length=src.readUInt32LE(12),j=JSON.parse(src.subarray(20,20+length));
 const nodes=j.nodes.map(n=>{const x={...n};delete x.mesh;delete x.skin;delete x.weights;return x;}),nodeIndex=Object.fromEntries(nodes.map((n,i)=>[n.name,i]));
 const buffers=[],bufferViews=[],accessors=[];let byteOffset=0;
 const push=(values,type)=>{const data=Buffer.from(Float32Array.from(values).buffer),view=bufferViews.length;bufferViews.push({buffer:0,byteOffset,byteLength:data.length});buffers.push(data);byteOffset+=data.length;
  const a={bufferView:view,componentType:5126,count:values.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),type};if(type==='SCALAR'){a.min=[values[0]];a.max=[values.at(-1)];}accessors.push(a);return accessors.length-1;};
 const animations=clips.map(c=>{const samplers=[],channels=[];for(const track of c.tracks){const bone=track.name.split('.')[0];if(nodeIndex[bone]==null)throw Error('Missing bone '+bone);samplers.push({input:push(track.times,'SCALAR'),output:push(track.values,track.type==='vector'?'VEC3':'VEC4'),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:nodeIndex[bone],path:track.type==='vector'?'translation':'rotation'}});}return {name:c.name,samplers,channels};});
 const output={asset:{version:'2.0',generator:'Rocklan direct PSA baked FP curves'},scene:j.scene||0,scenes:j.scenes,nodes,animations,accessors,bufferViews,buffers:[{byteLength:byteOffset}],extras:{source:'Rocklan fan-extracted pack; not official Riot data'}};
 let json=Buffer.from(JSON.stringify(output));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(buffers),header=Buffer.alloc(20),bh=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(file,Buffer.concat([header,json,bh,bin]));
}
(async()=>{
 const wanted=fs.readdirSync(SRC).filter(f=>f.endsWith('.psa')).map(f=>f.slice(0,-4));
 const rig=await parse(path.join(ROOT,'models/valorant',AGENT+'-fp.glb'));
 const clips=wanted.map(n=>convert(n,rig.scene));
 writeGLB(path.join(ROOT,'models/valorant',AGENT+'-fp.glb'),clips,OUT);
 const prov={source:'Rocklan FREE Valorant Blender 3D Model Pack (FP ability set, '+AGENT+'); fan-extracted reference, not official Riot data',conversion:'Direct ActorX PSA parsing, all matched arm/spine/hand bones (camera/root/splitter excluded), quaternion tracks only',localOnly:true,clips:clips.map(c=>({name:c.name,duration:c.duration,fps:c.fps,frames:c.frames,tracks:c.tracks.length})),sources:[...cache.values()].map(s=>({file:path.basename(s.file),sha256:s.sha256}))};
 fs.writeFileSync(OUT.replace(/\.glb$/,'.provenance.json'),JSON.stringify(prov,null,2));
 console.log('wrote',OUT,clips.length,'clips');
 for(const c of clips)console.log(' ',c.name,c.duration.toFixed(2)+'s',c.tracks.length,'bones');
})().catch(e=>{console.error(e);process.exitCode=1;});
