// DM/TDM spawn candidates must not strand units on disconnected nav islands. dmPts sources
// candidates from map CALLOUTs (xgGet exposes no nodes array, so the graph branch misses) and
// Ascent's "B Site" callout sits on a fragmented island: TDM allies spawned there and stood
// still all match (observed live: 4 allies parked at (46.7,-27.1) with no target). Candidates
// must sit within 2.5u of PLAYABLE (largest-component) nav.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const body=src.slice(src.indexOf('function dmPts'),src.indexOf('function dmSpot'));
// playable nav: a 2-node main area near callouts A/B; the island callout is 30u off
const nav={nodes:[[0,0,0],[5,0,0],[2,0,3],[3,0,-2],[1,0,-3],[46.7,3,-27.1]],valid:[1,1,1,1,1,1]};
const C={nav,playable:[1,1,1,1,1,0]}; // island node valid but NOT playable (largest component = main area)
const ctx={DM:{},FV:{map:'ascent'},boxes:null,CALLOUTS:[['A Main',0,1],['B Site',46.7,-27.1],['Mid',4,1],['Tree',2,3],['A Short',5,2],['Link',3,-2],['Garden',1,-3],['Wine',-1,2],['Hall',6,-1]],
 xgGet:()=>({N:[[0,0]],adj:[[]],ok:[1]}),nmActive:()=>C,xClear:(x,z)=>[x,z],isFinite,Math};
vm.createContext(ctx);
vm.runInContext(body+';globalThis.out=dmPts();',ctx);
const out=ctx.out.map(p=>[...p]);
assert(out.length>=8,'enough candidates survive');
assert(!out.some(([x,z])=>Math.hypot(x-46.7,z+27.1)<0.5),'B Site island callout must be excluded');
assert(out.some(([x,z])=>Math.hypot(x-0,z-1)<0.5),'main-area callouts kept');
// fallback: if filtering would leave too few candidates, originals are kept (never zero spawns)
const ctx2={DM:{},FV:{map:'ascent'},boxes:null,CALLOUTS:[['A Main',0,1],['B Site',46.7,-27.1]],xgGet:()=>({N:[[0,0]],adj:[[]],ok:[1]}),nmActive:()=>C,xClear:(x,z)=>[x,z],isFinite,Math};
vm.createContext(ctx2);
vm.runInContext(body+';globalThis.out=dmPts();',ctx2);
assert(ctx2.out.length>0,'tiny candidate sets still yield spawns (fallback kept the originals)');
assert(ctx2.out.some(([x,z])=>Math.hypot(x-46.7,z+27.1)<0.5),'fallback keeps the island callout when filtering would leave too few');
console.log('dmPts: spawn candidates filtered to playable nav - island callouts excluded, main area kept, fallback safe');
