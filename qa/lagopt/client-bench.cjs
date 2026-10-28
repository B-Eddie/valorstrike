// CPU/allocation of the actual snapshot/interpolation functions, no WebGL, DOM, assets, or network.
const fs=require('fs'),vm=require('vm'),v8=require('v8');
const label=process.argv[2]||'current',html=fs.readFileSync(process.argv.includes('--baseline')?'qa/lagopt/fixtures/client-before.js':'index.html','utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const units=Array.from({length:9},(_,i)=>({g:{position:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{y:0}},nb:[],alive:true,hp:100,name:'Bot'+i,agent:'Jett',nt:1,nid:i+2,nsq:0}));
const c={running:true,MP:{st:'game',me:1,DELAY:100},NET:{socket:{}},bots:units,allies:[],XAG:{Jett:1},FV:{},performance:{now:()=>c.now},now:0,mpClean:s=>s,mpCliKD(){},showStats(){},xAng:x=>Math.atan2(Math.sin(x),Math.cos(x))};
vm.createContext(c);vm.runInContext(fs.readFileSync('work/hypot_runtime.js','utf8'),c);vm.runInContext(process.argv.includes('--baseline')?html:cut('function mpCliSnap(','function mpCliSelf(')+cut('function mpInterp(','const MPT =')+cut('const netPose0=mpCliSnap;','let netFxReplay='),c);
const samples={snapshot:[],interpolate:[]};let n=0;const step=()=>{c.now=++n*1000/144;if(n%7===0){const m={u:units.map((u,i)=>[u.nid,1,u.name,'Jett',c.now*.0054+i,0,i,0,100,50,1,'Vandal',0,0,0,25,75,0,0]),serverTime:c.now+5e5};const t=performance.now();c.mpCliSnap(m);samples.snapshot.push(performance.now()-t);}const t=performance.now();for(const u of units)c.mpInterp(u,c.now);samples.interpolate.push(performance.now()-t);};
for(let i=0;i<3000;i++)step();samples.snapshot.length=samples.interpolate.length=0;
const g=new v8.GCProfiler();g.start();const h=v8.getHeapStatistics().used_heap_size;for(let i=0;i<12000;i++)step();const h1=v8.getHeapStatistics().used_heap_size,stats=g.stop();
const summarize=a=>{a.sort((a,b)=>a-b);return {mean:a.reduce((s,x)=>s+x,0)/a.length,p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)};};
const out={label,node:process.version,fixture:'9 remotes, 144 Hz scripted frames, snapshot every 7 frames (~20.6 Hz), VM CPU only; page Math.hypot shim installed; includes harness overhead; no animation/model/render work',ms:Object.fromEntries(Object.entries(samples).map(([k,a])=>[k,summarize(a)])),heapBytesPerFrame:(h1-h+stats.statistics.reduce((s,e)=>s+e.beforeGC.heapStatistics.usedHeapSize-e.afterGC.heapStatistics.usedHeapSize,0))/12000,gcs:stats.statistics.length};
fs.writeFileSync(`qa/lagopt/${label}-client.json`,JSON.stringify(out,null,2)+'\n');console.log(out);
