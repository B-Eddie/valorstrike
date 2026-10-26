// Collection skin preview check: builds the preview model exactly as the page does (xskPvTpl's pose: xvStatic from
// work/valorant_runtime.js with the skin descriptor / Standard manifest config, rot.y -90 deg, centred, length 1, the
// Knife tilted 0.5 rad, turntable yaw 1.05 / pitch 0.12) and software-rasterises it (grip-view.mjs render: side / camera
// view / top). Untextured, shading only: checks model identity, orientation and framing, not materials.
// Usage: node tools/skin-preview-view.mjs <Weapon> [skinId|standard] [out.png]
import fs from 'node:fs';import vm from 'node:vm';import * as THREE from 'three';import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {parse,render} from './grip-view.mjs';
const ROOT=new URL('../../',import.meta.url).pathname,vr=fs.readFileSync(ROOT+'work/valorant_runtime.js','utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<0)throw Error('marker '+a);return s.slice(i,j);};
const win={};vm.runInNewContext(fs.readFileSync(ROOT+'models/valorant/manifest.js','utf8'),{window:win});
const ctx={THREE:{...THREE,SkeletonUtils},console,Math};vm.createContext(ctx);vm.runInContext(cut(vr,'function xvFind(','function xvAgentName(')+';globalThis.api={xvStatic};',ctx);
export async function build(w='Vandal',id='standard'){const cat=JSON.parse(fs.readFileSync(ROOT+'server/src/skins.json','utf8'));
 let model=w==='Knife'?'melee':w.toLowerCase(),cfg=win.VALORANT_ASSETS[model];
 if(id!=='standard'){const m=/^([a-z0-9-]+)(?:\.(\d))?$/.exec(id),a=cat.collections.find(c=>c.id===m[1]).skins[w].assets[m[2]?+m[2]:0];model=a.model;cfg=JSON.parse(fs.readFileSync(ROOT+a.config,'utf8')).descriptor;}
 const gl=await parse(ROOT+'models/valorant/'+model+'.glb'),inner=ctx.api.xvStatic(gl,cfg),rot=new THREE.Group(),T=new THREE.Group();rot.add(inner);T.add(rot);rot.rotation.y=-Math.PI/2;
 const g=T.clone(true);g.updateMatrixWorld(true);{const s0=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());if(s0.y>s0.z&&s0.y>s0.x){g.rotation.x=-Math.PI/2;g.updateMatrixWorld(true);}}const box=new THREE.Box3().setFromObject(g),c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3()),L=Math.max(s.x,s.y,s.z)||1;
 const hold=new THREE.Group();g.position.sub(c);hold.add(g);hold.scale.setScalar(1/L);if(w==='Knife')hold.rotation.z=.5;const piv=new THREE.Group();piv.add(hold);piv.rotation.set(.12,1.05,0);
 const muz=new THREE.Box3().setFromObject(T);return {piv,hold,model,size:s.toArray().map(v=>+(v/L).toFixed(3)),len:+L.toFixed(3),longAxis:['x','y','z'][s.toArray().indexOf(L)],minZ:+muz.min.z.toFixed(3)};}
if(import.meta.url===`file://${process.argv[1]}`){const [w='Vandal',id='standard',out='/tmp/skinpv.png']=process.argv.slice(2);const R=await build(w,id);
 console.log(JSON.stringify({w,id,model:R.model,len:R.len,longAxis:R.longAxis,size:R.size}));const S=new THREE.Group(),up=new THREE.Group();up.position.y=1.05;up.add(R.piv);S.add(up);render(S,out,{W:1200,H:500,zoom:1.6});}
