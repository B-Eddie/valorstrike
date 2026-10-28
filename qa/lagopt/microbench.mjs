import fs from 'node:fs';import v8 from 'node:v8';import {TdmSimulation} from '../../server/src/tdm.js';import {roomBlocked} from '../../server/src/tdmrooms.js';
const label=process.argv[2]||'current',nodes=[];for(let i=0;i<100;i++)nodes.push([i%10-5,0,Math.floor(i/10)-5]);
const W={map:{key:'fixture',attacker:[-20,0,0],defender:[20,0,0]},nav:{nodes,adj:nodes.map(()=>[])},playable:nodes.map((_,i)=>i),ground:()=>0,blocked:()=>false,ray:()=>Infinity,near:()=>0};
const sim=new TdmSimulation(W,'tdm','fixture',()=>.5),u=sim.add('P');Object.assign(u,{x:0,y:0,z:0});
const input={x:0,z:0,speed:6.75};
const bench=f=>{for(let i=0;i<10000;i++)f(i);const gc=new v8.GCProfiler();gc.start();const h=v8.getHeapStatistics().used_heap_size,t=performance.now();for(let i=0;i<100000;i++)f(i);const ms=performance.now()-t,h1=v8.getHeapStatistics().used_heap_size,g=gc.stop();return {us:ms*1000/100000,B:Math.max(0,h1-h+g.statistics.reduce((s,e)=>s+e.beforeGC.heapStatistics.usedHeapSize-e.afterGC.heapStatistics.usedHeapSize,0))/100000,gcs:g.statistics.length};};
const result={label,node:process.version,fixture:'actual TDM motor, static flat collision; 100k warmed calls; no snapshots, browser or network',motor:bench(()=>sim.motor(u,input,.05)),roomBlocked:bench(i=>roomBlocked(sim,u,(i%50)-25,0,.4,0))};
fs.writeFileSync(`qa/lagopt/${label}-micro.json`,JSON.stringify(result,null,2)+'\n');console.log(result);
