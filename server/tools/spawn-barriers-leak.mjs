// node tools/spawn-barriers-leak.mjs [map ...] [--nav]: leak report for the committed walls (tools/spawn-barriers-gen.mjs leak)
import fs from 'node:fs';import {loadWorld} from '../src/world.js';import {leak} from './spawn-barriers-gen.mjs';import {createRequire} from 'node:module';
process.chdir(new URL('..',import.meta.url).pathname);const require=createRequire(import.meta.url),SB=require('../../vendor/spawn-barriers.cjs');
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
const args=process.argv.slice(2),maps=args.filter(a=>!a.startsWith('--'));
for(const key of maps.length?maps:['ascent','bind','breeze','haven','lotus','split']){const w=await loadWorld(assets,key);for(const side of ['atk','def'])console.log(key,side,JSON.stringify(leak(w,key,side,SB,{nav:args.includes('--nav'),trace:args.includes('--trace')})));}
