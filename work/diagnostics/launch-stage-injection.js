// Diagnostic only. Insert immediately before the existing xValorantFeel export.
// Does not change rendering, assets, bot count, or game state.
(()=>{
 const t0=performance.now(),event=(stage,data={})=>console.log('LAUNCH_STAGE '+JSON.stringify({stage,ms:Math.round(performance.now()-t0),...data}));
 for(const name of ['nmEnsure','nmCollision','nmLaunch','xvAgentLoad']){
  const original=eval(name);eval(name+'=function(){const args=arguments;event(name+":begin",{key:typeof args[0]==="function"?"match-start":String(args[0])});let result;try{result=original.apply(this,args);}catch(e){event(name+":throw",{error:String(e)});throw e;}return Promise.resolve(result).then(v=>{event(name+":ready");return v;},e=>{event(name+":failed",{error:String(e)});throw e;});}');
 }
 const fetch0=window.fetch;window.fetch=function(url){const name=String(url);const trace=/worlds\/|models\/valorant\/maps\//.test(name);if(trace)event('fetch:begin',{url:name});return fetch0.apply(this,arguments).then(r=>{if(trace)event('fetch:headers',{url:name,status:r.status,bytes:r.headers.get('content-length')});return r;},e=>{if(trace)event('fetch:failed',{url:name,error:String(e)});throw e;});};
 const parse=THREE.GLTFLoader.prototype.parse;THREE.GLTFLoader.prototype.parse=function(data,path,done,fail){event('gltf:parse-begin',{path});return parse.call(this,data,path,v=>{event('gltf:parse-ready',{path});done(v);},e=>{event('gltf:parse-failed',{path,error:String(e)});if(fail)fail(e);});};
 const render=renderer.render;let n=0;
 renderer.render=function(){const id=++n,trace=running&&id<250;if(trace)event('render:begin',{id});const v=render.apply(this,arguments);if(trace)event('render:end',{id,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});return v;};
 setInterval(()=>event('state',{running,map:NM.current?.key,pending:NM.pending?.key,loading:!!window.xLdOn,native:XSOL.mx.filter(m=>m.valorant).length,agents:XSOL.mx.length,frame:XNF}),1000);
 event('installed');
})();
