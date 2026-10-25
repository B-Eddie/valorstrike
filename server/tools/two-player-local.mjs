// Two-player acceptance against a running local dev server (`npm run dev`, port 8787):
//   node tools/two-player-local.mjs [map] [mode] [http://127.0.0.1:8787]
// Two scripted human clients join one room, fight each other (hits, kills both ways, respawns), one leaves and rejoins
// with the same profile, the match runs to its natural end, and both profiles' persisted records are checked.
import fs from 'node:fs/promises';import WebSocket from 'ws';import {loadWorld} from '../src/world.js';import {twoPlayerScenario} from './scripted-human.mjs';
const [map='ascent',mode='dm',base='http://127.0.0.1:8787']=process.argv.slice(2);
const assets={async fetch(r){try{return new Response(await fs.readFile(new URL('../public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
const world=await loadWorld(assets,map);const code=Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
const env={now:()=>Date.now(),wait:ms=>new Promise(r=>setTimeout(r,ms)),
 connect(q){const ws=new WebSocket(base.replace('http','ws')+'/connect?'+new URLSearchParams(q),{headers:{Origin:'http://127.0.0.1:8876'}});return {send:m=>ws.readyState===1&&ws.send(m),close:()=>ws.close(),on:(t,f)=>ws.on(t,t==='message'?d=>f(JSON.parse(d)):f)};},
 profile:async()=>(await fetch(base+'/profile?qa=1')).json(),stats:async token=>(await fetch(base+'/stats',{headers:{Authorization:'Bearer '+token}})).json()};
const t0=Date.now();try{const report=await twoPlayerScenario(env,{world,map,mode,code});console.log(JSON.stringify(report,null,1));console.log('PASS two-player acceptance in',((Date.now()-t0)/1000).toFixed(0),'s');process.exit(0);}catch(e){console.error('FAIL',e.message);process.exit(1);}
