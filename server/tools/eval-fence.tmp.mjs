// Fence acceptance: no playable node may be blocked by the fence quads.
import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';
process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
let fail=0;
for(const key of ['ascent','bind','haven','split','lotus','breeze']){
 const w=await loadWorld(assets,key);let bad=0;
 for(const i of w.playable){const p=w.nav.nodes[i],y=w.ground(p[0],p[2],p[1]+.1);if(w.blocked(p[0],p[2],.4,y,1.8))bad++;}
 console.log(key,'playable',w.playable.length,'blocked nodes',bad);if(bad)fail=1;}
process.exit(fail);
