const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const T=require('./valorant_rigs').T,Impact=require('../vendor/hit-impact.js')(T);
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),runtime=fs.readFileSync(path.join(__dirname,'hit_feedback_runtime.js'),'utf8');
assert(html.includes(runtime.trim()),'index.html carries work/hit_feedback_runtime.js (rerun python3 work/install_valorant.py)');

// ---------- 1. the VFX pool itself ----------
const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,1,.1,50);camera.position.set(0,1,5);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
const bone=new T.Object3D();bone.position.set(0,1,0);scene.add(bone);scene.updateMatrixWorld(true);
const fx=new Impact(scene,3),point=new T.Vector3(0,1,.12),matrix=new T.Matrix4(),pos=new T.Vector3(),scl=new T.Vector3(),q=new T.Quaternion();
assert(fx.emit(point,bone));fx.tick(0,camera);fx.cores.getMatrixAt(0,matrix);pos.setFromMatrixPosition(matrix);assert(pos.distanceTo(point)<.03);
bone.position.set(1,.55,0);fx.tick(.01,camera);fx.cores.getMatrixAt(0,matrix);pos.setFromMatrixPosition(matrix);assert(Math.abs(pos.x-1)<.03);assert(Math.abs(pos.y-.55)<.03,'confirmed impact follows the moving/crouching body part');
assert(fx.cores.material.depthTest);assert(!fx.cores.material.depthWrite,'occlusion without blocking later transparency');
// predicted spark: world space, never attached, even when handed an anchor
fx.clear();bone.position.set(0,1,0);scene.updateMatrixWorld(true);
assert(fx.emit(point,bone,false,true));const sp=fx.items.find(e=>e.age<e.life);assert.equal(sp.kind,0);assert.equal(sp.anchor,null,'predicted spark is never attached');
bone.position.set(2,0,0);scene.updateMatrixWorld(true);fx.tick(.01,camera);fx.cores.getMatrixAt(fx.items.indexOf(sp),matrix);pos.setFromMatrixPosition(matrix);assert(pos.distanceTo(point)<.04,'predicted spark stays where the bullet landed');
// head variant is distinct and smaller than the body puff
fx.clear();bone.position.set(0,1,0);scene.updateMatrixWorld(true);
fx.emit(point,bone,false,false);fx.emit(point,bone,true,false);fx.tick(0,camera);
const ib=fx.items.findIndex(e=>e.age<e.life&&e.kind===1),ih=fx.items.findIndex(e=>e.age<e.life&&e.kind===2);assert(ib>=0&&ih>=0,'body and head variants');
const sizeOf=i=>{fx.cores.getMatrixAt(i,matrix);matrix.decompose(pos,q,scl);return scl.x;};
assert(sizeOf(ih)<sizeOf(ib),'headshot VFX is smaller than the body VFX so the head stays trackable');
const colOf=i=>{const c=new T.Color();fx.cores.getColorAt(i,c);return c;};assert(colOf(ih).g>colOf(ib).g+.3,'head core is a distinct pale variant, body core is blood red');
assert.equal(fx.items[ih].anchor,bone);
const children=scene.children.length,geometry=fx.shards.geometry,cap=[fx.cores.count,fx.shards.count];
for(let i=0;i<1000;i++){fx.emit(point,bone,i%2===0,i%3===0);fx.tick(.001,camera);}
assert.equal(fx.items.length,3);assert.equal(scene.children.length,children);assert.equal(fx.shards.geometry,geometry,'no per-hit geometry/material creation');assert.deepEqual([fx.cores.count,fx.shards.count],cap);
assert(!fx.emit(new T.Vector3(NaN,0,0),bone));fx.clear();assert(!fx.cores.visible);assert(fx.items.every(e=>e.anchor===null));
fx.emit(point,null,true);for(let i=0;i<4;i++)fx.tick(.1,camera);assert(!fx.shards.visible);fx.dispose();assert.equal(scene.children.length,1);

// ---------- 2. the gameplay adapter, with the real vmHit / hurt / combat-report code from index.html ----------
const slice=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,'index.html section '+a);return html.slice(i,j);};
const vmHitSrc=slice('function vmHit(p, dmg, hs, dead) {','// feel pass: per-round kill icons'),hurtSrc=slice('function armAbs(t, n) {','function xKLui() {');
assert(!/blip\(/.test(vmHitSrc),'vmHit no longer allocates oscillators per hit');
// fake DOM: counts every element ever created
let made=0;const mkEl=tag=>{made++;const cl=new Set();return {tagName:tag,children:[],style:{},textContent:'',className:'',parentNode:null,
 classList:{add:k=>cl.add(k),remove:(...k)=>k.forEach(x=>cl.delete(x)),toggle:(k,on)=>{if(on===undefined?!cl.has(k):on)cl.add(k);else cl.delete(k);},contains:k=>cl.has(k)},
 appendChild(c){this.children.push(c);c.parentNode=this;return c;},setAttribute(){},getAnimations:()=>[]};};
const document={createElement:mkEl,getElementById:()=>null,head:mkEl('head'),body:mkEl('body')};made=0;
// fake WebAudio: counts allocations
const A={buf:0,gain:0,src:0,started:[]};
const ac={sampleRate:8000,currentTime:0,state:'running',createBuffer(ch,n,sr){A.buf++;const d=new Float32Array(n);return {duration:n/sr,getChannelData:()=>d,_d:d};},
 createGain(){A.gain++;return {gain:{value:1,setValueAtTime(){}},connect(){},disconnect(){}};},
 createBufferSource(){A.src++;const s={buffer:null,connect(){},disconnect(){},start(){A.started.push(s);}};return s;}};
const hm=mkEl('div'),xo=mkEl('div');made=0;
const sc=new T.Group(),wr=new T.Group(),spine=new T.Object3D(),head=new T.Object3D(),pelvis=new T.Object3D();spine.name='Spine2';head.name='Head';pelvis.name='Pelvis';
spine.position.set(0,1.3,0);head.position.set(0,1.65,0);pelvis.position.set(0,.95,0);sc.add(spine,head,pelvis);wr.add(sc);
const g=new T.Group();g.add(wr);const s2=new T.Scene();s2.add(g);s2.updateMatrixWorld(true);
const bot={name:'Bot Jett',nid:2,hp:100,armor:50,alive:true,g,xm:{sx:{sc},mats:[]}},bot2={name:'Bot Omen',nid:3,hp:100,armor:0,alive:true,g:new T.Group(),xm:null};
const player={hp:100,armor:50,x:0,z:0};
const emitted=[],ui=[];
const c={window:{},THREE:T,BFX:{low:false},scene:s2,camera,XHV:new T.Vector3(),running:true,document,console,
 NET:{socket:null},MP:{st:'lobby',me:1,nc:false,name:'me'},bots:[bot,bot2],allies:[],player,mode:'five',
 S:{hm:false,dn:false,muted:false,vol:80},XDN:[],xo,$:id=>id==='xHm'?hm:null,
 xRestart(){ui.push('restart')},xCanvasRect:()=>({left:0,top:0,width:100,height:100}),sbDmg(){},
 bfxInit(){},bfxTick(){},xKiReset(){},mpCliSnap(){},vmKill(){},xKiAdd(){},mpIn:n=>n,flash(){},xDeathFlash(){},
 setTimeout(){},requestIdleCallback:null,performance:{now:()=>0}};
c.window.HitImpact=class{constructor(){this.items=new Array(24).fill(0);}emit(...a){emitted.push(a);return true;}tick(){}clear(){}};
vm.createContext(c);
vm.runInContext('let ac=null,master=null;',c); // real page: `let ac, master` globals
vm.runInContext('function audio(){if(!ac){ac=globalThis.__ac;master={connect(){}};}}',c);c.__ac=ac;
vm.runInContext(hurtSrc,c);vm.runInContext(vmHitSrc,c);
vm.runInContext('function xKLDie(by){xKL.on=true;} function xKLReset(){xKL.on=false;xKL.sp=false;}',c);
vm.runInContext(runtime,c);
const R=(src)=>vm.runInContext(src,c);
// default settings: no hit marker, no damage numbers (Valorant has neither)
assert.equal(R('S.hm||S.dn'),false);
c.vmHit(new T.Vector3(0,1.3,.1),40,false,false,bot);
assert.equal(made,0,'no damage-number DOM is created on a hit');assert.equal(xo.children.length,0);assert(!hm.classList.contains('on'),'no crosshair hit marker');
assert(/"x-dn"/.test(html)&&/dn: false/.test(html),'damage numbers stay an opt-in setting that defaults off');
// offline: sim result is the confirmation: predicted spark (unattached) + attached body puff
assert.equal(emitted.length,2);assert.equal(emitted[0][1],null);assert.equal(emitted[0][3],true,'spark is predicted');
assert.equal(emitted[1][1],spine,'offline confirmed body hit attaches to the chest bone');assert.equal(emitted[1][2],false);assert.equal(emitted[1][3],false);
emitted.length=0;c.vmHit(new T.Vector3(0,1.65,.1),160,true,false,bot,'head');assert.equal(emitted[1][1],head);assert.equal(emitted[1][2],true,'headshot uses the head variant');
emitted.length=0;c.vmHit(new T.Vector3(0,.5,.1),33,false,false,bot);assert.equal(emitted[1][1],pelvis,'leg hit (below hip) attaches to the pelvis');
// flinch: brief pitch-back of the visual wrapper, restored afterwards; hitboxes untouched
assert(wr.rotation.x<0,'struck model flinches');R('bfxTick(.05)');assert(wr.rotation.x<0);R('bfxTick(.2)');assert.equal(wr.rotation.x,0,'flinch recovers to the rest pose');
// audio: synthesized once, played from buffers
const warm=A.buf;assert(warm>=13,'tick/head/shield/kill buffers prerendered');
const plays0=R('XSF.plays');
// ---------- online ----------
c.NET.socket={};c.MP.st='game';emitted.length=0;ui.length=0;
c.vmHit(new T.Vector3(0,1.65,.1),160,true,true,bot);
assert.equal(emitted.length,1);assert.equal(emitted[0][1],null);assert.equal(emitted[0][3],true,'online: only the predicted spark on our own shot');
assert.equal(R('XSF.plays'),plays0,'online prediction plays no hit sound');
// confirmed by the server: attached to the struck part; head variant for e[3]=1
c.netHitFeedback(['h',1,2,1,0,150,0,1.65,.1,1]);assert.equal(emitted.length,2,'one confirmed burst, no duplicate spark');
assert.equal(emitted[1][1],head,'server-confirmed headshot attaches to the head bone');assert.equal(emitted[1][2],true);assert.equal(emitted[1][3],false);assert.equal(c.MP.nc,false);
assert(R('XSF.plays')>plays0,'confirmed hit plays sound');
const startedKeys=()=>A.started.map(s=>Object.entries(R('XSF.b')).find(([k,b])=>b===s.buffer)?.[0]);
assert.equal(startedKeys().at(-1),'head','headshot ding');
R('ac.currentTime+=1');c.netHitFeedback(['h',1,2,0,0,40,0,1.3,.1,0,1]);assert.equal(emitted[2][1],spine);assert.equal(startedKeys().at(-1),'brk','shield break sound when the hit emptied armor');
R('ac.currentTime+=1');c.netHitFeedback(['h',1,2,0,0,40,0,1.3,.1,0,0]);assert.equal(startedKeys().at(-1),'tick','body tick');
R('ac.currentTime+=1');R('xHitKillSfx(2,false)');assert.equal(startedKeys().at(-1),'k2','kill chime escalates per kill');
// another shooter's confirmed hit: VFX on the victim, but not our sound/UI
const p1=R('XSF.plays');c.netHitFeedback(['h',3,2,0,0,40,0,1.3,.1,0]);assert.equal(emitted.length,5);assert.equal(emitted[4][1],spine);assert.equal(R('XSF.plays'),p1,'other shooters do not play my hit sounds');
// malformed frames are ignored
for(const e of [['h',1,2,1,0,150,0,NaN,0,1],['h',1,2,1,0,150,0,99,0,1],['h',1,2,1,0,-1,0,1,0,1],['h'],null])c.netHitFeedback(e);assert.equal(emitted.length,5);

// ---------- combat report ----------
// online: logged from server 'h' events only (not the predicted local hurt), damage capped at what the victim had left
R('xKLReset();xKL.n=0;');bot.hp=100;bot.armor=50;player.hp=100;player.armor=50;
c.mpCliSnap({ev:[['h',1,2,0,0,40,0,1.3,.1,0],['h',1,2,0,0,33,0,.5,.1,2],['h',1,2,1,0,156,0,1.65,.1,1],['h',2,1,1,0,100,0,1.6,0,1],['h',2,1,0,0,40,0,1.2,0,0]]});
let e=R('xKLe("Bot Jett")');assert.equal(e.dh,3);assert.equal(e.dhs,1);assert.equal(e.db,1);assert.equal(e.dl,1);assert.equal(e.dd,150,'dealt damage is capped at health+shield left (150)');
assert.equal(e.th,2);assert.equal(e.ths,1);assert.equal(e.tb,1);assert.equal(e.td,140,'taken damage from server events');
// predicted local damage while online never reaches the report
R('xHS=true;hurt(bots[1],160)');assert.equal(R('xKL.n'),1,'online: local predicted hurt is not logged');
// render on death, kept during spectate
R('xKLDie("Bot Jett")');const C=R('XHF.cr');assert(C.el.classList.contains('on'),'combat report shown on death');const row=C.rows[0];
assert.equal(row.n.textContent,'Bot Jett');assert.equal(row.db.textContent,'150');assert.equal(row.ds.textContent,'1·1·1');assert.equal(row.tb.textContent,'140');assert.equal(row.ts.textContent,'1·1·0');assert.equal(row.tr.className,'k');
R('xKL.sp=true');assert(C.el.classList.contains('on'),'stays up while spectating');R('xKLReset()');assert(!C.el.classList.contains('on'));
// offline: raw shot damage (health + shield) per part, as Valorant counts it
c.NET.socket=null;R('xKL.n=0;xKL.sp=false');bot2.hp=100;bot2.armor=50;player.hp=100;player.armor=50;
for(let i=0;i<3;i++)R('xHS=false;xHLeg=false;hurt(bots[1],40)');R('xHS=false;xHLeg=true;hurt(bots[1],20)');R('xHS=true;xHLeg=false;hurt(bots[1],160)');
R('xHS=true;xHLeg=false;hurt(player,156,"Bot Omen")');
e=R('xKLe("Bot Omen")');assert.equal(e.db,3);assert.equal(e.dl,1);assert.equal(e.dhs,1);assert.equal(e.dh,5);
assert.equal(Math.round(e.dd),150,'3×40 body + 20 leg + lethal head capped at the 10 left = 150 (health 100 + shield 50)');assert.equal(e.ths,1);assert.equal(e.td,150);
assert.equal(R('bots[1].hp<=0'),true);

// spectate: a teammate's confirmed hit shows the attached VFX; its sound plays only for the teammate we spectate
{const ally={name:'Ally Sage',g:new T.Group(),alive:true};ally.g.position.set(0,0,10);bot.hp=100;bot.alive=true;emitted.length=0;
 R('ac.currentTime+=1');const p0=R('XSF.plays');R('xKL.sp=false;xKL.cur=null');assert(c.xHitOther(bot,false,ally));assert.equal(emitted.length,1);assert.equal(emitted[0][1],spine);assert.equal(emitted[0][3],false);assert.equal(R('XSF.plays'),p0,'not spectating: no sound');
 vm.runInContext('xKL.sp=true',c);c.__ally=ally;R('xKL.cur=__ally;ac.currentTime+=1');assert(c.xHitOther(bot,true,ally));assert.equal(emitted[1][1],head);assert.equal(emitted[1][2],true);assert.equal(R('XSF.plays'),p0+1,'spectated teammate hit plays the headshot ding');
 assert(emitted[0][0].z>0,'VFX nudged toward the shooter');assert(!c.xHitOther(player,false,ally),'never on the local player');R('xKL.sp=false;xKL.cur=null');}
// ---------- pooled: 200 hits allocate nothing new ----------
c.NET.socket={};c.MP.st='game';R('xKLDie("Bot Jett")');
const base={buf:A.buf,gain:A.gain,made,fl:R('XHF.fl.length'),rows:C.rows.length,items:R('XHIT.items.length')};
bot.hp=1e9;bot.armor=0;
for(let i=0;i<200;i++){R('ac.currentTime+=.01');c.mpCliSnap({ev:[['h',1,2,i%5===0?1:0,0,40,0,1.3,.1,i%7===0?2:0,i%50===0?1:0]]});c.vmHit(new T.Vector3(0,1.3,.1),40,false,false,bot);R('bfxTick(.016)');}
c.NET.socket=null;for(let i=0;i<200;i++){R('ac.currentTime+=.01');R('xHS=false;xHLeg=false;hurt(bots[0],40)');c.vmHit(new T.Vector3(0,1.3,.1),40,i%4===0,false,bot);R('bfxTick(.016)');}
assert.deepEqual({buf:A.buf,gain:A.gain,made,fl:R('XHF.fl.length'),rows:C.rows.length,items:R('XHIT.items.length')},base,'buffers, gain nodes, DOM nodes, flinch slots, report rows and VFX slots are fixed over 400 hits');
assert(R('XHF.fl.filter(f=>f.w).length')<=1,'one flinch slot per struck model');
// voice cap: many hits in the same audio instant start at most the cap
const s0=A.src;for(let i=0;i<50;i++)c.vmHit(new T.Vector3(0,1.3,.1),40,false,false,bot);assert(A.src-s0<=4,'body tick voices capped');
// server: hit event carries the shield-broken flag
const sim=fs.readFileSync(path.join(__dirname,'..','server','src','simulation.js'),'utf8');assert(/arm0>0&&target\.armor<=\.001\?1:0\]\)/.test(sim),'server h event reports shield break');
console.log('Hit feedback: no hit marker / damage-number DOM; predicted world-space spark vs server/sim-confirmed puff attached to chest/head/pelvis bone (follows crouch); smaller distinct head variant; tick/ding/shield/kill sounds from prerendered capped buffers; flinch restores; combat report (capped dealt/taken, head·body·legs) online from server events, offline from the sim, kept through spectate; 400 hits allocate no new buffers, nodes, DOM or slots');
