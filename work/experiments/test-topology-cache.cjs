// Rerun the existing 60-camera strip/culling proof after a topology+geometry cache roundtrip.
const fs=require('fs'),path=require('path'),Module=require('module');const f=path.resolve(__dirname,'../test_map_strips.cjs');let s=fs.readFileSync(f,'utf8');
s=s.replace('const scene=new THREE.Group()','let scene=new THREE.Group()');
s=s.replace('const r=api.nmOptimizeScene(scene),chunks=scene.userData.nmChunks,strips=scene.userData.nmStrips;',`const r=api.nmOptimizeScene(scene);const cache=require('./experiments/topology-cache.cjs');const data=cache.encode(scene);scene=cache.decode(THREE,data,api,i=>data.materials[i]);const chunks=scene.userData.nmChunks,strips=scene.userData.nmStrips;`);
const m=new Module(f,module);m.filename=f;m.paths=Module._nodeModulePaths(path.dirname(f));m._compile(s,f);
console.log('QA prepared topology cache passes original all-triangle/material identity and 60-view strip/culling/range checks. External materials only; no texture/cache-loader/memory/gameplay claim.');
