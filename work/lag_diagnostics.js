// Opt-in local browser capture. No telemetry endpoint, no timers, fixed memory, no wrappers while disabled.
(function(){
 const series=new Map(),undo=[];let active=false,observer=null,frameAt=0,packetAt=0;
 function sample(name,value){if(!active||!Number.isFinite(value))return;let s=series.get(name);if(!s){s={v:new Float64Array(600),n:0,total:0,max:0};series.set(name,s);}s.v[s.n++%600]=value;s.total+=value;s.max=Math.max(s.max,value);}
 function wrap(o,key,name,after){if(!o||typeof o[key]!=='function')return;const original=o[key],wrapped=function(){const t=performance.now();try{return original.apply(this,arguments);}finally{sample(name,performance.now()-t);if(after)after(t,arguments);}};o[key]=wrapped;undo.push(()=>{if(o[key]===wrapped)o[key]=original;});}
 const api={get active(){return active;},sample,start(){if(active)return;series.clear();frameAt=packetAt=0;active=true;
  wrap(globalThis,'loop','frameCpuMs',t=>{if(frameAt)sample('frameGapMs',t-frameAt);frameAt=t;try{if(typeof NET!=='undefined'&&NET.socket){sample('uplinkBufferedBytes',NET.socket.bufferedAmount||0);if(NET.receivedAt)sample('snapshotAgeMs',performance.now()-NET.receivedAt);}if(typeof MP!=='undefined'){if(Number.isFinite(MP.ping))sample('rttMs',MP.ping);if(MP.snapClock){sample('interpolationDelayMs',MP.snapClock.delay);sample('jitterMs',MP.snapClock.jitter);}}}catch{}});
  for(const [key,name]of [['xSimRun','simulationMs'],['xHud','hudMs'],['mpCliSnap','snapshotApplyMs'],['mpInterp','remoteInterpolationMs'],['netSyncEffects','effectSyncMs'],['netSyncSmokes','smokeSyncMs'],['xvLoad','assetRequestCpuMs']])wrap(globalThis,key,name);
  wrap(globalThis,'netReceive','snapshotParseDecodeCleanMs',(t,args)=>{if(packetAt)sample('incomingMessageGapMs',t-packetAt);packetAt=t;if(typeof args[0]==='string')sample('incomingMessageChars',args[0].length);});
  if(typeof renderer!=='undefined')wrap(renderer,'render','renderSubmitMs');
  if(typeof PerformanceObserver==='function')try{observer=new PerformanceObserver(list=>{for(const e of list.getEntries())sample('longTaskMs',e.duration);});observer.observe({entryTypes:['longtask']});}catch{}
 },stop(){if(!active)return;active=false;while(undo.length)undo.pop()();observer?.disconnect();observer=null;},report(){const out={note:'Local CPU wall times; render submission excludes asynchronous GPU time. Frame gaps include scheduling, GC and other tasks. Recent percentiles cover at most 600 samples per series.',active};for(const [name,s]of series){const v=Array.from(s.v.subarray(0,Math.min(600,s.n))).sort((a,b)=>a-b);out[name]={count:s.n,mean:s.total/s.n,max:s.max,recentP50:v[v.length>>1],recentP95:v[Math.floor(v.length*.95)],recentP99:v[Math.floor(v.length*.99)]};}return out;}};
 window.VSLag=api;
})();
