// Shared client/server routing and spacing. Costs are preferences, never permanent blockers.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BotRoutes=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const grids=new WeakMap();
 function hash(s){let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
 function grid(nav){let cells=grids.get(nav);if(cells)return cells;cells=new Map();nav.nodes.forEach((p,i)=>{const key=Math.floor(p[0]/3)+','+Math.floor(p[2]/3);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);});grids.set(nav,cells);return cells;}
 function length(nav,p){let d=0;for(let i=1;i<p.length;i++){const a=nav.nodes[p[i-1]],b=nav.nodes[p[i]];d+=Math.hypot(a[0]-b[0],a[2]-b[2]);}return d;}
 function route(nav,base,seed,peers=[],allowed=null,banned=null){
  if(base.length<3)return base;
  const N=nav.nodes,start=base[0],end=base[base.length-1],cells=grid(nav),penalty=new Map();
  for(const peer of peers){if(!peer||!peer.path)continue;for(let k=1;k<Math.min(24,peer.path.length);k+=3){const q=N[peer.path[k]];if(!q)continue;const cx=Math.floor(q[0]/3),cz=Math.floor(q[2]/3);
   for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const i of cells.get(x+','+z)||[]){const p=N[i],d=Math.hypot(p[0]-q[0],p[2]-q[2]);if(d<2.4&&Math.abs(p[1]-q[1])<1)penalty.set(i,Math.min(5,(penalty.get(i)||0)+(2.4-d)*1.5));}
  }}
  const phase=(hash(seed)%65536)/65536*Math.PI*2,g=new Float64Array(N.length).fill(Infinity),prev=new Int32Array(N.length).fill(-1),closed=new Uint8Array(N.length),heap=[];
  const h=i=>Math.hypot(N[i][0]-N[end][0],N[i][2]-N[end][2]);
  const push=(i,s)=>{let k=heap.length;heap.push([i,s]);while(k){const p=(k-1)>>1;if(heap[p][1]<=s)break;heap[k]=heap[p];k=p;}heap[k]=[i,s];};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[k]=heap[c];k=c;}heap[k]=last;}return first[0];};
  g[start]=0;push(start,h(start));let steps=0;
  while(heap.length&&steps++<N.length*6){const a=pop();if(closed[a])continue;if(a===end){const out=[];for(let i=end;i>=0;i=prev[i])out.push(i);out.reverse();return length(nav,out)<=length(nav,base)*1.5+2?out:base;}closed[a]=1;
   for(const b of nav.adj[a]){if(closed[b]||(allowed&&!allowed(b))||(banned&&banned.has(a+'>'+b)))continue;const p=N[b],q=N[a],d=Math.hypot(p[0]-q[0],p[2]-q[2]),lane=.22*(1+Math.sin(p[0]*.17+p[2]*.13+phase));
    const nearGoal=h(b)<2.5,c=g[a]+d*(1+lane+(nearGoal?0:penalty.get(b)||0))+Math.abs(p[1]-q[1])*.2;
    if(c<g[b]){g[b]=c;prev[b]=a;push(b,c+h(b));}
   }
  }return base;
 }
 // Soft steering away from nearby bodies; deterministic right-of-way prevents mirror oscillation.
 function steer(me,others,dx,dz,id=0){let sx=0,sz=0;for(const o of others){if(!o||o===me||Math.abs((o.y||0)-(me.y||0))>1.5)continue;let x=me.x-o.x,z=me.z-o.z,d=Math.hypot(x,z);if(d>=1.35)continue;if(d<.001){x=(id&1)?1:-1;z=(id&2)?1:-1;d=Math.SQRT2;}
  const k=Math.max(0,(1.35-Math.min(d,1.3))/1.35);sx+=x/d*k;sz+=z/d*k;
 }const n=Math.hypot(dx,dz);if(!n)return [dx,dz];const x=dx/n+sx*.9,z=dz/n+sz*.9,l=Math.hypot(x,z)||1;return [x/l*n,z/l*n];}
 return {route,steer,hash,length};
});
