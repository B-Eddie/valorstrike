// Versioned, best-effort persistent bytes. Parsed rigs are shared separately by XV.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.GameAssets=factory({fetch:root.fetch.bind(root),caches:root.caches,base:root.location.href,now:()=>performance.now()});})(typeof globalThis!=='undefined'?globalThis:this,function(env){
'use strict';
const pending=new Map(),stats={network:0,hits:0,bytes:0,errors:0},cacheName='valorstrike-models-v1';let store;
const manifest=env.fetch(new URL('models/valorant/asset-cache.json',env.base).href,{cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}));
const cache=Promise.resolve().then(()=>env.caches?.open(cacheName)).then(async c=>{store=c;if(c){const m=await manifest;for(const request of await c.keys()){const u=new URL(request.url),path=decodeURIComponent(u.pathname).split('models/valorant/')[1],entry=m['models/valorant/'+path];if(!entry||u.searchParams.get('v')!==entry.hash)await c.delete(request);}}return c;}).catch(()=>undefined);
async function bytes(path,options={}){const m=await manifest,entry=m[path],url=new URL(path,env.base);if(entry)url.searchParams.set('v',entry.hash);const key=url.href;
 if(!pending.has(key)){const job=(async()=>{const c=await cache;if(c&&entry){try{const hit=await c.match(key);if(hit){stats.hits++;return hit.arrayBuffer();}}catch{stats.errors++;}}
 const r=await env.fetch(key,{cache:entry?'force-cache':'no-cache',priority:options.priority||'high'});if(!r.ok)throw Error(path+' '+r.status);const data=await r.arrayBuffer();stats.network++;stats.bytes+=data.byteLength;
 if(c&&entry)try{await c.put(key,new Response(data,{headers:r.headers,status:200}));}catch{stats.errors++;}return data;})().finally(()=>pending.delete(key));pending.set(key,job);}
 return pending.get(key);
}
return {bytes,json:async(path,options)=>JSON.parse(new TextDecoder().decode(await bytes(path,options))),manifest,stats};
});
