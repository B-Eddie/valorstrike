// Memory-light loader for a map's render meshes (scene.gltf + geometry-*.bin), typed arrays only.
// loadRender(key,{bvh}) -> {g (gltf json), prims:[{mesh,material,name,tri0,tris,vert0,verts,box}], pos Float32Array,
// index Uint32Array, triMat Uint16Array (primitive per triangle), bvh (MeshBVH over everything, optional)}
import fs from 'node:fs';import * as T from 'three';import {MeshBVH} from 'three-mesh-bvh';
const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
export const root=key=>new URL('../../models/valorant/maps/'+key+'/',import.meta.url).pathname;
export function loadRender(key,{bvh=true,skipBlend=false}={}){const dir=root(key),g=JSON.parse(fs.readFileSync(dir+'scene.gltf'));
 const acc=(B,i)=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView],C=CT[a.componentType],n=NC[a.type],off=(v.byteOffset||0)+(a.byteOffset||0);return {C,n,count:a.count,buf:v.buffer,off,a};};
 const prims=[];let nv=0,nt=0;
 for(const node of g.nodes){if(node.mesh==null)continue;if(node.matrix||node.rotation||node.scale||node.translation){/* exporter bakes transforms; keep a note if not */prims.transformed=true;}
  for(const pr of g.meshes[node.mesh].primitives){const mat=g.materials[pr.material]||{};if(skipBlend&&mat.alphaMode==='BLEND')continue;const P=acc(null,pr.attributes.POSITION),I=pr.indices!=null?acc(null,pr.indices):null;
   prims.push({mesh:node.mesh,material:pr.material,name:mat.name||'',alpha:mat.alphaMode||'OPAQUE',double:!!mat.doubleSided,tex:mat.pbrMetallicRoughness?.baseColorTexture?.index,P,I,vert0:nv,verts:P.count,tri0:nt,tris:I?I.count/3:P.count/3,min:P.a.min,max:P.a.max});nv+=P.count;nt+=I?I.count/3:P.count/3;}}
 const pos=new Float32Array(nv*3),index=new Uint32Array(nt*3),triMat=new Uint16Array(nt);
 // read one buffer at a time to keep peak memory low
 const byBuf=new Map();for(const p of prims){for(const a of [p.P,p.I])if(a){if(!byBuf.has(a.buf))byBuf.set(a.buf,[]);byBuf.get(a.buf).push([p,a]);}}
 for(const [b,list]of byBuf){const B=fs.readFileSync(dir+g.buffers[b].uri);for(const [p,a]of list){const arr=new a.C(B.buffer,B.byteOffset+a.off,a.count*a.n);if(a===p.P)pos.set(arr,p.vert0*3);else{const o=p.tri0*3;for(let i=0;i<arr.length;i++)index[o+i]=arr[i]+p.vert0;}}}
 prims.forEach((p,k)=>{if(!p.I){for(let i=0;i<p.verts;i++)index[p.tri0*3+i]=p.vert0+i;}triMat.fill(k,p.tri0,p.tri0+p.tris);delete p.P;delete p.I;});
 const out={g,prims,pos,index,triMat};
 if(bvh){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setIndex(new T.BufferAttribute(index,1));out.geo=geo;out.bvh=new MeshBVH(geo,{maxLeafTris:10,maxDepth:64,indirect:true});}
 return out;}
