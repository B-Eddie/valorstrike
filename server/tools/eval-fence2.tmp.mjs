import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';
process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
const w=await loadWorld(assets,'breeze');let bad=0;
for(const i of w.playable){const p=w.nav.nodes[i],y=w.ground(p[0],p[2],p[1]+.1);if(w.blocked(p[0],p[2],.4,y,1.8))bad++;}
console.log('breeze NO-FENCE blocked nodes',bad);
