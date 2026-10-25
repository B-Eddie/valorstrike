// Hole scan over the playable area of each original map (server collision = the BVH both the server and the
// offline client walk on). Every playable navigation node (0.75 m grid) is sampled on a 0.25 m grid covering its
// cell; a downward ray from 0.6 m above the node's floor looks for floor within a step (1.2 m).
//  void:  nothing below at all (falling here leaves the world)
//  gap:   no floor within 1.2 m, but floor at the node's height on both sides within 0.8 m along x or z
//         (a crack/hole enclosed by floor; width = distance between the two floor sides)
//  edge:  no floor, open on a side (a ledge: legitimate unless the drop is a void; the boundary scan walks these)
// Usage: node tools/map-holes.mjs [maps...]   (JSON=path writes the full report)
import fs from 'node:fs';import {loadWorld} from '../src/world.js';import {createRequire} from 'node:module';
process.chdir(new URL('..',import.meta.url).pathname);
const require=createRequire(import.meta.url),Motor=require('../src/motor.cjs');
export const MAPS=['ascent','bind','haven','split','lotus','breeze'];
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
// Floor below (x,z) starting from y: returns floor height or -Infinity. Patches (shared motor) count as floor.
export function floorAt(w,key,x,z,y,depth=1.2){const d=w.ray([x,y+.6,z],[0,-1,0],.6+depth);let f=Number.isFinite(d)?y+.6-d:-Infinity;const p=Motor.patchFloor?Motor.patchFloor(key,x,z,y+.6):-Infinity;return Math.max(f,p>y-depth?p:-Infinity);}
export async function scanHoles(key,w){w=w||await loadWorld(assets,key);const N=w.nav.nodes,seen=new Set(),out={key,samples:0,void:[],gap:[],edge:0};
 const offs=[-.25,0,.25];
 for(const i of w.playable){const n=N[i];for(const ox of offs)for(const oz of offs){const x=+(n[0]+ox).toFixed(2),z=+(n[2]+oz).toFixed(2),k=x+','+z+','+Math.round(n[1]*2);if(seen.has(k))continue;seen.add(k);out.samples++;
  const f=floorAt(w,key,x,z,n[1]);if(f>-Infinity)continue;
  const any=w.ray([x,n[1]+.6,z],[0,-1,0],400);
  if(Motor.clipBlocked(key,x,z,0,n[1],1.8))continue; // inside a player clip: nobody can stand here
  // enclosed? floor at node height on both sides along x or along z within .8 m
  let enc=null;for(const [ax,az]of [[1,0],[0,1],[.7071,.7071],[.7071,-.7071]]){let a=null,b=null;for(let d=.05;d<=.8;d+=.05){if(a==null&&floorAt(w,key,x+ax*d,z+az*d,n[1],.45)>-Infinity)a=d;if(b==null&&floorAt(w,key,x-ax*d,z-az*d,n[1],.45)>-Infinity)b=d;}if(a!=null&&b!=null){const wd=a+b;if(!enc||wd<enc.width)enc={width:+wd.toFixed(2),dir:[ax,az]};}}
  const rec={x,z,y:+n[1].toFixed(2),drop:Number.isFinite(any)?+(any-.6).toFixed(2):null};
  // can a capsule (r .4) stand with its centre here? the motor holds it when floor within .45 m lies under its footprint ring (.34 m)
  let held=false;for(let k=0;k<8&&!held;k++){const a=k*Math.PI/4;if(floorAt(w,key,x+Math.cos(a)*.34,z+Math.sin(a)*.34,n[1],.45)>-Infinity)held=true;}rec.held=held;rec.leash=w.leash?w.leash(x,z,n[1]):true;
  if(!Number.isFinite(any))out.void.push(Object.assign(rec,enc?{width:enc.width}:{}));else if(enc)out.gap.push(Object.assign(rec,{width:enc.width}));else out.edge++;}}
 return out;}
// Cluster samples within 0.6 m (same height band) into holes.
export function cluster(pts){const groups=[];for(const p of pts){let g=groups.find(g=>Math.abs(g.y-p.y)<1&&g.pts.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<.6));if(!g){g={y:p.y,pts:[]};groups.push(g);}g.pts.push(p);}
 return groups.map(g=>{const xs=g.pts.map(p=>p.x),zs=g.pts.map(p=>p.z);return {n:g.pts.length,x:[Math.min(...xs),Math.max(...xs)],z:[Math.min(...zs),Math.max(...zs)],y:g.y,width:Math.max(...g.pts.map(p=>p.width||0)),drop:Math.max(...g.pts.map(p=>p.drop==null?999:p.drop))};});}
if(import.meta.url===`file://${process.argv[1]}`){const maps=process.argv.slice(2).length?process.argv.slice(2):MAPS,all={};
 for(const key of maps){const t=Date.now(),r=await scanHoles(key);const v=cluster(r.void),g=cluster(r.gap);all[key]={samples:r.samples,edgeSamples:r.edge,voidSamples:r.void.length,gapSamples:r.gap.length,voids:v,gaps:g};
  const fall=r.void.concat(r.gap).filter(p=>!p.held&&p.leash);all[key].fallable=cluster(fall);console.log(key,r.samples,'samples',r.void.length,'void',r.gap.length,'gap',r.edge,'edge',fall.length,'fallable (unsupported capsule centre the leash allows)',((Date.now()-t)/1000).toFixed(1)+'s');for(const c of all[key].fallable)console.log('  FALLABLE',JSON.stringify(c));for(const c of v)console.log('  VOID',JSON.stringify(c));for(const c of g.filter(c=>c.width>=.3||c.n>2))console.log('  GAP ',JSON.stringify(c));}
 if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(all,null,1));}
