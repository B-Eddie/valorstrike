// Walkable-ground materials (render meshes, scene.gltf). A ray straight down at every navigation node finds the render
// surface a player stands on and sees (the top hit within 0.25 m of the node). Every material that is that surface is
// recorded with its base-colour texture's alpha statistics (16x16, the samples nmTexStats takes in the page) and sorted:
//   ground  the floor itself: must draw opaque (alphaTest 0, not transparent) whether or not its texture loads; a
//           ground layer's alpha is a blend / height mask, not a silhouette (Ascent's Grass_M0_Dirtblend_A was drawn
//           alpha-cut and the ground under the mid courtyard looked see-through, the dirt sheet 1.1 m below showing)
//   cards   what lies ON the floor and is shaped by its alpha: grass cards and clumps (Grass_M0_Cards*, Grass_4_*,
//           Grass_1_Clump), foliage (a name nmFoliageCut cuts), decals and floaters. These keep their cut-out.
//   overlay floor overlays exported OPAQUE although their alpha is their shape (puddles, tyre tracks, street paint, blood
//           cards, wires lying on the floor): listed for reference, not asserted (they draw opaque today).
// The sort is by name only (never by the runtime's own terrain rule): ground-layer textures keep a height mask in alpha
// (Tile_M11_Temple: 100 % of texels under half alpha), so alpha coverage cannot tell a floor from a card.
// Output: work/validation/map/ground-materials.json {map:{nodes,ground:{name:{n,stats}},cards:{name:{n,kind,stats}},overlay:{...}}}
// (test: work/test_map_ground_opaque.cjs). Usage: node tools/map-ground.mjs [maps...]   (OUT=path to write elsewhere)
import fs from 'node:fs';import * as T from 'three';import sharp from 'sharp';import {loadRender,root} from './map-render.mjs';
const here=new URL('../../work/',import.meta.url).pathname,RT=fs.readFileSync(here+'native_maps_runtime.js','utf8');
const fn=n=>{const m=new RegExp('^function '+n+'\\(.*$','m').exec(RT);if(!m)throw new Error('runtime has no '+n);return m[0];};
const {nmFoliageCut}=new Function(fn('nmFoliageCut')+'return {nmFoliageCut};')();
export const MIN_NODES=5,BAND=.25,CARD=/Cards|Clump|^Grass_\d/i,OVERLAY=/Puddle|TireTrack|^Paint_|BloodCard|Wires/i;
async function texStats(dir,g,mi){const m=g.materials[mi]||{},t=m.pbrMetallicRoughness&&m.pbrMetallicRoughness.baseColorTexture;if(!t)return null;const img=g.images[g.textures[t.index].source];if(!img||!img.uri)return null;
 const {data,info}=await sharp(dir+img.uri).ensureAlpha().resize(16,16,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});let lo=255,cover=0,white=0,cut=0;
 for(let i=0;i<256;i++){const o=i*info.channels,a=data[o+3];lo=Math.min(lo,a);if(a<128)cut++;if(a>32){cover++;if(Math.min(data[o],data[o+1],data[o+2])>220)white++;}}
 return {minAlpha:lo,white:+(cover?white/cover:0).toFixed(3),cut:+(cut/256).toFixed(3)};}
export async function scanGround(key){const R=loadRender(key,{bvh:true}),{prims,triMat,bvh,g}=R,dir=root(key);
 const nodes=JSON.parse(fs.readFileSync(dir+'navigation.json')).nodes,ray=new T.Ray(),p=new T.Vector3(),o=new T.Vector3(),dn=new T.Vector3(0,-1,0),count=new Map(),matOf=new Map();
 for(const [x,y,z] of nodes){ray.set(o.set(x,y+.6,z),dn);let best=-Infinity,bk=-1;
  bvh.shapecast({intersectsBounds:b=>ray.intersectsBox(b),intersectsTriangle:(tr,i)=>{if(ray.intersectTriangle(tr.a,tr.b,tr.c,false,p)&&p.y>best){best=p.y;bk=triMat[i];}return false;}});
  if(bk<0||Math.abs(best-(y-.015))>BAND)continue;const nm=prims[bk].name;count.set(nm,(count.get(nm)||0)+1);matOf.set(nm,prims[bk].material);}
 const out={nodes:nodes.length,ground:{},cards:{}};
 for(const [nm,n] of [...count].sort((a,b)=>a[0]<b[0]?-1:1)){if(n<MIN_NODES)continue;const s=await texStats(dir,g,matOf.get(nm));
  const kind=/Decal|Floater/i.test(nm)?'decal':nmFoliageCut(nm,{cut:1})?'foliage':CARD.test(nm)?'card':OVERLAY.test(nm)?'overlay':null;
  if(kind==='overlay')(out.overlay=out.overlay||{})[nm]={n,stats:s};else if(kind)out.cards[nm]={n,kind,stats:s};else out.ground[nm]={n,stats:s};}
 return out;}
if(import.meta.url===`file://${process.argv[1]}`){const maps=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','breeze','haven','lotus','split'],file=process.env.OUT||here+'validation/map/ground-materials.json';
 const rep=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 for(const k of maps){const t0=Date.now(),r=await scanGround(k);rep[k]=r;console.log(k,r.nodes,'nodes;',Object.keys(r.ground).length,'ground,',Object.keys(r.cards).length,'cards;',((Date.now()-t0)/1000).toFixed(0)+'s');}
 const sorted={};for(const k of Object.keys(rep).sort())sorted[k]=rep[k];fs.writeFileSync(file,JSON.stringify(sorted,null,1)+'\n');}
