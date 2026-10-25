const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync('index.html','utf8'),r=fs.readFileSync('work/valorant_runtime.js','utf8');
let loads=0,ready=0;
const c={Promise,console,TextDecoder,setTimeout,window:{},caches:undefined,navigator:{},matchMedia:()=>({matches:false}),
 fetch:async()=>{loads++;return {ok:true,status:200,arrayBuffer:async()=>new ArrayBuffer(8),clone(){return this;}};},
 THREE:{GLTFLoader:class{parse(buf,path,ok){queueMicrotask(()=>ok({scene:{},animations:[]}));}}},
 XGM:{ld:false,src:{}},xvStatic:g=>g.scene,xGmFiles:()=>({'valorant/vandal':'models/valorant/vandal.glb'}),xGmReady:()=>ready++};
vm.createContext(c);
vm.runInContext(r.slice(r.indexOf('var XV = '),r.indexOf('function xvFind('))+s.slice(s.indexOf('function xGmLoad()'),s.indexOf('// average height of the vertices')),c);
(async()=>{
 c.xGmLoad();const fp=await c.xvLoad('vandal');await Promise.resolve();
 assert.equal(loads,1,'one fetch for the shared GLB resource');
 assert.equal(ready,1,'one ready callback');
 assert.equal(c.XV.guns['valorant/vandal'],fp,'gun promise shared with first-person loader');
 assert.equal(c.XGM.src['valorant/vandal'],fp.scene,'third-person static clone from the same scene');
 c.xGmLoad();await c.xvLoad('vandal');assert.equal(loads,1,'repeat load stays deduped');
 console.log('Third-person weapon loading and first-person source share one GLTF resource promise; static TP clone retained, one ready callback');
})().catch(e=>{console.error(e);process.exit(1)});
