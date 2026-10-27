// Z-fighting fix (render meshes), client side. server/tools/map-zfight.mjs scans each map's scene.gltf for coplanar
// overlapping triangles of different materials (every converted map material is double-sided, so either facing
// fights); the fix it derives ships in the runtime as NM_ZFIX (work/validation/map/zfight-fix.json) and nmZFixApply
// applies it after nmPrepareScene. server/test-map-zfight.js re-scans the reported seam areas with the fix applied.
// Checks: data in the page equals the generated file, covers the six maps; nmZFixApply pulls listed materials forward by
// level (factor = units = -level), leaves decals (their own offset) and unlisted materials alone, drops exactly the
// listed duplicate triangles once (shared geometry not cut twice); wiring after prepare on load and on rehydrate; the
// native-map camera near plane is raised to 0.1 m and the base 0.05 m restored on other maps.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const line=re=>{const m=src.match(re);assert(m,'missing '+re);return m[0];};
const data=JSON.parse(line(/^var NM_ZFIX=(.*);$/m).slice('var NM_ZFIX='.length,-1)),file=JSON.parse(fs.readFileSync(path.join(__dirname,'validation/map/zfight-fix.json'),'utf8'));
assert.deepEqual(data,file,'runtime fix data matches work/validation/map/zfight-fix.json');
for(const k of ['ascent','bind','haven','split','lotus','breeze']){assert(data[k]&&Array.isArray(data[k].o)&&data[k].o.length<=5,k+' fix present');assert(data[k].o.flat().length>0,k+' has offset layers');const all=data[k].o.flat();assert.equal(new Set(all).size,all.length,k+': a material sits on one level');}
// Hand-set level 5 (a level nothing else uses): Haven's puddle overlapped layers on all of levels 0..4; Split's trim
// was the last seam pair (map-notes, z-fighting).
assert.deepEqual(data.haven.o[4],['Puddle_2_M0_MI'],'Haven puddle on its own level 5');assert(data.split.o[4].includes('Metal_M5_KingdomMetalTrimConstruction_MI')&&!data.split.o[2].includes('Metal_M5_KingdomMetalTrimConstruction_MI'),'Split trim on level 5');
const fnSrc=src.slice(src.indexOf('function nmZFixApply('),src.indexOf('\n',src.indexOf('function nmZFixApply(')));
const api=new Function('THREE','NM_ZFIX',src.match(/^var NM_ZBIAS=.*;$/m)[0]+'\n'+fnSrc+'\nreturn nmZFixApply;');
const fix={t:{o:[['Trim_A'],['Trim_B']],d:{Wall_A:[1,3]}}},apply=api(THREE,fix);
const mesh=(name,tris,opts={})=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(tris*9),3));g.setIndex(new THREE.BufferAttribute(Uint32Array.from({length:tris*3},(_,i)=>i),1));const m=new THREE.MeshLambertMaterial({name});Object.assign(m,opts.mat||{});if(opts.decal)m.userData.decal='decal';return new THREE.Mesh(opts.geo||g,m);};
const scene=new THREE.Group(),a=mesh('Trim_A',2),b=mesh('Trim_B',2),w=mesh('Wall_A',5),w2=mesh('Wall_A',5,{geo:w.geometry}),dec=mesh('Trim_A',2,{decal:true,mat:{polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}}),other=mesh('Other',2);
scene.add(a,b,w,w2,dec,other);apply(scene,'t');
// Units-only bias (NM_ZBIAS = 4 depth steps a level): the slope-scaled factor pulled layers 1-40 cm forward at grazing
// angles, so hidden surfaces drew over the one in view (work/test_map_vanish.cjs).
assert(a.material.polygonOffset&&a.material.polygonOffsetFactor===0&&a.material.polygonOffsetUnits===-4,'level 1 layer one step (4 depth steps) forward');
assert(b.material.polygonOffsetFactor===0&&b.material.polygonOffsetUnits===-8&&b.material.userData.zLayer===2,'level 2 layer two steps forward');
assert(!other.material.polygonOffset,'unlisted material untouched');assert(dec.material.polygonOffsetFactor===-2&&!dec.material.userData.zLayer,'decal keeps its own offset');
assert.deepEqual([...w.geometry.index.array],[0,1,2,6,7,8,12,13,14],'duplicate triangles 1 and 3 dropped');assert.equal(w2.geometry,w.geometry,'shared geometry cut once');
assert.equal(api(THREE,fix)(new THREE.Group(),'nomap'),0,'maps without a fix: no-op');
// wiring
for(const s of [src,html]){assert(s.includes('const t0=nmNow();nmPrepareScene(gl.scene);nmZFixApply(gl.scene,key);'),'load applies the fix after prepare');assert(s.includes('return false;}nmPrepareScene(gl.scene);nmZFixApply(gl.scene,key);'),'rehydrate applies the fix after prepare');
 assert(s.includes('camera.far=500;camera.near=NM_NEAR;camera.updateProjectionMatrix();')&&s.includes('else if(camera.near!==.05){camera.near=.05;camera.updateProjectionMatrix();}'),'native near plane raised and restored');}
assert(/var NM_NEAR=\.1;/.test(src),'native near plane 0.1 m');
console.log('map z-fight: fix data for 6 maps ('+Object.values(data).reduce((s,f)=>s+f.o.flat().length,0)+' layered materials, '+Object.values(data).reduce((s,f)=>s+Object.values(f.d).reduce((a,l)=>a+l.length,0),0)+' duplicate faces), apply semantics, wiring, near plane');
