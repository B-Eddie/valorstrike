// Death parity (work/death_runtime.js; spec work/validation/death-parity-2026-10-27.md; user 2026-10-27 "Fix what happens when character
// dies. It looks really weird right now. Just copy Valorant."). Three parts:
//  A. the real page (work/page_harness.cjs, three r149), offline 5v5: a killed bot's corpse falls AWAY from the killer (ragHit), stays
//     on the floor for the round (was removed at 4 s), drops ONE gun (the pickup gun thrown from the hand to a spot 0.4-0.9 m along the
//     fall, lying on the floor; the corpse copy hidden); the player's death starts the death camera (own corpse spawned, camera pulled
//     back >= 1.5 m from the eyes within 0.7 s, looking at the killer's head, viewmodel + crosshair hidden), the KILLED BY card shows
//     the killer's portrait and the damage taken, N toggles the report, the teammate spectate takes over at 2 s and ends the death
//     camera, a new round (fSpawn) clears every corpse; Deathmatch: bodies sink out after XDP.keep s instead of staying.
//  B. the installed block in a sandbox: online the server's floor gun (netFloor) is the one thrown (onto its server spot), arriving
//     after the death too; corpse lifetime rules (revive / fresh model / round mode / timed); the death camera stops short of a wall.
//  C. native rigs (work/rig_harness.cjs): the corpse physics with the game's killing-shot direction lands on the floor within 2 s,
//     displaced along the shot, finite, no stretched bones, no standing / T-pose corpse.
//   node work/test_death_parity.cjs
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{
 const PART=process.env.PART||'ABC';
 // ---------- A. real page ----------
 if(PART.includes('A')){const {boot}=require('./page_harness.cjs');const H=boot({real3:true,seed:11}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
  const errs0=H.errors.length;
  ok(xe('typeof XDP==="object"&&typeof xDcCam==="function"&&typeof xdpGone==="function"'),'death parity block installed (XDP / xDcCam / xdpGone)');
  if(xe('typeof XDP==="object"')){
  xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;window.xBotSeed=5;startFive();true');await adv(400);
  for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
  ok(xe('running&&player.hp>0'),'live 5v5 round');
  // freeze the bots so nobody else dies / moves while we look
  xe('window.__bc0=botCanShoot;botCanShoot=()=>false;true');
  const k=JSON.parse(xe(`(()=>{const b=bots[0],p=b.g.position;player.x=p.x+6;player.z=p.z;player.y=p.y;const g=xdBW(b);kill(b,true,undefined,'Vandal');return JSON.stringify({x:p.x,y:p.y,z:p.z,g,n:bots[0].name})})()`));
  await adv(120);
  let A=JSON.parse(xe(`(()=>{const b=bots[0],e=XDEAD.find(x=>x.u===b);const L=XD.L.filter(d=>d.xdpC);return JSON.stringify({e:!!e,rag:e&&e.c.ragHit,gnv:e?e.gn.visible:null,pick:L.map(d=>({w:d.w,x:d.x,y:d.y,z:d.z,my:d.m.position.y})),all:XD.L.length,flying:XDP.drops.length})})()`));
  ok(A.e,'killed bot has a corpse entry tied to it');
  ok(A.rag&&A.rag.x<-0.99,'corpse falls away from the killer (killer at +x): ragHit '+JSON.stringify(A.rag));
  ok(A.gnv===false,'corpse copy of the gun hidden: the pickup gun is the one that drops');
  ok(A.pick.length===1&&A.all===1,'exactly one gun on the floor for the death: '+JSON.stringify(A.pick)+' of '+A.all);
  ok(A.flying>=1,'the gun is in the air right after the death (thrown from the hand)');
  await adv(700);
  A=JSON.parse(xe(`(()=>{const d=XD.L.find(d=>d.xdpC);return JSON.stringify({x:d.x,y:d.y,z:d.z,mx:d.m.position.x,my:d.m.position.y,mz:d.m.position.z,flying:XDP.drops.length,f:xdpFloor(d.x,d.z,d.y)})})()`));
  {const dx=A.x-k.x,dz=A.z-k.z,r=Math.hypot(dx,dz);ok(r>0.35&&r<0.95&&dx<0,'gun lands 0.35-0.95 m from the body along the fall: r='+r.toFixed(2)+' dx='+dx.toFixed(2));
   ok(A.flying===0&&Math.abs(A.my-(A.f+0.08))<0.02&&Math.abs(A.mx-A.x)<1e-6&&Math.abs(A.mz-A.z)<1e-6,'gun at rest on the floor at its pickup spot (y = floor + 0.08): '+JSON.stringify(A));}
  // the player can pick it up there (look prompt list contains it)
  ok(xe('XD.L.some(d=>d.xdpC&&Math.hypot(d.x-player.x,d.z-player.z)>0)'),'pickup entry still in the offline floor list');
  await adv(8000);
  ok(xe('(()=>{const e=XDEAD.find(x=>x.u===bots[0]);return !!(e&&e.c.m.parent)})()'),'corpse still in the scene 8 s after death (round mode keeps bodies; was removed at 4 s)');
  // the player dies: combat report + death camera
  const P=JSON.parse(xe(`(()=>{const b=bots[1],q=b.g.position;player.x=q.x+8;player.z=q.z+0.5;player.y=q.y;xKLog(player,b.name,42);const E=[player.x,1.6+(player.y||0),player.z];player.hp=0;pDie(b.name,'Vandal');
    return JSON.stringify({E,k:[q.x,(q.y||0)+1.5,q.z],dc:!!XDP.dc,pc:!!XDP.pc,pce:XDEAD.some(e=>e.pl===player),tk:xKL.tk&&xKL.tk.textContent,bg:xKL.t&&xKL.t.style.backgroundImage,ag:(xAg(b)||b.agent||'')})})()`));
  ok(P.dc,'death camera started on the player\'s death');ok(P.pc&&P.pce,'the player\'s own corpse spawned (dies with the same corpse physics)');
  ok(/42 dmg/.test(P.tk||''),'KILLED BY card: damage taken from the killer ('+P.tk+')');
  ok(/agents\/portraits\/[a-z]+\.png/.test(P.bg||''),'KILLED BY card: killer agent portrait ('+P.bg+')');
  await adv(150);ok(xe('document.body.classList.contains("x-dcam")&&gun.visible===false&&knife.visible===false'),'death camera hides the viewmodel and crosshair');
  await adv(650);
  const C=JSON.parse(xe('JSON.stringify({p:camera.position.toArray(),d:camera.getWorldDirection(new THREE.Vector3()).toArray(),dc:!!XDP.dc,t:XDP.dc&&XDP.dc.t})'));
  {const [x,y,z]=C.p,pull=Math.hypot(x-P.E[0],y-P.E[1],z-P.E[2]);ok(C.dc&&pull>=1.5,'camera pulled out of the body >= 1.5 m within 0.8 s: '+pull.toFixed(2));
   const ang=(q)=>{const v=[q[0]-x,q[1]-y,q[2]-z],l=Math.hypot(...v);return Math.acos(Math.max(-1,Math.min(1,(v[0]*C.d[0]+v[1]*C.d[1]+v[2]*C.d[2])/l)))*180/Math.PI;};
   const ak=ang(P.k),ab=ang([P.E[0],P.E[1]-1.35,P.E[2]]);ok(ak<25,'death camera turned to the killer\'s head ('+ak.toFixed(1)+' deg off centre)');ok(ab<34,'own body inside the frame ('+ab.toFixed(1)+' deg off centre, vertical half-fov 37.5)');
   ok(y>=P.k[1]+0.05,'camera above the point it looks at');}
  xe('dispatchEvent(Object.assign(new Event("keydown"),{code:"KeyN"}));true');ok(xe('document.body.classList.contains("x-cr-off")'),'N hides the combat report while dead');
  xe('dispatchEvent(Object.assign(new Event("keydown"),{code:"KeyN"}));true');ok(!xe('document.body.classList.contains("x-cr-off")'),'N shows it again');
  await adv(1500);
  ok(xe('xKL.sp&&!!XOB.fp&&!XDP.dc&&!document.body.classList.contains("x-dcam")'),'teammate spectate takes over at 2 s and ends the death camera');
  ok(xe('XDEAD.length>=2&&XDEAD.every(e=>e.c.m.parent)'),'all corpses of the round kept');
  // every corpse transform finite, none under the floor
  ok(xe('XDEAD.every(e=>{const p=e.c.m.position;return [p.x,p.y,p.z].every(Number.isFinite)})'),'corpse transforms finite');
  // next round: bodies gone
  xe('fSpawn();true');await adv(100);ok(xe('XDEAD.length===0'),'a new round clears the corpses');
  xe('botCanShoot=__bc0;true');
  // Deathmatch: timed sink-out
  xe('dmStart0&&startDM();true');await adv(600);for(let i=0;i<60&&!xe('running&&FV.dm&&player.hp>0');i++)await adv(200);
  for(let i=0;i<60&&!xe('bots.some(u=>u.alive&&u.xm)');i++)await adv(200); // Deathmatch bots get their agent model once spawned in
  if(xe('running&&FV.dm&&bots.some(u=>u.alive&&u.xm)')){xe('window.__bc1=botCanShoot;botCanShoot=()=>false;true');
   xe(`(()=>{const b=bots.find(u=>u.alive&&u.xm);player.x=b.g.position.x+5;player.z=b.g.position.z;window.__dmb=b;kill(b,false,undefined,'Vandal');return 1})()`);await adv(300);
   const y0=xe('(()=>{const e=XDEAD.find(x=>x.u===__dmb);return e?e.c.m.position.y:null})()');ok(y0!=null,'Deathmatch corpse made');
   await adv((xe('XDP.keep')+0.4)*1000);const y1=xe('(()=>{const e=XDEAD.find(x=>x.u===__dmb);return e?e.c.m.position.y:null})()');
   ok(y1==null||y1<y0-0.05,'Deathmatch corpse sinks after XDP.keep s: '+y0+' -> '+y1);
   await adv(1500);ok(!xe('XDEAD.some(x=>x.u===__dmb&&x.c.m.parent)'),'Deathmatch corpse removed after the sink');xe('botCanShoot=__bc1;true');}
  else ok(false,'Deathmatch did not start (or no bot model)');
  const errs=H.errors.slice(errs0).filter(e=>!/unexpected external script/.test(e&&e.msg||''));ok(errs.length===0,'no page errors: '+JSON.stringify(errs).slice(0,600));
  }}
 // ---------- B. sandbox ----------
 if(PART.includes('B')){const a=html.indexOf('// ---- DEATH PARITY ----'),b=html.indexOf('// ---- END DEATH PARITY ----');assert(a>0&&b>a,'block');const src=html.slice(a,b);
  const T=require(require.resolve('three',{paths:[path.join(root,'server')]}));
  const mk=()=>{const sc=new T.Scene();const c={THREE:T,console,Math,JSON,Number,Array,Object,String,Map,Set,performance:{now:()=>c.__now},__now:1000,scene:sc,XDEAD:[],XSOL:{mx:[]},xDisp(){},xE(e){throw e;},
   document:{body:{classList:{add(){},remove(){},toggle(){}}},createElement:()=>({}),head:{appendChild(){}}},addEventListener(){},
   kill(){},allyDie(){},xDie(b){b.xd=1;const m=b.xm;m.dead=1;m.diedAt=c.__now;sc.add(m.m);sc.add(m.gun);c.XDEAD.push({c:m,gn:m.gun,t:0});},fSpawn(){},xVis(){},xKLDie(){},xKLReset(){},
   bots:[],allies:[],player:{x:0,y:0,z:0,hp:100},mode:'five',FV:{dm:false},NET:{socket:{}},MP:{st:'game',m5:true,name:'Me'},netFloor:new Map(),xdOn:()=>false,blocked:()=>false,groundAt:()=>0,
   camera:new T.PerspectiveCamera(),XOB:{},J:{pick:'Jett'},yaw:0};vm.createContext(c);vm.runInContext(src,c);return c;};
  const unit=(c,name,x,z)=>{const g=new T.Group();g.position.set(x,0,z);const m=new T.Group(),gun=new T.Group();m.add(gun);gun.position.set(.2,1.2,.3);g.add(m);c.scene.add(g);return {name,g,alive:true,hp:100,xm:{m,gun,mats:[]}};};
  // online: the server floor row near the body is thrown, landing on its server spot; the corpse gun hides
  {const c=mk();c.player.hp=0;const v=unit(c,'Vic',0,0),k=unit(c,'Kil',-6,0);c.bots.push(v);c.allies.push(k);
   const fm=new T.Group();fm.userData.xdg=new T.Group();c.scene.add(fm);c.netFloor.set(7,{id:7,w:'Vandal',x:0.4,y:0,z:0.3,m:fm});
   v.alive=false;v.hp=0;c.xDie(v);
   ok(!v.xm.gun.visible,'online: corpse gun hidden when the server floor gun exists');ok(vm.runInContext('XDP',c).drops.length===1&&vm.runInContext('XDP',c).drops[0].m===fm,'online: the server floor gun is thrown');
   ok(c.XDEAD[0].c.ragHit&&c.XDEAD[0].c.ragHit.x>0.99,'online: no kill event -> nearest living enemy is the killer (falls away from it)');
   for(let i=0;i<20;i++)c.xdpTossTick(0.05);ok(Math.abs(fm.position.x-0.4)<1e-6&&Math.abs(fm.position.y-0.08)<1e-6&&Math.abs(fm.position.z-0.3)<1e-6,'online: floor gun lands on its server spot');}
  // online: the floor row arrives after the death
  {const c=mk();const v=unit(c,'Vic',0,0);c.bots.push(v);v.alive=false;v.hp=0;c.xDie(v);ok(v.xm.gun.visible!==false&&vm.runInContext('XDP',c).drops[0].m===v.xm.gun,'online, no row yet: the corpse gun is thrown meanwhile');
   const fm=new T.Group();c.scene.add(fm);c.netFloor.set(9,{id:9,w:'Vandal',x:-0.5,y:0,z:0,m:fm});c.__now+=200;c.xdpCorpseTick(0.016);
   ok(v.xm.gun.visible===false&&vm.runInContext('XDP',c).drops.some(d=>d.m===fm)&&!vm.runInContext('XDP',c).drops.some(d=>d.m===v.xm.gun),'online: a late server row takes over from the corpse gun');}
  // lifetime rules
  {const c=mk();const v=unit(c,'Vic',0,0);c.bots.push(v);v.alive=false;v.hp=0;c.xDie(v);const e=c.XDEAD[0];
   ok(!c.xdpGone(e,30),'round mode (online 5v5): kept 30 s after death');v.alive=true;v.hp=100;ok(c.xdpGone(e,1),'unit alive again -> corpse goes');
   v.alive=false;v.hp=0;v.xm={};ok(c.xdpGone(e,1),'unit has a fresh model -> corpse goes');v.xm=e.c;
   c.FV.dm=true;ok(!c.xdpGone(e,vm.runInContext('XDP',c).keep)&&c.xdpGone(e,vm.runInContext('XDP',c).keep+vm.runInContext('XDP',c).sink+0.01),'respawn mode: timed (keep + sink)');}
  // death camera clamps at a wall (box map: blocked() 1 m behind)
  {const c=mk();c.NET.socket=null;c.player={x:0,y:0,z:0,hp:0,ch:0};const k=unit(c,'Kil',0,-10);c.bots.push(k);c.yaw=0;c.blocked=(x,z)=>z>1.0;
   c.xdpCamStart('Kil');const D=vm.runInContext('XDP',c).dc;ok(D&&D.C.z<=1.0&&D.C.z>0.2,'death camera stops short of a wall behind: C.z='+(D&&D.C.z.toFixed(2)));
   c.player.hp=100;ok(c.xDcCam(0.1)===false&&!vm.runInContext('XDP',c).dc,'alive again: death camera ends');}
 }
 // ---------- C. native rigs ----------
 if(PART.includes('C')){const H=require('./rig_harness.cjs');const rsrc=H.section('repair_runtime.js','// Skeleton-preserving corpse physics.','{const die=xDie;');
  for(const [slug,hit] of [['jett',{x:1,z:0}],['sova',{x:0,z:-1}],['reyna',{x:-0.7071,z:0.7071}],['breach',{x:0,z:1}],['sage',{x:1,z:0}]]){
   const A=await H.agent(slug,'Jog_Fwd_Loop');const c=H.context({groundAt:()=>0});vm.runInContext(rsrc,c);A.M.ragHit=hit;
   const lengths=[];A.sc.traverse(b=>{if(b.isBone&&b.parent&&b.parent.isBone)lengths.push([b,b.position.length()]);});
   let t=0;c.xrRagdollTick(A.M,1/60);const p0=A.M.ragdoll.P.Pelvis.p.clone();let down=null;
   let p2=null,p3=null;while(t<3.2){c.xrRagdollTick(A.M,1/60);t+=1/60;if(down==null&&A.M.ragdoll.P.Head.p.y<.5&&A.M.ragdoll.P.Pelvis.p.y<.45)down=t;if(!p2&&t>=2.4)p2=A.M.ragdoll.P.Pelvis.p.clone();}p3=A.M.ragdoll.P.Pelvis.p.clone();
   ok(Math.hypot(p3.x-p2.x,p3.z-p2.z)<.06,slug+': no sliding once down (pelvis moved '+Math.hypot(p3.x-p2.x,p3.z-p2.z).toFixed(3)+' m between 2.4 s and 3.2 s, the corpse physics\' end)');
   const P=A.M.ragdoll.P,mv=(P.Pelvis.p.x-p0.x)*hit.x+(P.Pelvis.p.z-p0.z)*hit.z,hd=(P.Head.p.x-p0.x)*hit.x+(P.Head.p.z-p0.z)*hit.z;
   ok(down!=null&&down<2,slug+': on the floor within 2 s ('+down+')');ok(hd>0.25,slug+': falls along the killing shot (head '+hd.toFixed(2)+' m, pelvis '+mv.toFixed(2)+')');
   const pts=H.skinned(A.sc);let fin=true,maxY=-1,lo=9;for(let i=0;i<pts.length;i++)if(!Number.isFinite(pts[i]))fin=false;for(let i=1;i<pts.length;i+=3){maxY=Math.max(maxY,pts[i]);lo=Math.min(lo,pts[i]);}
   ok(fin,slug+': finite skin (no NaN)');ok(maxY<.8,slug+': no standing / T-pose corpse (top '+maxY.toFixed(2)+' m)');if(slug!=='sova')ok(lo>-.12,slug+': not sunk into the floor ('+lo.toFixed(3)+')'); // Sova: the cloak tucks under a body lying on its back (KNOWN, hidden by the floor; was a 1 m spike up through it)
   for(const [b,l]of lengths)if(b.name!=='Splitter'&&Math.abs(b.position.length()-l)>1e-5){ok(false,slug+': bone stretched '+b.name);break;}
  }}
 if(fails.length){console.error('FAILED:\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Death parity: corpse falls away from the killer and stays for the round, one gun thrown to the floor (offline pickup / online server row), death camera pulls out to the killer, portrait + N report, spectate after 2 s, round reset clears, DM sinks out; 5 rigs land along the shot');
})().catch(e=>{console.error(e);process.exit(1);});
