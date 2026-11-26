// PATH WORKER (work/path_worker_runtime.js): the worker's searches return what the page's own synchronous searches return.
// Boots the real page (page_harness native Ascent, real nav + collision), starts an offline 5v5, runs the page's worker source in a
// worker_threads thread (work/xpw_node_shim.cjs) and for random node pairs compares, bit for bit:
//  - A*: the worker's path (and its unreachable memo when the search ran dry) vs nmPath on fresh caches; with and without ban
//    sets (edges of the route, as nmNext's stall breaker bans them, plus keys that name no edge)
//  - lane re-route: the worker's BotRoutes.route vs the page's (seed, peers' lanes, ban set, the instinct climb filter)
// The climb mirror starts empty, so the worker's 'need' round trips (nmClimbOk answered by the page) are exercised too.
//   node work/test_path_worker_equivalence.cjs   [Q=300 queries] [MAP=ascent]
const assert=require('assert');
const {boot,lsStore}=require('./page_harness.cjs');
const H=boot({real3:true,seed:3,native:true,fastGlobal:true,ls:lsStore([['vs.gq','low']])}),xe=H.xe;
const tick=()=>new Promise(r=>setImmediate(r));
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();}};
const Q=+(process.env.Q||300),MAP=process.env.MAP||'ascent';
(async()=>{
 xe(`FV.pick=${JSON.stringify(MAP)};true`);H.$('pm5v5').click();await adv(50);
 for(let t=0;t<30000&&!(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'));t+=100){
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag');const tile=tiles.find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}await adv(100);}
 assert(xe('!!(typeof nmActive==="function"&&nmActive())'),'native nav active');
 const XPW=require('./xpw_node_shim.cjs').install(H);
 // the flat adjacency exists after the first search
 xe('(()=>{const C=nmActive();nmPath(C,0,1);return 1;})()');
 assert(xe('XPW.enabled()'),'worker started');xe('XPW.live(nmActive())');
 for(let i=0;i<400&&!xe('XPW.rver===XPW.ver');i++)await new Promise(r=>setTimeout(r,5));
 assert(xe('XPW.rver===XPW.ver'),'worker ready');
 // the A* answers are kept for the comparison instead of going into nmPath's caches (XPW.insA's insertion is checked by the bench run)
 xe('XPW.insA=function(job,d){XPW.put(job.key,d);};true');
 xe(`window.__T={rnd:(()=>{let a=12345;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};})()};true`);
 const n=xe('nmActive().nav.nodes.length');console.log('nodes',n,'climb memo at start',xe('(nmActive().climbMemo||new Map()).size'));
 const wait=async key=>{for(let i=0;i<4000;i++){if(xe(`XPW.res.has(${JSON.stringify(key)})`))return xe(`(()=>{const r=XPW.res.get(${JSON.stringify(key)});XPW.res.delete(${JSON.stringify(key)});return JSON.stringify({err:r.err?(r.msg||1):0,path:r.path?Array.from(r.path):null,dry:r.dry?Array.from(r.dry).reduce((a,v,i)=>v?a+','+i:a,''):null});})()`);if(!xe(`XPW.pend.has(${JSON.stringify(key)})`))throw Error('job dropped '+key);await new Promise(r=>setTimeout(r,2));}throw Error('timeout '+key);};
 let nA=0,nB=0,nR=0,nDry=0,nEmpty=0,sumLen=0;const t0=Date.now();
 for(let q=0;q<Q;q++){
  // a pair of valid nodes; every 5th a far pair (a long search); bans from the native path's edges
  const pr=JSON.parse(xe(`(()=>{const C=nmActive(),N=C.nav.nodes,v=C.nav.valid,R=__T.rnd;let s,e;do{s=Math.floor(R()*N.length);}while(v&&!v[s]);do{e=Math.floor(R()*N.length);}while((v&&!v[e])||e===s);return JSON.stringify([s,e]);})()`));
  const [s,e]=pr;
  // even queries: the worker first (its climb mirror may lack answers the native search has not memoised yet: 'need' trips)
  const key='a'+(s*n+e)+'#'+q;let w=null;if(q%2===0){xe(`XPW.ask(${JSON.stringify(key)},{t:'a',s:${s},e:${e},ban:null},${JSON.stringify(key)})`);w=JSON.parse(await wait(key));}
  // native, fresh caches (the unreachable memo too)
  const nat=JSON.parse(xe(`(()=>{NM.routeCache.clear();if(NM.banCache)NM.banCache.clear();const C=nmActive(),p=nmPath(C,${s},${e}).slice(),U=NM.routeCache.get(-1-${e});return JSON.stringify({p,dry:U?Array.from(U).reduce((a,v,i)=>v?a+','+i:a,''):null});})()`));
  if(!w){xe(`XPW.ask(${JSON.stringify(key)},{t:'a',s:${s},e:${e},ban:null},${JSON.stringify(key)})`);w=JSON.parse(await wait(key));}
  assert(!w.err,'worker error '+key);assert.deepStrictEqual(w.path,nat.p,`A* ${s}->${e}`);assert.strictEqual(w.dry,nat.dry,`unreachable memo ${s}->${e}`);nA++;if(nat.dry)nDry++;if(!nat.p.length)nEmpty++;sumLen+=nat.p.length;
  if(nat.p.length>=3){
   // banned: 1-3 edges of the route + one key that names no edge; Map order kept
   const ban=JSON.parse(xe(`(()=>{const p=${JSON.stringify(nat.p)},R=__T.rnd,k=1+Math.floor(R()*3),out=[];for(let i=0;i<k;i++){const j=Math.floor(R()*(p.length-1));out.push(p[j]+'>'+p[j+1]);}out.push('x>1');return JSON.stringify(out);})()`));
   const nb=JSON.parse(xe(`(()=>{NM.routeCache.clear();if(NM.banCache)NM.banCache.clear();const C=nmActive(),B=new Map(${JSON.stringify(ban)}.map(k=>[k,1]));return JSON.stringify(nmPath(C,${s},${e},B).slice());})()`));
   const kb='b'+q;xe(`XPW.ask(${JSON.stringify(kb)},{t:'a',s:${s},e:${e},ban:${JSON.stringify(ban)}},${JSON.stringify(kb)})`);const wb=JSON.parse(await wait(kb));
   assert(!wb.err);assert.deepStrictEqual(wb.path,nb,`A* banned ${s}->${e} ${ban}`);assert.strictEqual(wb.dry,null);nB++;
  }
  if(nat.p.length>=4){
   // lane re-route as xbvPath calls it: seed, peers (their lanes' first nodes), bans, the instinct climb filter
   const job=JSON.parse(xe(`(()=>{const C=nmActive(),N=C.nav.nodes,R=__T.rnd,base=${JSON.stringify(nat.p)},peers=[];for(let i=0;i<Math.floor(R()*4);i++){const o=Math.floor(R()*Math.max(1,base.length-30));peers.push({path:base.slice(o,o+30)});}
     const ban=R()<.3?[base[1]+'>'+base[2]]:null,seed='Bot'+${q}+'|'+Math.floor(R()*9)+'|'+${e};
     const eo=(a,b)=>N[b][1]-N[a][1]<=.321||nmClimbOk(C,a,b),r=BotRoutes.route(C.nav,base,seed,peers,null,ban?new Map(ban.map(k=>[k,1])):null,eo);
     return JSON.stringify({r:Array.from(r),seed,peers:peers.map(p=>p.path.slice(0,24)),ban,base});})()`));
   const kr='r'+q;xe(`XPW.ask(${JSON.stringify(kr)},{t:'r',base:Int32Array.from(${JSON.stringify(job.base)}),seed:${JSON.stringify(job.seed)},peers:${JSON.stringify(job.peers)}.map(p=>Int32Array.from(p)),ban:${JSON.stringify(job.ban)},eo:true},${JSON.stringify(kr)})`);
   const wr=JSON.parse(await wait(kr));assert(!wr.err,'route worker error '+wr.err);assert.deepStrictEqual(wr.path,job.r,`route ${s}->${e}`);nR++;
  }
 }
 const st=xe('JSON.stringify(XPW.stat)');console.log('PASS',JSON.stringify({map:MAP,astar:nA,banned:nB,routes:nR,dry:nDry,empty:nEmpty,avgLen:+(sumLen/nA).toFixed(1),stat:JSON.parse(st),secs:Math.round((Date.now()-t0)/1000)}));
 assert(nR>Q/4,'enough lane re-routes compared');assert(JSON.parse(st).need>0,'climb round trips exercised');
 process.exit(0);
})().catch(e=>{console.error('FAIL',e&&e.stack||e);process.exit(1);});
