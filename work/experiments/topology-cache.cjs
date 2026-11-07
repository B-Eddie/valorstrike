// QA-only prepared scene topology. Materials must be resolved externally, unchanged.
// Does not serialize textures/shaders or create a complete usable map cache.
const assert=require('assert/strict'),codec=require('./geometry-cache.cjs');
function encode(root){const geos=[],mats=[],nodes=[],chunks=root.userData.nmChunks||[],strips=root.userData.nmStrips||[];
 const G=g=>{let i=geos.findIndex(v=>v.source===g);if(i<0){i=geos.length;geos.push({source:g,...codec.encode(g)});}return i;};
 const M=m=>{let i=mats.indexOf(m);if(i<0){i=mats.length;mats.push(m);}return i;};
 const U=u=>({...u,c:u.c?u.c.toArray():undefined});
 for(const o of root.children){assert(o.isMesh&&!o.isSkinnedMesh&&!o.children.length&&!Array.isArray(o.material),'flat prepared static meshes only');nodes.push({name:o.name,g:G(o.geometry),m:M(o.material),matrix:o.matrix.toArray(),auto:o.matrixAutoUpdate,visible:o.visible,frustum:o.frustumCulled,chunk:o.userData.nmChunk?U(o.userData.nmChunk):null,run:o.userData.nmRun?{...o.userData.nmRun}:null});}
 const manifest={version:1,nodes,chunks:chunks.map(c=>c.isNmStripChunk?{g:G(strips.find(s=>s.chunks.includes(c)).geometry),m:M(c.material),name:c.name,s:c.s,n:c.n,u:U(c.userData.nmChunk)}:{node:root.children.indexOf(c)}),strips:strips.map(s=>({g:G(s.geometry),proxies:s.proxies.map(p=>root.children.indexOf(p)),chunks:s.chunks.map(c=>chunks.indexOf(c))}))};
 return{manifest,geometries:geos.map(({manifest,blob})=>({manifest,blob})),materials:mats};}
function decode(T,data,api,resolve){const m=data.manifest;assert(m.version===1);const root=new T.Group(),geos=[];
 try{for(const g of data.geometries)geos.push(codec.decode(T,g.manifest,g.blob));const nodes=m.nodes.map(n=>{assert(geos[n.g]);const o=new T.Mesh(geos[n.g],resolve(n.m));o.name=n.name;o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);o.matrixAutoUpdate=n.auto;o.visible=n.visible;o.frustumCulled=n.frustum;o.castShadow=o.receiveShadow=false;
 if(n.chunk)o.userData.nmChunk={...n.chunk,c:new T.Vector3(...n.chunk.c)};if(n.run){o.userData.nmRun={...n.run};o.onBeforeRender=api.nmRunRange;o.onAfterRender=api.nmRunReset;Object.defineProperty(o,'castShadow',{get:()=>false,set:()=>{},configurable:true});}root.add(o);return o;});
 const chunks=m.chunks.map(c=>{if(c.node!==undefined){assert(nodes[c.node]);return nodes[c.node];}assert(c.s>=0&&c.n>=0&&c.s+c.n<=geos[c.g].index.count);const fake={name:c.name,material:resolve(c.m),userData:{nmChunk:{...c.u,c:new T.Vector3(...c.u.c)}}};return api.nmStripChunk(geos[c.g],fake,c.s,c.n);});
 root.userData.nmChunks=chunks;root.userData.nmStrips=m.strips.map(s=>({geometry:geos[s.g],proxies:s.proxies.map(i=>nodes[i]),chunks:s.chunks.map(i=>chunks[i]),runs:0}));return root;
 }catch(e){for(const g of geos)g.dispose();throw e;}}
module.exports={encode,decode};
