// Texture stats table (iOS map-prepare kill 2026-11-03: nmTexStats' drawImage kept a full decode of every map texture resident
// on the WebKit <img> path, +279 MB RSS in nmPrepareScene). nmPrepareScene takes each map texture's stats from
// models/valorant/maps/<map>/texstats.json (work/build_map_texstats.cjs, the same nmTexStats in headless Chromium) and computes
// them at runtime only for a texture missing from the table or of another size in pixels.
//  1. per map: the table was made by this nmTexStats (code = sha256/16 of its source = NM_TEXSTATS.code); every base-colour
//     texture a material of scene.gltf names has an entry; each entry's bytes / sha256 / PNG width x height match the file
//     (a texture that changed fails here: rerun work/build_map_texstats.cjs and its VERIFY=1 Chromium equality run);
//  2. wiring: nmLoadScene fetches the table beside the glTF and tags textures (nmTexUriMark) before nmParserRelease;
//     nmPrepareScene uses nmTexStatsOf and drops the table after;
//  3. nmTexStatsOf: a table hit returns the entry without drawing; a texture missing from the table, of another size, untagged,
//     or with the table off is computed by nmTexStats; nmTexTableFetch drops a table made by another nmTexStats;
//  4. nmTexUriMark maps a material's texture to its image file through the parser associations;
//  5. nmTexStats empties its 16x16 canvas once read (the runtime fallback holds no canvas backing store).
//   node work/test_map_texstats.cjs
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const sha16=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,16);
const pick=n=>{const i=src.indexOf('function '+n+'(');assert(i>=0,n+' missing');return src.slice(i,src.indexOf('\n',i));};
const CODE=sha16(pick('nmTexStats')),rt=/var NM_TEXSTATS=\{on:true,code:'([0-9a-f]{16})'/.exec(src);
assert(rt,'NM_TEXSTATS missing');assert.equal(rt[1],CODE,'NM_TEXSTATS.code is not the sha256/16 of nmTexStats: rerun work/build_map_texstats.cjs');
// 1. tables
const MAPS=['ascent','bind','breeze','haven','lotus','split'];let total=0;
for(const m of MAPS){const dir=path.join(root,'models/valorant/maps',m),T=JSON.parse(fs.readFileSync(path.join(dir,'texstats.json'),'utf8')),g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8'));
 assert.equal(T.code,CODE,m+': table made by another nmTexStats');const need=new Set();
 for(const mat of g.materials||[]){const t=mat.pbrMetallicRoughness&&mat.pbrMetallicRoughness.baseColorTexture;if(!t)continue;const im=g.images[g.textures[t.index].source];need.add(im.uri.split('/').pop());}
 for(const f of need){const e=T.t[f];assert(Array.isArray(e)&&e.length===11,m+': '+f+' not in texstats.json');const b=fs.readFileSync(path.join(dir,'textures',f));
  assert.equal(e[2],b.length,m+': '+f+' size changed since the table was built');assert.equal(e[3],sha16(b),m+': '+f+' content changed since the table was built');
  assert.equal(b.readUInt32BE(12),0x49484452,m+': '+f+' not a PNG');assert.deepEqual([e[0],e[1]],[b.readUInt32BE(16),b.readUInt32BE(20)],m+': '+f+' size in pixels');
  for(let i=4;i<11;i++)assert(typeof e[i]==='number'&&isFinite(e[i]),m+': '+f+' stat '+i);}
 total+=need.size;}
// 2. wiring
const L=pick('nmLoadScene'),P=pick('nmPrepareScene');
assert(/const ts=nmTexTableFetch\(base\)/.test(L),'nmLoadScene fetches the table');assert(L.indexOf('nmTexUriMark(gl)')>=0&&L.indexOf('nmTexUriMark(gl)')<L.indexOf('nmParserRelease(gl)'),'textures tagged before the parser is released');
assert(/Promise\.all\(\[nmDetailFetch\(base\),ts\]\)/.test(L)&&/userData\.nmTexTable=t/.test(L),'table handed to the scene');
assert(/nmTexStatsOf\(m\.map,T\)/.test(P)&&!/nmTexStats\(m\.map/.test(P),'nmPrepareScene uses the table');assert(/delete root\.userData\.nmTexTable/.test(P),'table dropped after prepare');
// 3-5. behaviour
const draws=[];const canv=[];
const c={console,Object,Array,Number,Math,JSON,Promise,document:{createElement(){const cv={width:300,height:150,getContext(){return {drawImage(img){draws.push(img);},getImageData(x,y,w,h){const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<d.length;i+=4){d[i]=d[i+1]=d[i+2]=200;d[i+3]=i%8?255:0;}return {data:d};}};}};canv.push(cv);return cv;}}};
vm.createContext(c);vm.runInContext(['var NM_TEXSTATS='+/var NM_TEXSTATS=(\{[^}]*\})/.exec(src)[1]+';',pick('nmTexStats'),pick('nmTexStatsOf'),pick('nmTexTableFetch'),pick('nmTexUriMark')].join('\n'),c);
const img={width:64,height:32},row=[64,32,10,'x',7,.5,.25,3,9,100,.4],T={code:CODE,t:{'a.png':row}};
const hit=c.nmTexStatsOf({image:img,userData:{nmUri:'a.png'}},T);assert.deepEqual(JSON.parse(JSON.stringify(hit)),{minAlpha:7,white:.5,cut:.25,lum:3,alpha:9,am:100,lin:.4});assert.equal(draws.length,0,'a table hit draws nothing');
const ref=c.nmTexStats(img);draws.length=0;assert(ref&&ref.cut===.5,'runtime stats');assert.equal(canv[canv.length-1].width,0,'runtime canvas emptied');assert.equal(canv[canv.length-1].height,0);
for(const [why,tex,tab] of [['missing',{image:img,userData:{nmUri:'b.png'}},T],['other size',{image:{width:32,height:32},userData:{nmUri:'a.png'}},T],['untagged',{image:img,userData:{}},T],['no table',{image:img,userData:{nmUri:'a.png'}},null],['__proto__',{image:img,userData:{nmUri:'__proto__'}},T]]){
 draws.length=0;const r=c.nmTexStatsOf(tex,tab);assert.equal(draws.length,1,why+': computed at runtime');assert(r&&r.cut===.5,why);}
c.NM_TEXSTATS.on=false;draws.length=0;c.nmTexStatsOf({image:img,userData:{nmUri:'a.png'}},T);assert.equal(draws.length,1,'table off: runtime');c.NM_TEXSTATS.on=true;
(async()=>{
 for(const [body,ok] of [[{code:CODE,t:{}},true],[{code:'0000000000000000',t:{}},false],[null,false]]){c.fetch=()=>Promise.resolve({ok:!!body,json:()=>Promise.resolve(body)});const t=await c.nmTexTableFetch('x/');assert.equal(!!t,ok,'table code check '+JSON.stringify(body&&body.code));}
 c.fetch=()=>Promise.reject(new Error('net'));assert.equal(await c.nmTexTableFetch('x/'),null,'fetch failure: no table');
 const tex1={userData:{}},tex2={userData:{}},A=new Map([[tex1,{textures:1}],[tex2,{textures:0}]]);
 const mesh=(map)=>({isMesh:true,material:{map}}),sc={traverse(f){[mesh(tex1),mesh(tex2),{isMesh:true,material:[{map:null}]}].forEach(f);}};
 const n=c.nmTexUriMark({scene:sc,parser:{json:{textures:[{source:1},{source:0}],images:[{uri:'textures/aa.png'},{uri:'textures/bb.png'}]},associations:A}});
 assert.equal(n,2);assert.equal(tex1.userData.nmUri,'aa.png');assert.equal(tex2.userData.nmUri,'bb.png');
 console.log('texture stats table: '+total+' map textures across '+MAPS.length+' maps match their files and nmTexStats ('+CODE+'); table hit / fallback / tagging ok');
})().catch(e=>{console.error(e);process.exit(1);});
