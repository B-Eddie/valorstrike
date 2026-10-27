// Leash walls: from every reachable nav node walk outwards over the SAME floor (no collision, floor within 0.45 m of the
// node's) until the movement leash refuses the move. A refusal where the base world (foliage still solid) had a plant
// in the way = an invisible wall inside a now walk-through plant bed.
import fs from 'node:fs';import path from 'node:path';
const S='/workspace/work/vs-lane-invis/server/';const {loadWorld}=await import(S+'src/world.js');
const key=process.argv[2],CUR=process.argv[3],BASE=process.argv[4],TAG=process.env.TAG||'';
const ld=root=>loadWorld({fetch:async r=>new Response(await fs.promises.readFile(path.join(root,new URL(r.url).pathname)))},key);
const W=await ld(CUR),B=BASE?await ld(BASE):null,N=W.nav.nodes,mp=W.map;
const callout=(x,z)=>{let b=null,d=1e9;for(const c of mp.callouts||[]){const e=(c.position[0]-x)**2+(c.position[2]-z)**2;if(e<d){d=e;b=c.name;}}return b+' '+Math.sqrt(d).toFixed(0)+'m';};
const G=new Map();for(const [a,b,c,m] of JSON.parse(fs.readFileSync('grass_'+key+'.json')))G.set(a+','+b+','+c,m);
const grassNear=(x,y,z)=>{const cx=Math.floor(x/.5),cy=Math.floor(y/.5),cz=Math.floor(z/.5);for(let a=-2;a<=2;a++)for(let b=-1;b<=4;b++)for(let c=-2;c<=2;c++){const m=G.get((cx+a)+','+(cy+b)+','+(cz+c));if(m)return m;}return null;};
const out=[],coll=[];let reach=0;
for(let i=0;i<N.length;i++){if(W.nav.valid&&!W.nav.valid[i])continue;const [x,y0,z]=N[i],y=W.ground(x,z,y0+.6);if(!Number.isFinite(y)||!W.leash(x,z,y)||W.blocked(x,z,.4,y+.42,1.38))continue;reach++;
 for(let d=0;d<16;d++){const a=d/16*Math.PI*2,cx=Math.cos(a),cz=Math.sin(a);let px=x,pz=z,py=y;
  for(let s=.15;s<=3;s+=.15){const qx=x+cx*s,qz=z+cz*s,g=W.ground(qx,qz,py+.45);if(!Number.isFinite(g)||Math.abs(g-py)>.45)break;if(W.blocked(qx,qz,.4,g+.42,1.38)){const gm=grassNear(qx,g,qz);if(gm)coll.push({i,x:+qx.toFixed(2),y:+g.toFixed(2),z:+qz.toFixed(2),grass:gm});break;}
   if(!W.leash(qx,qz,g,px,pz)){const plant=B?(B.blocked(qx,qz,.4,g+.42,1.38)||B.ground(qx,qz,g+.45)>g+.1):null;out.push({i,x:+qx.toFixed(2),y:+g.toFixed(2),z:+qz.toFixed(2),s:+s.toFixed(2),plant:plant||!!grassNear(qx,g,qz),grass:grassNear(qx,g,qz)});break;}
   px=qx;pz=qz;py=g;}}}
const cl=new Map();for(const p of out){const k=Math.round(p.x/2.5)+','+Math.round(p.y/2.5)+','+Math.round(p.z/2.5)+','+p.plant;let e=cl.get(k);if(!e)cl.set(k,e={rep:[p.x,p.y,p.z],node:N[p.i],plant:p.plant,n:0,nodes:new Set(),x:0,z:0,y:0});e.n++;e.nodes.add(p.i);e.x+=p.x;e.y+=p.y;e.z+=p.z;}
const C=[...cl.values()].map(e=>({rep:e.rep,node:e.node,plant:e.plant,pushes:e.n,nodes:e.nodes.size,at:[+(e.x/e.n).toFixed(1),+(e.y/e.n).toFixed(1),+(e.z/e.n).toFixed(1)],callout:callout(e.x/e.n,e.z/e.n)})).sort((a,b)=>b.pushes-a.pushes);
fs.writeFileSync('leash_'+key+TAG+'.json',JSON.stringify(C,null,1));fs.writeFileSync('collgrass_'+key+TAG+'.json',JSON.stringify(coll));console.log('collision stops next to grass/foliage cards',coll.length);
console.log(key,'reachable nodes',reach,'leash stops on same floor',out.length,'in former plant beds',out.filter(p=>p.plant).length,'clusters(plant)',C.filter(c=>c.plant).length);
for(const c of C.filter(c=>c.plant).slice(0,+process.env.TOP||15))console.log(' ',JSON.stringify(c));
