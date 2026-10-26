// Small-prop table for the LOW / MEDIUM draw distance (work/native_maps_runtime.js nmDetailSplit / nmCull).
// A map material's mesh holds many separate props (every wine barrel, lamp, wire, sconce of Ascent in one mesh), so the
// runtime cannot tell a 30 cm bottle from a wall without welding the mesh: 1-2 s on Ascent, too slow for a phone at load.
// This tool does it offline: triangles connected through welded vertices (2 cm) of one primitive form a component; a
// component is SMALL when its box half-diagonal is under 0.4 m (too small to hide any part of a crouched player), or
// under 1 m and NOT SOLID - the client collision mesh (collision.bin) has no triangles of its own inside the component's
// box (+3 cm) - so nothing you can stand behind or bump into above that size is ever dropped (crates, barrels stay). Triangle order = the runtime's after the z-fight fix drops
// (NM_ZFIX.d, applied first in the loader). Output models/valorant/maps/<key>/detail.json:
//   {v:1,r:1,tiny:0.4,m:{material:{n: its triangle count, s: runs [start,len,start,len,...] of small triangles}},small,total}
// Materials shared by two primitives (ambiguous at runtime) are left out.  Usage: node tools/map-detail.mjs [maps...]
import fs from 'node:fs';import {loadRender,root} from './map-render.mjs';
process.chdir(new URL('..',import.meta.url).pathname);
export const MAPS=['ascent','bind','haven','split','lotus','breeze'];
export const DETAIL={r:1,tiny:.4,weld:.02,solidPad:.03,solidTris:4};
const src=fs.readFileSync(new URL('../../work/native_maps_runtime.js',import.meta.url),'utf8'),zl=src.split('\n').find(l=>l.startsWith('var NM_ZFIX='));
export const NM_ZFIX=JSON.parse(zl.slice('var NM_ZFIX='.length,zl.lastIndexOf(';')));
export function detail(key){const R=loadRender(key,{bvh:false}),drop=(NM_ZFIX[key]||{}).d||{},out={v:1,r:DETAIL.r,tiny:DETAIL.tiny,m:{}};
 // collision triangles bucketed by centroid on a 1 m grid
 const cb=fs.readFileSync(root(key)+'collision.bin'),h=new Uint32Array(cb.buffer,cb.byteOffset,2),CP=new Float32Array(cb.buffer.slice(cb.byteOffset+8,cb.byteOffset+8+h[0]*12)),CI=new Uint32Array(cb.buffer.slice(cb.byteOffset+8+h[0]*12,cb.byteOffset+8+h[0]*12+h[1]*4));
 const G=new Map(),gk=(x,z)=>Math.floor(x)*100003+Math.floor(z);for(let t=0;t<CI.length/3;t++){let x=0,z=0;for(let j=0;j<3;j++){x+=CP[CI[t*3+j]*3];z+=CP[CI[t*3+j]*3+2];}const k=gk(x/3,z/3);let l=G.get(k);if(!l)G.set(k,l=[]);l.push(t);}
 const solid=B=>{const e=DETAIL.solidPad;let n=0;for(let gx=Math.floor(B[0]-e);gx<=Math.floor(B[3]+e);gx++)for(let gz=Math.floor(B[2]-e);gz<=Math.floor(B[5]+e);gz++){const l=G.get(gx*100003+gz);if(!l)continue;
  for(const t of l){let ins=true;for(let j=0;j<3&&ins;j++){const v=CI[t*3+j]*3;if(CP[v]<B[0]-e||CP[v]>B[3]+e||CP[v+1]<B[1]-e||CP[v+1]>B[4]+e||CP[v+2]<B[2]-e||CP[v+2]>B[5]+e)ins=false;}if(ins&&++n>=DETAIL.solidTris)return true;}}return false;};
 const names=new Map();for(const p of R.prims)names.set(p.name,(names.get(p.name)||0)+1);
 const par=new Int32Array(R.pos.length/3),find=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;},q=1/DETAIL.weld;let small=0,total=0;
 for(const p of R.prims){if(names.get(p.name)!==1)continue;const cut=new Set(drop[p.name]||[]),tris=[];for(let t=0;t<p.tris;t++)if(!cut.has(t))tris.push(p.tri0+t);total+=tris.length;
  const m=new Map();for(let v=p.vert0;v<p.vert0+p.verts;v++){const k=(Math.round(R.pos[v*3]*q)+65536)*17179869184+(Math.round(R.pos[v*3+1]*q)+65536)*131072+(Math.round(R.pos[v*3+2]*q)+65536),c=m.get(k);if(c===undefined){m.set(k,v);par[v]=v;}else par[v]=c;}
  for(const t of tris){const a=find(R.index[t*3]);for(let j=1;j<3;j++){const b=find(R.index[t*3+j]);if(b!==a)par[b]=a;}}
  const box=new Map();for(const t of tris){const r=find(R.index[t*3]);let B=box.get(r);if(!B)box.set(r,B=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);for(let j=0;j<3;j++){const v=R.index[t*3+j]*3;for(let i=0;i<3;i++){const x=R.pos[v+i];if(x<B[i])B[i]=x;if(x>B[i+3])B[i+3]=x;}}}
  const sm=new Map();for(const [r,B] of box){const h=Math.hypot(B[3]-B[0],B[4]-B[1],B[5]-B[2])/2;sm.set(r,h<DETAIL.tiny||h<DETAIL.r&&!solid(B));}
  const runs=[];let n=0;tris.forEach((t,i)=>{if(!sm.get(find(R.index[t*3])))return;n++;const L=runs.length;if(L&&runs[L-2]+runs[L-1]===i)runs[L-1]++;else runs.push(i,1);});
  if(n){out.m[p.name]={n:tris.length,s:runs};small+=n;}}
 out.small=small;out.total=total;return out;}
if(import.meta.url===`file://${process.argv[1]}`){for(const key of process.argv.slice(2).length?process.argv.slice(2):MAPS){const t=Date.now(),d=detail(key),f=root(key)+'detail.json';fs.writeFileSync(f,JSON.stringify(d));
 console.log(key,'small',d.small,'of',d.total,'materials',Object.keys(d.m).length,'runs',Object.values(d.m).reduce((a,x)=>a+x.s.length/2,0),'bytes',fs.statSync(f).size,((Date.now()-t)/1000).toFixed(1)+'s');}}
