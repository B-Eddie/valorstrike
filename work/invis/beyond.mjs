// for each leash-stop cluster rep: continue in the node->rep direction ignoring the leash; how far to a wall / ledge?
import fs from 'node:fs';import path from 'node:path';
const S='/workspace/work/vs-lane-invis/server/';const {loadWorld}=await import(S+'src/world.js');
const key=process.argv[2],F=process.argv[3]||'leash_'+key+'.json';const W=await loadWorld({fetch:async r=>new Response(await fs.promises.readFile(path.join(S+'public',new URL(r.url).pathname)))},key);
const C=JSON.parse(fs.readFileSync(F)).filter(c=>c.plant);
for(const c of C.slice(0,+process.env.TOP||30)){const [x,y,z]=c.rep,[nx,,nz]=c.node,L=Math.hypot(x-nx,z-nz),ux=(x-nx)/L,uz=(z-nz)/L;let py=y,s=0,why='far';
 for(s=.1;s<=12;s+=.1){const qx=x+ux*s,qz=z+uz*s,g=W.ground(qx,qz,py+.45);if(!Number.isFinite(g)||g<py-.45){why='ledge '+(Number.isFinite(g)?(py-g).toFixed(1)+'m':'void');break;}if(g>py+.45||W.blocked(qx,qz,.38,g+.42,1.38)){why='wall';break;}py=g;}
 console.log(c.callout.padEnd(26),JSON.stringify(c.rep).padEnd(24),'pushes',String(c.pushes).padStart(3),'beyond stop:',s.toFixed(1),'m to',why);}
