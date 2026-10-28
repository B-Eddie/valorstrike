// Native map decals/floaters: every port exports Decal_/Floater_ materials as OPAQUE although their textures carry
// the cut-out in alpha, so white destruction/edge-wear masks drew as solid white jagged patches on walls (Lotus
// attacker spawn) and murals drew as rectangles. Checks the loader routes every material through nmDecalStyle,
// classifies the real textures of all six maps, and the applied material is blended, offset and grime-tinted.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sharp=require(path.join(root,'server/node_modules/sharp')),THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
assert(/const st=m\.map&&nmTexStats\(m\.map\.image\);nmDecalApply\(out,nmDecalStyle\(m\.name,st\)\);nmFoliageApply\(out,m\.name,st\);(?:nmGroundApply\(out,m\.name,st\);)?(?:if\(miss&&\(out\.alphaTest>0\|\|out\.transparent.*?\)\)\{out\.visible=false;[^}]*\}(?:\/\*[^*]*\*\/)+)?return out;/.test(src),'map material converter does not apply decal/foliage handling');
assert(html.includes('function nmDecalStyle(name,stats)'),'decal handling missing from the generated page');
const line=re=>{const m=src.match(re);assert(m,'missing '+re);return m[0];};const pick=(n)=>{const a=src.indexOf('function '+n+'(');return src.slice(a,src.indexOf('\n',a));};
let raw=null;const document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:raw})})})};
const ctx=vm.createContext({document,Math});vm.runInContext(line(/^var NM_ZBIAS=.*;$/m)+'\n'+line(/^var NM_ZLEVELS=.*;$/m)+'\n'+(src.match(/^var NM_OVERLAY=.*;$/m)||[''])[0]+'\n'+['nmTexStats','nmDecalStyle','nmDecalApply','nmFoliageCut','nmFoliageApply'].map(pick).join('\n')+';globalThis.api={nmTexStats,nmDecalStyle,nmDecalApply,nmFoliageCut,nmFoliageApply};',ctx);
const {nmTexStats,nmDecalStyle,nmDecalApply,nmFoliageCut,nmFoliageApply}=ctx.api;
(async()=>{const seen={},cutout={};
 for(const key of ['ascent','bind','breeze','haven','lotus','split']){const dir=path.join(root,'models/valorant/maps',key),g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8'));
  for(const m of g.materials){const t=m.pbrMetallicRoughness&&m.pbrMetallicRoughness.baseColorTexture;if(!t||!/Decal|Floater/i.test(m.name))continue;
   const file=path.join(dir,g.images[g.textures[t.index].source].uri);raw=new Uint8ClampedArray(await sharp(file).ensureAlpha().resize(16,16,{fit:'fill'}).raw().toBuffer());
   seen[key+'/'+m.name]=nmDecalStyle(m.name,nmTexStats({width:16}));}
  // Foliage (#vines): every material with a texture, opaque in the export, classified for an alpha cut-out.
  for(const m of g.materials){const t=m.pbrMetallicRoughness&&m.pbrMetallicRoughness.baseColorTexture;if(!t||m.alphaMode&&m.alphaMode!=='OPAQUE')continue;
   const file=path.join(dir,g.images[g.textures[t.index].source].uri);raw=new Uint8ClampedArray(await sharp(file).ensureAlpha().resize(16,16,{fit:'fill'}).raw().toBuffer());
   cutout[key+'/'+m.name]=nmFoliageCut(m.name,nmTexStats({width:16}));}}
 // Vines, moss overgrowth, creepers, leaves and plants with real alpha cut out; blended walls/floors, trunks, pots and lamps do not.
 for(const k of ['lotus/VinesTech_0_M0_CablesMoss_MI','lotus/Plant_1_M1_MossOvergrowthVines_MI','lotus/Plant_1_M1_MossOvergrowth_MI','lotus/Plant_0_M0_Creeper_MI','lotus/Plant_3_M0_Fern_MI','lotus/Tree_0_M0_VistaTreeLeaf_MI','haven/Plant_0_M0_Bush_MI','breeze/Plant_0_M0_MorningGlory_MI','split/Tree_3_M2_Conifer_MI','bind/Tree_1_M0_PalmA_MI','ascent/PlantPotted_0_M0_A_MI'])assert.equal(cutout[k],true,k+' should cut out');
 for(const k of ['lotus/Stone_M0_WallExteriorAMossBlend_MI','lotus/Rock_8_M1_RockWallAMoss_MI','lotus/Stone_M0_FloorBlendMoss_MI','lotus/Tile_M11_TempleFloorMossBlend_MI','lotus/Tree_1_M0_VistaTreeTrunkA_MI','ascent/TreeBark_M1_Striation_MI','split/Light_1_M0_SphereStreetLight_MI','lotus/Petals_M0_PetalsWall_MI','split/Planter_0_M0_AMasked_MI','ascent/Glass_M0_StainGlassFlowerMetal_MI'])assert.equal(cutout[k],false,k+' must stay opaque');
 const leaf=nmFoliageApply(new THREE.MeshLambertMaterial(),'Vines_0_M0_BigVinesMoss_MI',{cut:.3});assert.equal(leaf.alphaTest,.45);assert.equal(leaf.transparent,false,'cut-out, not blended (keeps depth sorting)');
 assert.equal(nmFoliageApply(new THREE.MeshLambertMaterial(),'Vines_0_M0_BigVinesMoss_MI',null).alphaTest,0,'unreadable texture stays opaque');
 const dec2=nmFoliageApply(nmDecalApply(new THREE.MeshLambertMaterial(),'decal'),'Decal_Flower',{cut:.5});assert.equal(dec2.alphaTest,.02,'decals keep their own handling');
 // The reported Lotus patches and the same masks on other maps become grime, not white paint.
 for(const k of ['lotus/Floater_26_M1_EdgeWear_MI','lotus/Floater_12_M0_RockWallDamage_MI1','ascent/Floater_1_M0_EdgeDestructionDecal_MI','haven/Floater_12_M0_PlasterDestruction_MI','split/Floater_12_M0_PlasterDestruction_MI'])assert.equal(seen[k],'mask',k+' '+seen[k]);
 // Coloured decals (and white site lettering, which is a Decal, not a Floater) keep their colour but get alpha.
 for(const k of ['ascent/Decal_0_M4_LionMural_MI','bind/Decal_M0_UrbanArtA_MI','breeze/B_0_M0_Decal_MI','bind/Floater_9_M0_BrickDamageC_MI'])assert.equal(seen[k],'decal',k+' '+seen[k]);
 // Fully opaque textures stay opaque (signs, a whole plaster wall material).
 for(const k of ['ascent/Decal_0_M2_FishMarketSignA_MI','haven/Brick_M0_BrickFloaterPlaster_MI'])assert.equal(seen[k],null,k+' '+seen[k]);
 assert.equal(nmDecalStyle('Stone_M0_WallExteriorAMossBlend_MI',{minAlpha:2,white:0}),null,'non-decal walls untouched');
 assert.equal(nmDecalStyle('Floater_X',null),null,'unreadable texture falls back to the old opaque material');
 const mask=nmDecalApply(new THREE.MeshLambertMaterial({color:0xffffff}),'mask');assert(mask.transparent&&!mask.depthWrite&&mask.polygonOffset&&mask.polygonOffsetFactor===0&&mask.polygonOffsetUnits===-24&&mask.alphaTest>0,'decals: depth-step bias only, one level above the top z-fight level ((5+1) x NM_ZBIAS 4: at level 2 they tied with level-2 walls and lost to level 3-5 walls, test_map_flicker), no slope-scaled factor (test_map_vanish)');
 assert(mask.color.r<.3&&mask.opacity<1,'mask still renders bright');
 const dec=nmDecalApply(new THREE.MeshLambertMaterial({color:0xffffff}),'decal');assert(dec.transparent&&!dec.depthWrite&&dec.color.r===1&&dec.opacity===1);
 const keep=new THREE.MeshLambertMaterial();assert.equal(nmDecalApply(keep,null).transparent,false);
 console.log('map decals ok:',Object.values(seen).filter(v=>v==='mask').length,'masks,',Object.values(seen).filter(v=>v==='decal').length,'decals,',Object.values(seen).filter(v=>v===null).length,'opaque;',Object.values(cutout).filter(Boolean).length,'foliage cut-outs');if(process.env.LIST)console.log(Object.keys(cutout).filter(k=>cutout[k]).join('\n'));
})().catch(e=>{console.error(e);process.exit(1);});
