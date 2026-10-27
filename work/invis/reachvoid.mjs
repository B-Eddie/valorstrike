// reachable void scan: flood fill over 0.25 m cells within R of playable nodes, moving only between cells where a
// 0.3 m capsule fits at the source node's height band; a reached cell with no collision within 9 m below = void.
import fs from 'node:fs';import {loadWorld} from '/workspace/work/vs-lane-invis/server/src/world.js';
const key=process.argv[2],R=2.5,st=.25,dir=process.argv[3]||'public';const W=await loadWorld({fetch:async r=>new Response(await fs.promises.readFile(dir+new URL(r.url).pathname))},key);
const N=W.nav.nodes,dom=new Map();// cell -> y (height of the nearest playable node)
for(const i of W.playable){const p=N[i];for(let dx=-R;dx<=R;dx+=st)for(let dz=-R;dz<=R;dz+=st){if(dx*dx+dz*dz>R*R)continue;const ix=Math.round((p[0]+dx)/st),iz=Math.round((p[2]+dz)/st),k=ix+','+iz+','+Math.round(p[1]);const d=dx*dx+dz*dz;const e=dom.get(k);if(!e||e[1]>d)dom.set(k,[p[1],d]);}}
const free=new Map(),q=[];const fits=(ix,iz,y)=>!W.blocked(ix*st,iz*st,.3,y+.35,1.4);
for(const i of W.playable){const p=N[i];const ix=Math.round(p[0]/st),iz=Math.round(p[2]/st),k=ix+','+iz+','+Math.round(p[1]);if(!free.has(k)&&fits(ix,iz,p[1])){free.set(k,p[1]);q.push([ix,iz,Math.round(p[1]),p[1]]);}}
const voids=[];let n=0;
while(q.length){const [ix,iz,yk,y]=q.pop();n++;const g=W.ray([ix*st,y+.6,iz*st],[0,-1,0],9.6);if(!Number.isFinite(g)){voids.push([ix*st,iz*st,+y.toFixed(2)]);continue;}/* do not expand from a void cell */
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const jx=ix+dx,jz=iz+dz,k=jx+','+jz+','+yk;if(free.has(k)||!dom.has(k))continue;if(!fits(jx,jz,y)){free.set(k,null);continue;}free.set(k,y);q.push([jx,jz,yk,y]);}}
const G=[];for(const v of voids){let g=G.find(g=>Math.abs(g.y-v[2])<1.5&&v[0]>=g.x[0]-1&&v[0]<=g.x[1]+1&&v[1]>=g.z[0]-1&&v[1]<=g.z[1]+1);if(!g){g={x:[v[0],v[0]],z:[v[1],v[1]],y:v[2],n:0};G.push(g);}g.n++;g.x=[Math.min(g.x[0],v[0]),Math.max(g.x[1],v[0])];g.z=[Math.min(g.z[0],v[1]),Math.max(g.z[1],v[1])];}
console.log(key,'reached',n,'reachable void cells',voids.length,JSON.stringify(G.sort((a,b)=>b.n-a.n).slice(0,12)));fs.writeFileSync('/workspace/work/vs-lane-invis/work/invis/'+(process.argv[4]||'')+'reachvoid-'+key+'.json',JSON.stringify(voids));
