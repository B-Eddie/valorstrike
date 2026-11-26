// ---- PATH WORKER (BOT VARIETY CALLERS) ----
// The other bot path searches that cost frame time (Chromium, offline 5v5 Ascent, worker off, 60 s: pre-aim corners xpaCorner
// 166 ms / max 12.6 ms, hold corners xhpCalc 97 / 9.2, buy-phase warm xhpWarm 70 / 15, route corners xhpRoute 31 / 9.7, next to
// nmNext's 175 / 16.2) go to the PATH WORKER too, each falling back to what it already does when its per-frame budget is spent:
// xpaCorner -> the last corner (or none), xhpRoute -> none, xhpAngles -> nothing yet (the hold asks again next tick), xhpWarm ->
// no search this frame. The answer lands in nmPath's route cache; the next call computes from it unchanged.
if(typeof XPW==='object'){
 XPW.softOk=function(){if(XPW.on===false||XPW.ctx!==null||XPW.soft!==null||typeof nmActive!=='function')return null;const C=nmActive();if(!C||!XPW.enabled()||!XPW.live(C))return null;return C;};
 XPW.softRun=function(tag,sb,f,self,args,miss){const C=XPW.softOk();if(!C)return f.apply(self,args);XPW.soft=tag;XPW.sb=sb;
  try{return f.apply(self,args);}catch(e){if(e!==XPW_MISS)throw e;return miss(C);}finally{XPW.soft=null;XPW.sb=0;}};
 if(typeof xpaCorner==='function'){const f=xpaCorner;xpaCorner=function(u,tx,ty,tz){return XPW.softRun('pa',0,f,this,arguments,C=>{
  /* xpaCorner's over-budget answer; the search it counted did not run here */if(XPA.f===XNF&&XPA.n>0)XPA.n--;const K=u.xpaK;return K&&K.C===C&&Math.hypot(K.tx-tx,K.tz-tz)<3?K.pt:null;});};}
 if(typeof xhpRoute==='function'){const f=xhpRoute;xhpRoute=function(u,p,hd){return XPW.softRun('hr',0,f,this,arguments,()=>{if(XRT3.f===XNF&&XRT3.n>0)XRT3.n--;return null;});};}
 // xhpCalc swallows errors (its try / catch would cache an empty corner set), so xhpAngles asks for the routes it lacks first
 if(typeof xhpAngles==='function'&&typeof xhpCalc==='function'){const f=xhpAngles;xhpAngles=function(C,x,y,z,atk){const C0=XPW.softOk();if(!C0||C0!==C)return f.apply(this,arguments);
  const k=C.key+'|'+Math.round(x)+','+Math.round(z)+'|'+(atk?1:0);if(XHP.ckey===C.key&&XHP.cache.has(k))return f.apply(this,arguments);
  const W=typeof XHPW!=='undefined'&&XHPW.pre.get(k);if(W&&W.C===C&&W.x===x&&W.y===y&&W.z===z&&W.sig===xhpSig())return f.apply(this,arguments);
  const NL=C.nav.nodes.length,s=nmNear(C,x,z,y);if(s<0||!C.meta)return f.apply(this,arguments);const en=atk?C.meta.defender:C.meta.attacker,L=[en];for(const n in C.meta.sites)L.push(C.meta.sites[n]);L.push(xbvMid(C));
  let wait=false;for(const src of L){const e=nmNear(C,src[0],src[2],src[1]);if(e<0||e===s||NM.routeCache.has(s*NL+e))continue;const UM=NM.routeCache.get(-1-e);if(UM&&UM[s])continue;
   const key='a'+(s*NL+e);if(XPW.ask(key,{t:'a',s,e,ban:null,sb:0},key))wait=true;else return f.apply(this,arguments);}
  return wait?null:f.apply(this,arguments);};}
 // the buy-phase warm-up: its one search a frame posted instead of run (xhpWarm swallows the miss; it picks the same route next frame
 // until the answer is cached); XHK holds the function itself, so the entry is swapped
 if(typeof xhpWarm==='function'){const f=xhpWarm,w=function(){return XPW.softRun('w',1,f,this,arguments,()=>{});};xhpWarm=w;const H=window.XHK;if(H){const i=H.indexOf(f);if(i>=0)H[i]=w;}}
}
// ---- END PATH WORKER (BOT VARIETY CALLERS) ----
