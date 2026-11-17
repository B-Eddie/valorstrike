// botlag (2026-11-16): nmPath's unreachable memo and per-search ban numbers give the same routes. A failed unbanned search
// that ran out of nodes marks every node it closed as unable to reach that end (routeCache key -1-end), so later searches from
// those nodes to it (any ban set: a ban only removes edges) answer [] without exploring the whole reachable map again (4-26 ms
// each on Ascent in an offline round: xhpRoute / xpaCorner probing an unreachable pre-aim spot from each new node, a stuck
// bot's stall-breaker under a growing ban set). Checked on the real nav graphs of all six maps: a long run of plain and banned
// queries with the cache kept (memo live, the eviction cap included) gives exactly the routes of the same searches each run on
// an empty cache, with a deterministic stand-in for the BVH climb rule, and the memo is used (searches skipped).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const nm=fs.readFileSync(path.join(root,'work/native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const fn=(s,a)=>{const i=s.indexOf(a);assert(i>=0,'missing '+a);return s.slice(i,s.indexOf('\n}',i)+2);},one=(s,a)=>{const i=s.indexOf(a);assert(i>=0,'missing '+a);return s.slice(i,s.indexOf('\n',i));};
const CUR=fn(nm,'function nmPath(');assert(html.includes(CUR.split('\n')[0]),'index.html carries the regenerated nmPath');
assert(CUR.includes("UK=-1-end")&&CUR.includes('banN.has(a*N.length+b)'),'nmPath memo + numeric bans present');
let seed=41;const rnd=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296;let skipped=0,fails=0,total=0;
for(const map of ['ascent','bind','haven','split','lotus','breeze']){
 const nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',map,'navigation.json'),'utf8')),N=nav.nodes;
 const climb=(C,a,b)=>((a*7919+b*104729)%5)!==0;
 const X={Map,Set,Number,Object,Array,Math,Float32Array,Float64Array,Int32Array,Uint8Array,Infinity,Error,JSON,String,WeakMap,nmClimbOk:climb,NM:{routeCache:new Map()},window:{}};vm.createContext(X);
 vm.runInContext([one(nm,'function nmConnected('),CUR,'globalThis.F={nmConnected,nmPath};'].join('\n'),X);const F=X.F;
 const C={key:map,nav};F.nmConnected(C);const play=[],off=[];for(let i=0;i<N.length;i++)(C.playable[i]?play:off).push(i);
 const pick=a=>a[Math.floor(rnd()*a.length)];
 // a few hard ends: off-map nodes (other components) and playable ones; starts walk along like a moving bot (neighbours)
 const ends=[];for(let k=0;k<6;k++)ends.push(off.length?pick(off):pick(play));for(let k=0;k<6;k++)ends.push(pick(play));
 const fresh=(s,e,B)=>{const keep=X.NM.routeCache,kb=X.NM.banCache;X.NM.routeCache=new Map();X.NM.banCache=null;const st=X.NM.st||0;const r=F.nmPath(C,s,e,B);X.NM.st=st;X.NM.routeCache=keep;X.NM.banCache=kb;return JSON.stringify(r);};
 let s=pick(play);
 for(let q=0;q<900;q++){
  if(rnd()<.3)s=pick(rnd()<.2&&off.length?off:play);else{const A=nav.adj[s];if(A&&A.length)s=A[Math.floor(rnd()*A.length)];}
  const e=ends[Math.floor(rnd()*ends.length)];let B;if(rnd()<.25){B=new Map();const A=nav.adj[s]||[];for(const b of A.slice(0,2))B.set(s+'>'+b,1e9);B.set('junk-key',1);B.set('07>5',1);}
  const U=X.NM.routeCache.get(-1-e),memo=!!(U&&U[s]);const st0=X.NM.st||0,live=JSON.stringify(F.nmPath(C,s,e,B)),ran=(X.NM.st||0)>st0;const ref=fresh(s,e,B);
  assert.equal(live,ref,map+' '+s+'>'+e+(B?' banned':''));total++;if(live==='[]')fails++;if(memo){assert.equal(live,'[]','memo only for unreachable');if(!ran)skipped++;}}
}
assert(skipped>20,'the memo answered failed searches without exploring: '+skipped);
console.log('Nav unreachable memo: '+total+' queries on 6 maps identical to fresh searches ('+fails+' unreachable, '+skipped+' answered from the memo without a search); numeric ban keys skip the same edges');
