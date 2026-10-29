// vs-lane-groundblend (user, after groundalpha made Ascent's ground opaque: "Fix it" - the ground is a flat plain brown).
// The map export (work/export_native_map.py) keeps ONE base-colour texture per material and drops vertex colours and the
// source's layer-blend shader. The ground layers' textures are a flat colour in RGB (luminance std 1-7 / 255) with the
// whole surface pattern - stone chunks, tiles, herringbone bricks, leaf clumps - stored as a height / blend mask in ALPHA
// (std 10-110). Drawn opaque with RGB only (groundalpha), Ascent mid (Grass_M0_Dirtblend_A), the A garden and the
// Breeze / Lotus grass (Grass_M0_A_MI, *GravelGrass*) are one flat colour.
// Rule checked here on the REAL textures of all six maps (the page's own nmTexStats on a 16x16 read, as in the page) and
// the page's own nmPrepareScene on three.js objects shaped as GLTFLoader leaves them:
//   * every walkable ground layer with a flat-colour RGB and a height mask in alpha is drawn with that mask as its surface
//     detail (nmGroundApply: userData.groundLayer, an onBeforeCompile that samples the map's alpha), still opaque;
//     grass / moss blends also get their second layer (a grass or moss layer height-blended in by the mask);
//   * textured ground (RGB carries the detail) and every non-ground material are untouched; a ground layer whose texture
//     failed draws plain (no map, no layer shader);
//   * floor overlays exported OPAQUE whose alpha is their shape (puddles, tyre tracks, street paint, blood cards, masked
//     floor wires: 'overlay' in work/validation/map/ground-materials.json) are decals - alpha from the texture, blended,
//     no depth write, depth-step polygon offset (mapdouble/decal rule), no shadow; not drawn when their texture fails.
//   node work/test_map_ground_blend.cjs        (RT=path runs it against another runtime file)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const sharp=require(path.join(root,'server/node_modules/sharp'));
const RT=fs.readFileSync(process.env.RT||path.join(__dirname,'native_maps_runtime.js'),'utf8');
const has=name=>new RegExp('^function '+name+'\\(','m').test(RT);
const fn=name=>{const m=new RegExp('^function '+name+'\\(.*$','m').exec(RT);assert(m,'runtime has function '+name);return m[0];};
const vars=(RT.match(/^var NM_(?:TERRAIN|ZBIAS|ZLEVELS|OVERLAY|GROUND\w*)=.*$/mg)||[]).join('\n');
const opt=['nmTerrain','nmGroundLayer','nmGroundApply'].filter(has).map(fn);
let raw=null;const document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:raw})})})};
const ctx={THREE,document,renderer:{capabilities:{getMaxAnisotropy:()=>16}},console};vm.createContext(ctx);
vm.runInContext([vars,...opt,...['nmTexStats','nmDecalStyle','nmFoliageCut','nmFoliageApply','nmDecalApply','nmTexMissingMark','nmPrepareScene'].map(fn),'var nmTexStatsReal=nmTexStats;nmTexStats=function(img){return img&&img.st||null;};'].join('\n'),ctx);
const DATA=JSON.parse(fs.readFileSync(path.join(__dirname,'validation/map/ground-materials.json'),'utf8'));
// ground-layer families (surface materials), as opposed to wood / metal / plaster / props
const GROUND_NAME=/^(?:Grass|Dirt|Mud|Sand|Gravel|Blendable|Jam|Ash|Asphalt|Tile|Stone|StoneBrickWall|Brick|Bricks|Concrete|Rock|Cobble|Rubble)_/i;
const MAPS=['ascent','bind','breeze','haven','lotus','split'];
// a real three r147 lambert program, as WebGLPrograms hands it to onBeforeCompile
const LAMBERT={vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader,uniforms:{}};
// the page's own 16x16 statistics (fed to nmPrepareScene) + this test's own measure of the RGB / alpha detail
async function stats16(file){raw=new Uint8ClampedArray(await sharp(file).ensureAlpha().resize(16,16,{fit:'fill'}).raw().toBuffer());const st=vm.runInContext('nmTexStatsReal({width:16})',ctx);
 let sl=0,sl2=0,sa=0,sa2=0;for(let i=0;i<raw.length;i+=4){const l=.3*raw[i]+.59*raw[i+1]+.11*raw[i+2],a=raw[i+3];sl+=l;sl2+=l*l;sa+=a;sa2+=a*a;}const n=raw.length/4;
 return {st,own:{lum:Math.sqrt(Math.max(0,sl2/n-(sl/n)**2)),alpha:Math.sqrt(Math.max(0,sa2/n-(sa/n)**2)),am:sa/n}};}
function prepare(defs,names,stats,loaded){const json={materials:defs},assoc=new Map(),scene=new THREE.Group(),byName={};
 for(const nm of names){const i=defs.findIndex(d=>d.name===nm);assert(i>=0,'scene.gltf has material '+nm);const d=defs[i],pbr=d.pbrMetallicRoughness||{};
  const m=new THREE.MeshStandardMaterial({name:d.name});if(d.alphaMode==='MASK')m.alphaTest=d.alphaCutoff!=null?d.alphaCutoff:.5;if(d.alphaMode==='BLEND'){m.transparent=true;m.depthWrite=false;}
  if(pbr.baseColorTexture&&loaded){const t=new THREE.Texture({width:512,height:512,st:stats[nm]||null});t.encoding=THREE.sRGBEncoding;m.map=t;}
  assoc.set(m,{materials:i});const o=new THREE.Mesh(new THREE.PlaneGeometry(1,1),m);o.castShadow=true;o.name=nm;scene.add(o);byName[nm]=o;}
 ctx.gl={scene,parser:{json,associations:assoc}};vm.runInContext('nmTexMissingMark(gl);nmPrepareScene(gl.scene)',ctx);return byName;}
function compiled(m){const sh={vertexShader:LAMBERT.vertexShader,fragmentShader:LAMBERT.fragmentShader,uniforms:{}};if(typeof m.onBeforeCompile==='function')m.onBeforeCompile(sh,{});return sh;}
// flat-colour RGB + a real height mask in alpha (16x16 Lanczos read: layer textures RGB std <= 5, alpha std >= 9.8)
const flat=s=>!!(s&&s.lum<6&&s.alpha>=8&&s.am>=25);
(async()=>{const bad=[];const tally={layer:0,second:0,plain:0,overlay:0};const must={'ascent/Grass_M0_Dirtblend_A':'grass','ascent/Grass_M0_A_MI':'','breeze/Grass_M0_A_MI':'','lotus/Grass_M0_A_MI':'','lotus/Jam_M0_GravelGrass_MI':'grass','breeze/Blendable_M3_GravelGrassSat_MI':'grass','ascent/Stone_M4_StoneTileMossBlend':'moss','ascent/Brick_M6_HerringBoneBroken_MI':'','bind/Tile_M5_StarShape_MI':''};const seen={};
 for(const key of MAPS){const dir=path.join(root,'models/valorant/maps',key),g=JSON.parse(fs.readFileSync(path.join(dir,'scene.gltf'),'utf8')),defs=g.materials,D=DATA[key];
  const surf=defs.map(d=>d.name).filter(n=>/^Grass_M\d+_/i.test(n)&&!/Cards/i.test(n));const ground=[...new Set([...Object.keys(D.ground),...surf])],overlay=Object.keys(D.overlay||{});
  const stats={},own={};for(const nm of [...ground,...overlay]){const d=defs.find(x=>x.name===nm),t=d&&d.pbrMetallicRoughness&&d.pbrMetallicRoughness.baseColorTexture;if(t){const r=await stats16(path.join(dir,g.images[g.textures[t.index].source].uri));stats[nm]=r.st;own[nm]=r.own;}}
  // ground: loaded
  const G=prepare(defs,ground,stats,true);
  for(const nm of ground){const o=G[nm],m=o.material,s=own[nm],lay=m.userData&&m.userData.groundLayer;if((key+'/'+nm) in must)seen[key+'/'+nm]=lay?(lay.second||''):null;
   if(m.alphaTest>0||m.transparent||m.visible===false){bad.push(`${key} ground ${nm}: not opaque (alphaTest ${m.alphaTest} transparent ${m.transparent})`);continue;}
   if(flat(s)&&GROUND_NAME.test(nm)){
    if(!lay){bad.push(`${key} ground ${nm} (${D.ground[nm]?D.ground[nm].n+' nodes':'grass surface'}; rgb std ${s.lum.toFixed(1)}, alpha std ${s.alpha.toFixed(1)}): drawn as a flat colour - its alpha height mask is not used`);continue;}
    const sh=compiled(m);if(!/texture2D\(\s*map\s*,[^;]*\)\.a/.test(sh.fragmentShader)||sh.fragmentShader.includes('#include <map_fragment>'))bad.push(`${key} ground ${nm}: layer shader does not sample the map's alpha in place of the plain map read`);
    if(!/vGbW/.test(sh.vertexShader))bad.push(`${key} ground ${nm}: layer shader has no world position for the second-layer pattern`);
    if(typeof m.customProgramCacheKey!=='function'||m.customProgramCacheKey()===THREE.Material.prototype.customProgramCacheKey.call(m))bad.push(`${key} ground ${nm}: layer shader shares the plain lambert program cache key`);
    tally.layer++;if(lay.second)tally.second++;}
   else{if(lay)bad.push(`${key} ground ${nm}: textured / non-layer surface got the layer shader (rgb std ${s&&s.lum}, alpha std ${s&&s.alpha})`);tally.plain++;}}
  // ground: texture failed -> plain opaque, no layer shader
  const F=prepare(defs,ground,stats,false);for(const nm of ground){const m=F[nm].material;if(m.userData&&m.userData.groundLayer)bad.push(`${key} ground ${nm}, texture FAILED: layer shader without a map`);if(m.alphaTest>0||m.transparent||m.visible===false)bad.push(`${key} ground ${nm}, texture FAILED: not drawn opaque`);}
  // overlays
  const O=prepare(defs,overlay,stats,true),OF=prepare(defs,overlay,stats,false);
  for(const nm of overlay){const s=stats[nm],o=O[nm],m=o.material;if(!s||s.minAlpha>=250){if(m.transparent)bad.push(`${key} overlay ${nm}: texture has no alpha yet drawn blended`);continue;}
   if(!(m.userData.decal&&m.transparent&&m.depthWrite===false&&m.alphaTest>0&&m.polygonOffset&&m.polygonOffsetFactor===0&&m.polygonOffsetUnits<0&&!o.castShadow))bad.push(`${key} overlay ${nm} (${D.overlay[nm].n} nodes, ${(s.cut*100).toFixed(0)} % of its texels under half alpha): drawn as a solid quad - decal ${m.userData.decal||'none'} transparent ${m.transparent} depthWrite ${m.depthWrite} polygonOffset ${m.polygonOffset} castShadow ${o.castShadow}`);
   else tally.overlay++;
   const mf=OF[nm].material;if(mf.visible!==false)bad.push(`${key} overlay ${nm}, texture FAILED: still drawn (solid quad without its alpha)`);}}
 for(const [k,v] of Object.entries(must)){if(!(k in seen))bad.push(`${k}: not checked (missing from data)`);else if(seen[k]!==v)bad.push(`${k}: layer ${JSON.stringify(seen[k])}, expected ${JSON.stringify(v)} (null = flat colour)`);}
 // the page carries the same runtime (index.html is regenerated from work/native_maps_runtime.js by work/install_valorant.py)
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const l of (vars+'\n'+opt.join('\n')).split('\n').filter(Boolean))if(!html.includes(l))bad.push('index.html lacks the runtime line '+l.slice(0,60));
 assert.equal(bad.length,0,'ground layers must show their alpha height mask (and second layer); floor overlays must be decals:\n  '+bad.join('\n  '));
 console.log(`Map ground blend: ${tally.layer} ground layers drawn with their alpha height mask (${tally.second} with a second grass / moss / dirt layer), ${tally.plain} textured ground materials untouched; ${tally.overlay} floor overlays are decals (hidden when their texture fails)`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
