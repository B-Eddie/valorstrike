// Shared client/server routing and spacing. Costs are preferences, never permanent blockers.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BotRoutes=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const grids=new WeakMap();
 function hash(s){let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
 function grid(nav){let cells=grids.get(nav);if(cells)return cells;cells=new Map();nav.nodes.forEach((p,i)=>{const key=Math.floor(p[0]/3)+','+Math.floor(p[2]/3);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);});grids.set(nav,cells);return cells;}
 function length(nav,p){let d=0;for(let i=1;i<p.length;i++){const a=nav.nodes[p[i-1]],b=nav.nodes[p[i]];d+=hyp(a[0]-b[0],a[2]-b[2]);}return d;}
 // edgeOk(a,b) (optional): directed edge filter, e.g. the client's instinct climb rule (dy > 0.321 must pass nmClimbOk).
 // perf2: per-nav scratch (cost / prev / closed arrays and a typed index/score heap) reused across searches, and the
 // banned-edge string built only when the set has entries: the old search allocated three node-sized typed arrays plus an
 // [i,s] pair per push (~2 MB per call on an 11k-node map, a GC per re-route). Same pushes, pops, comparisons and order.
 const scratch=new WeakMap();
 function newScratch(n){return {n,g:new Float64Array(n),prev:new Int32Array(n),closed:new Uint8Array(n),pen:new Float64Array(n),tl:new Int32Array(256),tn:0,hi:new Int32Array(1024),hs:new Float64Array(1024),busy:false};}
 // Math.hypot(x, z) computed as V8's builtin does it (max scaling + Kahan sum; with two terms the compensation is exactly 0
 // after the first, so qa*qa+qb*qb is the same op sequence): bit-identical, and inlinable without boxing (the builtin copies its
 // arguments into a new array per call; route calls it ~3x per edge it relaxes). Zero / Infinity / NaN go to the builtin: a
 // constant Infinity / NaN return (or the page's JS Math.hypot inlined here without the unary +) would make the inlined
 // result a tagged value and box every hypot.
 function hyp(x,z){const a=Math.abs(x),b=Math.abs(z),m=a>b?a:b;if(m>0&&m<Infinity&&a===a){const qa=a/m,qb=b/m;return Math.sqrt(qa*qa+qb*qb)*m;}return +Math.hypot(x,z);}
 function route(nav,base,seed,peers=[],allowed=null,banned=null,edgeOk=null){
  if(base.length<3)return base;
  const N=nav.nodes,start=base[0],end=base[base.length-1],cells=grid(nav),ban=banned&&banned.size?banned:null;
  let S=scratch.get(nav);if(!S||S.n!==N.length){S=newScratch(N.length);scratch.set(nav,S);}
  if(S.busy)S=newScratch(N.length);/* re-entered from an edge filter (or a filter threw mid-search): private arrays */
  S.busy=true;try{
  // peer-lane penalty per node (was a Map): pen[] stays all-zero between searches; tl lists what this search touched
  const pen=S.pen;let tl=S.tl,tn=0;
  for(const peer of peers){if(!peer||!peer.path)continue;for(let k=1;k<Math.min(24,peer.path.length);k+=3){const q=N[peer.path[k]];if(!q)continue;const cx=Math.floor(q[0]/3),cz=Math.floor(q[2]/3);
   for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++){const L=cells.get(x+','+z);if(L)for(let t=0;t<L.length;t++){const i=L[t],p=N[i],d=hyp(p[0]-q[0],p[2]-q[2]);if(d<2.4&&Math.abs(p[1]-q[1])<1){
    if(pen[i]===0){if(tn===tl.length){const nt=new Int32Array(tn*2);nt.set(tl);tl=S.tl=nt;}tl[tn++]=i;S.tn=tn;}pen[i]=Math.min(5,pen[i]+(2.4-d)*1.5);}}}
  }}
  const phase=(hash(seed)%65536)/65536*Math.PI*2,g=S.g.fill(Infinity),prev=S.prev.fill(-1),closed=S.closed.fill(0),ne=N[end],ex=ne[0],ez=ne[2];let hi=S.hi,hs=S.hs,hn=1,steps=0,res=base;
  g[start]=0;hi[0]=start;hs[0]=hyp(N[start][0]-ex,N[start][2]-ez);
  while(hn&&steps++<N.length*6){
   // pop (binary min-heap on (index, score) typed arrays; same sift order as the old [i,s] heap)
   const a=hi[0];hn--;if(hn){const li=hi[hn],ls=hs[hn];let k=0;while(k*2+1<hn){let c=k*2+1;if(c+1<hn&&hs[c+1]<hs[c])c++;if(hs[c]>=ls)break;hi[k]=hi[c];hs[k]=hs[c];k=c;}hi[k]=li;hs[k]=ls;}
   if(closed[a])continue;if(a===end){const out=[];for(let i=end;i>=0;i=prev[i])out.push(i);out.reverse();res=length(nav,out)<=length(nav,base)*1.5+2?out:base;break;}closed[a]=1;
   const q=N[a],qx=q[0],qy=q[1],qz=q[2],ga=g[a],Aa=nav.adj[a];
   for(let j=0;j<Aa.length;j++){const b=Aa[j];if(closed[b]||(allowed&&!allowed(b))||(ban&&ban.has(a+'>'+b))||(edgeOk&&!edgeOk(a,b)))continue;const p=N[b],px=p[0],pz=p[2],d=hyp(px-qx,pz-qz),lane=.22*(1+Math.sin(px*.17+pz*.13+phase));
    const hb=hyp(px-ex,pz-ez),c=ga+d*(1+lane+(hb<2.5?0:pen[b]))+Math.abs(p[1]-qy)*.2;
    if(c<g[b]){g[b]=c;prev[b]=a;const s=c+hb;
     // push
     if(hn===hi.length){const ni=new Int32Array(hn*2),ns=new Float64Array(hn*2);ni.set(hi);ns.set(hs);hi=S.hi=ni;hs=S.hs=ns;}
     let k=hn++;while(k){const pk=(k-1)>>1;if(hs[pk]<=s)break;hi[k]=hi[pk];hs[k]=hs[pk];k=pk;}hi[k]=b;hs[k]=s;}
   }
  }
  return res;
  }finally{const pen=S.pen,tl=S.tl;for(let t=0;t<S.tn;t++)pen[tl[t]]=0;S.tn=0;S.busy=false;}
 }
 // Soft steering away from nearby bodies; deterministic right-of-way prevents mirror oscillation.
 // radius (default 1.35 m body clearance) widens it into teammate spacing; out (optional [x,z]) avoids an allocation.
 function steer(me,others,dx,dz,id=0,radius=1.35,out=null){let sx=0,sz=0;const R=radius,R0=R*(1.3/1.35);for(const o of others){if(!o||o===me||Math.abs((o.y||0)-(me.y||0))>1.5)continue;let x=me.x-o.x,z=me.z-o.z,d=Math.hypot(x,z);if(d>=R)continue;if(d<.001){x=(id&1)?1:-1;z=(id&2)?1:-1;d=Math.SQRT2;}
  const k=Math.max(0,(R-Math.min(d,R0))/R);sx+=x/d*k;sz+=z/d*k;
 }const o=out||[0,0],n=Math.hypot(dx,dz);if(!n){o[0]=dx;o[1]=dz;return o;}const x=dx/n+sx*.9,z=dz/n+sz*.9,l=Math.hypot(x,z)||1;o[0]=x/l*n;o[1]=z/l*n;return o;}
 // Seeded stream (mulberry32): the same bot + round replays the same choices.
 function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 // A standing spot near a goal for one unit: a nav node rMin..rMax from the centre on the centre's floor, at least gap
 // metres from every spot already taken (teammates hold different angles instead of stacking on the goal). ok(i)
 // filters nodes (reachable / playable). Falls back to the closest-gap candidate, then to the centre node.
 function spot(nav,center,taken,rand,{rMin=2,rMax=8,gap=3,ok=null,tries=48}={}){
  const N=nav.nodes,cells=grid(nav),cx=center[0],cy=center[1],cz=center[2];let best=-1,bestGap=-1;
  for(let t=0;t<tries;t++){const a=rand()*Math.PI*2,r=rMin+(rMax-rMin)*Math.sqrt(rand()),x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,list=cells.get(Math.floor(x/3)+','+Math.floor(z/3));if(!list||!list.length)continue;
   const i=list[Math.floor(rand()*list.length)],p=N[i];if(Math.abs(p[1]-cy)>2.5||(ok&&!ok(i)))continue;const d=Math.hypot(p[0]-cx,p[2]-cz);if(d<rMin*.6||d>rMax*1.25)continue;
   let g=Infinity;for(const q of taken)if(q)g=Math.min(g,Math.hypot(p[0]-q[0],p[2]-q[2]));if(g>=gap)return i;if(g>bestGap){bestGap=g;best=i;}}
  return best;
 }
 return {route,steer,hash,length,rng,spot,hyp};
});
