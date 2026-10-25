// ---- SKIN FINISHERS ----
// Custom pooled 3D recreations of Prime's wolf strike and BlastX's wrapping present.
// Original kill-banner art and finisher audio are downloaded separately; no corpse bones or colliders are modified.
var XF={pool:[],ready:false,seen:new Set(),socket:null,lastRound:null,created:0,played:0,cleared:0,dummy:new THREE.Object3D(),textures:{}};
function xfSupported(w,id){return w!=='Knife'&&typeof xskValidFor==='function'&&xskValidFor(w,id)&&/^(prime|blastx)(\.[1-9])?$/.test(id);}
function xfMaterials(color){return new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false,fog:false});}
function xfMesh(slot,geo,mat,parent,x=0,y=0,z=0){const normal=geo.attributes.normal;if(normal){const colors=new Float32Array(normal.count*3);for(let i=0;i<normal.count;i++){const shade=.42+.58*Math.max(0,normal.getX(i)*.28+normal.getY(i)*.45+normal.getZ(i)*.85);colors[i*3]=colors[i*3+1]=colors[i*3+2]=shade;}geo.setAttribute('color',new THREE.BufferAttribute(colors,3));mat.vertexColors=true;}const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.frustumCulled=false;m.raycast=typeof XNR==='function'?XNR:()=>{};(parent||slot.root).add(m);return m;}
function xfCreate(type){const root=new THREE.Group();root.name='skin-finisher-'+type;root.visible=false;root.renderOrder=2;const s={type,root,active:false,age:0,hidden:null,mats:[],seed:1};
 const mat=c=>{const m=xfMaterials(c);s.mats.push(m);return m;},gold=mat(0xe1b94d),light=mat(0xfff1ba),blue=mat(0x60c9ff),dark=mat(0x23253c),paper=mat(0x56b334),ribbon=mat(0x6c348f),orange=mat(0xffad39);
 s.paper=paper;s.ribbon=ribbon;s.orange=orange;s.gold=gold;s.blue=blue;
 const sigil=xfMesh(s,new THREE.RingGeometry(.78,.84,48),gold,root,0,.03,0);sigil.rotation.x=-Math.PI/2;s.sigil=sigil;
 if(type==='prime'){
  const head=new THREE.Group(),jaw=new THREE.Group();root.add(head);head.add(jaw);s.head=head;s.jaw=jaw;jaw.position.set(0,-.35,.2);
  const outline=new THREE.Shape();outline.moveTo(0,-.8);for(const p of [[-.48,-.5],[-.75,-.05],[-.9,.85],[-.3,.55],[0,.75],[.3,.55],[.9,.85],[.75,-.05],[.48,-.5]])outline.lineTo(...p);outline.closePath();
  xfMesh(s,new THREE.ExtrudeGeometry(outline,{depth:.42,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.06,bevelThickness:.06}),light,head,0,0,0);
  for(const side of [-1,1]){const ear=xfMesh(s,new THREE.ConeGeometry(.23,.55,3),light,head,side*.64,.58,.37);ear.rotation.z=-side*.25;
   const eye=xfMesh(s,new THREE.BoxGeometry(.32,.08,.07),blue,head,side*.33,.12,.42);eye.rotation.z=side*.28;
   const brow=xfMesh(s,new THREE.BoxGeometry(.45,.11,.1),light,head,side*.35,.29,.4);brow.rotation.z=side*.27;
   const cheek=xfMesh(s,new THREE.ConeGeometry(.25,.6,3),light,head,side*.4,-.29,.32);cheek.rotation.z=Math.PI+side*.45;
   for(let i=0;i<2;i++){const fang=xfMesh(s,new THREE.ConeGeometry(.075,.35,4),light,head,side*(.22+i*.14),-.35,.53);fang.rotation.z=Math.PI;}}
  xfMesh(s,new THREE.BoxGeometry(.58,.24,.66),light,head,0,-.18,.55);xfMesh(s,new THREE.ConeGeometry(.17,.22,3),dark,head,0,-.2,.96).rotation.x=Math.PI/2;
  const mouth=xfMesh(s,new THREE.BoxGeometry(.62,.3,.45),dark,jaw,0,-.14,.13);s.mouth=mouth;xfMesh(s,new THREE.ConeGeometry(.3,.45,3),gold,jaw,0,-.32,.1).rotation.z=Math.PI;
  for(const side of [-1,1])xfMesh(s,new THREE.ConeGeometry(.06,.22,4),light,jaw,side*.25,.03,.35);
  s.rays=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,ray=xfMesh(s,new THREE.BoxGeometry(.025,1,.025),i%2?blue:light,root,Math.cos(a)*.6,2.1,Math.sin(a)*.6);ray.rotation.z=(i%2?.12:-.12);s.rays.push(ray);}
 }else{
  const box=new THREE.Group();root.add(box);s.box=box;s.panels=[];
  for(const [x,y,z,sx,sy,sz]of [[-.65,1.05,0,.045,2.1,1],[.65,1.05,0,.045,2.1,1],[0,1.05,-.5,1.3,2.1,.045],[0,1.05,.5,1.3,2.1,.045],[0,0,0,1.3,.04,1]]){const m=xfMesh(s,new THREE.BoxGeometry(sx,sy,sz),paper,box,x,y,z);s.panels.push({m,x,y,z});}
  s.lid=xfMesh(s,new THREE.BoxGeometry(1.4,.12,1.1),orange,box,0,2.15,0);
  xfMesh(s,new THREE.BoxGeometry(.17,2.16,1.055),ribbon,box,0,1.05,0);xfMesh(s,new THREE.BoxGeometry(1.35,2.16,.16),ribbon,box,0,1.05,0);
  xfMesh(s,new THREE.BoxGeometry(1.35,.16,1.055),ribbon,box,0,1.03,0);s.bows=[];for(const side of [-1,1]){const b=xfMesh(s,new THREE.TorusGeometry(.22,.065,6,18),ribbon,box,side*.16,2.31,0);b.rotation.set(0,Math.PI/2,side*.65);s.bows.push(b);}
  xfMesh(s,new THREE.BoxGeometry(.23,.18,.23),ribbon,box,0,2.29,0);s.wrap=box.children.filter(m=>!s.panels.some(p=>p.m===m)&&m!==s.lid);
 }
 const n=type==='prime'?48:96,pmat=new THREE.MeshBasicMaterial({transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,fog:false}),geo=new THREE.BoxGeometry(type==='prime'?.045:.07,type==='prime'?.1:.035,.008);s.mats.push(pmat);s.bits=new THREE.InstancedMesh(geo,pmat,n);s.bits.frustumCulled=false;s.bits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);s.paths=[];
 for(let i=0;i<n;i++){const a=i*2.399963,speed=1.5+(i%13)*.13;s.paths.push([Math.cos(a)*speed,2.4+(i%7)*.23,Math.sin(a)*speed,(i%5)*1.3]);s.bits.setColorAt(i,new THREE.Color(type==='prime'?(i%3?0xf8cf60:0x87dcff):[0xffc843,0xff4655,0x62d9ff,0x934bdb,0x80df44][i%5]));XF.dummy.position.set(0,-100,0);XF.dummy.updateMatrix();s.bits.setMatrixAt(i,XF.dummy.matrix);}
 root.add(s.bits);scene.add(root);XF.created++;return s;}
function xfWarm(){if(XF.ready)return;try{for(const type of ['prime','blastx'])for(let i=0;i<2;i++)XF.pool.push(xfCreate(type));XF.ready=true;try{if(typeof renderer!=='undefined'&&renderer.compile){const warm=new THREE.Scene();for(const s of XF.pool){warm.add(s.root);s.root.visible=true;}renderer.compile(warm,camera);for(const s of XF.pool){s.root.visible=false;scene.add(s.root);}}}catch(e){for(const s of XF.pool){s.root.visible=false;scene.add(s.root);}}for(const type of ['prime','blastx']){gaWarm(type+'/finisher');const img=new Image();img.src='audio/'+type+'-kill-banner.png';XF.textures[type]=img;}}catch(e){console.warn('Finisher preload',e);}}
function xfRestore(s){if(s.hidden){const {rig,mesh,visible}=s.hidden;if(rig.dead&&mesh.parent)mesh.visible=visible;s.hidden=null;}}
function xfRelease(s){xfRestore(s);s.active=false;s.root.visible=false;s.target=null;XF.cleared++;}
function xfClear(){gaStop('finisher');for(const s of XF.pool)if(s.active)xfRelease(s);XF.seen.clear();}
function xfHideCorpse(s){const M=s.target&&s.target.xm,mesh=M&&M.m;if(M&&M.dead&&mesh&&mesh.visible){s.hidden={rig:M,mesh,visible:mesh.visible};mesh.visible=false;}}
function xfPlay(w,id,point,target,token){if(!xfSupported(w,id)||![point&&point.x,point&&point.y,point&&point.z].every(v=>Number.isFinite(v)&&Math.abs(v)<10000))return false;
 if(token&&XF.seen.has(token))return false;if(token){XF.seen.add(token);while(XF.seen.size>128)XF.seen.delete(XF.seen.values().next().value);}if(!XF.ready)xfWarm();
 const type=id.split('.')[0],s=XF.pool.find(s=>s.type===type&&!s.active);if(!s)return false;s.active=true;s.box&&(s.box.visible=true);s.target=target;s.hidden=null;s.start=performance.now();s.age=0;s.root.position.copy(point);s.root.visible=true;
 s.root.rotation.y=Math.atan2(camera.position.x-point.x,camera.position.z-point.z);for(const m of s.mats)m.opacity=1;
 if(type==='blastx'){const variant=+(id.split('.')[1]||0),colors=[[0x56b334,0x763995],[0x30323c,0xff9a32],[0xf2c339,0x713fa1],[0xee63b7,0x57cad3]][variant]||[0x56b334,0x763995];s.paper.color.setHex(colors[0]);s.ribbon.color.setHex(colors[1]);s.lid.position.set(0,2.15,0);s.lid.rotation.set(0,0,0);}
 gaPlay(type+'/finisher','finisher',{position:point,gain:.75});XF.played++;xfPose(s,0);return true;}
function xfPose(s,t){const alpha=Math.min(1,t/.18)*Math.min(1,Math.max(0,(4.2-t)/.65));for(const m of s.mats)m.opacity=alpha;
 s.sigil.scale.setScalar(.55+Math.min(1,t)*.8);s.sigil.rotation.z=t*.6;
 if(t>.5&&!s.hidden)xfHideCorpse(s);
 if(s.type==='prime'){
  const drop=Math.max(0,Math.min(1,(t-.15)/.65));s.head.position.set(0,6.5-(6.5-1.8)*(1-Math.pow(1-drop,3)),0);s.head.scale.setScalar(.5+Math.min(1,t*3)*.9);s.head.rotation.set(-.12,Math.sin(t*2)*.06,0);
  s.jaw.rotation.x=-(t<.8?Math.sin(Math.min(1,t/.8)*Math.PI*.7)*.9:Math.max(0,.7-(t-.8)*7));
  if(t>1.1){s.head.position.y+=Math.pow(t-1.1,1.5)*.9;s.head.scale.multiplyScalar(Math.max(.01,1-(t-1.8)*.55));}
  for(let i=0;i<s.rays.length;i++){const ray=s.rays[i];ray.visible=t>.5&&t<1.35;ray.scale.y=.2+Math.sin(Math.min(1,(t-.5)/.85)*Math.PI)*3;}
 }else{
  const k=Math.min(1,t/.65),burst=Math.max(0,t-2.15);s.box.position.y=.08+Math.sin(t*4)*.06;s.box.rotation.set(Math.sin(t*28)*.025*(t>1?1:0),Math.sin(t*21)*.035,0);s.box.scale.setScalar(Math.min(1,.15+k*.95));
  for(const p of s.panels){const spread=1+(1-k)*6+burst*4;p.m.position.set(p.x*spread,p.y+burst*(p.x?1.4:-.4),p.z*spread);p.m.rotation.set(burst*p.x*4,burst*p.z*3,burst*p.x*2);}
  for(const m of s.wrap)m.visible=t<2.3;s.lid.position.set(0,2.15+burst*3.8,burst*.8);s.lid.rotation.set(burst*2.3,burst,.1*Math.sin(t*4));s.box.visible=t<3.6;
 }
 const age=Math.max(0,t-(s.type==='prime'?.85:2.15));s.bits.visible=age>0;const obj=XF.dummy;
 for(let i=0;i<s.paths.length;i++){const p=s.paths[i];obj.position.set(p[0]*age,Math.max(.05,1.2+p[1]*age-2.9*age*age),p[2]*age);obj.rotation.set(age*(p[3]+1),age*2,p[3]+age*3);obj.scale.setScalar(Math.max(.01,Math.min(1,age*8)*(1-Math.max(0,age-1.25)/1.3)));obj.updateMatrix();s.bits.setMatrixAt(i,obj.matrix);}s.bits.instanceMatrix.needsUpdate=true;}
function xfBanner(w,cid){const on=w!=='Knife'&&(cid==='prime'||cid==='blastx');if(!XF.banner)return;XF.banner.hidden=!on;XKI.em.classList.toggle('x-native-banner',on);if(on){const url='audio/'+cid+'-kill-banner.png';if(XF.banner.getAttribute('src')!==url)XF.banner.src=url;}}
try{if(typeof XKI!=='undefined'&&XKI.em){const img=document.createElement('img');img.alt='';img.hidden=true;img.className='x-native-kill-art';XKI.em.appendChild(img);XF.banner=img;const st=document.createElement('style');st.textContent='.x-kie.x-native-banner>svg,.x-kie.x-native-banner>b{visibility:hidden}.x-native-kill-art{position:absolute;inset:-8px;width:80px;height:80px;object-fit:contain;pointer-events:none}.x-native-kill-art[hidden]{display:none}@media(max-height:480px){.x-native-kill-art{inset:0;width:64px;height:64px}}';document.head.appendChild(st);const reset=xKiReset;xKiReset=function(){xfBanner('Knife','standard');return reset.apply(this,arguments);};}}catch(e){}
function xfTick(){const live=typeof running!=='undefined'&&running;if(!live||document.hidden){for(const s of XF.pool)if(s.active)xfRelease(s);return;}if(paused)return;
 for(const s of XF.pool)if(s.active){if(s.target&&s.target.alive){xfRelease(s);continue;}const t=(performance.now()-s.start)/1000;if(!Number.isFinite(t)||t>4.2){xfRelease(s);continue;}s.age=t;xfPose(s,t);}}
function xfLocalEnd(){try{return ['five','retake'].includes(mode)&&!FV.dm&&bots.length>0&&bots.every(b=>!b.alive)&&!bots.some(b=>b.runItBack);}catch(e){return false;}}
{const k=kill;kill=function(b,hs,by,w){const was=!!(b&&b.alive),id=w&&typeof xskGet==='function'?xskGet(w):'standard',p=b&&b.g&&b.g.position.clone(),r=k.apply(this,arguments);
 if(was&&b&&!b.alive&&(!by||by==='You')&&!(typeof NET!=='undefined'&&NET.socket)&&xfLocalEnd())xfPlay(w,id,p,b,'local:'+FV.rnd+':'+b.name);return r;};}
{const snap=mpCliSnap;mpCliSnap=function(m){const r=snap.apply(this,arguments);if(!m||!Array.isArray(m.ev)||!NET.socket||MP.st!=='game')return r;if(XF.socket!==NET.socket){xfClear();XF.socket=NET.socket;}for(const e of m.ev){if(!Array.isArray(e)||e[0]!=='fin'||!Number.isInteger(e[1])||!Number.isInteger(e[9])||!xfSupported(e[4],e[5])||![e[6],e[7],e[8]].every(Number.isFinite))continue;let target=null;for(const L of [bots,allies])for(const u of L)if(u.nid===e[3])target=u;xfPlay(e[4],e[5],new THREE.Vector3(e[6],e[7],e[8]),target,'net:'+e[9]+':'+e[1]);}return r;};}
{const round=fRound;fRound=function(){xfClear();return round.apply(this,arguments);};}
(window.XHK||(window.XHK=[])).push(xfTick);
if(window.requestIdleCallback)requestIdleCallback(xfWarm,{timeout:2000});else setTimeout(xfWarm,400);
window.xSkinFinishers={state:XF,play:xfPlay,clear:xfClear,warm:xfWarm};
// ---- END SKIN FINISHERS ----
