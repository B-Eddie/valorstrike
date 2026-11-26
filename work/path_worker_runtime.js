// ---- PATH WORKER ----
// pathw (2026-11-25): offline bots' path SEARCHES run in a Web Worker. nmNext's A* (nmPath) and the lane-varied re-route
// (BotRoutes.route, BOT VARIETY's xbvPath) were the bot pathing frame spikes: ~2 ms per cold A* + ~4.5 ms per re-route on
// Ascent, the same bot re-routing every other frame in a stall (node bench_bots five seed 7: path searches 0.28 ms per frame,
// p99 6.7 ms, max 14 ms). The worker keeps its own copy of the map's nav graph (node xyz + the flat adjacency nmPath builds,
// C.csr; sent once per map, copied and transferred: the page has no cross-origin isolation, so no SharedArrayBuffer) and the
// up-edge climb answers (nmClimbOk's memo, sent as deltas). It never touches the collision BVH: a climb the worker has no
// answer for is asked back ('need'); the page computes it with nmClimbOk (same memo, same rule) and re-posts the search.
//   Re-plans inside xPath (the offline bot steering loop) go async here. There a search that is not already cached posts a job
// and throws XPW_MISS out of nmNext: xPath's state is put back and the bot keeps steering at its current target, exactly as a
// re-plan deferred by the NM_RP budget; when the answer arrives it is put into NM.routeCache / NM.banCache / the unreachable
// memo with nmPath's own rules (oldest out at 1200 / 200), so the next re-plan replays nmNext from the cache unchanged. BOT
// VARIETY's xpaCorner / xhpRoute / xhpAngles / xhpWarm go async in work/path_worker_late_runtime.js; every other caller
// (spectate, rules, round-start lineup) stays synchronous. Jobs and answers are batched: one message per frame each way. No Worker (node page harness, so every
// seeded behaviour test), vs.pw=0, a worker error, a job pending > 250 ms or > 24 jobs queued: the plain synchronous search.
var XPW={on:null,w:null,q:[],qf:false,ow:new Map(),soft:null,sb:0,C:null,csr:null,ver:0,rver:-1,ropeN:-1,ctx:null,pend:new Map(),res:new Map(),cm:null,cq:null,TO:250,MAXP:24,rw:false,
 stat:{post:0,res:0,need:0,miss:0,to:0,sync:0,used:0,err:0,init:0,late:0,werr:0,wms:0,wmax:0,age:0,amax:0},ROUTES:/*XPW_ROUTES_SRC*/null};
var XPW_MISS={xpwMiss:1};
// the worker: a self-contained function (stringified into a blob with vendor/bot-routes.cjs in front of it)
function xpwWorkerMain(){
 'use strict';let M=null;const BANRE=/^(0|[1-9][0-9]*)>(0|[1-9][0-9]*)$/,abs=Math.abs,sqrt=Math.sqrt;
 /* a climb with no answer yet: noted (up to 64 per job) and taken as passable so the search runs on and finds the other unknowns
    it would meet; the result is then thrown away and every noted climb is asked back in one message */
 let UNK=null;function climb(a,b){if(M.rope.has(a+'>'+b))return true;const v=M.climb.get(a*M.n+b);if(v===undefined){if(UNK.length<128&&!UNK.some((x,i)=>!(i&1)&&x===a&&UNK[i+1]===b))UNK.push(a,b);return true;}return v===1;}
 function banSet(keys){const s=new Set();for(const q of keys){const m=BANRE.exec(q);if(m)s.add(+m[1]*M.n+ +m[2]);}return s;}
 // nmPath's search (native_maps_runtime.js) on the copied arrays: same pushes, pops, comparisons and order; climbs from the mirror
 function astar(start,end,ban){const n=M.n,X=M.X,Z=M.Z,off=M.off,to=M.to,el=M.el,dyc=M.dyc,up=M.up,cost=M.cost,prev=M.prev,closed=M.closed;cost.fill(Infinity);cost[start]=0;prev.fill(-1);closed.fill(0);
  let hi=M.hi,hs=M.hs,hn=0;const ex=X[end],ez=Z[end],banN=ban&&ban.length?banSet(ban):null;let hh=0;
  {const hx=X[start]-ex,hz=Z[start]-ez,ha=abs(hx),hb=abs(hz),hm=ha>hb?ha:hb;hh=hm>0&&hm<Infinity&&hb===hb?sqrt((ha/hm)*(ha/hm)+(hb/hm)*(hb/hm))*hm:hm===0&&ha===ha?0:+Math.hypot(hx,hz);}
  hi[0]=start;hs[0]=hh;hn=1;let found=false,steps=0;
  while(hn&&steps++<n*12){const a=hi[0];{hn--;const li=hi[hn],ls=hs[hn];if(hn){let k=0;while(k*2+1<hn){let c=k*2+1;if(c+1<hn&&hs[c+1]<hs[c])c++;if(hs[c]>=ls)break;hi[k]=hi[c];hs[k]=hs[c];k=c;}hi[k]=li;hs[k]=ls;}}
   if(closed[a])continue;closed[a]=1;if(a===end){found=true;break;}const o1=off[a+1],ca=cost[a];
   for(let q=off[a];q<o1;q++){const b=to[q];if(closed[b]||(banN&&banN.has(a*n+b)))continue;if(up[q]&&!climb(a,b))continue;const d=ca+el[q]+dyc[q];
    if(d<cost[b]){cost[b]=d;prev[b]=a;{const hx=X[b]-ex,hz=Z[b]-ez,ha=abs(hx),hb=abs(hz),hm=ha>hb?ha:hb;hh=hm>0&&hm<Infinity&&hb===hb?sqrt((ha/hm)*(ha/hm)+(hb/hm)*(hb/hm))*hm:hm===0&&ha===ha?0:+Math.hypot(hx,hz);}const sc=d+hh;
     if(hn===hi.length){const g=new Int32Array(hn*2),h=new Float64Array(hn*2);g.set(hi);h.set(hs);hi=M.hi=g;hs=M.hs=h;}let k=hn++;while(k){const p=(k-1)>>1;if(hs[p]<=sc)break;hi[k]=hi[p];hs[k]=hs[p];k=p;}hi[k]=b;hs[k]=sc;}}}
  const path=[];if(found)for(let i=end;i>=0;i=prev[i]){path.push(i);if(i===start)break;}path.reverse();
  return {path:Int32Array.from(path),steps,dry:!found&&!hn&&!banN&&!(ban&&ban.length)&&steps>1?closed.slice():null};}
 self.onmessage=function(ev){const d=ev.data;
  if(d.t==='init'){const n=d.n,xyz=d.xyz,nodes=new Array(n),adj=new Array(n);for(let i=0;i<n;i++)nodes[i]=[xyz[i*3],xyz[i*3+1],xyz[i*3+2]];
   for(let a=0;a<n;a++){const L=[];for(let q=d.off[a];q<d.off[a+1];q++)L.push(d.to[q]);adj[a]=L;}
   M={ver:d.ver,n,nav:{nodes,adj},off:d.off,to:d.to,el:d.el,dyc:d.dyc,up:d.up,X:d.x,Z:d.z,rope:new Set(d.rope),climb:new Map(),cost:new Float32Array(n),prev:new Int32Array(n),closed:new Uint8Array(n),hi:new Int32Array(1024),hs:new Float64Array(1024)};
   postMessage({t:'ready',ver:d.ver});return;}
  /* a frame's jobs come in one message and their answers go back in one (each post wakes the other thread) */
  const out=[],tr=[];if(d.t==='b'){for(const j of d.jobs)run(j,out,tr);}else run(d,out,tr);if(out.length)postMessage({t:'b',rs:out},tr);};
 function run(d,out,tr){const postMessage=(m,t)=>{out.push(m);if(t)for(const x of t)tr.push(x);};
  if(!M||d.ver!==M.ver){postMessage({t:'err',ver:d.ver,key:d.key,msg:'stale'});return;}
  const cl=d.cl;if(cl)for(let i=0;i<cl.length;i+=3)M.climb.set(cl[i]*M.n+cl[i+1],cl[i+2]);
  UNK=[];const T0=performance.now();try{
   if(d.t==='a'){const r=astar(d.s,d.e,d.ban);if(UNK.length){postMessage({t:'need',ver:d.ver,key:d.key,ab:UNK});return;}const tr=[r.path.buffer];if(r.dry)tr.push(r.dry.buffer);postMessage({t:'res',ver:d.ver,key:d.key,path:r.path,steps:r.steps,dry:r.dry,ms:performance.now()-T0},tr);}
   else if(d.t==='r'){const N=M.nav.nodes,eo=d.eo?(a,b)=>N[b][1]-N[a][1]<=.321||climb(a,b):null,peers=[];for(const p of d.peers)peers.push({path:Array.from(p)});
    const BR=self.BotRoutes||(typeof module==='object'&&module&&module.exports&&module.exports.route?module.exports:null)/* a CommonJS host (the node shim) gets the UMD export */,r=BR.route(M.nav,Array.from(d.base),d.seed,peers,null,d.ban?new Map(d.ban.map(k=>[k,1])):null,eo);if(UNK.length){postMessage({t:'need',ver:d.ver,key:d.key,ab:UNK});return;}const out=Int32Array.from(r);postMessage({t:'res',ver:d.ver,key:d.key,path:out,ms:performance.now()-T0},[out.buffer]);}
  }catch(e){postMessage({t:'err',ver:d.ver,key:d.key,msg:String(e&&e.message||e)});}
 }
}
XPW.source=function(){return (XPW.ROUTES||'')+'\n;('+xpwWorkerMain.toString()+')();\n';};
XPW.mk=function(){/* blob URL revoked once the worker answered or after 60 s (netHbStart: a WebKit build may fetch the script late) */let url=URL.createObjectURL(new Blob([XPW.source()],{type:'text/javascript'}));const w=new Worker(url);XPW.drop=()=>{if(url){try{URL.revokeObjectURL(url);}catch(e){}url=null;}};setTimeout(()=>XPW.drop&&XPW.drop(),60000);return w;};
XPW.can=function(){return typeof Worker==='function'&&typeof Blob==='function'&&typeof URL!=='undefined'&&typeof URL.createObjectURL==='function';};
/* memory-tight devices keep the synchronous search: the worker's own isolate + nav graph copy + climb mirror is ~15-20 MB
   (Ascent, qa/pathw meas: worker heap 9 -> 17 MB + 2 MB typed arrays), and iPhones are killed near the warm stage (qa/ios). So
   iOS / iPadOS WebKit, touch-only devices (xLowDev) and navigator.deviceMemory <= 2 stay synchronous; vs.pw=1 forces it on. */
XPW.lowMem=function(){try{if(typeof nmIOSWebKit==='function'&&nmIOSWebKit())return true;if(typeof xLowDev!=='undefined'&&xLowDev)return true;
  const dm=typeof navigator!=='undefined'?navigator.deviceMemory:undefined;return dm>0&&dm<=2;}catch(e){return true;}};
XPW.enabled=function(){if(XPW.on!==null)return XPW.on;let on=false;try{on=XPW.can()&&!!XPW.ROUTES&&!window.XPW_OFF;
  if(on){let v=null;try{v=localStorage.getItem('vs.pw');}catch(e){}if(v==='0'||(v!=='1'&&XPW.lowMem()))on=false;}}catch(e){on=false;}
 if(on&&!XPW.w){try{const w=XPW.mk();XPW.w=w;w.onmessage=XPW.msg;w.onerror=e=>{XPW.fail('worker error: '+((e&&e.message)||'load failed'));};}catch(e){on=false;XPW.w=null;}}
 return XPW.on=on;};
XPW.fail=function(m){XPW.on=false;XPW.stat.err++;XPW.pend.clear();XPW.res.clear();XPW.ow.clear();try{if(XPW.w)XPW.w.terminate();}catch(e){}XPW.w=null;try{if(window.xCrash)xCrash.log('path-worker',String(m).slice(0,200),false);}catch(e){}};
XPW.msg=function(ev){const d=ev.data;if(XPW.drop){XPW.drop();XPW.drop=null;}if(!d)return;if(d.t==='b'){for(const r of d.rs)XPW.one(r);return;}XPW.one(d);};
// jobs posted in a frame leave together once the frame's script is done (one wake-up of the worker per frame)
XPW.send=function(job){XPW.q.push(job);if(!XPW.qf){XPW.qf=true;(typeof queueMicrotask==='function'?queueMicrotask:f=>Promise.resolve().then(f))(XPW.flush);}};
XPW.flush=function(){const q=XPW.q;XPW.q=[];XPW.qf=false;if(!q.length||!XPW.w)return;try{XPW.w.postMessage({t:'b',jobs:q});}catch(e){XPW.fail(e&&e.message);}};
XPW.one=function(d){
 if(d.t==='ready'){if(d.ver===XPW.ver)XPW.rver=d.ver;return;}
 if(d.ver!==XPW.ver)return;const p=XPW.pend.get(d.key);if(!p){XPW.stat.late++;return;}
 if(d.t==='need'){/* the climbs it met with no answer: nmClimbOk (memoised, the same rule the synchronous search applies) for as many as fit
   in ~1.5 ms, then the job again; any left are asked again by the next pass; a buy-phase warm search (sb) answers them with the spawn walls
   down, as xhpWarm's own search does (NMB.sbOff) */const C=XPW.C,ab=d.ab,t0=performance.now(),add=[],sb=!!p.job.sb;
  if(sb)NMB.sbOff=1;try{for(let i=0;i<ab.length;i+=2){const v=!!nmClimbOk(C,ab[i],ab[i+1]);add.push(ab[i],ab[i+1],v?1:0);if(performance.now()-t0>1.5)break;}}catch(e){XPW.pend.delete(d.key);XPW.put(d.key,{err:1,msg:'climb'});return;}finally{if(sb)NMB.sbOff=0;}
  const cl=XPW.cdelta()||[];for(const x of add)cl.push(x);p.job.cl=cl;XPW.stat.need++;XPW.send(p.job);return;}
 XPW.pend.delete(d.key);if(d.t==='res'){const st=XPW.stat,age=performance.now()-p.t;st.res++;st.wms+=d.ms||0;if(d.ms>st.wmax)st.wmax=d.ms;st.age+=age;if(age>st.amax)st.amax=age;if(p.job.t==='a')XPW.insA(p.job,d);else XPW.put(d.key,d);}else{XPW.stat.werr++;XPW.put(d.key,{err:1,msg:d.msg});if(d.msg==='stale')XPW.C=null;/* the worker lost the map: sent again */}};
// an A* answer goes straight into nmPath's caches with nmPath's own tail: the unreachable memo (ran dry, no ban), then the path with
// its eviction rule (oldest out at 1200 / 200); a key a synchronous search filled meanwhile is left as it is
XPW.insA=function(job,d){const C=XPW.C;if(!C||!d.path)return;const n=C.nav.nodes.length,s=job.s,e=job.e,ck=s*n+e,ban=!!(job.ban&&job.ban.length);let bk=null;if(ban){bk=''+ck;for(const q of job.ban)bk+='|'+q;}
 if(ban?(NM.banCache&&NM.banCache.has(bk)):NM.routeCache.has(ck))return;
 if(d.dry){const UK=-1-e,U0=NM.routeCache.get(UK),U=U0||new Uint8Array(n),cl=d.dry;for(let i=0;i<n;i++)if(cl[i])U[i]=1;if(!U0){if(NM.routeCache.size>=1200)NM.routeCache.delete(NM.routeCache.keys().next().value);NM.routeCache.set(UK,U);}}
 const path=Array.from(d.path);if(ban){const BC=NM.banCache||(NM.banCache=new Map());if(BC.size>=200)BC.delete(BC.keys().next().value);BC.set(bk,path);}else{if(NM.routeCache.size>=1200)NM.routeCache.delete(NM.routeCache.keys().next().value);NM.routeCache.set(ck,path);}XPW.stat.used++;};
XPW.put=function(k,v){if(XPW.res.size>=256)XPW.res.delete(XPW.res.keys().next().value);XPW.res.set(k,v);};
// climb memo entries the worker has not seen yet, as [a, b, 0|1, ...]: the memo Map's own set also queues each new entry (one push,
// instead of walking the whole memo per job); a new memo Map starts over with what it already holds
XPW.cdelta=function(){const C=XPW.C,M=C&&C.climbMemo;if(!M)return null;
 if(M!==XPW.cm){XPW.cm=M;const Q=XPW.cq=[];for(const [k,v]of M)Q.push(k,v);if(!Object.prototype.hasOwnProperty.call(M,'set')){const set=Map.prototype.set;M.set=function(k,v){if(XPW.cm===this&&!this.has(k))XPW.cq.push(k,v);return set.call(this,k,v);};}}
 const Q=XPW.cq;if(!Q||!Q.length)return null;const out=[];for(let i=0;i<Q.length;i+=2){const k=Q[i],j=k.indexOf('>');out.push(+k.slice(0,j),+k.slice(j+1),Q[i+1]?1:0);}Q.length=0;return out;};
// the worker serves this map: same C, same flat adjacency (a rebuilt C.csr = the graph grew), same rope links; else (re)send it
XPW.live=function(C){if(!C||!C.nav||!C.csr||C.csr.adj!==C.nav.adj||C.csr.n!==C.nav.nodes.length)return false;const rn=C.ropeLinks?C.ropeLinks.size:0;
 if(XPW.C===C&&XPW.csr===C.csr&&XPW.ropeN===rn)return XPW.rver===XPW.ver;
 const G=C.csr,N=C.nav.nodes,n=N.length,xyz=new Float64Array(n*3);for(let i=0;i<n;i++){const p=N[i];xyz[i*3]=p[0];xyz[i*3+1]=p[1];xyz[i*3+2]=p[2];}
 const job={t:'init',ver:++XPW.ver,n,xyz,off:G.off.slice(),to:G.to.slice(),el:G.el.slice(),dyc:G.dyc.slice(),up:G.up.slice(),x:G.x.slice(),z:G.z.slice(),rope:C.ropeLinks?[...C.ropeLinks.keys()]:[]};
 XPW.C=C;XPW.csr=G;XPW.ropeN=rn;XPW.cm=null;XPW.cq=null;XPW.pend.clear();XPW.res.clear();XPW.ow.clear();XPW.q.length=0;XPW.stat.init++;
 try{XPW.w.postMessage(job,[job.xyz.buffer,job.off.buffer,job.to.buffer,job.el.buffer,job.dyc.buffer,job.up.buffer,job.x.buffer,job.z.buffer]);}catch(e){XPW.fail(e&&e.message);}return false;};
// post a job once (false: run it synchronously now - timed out, queue full, worker gone)
// post a job once (false: run it synchronously now - timed out, queue full, worker gone). One job in flight per owner (a unit's A*, a
// unit's lane): while it runs the owner waits for it rather than queueing a search per node it walks past
XPW.ask=function(key,job,owner){if(!XPW.w)return false;const now=performance.now(),ok=XPW.ow.get(owner);
 if(ok!==undefined&&ok!==key){const q=XPW.pend.get(ok);if(q){if(now-q.t>XPW.TO){XPW.pend.delete(ok);XPW.ow.delete(owner);XPW.stat.to++;return false;}return true;}}
 const p=XPW.pend.get(key);if(p){if(now-p.t>XPW.TO){XPW.pend.delete(key);XPW.ow.delete(owner);XPW.stat.to++;return false;}return true;}
 if(XPW.pend.size>=XPW.MAXP)return false;job.ver=XPW.ver;job.key=key;job.cl=XPW.cdelta();XPW.pend.set(key,{t:now,job});XPW.ow.set(owner,key);XPW.stat.post++;XPW.send(job);return true;};
// innermost nmPath wrapper (installed before BOT VARIETY / ropes wrap it): in xPath's re-plan, a search not in the caches goes to the worker
if(typeof nmPath==='function'){const np0=nmPath;nmPath=function(C,s,e,banned){
 if((XPW.ctx===null&&XPW.soft===null)||C!==XPW.C||!(s>=0)||!(e>=0)||s===e)return np0.apply(this,arguments);
 const n=C.nav.nodes.length,ck=s*n+e,ban=!!(banned&&banned.size>0);let bk=null,key;
 if(!ban){if(NM.routeCache.has(ck))return np0.apply(this,arguments);key='a'+ck;}else{bk=''+ck;for(const q of banned.keys())bk+='|'+q;if(NM.banCache&&NM.banCache.has(bk))return np0.apply(this,arguments);key='b'+bk;}
 const UM=NM.routeCache.get(-1-e);if(UM&&UM[s])return np0.apply(this,arguments);/* known unreachable: nmPath answers [] at once */
 const r=XPW.res.get(key);if(r){XPW.res.delete(key);XPW.stat.sync++;return np0.apply(this,arguments);}/* the worker failed this one */
 if(!XPW.ask(key,{t:'a',s,e,ban:ban?[...banned.keys()]:null,sb:XPW.sb},XPW.ctx!==null?XPW.ctx:key)){XPW.stat.sync++;return np0.apply(this,arguments);}XPW.stat.miss++;throw XPW_MISS;};}
// BotRoutes.route (BOT VARIETY's lane re-route) the same way; wrapped on first use (BotRoutes loads after this block)
XPW.wrapRoutes=function(){if(XPW.rw||!window.BotRoutes||typeof BotRoutes.route!=='function')return;XPW.rw=true;const r0=BotRoutes.route;BotRoutes.route=function(nav,base,seed,peers,allowed,banned,edgeOk){
 const C=XPW.C;if(XPW.ctx===null||!C||nav!==C.nav||allowed||!base||base.length<3)return r0.apply(this,arguments);
 let key='r'+seed+(edgeOk?'|e':'|n');const ban=!!(banned&&banned.size);if(ban)for(const q of banned.keys())key+='|'+q;
 /* the lane comes back for the node the unit stood on when it was asked; from where the unit stands now on that lane (as xbvPath's own
    reuse of a lane), else asked again from here */
 const r=XPW.res.get(key);if(r){XPW.res.delete(key);if(r.err||!r.path){XPW.stat.sync++;return r0.apply(this,arguments);}const k=r.path.indexOf(base[0]);if(k>=0&&r.path[r.path.length-1]===base[base.length-1]){XPW.stat.used++;return Array.from(k?r.path.subarray(k):r.path);}}
 const pp=[];if(peers)for(const pe of peers)if(pe&&pe.path)pp.push(Int32Array.from(pe.path.slice(0,24)));/* route reads a peer's first 24 nodes */
 if(!XPW.ask(key,{t:'r',base:Int32Array.from(base),seed:String(seed),peers:pp,ban:ban?[...banned.keys()]:null,eo:!!edgeOk},key)){XPW.stat.sync++;return r0.apply(this,arguments);}XPW.stat.miss++;throw XPW_MISS;};};
// xPath (the native re-plan wrapper above): run with the async searches on; a miss puts back what the re-plan changed before nmNext
if(typeof xPath==='function'){const xp=xPath;xPath=function(u,dt,gx,gz,out){
 if(XPW.on===false||XPW.ctx!==null||!u||!u.g||typeof nmActive!=='function')return xp.apply(this,arguments);
 const C=nmActive();if(!C||!XPW.enabled()||!XPW.live(C))return xp.apply(this,arguments);if(!XPW.rw)XPW.wrapRoutes();
 const npT=u.npT,npS=u.npS,xpp=u.xpp,xfm=u.xfm,xfK=u.xfK,xf=u.xf,xfE=u.xfE,xfe=u.xfe;XPW.ctx=u;
 try{return xp.apply(this,arguments);}
 catch(e){if(e!==XPW_MISS)throw e;/* as a re-plan deferred by NM_RP: the timer ran, the old target stays, the next frame tries again */
  u.npT=(npT||0)-dt;u.npS=(npS||0)+dt;u.xpp=xpp;u.xfm=xfm;u.xfK=xfK;u.xf=xf;u.xfE=xfE;u.xfe=xfe;if(typeof NM_RP!=='undefined'&&NM_RP.n>0)NM_RP.n--;
  if(u.np)return u.np;const p=u.g.position;return [p.x,p.z];}
 finally{XPW.ctx=null;}};}
// ---- END PATH WORKER ----
