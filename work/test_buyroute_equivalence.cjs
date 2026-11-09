// lag lane 2026-11-09: vendor/bot-brain.cjs buyRoute (the buy-phase A*, shared by the page and the server) on typed scratch
// gives the same routes as the code before (embedded below as REF, 23300be) on the real nav graphs of all six maps: full-graph
// and random restricted areas, node costs drawn from the real values (0 / 5 / 6 / 8 and sums, so score ties happen), and
// cost() called for the same nodes in the same order; a throwing cost() leaves no stale scratch; and a call allocates far
// less (it was the page's top allocation site: perf_match_profile Ascent 5v5, ~52 % of the page's sampled heap).
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),inspector=require('inspector');const root=path.join(__dirname,'..');
const BotBrain=require(path.join(root,'vendor/bot-brain.cjs'));
const REF=" function refBuyRoute(nodes,adj,area,a,b,cost){\n  if(a<0||b<0||!area.f[a]||!area.f[b])return [];if(a===b)return [a];\n  const g=new Map(),prev=new Map(),done=new Set(),H=[],h=i=>Math.hypot(nodes[i][0]-nodes[b][0],nodes[i][2]-nodes[b][2]);\n  const push=(i,sc)=>{H.push([i,sc]);let k=H.length-1;while(k){const p=(k-1)>>1;if(H[p][1]<=H[k][1])break;[H[p],H[k]]=[H[k],H[p]];k=p;}};\n  const pop=()=>{const r=H[0],l=H.pop();if(H.length){H[0]=l;let k=0;for(;;){let c=k*2+1;if(c>=H.length)break;if(c+1<H.length&&H[c+1][1]<H[c][1])c++;if(H[c][1]>=H[k][1])break;[H[c],H[k]]=[H[k],H[c]];k=c;}}return r[0];};\n  g.set(a,0);push(a,h(a));\n  while(H.length){const i=pop();if(done.has(i))continue;done.add(i);if(i===b){const p=[];for(let k=b;k!=null;k=prev.get(k))p.push(k);return p.reverse();}\n   for(const j of adj[i]){if(!area.f[j]||done.has(j))continue;const c=g.get(i)+Math.hypot(nodes[i][0]-nodes[j][0],nodes[i][2]-nodes[j][2])+Math.abs(nodes[i][1]-nodes[j][1])*.2+(cost?cost(j):0);\n    if(!(g.get(j)<=c)){g.set(j,c);prev.set(j,i);push(j,c+h(j));}}}\n  return [];}\n";
const refBuyRoute=new Function(REF+';return refBuyRoute;')();
let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
let queries=0,found=0,calls=0;const nav0={};
for(const map of ['ascent','bind','breeze','haven','lotus','split']){
 const nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',map,'navigation.json'),'utf8')),N=nav.nodes,adj=nav.adj;nav0[map]={N,adj};
 for(let rep=0;rep<6;rep++){
  const f=new Uint8Array(N.length);const keep=rep===0?1:0.7+rnd()*0.25;for(let i=0;i<N.length;i++)f[i]=rnd()<keep?1:0;const area={f};
  const pen=new Float64Array(N.length);for(let i=0;i<N.length;i++){const r=rnd();pen[i]=r<0.08?8:r<0.13?6:r<0.17?5:r<0.19?13:0;}
  const inA=[];for(let i=0;i<N.length;i++)if(f[i])inA.push(i);
  for(let q=0;q<60;q++){const a=rnd()<0.03?-1:inA[Math.floor(rnd()*inA.length)],b=rnd()<0.03?a:inA[Math.floor(rnd()*inA.length)],useCost=rnd()<0.85;
   const s1=[],s2=[],c1=useCost?(j)=>{s1.push(j);return pen[j];}:undefined,c2=useCost?(j)=>{s2.push(j);return pen[j];}:undefined;
   const r1=refBuyRoute(N,adj,area,a,b,c1),r2=BotBrain.buyRoute(N,adj,area,a,b,c2);queries++;if(r1.length)found++;calls+=s1.length;
   assert.deepEqual(r2,r1,map+' route '+a+' -> '+b);assert.deepEqual(s2,s1,map+' cost() call order '+a+' -> '+b);}}
}
// a throwing cost() mid-search: the next searches are unaffected
{const {N,adj}=nav0.ascent,f=new Uint8Array(N.length).fill(1),area={f};let n=0;
 const a0=adj.findIndex((l)=>l.length>0),b0=adj[a0].find((j)=>j!==a0)===N.length-1?0:N.length-1;
 assert.throws(()=>BotBrain.buyRoute(N,adj,area,a0,b0,()=>{if(++n>3)throw Error('boom');return 0;}),/boom/);assert(n>3,'cost() was called');
 for(let q=0;q<20;q++){const a=Math.floor(rnd()*N.length),b=Math.floor(rnd()*N.length);assert.deepEqual(BotBrain.buyRoute(N,adj,area,a,b),refBuyRoute(N,adj,area,a,b),'after a throw '+a+' -> '+b);}}
// allocation per search (sampled heap): the same queries through both, under the page's allocation-free Math.hypot
// (work/hypot_runtime.js, bit-identical; Node's builtin allocates ~48 B per call, two calls per relaxed edge)
require('vm').runInThisContext(fs.readFileSync(path.join(root,'work/hypot_runtime.js'),'utf8'));assert(Math.hypot.__xHyp,'page Math.hypot installed');
const sess=new inspector.Session();sess.connect();sess.post('HeapProfiler.enable');
const {N,adj}=nav0.ascent,f=new Uint8Array(N.length).fill(1),area={f},Q=[];for(let i=0;i<300;i++)Q.push([Math.floor(rnd()*N.length),Math.floor(rnd()*N.length)]);
const bytes=(fn)=>{for(const [a,b] of Q.slice(0,30))fn(N,adj,area,a,b,()=>0);let tot=0;sess.post('HeapProfiler.startSampling',{samplingInterval:512,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});for(const [a,b] of Q)fn(N,adj,area,a,b,()=>0);sess.post('HeapProfiler.stopSampling',(e,r)=>{(function w(nd){tot+=nd.selfSize||0;for(const c of nd.children||[])w(c);})(r.profile.head);});return tot/Q.length;};
const bRef=bytes(refBuyRoute),bNew=bytes(BotBrain.buyRoute);
console.log(`buyRoute: ${queries} searches on six maps (${found} routes, ${calls} cost() calls) identical to the reference, order included; ${(bRef/1024).toFixed(1)} -> ${(bNew/1024).toFixed(1)} KB allocated per search (Ascent, full graph)`);
assert(bNew<bRef/4,'buyRoute allocates '+bNew.toFixed(0)+' B per search (reference '+bRef.toFixed(0)+')');
