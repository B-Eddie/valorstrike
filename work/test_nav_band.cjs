// Quantify nav-vs-motor divergence: directed nav edges whose per-0.18m chord max rise
// lands in bands relative to the nav gate (0.321) and the shared motor stepHeight (0.4).
const fs = require('fs'), path = require('path');
const { createRequire } = require('module');
const sreq = createRequire(path.resolve('server/build-world.cjs'));
const THREE = sreq('three'), { MeshBVH } = sreq('three-mesh-bvh');
global.THREE = THREE; global.NM = { routeCache: new Map() }; global.window = {};
const src = fs.readFileSync('work/native_maps_runtime.js', 'utf8');
function extract(name){const s=src.indexOf('function '+name+'(');let d=0,e=-1;for(let i=s;i<src.length;i++){const c=src[i];if(c==='{')d++;else if(c==='}'&&--d===0){e=i+1;break;}}return src.slice(s,e);}
const nmQi = src.indexOf('var NM_Q='); eval(src.slice(nmQi, src.indexOf('\n', nmQi)));
// hark-perf 762e33c: nmNear reads the numeric cell index (NM_NONE + nmCellNum, same line in the runtime)
const nmNi = src.indexOf('const NM_NONE=[];function nmCellNum('); eval(src.slice(nmNi, src.indexOf('\n', nmNi)).replace('const NM_NONE=','var NM_NONE='));
for (const fn of ['nmNear','nmHeight','nmBlocked']) eval(extract(fn));
function loadMap(map){
  const W='server/public/worlds/'+map+'/';
  const meta=JSON.parse(fs.readFileSync(W+'meta.json','utf8'));
  const positions=fs.readFileSync(W+'position.bin'),index=fs.readFileSync(W+'index.bin');
  const roots=[];for(let i=0;i<meta.roots;i++){const b=fs.readFileSync(W+'bvh'+i+'.bin');roots.push(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions.buffer,positions.byteOffset,positions.byteLength/4),3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(index.buffer,index.byteOffset,index.byteLength/4),1));
  g.boundsTree=MeshBVH.deserialize({index:g.index.array,roots},g,{setIndex:false});
  const NAV=JSON.parse(fs.readFileSync(W+'navigation.json','utf8'));
  const C={nav:NAV,bvh:g.boundsTree,cells:new Map()};
  NAV.nodes.forEach((p,i)=>{const k=Math.floor(p[0]/2)+','+Math.floor(p[2]/2);if(!C.cells.has(k))C.cells.set(k,[]);C.cells.get(k).push(i);});
  return C;
}
let fail=0;
for (const map of (process.argv.length>2?process.argv.slice(2):['ascent','bind','breeze','haven','lotus','split'])) {
  const C=loadMap(map),N=C.nav.nodes,A=C.nav.adj;
  let edges=0,band321_400=0,band321_400_clear=0,band400_410=0,over410=0,blockedRej=0;
  let bandEdges=[];
  for(let a=0;a<N.length;a++)for(const b of A[a]){
    edges++;
    const p=N[a],q=N[b],d=Math.hypot(q[0]-p[0],q[2]-p[2]),st=Math.max(1,Math.ceil(d/.18));
    let y=p[1],maxRise=-9,blk=false;
    for(let k=1;k<=st;k++){
      const x=p[0]+(q[0]-p[0])*k/st,z=p[2]+(q[2]-p[2])*k/st,h=nmHeight(C,x,z,y);
      if(h-y>maxRise)maxRise=h-y;
      if(nmBlocked(C,x,z,.45,Math.max(y,h)+.32)){blk=true;break;}
      y=h;
    }
    if(blk){blockedRej++;continue;}
    if(maxRise>0.321&&maxRise<=0.40){band321_400++;band321_400_clear++;if(bandEdges.length<8)bandEdges.push([a,b,+maxRise.toFixed(3)]);fail=1;}
    else if(maxRise>0.40&&maxRise<=0.41)band400_410++;
    else if(maxRise>0.41)over410++;
  }
  console.log(map+': directed edges '+edges+' | rise .321-.40 (nav rejects, motor walks): '+band321_400+' | .40-.41: '+band400_410+' | >.41: '+over410+' | blocked-rejected: '+blockedRej);
  if(bandEdges.length)console.log('  sample band edges (a,b,maxRise):',JSON.stringify(bandEdges));
}
console.log(fail?'FAIL: nav chords exist in the 0.321-0.4 band (nav rejects what the motor walks) - the latent nav/motor gate divergence has materialized; resolve the gate constants deliberately.':'PASS: zero nav chords in the 0.321-0.4 band on all checked maps.');
process.exitCode=fail;
