const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/native_maps_runtime.js','utf8');
const body=source.slice(source.indexOf('function nmCancel('),source.indexOf('// Disconnected decorative'));
function fixture(){let resolveScene,resolveCollision,freed=[],timers=[],hidden=0;
 const c={location:{hostname:'127.0.0.1'},window:{xCancelMatchLoad:()=>hidden++},NM:{ticket:0,current:null,pending:null},Promise,Error,AbortController,console:{error(){}},setTimeout:f=>(timers.push(f),timers.length),clearTimeout(){},nmOverlay(){},nmFree:r=>freed.push(r),nmCollision:()=>new Promise(r=>resolveCollision=r),THREE:{Group:class{},LoadingManager:class{},GLTFLoader:class{loadAsync(){return new Promise(r=>resolveScene=r);}}},fetch:async()=>({ok:true,json:async()=>({})})};
 vm.createContext(c);vm.runInContext(body,c);return {c,freed,timers,scene:r=>resolveScene(r),geometry:r=>resolveCollision(r),get hidden(){return hidden;}};
}
(async()=>{
 const f=fixture(),pending=f.c.nmEnsure('lotus');f.c.nmCancel();await assert.rejects(pending,{name:'AbortError'});assert.equal(f.hidden,1);assert.equal(f.c.NM.pending,null);
 const scene={},geometry={};f.scene({scene});f.geometry(geometry);await new Promise(setImmediate);assert(f.freed.some(r=>r.M.g===scene));assert(f.freed.some(r=>r.geometry===geometry));assert.equal(f.c.NM.current,null);
 const t=fixture(),timeout=t.c.nmEnsure('bind');t.timers[0]();await assert.rejects(timeout,/timed out/);assert.equal(t.c.NM.pending,null);t.scene({scene:{}});t.geometry({});await new Promise(setImmediate);assert(t.freed.length>=2);
 const bad=fixture();bad.c.fetch=async()=>({ok:false,status:404});const failed=bad.c.nmEnsure('haven');await assert.rejects(failed,/404/);bad.scene({scene:{}});bad.geometry({});await new Promise(setImmediate);assert(bad.freed.length>=2);
 console.log('Map lifetime: immediate cancel/timeout, sibling failure cleanup and late scene/collision disposal pass');
})().catch(e=>{console.error(e);process.exitCode=1;});
