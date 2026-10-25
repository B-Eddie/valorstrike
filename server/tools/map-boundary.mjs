// Boundary escape scan: from every border cell of the playable navigation area, try to leave it with the shared motor
// (the one the server and the offline client both run) and the server's movement abilities:
//  walk, jump, crouch-jump, Jett dash (8 m flat, server abilities.js), Jett updraft (+air strafe), updraft + dash at the
//  apex, Raze satchel (8 m flat) at a jump's apex. Outcomes:
//  fall:   ended more than 3 m below the lowest playable floor, or 12 m below the start, with no playable floor near
//          (left the world / fell into a void; the fall guard would have to rescue)
//  perch:  standing (grounded) more than 1.2 m above the start with no valid nav node within 1.5 m horizontally at any
//          height (a rooftop or out-of-bounds ledge off the footprint). Standing on a ledge/box beside the nav (within
//          1.5 m of a node, not sampled by it) is counted as 'ledge', not an escape.
//  out:    standing outside the map's footprint (no leash node - playable or reachable valid component - within 3 m)
// Usage: node tools/map-boundary.mjs [maps...]  (STRIDE=n samples every n-th border node; JSON=path writes the report)
import fs from 'node:fs';import {loadWorld} from '../src/world.js';import {createRequire} from 'node:module';
process.chdir(new URL('..',import.meta.url).pathname);
const require=createRequire(import.meta.url),Motor=require('../src/motor.cjs');
export const MAPS=['ascent','bind','haven','split','lotus','breeze'];
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
export function index(w){const N=w.nav.nodes,cells=new Map();let ymin=Infinity;for(const i of w.playable){const p=N[i];ymin=Math.min(ymin,p[1]);const k=Math.floor(p[0])+','+Math.floor(p[2]);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(p);}
 const nearest=(x,z,y,R)=>{let best=null,bd=Infinity;const r=Math.ceil(R);for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)for(const p of cells.get((Math.floor(x)+dx)+','+(Math.floor(z)+dz))||[]){const h=Math.hypot(p[0]-x,p[2]-z);if(h>R)continue;const d=h+(y==null?0:Math.abs(p[1]-y)*2);if(d<bd){bd=d;best=p;}}return best;};
 const onNav=(x,z,y)=>{for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(const p of cells.get((Math.floor(x)+dx)+','+(Math.floor(z)+dz))||[])if(Math.hypot(p[0]-x,p[2]-z)<1.3&&Math.abs(p[1]-y)<1.2)return true;return false;};
 // the leash's footprint (playable + reachable valid components; shared motor leashGrid)
 const LG=Motor.leashGrid(N,w.nav.valid,w.nav.adj);
 const nearValid=(x,z,R)=>{const r=Math.ceil(R);for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){const l=LG.get((Math.floor(x)+dx)*4096+Math.floor(z)+dz);if(l)for(let i=0;i<l.length;i+=3)if(Math.hypot(l[i]-x,l[i+2]-z)<=R)return true;}return false;};
 return {nearest,onNav,nearValid,ymin};}
const DT=1/30;
function sim(w,P,dir,plan,T,ymin){const out={maxUp:0};const y0=P.y;let still=0;for(let t=0;t<T;t+=DT){const inp={x:dir[0],z:dir[1],speed:6.75,jump:false,duck:false};plan(t,P,inp);Motor.step(P,inp,DT,w);out.maxUp=Math.max(out.maxUp,P.y-y0);if(P.y<y0-30||P.y<ymin-3.5)break;const g=!P.air&&Math.abs(P.vy||0)<.01;if(g&&t>.4&&Math.hypot(P.vx,P.vz)<.05){if((still+=DT)>.25)break;}else still=0;}return out;}
// Server abilities (abilities.js): dash 32 x .25 m, satchel 16 x .5 m, both flat at the unit's height; updraft vy = sqrt(2*18*6).
function flat(w,P,dir,n,s){for(let i=0;i<n;i++){const x=P.x+dir[0]*s,z=P.z+dir[1]*s;if(w.blocked(x,z,.4,P.y,1.8-(P.ch||0))||(w.leash&&!w.leash(x,z,P.y,P.x,P.z)))break;P.x=x;P.z=z;}P.vx=P.vz=0;}
export const PROBES={
 walk:{T:1,plan:()=>{}},
 jump:{T:1.3,plan:(t,P,i)=>{i.jump=t<.1;}},
 crouchjump:{T:1.3,plan:(t,P,i)=>{i.jump=t<.1;i.duck=t>.12;}},
 dash:{T:1.3,plan:(t,P,i,d,w)=>{if(t===0)flat(w,P,d,32,.25);}},
 updraft:{T:2,plan:(t,P)=>{if(t===0){P.vy=Math.sqrt(2*18*6);P.air=true;}}},
 updraftdash:{T:2.2,plan:(t,P,i,d,w)=>{if(t===0){P.vy=Math.sqrt(2*18*6);P.air=true;}if(Math.abs(t-20*DT)<1e-6)flat(w,P,d,32,.25);}},
 jumpsatchel:{T:1.8,plan:(t,P,i,d,w)=>{i.jump=t<.1;if(Math.abs(t-10*DT)<1e-6)flat(w,P,d,16,.5);}},
};
export function borders(w){const N=w.nav.nodes,S=w.nav.step||.75,out=[];const key=p=>Math.round(p[0]/S*4)+','+Math.round(p[2]/S*4);
 for(const i of w.playable){const p=N[i],nb=w.nav.adj[i].filter(j=>w.allowed.has(j)).map(j=>N[j]),dirs=[];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(!nb.some(q=>Math.abs(q[0]-p[0]-dx*S)<.05&&Math.abs(q[2]-p[2]-dz*S)<.05))dirs.push([dx,dz]);
  if(!dirs.length)continue;let ox=0,oz=0;for(const d of dirs){ox+=d[0];oz+=d[1];}const L=Math.hypot(ox,oz);const D=dirs.slice();if(L>.01&&dirs.length>1)D.push([ox/L,oz/L]);out.push({i,p,dirs:D});}return out;}
export async function scanBoundary(key,w,{stride=1,probes=Object.keys(PROBES)}={}){w=w||await loadWorld(assets,key);if(process.env.NOLEASH)delete w.leash;const X=index(w),B=borders(w),res={key,borderNodes:B.length,probes:0,fall:[],perch:[],out:[],ledge:0};
 const b0=+process.env.FROM||0,b1=Math.min(B.length,+process.env.TO||B.length);for(let b=b0;b<b1;b+=stride){const {p,dirs}=B[b];const y0=w.ground(p[0],p[2],p[1]+.1);if(w.blocked(p[0],p[2],.4,y0,1.8))continue;
  for(const d of (process.env.DIRS==='all'?dirs:[dirs[dirs.length-1]]))for(const name of probes){const pr=PROBES[name],P={x:p[0],z:p[2],y:y0,vx:0,vz:0,vy:0,ch:0};res.probes++;const r=sim(w,P,d,(t,P_,inp)=>pr.plan(t,P_,inp,d,w),pr.T,X.ymin);
   const g=!P.air,rec={probe:name,from:[p[0],+y0.toFixed(2),p[2]],dir:d.map(v=>+v.toFixed(2)),to:[+P.x.toFixed(2),+P.y.toFixed(2),+P.z.toFixed(2)]};
   const lowF=X.nearest(P.x,P.z,null,1.3);
   if((P.y<X.ymin-3||P.y<y0-12)&&!(lowF&&Math.abs(lowF[1]-P.y)<1.5)){res.fall.push(rec);continue;}
   if(!g)continue;
   if(!X.nearValid(P.x,P.z,3)){res.out.push(rec);continue;}
   if(!X.onNav(P.x,P.z,P.y)&&P.y>y0+1.2){if(X.nearValid(P.x,P.z,1.5))res.ledge++;else res.perch.push(Object.assign(rec,{up:+(P.y-y0).toFixed(2)}));}}}
 return res;}
export function groups(list){const G=[];for(const r of list){let g=G.find(g=>Math.abs(g.y-r.to[1])<1.5&&Math.hypot(g.x-r.to[0],g.z-r.to[2])<3);if(!g){g={x:r.to[0],y:r.to[1],z:r.to[2],n:0,probes:new Set(),from:r.from,ex:[]};G.push(g);}g.n++;g.probes.add(r.probe);if(g.ex.length<3)g.ex.push(r);}return G.map(g=>({at:[g.x,g.y,g.z],n:g.n,probes:[...g.probes],from:g.from,ex:g.ex}));}
if(import.meta.url===`file://${process.argv[1]}`){const maps=process.argv.slice(2).length?process.argv.slice(2):MAPS,all={},stride=+process.env.STRIDE||1,probes=process.env.PROBES?process.env.PROBES.split(','):undefined;
 for(const key of maps){const t=Date.now(),r=await scanBoundary(key,null,{stride,probes});const s={borderNodes:r.borderNodes,probes:r.probes,ledge:r.ledge,fall:groups(r.fall),perch:groups(r.perch),out:groups(r.out)};all[key]=s;
  console.log(key,r.borderNodes,'border nodes',r.probes,'probes',r.fall.length,'fall',r.perch.length,'perch',r.out.length,'out',r.ledge,'ledge',((Date.now()-t)/1000).toFixed(0)+'s');
  for(const k of ['fall','out','perch'])for(const g of s[k])console.log(' ',k.toUpperCase(),JSON.stringify({at:g.at,n:g.n,probes:g.probes,from:g.from}));}
 if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(all,null,1));}
