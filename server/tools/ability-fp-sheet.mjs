// Contact sheet of an agent's first-person abilities (rows C/Q/E/X; columns equip, idle, cast, recover) from the camera, plus the per-pose numbers. Usage: node tools/ability-fp-sheet.mjs Agent out.png
import {build,pose,renderCam,sheet} from './ability-fp-view.mjs';
const [ag,out]=process.argv.slice(2);const B=await build(ag);const cells=[];const rows=[];
for(const k of ['c','q','e','x'])for(const [ph,u] of [['equip',.35],['idle',.3],['cast',.1],['recover',.6]]){const m=await pose(B,k,ph,u);rows.push([k,ph,m.set,m.clip,+m.itemToPalm.toFixed(3),m.inView].join(' '));cells.push(renderCam(B.cam,null,{W:320,H:180}));}
await sheet(out,cells,4);console.log(rows.join('\n'));
