import fs from 'node:fs';import vm from 'node:vm';import v8 from 'node:v8';import {gunzipSync} from 'node:zlib';import {encodeSnapshot} from '../../server/src/snapshot-codec.js';
const source=fs.readFileSync('work/server_runtime.js','utf8'),code=source.slice(source.indexOf('function netClean('),source.indexOf('function netConnect('));
const c={NET:{},performance,Date,WEAP:JSON.parse(fs.readFileSync('server/src/weapons.json')).weapons,netSend(){throw Error('unexpected resync');}};vm.createContext(c);vm.runInContext(code,c);
const result={fixture:'One-client replay of 200 frozen TDM snapshots, prebuilt wire strings, 8k warmed parse/validation calls per measurement; after includes delta reconstruction and private baseline copies; no rendering or network.'};
for(const mode of ['dm','tdm','five']){
 const frames=JSON.parse(gunzipSync(fs.readFileSync(`qa/lagopt/before-${mode}-frames.json.gz`))).filter((_,i)=>i%5===0);let base=null;
 const full=frames.map(JSON.stringify),delta=frames.map(f=>{const e=encodeSnapshot(f,base);base=e.base;return e.data;});
 const measure=(strings,delta)=>{const run=()=>{c.NET.wireBase=null;for(const s of strings){if(delta)c.netReceive(s);else c.netClean(JSON.parse(s));}};for(let i=0;i<10;i++)run();const gc=new v8.GCProfiler();gc.start();const h=v8.getHeapStatistics().used_heap_size,t=performance.now();for(let i=0;i<40;i++)run();const dt=performance.now()-t,h1=v8.getHeapStatistics().used_heap_size,g=gc.stop(),n=strings.length*40;return {us:dt*1000/n,B:Math.max(0,h1-h+g.statistics.reduce((s,e)=>s+e.beforeGC.heapStatistics.usedHeapSize-e.afterGC.heapStatistics.usedHeapSize,0))/n,gcs:g.statistics.length};};
 result[mode]={before:measure(full,false),after:measure(delta,true)};
}
fs.writeFileSync('qa/lagopt/wire-bench.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
