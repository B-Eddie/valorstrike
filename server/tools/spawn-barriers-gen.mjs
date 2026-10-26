// Spawn barrier generator (offline tool; the game reads the committed segments in vendor/spawn-barriers.cjs).
// For each map and side: the spawn region = the nav nodes near the spawn anchor; the barriers sit at the narrowest
// doorways out of it = a minimum vertex cut of the navigation graph between the spawn core (geodesic <= RIN m from
// the anchor, plus every server spawn candidate) and the rest of the map (geodesic >= ROUT m). Each connected group
// of cut nodes is one doorway: a straight panel along the group's principal axis, extended to the walls on both
// sides (horizontal rays at floor + 0.5 / 1.2 / 2 m), from the doorway floor up to a ceiling or 6 m.
// usage: node tools/spawn-barriers-gen.mjs [map ...]  (env RIN, ROUT; per-map overrides in TUNE below)
import fs from 'node:fs';import {loadWorld} from '../src/world.js';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
export const TUNE={};
export function undirected(nav){const U=nav.nodes.map(()=>new Set());nav.adj.forEach((l,i)=>l.forEach(j=>{U[i].add(j);U[j].add(i);}));return U.map(s=>[...s]);}
export function geodesic(nav,U,ok,s0,cap=200){const N=nav.nodes,g=new Float64Array(N.length).fill(Infinity);g[s0]=0;const H=[[0,s0]];
 const push=e=>{H.push(e);let k=H.length-1;while(k){const p=(k-1)>>1;if(H[p][0]<=H[k][0])break;[H[p],H[k]]=[H[k],H[p]];k=p;}};
 const pop=()=>{const r=H[0],l=H.pop();if(H.length){H[0]=l;let k=0;for(;;){let c=2*k+1;if(c>=H.length)break;if(c+1<H.length&&H[c+1][0]<H[c][0])c++;if(H[c][0]>=H[k][0])break;[H[c],H[k]]=[H[k],H[c]];k=c;}}return r;};
 while(H.length){const [d,i]=pop();if(d>g[i]||d>cap)continue;for(const j of U[i]){if(!ok(j))continue;const c=d+Math.hypot(N[i][0]-N[j][0],N[i][2]-N[j][2],(N[i][1]-N[j][1])*.5);if(c<g[j]){g[j]=c;push([c,j]);}}}return g;}
// min vertex cut (Dinic on the split graph): src set S, sink set T (infinite), every other node capacity 1
function minCut(n,U,ok,S,T){const INF=1e9,head=new Int32Array(2*n+2).fill(-1),to=[],cap=[],nxt=[],add=(a,b,c)=>{to.push(b);cap.push(c);nxt.push(head[a]);head[a]=to.length-1;to.push(a);cap.push(0);nxt.push(head[b]);head[b]=to.length-1;};
 const s=2*n,t=2*n+1;for(let i=0;i<n;i++){if(!ok(i))continue;add(2*i,2*i+1,S.has(i)||T.has(i)?INF:1);if(S.has(i))add(s,2*i,INF);if(T.has(i))add(2*i+1,t,INF);for(const j of U[i])if(ok(j))add(2*i+1,2*j,INF);}
 const lvl=new Int32Array(2*n+2),it=new Int32Array(2*n+2);let flow=0;
 const bfs=()=>{lvl.fill(-1);lvl[s]=0;const q=[s];for(let k=0;k<q.length;k++){const v=q[k];for(let e=head[v];e>=0;e=nxt[e])if(cap[e]>0&&lvl[to[e]]<0){lvl[to[e]]=lvl[v]+1;q.push(to[e]);}}return lvl[t]>=0;};
 const dfs=(v,f)=>{if(v===t)return f;for(;it[v]>=0;it[v]=nxt[it[v]]){const e=it[v],w=to[e];if(cap[e]>0&&lvl[w]===lvl[v]+1){const d=dfs(w,Math.min(f,cap[e]));if(d>0){cap[e]-=d;cap[e^1]+=d;return d;}}}return 0;};
 while(bfs()){it.set(head);let f;while((f=dfs(s,INF))>0){flow+=f;if(flow>5000)return null;}}
 // residual reachability from s
 const seen=new Uint8Array(2*n+2),q=[s];seen[s]=1;for(let k=0;k<q.length;k++){const v=q[k];for(let e=head[v];e>=0;e=nxt[e])if(cap[e]>0&&!seen[to[e]]){seen[to[e]]=1;q.push(to[e]);}}
 const cut=[],inside=new Uint8Array(n);for(let i=0;i<n;i++){if(seen[2*i])inside[i]=1;if(seen[2*i]&&!seen[2*i+1])cut.push(i);}return {flow,cut,inside};}
export function wallDist(w,x,y,z,dx,dz,max){let best=0;for(const h of [.5,1.2,2]){const d=w.ray([x,y+h,z],[dx,0,dz],max);best=Math.max(best,d===Infinity?max:d);}return best;}
export async function generate(key,w,o={}){const nav=w.nav,N=nav.nodes,U=undirected(nav),ok=i=>w.allowed.has(i),out={};
 for(const side of ['atk','def']){const T0=Object.assign({rin:+process.env.RIN||12,rout:+process.env.ROUT||30},(TUNE[key]||{})[side],o[side]);
  const a=side==='atk'?w.map.attacker:w.map.defender,s0=w.near(a[0],a[2],a[1]),g=geodesic(nav,U,ok,s0,T0.rout+5),S=new Set(),T=new Set();
  for(const i of w.playable){if(g[i]<=T0.rin||(Math.hypot(N[i][0]-a[0],N[i][2]-a[2])<12&&Math.abs(N[i][1]-a[1])<2&&g[i]<T0.rout))S.add(i);else if(g[i]>=T0.rout)T.add(i);}
  const r=minCut(N.length,U,ok,S,T);if(!r){out[side]={err:'no cut'};continue;}
  // group the cut nodes (within 2.3 m / 3 m up of each other) into doorways
  const left=new Set(r.cut),groups=[];while(left.size){const f=left.values().next().value,G=[f];left.delete(f);for(let k=0;k<G.length;k++)for(const j of [...left])if(Math.hypot(N[j][0]-N[G[k]][0],N[j][2]-N[G[k]][2])<2.3&&Math.abs(N[j][1]-N[G[k]][1])<3){left.delete(j);G.push(j);}groups.push(G);}
  const P=groups.map(G=>panel(w,N,G,r.inside,T0));
  // close the gaps between neighbouring doorway panels (a 1.2 m gap lets a capsule through): ends within 2.5 m meet
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++)for(const ei of [0,P[i].p.length-1])for(const ej of [0,P[j].p.length-1]){const a=P[i].p[ei],b=P[j].p[ej];if(Math.hypot(a[0]-b[0],a[1]-b[1])<2.5){const m=[+((a[0]+b[0])/2).toFixed(2),+((a[1]+b[1])/2).toFixed(2)];P[i].p[ei]=m;P[j].p[ej]=m.slice();}}
  out[side]={flow:r.flow,inside:r.inside,groups:P};}
 return out;}
// one doorway: chain its cut nodes end to end (from the extreme along the principal axis, nearest next), simplify
// (Douglas-Peucker 0.6 m), extend both ends to the wall (2.5 m at most; 1 m past the last node when no wall: the leash
// keeps capsules on the nav footprint there). in: +1 when the left normal (-dz, dx) of the first piece faces spawn.
function panel(w,N,G,inside,T0){const P=G.map(i=>N[i]),mx=P.reduce((s,p)=>s+p[0],0)/P.length,mz=P.reduce((s,p)=>s+p[2],0)/P.length,y0=Math.min(...P.map(p=>p[1])),y1=Math.max(...P.map(p=>p[1]));
 let xx=0,zz=0,xz=0;for(const p of P){xx+=(p[0]-mx)**2;zz+=(p[2]-mz)**2;xz+=(p[0]-mx)*(p[2]-mz);}const ang=.5*Math.atan2(2*xz,xx-zz),ux=Math.cos(ang),uz=Math.sin(ang);
 const rest=P.map(p=>[p[0],p[2]]);rest.sort((a,b)=>((a[0]-mx)*ux+(a[1]-mz)*uz)-((b[0]-mx)*ux+(b[1]-mz)*uz));let chain=[rest.shift()];
 while(rest.length){const l=chain[chain.length-1];let bi=0,bd=Infinity;rest.forEach((q,i)=>{const d=Math.hypot(q[0]-l[0],q[1]-l[1]);if(d<bd){bd=d;bi=i;}});chain.push(rest.splice(bi,1)[0]);}
 const dp=(pts,tol)=>{if(pts.length<3)return pts;const a=pts[0],b=pts[pts.length-1],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;let im=0,dm=0;for(let i=1;i<pts.length-1;i++){const d=Math.abs((b[0]-a[0])*(a[1]-pts[i][1])-(a[0]-pts[i][0])*(b[1]-a[1]))/L;if(d>dm){dm=d;im=i;}}return dm>tol?dp(pts.slice(0,im+1),tol).concat(dp(pts.slice(im),tol).slice(1)):[a,b];};
 let pl=dp(chain,.6);if(pl.length===1){pl=[[pl[0][0]-ux*.01,pl[0][1]-uz*.01],[pl[0][0]+ux*.01,pl[0][1]+uz*.01]];}
 const ext=(p,q)=>{let dx=p[0]-q[0],dz=p[1]-q[1];const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const d=wallDist(w,p[0],y0,p[1],dx,dz,2.5);const e=d<2.5?d+.3:1.5;return [p[0]+dx*e,p[1]+dz*e];};
 pl[0]=ext(pl[0],pl[1]);pl[pl.length-1]=ext(pl[pl.length-1],pl[pl.length-2]);
 const [a,b]=pl,dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,cxm=(a[0]+b[0])/2,czm=(a[1]+b[1])/2,nx=-dz/l,nz=dx/l;
 const side=sg=>{let c=0;for(const d of [.8,1.5,2.2]){const i=w.near(cxm+nx*d*sg,czm+nz*d*sg,y0+.5);if(i>=0&&Math.hypot(N[i][0]-cxm-nx*d*sg,N[i][2]-czm-nz*d*sg)<.8)c+=inside[i]?1:-1;}return c;};
 // top: a ceiling over the doorway or 6 m
 let top=6;for(const q of pl){const h=w.ray([q[0],y1+.3,q[1]],[0,1,0],6);if(h<Infinity)top=Math.min(top,h+.3+y1-y0);}
 return {n:G.length,p:pl.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]),y:[+(y0-.4).toFixed(2),+(y0+Math.max(3,top)).toFixed(2)],in:side(1)>=side(-1)?1:-1,pts:G.map(i=>[N[i][0],N[i][2]])};}

// Leak check for one spawn with the committed walls (SB = vendor/spawn-barriers.cjs):
//  nav: breadth-first over the navigation from the spawn anchor, an edge that crosses (or passes within 0.3 m of) a wall
//       is shut; no node 30 m+ (geodesic, without walls) from the anchor may be reached.
//  capsule: a 0.25 m grid flood of a standing 0.4 m capsule (world.blocked incl. the walls, leash, 0.55 m step up,
//       floor followed) from the anchor; no cell may lie by a node 30 m+ away.
export function leak(w,key,side,SB,o={}){const nav=w.nav,N=nav.nodes,U=undirected(nav),ok=i=>w.allowed.has(i),a=side==='atk'?w.map.attacker:w.map.defender,s0=w.near(a[0],a[2],a[1]),far=o.far||30,g=geodesic(nav,U,ok,s0,far+40);
 const seen=new Uint8Array(N.length),q=[s0];seen[s0]=1;const navOut=[];
 for(let k=0;k<q.length;k++){const i=q[k];if(g[i]>=far){navOut.push(N[i]);continue;}for(const j of U[i]){if(seen[j]||!ok(j))continue;if(SB.crossing(key,N[i][0],N[i][2],N[j][0],N[j][2],Math.max(N[i][1],N[j][1])+.5,.3))continue;seen[j]=1;q.push(j);}}
 const res={nav:navOut.length,navAt:navOut.slice(0,3),inside:q.length,cap:0,capAt:[],cells:0};if(o.nav)return res;
 const blk=(x,z,y)=>w.blocked(x,z,.4,y,1.8)||SB.blocked(key,x,z,.4,y,1.8),S=.25,C=new Map(),Q=[];/* seeds: every free spawn-core node (geodesic <= 12 m) */for(const i of q){if(g[i]>12)continue;const x=Math.round(N[i][0]/S)*S,z=Math.round(N[i][2]/S)*S,y=w.ground(x,z,N[i][1]+.3);if(!(Math.abs(y-N[i][1])<.6)||blk(x,z,y))continue;const kk=Math.round(x/S)+','+Math.round(z/S);if(C.has(kk))continue;C.set(kk,1);Q.push([x,z,y]);}res.seeds=Q.length;
 for(let k=0;k<Q.length&&k<400000;k++){const [x,z,y]=Q[k];const i=w.near(x,z,y);if(i>=0&&g[i]>=far&&Math.hypot(N[i][0]-x,N[i][2]-z)<1){res.cap++;if(res.capAt.length<3)res.capAt.push([x,y,z].map(v=>+v.toFixed(2)));if(o.trace&&!res.path){res.path=[];for(let m=k;m!=null&&m>=0;m=Q[m][3])res.path.push(Q[m].slice(0,3).map(v=>+v.toFixed(2)));res.path=res.path.filter((_,i)=>i%8==0);}continue;}
  for(const [dx,dz] of [[S,0],[-S,0],[0,S],[0,-S]]){const nx=x+dx,nz=z+dz,key2=Math.round(nx/S)+','+Math.round(nz/S);if(C.has(key2))continue;const ny=w.ground(nx,nz,y+.55);if(!(ny<=y+.55&&ny>y-1.5))continue;if(w.leash&&!w.leash(nx,nz,ny,x,z))continue;if(blk(nx,nz,ny))continue;C.set(key2,1);Q.push([nx,nz,ny,k]);}}
 res.cells=Q.length;return res;}
export function writeData(path,data){let s=fs.readFileSync(path,'utf8');const a=s.indexOf(' // ---- DATA'),b=s.indexOf(' // ---- END DATA ----');
 const body=Object.keys(data).sort().map(k=>'  '+k+':{'+['atk','def'].map(sd=>sd+':['+data[k][sd].map(P=>'{p:'+JSON.stringify(P.p)+',y:'+JSON.stringify(P.y)+',in:'+P.in+'}').join(',')+']').join(',')+'}').join(',\n');
 s=s.slice(0,a)+' // ---- DATA (server/tools/spawn-barriers-gen.mjs --write) ----\n const DATA={\n'+body+'\n };\n'+s.slice(b);fs.writeFileSync(path,s);}
if(import.meta.url===`file://${process.argv[1]}`){const args=process.argv.slice(2),write=args.includes('--write'),maps=args.filter(a=>!a.startsWith('--')).length?args.filter(a=>!a.startsWith('--')):['ascent','bind','breeze','haven','lotus','split'];
 if(write){const SB=require('../../vendor/spawn-barriers.cjs'),data=Object.assign({},SB.DATA);for(const key of maps){const w=await loadWorld(assets,key),r=await generate(key,w);data[key]={atk:r.atk.groups.map(({p,y,in:i})=>({p,y,in:i})),def:r.def.groups.map(({p,y,in:i})=>({p,y,in:i}))};
   // seal: a capsule that still slips past a panel end (a gap the wall rays missed) -> that end grows 0.5 m, again
   for(const side of ['atk','def'])for(let it=0;it<16;it++){SB.set(key,data[key]);const L=leak(w,key,side,SB,{trace:true});if(!L.cap&&!L.nav)break;const path=L.path||L.navAt.map(n=>[n[0],n[2]]);let best=null;
    for(const P of data[key][side])for(const e of [0,P.p.length-1]){const q=P.p[e];for(const pt of path){const d=Math.hypot(pt[0]-q[0],pt[1]-q[1]);if(!best||d<best.d)best={d,P,e};}}
    if(!best)break;const P=best.P,e=best.e,q=P.p[e],o=P.p[e?e-1:1],dx=q[0]-o[0],dz=q[1]-o[1],l=Math.hypot(dx,dz)||1;P.p[e]=[+(q[0]+dx/l*.5).toFixed(2),+(q[1]+dz/l*.5).toFixed(2)];console.log('seal',key,side,JSON.stringify(q),'->',JSON.stringify(P.p[e]));}
   SB.set(key,data[key]);}writeData(new URL('../../vendor/spawn-barriers.cjs',import.meta.url).pathname,data);console.log('wrote',maps.join(' '));process.exit(0);}
 for(const key of maps){const w=await loadWorld(assets,key),r=await generate(key,w);for(const s in r){delete r[s].inside;if(r[s].groups&&!process.env.PTS)r[s].groups.forEach(g=>delete g.pts);}console.log(JSON.stringify({key,...r}));}}
