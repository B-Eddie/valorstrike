// Wall overlays must not render as black silhouettes (#blackwalls, user: "theres the black glitching thing on the walls.
// fix it once and for all"). Ascent's Caffe Volante mural (Decal_0_M4_Coffee_MI) and the ivy cards (Foliage_9_M0_Ivy_MI)
// drew as near-black shapes on shaded plaster (sampled 21,22,36 and 11,21,6 next to plaster 120,127,146): normals,
// winding, lighting and the texture upload were all fine (unlit they drew correct grey cups / green ivy, a white Lambert in
// their place lit like the wall) - their own albedo is dark (paint ~0.1 linear at full alpha, ivy ~0.07 with the export's
// 0.53 tint) and the shaded side of a map only gets the hemisphere fill. This runs every Decal_/Floater_/foliage material
// of the six maps through the page's own converter (nmPrepareScene with the real 16x16 texture statistics, as the page's
// nmTexStats reads them) and checks the mean linear albedo of every painted decal and wall-ivy card is >= 0.17, i.e. a
// shaded wall shows it at >= ~50/255 instead of ~20; grime masks, Floater_ overlays (potholes, hay), "Shadow" vines and every
// other material keep their colour.
//   node work/test_map_overlay_dark.cjs        (RT=path runs it against another runtime file)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const sharp=require(path.join(root,'server/node_modules/sharp'));
const RT=fs.readFileSync(process.env.RT||path.join(__dirname,'native_maps_runtime.js'),'utf8');
const fn=name=>{const m=new RegExp('^function '+name+'\\(.*$','m').exec(RT);assert(m,'runtime has function '+name);return m[0];};
const vars=(RT.match(/^var NM_(?:TERRAIN|ZBIAS|ZLEVELS)=.*$/mg)||[]).join('\n');
const opt=['nmTerrain','nmTexMissingMark'].filter(n=>new RegExp('^function '+n+'\\(','m').test(RT)).map(fn);
let raw=null;const document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:raw})})})};
const ctx={THREE,document,Math,renderer:{capabilities:{getMaxAnisotropy:()=>16}},console};vm.createContext(ctx);
vm.runInContext([vars,...opt,...['nmTexStats','nmDecalStyle','nmFoliageCut','nmFoliageApply','nmDecalApply','nmPrepareScene'].map(fn)].join('\n')+'\nglobalThis.api={nmPrepareScene};',ctx);
const TEX=new Map();const lin=v=>(v/=255)<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
(async()=>{let checked=0,lifted=0;const fails=[],kept=[];
 for(const key of ['ascent','bind','breeze','haven','lotus','split']){const dir=path.join(root,'models/valorant/maps',key),g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8'));
  for(const d of g.materials){const pbr=d.pbrMetallicRoughness||{},t=pbr.baseColorTexture;if(!t||!/Decal|Floater|Ivy|Creeper|Vines|Foliage|Plant(?!er)|Leaf|Leaves|Moss/i.test(d.name))continue;
   const file=path.join(dir,g.images[g.textures[t.index].source].uri);if(!fs.existsSync(file))continue;
   const r16=TEX.get(file)||new Uint8ClampedArray(await sharp(file).ensureAlpha().resize(16,16,{fit:'fill'}).raw().toBuffer());TEX.set(file,r16);
   // as GLTFLoader builds it: baseColorFactor (linear) as colour, MASK -> alphaTest
   const f=pbr.baseColorFactor||[1,1,1,1];const m=new THREE.MeshStandardMaterial({name:d.name,color:new THREE.Color(f[0],f[1],f[2]),alphaTest:d.alphaMode==='MASK'?(d.alphaCutoff!=null?d.alphaCutoff:.5):0,transparent:d.alphaMode==='BLEND'});
   m.map=new THREE.Texture({width:16,height:16});const mesh=new THREE.Mesh(new THREE.BufferGeometry(),m),root2=new THREE.Group();root2.add(mesh);
   raw=r16;ctx.api.nmPrepareScene(root2);const out=mesh.material;
   // mean linear albedo of the covered texels x material colour (what Lambert multiplies the light by)
   let s=0,n=0;for(let i=0;i<r16.length;i+=4)if(r16[i+3]>32){s+=.2126*lin(r16[i])+.7152*lin(r16[i+1])+.0722*lin(r16[i+2]);n++;}
   const tex=n?s/n:0,c=out.color,alb=tex*(.2126*c.r+.7152*c.g+.0722*c.b);
   const overlay=out.userData.decal==='decal'&&/Decal/i.test(d.name)||(out.alphaTest>0&&/Ivy|Creeper/i.test(d.name)&&!/Shadow/i.test(d.name));
   if(overlay){checked++;if(out.userData.nmLift)lifted++;if(alb<.17-1e-6)fails.push(`${key}/${d.name} albedo ${alb.toFixed(3)} (texture ${tex.toFixed(3)} x colour ${c.getHexString()})`);}
   else{const c0=new THREE.Color(f[0],f[1],f[2]);if(Math.abs(c.r-c0.r)+Math.abs(c.g-c0.g)+Math.abs(c.b-c0.b)>1e-6&&!/mask/.test(out.userData.decal||''))kept.push(`${key}/${d.name} colour changed ${c0.getHexString()} -> ${c.getHexString()}`);}}}
 assert(checked>=20,'found the wall overlays (painted decals + ivy) on the six maps: '+checked);
 assert.deepEqual(fails,[],'wall overlays render near-black (mean linear albedo < 0.17):\n  '+fails.join('\n  '));
 assert.deepEqual(kept,[],'materials that are not wall overlays must keep their colour');
 console.log(`test_map_overlay_dark: ${checked} wall overlays (painted decals + ivy) on 6 maps, ${lifted} lifted to albedo >= 0.17 - ok`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
