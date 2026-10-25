// Native map render cost model (headless; no GPU). Counts what three.js would submit per frame: an object is drawn
// when its bounding sphere intersects the camera frustum (three's frustum culling), so draw calls = visible objects and
// triangles = their index counts. Viewpoints: VIEWS playable nodes (seeded) at eye height x 8 headings, the game's
// 103 deg horizontal FOV at 16:9, near 0.05, far 500 (native five/retake camera).
//  layout 'source': one object per scene.gltf primitive (what ships before the optimizer)
//  layout 'chunked': the runtime optimizer (work/native_maps_runtime.js nmChunkPlan), evaluated from the runtime source
// Also reports materials, distinct textures, texture bytes at the medium (source) and LOW (256 px) caps.
// Usage: node tools/map-perf.mjs [maps...]   (JSON=path writes the report)
import fs from 'node:fs';import zlib from 'node:zlib';import * as T from 'three';import {loadRender,root} from './map-render.mjs';
process.chdir(new URL('..',import.meta.url).pathname);
export const MAPS=['ascent','bind','haven','split','lotus','breeze'];
const VIEWS=+process.env.VIEWS||48;
export function runtimeApi(){const src=fs.readFileSync(new URL('../../work/native_maps_runtime.js',import.meta.url),'utf8'),pick=n=>{const i=src.indexOf('function '+n+'(');if(i<0)return '';return src.slice(i,src.indexOf('\n',i));};
 const names=['nmChunkPlan','nmDetailDistance'].filter(n=>pick(n));return new Function(names.map(pick).join('\n')+'\nreturn {'+names.join(',')+'};')();}
function pngSize(file){const b=Buffer.alloc(24);const fd=fs.openSync(file,'r');fs.readSync(fd,b,0,24,0);fs.closeSync(fd);return [b.readUInt32BE(16),b.readUInt32BE(20)];}
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function sphereOf(pos,index,tris){// tris: Uint32Array of triangle ids (or null = all); exact centre of the box, radius over vertices
 let a=[Infinity,Infinity,Infinity],b=[-Infinity,-Infinity,-Infinity];const each=f=>{for(let t=0;t<tris.length;t++){const k=tris[t]*3;for(let j=0;j<3;j++)f(index[k+j]*3);}};
 each(v=>{for(let i=0;i<3;i++){const x=pos[v+i];if(x<a[i])a[i]=x;if(x>b[i])b[i]=x;}});const c=[0,1,2].map(i=>(a[i]+b[i])/2);let r2=0;each(v=>{const d=(pos[v]-c[0])**2+(pos[v+1]-c[1])**2+(pos[v+2]-c[2])**2;if(d>r2)r2=d;});return {c,r:Math.sqrt(r2)};}
export function views(key){const nav=JSON.parse(fs.readFileSync(root(key)+'navigation.json')),R=rng(7),valid=nav.nodes.filter((p,i)=>nav.valid[i]),out=[];for(let k=0;k<VIEWS;k++){const p=valid[Math.floor(R()*valid.length)];for(let h=0;h<8;h++)out.push({p:[p[0],p[1]+1.6,p[2]],yaw:h*Math.PI/4});}return out;}
export function count(objects,V){const cam=new T.PerspectiveCamera(70.5,16/9,.05,500),fr=new T.Frustum(),m=new T.Matrix4(),s=new T.Sphere();let calls=0,tris=0;const per=[];
 const vf=2*Math.atan(Math.tan(103*Math.PI/360)/(16/9))*180/Math.PI;cam.fov=vf;cam.updateProjectionMatrix();
 for(const v of V){cam.position.set(...v.p);cam.rotation.set(0,v.yaw,0);cam.updateMatrixWorld(true);m.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);fr.setFromProjectionMatrix(m);let c=0,t=0;
  for(const o of objects){if(o.maxDist&&Math.hypot(o.c[0]-v.p[0],o.c[1]-v.p[1],o.c[2]-v.p[2])-o.r>o.maxDist)continue;s.center.set(...o.c);s.radius=o.r;if(fr.intersectsSphere(s)){c++;t+=o.tris;}}calls+=c;tris+=t;per.push([c,t]);}
 per.sort((a,b)=>b[1]-a[1]);return {calls:Math.round(calls/V.length),tris:Math.round(tris/V.length),worstTris:per[0][1],worstCalls:Math.max(...per.map(p=>p[0]))};}
export function texStats(key,R){const used=new Map();for(const p of R.prims)if(p.tex!=null){const s=R.g.textures[p.tex].source;if(!used.has(s))used.set(s,[]);used.get(s).push(p);}let med=0,low=0,medOpt=0,px=0;const size=(w,h,c)=>{const k=c?Math.min(1,c/Math.max(w,h)):1;return Math.round(w*k)*Math.round(h*k)*4*4/3;};for(const [s,ps] of used){const [w,h]=pngSize(root(key)+R.g.images[s].uri);px=Math.max(px,w,h);med+=size(w,h,0);low+=size(w,h,256);/* runtime: textures used only by decals or by materials under 300 triangles are capped at 256 px on every tier */const small=ps.every(p=>/Decal|Floater/i.test(p.name)||p.tris<300);medOpt+=size(w,h,small?256:0);}return {textures:used.size,maxPx:px,mediumMB:+(med/2**20).toFixed(1),mediumOptMB:+(medOpt/2**20).toFixed(1),lowMB:+(low/2**20).toFixed(1)};}
export async function perf(key){const R=loadRender(key,{bvh:false}),V=views(key);const src=[];
 for(const p of R.prims){const tri=new Uint32Array(p.tris);for(let i=0;i<p.tris;i++)tri[i]=p.tri0+i;const s=sphereOf(R.pos,R.index,tri);src.push({c:s.c,r:s.r,tris:p.tris});}
 const out={key,primitives:R.prims.length,materials:new Set(R.prims.map(p=>p.material)).size,triangles:R.index.length/3,vertices:R.pos.length/3,...texStats(key,R),source:count(src,V)};
 const api=runtimeApi();if(api.nmChunkPlan){const items=R.prims.map(p=>({key:[p.tex,p.alpha,p.name.replace(/_\d+$/,'')].join('|'),name:p.name,pos:R.pos,index:R.index,tri0:p.tri0,tris:p.tris}));
  // material equivalence offline: same texture + alpha mode (+ the runtime's name-based classes); colour factors ignored
  for(const it of items){const t=it.key.split('|');it.key=t[0]+'|'+t[1]+'|'+(api.nmDetailDistance(it.name)||0)+'|'+(/Floor|Ground/i.test(it.name)?1:0);}
  const plan=api.nmChunkPlan(items,...(process.env.CHUNK?process.env.CHUNK.split(",").map(Number):[])),objs=plan.map(o=>{let n=0;for(const q of o.parts)n+=q.tris?q.tris.length:items[q.item].tris;const ids=new Uint32Array(n);let k=0;for(const q of o.parts){const it=items[q.item];if(q.tris)for(const t of q.tris)ids[k++]=it.tri0+t;else for(let t=0;t<it.tris;t++)ids[k++]=it.tri0+t;}const s=sphereOf(R.pos,R.index,ids);return {c:s.c,r:s.r,tris:n,maxDist:o.maxDist||0,cx:o.cx,cz:o.cz,span:o.span};});
  out.objects=objs.length;out.chunked=count(objs,V);out.chunkedNoDetailCull=count(objs.map(o=>Object.assign({},o,{maxDist:0})),V);}
 return out;}
if(import.meta.url===`file://${process.argv[1]}`){const maps=process.argv.slice(2).length?process.argv.slice(2):MAPS,all={};for(const k of maps){const t=Date.now();all[k]=await perf(k);console.log(JSON.stringify(all[k]),((Date.now()-t)/1000).toFixed(0)+'s');}if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(all,null,1));}
