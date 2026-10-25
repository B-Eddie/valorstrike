// gNav must route to the closest reachable node when the goal sits on another nav component.
// Nav fragmentation (73-236 components/map, a known nav-data defect) strands intended space
// like Ascent B Site on islands; the old code returned the start node itself, parking hunters
// permanently (observed live: TDM units stationary 16s+ with no target at ascent B site).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const body=src.slice(src.indexOf('function gNav'),src.indexOf('function fNav('));
function mkG(N,adj){return {N,ok:N.map(()=>1),adj,pc:null,ty:{}};}
function run(N,adj,px,pz,tx,tz){
 const ctx={ascClear:(x1,z1,x2,z2)=>Math.hypot(x2-x1,z2-z1)<15,xgGet:()=>mkG(N,adj),Math}; // short hops clear, cross-map segment 'through a wall' not
 vm.createContext(ctx);
 vm.runInContext(body+';globalThis.out=gNav('+px+','+pz+','+tx+','+tz+');',ctx);
 return ctx.out;
}
// two components: 0-1 connected, 2 stranded
const N=[[0,0],[10,0],[30,0]],adj=[[[1,10]],[[0,10]],[]];
{const r=run(N,adj,0,0,30,0);assert.deepEqual([...r],[10,0],'unreachable goal: route to closest reachable node, not the start node');}
// fully connected: normal routing unaffected
const adj2=[[[1,10]],[[0,10],[2,20]],[[1,20]]];
{const r=run(N,adj2,0,0,30,0);assert.deepEqual([...r],[10,0],'reachable goal: routes along the graph toward the goal (next clear waypoint)');}
// start stranded: goal reachable from nowhere - direct steer fallback, never the parked node
{const r=run(N,adj,30,0,0,0);assert.notDeepEqual([...r],[30,0],'stranded start: must not park on its own node');}
console.log('gNav: unreachable goals route to the closest reachable node; reachable goals unchanged; no park-on-start');
