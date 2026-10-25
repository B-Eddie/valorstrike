// Native first-person viewmodel check (ledger row 5): builds the agent's native FP arms + weapon exactly as the game
// does (xvFPLoad / xvFPPlay from work/valorant_runtime.js), plays idle/equip/fire/reload/inspect and measures how
// far each hand is from the weapon it holds (right palm to the grip/trigger, left palm to the weapon). Optional PNG
// from the view camera. Usage: node tools/fp-view.mjs [agent] [weapon] [out.png] [kind] [t0..1]
import fs from 'node:fs';import vm from 'node:vm';import * as THREE from 'three';import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {parse,render} from './grip-view.mjs';
const ROOT=new URL('../../',import.meta.url).pathname,vr=fs.readFileSync(ROOT+'work/valorant_runtime.js','utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<0)throw Error('marker '+a);return s.slice(i,j);};
const win={};vm.runInNewContext(fs.readFileSync(ROOT+'models/valorant/manifest.js','utf8'),{window:win});
export function runtime(skin=null){const cache={};const ctx={THREE:{...THREE,SkeletonUtils},console,Math,Promise,Set,XNR:()=>{},XV:{config:win.VALORANT_ASSETS,failures:{}},
  ...(skin?{xskGet:()=>skin.id,xskAsset:()=>skin.asset,xskModelData:async()=>JSON.parse(fs.readFileSync(ROOT+skin.asset.config))}:{}),
  xvLoad:(n)=>cache[n]||(cache[n]=parse(ROOT+'models/valorant/'+n+'.glb'))};vm.createContext(ctx);
 vm.runInContext(cut(vr,'function xvFind(','function xvStatic(')+cut(vr,'function xvFPPlay(','function xvFPClear(')+';globalThis.api={xvFPLoad,xvFPPlay};',ctx);return ctx.api;}
const wn=(w)=>w==='melee'?'Knife':w.charAt(0).toUpperCase()+w.slice(1);
export async function build(agent='jett',weapon='vandal',api=runtime()){const F=await api.xvFPLoad(wn(agent),wn(weapon));const cam=new THREE.Group();cam.add(F.root);return {F,cam,api};}
// pose at kind/t (t: fraction of the clip), returns hand gaps in metres (viewmodel space = camera space, unscaled)
export function measure(R,kind='idle',t=0.5){const {F,api}=R;F.kind=null;api.xvFPPlay(F,kind,t);R.cam.updateMatrixWorld(true);
 const b=(n)=>F.sc.getObjectByName(n),v=(o)=>o.getWorldPosition(new THREE.Vector3());const palm=(s)=>{const h=b(s+'_Hand'),m=b(s+'_Middle1');return h&&m?v(h).lerp(v(m),.55):null;};
 const ws=[];F.ws.traverse(o=>{if(o.isMesh)ws.push(o);});const pts=[];const p=new THREE.Vector3();
 for(const o of ws){const pos=o.geometry.attributes.position;if(o.isSkinnedMesh)o.skeleton.update();const step=Math.max(1,Math.floor(pos.count/1500));for(let i=0;i<pos.count;i+=step){p.fromBufferAttribute(pos,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,p);pts.push(p.clone().applyMatrix4(o.matrixWorld));}}
 const near=(q)=>{if(!q||!pts.length)return null;let d=1e9;for(const x of pts)d=Math.min(d,x.distanceTo(q));return d;};
 const R_=palm('R'),L_=palm('L'),vis=(q)=>q?q.z<-0.05:false;
 return {right:near(R_),left:near(L_),rightInView:vis(R_),leftInView:vis(L_),clip:!!F.action,dur:F.action?F.action.getClip().duration:0};}
export function anims(R){return [...new Set(R.F.entries.map(e=>e.Translatable))];}
if(import.meta.url===`file://${process.argv[1]}`){const [agent='jett',weapon='vandal',out='',kind='idle',t='0.5']=process.argv.slice(2);const R=await build(agent,weapon);
 console.log(anims(R).join(','));console.log(JSON.stringify(measure(R,kind,+t),(k,v)=>typeof v==='number'?+v.toFixed(3):v));
 if(out){const S=new THREE.Group(),c=R.cam;c.rotation.y=Math.PI/2;S.add(c);render(S,out,{W:1200,H:560,zoom:3});}}
