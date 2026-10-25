// gNav must route to the closest reachable node when the goal sits on another nav component.
// Nav fragmentation (73-236 components/map, a known nav-data defect) strands intended space
// like Ascent B Site on islands; the old code returned the start node itself, parking hunters
// permanently (observed live: TDM units stationary 16s+ with no target at ascent B site).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const body=src.slice(src.indexOf('function gNav'),src.indexOf('function fNav('));
function mkG(N,adj){return {N,ok:N.map(()=>1),adj,pc:null,ty:{}};}
function run(N,adj,px,pz,tx,tz){
 const ctx={ascClear:(x1,z1,x2,z2)=>Math.hypot(x2-x1,z2-z1)<15,xgGet:()=>mkG(N,adj),Math,groundAt:()=>0}; // short hops clear, cross-map segment 'through a wall' not; all floors level here
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
// height-aware attach: nodes on another floor must not capture the start/goal
function runH(N,adj,gy,px,pz,tx,tz,py){
 const ctx={ascClear:(x1,z1,x2,z2)=>Math.hypot(x2-x1,z2-z1)<15,xgGet:()=>mkG(N,adj),Math,groundAt:(x,z,r,y)=>gy(x,z)};
 vm.createContext(ctx);
 vm.runInContext(body+';globalThis.out=gNav('+px+','+pz+','+tx+','+tz+','+py+');',ctx);
 return [...ctx.out];
}
// platform nodes (ground 10) around (24,-26.7): a unit at y=0 must NOT attach to them
{const r=runH([[24,-26.5],[23.5,-27.2]],[[[1,1]],[[0,1]]],()=>10, 24,-26.7, 0,0, 0);assert.deepEqual(r,[0,0],'unit at y=0: no same-floor node -> direct steer to goal, not the platform overhead');}
{const r=runH([[24,-26.5],[40,-26.5]],[[[1,16]],[[0,16]]],()=>10, 24,-26.7, 45,-26.5, 10);assert.deepEqual(r,[40,-26.5],'unit at y=10 (on the platform): attaches and routes along the graph');}
{const r=runH([[24,-26.5],[40,-26.5]],[[[1,16]],[[0,16]]],()=>10, 24,-26.7, 45,-26.5, 0);assert.deepEqual(r,[45,-26.5],'same geometry at y=0: no same-floor node -> direct steer, never the overhead platform');}
console.log('gNav: unreachable goals route to the closest reachable node; reachable goals unchanged; no park-on-start');
console.log('gNav height-aware attach: units never route via nodes on another floor');
