// vs-lane-mapdouble (user, LIVE b47807b, Firefox: "all the maps are messed up now, it looks like there's a map on the map
// because there are walls, but they have no collision and looks like another map is inside this map"; the same session logged
// ~75 "GLTFLoader: Couldn't load texture"). When a texture fails, three's GLTFLoader still builds the material, only without
// its map. For an alpha-cut / blended material (foliage and grass cards, fences, decals, floaters) the texture's alpha IS the
// shape: without it the page drew every card as a solid opaque quad (browser-verified on the live page with 30 % of Ascent's
// textures aborted: 25 such materials, ~145k triangles of solid "walls"). Foliage is walk / shoot-through (collision-exclude),
// so the user walked through them: walls with no collision, a second map inside the map.
// Rule: a material whose glTF definition names a base-colour texture that did not load AND that is alpha-cut or blended is not
// drawn (its shape is unknown); an opaque material missing its texture still draws (plain colour beats a hole in a wall);
// a blended material with no texture in its definition (glass) and anything that loaded keeps drawing.
// Drives the page's own nmLoadScene post-load step (nmTexMissingMark) and nmPrepareScene from work/native_maps_runtime.js on
// real three.js objects, shaped as three r147 GLTFLoader leaves them (parser.json + parser.associations, map unset on failure).
//   node work/test_map_texmiss.cjs
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const RT=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const fn=name=>{const m=new RegExp('^function '+name+'\\(.*$','m').exec(RT);assert(m,'runtime has function '+name);return m[0];};
// nmLoadScene must hand the loaded glTF to nmTexMissingMark before the scene is prepared
assert(/function nmLoadScene\([^\n]*nmTexMissingMark\(gl\)/.test(RT),'nmLoadScene marks the materials whose texture failed (nmTexMissingMark(gl)) once the glTF has loaded');
const ctx={THREE,renderer:{capabilities:{getMaxAnisotropy:()=>16}},console};vm.createContext(ctx);
vm.runInContext(['nmTexStats','nmDecalStyle','nmFoliageApply','nmDecalApply','nmTexMissingMark','nmPrepareScene'].map(fn).join('\n'),ctx);
// a glTF as GLTFLoader r147 leaves it: json.materials[i], parser.associations material -> {materials:i}; a failed texture = no map
const tex=()=>{const t=new THREE.Texture({width:4,height:4});return t;};
const defs=[
 {name:'Foliage_8_M1_MI',alphaMode:'MASK',alphaCutoff:.45,pbrMetallicRoughness:{baseColorTexture:{index:0}}},     // 0 card, texture FAILED
 {name:'Grass_M0_Cards_MI',alphaMode:'MASK',alphaCutoff:.45,pbrMetallicRoughness:{baseColorTexture:{index:1}}},   // 1 card, texture loaded
 {name:'Decal_Leak_MI',alphaMode:'BLEND',pbrMetallicRoughness:{baseColorTexture:{index:2}}},                       // 2 decal, texture FAILED
 {name:'Glass_Window_MI',alphaMode:'BLEND',pbrMetallicRoughness:{baseColorFactor:[1,1,1,.3]}},                      // 3 glass, no texture at all
 {name:'Brick_Wall_MI',pbrMetallicRoughness:{baseColorTexture:{index:3}}},                                          // 4 opaque wall, texture FAILED
 {name:'Fence_Chain_MI',alphaMode:'MASK',alphaCutoff:.5,pbrMetallicRoughness:{baseColorTexture:{index:4}}},        // 5 fence, texture FAILED, material cloned by the loader (assignFinalMaterial)
];
const loaded=[false,true,false,false,false,false];
function build(){
 const json={materials:defs},assoc=new Map(),scene=new THREE.Group(),mats=[];
 defs.forEach((d,i)=>{const m=new THREE.MeshStandardMaterial({name:d.name});if(d.alphaMode==='MASK')m.alphaTest=d.alphaCutoff;if(d.alphaMode==='BLEND'){m.transparent=true;m.depthWrite=false;}
  if(d.pbrMetallicRoughness.baseColorFactor)m.opacity=d.pbrMetallicRoughness.baseColorFactor[3];if(d.pbrMetallicRoughness.baseColorTexture&&loaded[i])m.map=tex();assoc.set(m,{materials:i});mats.push(m);});
 // the loader's per-mesh clone (vertex colours / flat shading) keeps the association of its source
 const clone=mats[5].clone();assoc.set(clone,assoc.get(mats[5]));mats[5]=clone;
 const meshes=mats.map((m,i)=>{const o=new THREE.Mesh(new THREE.PlaneGeometry(1,1),m);o.name=defs[i].name;scene.add(o);return o;});
 // a multi-material mesh: one primitive's texture failed, the other loaded
 const multi=new THREE.Mesh(new THREE.PlaneGeometry(1,1),[mats[0],mats[1]]);multi.name='multi';scene.add(multi);
 return {gl:{scene,parser:{json,associations:assoc}},meshes,multi};
}
const {gl,meshes,multi}=build();
ctx.gl=gl;vm.runInContext('nmTexMissingMark(gl);nmPrepareScene(gl.scene)',ctx);
const drawn=o=>{const m=Array.isArray(o.material)?o.material:[o.material];return m.map(x=>x.visible!==false);};
const want=[false,true,false,true,true,false];
meshes.forEach((o,i)=>assert.equal(drawn(o)[0],want[i],`${defs[i].name}: ${want[i]?'drawn':'NOT drawn (alpha-cut / blended, its texture failed: a solid quad otherwise)'}`));
assert.deepEqual(drawn(multi),[false,true],'multi-material mesh: the failed card primitive hidden, the loaded one drawn');
// nothing failed -> nothing hidden (normal load unchanged)
loaded.fill(true);const ok=build();ctx.gl=ok.gl;vm.runInContext('nmTexMissingMark(gl);nmPrepareScene(gl.scene)',ctx);
ok.meshes.forEach((o,i)=>assert.equal(drawn(o)[0],true,`all textures loaded: ${defs[i].name} drawn`));
// a gl without parser data (stand-in scenes in other tests) is left alone
ctx.gl={scene:new THREE.Group()};vm.runInContext('nmTexMissingMark(gl)',ctx);
console.log('Map texture-miss: alpha-cut / blended materials whose texture failed are not drawn as solid quads (cards, decals, fences, loader clones, multi-material); opaque walls and texture-less glass still draw; a full load is unchanged');
