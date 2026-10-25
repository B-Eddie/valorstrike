// TDM/DM ally hunt + native routing regression (breeze west-edge stall).
// 1) dmGo runs TDM/DM as mode "five" with FV.dm set, so the ally hunt branch must key on FV.dm,
//    and the spike-site xGoal override must stand down for DM/TDM (no spike). Pinned at source.
// 2) nmNext must validate EVERY hop from the unit's actual position: a nearest graph edge behind
//    a wall corner parks the unit in a blocked re-plan loop. With no clear hop it steers at the
//    goal itself so collision sliding + xUn re-approach. Behavioral, over the spliced runtime.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
assert(html.includes('else if (mode !== "five" || FV.dm) { const nb = a.xNb;'),'ally hunt branch covers DM/TDM (FV.dm), not just literal non-five modes');
assert(html.includes('if (mode === "five" && !FV.dm) { const o = xGoal(a, allies, FV.atk, XG_V); if (o) [gx, gz] = o; }'),'spike-site goal override stands down for DM/TDM');
assert(html.includes('if (mode === "five" && !FV.dm) { const o = xGoal(b, bots, !FV.atk, XG_V); if (o) [gx, gz] = o; }'),'enemy-bot goal override already stood down for DM/TDM');
assert(src.includes('u.np=nmNext(C,u,gx,gz)'),'native xPath wrapper routes through nmNext');
const body=src.slice(src.indexOf('function nmSegDrop('),src.indexOf('{const p=xPath;'));
function mk(blocked){
 const nodes=[[0,0,0],[1,0,0],[2,0,0],[3,0,0],[4,0,0],[5,0,0],[6,0,0],[7,0,0],[8,0,0],[9,0,0],[10,0,0],[11,0,0]];
 const ctx={nodes,nmNear:()=>0,nmPath:(C,s,e)=>C.path,nmSegment:(C,p,n)=>!blocked.has(n[0])};
 ctx.nmHeight=(C,x,z,y)=>ctx._drop&&x>0.5?y-2:y; ctx.nmBlocked=(C,x,z)=>!!(ctx._wall&&x>0.5);
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(body+';globalThis.api=(u,gx,gz)=>nmNext({nav:{nodes}},u,gx,gz);',ctx);
 return {ctx,nodes};}
const me=()=>({g:{position:{x:0,y:0,z:0}}});
{const t=mk(new Set());t.ctx.nmPath=()=>[0,1,2,3];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([3,0]),'all hops clear: farthest validated node wins');}
{const t=mk(new Set());t.ctx.nmPath=()=>[0,1,2,3];t.ctx.nodes[1]=[0.4,0,0];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([3,0]),'node the unit stands on (<0.8u) is skipped, never targeted');}
{const t=mk(new Set());t.ctx.nmPath=()=>[0,1];t.ctx.nodes[1]=[0.4,0,0];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([50,50]),'only reached-range nodes ahead: steer at the goal (planner/arrive-threshold deadlock fix)');}
{const t=mk(new Set([1]));t.ctx._wall=true;t.ctx.nmPath=()=>[0,1,2,3];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([3,0]),'walled first hop skipped: next clear node targeted');}
{const t=mk(new Set([1,2,3]));t.ctx._wall=true;t.ctx.nmPath=()=>[0,1,2,3];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([50,50]),'every hop walled: steer at the goal, never freeze on [p.x,p.z]');}
{const t=mk(new Set());t.ctx.nmPath=()=>[];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([0,0]),'no path: hold position');}
{const t=mk(new Set());t.ctx.nmPath=()=>[0,1,2,3,4,5,6,7,8,9,10,11];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([9,0]),'skip-ahead capped within the first 10 path nodes');}
{const t=mk(new Set());t.ctx.nmPath=()=>[0];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([50,50]),'trivial path: steer at the goal');}
{const t=mk(new Set([1,2,3]));t.ctx._drop=true;t.ctx.nmPath=()=>[0,1,2,3];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([1,0]),'ledge-drop first edge: taken exactly, no skip-ahead across the drop');}
{const t=mk(new Set([1,2,3]));t.ctx._wall=true;t.ctx.nmPath=()=>[0,1,2,3];assert.equal(JSON.stringify(t.ctx.api(me(),50,50)),JSON.stringify([50,50]),'first edge blocked solid (wall, not a drop): goal steer, no parking');}
{const t=mk(new Set([2,3]));t.ctx._wall=true;t.ctx.nmPath=()=>[0,1,2,3];const off={g:{position:{x:1.5,y:0,z:0}}};assert.equal(JSON.stringify(t.ctx.api(off,50,50)),JSON.stringify([0,0]),'no clear hop off-corridor: step back onto the nearest mesh node first');}
console.log('TDM/DM hunt goal keys on FV.dm; native nmNext validates the first hop, skips blocked hops, and steers at the goal when no hop clears');
