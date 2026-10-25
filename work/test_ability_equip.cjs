// Valorant ability parity (work/ability_equip_runtime.js) on the real page (work/page_harness.cjs, real three.js scene):
// default binds C / Q / E / X (crouch Ctrl), a stored pre-C/Q/E/X bind map migrated to them, HUD slot labels following a
// rebind, a rebound physical key casting the ability, the equip -> fire -> unequip flow (no gun fire mid-cast, ALT FIRE,
// quick-casts) and the kit table (client KITS == work/validation/abilities-wiki.json == server kits.json).
//   node work/test_ability_equip.cjs     (in test_all)
const {boot,lsStore}=require('./page_harness.cjs');
const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||3);
const fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m+': got '+JSON.stringify(a)+' want '+JSON.stringify(b));};
(async()=>{
 // a session that saved the legacy layout (abilities on Z / X / C) without ever choosing it
 const legacy={fwd:"KeyW",back:"KeyS",left:"KeyA",right:"KeyD",walk:"ShiftLeft",crouch:"KeyC",jump:"Space",use:"KeyF",abC:"KeyZ",abQ:"KeyX",abE:"KeyC",abX:"KeyV",ping:"KeyQ"};
 const store=lsStore([["vs.keys",JSON.stringify(legacy)]]);
 const H=boot({real3:true,seed:SEED,ls:store}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const errs0=H.errors.length;
 eq(xe('XKB.filter(a=>/^ab|crouch/.test(a[0])).map(a=>a[2])'),["ControlLeft","KeyC","KeyQ","KeyE","KeyX"],'defaults crouch/C/Q/E/X');
 eq(xe('[XS.keys.abC,XS.keys.abQ,XS.keys.abE,XS.keys.abX,XS.keys.crouch,XS.keys.ping]'),["KeyC","KeyQ","KeyE","KeyX","ControlLeft","KeyZ"],'legacy Z/X/C map migrated');
 eq(JSON.parse(store.getItem('vs.keys')).abQ,"KeyQ",'migration saved');
 eq(xe('xAbMigrate({abC:"KeyC",abQ:"KeyV",abE:"KeyE",abX:"KeyX"})'),false,'a player-edited map is kept');
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);xe('FV.buy=0;true');await adv(300);
 if(!xe('running&&mode==="five"'))fail('match did not start');
 eq(xe('["jC","jQ","jE","jX"].map(i=>document.getElementById(i).querySelector("b").textContent)'),["C","Q","E","X"],'HUD labels');
 // rebind Ability Q to V through the Controls row (click the row, press V)
 xe('xKbWait="abQ";true');H.dispatch(H.win,H.mkEvent('keydown',{code:'KeyV',key:'v',isTrusted:true}));await adv(60);
 eq(xe('XS.keys.abQ'),"KeyV",'rebind');eq(xe('document.getElementById("jQ").querySelector("b").textContent'),"V",'HUD label follows rebind');
 xe('J.q=2;J.cd.q=0;true');const q0=xe('J.q');
 for(const t of ['keydown','keyup'])H.dispatch(H.doc,H.mkEvent(t,{code:'KeyV',key:'v',isTrusted:true}));await adv(300);
 if(VERBOSE)console.log(xe("[J.pick,jOn(),FV.buy,J.q,player.hp,running,paused]"));eq(xe("J.q"),q0-1,'rebound physical V casts Ability Q');
 xe('XS.keys=xKbDef();xKbSave();true');eq(xe('document.getElementById("jQ").querySelector("b").textContent'),"Q",'reset restores label');
 // ---- equip -> fire -> unequip (Phoenix), no gun fire mid-cast, ALT FIRE (Sage self-heal), quick-cast (Jett) ----
 const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);};const click=async(b=0,ms=60)=>{H.mouse(b,true);await adv(ms);H.mouse(b,false);};
 const pick=a=>xe(`J.pick=${JSON.stringify(a)};jRound(false);J.c=K().mx.c||1;J.q=K().mx.q||1;J.e=Math.max(1,K().mx.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};player.hp=100;J.eq=null;true`);
 pick("Phoenix");xe("ammo=Math.max(ammo,5);reloading=0;true");await adv(200);if(VERBOSE)console.log(xe("[running,paused,mode,jOn(),FV.buy,String(jTick).slice(0,80)]"),H.xErrCalls.slice(-3).map(String));
 await tap('KeyQ');eq(xe('J.eq&&[J.eq.k,J.eq.st]'),['q','draw'],'Q equips Hot Hands (no instant cast)');eq(xe('J.q'),1,'equip spends nothing');
 await adv(60);eq(xe('document.getElementById("jQ").classList.contains("x-eq")'),true,'HUD marks the equipped slot');
 const a0=xe('ammo');await click(0);eq(xe('ammo'),a0,'click during the draw does not fire the gun');
 await adv(1100);eq(xe('J.q'),0,'buffered FIRE throws once the ability is out (0.8 s equip + 0.2 s release)');eq(xe('ammo'),a0,'no gun fire through the cast');
 await adv(600);eq(xe('J.eq'),null,'gun back up after the recovery');
 await tap('KeyC');await adv(600);eq(xe('J.eq&&J.eq.st'),'draw','Blaze still coming out at 0.6 s (0.8 s wiki equip time)');await adv(400);eq(xe('J.eq&&J.eq.st'),'ready','Blaze ready in hand');
 await tap('Digit2');eq(xe('J.eq'),null,'weapon key unequips');eq(xe('J.c'),1,'unequip keeps the charge');
 await tap('KeyC');await adv(100);await tap('KeyE');eq(xe('J.eq&&J.eq.k'),'e','another ability key switches the equipped ability');
 await tap('KeyE');eq(xe('J.eq'),null,'same key again puts it away');
 await adv(400);xe('fcd=0;reloading=0;ammo=Math.max(ammo,5);true');const a1=xe('ammo');await click(0);await adv(100);if(!(xe('ammo')<a1))fail('gun fires again after unequip');
 pick('Sage');xe('player.hp=60;true');await tap('KeyE');await adv(600);await click(2);await adv(500);eq(xe('!!(J.hl&&J.hl.tg===player)'),true,'Sage ALT FIRE heals herself');eq(xe('J.e'),0,'heal spent');
 pick('Jett');await tap('KeyQ');eq(xe('J.eq'),null,'Jett Updraft is INSTANT (no equip)');eq(xe('J.q'),0,'Updraft cast on press');
 xe('J.cd.c=0;J.c=2;J.cbs=[];true');const ns=xe('J.smokes.length');await tap('KeyC');eq(xe('[J.c,J.cbs.length,!!J.eq]'),[1,1,false],'Cloudburst INSTANT: thrown on the press (no equip)');
 for(let i=0;i<50&&xe('J.cbs.length');i++)await adv(50);eq(xe('J.smokes.length'),ns+1,'the Cloudburst lands as a smoke');const st=xe('J.smokes[J.smokes.length-1].t');if(!(st<=2.5&&st>1.8))fail('Cloudburst lasts 2.5 s (wiki), timer '+st);
 // ---- per-ability wiki equip times (XAB_EQT) ----
 eq(xe('[XAB_EQT.Breach.q,XAB_EQT.Phoenix.q,XAB_EQT.Sage.e,XAB_EQT.Reyna.c,XAB_EQT.Killjoy.c,xEqT("zz")]'),[1.1,0.8,0.5,0.77,0.74,0.5],'equip times from the wiki ability pages');
 // ---- per-ability windups (wiki): client XAB_WIND == server windups.js WINDUP; FIRE -> effect = hand release + fuse ----
 {const src=require('fs').readFileSync(require('path').join(__dirname,'../server/src/windups.js'),'utf8'),sw=Function('return '+src.match(/WINDUP=(\{[^}]*\})/)[1])();
  eq(xe('JSON.parse(JSON.stringify(XAB_WIND))'),sw,'client XAB_WIND == server WINDUP');eq(xe('XABT.rel'),0.2,'hand release 0.2 s');
  pick('Breach');await tap('KeyE');await adv(1000);await click(0);await adv(260);
  const fq=xe('BC.fq.map(q=>[q.k,+q.t.toFixed(2)])');if(!(fq.length===1&&fq[0][0]==='fl'&&fq[0][1]>0.5&&fq[0][1]<=0.9))fail('Fault Line waits out its windup after the release: '+JSON.stringify(fq));
  await adv(1000);eq(xe('BC.fq.length'),0,'Fault Line fired after 1.1 s');
  xe('J.ult=K().u;J.eq=null;true');await tap('KeyX');await adv(1300);await click(0);await adv(260);eq(xe('BC.fq.map(q=>q.k)'),['rt'],'Rolling Thunder waits out its 1.2 s windup');await adv(1100);eq(xe('BC.fq.length'),0,'Rolling Thunder fired');
  pick('Phoenix');await tap('KeyE');await adv(1000);await click(0);await adv(260);const ow=xe('J.orbs.length?+J.orbs[J.orbs.length-1].w.toFixed(2):null');eq(ow,0.4,'Curveball pops 0.4 s after the release (0.6 s windup)');
  pick('Chamber');await tap('KeyX');await adv(100);if(!(xe('BC.cd')>2))fail('Tour De Force 2.3 s equip: BC.cd '+xe('BC.cd'));xe('BC.eq="";BC.td=0;BC.cd=0;true');
  pick('Raze');await tap('KeyX');await adv(100);if(!(xe('RS.ssd')>1))fail('Showstopper 1.4 s equip: RS.ssd '+xe('RS.ssd'));xe('RS.ss=0;RS.ssd=0;true');}
 // ---- Sova bow: HOLD FIRE charges, ALT FIRE adds bounces (0..2), release throws; shared vendor/sova-bolt.cjs path ----
 {pick('Sova');xe('J.q=2;J.cd.q=0;true');await tap('KeyQ');await adv(1000);eq(xe('J.eq&&J.eq.st'),'ready','Shock Bolt drawn');
  H.mouse(0,true);await adv(500);eq(xe('J.eq&&J.eq.st'),'hold','FIRE held: charging');const h=xe('J.eq.h');if(!(h>0.3&&h<0.7))fail('hold time '+h);eq(xe('J.q'),2,'nothing thrown while held');
  await click(2);await click(2);eq(xe('J.eq.bn'),2,'ALT FIRE twice: two bounces');eq(xe('document.getElementById("xBow").classList.contains("on")'),true,'bow HUD shown');
  eq(xe('[...document.querySelectorAll("#xBow u.on")].length'),2,'bow HUD: two bounce pips');const bw=xe('parseFloat(document.querySelector("#xBow b").style.width)');if(!(bw>30))fail('bow HUD charge bar '+bw);
  await click(2);eq(xe('J.eq.bn'),0,'a third ALT FIRE cycles back to no bounce');await click(2);
  const n0=xe('J.arrows.length');H.mouse(0,false);await adv(300);eq(xe('J.q'),1,'release throws the bolt');
  const ar=xe('(a=>a&&{tr:!!a.tr,nb:a.nb,kind:a.kind,dur:a.dur})(J.arrows[J.arrows.length-1])');if(!ar||!ar.tr||ar.nb!==1||ar.kind!=='shock')fail('bolt flies the traced path with 1 bounce '+JSON.stringify(ar));
  eq(xe('document.getElementById("xBow").classList.contains("on")'),false,'bow HUD hidden after the throw');await adv(1500);
  // tap vs full charge from the same eye / aim: the held bolt goes further
  const far=xe('(()=>{const o=[0,1.6,0],d=[0,0,-1],a=SovaBolt.path(o,d,0,0,null,()=>0),b=SovaBolt.path(o,d,1,0,null,()=>0);return [-a.end[2],-b.end[2]];})()');if(!(far[1]>far[0]))fail('full charge not further than a tap '+far);
  eq(xe('JSON.stringify([mpBolt({pw:5,b:7}),mpBolt({}),mpBolt({pw:0.25})])'),JSON.stringify([{pw:1,b:2},null,{pw:0.25,b:0}]),'cast message charge / bounces clamped');
  xe('J.eq=null;true');await adv(600);}
 // kit table: client KITS == wiki table == server kits.json (charges, costs, ult points)
 const fs=require('fs'),path=require('path'),wiki=JSON.parse(fs.readFileSync(path.join(__dirname,'validation/abilities-wiki.json'),'utf8')),srv=JSON.parse(fs.readFileSync(path.join(__dirname,'../server/src/kits.json'),'utf8'));
 const kits=xe('JSON.parse(JSON.stringify(KITS))');
 for(const a in wiki){if(a[0]==='_')continue;const k=kits[a],w=wiki[a];if(!k){fail('no kit '+a);continue;}eq(k.u,w.u,a+' ult points');
  for(const s of ['c','q','e']){const ws=w[s];if(!ws||(s==='e'&&!ws[1]))continue;eq(k.mx[s],ws[0],a+' '+s+' charges');const b=k.buy.find(r=>r[0]===s);eq(b&&b[2],ws[1],a+' '+s+' cost');}
  eq(JSON.stringify({u:srv[a].u,mx:srv[a].mx,buy:srv[a].buy}),JSON.stringify({u:k.u,mx:k.mx,buy:k.buy}),a+' server kits.json agrees');}
 // ---- first-person viewmodel: equipping lowers the gun / arms / native rig and shows the hand + item; the cast restores them ----
 pick('Phoenix');xe('ammo=Math.max(ammo,5);reloading=0;true');await tap('Digit2');await adv(900);
 const VM=`(()=>{const F=typeof XV!=="undefined"&&XV.fp,h=XCA.h,it=XEQV.item,w=new THREE.Vector3(),c=new THREE.Vector3();gun.updateWorldMatrix(true,false);gun.getWorldPosition(w);camera.updateWorldMatrix(true,false);camera.getWorldPosition(c);
  const cv=o=>{let v=!!o;for(let x=o;x&&v;x=x.parent)v=x.visible;return v;};
  return {gy:+(w.y-c.y).toFixed(3),gl:+gun.position.y.toFixed(3),gv:cv(gun),fp:F&&F.root?cv(F.root):null,arms:[VMA.R,VMA.L].filter(Boolean).some(cv),hand:cv(h),item:cv(it),on:XEQV.on,eq:J.eq&&J.eq.st};})()`;
 const v0=xe(VM);if(VERBOSE)console.log('vm idle',v0);
 if(v0.hand||v0.item)fail('ability hand visible before equip '+JSON.stringify(v0));
 await tap('KeyQ');await adv(1000);const v1=xe(VM);if(VERBOSE)console.log('vm equipped',v1);
 eq(v1.eq,'ready','Hot Hands in hand for the viewmodel check');
 if(!(v0.gl-v1.gl>0.35))fail(`gun not lowered out of view while equipped: local y ${v0.gl} -> ${v1.gl}`);
 if(v1.fp)fail('native first-person rig still visible while an ability is equipped');
 if(v1.arms&&v1.fp!==null)fail('primitive arms visible while equipped');
 if(!v1.hand||!v1.item)fail('ability hand / item not shown while equipped '+JSON.stringify(v1));
 await click(0);await adv(1300);const v2=xe(VM);if(VERBOSE)console.log('vm after cast',v2);
 eq(v2.eq,null,'cast finished');
 if(Math.abs(v2.gl-v0.gl)>0.06)fail(`gun not back after the cast: local y ${v0.gl} -> ${v2.gl}`);
 if(v2.hand||v2.item||v2.on)fail('ability hand / item left up after the cast '+JSON.stringify(v2));
 if(v0.fp!==null&&v2.fp!==v0.fp)fail(`native rig visibility not restored (${v0.fp} -> ${v2.fp})`);
 if(v2.gv!==v0.gv)fail('gun visibility not restored');
 // the weapon key of the gun in hand (the sidearm here, no primary bought) puts the ability away and brings the gun back
 await tap('KeyC');await adv(700);await tap('Digit2');await adv(900);const v3=xe(VM);if(Math.abs(v3.gl-v0.gl)>0.06||v3.hand)fail('weapon key did not bring the gun back '+JSON.stringify(v3));
 // ---- section 7 mechanics (run last: they add game time; each waits for a live round) ----
 const live=async()=>{for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}if(!xe('running&&player.hp>0'))fail('no live round for the section 7 checks');};
 // ---- Breach Fault Line: HOLD FIRE extends the strip (wiki 8 -> 56 m over 1 s, 8 m ahead, 8 m wide); client XFAULT == server FAULT ----
 await live();{const src=require('fs').readFileSync(require('path').join(__dirname,'../server/src/abilities.js'),'utf8'),sf=Function('return '+src.match(/const FAULT=(\{[^}]*\})/)[1])();
  eq(xe('JSON.parse(JSON.stringify(XFAULT))'),sf,'client XFAULT == server FAULT');eq(xe('[xFaultLen(0),xFaultLen(0.5),xFaultLen(1),xFaultLen(9),xFaultLen(undefined),xFaultLen("x")]'),[8,32,56,56,56,56],'Fault Line length from the charge');
  pick('Breach');xe('J.cd.e=0;J.e=1;BC.fq=[];player.hp=100;true');await tap('KeyE');await adv(1000);eq(xe('J.eq&&J.eq.st'),'ready','Fault Line drawn');
  H.mouse(0,true);await adv(500);eq(xe('J.eq&&J.eq.st'),'hold','FIRE held: Fault Line charging');eq(xe('BC.fq.length'),0,'nothing cast while held');
  eq(xe('document.getElementById("xBow").classList.contains("on")'),true,'charge bar shown');eq(xe('[...document.querySelectorAll("#xBow u")].every(u=>u.style.display==="none")'),true,'no bounce pips for Fault Line');
  await click(2);eq(xe('J.eq&&J.eq.st'),'hold','ALT FIRE does nothing to the hold');
  H.mouse(0,false);await adv(260);const fl=xe('BC.fq.map(q=>[q.k,q.L])');if(!(fl.length===1&&fl[0][0]==='fl'&&fl[0][1]>28&&fl[0][1]<40))fail('half-held Fault Line ~32 m long: '+JSON.stringify(fl));
  // the quake hits a bot inside the charged strip, not one past its end (bots moved there just before it, then put back)
  await adv(700);const q=xe('(()=>{const q=BC.fq[0],b=bots.filter(b=>b.alive);if(b.length<2)return null;window.__fb=b.slice(0,2).map(x=>[x,x.g.position.clone()]);b[0].blind=0;b[1].blind=0;b[0].g.position.set(q.x+q.fx*20,b[0].g.position.y,q.z+q.fz*20);const e=XFAULT.near+q.L+6;b[1].g.position.set(q.x+q.fx*e,b[1].g.position.y,q.z+q.fz*e);return 1;})()');
  await adv(400);eq(xe('BC.fq.length'),0,'Fault Line fired after its windup');if(q){const bl=xe('(()=>{const r=__fb.map(([b])=>b.blind>0);__fb.forEach(([b,p])=>b.g.position.copy(p));return r;})()');eq(bl,[true,false],'charged strip: 20 m dazed, 6 m past its end not');}
  // a tap is the shortest strip; the cast message carries the charge
  xe('J.cd.e=0;J.e=1;J.eq=null;player.hp=100;true');await adv(400);await tap('KeyE');await adv(1000);await click(0);await adv(400);const tl=xe('BC.fq.map(q=>q.L)');if(!(tl.length===1&&tl[0]>=8&&tl[0]<13))fail('tapped Fault Line (60 ms click) near the 8 m minimum: '+JSON.stringify(tl));await adv(1000);
  // online relay (mpCastFx / host mpCastIn): the cast message's charge sets the remote strip (missing = full)
  eq(xe('(()=>{const u=bots.find(b=>b.alive&&b.g);if(!u)return null;BC.fq=[];MPC.bolt=mpBolt({pw:0});try{mpFx(u,"Breach","e",new THREE.Vector3(u.g.position.x,1.6,u.g.position.z),new THREE.Vector3(0,0,-1),false,null,true);}finally{MPC.bolt=null;}mpFx(u,"Breach","e",new THREE.Vector3(u.g.position.x,1.6,u.g.position.z),new THREE.Vector3(0,0,-1),false,null,true);const r=BC.fq.map(q=>[q.k,q.L]);return r;})()'),[["mfl",8],["mfl",56]],'relayed Fault Line strip from the cast message charge');
  xe('J.cd.e=0;J.e=1;J.eq=null;player.hp=100;true');await adv(400);}
 // ---- Phoenix Hot Hands spreads: 0 -> 4.5 m over 0.75 s, 4 s total (wiki); client XHOT == server DEV.hotHands ----
 await live();{const src=require('fs').readFileSync(require('path').join(__dirname,'../server/src/devices.js'),'utf8'),hh=src.match(/hotHands:\{life:([\d.]+),radius:([\d.]+),grow:([\d.]+)/);
  eq(xe('[XHOT.life,XHOT.r,XHOT.grow]'),hh?[+hh[1],+hh[2],+hh[3]]:null,'client XHOT == server DEV.hotHands');
  pick('Phoenix');xe('player.hp=100;J.q=1;J.cd.q=0;J.eq=null;true');await adv(300);const z0=xe('J.zones.length');xe('XABT.casting=true;try{xEqKey0("KeyQ")}finally{XABT.casting=false}true');
  eq(xe('J.zones.length'),z0+1,'Hot Hands zone');eq(xe('(z=>[z.R,+z.t.toFixed(2),+z.m.scale.x.toFixed(2)])(J.zones[J.zones.length-1])'),[4.5,4,0.01],'zone starts at nothing');
  await adv(300);const r1=xe('(z=>z.m.scale.x*2.5)(J.zones[J.zones.length-1])');if(!(r1>1.2&&r1<2.6))fail('Hot Hands ~1.8 m at 0.3 s: '+r1);
  await adv(700);eq(xe('(z=>+(z.m.scale.x*2.5).toFixed(2))(J.zones[J.zones.length-1])'),4.5,'Hot Hands 4.5 m from 0.75 s');
  // relayed (online) Hot Hands spreads the same; Paint Shells stay 2.5 m
  eq(xe('(()=>{const u=bots.find(b=>b.alive&&b.g);if(!u)return null;const n=J.zones.length;mpFx(u,"Phoenix","q",new THREE.Vector3(u.g.position.x,1.6,u.g.position.z),new THREE.Vector3(0,0,-1),false,null,true);mpFx(u,"Raze","e",new THREE.Vector3(u.g.position.x,1.6,u.g.position.z),new THREE.Vector3(0,0,-1),false,null,true);return J.zones.slice(n).map(z=>[z.R||0,+z.m.scale.x.toFixed(2)]);})()'),[[4.5,0.01],[0,1]],'relayed Hot Hands spreads, Paint Shells do not');
  await adv(200);}
 // ---- Jett Cloudburst: thrown INSTANTLY, steered with the crosshair while C is held, falls after release (vendor/cloudburst.cjs) ----
 await live();{pick('Jett');xe('player.hp=100;J.cd.c=0;J.c=2;J.cbs=[];J.eq=null;true');await adv(200);
  const P0=xe('[player.x,player.z,yaw]');H.key('KeyC',true);await adv(250);eq(xe('J.cbs.length'),1,'held C: projectile out');const s0=xe('(c=>c.st.held)(J.cbs[0])');eq(s0,true,'held: steering');
  // turn 90 degrees to the left while holding: the missile follows the crosshair
  xe('yaw+=Math.PI/2;true');await adv(500);const q=xe('(c=>[c.st.p[0],c.st.p[2],c.st.v[0],c.st.v[2]])(J.cbs[0])');const fx=-Math.sin(P0[2]+Math.PI/2),fz=-Math.cos(P0[2]+Math.PI/2),vl=Math.hypot(q[2],q[3]);
  if(!(vl>0&&(q[2]*fx+q[3]*fz)/vl>0.95))fail('held Cloudburst follows the turned crosshair: v '+q.slice(2)+' want dir '+[fx,fz]);
  H.key('KeyC',false);await adv(100);eq(xe('J.cbs.length?J.cbs[0].st.held:"landed"'),false,'released: no more steering');
  H.key('KeyC',true);await adv(100);eq(xe('J.cbs.map(c=>c.st.held)'),[false,true],'pressing C again throws the second charge; the first is not steered again (wiki)');H.key('KeyC',false);
  for(let i=0;i<60&&xe('J.cbs.length');i++)await adv(50);eq(xe('J.cbs.length'),0,'landed (2 s cap)');
  // shared flight: a 2 s cap in the air while steered, smoke centre floor + 1.5 .. + 4
  eq(xe('(()=>{const st=Cloudburst.start([0,1.6,0],[0,0,-1]);let n=0,L=null;while(!L&&n++<500)L=Cloudburst.step(st,1/60,[0,0,-1],null,()=>0);return [Math.round(st.t*10)/10,Math.round(-L[2])];})()'),[2,28],'held straight: 2 s in the air, 28 m');
  eq(xe('[Cloudburst.centreY(0.2,0),Cloudburst.centreY(3,0),Cloudburst.centreY(9,0),Cloudburst.centreY(7,6.4)]'),[1.5,3,4,7.9],'smoke centre between floor + 1.5 and + 4');
  // online (trusted server): others' Cloudburst from the snapshot fx rows: projectile, then the smoke once, then gone
  const n0=xe('J.smokes.length');xe('netSyncEffects([{id:77,kind:"cb",o:-5,p:[1,2,3],s:0}]);true');eq(xe('[netCbs.has(77),!!netCbs.get(77).m,J.smokes.length]'),[true,true,n0],'fx cb row: projectile drawn');
  xe('netSyncEffects([{id:77,kind:"cb",o:-5,p:[4,2.5,6],s:1,tl:2}]);netSyncEffects([{id:77,kind:"cb",o:-5,p:[4,2.5,6],s:1,tl:1.9}]);true');eq(xe('[!!netCbs.get(77).m,J.smokes.length,+J.smokes[J.smokes.length-1].p.y.toFixed(2),+J.smokes[J.smokes.length-1].t.toFixed(2)]'),[false,n0+1,2.5,2],'fx cb row landed: one smoke at the server point');
  xe('netSyncEffects([{id:78,kind:"cb",o:MP.me,p:[1,2,3],s:0}]);true');eq(xe('[netCbs.has(77),netCbs.has(78)]'),[false,false],'gone row dropped; own Cloudburst (flown locally) skipped');
  eq(xe('netSyncEffects([{id:79,kind:"cb",o:-5,p:[NaN,2,3],s:0},{id:"x",kind:"cb",p:[1,2,3]}]),netCbs.size'),0,'junk cb rows ignored');
  xe('J.smokes.forEach(s=>s.t=0.01);true');await adv(200);}
 if(xe('XEQV.err||null'))fail('ability viewmodel error: '+xe('XEQV.err'));
 if(H.errors.length>errs0)fail('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.message||e)).join(' | '));
 if(fails.length){console.log(fails.join('\n'));process.exit(1);}console.log('ability equip: binds, migration, HUD labels, equip -> fire flow, first-person equip viewmodel, wiki equip times + windups, Sova bow charge + bounces, Fault Line hold-to-extend, Hot Hands spread, Cloudburst flight + steering, kit table ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
