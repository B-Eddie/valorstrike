// Round-start hitch (user, 75 Hz: "When round starts, it goes down to 30fps"), offline 5v5 on a native map. At the buy ->
// round transition every bot standing on its goal asked xhpAngles for the corners an enemy comes from: up to five map-wide
// A* searches each (enemy spawn, the sites, mid), none cached - ~40 ms of a ~60 ms frame in the page harness. And the shared
// route cache was wiped whole at its 201st entry (often on that very frame), so routes the previous round found were
// searched again. Guards:
//  1. nmPath (unit, real Ascent nav graph): a search under a ban set is served again for the same ban set (bots with a
//     stalled edge banned for 30 s searched every re-plan uncached) and stays route-for-route equal to a fresh search for
//     any other ban set; the shared cache keeps recent routes past 200 entries (oldest out first, never wiped whole).
//  2. page (work/page_harness.cjs, native Ascent + collision BVH, offline 5v5): no A* search runs inside xhpAngles on the
//     round-start frame (xhpWarm puts those routes in the cache during the last seconds of the buy phase, spawn walls off
//     as the action phase searches them), and the cache is not wiped on that frame;
//     nor any corner set's sight rays (xhpWarm works out each still unit's set for its exact position; xhpAngles takes it on a
//     miss for that same position only);
//  3. same game: every unit's position / facing / hp from the last 9 s of the buy phase to 10 s into the round is identical
//     with the warm-up off (XHPW.win = 0) - the routes are only found earlier, never different.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const nm=fs.readFileSync(path.join(root,'work/native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const one=(a)=>{const i=nm.indexOf(a);assert(i>=0,'missing '+a);return nm.slice(i,nm.indexOf('\n',i));},fn=(a)=>{const i=nm.indexOf(a);assert(i>=0,'missing '+a);return nm.slice(i,nm.indexOf('\n}',i)+2);};
assert(html.includes(fn('function nmPath(').split('\n')[0]),'index.html carries the regenerated nmPath');
// ---- 1. nmPath caches ----
{const ctx={NM:{routeCache:new Map()},window:{}};ctx.nmClimbOk=(C,a,b)=>((a*7919+b*104729)%5)!==0;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'work/hypot_runtime.js'),'utf8'),ctx);
 vm.runInContext([one('const NM_NONE=[];function nmCellNum('),fn('function nmPath('),one('function nmConnected('),'globalThis.X={nmPath,nmConnected};'].join('\n'),ctx);const X=ctx.X;
 const nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps/ascent/navigation.json'),'utf8')),C={nav,cells:new Map()};X.nmConnected(C);const N=nav.nodes;
 const play=[];for(let i=0;i<N.length;i++)if(C.playable[i])play.push(i);let seed=5;const rnd=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296,pick=()=>play[Math.floor(rnd()*play.length)];
 // a fresh search (nothing cached anywhere): the reference answer
 const fresh=(s,e,B)=>{const keep=ctx.NM;ctx.NM={routeCache:new Map()};try{return X.nmPath(C,s,e,B&&B.size?new Set(B.keys()):undefined);}finally{ctx.NM=keep;}};
 let bannedHits=0,checked=0;
 for(let k=0;k<40;k++){const s=pick(),e=pick(),r=fresh(s,e);if(r.length<4)continue;
  const B=new Map([[r[1]+'>'+r[2],1e9]]);/* nmNext's u.xb: a Map edge -> expiry */const a=X.nmPath(C,s,e,B);assert.deepEqual(a,fresh(s,e,B),'banned search = fresh search');
  const b=X.nmPath(C,s,e,new Map([[r[1]+'>'+r[2],5]]));if(b===a)bannedHits++;assert.deepEqual(b,a,'same ban set, same route');
  const B2=new Map([[r[1]+'>'+r[2],1],[r[2]+'>'+r[3],1]]),c=X.nmPath(C,s,e,B2);assert.notEqual(c,a,'another ban set is searched again');assert.deepEqual(c,fresh(s,e,B2),'two bans = fresh search');
  assert.deepEqual(X.nmPath(C,s,e),r,'unbanned route unchanged');checked++;}
 assert(checked>=20,'enough routes checked ('+checked+')');assert.equal(bannedHits,checked,'a repeated ban set is served from the cache ('+bannedHits+'/'+checked+')');
 ctx.NM.routeCache.clear();const first=[pick(),pick()],r0=X.nmPath(C,first[0],first[1]);for(let k=0;k<260;k++)X.nmPath(C,pick(),pick());
 assert.equal(X.nmPath(C,first[0],first[1]),r0,'a route 260 searches old is still cached (the cache was wiped whole at 201 entries)');
 assert(ctx.NM.routeCache.size<=1200,'route cache bounded ('+ctx.NM.routeCache.size+')');
 for(let k=0;k<1500;k++)X.nmPath(C,pick(),pick());assert(ctx.NM.routeCache.size<=1200,'route cache bounded after 1760 searches ('+ctx.NM.routeCache.size+')');}
console.log('nmPath: banned-route cache + bounded route cache OK');
// ---- 2 / 3. page: round-start frame ----
const {boot}=require('./page_harness.cjs');
async function run(win){const H=boot({real3:true,seed:3,native:true,fastGlobal:true}),xe=H.xe,tick=()=>new Promise(r=>setImmediate(r));
 xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
 xe(`J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true`);
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await tick();}};
 for(let i=0;i<400&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);assert(xe('!!nmActive()'),'native Ascent loaded');
 if(win!=null)xe('XHPW.win='+win+';true');
 // A* searches (not served by a cache) made inside xhpAngles, and route-cache wipes, per frame
 xe(`(()=>{const W=window.__RS={inX:0,xA:0,xc:0,miss:0,wipe:0};if(typeof xhpCalc==='function'){const xc=xhpCalc;xhpCalc=function(){if(W.inX)W.xc++;return xc.apply(this,arguments);};}else W.xc=-1;const np=nmPath;nmPath=function(C,s,e,b){const z=NM.routeCache.size,k=s*C.nav.nodes.length+e,hit=!(b&&b.size)&&NM.routeCache.has(k)||!!(b&&b.size&&NM.banCache&&NM.banCache.size&&[...NM.banCache.keys()].some(q=>q.startsWith(k+'|')));const r=np.apply(this,arguments);if(!hit){W.miss++;if(W.inX)W.xA++;}if(NM.routeCache.size<z-1)W.wipe++;return r;};
  const xa=xhpAngles;xhpAngles=function(){W.inX++;try{return xa.apply(this,arguments);}finally{W.inX--;}};return true;})()`);
 const SIG=`(()=>{const r=v=>Math.round(v*1e4);const o=[r(player.x),r(player.z)];for(const b of bots.concat(allies)){const p=b.g&&b.g.position;o.push(b.alive?1:0,b.hp|0,p?r(p.x):0,p?r(p.z):0,b.g?r(b.g.rotation.y):0);}return o.join(",");})()`;
 const sig=[];let prev=xe('FV.buy'),start=-1,trans=null,after=0;
 for(let i=0;i<6000;i++){if(start<0||i>start+2)xe('__RS.xA=0;__RS.xc=__RS.xc<0?-1:0;__RS.miss=0;__RS.wipe=0;true');H.frameMs(1000/60);const buy=xe('FV.buy');
  if(buy<=9)sig.push(xe(SIG));if(start<0&&prev>0&&!(buy>0))start=i;if(start>=0&&i===start+2)trans=JSON.parse(xe('JSON.stringify(__RS)'));/* the frame the clock runs out and the two after it (the bots' first action tick) */prev=buy;if(start>=0&&++after>=600)break;if((i&7)===7)await tick();}
 assert(start>=0,'round started');const errs=(H.errors||[]).filter(e=>!/\[object Object\]/.test(String(e&&(e.message||e.e||e))));
 return {trans,sig,start,errs:errs.length,warmed:xe('typeof XHPW!=="undefined"?XHPW.n:-1'),sets:xe('typeof XHPW!=="undefined"&&XHPW.hit!=null?XHPW.hit:-1')};}
(async()=>{const a=await run(null);
 assert.equal(a.errs,0,'no page errors');
 assert.equal(a.trans.xA,0,'no A* search inside xhpAngles on the round-start frames ('+a.trans.xA+' of '+a.trans.miss+' searches; warmed '+a.warmed+')');
 assert.equal(a.trans.wipe,0,'route cache not wiped on the round-start frame');
 assert(a.sets>0,'corner sets worked out in the buy phase are used at round start ('+a.sets+')');assert.equal(a.trans.xc,0,'no corner set (sight rays) worked out inside xhpAngles on the round-start frames ('+a.trans.xc+')');
 const b=await run(0);assert.equal(b.start,a.start,'same round-start frame');assert.equal(b.sig.length,a.sig.length,'same frames');
 for(let i=0;i<a.sig.length;i++)assert.equal(a.sig[i],b.sig[i],'frame '+i+' (round start at '+(a.start)+'): unit states identical with the warm-up off');
 console.log('Round-start routes: round-start frame '+a.trans.miss+' searches, 0 in xhpAngles (warm-up off: '+b.trans.xA+' of '+b.trans.miss+'), '+a.warmed+' routes warmed in the buy phase, '+a.sets+' corner sets taken from it (warm-up off: '+b.trans.xc+' worked out on the round-start frames); '+a.sig.length+' frames identical with the warm-up off');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
