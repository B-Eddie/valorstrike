// First-person ABILITY viewmodel check: builds an agent's native ability rig exactly as the game does (xAfLoad / xAfPose /
// xAfProp / xAfPhase from work/ability_fp_runtime.js) on the real assets, poses every ability through its equip -> idle ->
// cast -> recover phases and measures the held item against the holding palm and the camera view. Optional PNG.
// Usage: node tools/ability-fp-view.mjs [agent] [key c|q|e|x] [out.png] [phase equip|idle|cast|recover] [u 0..1]
import fs from 'node:fs';import vm from 'node:vm';import * as THREE from 'three';import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {parse,render} from './grip-view.mjs';
const ROOT=new URL('../../',import.meta.url).pathname,src=fs.readFileSync(ROOT+'work/ability_fp_runtime.js','utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<0)throw Error('marker '+a);return s.slice(i,j);};
export function runtime(){const cache={};const ctx={THREE:{...THREE,SkeletonUtils},console,Math,Promise,XNR:()=>{},XABT:{draw:.5,rel:.2,rec:.45},
  xvLoad:(n)=>cache[n]||(cache[n]=parse(ROOT+'models/valorant/'+n+'.glb'))};vm.createContext(ctx);
 vm.runInContext(cut(src,'var XAF_SET','function xAfHideGun(')+';globalThis.api={XAF,XAF_SET,XAF_K,xAfLoad,xAfPose,xAfProp,xAfPhase,xAfBowDraw,xAfSpec};',ctx);return ctx.api;}
export async function build(ag,api=runtime()){const R=await api.xAfLoad(ag);const cam=new THREE.Group();cam.add(R.root);R.root.visible=true;return {R,cam,api};}
// pose ability k of the rig at a phase (u: clip fraction; idle uses u directly), returns placement numbers (camera space, metres)
export async function pose(B,k,ph='idle',u=0.5){const {R,api,cam}=B,sp=api.xAfSpec(R.ag,k),set=api.XAF_SET[sp.s],clip=ph==='equip'?set.eq:ph==='idle'?set.idle:set.cast;
 const ok=sp.s==='bow'?api.xAfPose(R,clip,u,ph==='equip'?set.rEq:ph==='idle'?set.rIdle:set.rCast,u):api.xAfPose(R,clip,u);
 const P=api.xAfProp(R,sp,set);if(sp.prop)await api.xvLoadDone?.(sp.prop);await new Promise(r=>setTimeout(r,0));for(let i=0;i<50&&!P.ok;i++)await new Promise(r=>setTimeout(r,20));
 P.g.visible=ph!=='recover';cam.updateMatrixWorld(true);const v=o=>o.getWorldPosition(new THREE.Vector3()),b=n=>R.sc.getObjectByName(n);
 const palm=s=>v(b(s+'_Hand')).lerp(v(b(s+'_Middle1')),.55),hand=set.hand||'R',it=new THREE.Box3().setFromObject(P.g),c=it.isEmpty()?v(P.g):it.getCenter(new THREE.Vector3());
 let mesh='';R.sc.traverse(o=>{if(o.isSkinnedMesh&&!mesh)mesh=o.name;});
 return {ok,set:sp.s,clip,hand,mesh,item:sp.prop||'orb',itemToPalm:c.distanceTo(palm(hand)),itemSize:it.isEmpty()?0:it.getSize(new THREE.Vector3()).length(),itemZ:c.z,palm:palm(hand).toArray().map(x=>+x.toFixed(3)),
  inView:(p=>p.z<-0.1&&Math.abs(p.x/p.z)<1.1&&Math.abs(p.y/p.z)<0.75)(palm(hand))};}
if(import.meta.url===`file://${process.argv[1]}`){const [ag='Phoenix',k='q',out='',ph='idle',u='0.5']=process.argv.slice(2);const B=await build(ag);
 console.log(JSON.stringify(await pose(B,k,ph,+u),(k,v)=>typeof v==='number'?+v.toFixed(3):v));
 if(out){const S=new THREE.Group(),c=B.cam;c.rotation.y=Math.PI/2;S.add(c);render(S,out,{W:1200,H:560,zoom:3});}}
// what the player sees: a perspective raster from the camera (arms grey, held item orange). fov: vertical degrees.
export function renderCam(cam,file,{W=640,H=360,fov=74}={}){const img=new Float32Array(W*H*3).fill(.12),zb=new Float32Array(W*H).fill(1e9),f=H/2/Math.tan(fov*Math.PI/360),L=new THREE.Vector3(.3,.6,.7).normalize(),v=new THREE.Vector3(),inv=new THREE.Matrix4();
 cam.updateMatrixWorld(true);inv.copy(cam.matrixWorld).invert();
 cam.traverse(o=>{if(!o.isMesh)return;for(let q=o;q;q=q.parent)if(!q.visible)return;let prop=false;for(let q=o;q;q=q.parent)if(/^xaf-prop/.test(q.name))prop=true;const g=o.geometry,pos=g.attributes.position,idx=g.index;if(!pos)return;
  const pts=new Array(pos.count);for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld).applyMatrix4(inv);const z=-v.z;pts[i]=[W/2+v.x*f/Math.max(z,1e-3),H/2-v.y*f/Math.max(z,1e-3),z,v.clone()];}
  const n=idx?idx.count:pos.count,A=new THREE.Vector3(),B=new THREE.Vector3(),N=new THREE.Vector3();
  for(let t=0;t<n;t+=3){const a=pts[idx?idx.getX(t):t],b=pts[idx?idx.getX(t+1):t+1],c=pts[idx?idx.getX(t+2):t+2];if(a[2]<.02||b[2]<.02||c[2]<.02)continue;N.copy(B.subVectors(b[3],a[3])).cross(A.subVectors(c[3],a[3])).normalize();if(N.z<0)N.negate();
   const k=.35+.65*Math.max(0,N.dot(L)),col=prop?[1*k,.6*k,.2*k]:[.62*k,.66*k,.72*k];
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const z=l1*a[2]+l2*b[2]+l3*c[2]-(prop?.01:0),k2=y*W+x;if(z<zb[k2]){zb[k2]=z;img.set(col,k2*3);}}}});
 return {W,H,img};}
export async function sheet(file,cells,cols=4){ // cells: [{W,H,img}] -> one PNG grid
 const {W,H}=cells[0],rows=Math.ceil(cells.length/cols),SW=W*cols,SH=H*rows,raw=Buffer.alloc((SW*3+1)*SH);
 cells.forEach((c,i)=>{const ox=(i%cols)*W,oy=Math.floor(i/cols)*H;for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(let ch=0;ch<3;ch++)raw[(oy+y)*(SW*3+1)+1+(ox+x)*3+ch]=Math.round(Math.min(1,c.img[(y*W+x)*3+ch])*255);});
 const zlib=(await import('node:zlib')).default,crcT=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcT[n]=c>>>0;}const crc=b=>{let c=0xffffffff;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),cr=Buffer.alloc(4);cr.writeUInt32BE(crc(td));return Buffer.concat([l,td,cr]);};const ih=Buffer.alloc(13);ih.writeUInt32BE(SW,0);ih.writeUInt32BE(SH,4);ih[8]=8;ih[9]=2;
 fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
