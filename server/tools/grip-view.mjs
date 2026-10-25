// Third-person weapon grip check (#9): loads a native agent + native weapon with the game's own runtime code
// (xvStatic, xUbRot/xUbPre/xUbPost from index.html, work/grip_runtime.js), poses it through the native clips
// and the grip IK, and software-rasterises side/front/top views to PNG. Also exports measurements for tests.
// Usage: node tools/grip-view.mjs [agent] [weapon] [out.png] [pitchRad] [state]   state: idle|walk|run|crouch|reload
import fs from 'node:fs';import zlib from 'node:zlib';import vm from 'node:vm';import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
const ROOT=new URL('../../',import.meta.url).pathname;
export async function parse(file){let b=fs.readFileSync(file),n=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+n));for(const m of g.materials||[]){delete m.normalTexture;delete m.emissiveTexture;delete m.occlusionTexture;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}for(const k of ['images','textures','samplers'])delete g[k];
 let j=Buffer.from(JSON.stringify(g));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const bin=b.subarray(28+n),head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+j.length+bin.length,8);head.writeUInt32LE(j.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);b=Buffer.concat([head,j,bh,bin]);
 const ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);return new Promise((res,rej)=>new GLTFLoader().parse(ab,'',res,rej));}
const html=fs.readFileSync(ROOT+'index.html','utf8'),vr=fs.readFileSync(ROOT+'work/valorant_runtime.js','utf8'),grip=fs.readFileSync(ROOT+'work/grip_runtime.js','utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<0)throw Error('marker '+a);return s.slice(i,j);};
export function runtime(){const ctx={THREE:{...THREE,SkeletonUtils},console,Math,XGM:{T:{}},XSOL:null};vm.createContext(ctx);
 vm.runInContext('var XUB={up:new THREE.Vector3(0,1,0),rt:new THREE.Vector3(1,0,0)};function xGmTpl(){return null;}function xGmSwap(){}\n'+cut(vr,'function xvFind(','function xvAgentName(')+'\n'+cut(html,'function xUbRot(','// death: one of two death clips')+'\n'+grip+';globalThis.api={xvStatic,xgTemplate,xgPose,xUbPre,xUbPost,XGRIP};',ctx);return ctx.api;}
const ST={idle:'Idle_Loop',walk:'Walk_Loop',run:'Jog_Fwd_Loop',crouch:'Crouch_Idle_Loop',aim:'Pistol_Aim_Neutral',reload:'Pistol_Reload',knife:'Sword_Idle'};
// Builds an agent the way xvAgent does (scale to 1.92 m, gun in a hold group under R_Hand), plays lower+upper clips.
export async function build(agent='jett',weapon='vandal',api=runtime()){
 const gl=await parse(ROOT+'models/valorant/'+agent+'.glb'),data=JSON.parse(fs.readFileSync(ROOT+'models/valorant/'+agent+'-locomotion.json')),up=/^(Spine[234]|Neck|Head|[LR]_(Clavicle|Shoulder|Elbow|Hand|Thumb|Index|Middle|Ring|Pinky))/;
 const C={},L={},U={};data.forEach(j=>{const c=THREE.AnimationClip.parse(j);C[c.name]=c;L[c.name]=new THREE.AnimationClip(c.name+'_L',c.duration,c.tracks.filter(t=>!up.test(t.name)));U[c.name]=new THREE.AnimationClip(c.name+'_U',c.duration,c.tracks.filter(t=>up.test(t.name)));});
 const wg=await parse(ROOT+'models/valorant/'+weapon+'.glb'),cfg=JSON.parse(fs.readFileSync(ROOT+'models/valorant/'+weapon+'.json')),inner=api.xvStatic(wg,cfg);
 const name=weapon.charAt(0).toUpperCase()+weapon.slice(1),side=['Classic','Shorty','Frenzy','Ghost','Sheriff'].includes(name);
 const rot=new THREE.Group(),Tg=new THREE.Group();rot.add(inner);Tg.add(rot);rot.rotation.y=-Math.PI/2;Tg.updateMatrixWorld(true);let gb=new THREE.Box3().setFromObject(Tg);
 const length={Classic:.2,Shorty:.32,Frenzy:.24,Ghost:.27,Sheriff:.3,Stinger:.6,Spectre:.68,Bucky:1,Judge:.9,Bulldog:.85,Guardian:1.0,Phantom:.93,Vandal:.95,Marshal:1.12,Outlaw:1.15,Operator:1.25,Ares:1.0,Odin:1.1}[name]||.9;
 rot.scale.setScalar(length/(gb.max.z-gb.min.z));Tg.updateMatrixWorld(true);gb=new THREE.Box3().setFromObject(Tg);rot.position.set(-(gb.min.x+gb.max.x)/2,-(gb.min.y+gb.max.y)/2,-gb.min.z-length);Tg.userData.my=0;api.xgTemplate(Tg,name);
 const sc=SkeletonUtils.clone(gl.scene),wr=new THREE.Group();wr.add(sc);sc.updateMatrixWorld(true);const bx=new THREE.Box3().setFromObject(sc),scale=1.92/(bx.max.y-bx.min.y);wr.scale.setScalar(scale);wr.position.y=-bx.min.y*scale;
 const m=new THREE.Group();m.add(wr);const mx=new THREE.AnimationMixer(sc),bone=n=>sc.getObjectByName(n);
 const X={mx,a:{},w:{},ub:1,sc,b:{pelvis:bone('Pelvis'),spine_01:bone('Spine1'),spine_02:bone('Spine2'),spine_03:bone('Spine3')},yaw:0,pit:0,uo:null};
 const gun=new THREE.Group();gun.add(Tg);m.add(gun);const M={m,sx:X,gun,w:name,valorant:1,dead:0};
 const play=(lo,upn)=>{mx.stopAllAction();X.a={};const a=mx.clipAction(L[ST[lo]]);a.play();const b=mx.clipAction(U[ST[upn]]);b.play();X.uo=upn==='aim'||upn==='knife'?null:upn;};
 play('idle','aim');mx.update(.01);m.updateMatrixWorld(true);
 const hand=bone('R_Hand'),hold=new THREE.Group(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();new THREE.Matrix4().copy(m.matrixWorld).invert().multiply(hand.matrixWorld).decompose(p,q,s);hold.quaternion.copy(q.invert());hold.scale.set(1/s.x,1/s.y,1/s.z);hand.add(hold);hold.add(gun);gun.position.set(0,0,.03);gun.rotation.set(0,Math.PI,0);
 const step=(n=30,dt=1/30)=>{for(let i=0;i<n;i++){api.xUbPre(M);mx.update(dt);api.xUbPost(M);}m.updateMatrixWorld(true);};
 return {M,X,play,step,api,bone,inner,Tg};}
// Measurements: hand-to-socket gaps and the gun's aim alignment, in metres/radians.
export function measure(R){const {M,bone}=R,g=M.gun.children[0].userData.grip||{},v=new THREE.Vector3(),w=new THREE.Vector3();M.m.updateMatrixWorld(true);
 const at=(a)=>v.fromArray(a).applyMatrix4(M.gun.matrixWorld).clone();const palm=(side)=>{const h=bone(side+'_Hand').getWorldPosition(new THREE.Vector3()),mid=bone(side+'_Middle1').getWorldPosition(new THREE.Vector3());return h.lerp(mid,.6);};
 const dir=new THREE.Vector3(0,0,-1).transformDirection(M.gun.matrixWorld),p=M.sx.pit||0,aim=new THREE.Vector3(0,Math.sin(p),Math.cos(p));
 const curl=bone('R_Middle2').quaternion.angleTo(bone('R_Middle2').userData.rest||bone('R_Middle2').quaternion);
 return {right:palm('R').distanceTo(at(g.rh)),left:g.lh?new THREE.Line3(at(g.lh),at(g.rh)).closestPointToPoint(palm('L'),true,w).distanceTo(palm('L')):palm('L').distanceTo(at(g.rh)),slide:M.sx.grip&&M.sx.grip.slide||0,aimErr:dir.angleTo(aim),gunY:at(g.rh).y,side:g.side};}
// --- software rasteriser (orthographic) ---
export function render(root,file,{W=900,H=420,zoom=0}={}){const img=new Float32Array(W*H*3).fill(.12),zb=new Float32Array(W*H).fill(-1e9);root.updateMatrixWorld(true);
 const views=[['side',new THREE.Matrix4().makeRotationY(-Math.PI/2)],['front',new THREE.Matrix4().makeRotationY(Math.PI)],['top',new THREE.Matrix4().makeRotationX(Math.PI/2)]],L=new THREE.Vector3(.3,.6,.7).normalize(),v=new THREE.Vector3();
 (zoom?[views[0],[ 'front2',new THREE.Matrix4()],views[2]]:views).forEach(([name,R],vi)=>{const ox=(vi+.5)*W/3,oy=name==='top'?H*.5:H-20,sc=(name==='top'?260:200)*(zoom||1),cy=zoom&&name!=='top'?1.05:0;
  root.traverse(o=>{if(!o.isMesh)return;for(let q=o;q;q=q.parent)if(!q.visible)return;const g=o.geometry,pos=g.attributes.position,idx=g.index;if(!pos)return;const gun=(()=>{for(let q=o;q;q=q.parent)if(q.userData&&q.userData.grip)return true;return false;})();
   const pts=new Array(pos.count);for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);if(name==='top')v.y-=1.3;v.applyMatrix4(R);pts[i]=[ox+v.x*sc,oy-(v.y-cy)*sc,v.z,v.clone()];}
   const n=idx?idx.count:pos.count,A=new THREE.Vector3(),B=new THREE.Vector3(),N=new THREE.Vector3();
   for(let t=0;t<n;t+=3){const a=pts[idx?idx.getX(t):t],b=pts[idx?idx.getX(t+1):t+1],c=pts[idx?idx.getX(t+2):t+2];N.subVectors(B.subVectors(b[3],a[3]),A.set(0,0,0)).cross(A.subVectors(c[3],a[3])).normalize();if(N.z<0)N.negate();const k=.35+.65*Math.max(0,N.dot(L)),col=gun?[.95*k,.55*k,.2*k]:[.62*k,.66*k,.72*k];
    const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const z=l1*a[2]+l2*b[2]+l3*c[2]+(gun?.02:0),k2=y*W+x;if(z>zb[k2]){zb[k2]=z;img.set(col,k2*3);}}}});});
 const raw=Buffer.alloc((W*3+1)*H);for(let y=0;y<H;y++){raw[y*(W*3+1)]=0;for(let x=0;x<W*3;x++)raw[y*(W*3+1)+1+x]=Math.round(Math.min(1,img[y*W*3+x])*255);}
 const crcT=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcT[n]=c>>>0;}const crc=b=>{let c=0xffffffff;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),cr=Buffer.alloc(4);cr.writeUInt32BE(crc(td));return Buffer.concat([l,td,cr]);};const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
 fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
if(import.meta.url===`file://${process.argv[1]}`){const [agent='jett',weapon='vandal',out='/tmp/grip.png',pitch='0',state='idle']=process.argv.slice(2);const R=await build(agent,weapon);R.play(state==='reload'?'idle':state,state==='reload'?'reload':'aim');R.X.pit=+pitch;R.step(40);
 console.log(JSON.stringify(measure(R),(k,v)=>typeof v==='number'?+v.toFixed(3):v));render(R.M.m,out,process.env.ZOOM?{W:1200,H:560,zoom:+process.env.ZOOM}:{});}
