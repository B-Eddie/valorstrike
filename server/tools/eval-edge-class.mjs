import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';
process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
for(const [key,pts] of [['bind',[[-30,7,-11],[-30,7,-10]]],['split',[[-28,6,-38],[-27,6,-38]]],['lotus',[[-63,4,9],[-62,4,10]]]]){
 const w=await loadWorld(assets,key);
 for(const [A,B] of [[pts[0],pts[1]]]){
  const mx=(A[0]+B[0])/2,mz=(A[2]+B[2])/2,g=w.ground(mx,mz,Math.max(A[1],B[1])+1.8);
  console.log(key,'edge mid ground',g.toFixed(2),'endpoint y',A[1],B[1],'drop',(Math.min(A[1],B[1])-g).toFixed(2));}}
