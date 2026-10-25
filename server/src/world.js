import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
export async function loadWorld(assets,key){
 const get=async f=>{const r=await assets.fetch(new Request('https://assets.local/worlds/'+key+'/'+f));if(!r.ok)throw Error('World asset missing: '+f);return r;};
 const meta=await (await get('meta.json')).json();const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(await(await get('position.bin')).arrayBuffer()),3));
 const index=new Uint32Array(await(await get('index.bin')).arrayBuffer());geometry.setIndex(new T.BufferAttribute(index,1));
 const roots=[];for(let i=0;i<meta.roots;i++)roots.push(await(await get('bvh'+i+'.bin')).arrayBuffer());
 const bvh=MeshBVH.deserialize({roots,index},geometry,{setIndex:false});
 const plants=await(await get('plants.json')).json();const nav=await(await get('navigation.json')).json(),map=await(await get('map.json')).json();
 const line=new T.Line3(),box=new T.Box3(),q=new T.Vector3(),v=new T.Vector3();
 const ground=(x,z,y)=>{const ray=new T.Ray(new T.Vector3(x,y+.32,z),new T.Vector3(0,-1,0));for(let i=0;i<24;i++){const h=bvh.raycastFirst(ray,T.DoubleSide);if(!h)break;if(h.face.normal.y>.45)return h.point.y;ray.origin.y=h.point.y-.005;}return y-10;};
 const blocked=(x,z,r,y,height=1.8)=>{line.start.set(x,y+r+.025,z);line.end.set(x,y+Math.max(r+.025,height-r),z);box.min.set(x-r,y+.025,z-r);box.max.set(x+r,y+height,z+r);let hit=false;bvh.shapecast({intersectsBounds:b=>b.intersectsBox(box),intersectsTriangle:t=>{if(Math.max(t.a.y,t.b.y,t.c.y)<=y+.025)return false;/* cheap reject: triangle bounds outside the capsule box */if(Math.min(t.a.x,t.b.x,t.c.x)>box.max.x||Math.max(t.a.x,t.b.x,t.c.x)<box.min.x||Math.min(t.a.z,t.b.z,t.c.z)>box.max.z||Math.max(t.a.z,t.b.z,t.c.z)<box.min.z||Math.min(t.a.y,t.b.y,t.c.y)>box.max.y)return false;if(t.closestPointToSegment(line,q,v)<r-.012){hit=true;return true;}return false;}});return hit;};
 const ray=(o,d,max=Infinity)=>{const h=bvh.raycastFirst(new T.Ray(new T.Vector3(...o),new T.Vector3(...d)),T.DoubleSide);return h&&h.distance<max?h.distance:Infinity;};
 const seen=new Set(),components=[];for(let i=0;i<nav.nodes.length;i++){if(seen.has(i)||!nav.valid[i])continue;const c=[i];seen.add(i);for(let k=0;k<c.length;k++)for(const j of nav.adj[c[k]])if(!seen.has(j)&&nav.valid[j]){seen.add(j);c.push(j);}components.push(c);}components.sort((a,b)=>b.length-a.length);const playable=components[0],allowed=new Set(playable);
 // Nearest playable node. A uniform grid over the playable nodes replaces the full scan (bots call this on every
 // repath); rings are searched outward until no farther cell can beat the best, and ties keep the scan's order, so
 // the result is identical to the linear scan (test-perf.js checks this).
 const nearScan=(x,z,y)=>{let best=-1,d=Infinity;for(const i of playable){const p=nav.nodes[i],v=(p[0]-x)**2+(p[2]-z)**2+(Number.isFinite(y)?2*(p[1]-y)**2:0);if(v<d){best=i;d=v;}}return best;};
 const CELL=4;let gx0=Infinity,gz0=Infinity,gx1=-Infinity,gz1=-Infinity;for(const i of playable){const p=nav.nodes[i];gx0=Math.min(gx0,p[0]);gz0=Math.min(gz0,p[2]);gx1=Math.max(gx1,p[0]);gz1=Math.max(gz1,p[2]);}
 const GW=playable.length?Math.floor((gx1-gx0)/CELL)+1:0,GH=playable.length?Math.floor((gz1-gz0)/CELL)+1:0,cells=Array.from({length:GW*GH},()=>[]);
 playable.forEach((i,k)=>{const p=nav.nodes[i];cells[Math.floor((p[2]-gz0)/CELL)*GW+Math.floor((p[0]-gx0)/CELL)].push(k);});
 const near=(x,z,y)=>{if(!playable.length)return -1;if(!Number.isFinite(x)||!Number.isFinite(z))return nearScan(x,z,y);const fy=Number.isFinite(y);
  const cx=Math.max(0,Math.min(GW-1,Math.floor((x-gx0)/CELL))),cz=Math.max(0,Math.min(GH-1,Math.floor((z-gz0)/CELL)));let bestK=-1,d=Infinity;
  for(let r=0,R=Math.max(GW,GH);r<=R;r++){if(r>0){const lb=(r-1)*CELL;if(lb*lb>d)break;}
   for(let j=cz-r;j<=cz+r;j++){if(j<0||j>=GH)continue;const edge=j===cz-r||j===cz+r;for(let i=cx-r;i<=cx+r;i+=edge?1:2*r||1){if(i<0||i>=GW)continue;
    for(const k of cells[j*GW+i]){const p=nav.nodes[playable[k]],v=(p[0]-x)**2+(p[2]-z)**2+(fy?2*(p[1]-y)**2:0);if(v<d||(v===d&&k<bestK)){bestK=k;d=v;}}}}}
  return bestK<0?-1:playable[bestK];};
 const plantAt=(x,z)=>{const t=map.transform,p=map.apiProjection,ca=Math.cos(t.angle),sa=Math.sin(t.angle),sx=ca*x-sa*z+t.cx,sz=sa*x+ca*z+t.cz,u=Math.floor((sx*100*p.xMultiplier+p.xScalarToAdd)*1024),v=Math.floor((-sz*100*p.yMultiplier+p.yScalarToAdd)*1024);for(const row of plants.rows[v]||[])if(u>=row[0]&&u<row[1])return row[2];return '';};return {plantAt,ground,blocked,ray,near,nearScan,nav,map,playable,allowed,bytes:geometry.attributes.position.array.byteLength+index.byteLength+roots.reduce((a,r)=>a+r.byteLength,0),ceiling:(x,z,l,h)=>ray([x,l+.01,z],[0,1,0],h-l)<Infinity};
}
