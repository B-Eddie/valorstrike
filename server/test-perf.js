// Crowded-combat hot paths (ledger row 12): the grid nearest-node lookup and the cached/buffer-reusing A* must return
// exactly what the original full scan and allocation-per-call search returned; cached routes must be private copies;
// spawn candidates are cached per anchor only for static worlds. Prints a short timing line for information.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {loadWorld} from './src/world.js';import {path,search} from './src/path.js';import {Simulation} from './src/simulation.js';
const assets={async fetch(r){try{return new Response(await fs.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;const out=[];
for(const map of ['ascent','split']){const W=await loadWorld(assets,map),N=W.nav.nodes,pick=()=>W.playable[Math.floor(rnd()*W.playable.length)];
 let tg=0,ts=0;for(let k=0;k<4000;k++){const p=N[pick()],far=k%10===0?200:30,x=p[0]+(rnd()-.5)*far,z=p[2]+(rnd()-.5)*far,y=k%3?p[1]+(rnd()-.5)*6:undefined;let t=performance.now();const a=W.near(x,z,y);tg+=performance.now()-t;t=performance.now();const b=W.nearScan(x,z,y);ts+=performance.now()-t;assert.equal(a,b,`${map} near(${x},${z},${y})`);}
 // Exact node positions and exact ties.
 for(let k=0;k<300;k++){const i=pick(),p=N[i];assert.equal(W.near(p[0],p[2],p[1]),W.nearScan(p[0],p[2],p[1]));}
 let tf=0,tr=0;for(let k=0;k<250;k++){const s=pick(),e=k%5===0?s:pick();let t=performance.now();const a=path(W,s,e);tf+=performance.now()-t;t=performance.now();const b=search(W,s,e);tr+=performance.now()-t;assert.deepEqual(a,b,`${map} path ${s}->${e}`);}
 const s=pick(),e=pick(),r1=path(W,s,e);r1.shift();r1.push(-5);assert.deepEqual(path(W,s,e),search(W,s,e),'cached route is a private copy');
 out.push(`${map} near ${(tg/4000*1e3).toFixed(1)}µs vs scan ${(ts/4000*1e3).toFixed(1)}µs, A* ${(tf/250).toFixed(2)}ms vs ${(tr/250).toFixed(2)}ms`);
 if(map==='ascent'){const sim=new Simulation(W,'tdm',map);sim.add('One');for(let i=0;i<9;i++)sim.add('B'+i,'Jett',false);assert.equal(sim.spawnCache.size,2,'one candidate list per team anchor');const list=sim.spawnCache.get(W.map.attacker);for(const p of list.map(c=>c.p))assert(!W.blocked(p[0],p[2],.43,p[1],1.92));
  sim.start();for(let n=0;n<200;n++)sim.step(.05);assert(sim.units.every(u=>Number.isFinite(u.x)));}
}
console.log('Perf hot paths: grid near == full scan, cached A* == reference (routes copied), static spawn candidates cached per anchor; '+out.join('; '));
