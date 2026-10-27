// Spike plant / defuse animation (work/spike_anim_runtime.js, as installed in index.html; server spike.js spikeAct / row [26]).
// User: "The bomb animations are really bad" - planting and defusing, first person (own view) and third person (others,
// spectating, online remote players). Checks, headless on the real rigs:
//  1. server: SpikeSimulation snapshot rows carry [26] = 1 planting carrier / 2 defuser / 0, every mode's rows are 27 long,
//     fogRow hides it;
//  2. third person (real Jett rig, packed clips, the shipped xUbAnim / xUbPost + the block's wrappers): an offline planter
//     kneels, the gun is holstered, the Spike is in its hands and then on the floor between them; an online remote defuser
//     (row [26] = 2, no FV defuser) kneels with the rig turned to the Spike and its hands toward it; an online enemy planter
//     (row [26] = 1, no visible carrier) kneels; a Retake ally defusing (its def clock running) kneels; everything is handed
//     back exactly after (gun visible, rig yaw = its rest value, kneel layer 0, prop hidden); a walking unit's bones are
//     bit-identical with and without the block (locomotion untouched);
//  3. first person (real Jett / Sage FP arms): while planting / defusing the gun, knife and native weapon rig are hidden,
//     the agent's FP arms are drawn (IK), the arm bones move over time, the palms are on the Spike device (plant) / low in
//     front toward the Spike (defuse), in view, the camera is lowered (vfCamDip), completion / cancel lowers the hands and
//     brings the gun back with its native equip; a finished plant leaves the world Spike where the hands put it; online the
//     client's hold starts it; spectating a defusing teammate shows their FP arms (Sage), hides their weapon rig and lowers
//     the spectate eye;
//  4. online parsing: row [26] -> unit.xsa (fogged row -> 0); P2P host rows (mpEnts) carry [26].
//   node work/test_spike_anim.cjs
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{pathToFileURL}=require('url');
console.warn=((w)=>(...a)=>{if(!/boneTransform/.test(String(a[0])))w(...a);})(console.warn);
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const A='// ---- SPIKE PLANT DEFUSE ANIM ----',B='// ---- END SPIKE PLANT DEFUSE ANIM ----',a0=html.indexOf(A),b0=html.indexOf(B);
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};
ok(a0>0&&b0>a0,'spike plant / defuse animation block installed in index.html');
const BLOCK=html.slice(a0,b0+B.length);
// the block shares the page's one script scope: none of its top-level names may be declared anywhere else in the page (a
// duplicate `XSA` - the agent tint table - was a SyntaxError that killed the whole page script)
{const names=[...BLOCK.matchAll(/^(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]),rest=html.slice(0,a0)+html.slice(b0);
 for(const nm of names)ok(!new RegExp('(?:^|[\\s;{(])(?:var|let|const|function)\\s+'+nm.replace('$','\\$')+'\\b').test(rest),'top-level name '+nm+' is declared only by the spike animation block');
 ok(names.length>15,'block names found ('+names.length+')');}
ok(/typeof xsaTpAct === "function" && xsaTpAct\(b\)/.test(html),'xUbAnim kneels units the block names (online rows / Retake allies)');
(async()=>{
 // ---- 1. server rows ------------------------------------------------------------------------------------------------
 {const {SpikeSimulation}=await import(pathToFileURL(path.join(root,'server/src/spike.js')).href),{Simulation}=await import(pathToFileURL(path.join(root,'server/src/simulation.js')).href),{fogRow}=await import(pathToFileURL(path.join(root,'server/src/fog.js')).href);
  const W={map:{attacker:[-10,0,0],defender:[10,0,0],sites:{A:[10,0,0]}},nav:{nodes:[[-10,0,0],[10,0,0]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x)=>x<0?0:1,ground:()=>0,blocked:()=>false,ray:()=>null};
  const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('A','Jett'),b=s.add('B','Sage');s.start(false);s.units=[a,b];b.team=1-a.team;
  const row=(u)=>s.rows().find(r=>r[0]===u.id);ok(row(a).length===27,'spike rows are 27 long ([26] Spike action), got '+row(a).length);
  s.spike.st='carry';s.spike.carrier=a.id;s.spike.pt=0;ok(row(a)[26]===0,'carrier not holding: 0');
  s.spike.pt=1.2;ok(row(a)[26]===1,'carrier planting: [26] = 1');ok(row(b)[26]===0,'others: 0');
  s.spike.st='plant';s.spike.carrier=null;s.spike.defuser=b.id;ok(row(b)[26]===2,'defuser: [26] = 2');ok(row(a)[26]===0,'not the defuser: 0');
  b.alive=false;ok(row(b)[26]===0,'a dead unit does nothing with the Spike');b.alive=true;
  const f=fogRow(row(b));ok(f[26]===0&&f.length===27,'fogRow hides the Spike action');
  const d=new Simulation(W,'dm','ascent',()=>.5);d.add('X','Jett');d.start(false);ok(d.rows()[0].length===27&&d.rows()[0][26]===0,'other modes: [26] = 0, same row length');}
 // ---- 2. third person ---------------------------------------------------------------------------------------------
 const {sim,T}=require('./tp_anim_sim.cjs');
 const SpikeMesh=()=>new T.Mesh(new T.CylinderGeometry(.25,.3,.8,12),new T.MeshLambertMaterial({color:0xff4655}));
 async function tp(withBlock){const S=await sim('jett'),c=S.c;Object.assign(c,{mode:'five',xFvOK:true,FV:{sp:{st:'',pt:0}},spike:SpikeMesh(),vmTick(){},performance:{now:()=>c.__now||0},__now:0});
  if(withBlock)vm.runInContext(BLOCK,c);
  const {M,X,b}=S;M.gun=new T.Group();M.gun.visible=true;X.sc.getObjectByName('R_Hand').add(M.gun);
  const frame=(dt,x=0,z=0,yaw=0)=>{c.__now+=dt*1000;const P=b.g.position,sp=S.last?Math.hypot(x-S.last.x,z-S.last.z)/dt:0;S.last={x,z};P.set(x,0,z);b.g.rotation.y=yaw;M.m.position.set(x,0,z);M.m.rotation.y=yaw;M.m.updateMatrixWorld(true);
   c.xUbAnim(b,M,sp,dt);X.poseDt=dt;c.xUbPre(M);X.mx.update(dt);c.xUbPost(M);M.m.updateMatrixWorld(true);};
  const run=(s,f)=>{for(let i=0;i<Math.round(s*60);i++){if(f)f(i);frame(1/60);}};
  return {...S,c,frame,run};}
 {const S=await tp(true),{c,b,M,X,run,at}=S;run(.5);
  const head0=at('Head').y;ok(head0>1.5&&M.gun.visible&&!(X.w.plant>0),'standing, gun out before the plant');
  // offline planter
  c.FV.sp={st:'carry',c:b,pt:0};run(1,()=>{c.FV.sp.pt+=1/60;});
  const L=at('L_Hand'),R=at('R_Hand'),mid=L.clone().add(R).multiplyScalar(.5),pel=at('Pelvis'),prop=X.xsa&&X.xsa.prop;
  ok(X.w.plant>.9,'planting: the kneel layer is on ('+(X.w.plant||0).toFixed(2)+')');ok(at('Head').y<1.15,'planting: kneeling, head at '+at('Head').y.toFixed(2)+' m');
  ok(M.gun.visible===false,'planting: the gun is holstered');ok(prop&&prop.visible,'planting: the Spike is drawn with the planter');
  ok(mid.z-pel.z>.25&&mid.y<.75,'planting: arms extended down and forward (hands '+mid.toArray().map(v=>v.toFixed(2))+')');
  const pw=prop.getWorldPosition(new T.Vector3()),dz=pw.z-mid.z,dx=Math.abs(pw.x-mid.x);ok(dx<.12&&dz>.1&&dz<.3,'planting: the Spike right in front of the hands, its near face at them (dx '+dx.toFixed(3)+', dz '+dz.toFixed(3)+' m)');
  ok(Math.abs(pw.y-.4)<.02,'after ~1 s the Spike rests on the floor (centre '+pw.y.toFixed(3)+')');
  // carried early in the plant: higher, in the hands
  {const S2=await tp(true);S2.run(.3);S2.c.FV.sp={st:'carry',c:S2.b,pt:0};S2.run(.12,()=>{S2.c.FV.sp.pt+=1/60;});const p2=S2.X.xsa.prop.getWorldPosition(new T.Vector3());ok(p2.y>.45,'early in the plant the Spike is still held up in the hands ('+p2.y.toFixed(2)+')');}
  // cancel -> exact hand-back
  c.FV.sp={st:'carry',c:b,pt:0};run(.7);
  ok(!(X.w.plant>0),'released: kneel layer back to 0');ok(M.gun.visible===true,'released: the gun is back');ok(!prop.visible,'released: the hand-held Spike is gone');ok(at('Head').y>1.5,'released: standing');
  // online remote defuser: row [26] = 2, FV has no defuser; Spike off to the unit's right-front
  c.FV.sp={st:'plant',x:1.0,z:.6,y:0,du:null};b.xsa=2;run(1);
  const wr=X.contactRoot,want=Math.atan2(1.0,.6);ok(X.w.plant>.9&&at('Head').y<1.15,'online defuser (row [26] = 2) kneels');ok(M.gun.visible===false,'online defuser: gun holstered');
  ok(Math.abs(wr.rotation.y-want)<.05,'defuser turns to face the Spike (rig yaw '+wr.rotation.y.toFixed(2)+' vs '+want.toFixed(2)+')');
  {const m2=at('L_Hand').add(at('R_Hand')).multiplyScalar(.5),p=at('Pelvis'),d=new T.Vector2(m2.x-p.x,m2.z-p.z).normalize(),s=new T.Vector2(1.0-p.x,.6-p.z).normalize();ok(d.dot(s)>.85,'defuser: arms forward toward the Spike (cos '+d.dot(s).toFixed(2)+')');}
  b.xsa=0;run(.7);ok(wr.rotation.y===0,'defuse over: rig yaw handed back exactly (0)');ok(M.gun.visible&&!(X.w.plant>0),'defuse over: gun back, kneel off');
  // online enemy planter: row [26] = 1 (the defenders' spike row shows no carrier)
  c.FV.sp={st:'carry',c:null,pt:0};b.xsa=1;run(.8);ok(X.w.plant>.9&&M.gun.visible===false&&X.xsa.prop.visible,'online enemy planter (row [26] = 1): kneels, gun holstered, Spike in hand');
  b.xsa=0;run(.7);ok(!(X.w.plant>0)&&M.gun.visible,'enemy planter released: handed back');
  // Retake ally defusing (offline: a.def climbs)
  c.mode='retake';c.spike.position.set(0,.4,1.2);b.def=0;run(.8,()=>{b.def+=1/60;});ok(X.w.plant>.9&&!M.gun.visible,'Retake ally defusing kneels with the gun away');run(.7);ok(!(X.w.plant>0)&&M.gun.visible,'Retake ally stopped: handed back');
  ok(!c.XSPK.err,'no runtime error in the TP layer: '+c.XSPK.err);}
 // locomotion untouched: the same scripted walk / run / crouch-walk, with and without the block, bit-identical bones
 {const Sa=await tp(false),Sb=await tp(true);const path=(S)=>{const out=[];for(let i=0;i<150;i++){const t=i/60;S.b.cr=i>100;S.frame(1/60,Math.sin(t)*2,t*(i<60?1.2:4),.2*Math.sin(t));if(i%10===9){const q=[];S.X.sc.traverse(o=>{if(o.isBone)q.push(...o.quaternion.toArray(),...o.position.toArray());});out.push(q);}}return out;};
  const qa=path(Sa),qb=path(Sb);let diff=0;for(let i=0;i<qa.length;i++)for(let j=0;j<qa[i].length;j++)diff=Math.max(diff,Math.abs(qa[i][j]-qb[i][j]));
  ok(diff===0,'locomotion (walk / run / crouch-walk) bones identical with the block installed (max diff '+diff+')');}
 // ---- 3. first person -----------------------------------------------------------------------------------------------
 const {parse}=require('./valorant_rigs.js'),base=path.dirname(require.resolve('three',{paths:[path.join(root,'server')]}));
 const SkeletonUtils=await import(pathToFileURL(path.join(base,'../examples/jsm/utils/SkeletonUtils.js')).href);
 function fp(){const scene=new T.Scene(),camera=new T.PerspectiveCamera(70,16/9,.1,500);scene.add(camera);
  const keys={},calls=[],player={x:0,y:0,z:0,hp:100,ch:0},fsM=SpikeMesh();scene.add(fsM);const dev=new T.Group();fsM.add(dev);
  const c={THREE:{...T,SkeletonUtils},console,Math,Promise,Map,Set,Number,String,Array,Object,JSON,performance:{now:()=>c.__now},__now:0,
   camera,scene,gun:new T.Group(),knife:new T.Group(),XV:{fp:{root:new T.Group(),kind:'idle'}},xvFPPlay:(F,k)=>{calls.push(k);F.kind=k;},
   xvLoad:(nm)=>parse(path.join(root,'models/valorant',nm+'.glb')),player,yaw:0,running:true,mode:'five',xFvOK:true,FV:{atk:true,sp:{st:'carry',c:player,pt:0}},
   spike:SpikeMesh(),fsM,keys,alive4:()=>player.hp>0&&!!keys.Digit4,inSite:()=>'A',MP:{cl:false},J:{pick:'Jett'},rw:'pri',ads:0,
   vmTick(){},vfCamDip:()=>0,xObsEye:()=>({x:0,y:1.6,z:0}),xUbAnim(){},xUbPost(){},xspvTarget:()=>null,xspvAgent:(a)=>a.agent,XSPV:{F:{root:new T.Group()}},allies:[],bots:[],
   mpCliSnap(){},mpEnts:()=>c.__ents.map(e=>e.slice()),__ents:[]};
  c.gun.visible=true;c.knife.visible=false;c.XV.fp.root.visible=true;c.window=c;vm.createContext(c);vm.runInContext(BLOCK,c);
  const tick=async(s,f)=>{for(let i=0;i<Math.round(s*60);i++){c.__now+=1000/60;if(f)f(i);camera.position.set(player.x,1.6-player.ch+c.vfCamDip(1/60),player.z);camera.updateMatrixWorld(true);c.vmTick(1/60);if(i%15===0)await new Promise(r=>setImmediate(r));}};
  return {c,camera,player,keys,calls,dev,tick};}
 const palm=(R,s)=>{const h=R.sc.getObjectByName(s+'_Hand').getWorldPosition(new T.Vector3()),m=R.sc.getObjectByName(s+'_Middle1').getWorldPosition(new T.Vector3());return h.lerp(m,.55);};
 const inView=(cam,p)=>{const q=cam.worldToLocal(p.clone());return q.z<-.1&&Math.abs(q.x/q.z)<1.2&&Math.abs(q.y/q.z)<.8;};
 {const F=fp(),{c,camera,player,keys,calls,dev,tick}=F;
  await tick(.2);ok(c.gun.visible&&!c.XSPK.fp.on,'FP: gun up before the plant');
  // plant: hold 4 in site (offline: the Spike state's pt climbs while held)
  keys.Digit4=1;await tick(.05,()=>{c.FV.sp.pt+=1/60;});for(let i=0;i<100&&!c.XSPK.rig.Jett?.sc;i++)await new Promise(r=>setTimeout(r,20));
  await tick(1.4,()=>{c.FV.sp.pt+=1/60;});
  const R=c.XSPK.rig.Jett;ok(R&&R.sc,'FP: the agent\'s own FP arms loaded');ok(R.root.visible&&R.root.parent===camera,'FP planting: arms drawn on the camera');
  ok(c.gun.visible===false&&c.knife.visible===false&&c.XV.fp.root.visible===false,'FP planting: gun, knife and native weapon rig holstered');
  ok(c.vfCamDip(0)<=-.5,'FP planting: view lowered to kneeling ('+c.vfCamDip(0).toFixed(2)+' m)');
  ok(R.prop.visible&&R.prop.parent===camera,'FP planting: the Spike device in front');
  const sp=R.prop.getWorldPosition(new T.Vector3()),top=sp.clone();top.y+=c.XSPK.FP_H/2;
  const samples=[];for(let k=0;k<4;k++){await tick(.13,()=>{c.FV.sp.pt+=1/60;});samples.push([palm(R,'L'),palm(R,'R'),R.sc.getObjectByName('R_Elbow').getWorldPosition(new T.Vector3())]);}
  for(const [l,r] of samples){ok(l.distanceTo(top)<.11&&r.distanceTo(top)<.11,'FP planting: both palms on the Spike top (L '+l.distanceTo(top).toFixed(3)+', R '+r.distanceTo(top).toFixed(3)+' m)');ok(inView(camera,l)&&inView(camera,r),'FP planting: hands in view');}
  {let mv=0;for(let k=1;k<samples.length;k++)mv=Math.max(mv,samples[k][1].distanceTo(samples[0][1]));ok(mv>.008,'FP planting: the typing hand moves over time ('+mv.toFixed(3)+' m)');}
  // early: spike carried up in both hands, higher than when set down
  // completion: the round's Spike state flips to planted
  c.FV.sp.st='plant';c.FV.sp.x=player.x;c.FV.sp.z=player.z;c.FV.sp.pt=0;c.fsM.position.set(0,.4,0);calls.length=0;
  await tick(.1);ok(c.XSPK.fp.on&&c.gun.visible===false,'FP plant done: hands withdraw first (gun still away)');
  await tick(.4);ok(!c.XSPK.fp.on&&!R.root.visible,'FP plant done: arms gone after the withdraw');ok(c.gun.visible===true&&calls.includes('equip'),'FP plant done: gun back with its native equip');
  ok(c.vfCamDip(0)===0,'FP plant done: view back up');
  ok(Math.abs(dev.position.z+c.XSPK.DROP)<1e-6&&Math.abs(dev.position.x)<1e-6,'planted Spike drawn where the hands put it ('+dev.position.z.toFixed(2)+' m in front)');
  ok(c.FV.sp.x===0&&c.FV.sp.z===0,'the Spike\'s game position is untouched');
  // defuse (defender, Spike ahead-right, looking down at it), then cancel
  c.FV.atk=false;c.FV.sp={st:'plant',x:.5,z:-1.0,y:0,du:null};c.fsM.position.set(.5,.4,-1.0);keys.Digit4=0;await tick(.1);
  camera.rotation.set(-.5,0,0,'YXZ');c.FV.sp.du=player;keys.Digit4=1;await tick(1);
  ok(c.XSPK.fp.on&&c.XSPK.fp.kind==='defuse'&&R.root.visible,'FP defusing: arms drawn');ok(c.gun.visible===false&&c.XV.fp.root.visible===false,'FP defusing: gun holstered');
  ok(!R.prop.visible,'FP defusing: no extra Spike in the hands (the planted one is in the world)');ok(c.vfCamDip(0)<=-.5,'FP defusing: view lowered');
  const P=c.XSPK.last.plan;ok(P.L[0]>-.05&&P.R[0]>0.05,'FP defusing: hands shifted toward the Spike on screen (right)');
  {const q0=R.sc.getObjectByName('R_Hand').getWorldQuaternion(new T.Quaternion()).clone(),l0=palm(R,'L');await tick(.15);const q1=R.sc.getObjectByName('R_Hand').getWorldQuaternion(new T.Quaternion()),l1=palm(R,'L');
   ok(q0.angleTo(q1)>.03||l0.distanceTo(l1)>.004,'FP defusing: hands work the Spike (twist / tap) over time');ok(inView(camera,palm(R,'L'))&&inView(camera,palm(R,'R')),'FP defusing: hands in view');
   const cl=camera.worldToLocal(palm(R,'R'));ok(cl.y<-.15&&cl.z<-.25,'FP defusing: hands low in front ('+cl.toArray().map(v=>v.toFixed(2))+')');}
  c.FV.sp.du=null;keys.Digit4=0;calls.length=0;await tick(.5);ok(!c.XSPK.fp.on&&!R.root.visible&&c.gun.visible&&calls.includes('equip'),'FP defuse cancelled: arms away, gun back with its equip');
  // online client: the hold in site starts the plant before any server pt
  c.MP={cl:true,st:'game',m5:true};c.FV.atk=true;c.FV.sp={st:'carry',c:player,pt:0};keys.Digit4=1;await tick(.4);ok(c.XSPK.fp.on&&c.XSPK.fp.kind==='plant','online client: holding 4 in site plants (hands up at once)');
  keys.Digit4=0;await tick(.5);ok(!c.XSPK.fp.on&&c.gun.visible,'online client let go: gun back');
  // spectating a defusing teammate (online row [26] = 2)
  const mate={name:'Sage',agent:'Sage',alive:true,hp:100,xsa:2,nid:4,g:{position:new T.Vector3(0,0,0),rotation:{y:0}}};player.hp=0;c.xspvTarget=()=>mate;c.XSPV.F.root.visible=true;
  await tick(.05);for(let i=0;i<100&&!c.XSPK.rig.Sage?.sc;i++)await new Promise(r=>setTimeout(r,20));await tick(.6);
  const RS=c.XSPK.rig.Sage;ok(RS&&RS.root.visible&&c.XSPK.fp.spec,'spectate: the teammate\'s own FP arms (Sage) defusing');ok(c.XSPV.F.root.visible===false,'spectate: their weapon rig hidden');
  ok(c.xObsEye(mate).y<1.15,'spectate: the followed eye is lowered ('+c.xObsEye(mate).y.toFixed(2)+')');
  mate.xsa=0;await tick(.5);ok(!RS.root.visible&&c.xObsEye(mate).y===1.6,'spectate: handed back after the defuse');
  // 4. online parsing
  const u5={nid:5,alive:true},u6={nid:6,alive:true};c.bots.push(u5);c.allies.push(u6);c.MP.me=1;
  const row=(id,k,fog)=>{const e=new Array(27).fill(0);e[0]=id;e[22]=fog?1:0;e[26]=k;return e;};
  c.mpCliSnap({u:[row(5,2),row(6,1)]});ok(u5.xsa===2&&u6.xsa===1,'row [26] -> unit.xsa');c.mpCliSnap({u:[row(5,2,1),row(6,0)]});ok(u5.xsa===0&&u6.xsa===0,'fogged / idle rows -> 0');
  c.mode='five';player.hp=100;c.FV.sp={st:'carry',c:u6,pt:1};c.__ents=[[1,0,'You'],[6,0,'Ally'],[5,1,'Bot']];const E=c.mpEnts();ok(E[1].length===27&&E[1][26]===1&&E[1][21]===-1,'P2P host rows carry [26] for the planter');ok(E[0].length===3&&E[2].length===3,'P2P rows of idle units unchanged');
  ok(!c.XSPK.err,'no runtime error in the FP layer: '+c.XSPK.err);}
 console.log('spike plant / defuse animation: '+n+' checks passed');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
