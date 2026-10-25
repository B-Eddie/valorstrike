// Native map decals/floaters: every port exports Decal_/Floater_ materials as OPAQUE although their textures carry
// the cut-out in alpha, so white destruction/edge-wear masks drew as solid white jagged patches on walls (Lotus
// attacker spawn) and murals drew as rectangles. Checks the loader routes every material through nmDecalStyle,
// classifies the real textures of all six maps, and the applied material is blended, offset and grime-tinted.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sharp=require(path.join(root,'server/node_modules/sharp')),THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
assert(/nmDecalApply\(out,nmDecalStyle\(m\.name,m\.map&&nmTexStats\(m\.map\.image\)\)\);return out;/.test(src),'map material converter does not apply decal handling');
assert(html.includes('function nmDecalStyle(name,stats)'),'decal handling missing from the generated page');
const pick=(n)=>{const a=src.indexOf('function '+n+'(');return src.slice(a,src.indexOf('\n',a));};
let raw=null;const document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:raw})})})};
const ctx=vm.createContext({document,Math});vm.runInContext(['nmTexStats','nmDecalStyle','nmDecalApply'].map(pick).join('\n')+';globalThis.api={nmTexStats,nmDecalStyle,nmDecalApply};',ctx);
const {nmTexStats,nmDecalStyle,nmDecalApply}=ctx.api;
(async()=>{const seen={};
 for(const key of ['ascent','bind','breeze','haven','lotus','split']){const dir=path.join(root,'models/valorant/maps',key),g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8'));
  for(const m of g.materials){const t=m.pbrMetallicRoughness&&m.pbrMetallicRoughness.baseColorTexture;if(!t||!/Decal|Floater/i.test(m.name))continue;
   const file=path.join(dir,g.images[g.textures[t.index].source].uri);raw=new Uint8ClampedArray(await sharp(file).ensureAlpha().resize(16,16,{fit:'fill'}).raw().toBuffer());
   seen[key+'/'+m.name]=nmDecalStyle(m.name,nmTexStats({width:16}));}}
 // The reported Lotus patches and the same masks on other maps become grime, not white paint.
 for(const k of ['lotus/Floater_26_M1_EdgeWear_MI','lotus/Floater_12_M0_RockWallDamage_MI1','ascent/Floater_1_M0_EdgeDestructionDecal_MI','haven/Floater_12_M0_PlasterDestruction_MI','split/Floater_12_M0_PlasterDestruction_MI'])assert.equal(seen[k],'mask',k+' '+seen[k]);
 // Coloured decals (and white site lettering, which is a Decal, not a Floater) keep their colour but get alpha.
 for(const k of ['ascent/Decal_0_M4_LionMural_MI','bind/Decal_M0_UrbanArtA_MI','breeze/B_0_M0_Decal_MI','bind/Floater_9_M0_BrickDamageC_MI'])assert.equal(seen[k],'decal',k+' '+seen[k]);
 // Fully opaque textures stay opaque (signs, a whole plaster wall material).
 for(const k of ['ascent/Decal_0_M2_FishMarketSignA_MI','haven/Brick_M0_BrickFloaterPlaster_MI'])assert.equal(seen[k],null,k+' '+seen[k]);
 assert.equal(nmDecalStyle('Stone_M0_WallExteriorAMossBlend_MI',{minAlpha:2,white:0}),null,'non-decal walls untouched');
 assert.equal(nmDecalStyle('Floater_X',null),null,'unreadable texture falls back to the old opaque material');
 const mask=nmDecalApply(new THREE.MeshLambertMaterial({color:0xffffff}),'mask');assert(mask.transparent&&!mask.depthWrite&&mask.polygonOffset&&mask.polygonOffsetFactor<0&&mask.alphaTest>0);
 assert(mask.color.r<.3&&mask.opacity<1,'mask still renders bright');
 const dec=nmDecalApply(new THREE.MeshLambertMaterial({color:0xffffff}),'decal');assert(dec.transparent&&!dec.depthWrite&&dec.color.r===1&&dec.opacity===1);
 const keep=new THREE.MeshLambertMaterial();assert.equal(nmDecalApply(keep,null).transparent,false);
 console.log('map decals ok:',Object.values(seen).filter(v=>v==='mask').length,'masks,',Object.values(seen).filter(v=>v==='decal').length,'decals,',Object.values(seen).filter(v=>v===null).length,'opaque');
})().catch(e=>{console.error(e);process.exit(1);});
