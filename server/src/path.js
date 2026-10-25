// A* over the nav graph. The graph and its allowed set never change during a room, so results are cached per world
// (bounded LRU; callers get a copy because bots shift() their routes), and the search buffers are reused with a
// generation stamp instead of being allocated and filled for every call.
const state=new WeakMap(),CACHE=1024;
// Flat (CSR) adjacency with per-edge costs, built once per world; Simulation calls this at room creation so the first
// match tick does not pay for it.
// Nav nodes whose standing capsule (r 0.3) intersects collision sit inside props or walls (about 3-6% of playable nodes
// on the native maps). Routes may still pass them (they can be a doorway's only link, or a start/goal), but entering one
// costs BLOCKED_COST extra metres, so bots walk around obstacles instead of wedging into them.
export const BLOCKED_COST=8;
export function blockedNodes(W){const nav=W.nav;if(nav.blockedNodes)return nav.blockedNodes;const N=nav.nodes,b=new Uint8Array(N.length);if(typeof W.blocked==='function')for(const i of W.allowed||[])b[i]=W.blocked(N[i][0],N[i][2],.3,N[i][1],1.8)?1:0;Object.defineProperty(nav,'blockedNodes',{value:b,enumerable:false});return b;}
export function prepare(W,S=stateFor(W)){if(S.g)return S.g;const N=W.nav.nodes,A=W.nav.adj,off=new Int32Array(N.length+1);for(let i=0;i<N.length;i++)off[i+1]=off[i]+A[i].length;
 const nb=new Int32Array(off[N.length]),eh=new Float64Array(nb.length),ev=new Float64Array(nb.length),ok=new Uint8Array(N.length);for(const i of W.allowed)ok[i]=1;
 const bl=blockedNodes(W);for(let a=0;a<N.length;a++){let q=off[a];for(const b of A[a]){nb[q]=b;eh[q]=Math.hypot(N[a][0]-N[b][0],N[a][2]-N[b][2]);ev[q]=Math.abs(N[a][1]-N[b][1])*.2+(bl[b]?BLOCKED_COST:0);q++;}}
 S.hi=new Int32Array(1024);S.hs=new Float64Array(1024);return S.g={off,nb,eh,ev,ok};}
function stateFor(W){let S=state.get(W.nav);if(!S){const n=W.nav.nodes.length;S={prev:new Int32Array(n),cost:new Float32Array(n),stamp:new Uint32Array(n),closed:new Uint32Array(n),gen:0,cache:new Map(),allowed:W.allowed};state.set(W.nav,S);}return S;}
export function path(W,start,end){const S=stateFor(W);
 if(S.allowed!==W.allowed)return search(W,start,end);const id=start*W.nav.nodes.length+end,hit=S.cache.get(id);if(hit){S.cache.delete(id);S.cache.set(id,hit);return hit.slice();}
 const r=searchFast(W,S,start,end);S.cache.set(id,r);if(S.cache.size>CACHE)S.cache.delete(S.cache.keys().next().value);return r.slice();}
function searchFast(W,S,start,end){if(start===end)return [start];const N=W.nav.nodes,{prev,cost,stamp,closed}=S,gen=++S.gen,ex=N[end][0],ez=N[end][2];
 const G=prepare(W,S),ok=G.ok,off=G.off,nb=G.nb,EH=G.eh,EV=G.ev;let hi=S.hi,hs=S.hs,n=0;
 // Binary heap with the reference implementation's exact sift order (ties pop in the same order).
 const push=(i,s)=>{if(n===hi.length){const a=new Int32Array(n*2),b=new Float64Array(n*2);a.set(hi);b.set(hs);S.hi=hi=a;S.hs=hs=b;}let k=n++;while(k){const p=(k-1)>>1;if(hs[p]<=s)break;hi[k]=hi[p];hs[k]=hs[p];k=p;}hi[k]=i;hs[k]=s;};
 const pop=()=>{const r=hi[0],li=hi[n-1],ls=hs[n-1];n--;if(n){let k=0;while(k*2+1<n){let c=k*2+1;if(c+1<n&&hs[c+1]<hs[c])c++;if(hs[c]>=ls)break;hi[k]=hi[c];hs[k]=hs[c];k=c;}hi[k]=li;hs[k]=ls;}return r;};
 stamp[start]=gen;cost[start]=0;prev[start]=-1;push(start,Math.hypot(N[start][0]-ex,N[start][2]-ez));
 while(n){const a=pop();if(closed[a]===gen)continue;closed[a]=gen;if(a===end){const p=[];for(let i=end;i>=0;i=prev[i])p.push(i);return p.reverse();}const ca=cost[a];for(let q=off[a],qe=off[a+1];q<qe;q++){const b=nb[q];if(closed[b]===gen||!ok[b])continue;const c=ca+EH[q]+EV[q];/* same evaluation order as the reference */if(stamp[b]!==gen||c<cost[b]){stamp[b]=gen;cost[b]=c;prev[b]=a;push(b,c+Math.hypot(N[b][0]-ex,N[b][2]-ez));}}}return [];}
// Reference search (the original allocation-per-call version); used when a caller passes a world view with a different
// allowed set, and by test-perf.js to check the fast path returns identical routes.
export function search(W,start,end){if(start===end)return [start];const N=W.nav.nodes,A=W.nav.adj,bl=blockedNodes(W),prev=new Int32Array(N.length).fill(-1),cost=new Float32Array(N.length).fill(Infinity),closed=new Uint8Array(N.length),heap=[];cost[start]=0;const h=i=>Math.hypot(N[i][0]-N[end][0],N[i][2]-N[end][2]),push=(i,s)=>{let k=heap.length;heap.push([i,s]);while(k){const p=(k-1)>>1;if(heap[p][1]<=s)break;heap[k]=heap[p];k=p;}heap[k]=[i,s];},pop=()=>{const r=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[k]=heap[c];k=c;}heap[k]=last;}return r[0];};push(start,h(start));while(heap.length){const a=pop();if(closed[a])continue;closed[a]=1;if(a===end){const p=[];for(let i=end;i>=0;i=prev[i])p.push(i);return p.reverse();}for(const b of A[a]){if(closed[b]||!W.allowed.has(b))continue;const c=cost[a]+Math.hypot(N[a][0]-N[b][0],N[a][2]-N[b][2])+(Math.abs(N[a][1]-N[b][1])*.2+(bl[b]?BLOCKED_COST:0));if(c<cost[b]){cost[b]=c;prev[b]=a;push(b,c+h(b));}}}return [];}
