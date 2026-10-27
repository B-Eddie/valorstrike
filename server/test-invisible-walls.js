// Invisible walls near grass / plant beds (user: "there are also some invisible walls in the maps", "near the grasses on
// the side", "I saw it in Breeze"). Collision triangles the page draws see-through still stopped the player:
//  - plant-bed components put BACK into collision by build_foliage_exclude.py's nav-ground safety: the nav bake stood
//    nodes on the leaf tops (Breeze beach cabbage on lane edges, Bind desert plants) with the real ground 0.36-1.3 m
//    below, and the old rule (kept floor within 0.35 m) restored the WHOLE welded bed, alpha-cut card edges included;
//  - MIXED pot/planter atlases kept transparent card texels (non-green RGB under alpha 0) as solid;
//  - decal cards (graffiti / murals / container stickers, drawn as alpha decals) floating a few cm off their wall.
// Found by work/invis (capsule sweep from every reachable nav node, i.e. on the movement leash, against per-triangle page
// visibility: capsweep.cjs + triinfo.py). Spots are the residuals on 8f4e9d8 (foliage exclusion v1).
// Checks on the prebuilt worlds (public/worlds):
//  1. FREE: at each spot a standing capsule (above the 0.4 m step) is not blocked, and real floor lies within 1.3 m below.
//  2. WALK: the shared motor walks from the nav node to the spot without stopping or jumping.
//  3. SOLID: pots, planters, palm trunks and real walls beside them still block.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {loadWorld} from './src/world.js';
const here=path.dirname(new URL(import.meta.url).pathname),require=createRequire(import.meta.url),Motor=require('./src/motor.cjs');
const WROOT=process.env.VS_WORLDS_ROOT||path.join(here,'public'),assets={fetch:async r=>new Response(await fs.promises.readFile(path.join(WROOT,new URL(r.url).pathname)))};
// [map, spot x, y, z, nav node x, z, callout / what]  (y = the nav node's height; spots from work/invis caps_<map>.json)
const FREE=[
 ['breeze',11.5,4.11,51.5,10.75,51.5,'Attacker Side Spawn: beach cabbage card edges (restored with the whole bed)'],
 ['breeze',11.58,4.01,51.16,10.75,51.5,'Attacker Side Spawn: beach cabbage card edges'],
 ['breeze',-17.9,11.02,-37.75,-18.5,-37.75,'Mid Nest: floating mural decal'],
 ['breeze',-18.92,11.02,-37.33,-18.5,-37.75,'Mid Nest: floating mural decal'],
 ['breeze',-13.04,11.06,-39.79,-13.25,-40,'A Ramp: floating mural decal'],
 ['breeze',19,8.04,-36.7,19,-37,'A Pyramids: container sticker decal'],
 ['bind',-7.83,6.98,21.42,-8.25,21,'A Link: desert plant (restored with the whole bed)'],
 ['bind',-53.02,6.91,20.8,-53.25,20.25,'B Fountain: desert plant'],
 ['bind',19.04,7.07,30.06,18.75,30.75,'Attacker Side Cave: floating graffiti decal'],
 ['bind',-56.7,8.71,-15,-57,-15,'B Long: floating graffiti decal'],
 ['bind',-20.02,10.95,-8.05,-20.25,-7.5,'B Short: floating graffiti decal'],
 ['bind',19.08,6.97,13.92,19.5,13.5,'A Lobby: floating graffiti decal']];
// must still block: [map, x, floorY, z, what]
const SOLID=[['breeze',31.69,6.3,39.63,'palm trunk'],['bind',-65.56,9.35,-38.44,'palm trunk'],['ascent',1.22,7.07,36.36,'clay pot'],
 ['haven',13.87,7.04,33.32,'garden planter wall'],['haven',-57.54,6.01,1.46,'pot']];
const worlds={};for(const k of new Set([...FREE,...SOLID].map(f=>f[0])))worlds[k]=await loadWorld(assets,k);
const fails=[];
for(const [k,x,y,z,nx,nz,what] of FREE){const W=worlds[k];
 if(W.blocked(x,z,.38,y+.42,1.38)){fails.push(k+' '+what+' at '+[x,y,z]+': see-through collision blocks a standing player');continue;}
 const g=W.ground(x,z,y+.6);assert.ok(Number.isFinite(g)&&y-g<1.3,k+' '+what+': real floor within 1.3 m below, never the void ('+g+' vs '+y+')');
 // walk from the nav node to the spot (the decals sit a few cm off their wall, so the walk ends there)
 const dx=x-nx,dz=z-nz,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,u={x:nx,y:0,z:nz};u.y=W.ground(nx,nz,y+.6);let jumped=false;
 for(let i=0;i<Math.round(128*L/2+128);i++){const r=Motor.step(u,{x:ux,z:uz,speed:4},1/128,W);if(r&&r.jumped)jumped=true;if((u.x-nx)*ux+(u.z-nz)*uz>=L)break;}
 const prog=(u.x-nx)*ux+(u.z-nz)*uz;if(prog<L-.05||jumped)fails.push(k+' '+what+': walk from the node stopped at '+prog.toFixed(2)+' of '+L.toFixed(2)+' m'+(jumped?' (jumped)':''));}
for(const [k,x,y,z,what] of SOLID)assert.equal(worlds[k].blocked(x,z,.38,y,1.8),true,k+' '+what+' at '+[x,y,z]+' must still block');
assert.deepEqual(fails,[],'invisible walls:\n'+fails.join('\n'));
console.log('Invisible walls: '+FREE.length+' see-through foliage/decal spots free and walkable (floor <= 1.3 m below); '+SOLID.length+' pots/planters/trunks still block');
