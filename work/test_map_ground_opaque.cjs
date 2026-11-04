// vs-lane-groundalpha (user, live 7416f55, Ascent: "the ground is transparent ... check other maps"; then "it's always been a
// problem"). The map export MASKs every material with "Grass" in its name and keeps no vertex colours, so a GROUND surface
// whose texture holds the source's blend / height mask in alpha was drawn alpha-cut by nmPrepareScene: Ascent's
// Grass_M0_Dirtblend_A (the mid-courtyard dirt, 640 walkable nodes) and Grass_M0_A_MI (grass ground; also Breeze, Lotus)
// lost 59-99 % of their texels and the dirt sheet 1.1-1.8 m below showed through: a flat brown floor with dark patches.
// Rule checked here on every map's REAL material definitions (scene.gltf) and walkable surfaces
// (work/validation/map/ground-materials.json, server/tools/map-ground.mjs: the render surface under each navigation node):
//   * every walkable ground material draws opaque (alphaTest 0, not transparent, drawn) with its texture loaded AND when
//     its texture failed to load (three r147 GLTFLoader leaves no map; nmTexMissingMark flags it);
//   * grass cards / clumps, foliage and decals / floaters that lie on the floor keep their cut-out (alphaTest > 0 or
//     blended) when their texture loads, and are not drawn when it failed (vs-lane-mapdouble rule, unchanged);
//   * every "<Surface>_M<n>_" grass surface material (Grass_M0_A, Grass_M0_Dirtblend_A, ...) on any map is ground.
// Drives the page's own nmTexMissingMark + nmPrepareScene from work/native_maps_runtime.js on real three.js objects shaped
// as GLTFLoader leaves them; nmTexStats (a canvas read in the page) is fed the texture's real 16x16 alpha statistics.
//   node work/test_map_ground_opaque.cjs        (RT=path runs it against another runtime file)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const RT=fs.readFileSync(process.env.RT||path.join(__dirname,'native_maps_runtime.js'),'utf8');
const fn=name=>{const m=new RegExp('^function '+name+'\\(.*$','m').exec(RT);assert(m,'runtime has function '+name);return m[0];};
const vars=(RT.match(/^var NM_(?:TERRAIN|ZBIAS|ZLEVELS|OVERLAY|GROUND\w*)=.*$/mg)||[]).join('\n');
const opt=['nmTerrain','nmGroundLayer','nmGroundApply'].filter(n=>new RegExp('^function '+n+'\\(','m').test(RT)).map(fn);
const ctx={THREE,renderer:{capabilities:{getMaxAnisotropy:()=>16}},console};vm.createContext(ctx);
vm.runInContext([vars,...opt,...['nmDecalStyle','nmFoliageCut','nmFoliageApply','nmDecalApply','nmTexMissingMark','nmTexStatsOf','nmPrepareScene'].map(fn),'function nmTexStats(img){return img&&img.st||null;}'].join('\n'),ctx);
const DATA=JSON.parse(fs.readFileSync(path.join(__dirname,'validation/map/ground-materials.json'),'utf8'));
const MAPS=['ascent','bind','breeze','haven','lotus','split'];
assert.deepEqual(Object.keys(DATA).sort(),MAPS,'walkable-surface data covers the six maps');
// one material per name as GLTFLoader r147 builds it (MASK -> alphaTest = cutoff, BLEND -> transparent), map set when loaded
function prepare(defs,names,stats,loaded){const json={materials:defs},assoc=new Map(),scene=new THREE.Group(),byName={};
 for(const nm of names){const i=defs.findIndex(d=>d.name===nm);assert(i>=0,'scene.gltf has material '+nm);const d=defs[i],pbr=d.pbrMetallicRoughness||{};
  const m=new THREE.MeshStandardMaterial({name:d.name});if(d.alphaMode==='MASK')m.alphaTest=d.alphaCutoff!=null?d.alphaCutoff:.5;if(d.alphaMode==='BLEND'){m.transparent=true;m.depthWrite=false;}
  if(pbr.baseColorTexture&&loaded){const t=new THREE.Texture({width:512,height:512,st:stats[nm]||null});m.map=t;}
  assoc.set(m,{materials:i});const o=new THREE.Mesh(new THREE.PlaneGeometry(1,1),m);o.name=nm;scene.add(o);byName[nm]=o;}
 ctx.gl={scene,parser:{json,associations:assoc}};vm.runInContext('nmTexMissingMark(gl);nmPrepareScene(gl.scene)',ctx);
 const out={};for(const nm in byName){const m=byName[nm].material;out[nm]={cut:m.alphaTest>0||m.transparent,alphaTest:m.alphaTest,transparent:m.transparent,drawn:m.visible!==false,hasTex:!!(defs.find(d=>d.name===nm).pbrMetallicRoughness||{}).baseColorTexture};}return out;}
const bad=[];let nGround=0,nCards=0;
for(const key of MAPS){const defs=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'scene.gltf'),'utf8')).materials,D=DATA[key];
 const surf=defs.map(d=>d.name).filter(n=>/^Grass_M\d+_/i.test(n)&&!/Cards/i.test(n));
 const ground=[...new Set([...Object.keys(D.ground),...surf])],stats={};for(const g of ['ground','cards','overlay'])for(const [n,e] of Object.entries(D[g]||{}))stats[n]=e.stats;
 const cards=Object.keys(D.cards).filter(n=>D.cards[n].stats&&D.cards[n].stats.cut>=.02);nGround+=ground.length;nCards+=cards.length;
 for(const loaded of [true,false]){const G=prepare(defs,ground,stats,loaded),C=prepare(defs,cards,stats,loaded),tag=loaded?'texture loaded':'texture FAILED';
  for(const n of ground){const r=G[n];if(r.cut||!r.drawn)bad.push(`${key} ground ${n} (${D.ground[n]?D.ground[n].n+' walkable nodes':'grass surface'}), ${tag}: alphaTest ${r.alphaTest} transparent ${r.transparent} drawn ${r.drawn} -> see-through ground`);}
  for(const n of cards){const r=C[n];if(loaded&&!r.cut)bad.push(`${key} ${D.cards[n].kind} ${n}, ${tag}: lost its cut-out (drawn as a solid quad)`);if(!loaded&&r.hasTex&&r.drawn)bad.push(`${key} ${D.cards[n].kind} ${n}, ${tag}: still drawn (solid quad without its alpha)`);}}}
assert.equal(bad.length,0,'ground must draw opaque, cards / foliage / decals keep their cut-out:\n  '+bad.join('\n  '));
// the page carries the same runtime (index.html is regenerated from work/native_maps_runtime.js by work/install_valorant.py)
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const l of (vars+'\n'+opt.join('\n')).split('\n').filter(Boolean))assert(html.includes(l),'index.html carries the runtime line '+l.slice(0,60));
console.log(`Map ground: ${nGround} walkable ground materials on six maps draw opaque with and without their texture; ${nCards} cards / foliage / decals keep their cut-out (hidden when their texture fails)`);
