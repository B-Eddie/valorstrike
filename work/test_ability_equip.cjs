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
 // ---- first-person viewmodel: equipping swaps the gun / knife / native weapon rig for the agent's native ability arms (ABILITY FIRST PERSON); the cast restores them ----
 pick('Phoenix');xe('ammo=Math.max(ammo,5);reloading=0;true');await tap('Digit2');await adv(900);
 const VM=`(()=>{const F=typeof XV!=="undefined"&&XV.fp,R=XAF.cur;
  const cv=o=>{let v=!!o;for(let x=o;x&&v;x=x.parent)v=x.visible;return v;};
  return {gv:cv(gun)||cv(knife),fp:F&&F.root?cv(F.root):null,arms:[VMA.R,VMA.L].filter(Boolean).some(cv),rig:R?cv(R.root):false,on:XAF.on,mode:XAF.mode,legacy:typeof xCaHand!=="undefined"||typeof XEQV!=="undefined"||"h" in XCA,eq:J.eq&&J.eq.st};})()`;
 const v0=xe(VM);if(VERBOSE)console.log('vm idle',v0);
 if(v0.on||v0.rig)fail('ability viewmodel up before equip '+JSON.stringify(v0));
 if(v0.legacy)fail('legacy primitive ability hand (xCaHand / XEQV / XCA.h) still present');
 await tap('KeyQ');await adv(1000);const v1=xe(VM);if(VERBOSE)console.log('vm equipped',v1);
 eq(v1.eq,'ready','Hot Hands in hand for the viewmodel check');
 if(v1.gv)fail('gun / knife still drawn while an ability is equipped');
 if(v1.fp)fail('native weapon rig still visible while an ability is equipped');
 if(v1.arms)fail('primitive arms visible while equipped');
 if(!v1.on||v1.mode!=='idle')fail('ability viewmodel not in its idle (ready) phase while equipped '+JSON.stringify(v1));
 await click(0);await adv(1300);const v2=xe(VM);if(VERBOSE)console.log('vm after cast',v2);
 eq(v2.eq,null,'cast finished');
 if(v2.on||v2.rig)fail('ability viewmodel left up after the cast '+JSON.stringify(v2));
 if(v2.gv!==v0.gv)fail('gun visibility not restored');
 if(v0.fp!==null&&v2.fp!==v0.fp)fail(`native rig visibility not restored (${v0.fp} -> ${v2.fp})`);
 // the weapon key of the gun in hand (the sidearm here, no primary bought) puts the ability away and brings the gun back
 await tap('KeyC');await adv(700);await tap('Digit2');await adv(900);const v3=xe(VM);if(v3.gv!==v0.gv||v3.on)fail('weapon key did not bring the gun back '+JSON.stringify(v3));
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
 // ---- smoke radius per ability (wiki: Cloudburst 3.35 m, Dark Cover 4.1 m, Cyber Cage 3.72 m); client XSMR == server SMOKE.r ----
 {const src=require('fs').readFileSync(require('path').join(__dirname,'../server/src/abilities.js'),'utf8'),sr=Function('return '+src.match(/SMOKE=\{radius:4,lift:[\d.]+,r:(\{[^}]*\})\}/)[1])();
  eq(xe('XSMR'),sr,'client XSMR == server SMOKE.r');eq(sr,{Jett:3.35,Omen:4.1,Cypher:3.72},'wiki smoke radii');
  // relayed casts (online / bots) carry the caster's radius on the mesh and in sight checks
  eq(xe('(()=>{const u=bots.find(b=>b.alive&&b.g);if(!u)return null;const n=J.smokes.length,o=new THREE.Vector3(u.g.position.x,1.6,u.g.position.z),d=new THREE.Vector3(0,0,-1);mpFx(u,"Jett","c",o,d,false,null,true);mpFx(u,"Omen","e",o,d,false,null,true);mpFx(u,"Cypher","q",o,d,false,null,true);const r=J.smokes.slice(n).map(s=>[s.r,+s.m.scale.x.toFixed(4)]);J.smokes.slice(n).forEach(s=>{s.t=0;});return r;})()'),[[3.35,0.8375],[4.1,1.025],[3.72,0.93]],'relayed Cloudburst / Dark Cover / Cyber Cage radii');
  eq(xe('(()=>{const keep=J.smokes;try{const out=[];for(const r of [3.35,4.1]){J.smokes=[{p:new THREE.Vector3(0,1.8,-10),r,t:5}];out.push(jBlock(new THREE.Vector3(-20,1.8,-10+3.6),new THREE.Vector3(1,0,0),40));}J.smokes=[{p:new THREE.Vector3(0,1.8,-10),t:5}];out.push(jBlock(new THREE.Vector3(-20,1.8,-10+3.6),new THREE.Vector3(1,0,0),40));return out;}finally{J.smokes=keep;}})()'),[false,true,true],'sight blocked within the smoke radius only (3.6 m pass: Cloudburst no, Dark Cover yes, no r = 4 m)');}
 // ---- Cyber Cage: hollow open-ended cylinder (wiki r 3.72 m, centred on the cage), drawn and sight-checked as one (server cageBlocks) ----
 {const dsrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/devices.js'),'utf8');eq(xe('CYCAGE.h'),+dsrc.match(/cage:\{life:7\.25,h:([\d.]+)\}/)[1],'client CYCAGE.h == server DEV.cage.h');
  eq(xe('[cageGeo.type,cageGeo.parameters.openEnded,cageGeo.parameters.radiusTop,cageGeo.parameters.height]'),['CylinderGeometry',true,4,2*xe('CYCAGE.h')],'cage mesh: open-ended cylinder');
  await live();pick('Cypher');await adv(200);const n0=xe('J.smokes.length');await tap('KeyQ');await adv(600);await click(0);await adv(900);
  const cg=xe(`(()=>{const s=J.smokes[${n0}];return s&&[s.cyl,s.r,s.m.geometry.type,+s.m.scale.x.toFixed(3),+s.m.scale.y.toFixed(3),+s.m.scale.z.toFixed(3),+(s.m.position.y-groundAt(s.p.x,s.p.z,0.2,(player.y||0)+1)).toFixed(2)];})()`);
  eq(cg,[5,3.72,'CylinderGeometry',0.93,1,0.93,0],'player Cyber Cage: cylinder r 3.72 m, full height after the bloom, centred on the floor');
  // a sphere smoke keeps its per-ability radius through the bloom (the tick used to reset the scale to the 4 m mesh)
  eq(xe('(()=>{const n=J.smokes.length;enSmoke(player.x+30,player.z,false,5,undefined,XSMR.Omen);return n;})()')!==null,true,'enSmoke');await adv(600);
  eq(xe('+J.smokes[J.smokes.length-1].m.scale.x.toFixed(4)'),1.025,'Dark Cover mesh stays 4.1 m after the bloom');
  eq(xe('(()=>{const u=bots.find(b=>b.g);const n=J.smokes.length;mpFx(u,"Cypher","q",new THREE.Vector3(u.g.position.x,1.6,u.g.position.z),new THREE.Vector3(0,0,-1),false,null,true);const s=J.smokes[n];return [s.cyl,s.m.geometry.type];})()'),[5,'CylinderGeometry'],'relayed Cyber Cage is the cylinder too');
  const V='new THREE.Vector3';
  eq(xe(`(()=>{const keep=J.smokes;try{J.smokes=[{p:${V}(0,0,-10),r:3.72,cyl:5,t:5}];const B=(o,d,m)=>jBlock(${V}(...o),${V}(...d).normalize(),m);
   return [B([-20,1.6,-10],[1,0,0],40),B([-20,1.6,-10+3.6],[1,0,0],40),B([-20,1.6,-10+3.8],[1,0,0],40),B([0,1.6,-10],[1,0,0],2),B([0,1.6,-10],[1,0,0],10),B([-20,6,-10],[1,0,0],40),B([0,9,-10],[0,-1,0],9),B([-20,1.6,-10],[1,0,0],15)];}finally{J.smokes=keep;}})()`),
   [true,true,false,false,true,false,false,false],'cage sight: through / 3.6 m inside the wall / 3.8 m past it / inside-to-inside clear / inside-out blocked / over the 5 m top / down the open top / ends short of the wall');}
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
 // ---- Cypher Neural Theft offline (wiki: 18 m reach, reveals at 2 s and 6 s after the cast; same as server ULT.theft) ----
 await live();{pick('Cypher');await adv(200);eq(xe('[CYNT.reach,CYNT.at,CYNT.reveal]'),[18,[2,6],1.6],'client CYNT table');
  const far=xe('(()=>{const al=bots.filter(b=>b.alive&&b.g),dd=bots.filter(b=>!b.alive&&b.g);if(!dd.length&&al.length>1)dd.push(al.shift()),dd[0].alive=false;if(!dd.length||!al.length)return null;dd.forEach((b,i)=>{b.g.position.x=player.x+(i?100:19);b.g.position.z=player.z;});al.forEach(b=>{b.g.position.x=player.x;b.g.position.z=player.z-60;b.det=1e9;});player.hp=100;return true;})()');/* live bots held (det: no shooting) so a bot that saw the player (e.g. an enemy Recon Bolt pulse) cannot end the round mid-check */
  if(!far)fail('Neural Theft: no bot to fall');else{
   const tx=async()=>{await tap('KeyX');await adv(600);await click(0);for(let i=0;i<10&&xe('J.ult')>0;i++)await adv(20);};// X equips (0.5 s draw), FIRE casts
   xe('J.ult=K().u;jUnreveal();true');await tx();eq(xe('J.ult'),xe('K().u'),'corpse at 19 m: not cast, ult kept');if(xe('!!J.eq'))await tap('KeyX');await adv(500);
   xe('(()=>{const c=bots.find(b=>!b.alive&&b.g&&Math.abs(b.g.position.x-player.x-19)<0.01);c.g.position.x=player.x+17;})();jUnreveal();true');await tx();eq(xe('J.ult'),0,'corpse at 17 m: cast');
   // page clock (performance.now, which drives the page timers and frames) from the cast
   const t0=xe('performance.now()'),at=async ms=>{while(xe('performance.now()')-t0<ms)await adv(20);};
   eq(xe('J.rvT>0'),false,'no reveal at the cast');await at(1900);eq(xe('J.rvT>0'),false,'no reveal before 2 s');
   await at(2100);eq(xe('J.rvT>0&&J.rv.length>0'),true,'first reveal at 2 s');await at(3800);eq(xe('J.rvT>0'),false,'first reveal over (1.6 s)');
   await at(5900);eq(xe('J.rvT>0'),false,'no reveal before 6 s');await at(6100);eq(xe('J.rvT>0&&J.rv.length>0'),true,'second reveal at 6 s');
   // a cast whose pulses are still pending when the round clears never reveals in the next round
   xe('J.ult=K().u;jUnreveal();true');await tx();eq(xe('J.ult'),0,'second cast');xe('bcClear();jUnreveal();true');{const t1=xe('performance.now()');while(xe('performance.now()')-t1<6300)await adv(50);}eq(xe('J.rvT>0'),false,'round clear cancels pending reveals (none through 6.3 s)');xe('bots.forEach(b=>{if(b.det>1e8)b.det=0;});true');}}
 {const asrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/abilities.js'),'utf8'),lm=asrc.match(/LEER=\{active:([\d.]+)\}/);eq(xe('XLEER'),lm?+lm[1]:null,'client XLEER == server LEER.active (wiki Leer 1.6 s)');}
 // ---- Sova Recon Bolt pulses (wiki Recon_Bolt: 30 m, 2 pulses 1.6 s apart, 0.75 s reveal, the bolt's line of sight); client XRCN == server DEV.reconBolt ----
 await live();{const dsrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/devices.js'),'utf8'),rb=dsrc.match(/reconBolt:\{pulses:\[([\d.]+),([\d.]+)\],radius:([\d.]+),reveal:([\d.]+)\}/);
  eq(xe('[XRCN.pulses[0],XRCN.pulses[1],XRCN.radius,XRCN.reveal]'),rb?[+rb[1],+rb[2],+rb[3],+rb[4]]:null,'client XRCN == server DEV.reconBolt');
  const ok=xe('(()=>{const al=bots.filter(b=>b.alive&&b.g);if(al.length<2)return null;window.__rb={p:new THREE.Vector3(player.x,0.2,player.z),near:al[0],out:al[1]};al.forEach(b=>{b.g.position.set(player.x+200,b.g.position.y,player.z);b.det=1e9;});player.hp=100;__rb.near.g.position.x=player.x+28;__rb.out.g.position.x=player.x-33;window.__los0=los;los=(a,b)=>true;return true;})()');
  if(!ok)fail('Recon Bolt: need two live bots');else{
   const t0=xe('performance.now()'),at=async ms=>{while(xe('performance.now()')-t0<ms)await adv(20);};const keep=()=>xe('[[__rb.near,28],[__rb.out,-33]].forEach(([b,d])=>{b.alive=true;b.hp=100;b.g.position.x=__rb.p.x+d;b.g.position.z=__rb.p.z;});player.hp=100;true');
   xe('jUnreveal();jReveal(__rb.p);true');keep();eq(xe('J.rvT>0'),false,'no reveal as the bolt lands');await at(850);keep();eq(xe('J.rvT>0'),false,'no reveal before the first pulse (0.9 s)');
   await at(950);eq(xe('[J.rv.includes(__rb.near),J.rv.includes(__rb.out)]'),[true,false],'first pulse: 28 m revealed, 33 m not (was 15 m)');await at(1700);keep();eq(xe('J.rvT>0'),false,'reveal lasts 0.75 s');
   await at(2450);keep();await at(2550);eq(xe('J.rvT>0&&J.rv.includes(__rb.near)'),true,'second pulse at 2.5 s');await at(3400);keep();eq(xe('J.rvT>0'),false,'second reveal over');
   xe('los=(a,b)=>false;true');{const t1=xe('performance.now()');xe('jReveal(__rb.p);true');while(xe('performance.now()')-t1<1000)await adv(20);}eq(xe('J.rv.length'),0,'no reveal without the bolt\'s line of sight');
   xe('los=(a,b)=>true;jReveal(__rb.p);XRCN.g++;jUnreveal();true');{const t1=xe('performance.now()');while(xe('performance.now()')-t1<2700)await adv(50);}eq(xe('J.rvT>0'),false,'a round clear cancels pending pulses');
   xe('los=__los0;bots.forEach(b=>{if(b.det>1e8)b.det=0;});true');}}
 // ---- Killjoy Nanoswarm (wiki Nanoswarm: 4.5 m, 1 s activation windup, then 45/s to 5 s); client XNANO == server DEV.nanoswarm ----
 {const dsrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/devices.js'),'utf8'),nm=dsrc.match(/nanoswarm:\{life:120,active:([\d.]+),delay:([\d.]+),radius:([\d.]+),damage:([\d.]+)\}/);
  eq(xe('[XNANO.active,XNANO.delay,XNANO.r,XNANO.dps]'),nm?[+nm[1],+nm[2],+nm[3],+nm[4]]:null,'client XNANO == server DEV.nanoswarm');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');/* nobody shoots and the clock cannot run out during the section (either ended the round here) */pick('Killjoy');await adv(200);
  const ok=xe('(()=>{const al=bots.filter(b=>b.alive&&b.g);if(al.length<2)return null;const p=new THREE.Vector3(player.x+40,0.05,player.z);window.__kn={p,near:al[0],far:al[1]};al.forEach(b=>{b.g.position.set(player.x+200,b.g.position.y,player.z);b.det=1e9;});allies.forEach(a=>{a.det=1e9;});const m=jM(zoneGeo,fireMat(0xc8d23a,0.12));m.position.copy(p);scene.add(m);J.nano.push({m,p,on:false,t:0});player.hp=100;return true;})()');
  if(!ok)fail('Nanoswarm: need two live bots');else{
   // count only Nanoswarm damage (ally bots keep shooting the parked enemies); time by the swarm's own clock (n.t), not harness ms
   const keep=()=>xe('[[__kn.near,4.3],[__kn.far,-4.7]].forEach(([b,d])=>{b.alive=true;b.hp=100;b.g.position.x=__kn.p.x+d;b.g.position.z=__kn.p.z;});player.hp=100;true');keep();
   xe('window.__jh0=jHit;window.__kd=[0,0];jHit=function(b,n,w){if(w==="Nanoswarm"){const i=b===__kn.near?0:b===__kn.far?1:-1;if(i>=0)__kd[i]+=n;}return __jh0.apply(this,arguments);};true');
   await tap('KeyC');eq(xe('J.nano.filter(n=>n.on).length'),1,'C triggers the hidden swarm');const nt=()=>xe('(J.nano.find(n=>n.on)||{t:-1}).t');
   const XNw=x=>x("XNANO.active-XNANO.delay");
   for(let i=0;i<80&&nt()>XNw(xe)+0.05;i++){await adv(50);keep();}eq(xe('__kd[0]'),0,'no damage in the 1 s activation windup');
   for(let i=0;i<80&&nt()>3.5;i++){await adv(50);keep();}const kd=xe('__kd'),burnt=XNw(xe)-nt();
   eq([kd[0]>0&&Math.abs(kd[0]-45*burnt)<3,kd[1]],[true,0],'45/s inside 4.5 m after the windup (4.3 m in, 4.7 m out; was 2.5 m): '+JSON.stringify(kd)+' over '+burnt.toFixed(2)+' s');eq(xe('+((J.nano.find(n=>n.on)||{m:{scale:{x:0}}}).m.scale.x).toFixed(2)'),1.8,'disc drawn at 4.5 m');
   xe('jHit=__jh0;bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});J.nano.forEach(n=>n.t=0.01);true');await adv(200);}}
 // ---- Omen Paranoia (wiki Paranoia: a 25 m orb at 20 m/s, 4.3 m radius, through walls, no facing check, allies too: 2 s); client XPAR == server PARANOIA ----
 {const asrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/abilities.js'),'utf8'),pm=asrc.match(/PARANOIA=\{speed:([\d.]+),range:([\d.]+),radius:([\d.]+),nearsight:([\d.]+)\}/);
  eq(xe('[XPAR.speed,XPAR.range,XPAR.r,XPAR.ns]'),pm?[+pm[1],+pm[2],+pm[3],+pm[4]]:null,'client XPAR == server PARANOIA');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Omen');await adv(200);
  const ok=xe('(()=>{const al=bots.filter(b=>b.alive&&b.g),fr=allies.filter(a=>a.alive&&a.g);if(al.length<2)return null;window.__pa={o:{x:player.x,z:player.z},hit:al[0],wide:al[1],past:al[2]||null,mate:fr[0]||null};bots.forEach(b=>b.g.position.set(player.x+200,b.g.position.y,player.z));J.par.length=0;window.__paLos=los;return true;})()');
  if(!ok)fail('Paranoia: need two live bots');else{
   // yaw 0 aims -z; along the line: hit 10 m (a wall in the way: los false), wide 4.6 m off at 12 m, past 31 m (5 m beyond the end: the orb starts 1 m ahead and travels 25 m), mate 3 m off at 6 m
   const keep=()=>xe('[[__pa.hit,0,-10],[__pa.wide,4.6,-12],[__pa.past,0,-31],[__pa.mate,3,-6]].forEach(([b,x,z])=>{if(!b)return;b.alive=true;b.hp=100;b.g.position.x=__pa.o.x+x;b.g.position.z=__pa.o.z+z;});player.x=__pa.o.x;player.z=__pa.o.z;player.hp=100;true');keep();
   xe('[__pa.hit,__pa.wide,__pa.past,__pa.mate].forEach(b=>{if(!b)return;b.blind=0;b.g.rotation.y=0;});yaw=0;los=(a,b)=>false;okKey("KeyQ");true');eq(xe('J.par.length'),1,'Q throws the orb');
   const ot=()=>xe('J.par.length?J.par[0].t:-1');for(let i=0;i<40&&ot()>=0&&ot()<0.15;i++){await adv(25);keep();}eq(xe('__pa.hit.blind>0'),false,'10 m target not reached at 0.15 s (20 m/s)');
   for(let i=0;i<80&&xe('J.par.length');i++){await adv(50);keep();}
   const r=xe('[__pa.hit.blind,__pa.wide.blind,__pa.past?__pa.past.blind:0,__pa.mate?__pa.mate.blind:1,J.par.length]');xe('los=__paLos;true');/* was los=los.__p: __p sat on the replaced function, so los became undefined and every later frame threw 'los is not a function' (ability ticks frozen) */
   eq([r[0]>0.5&&r[0]<=2,r[1],r[2],r[3]>0.5&&r[3]<=2,r[4]],[true,0,0,true,0],'Paranoia: 10 m behind a wall and facing away hit (2 s), 4.6 m off the line and 5 m past 25 m missed, ally hit (when a third bot / an ally is alive), orb gone: '+JSON.stringify(r));
   xe('bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');await adv(200);}}
 // ---- Raze Boom Bot (wiki Boom_Bot: 5 s, 15 m detection, explodes within 2.5 m, 80 inside 2 m -> 30 at 6 m); client XBB == server DEV.boombot ----
 {const dsrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/devices.js'),'utf8'),bm=dsrc.match(/boombot:\{life:([\d.]+),speed:[\d.]+,sight:([\d.]+),trigger:([\d.]+),windup:([\d.]+),hp:([\d.]+),damage:([\d.]+),min:([\d.]+),inner:([\d.]+),radius:([\d.]+)\}/);
  eq(xe('[XBB.life,XBB.sight,XBB.trig,XBB.wu,XBB.hp,XBB.max,XBB.min,XBB.inner,XBB.out]'),bm?bm.slice(1).map(Number):null,'client XBB == server DEV.boombot');
  eq(xe('[xBbDmg(0),xBbDmg(2),xBbDmg(4),xBbDmg(5.5),xBbDmg(6.01)]'),[80,80,55,36.25,0],'Boom Bot falloff 80 (2 m) -> 30 (6 m)');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Raze');await adv(200);
  const ok=xe('(()=>{const al=bots.filter(b=>b.alive&&b.g);if(al.length<3)return null;window.__bb={o:{x:player.x,z:player.z},foe:al[0],side:al[1],out:al[2]};bots.forEach(b=>b.g.position.set(player.x+200,b.g.position.y,player.z));window.__bl0=blocked;window.__lo0=los;blocked=()=>false;los=()=>true;RS.bb.length=0;return true;})()');
  if(!ok)fail('Boom Bot: need three live bots');else{
   // the bot leaves heading -z; foe 13.4 m away at (12, -6) (outside the old 10 m sight), side 3 m further, out 9 m further
   const keep=()=>xe('[[__bb.foe,12,-6],[__bb.side,12,-9],[__bb.out,12,-15]].forEach(([b,x,z])=>{b.alive=true;b.hp=100;b.g.position.x=__bb.o.x+x;b.g.position.z=__bb.o.z+z;});player.x=__bb.o.x;player.z=__bb.o.z;player.hp=100;true');keep();
   xe('window.__bd=[0,0,0];window.__jh1=jHit;jHit=function(b,n,w){if(w==="Boom Bot"){const i=[__bb.foe,__bb.side,__bb.out].indexOf(b);if(i>=0)__bd[i]+=n;}return __jh1.apply(this,arguments);};RS.bb.push({m:rsMesh(0xff8a1f,1.6,new RV(__bb.o.x,0.4,__bb.o.z-1)),dx:0,dz:-1,t:XBB.life});true');
   for(let i=0;i<120&&xe('RS.bb.length');i++){await adv(50);keep();}
   const d=xe('__bd');xe('jHit=__jh1;blocked=__bl0;los=__lo0;bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');
   eq([d[0]>=73.75&&d[0]<=80,d[1]>30&&d[1]<d[0],d[2]],[true,true,0],'Boom Bot locks at 13.4 m, explodes within 2.5 m (73.75-80), falloff to a target ~4.7 m from the blast, none at ~10 m: '+JSON.stringify(d));await adv(200);}}
 // Boom Bot 0.6 s windup + 60 HP (wiki Boom_Bot): stops within 2.5 m, explodes 0.6 s later; an enemy bot Raze's Boom Bot is a player gun target (XLDH) and dies at 0 HP without exploding
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Raze');await adv(200);
  const ok=xe('(()=>{const f=bots.find(b=>b.alive&&b.g);if(!f)return null;window.__bw={o:{x:player.x,z:player.z},f};bots.forEach(b=>{if(b!==f)b.g.position.set(player.x+200,b.g.position.y,player.z);});window.__bl1=blocked;window.__lo1=los;blocked=()=>false;los=()=>true;RS.bb.length=0;return true;})()');
  if(!ok)fail('Boom Bot windup: need a live bot');else{
   const keep=()=>xe('__bw.f.alive=true;__bw.f.hp=1000;__bw.f.g.position.x=__bw.o.x;__bw.f.g.position.z=__bw.o.z-4;player.x=__bw.o.x+30;player.z=__bw.o.z;player.hp=100;true');keep();
   xe('window.__bwd=0;window.__jh2=jHit;jHit=function(b,n,w){if(w==="Boom Bot"&&b===__bw.f)__bwd+=n;return __jh2.apply(this,arguments);};RS.bb.push({m:rsMesh(0xff8a1f,1.6,new RV(__bw.o.x,0.4,__bw.o.z-1)),dx:0,dz:-1,t:XBB.life,hp:XBB.hp});window.__bwo=RS.bb[0];true');
   for(let i=0;i<20&&xe('__bwo.wu==null');i++){await adv(50);keep();}const w0=xe('[__bwo.wu!=null,__bwd,RS.bb.length,__bwo.m.position.z]');await adv(400);keep();const w1=xe('[__bwd,RS.bb.length,__bwo.m.position.z]');await adv(300);keep();const w2=xe('[__bwd>0,RS.bb.length]');
   eq([w0[0],w0[1],w0[2],w1[0],w1[1],w1[2]===w0[3],w2[0],w2[1]],[true,0,1,0,1,true,true,0],'Boom Bot stops within 2.5 m, no damage for 0.6 s, then explodes (was instant): '+JSON.stringify([w0,w1,w2]));
   // an enemy bot Raze's Boom Bot: a player gun target with 60 HP
   xe('window.__bwe=xBbShootable({m:rsMesh(0xff8a1f,1.6,new RV(__bw.o.x+60,0.4,__bw.o.z+60)),dx:0,dz:1,t:XBB.life,hp:XBB.hp,own:__bw.f,en:true});RS.bb.push(__bwe);true');
   eq(xe('[xShotTgts([]).indexOf(__bwe.m)>=0,__bwe.m.userData.ld===__bwe,RS.bb.length]'),[true,true,1],'an enemy Boom Bot is in the player gun raycast (XLDH)');
   xe('__bwe.m.userData.ld.hp-=40;true');await adv(100);eq(xe('[RS.bb.length,__bwe.hp]'),[1,20],'one 40-damage body shot: 60 -> 20, still rolling');
   xe('__bwe.m.userData.ld.hp-=40;true');await adv(100);eq(xe('[RS.bb.length,XLDH.indexOf(__bwe.m),player.hp,!!__bwe.m.parent]'),[0,-1,100,false],'second shot destroys it: gone from the scene and XLDH, no blast');
   xe('jHit=__jh2;blocked=__bl1;los=__lo1;bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});__bw.f.hp=100;true');await adv(200);}}
 // ---- Skye Trailblazer (wiki Trailblazer: 6 s, 3.5 m explosion, concuss 4 s at the centre -> 2.5 s at the edge); client XTB == server DEV.trail ----
 {const dsrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/devices.js'),'utf8'),tm=dsrc.match(/trail:\{life:([\d.]+),speed:[\d.]+,trigger:([\d.]+),concuss:([\d.]+),minConcuss:([\d.]+),radius:([\d.]+),bite:([\d.]+)\}/);
  eq(xe('[XTB.life,XTB.br,XTB.max,XTB.min,XTB.r,XTB.bite]'),tm?tm.slice(1).map(Number):null,'client XTB == server DEV.trail');eq(xe('[xTbCnc(0),xTbCnc(1.75),xTbCnc(3.5)]'),[4,3.25,2.5],'Trailblazer concuss falloff');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Skye');await adv(200);
  const ok=xe('(()=>{const al=bots.filter(b=>b.alive&&b.g);if(al.length<3)return null;const o={x:player.x,z:player.z};window.__tb={o,c:al[0],e:al[1],out:al[2]};bots.forEach(b=>b.g.position.set(player.x+200,b.g.position.y,player.z));[[al[0],0],[al[1],3],[al[2],3.8]].forEach(([b,x])=>{b.cnc=0;b.blind=0;b.hp=100;b.g.position.x=o.x+x;b.g.position.z=o.z-4;});window.__bl1=blocked;window.__lo1=los;blocked=()=>false;los=()=>true;yaw=0;J.dr={x:o.x,y:0.6,z:o.z,t:XTB.life,dart:1,yw:0,pt:0,tb:true};tbLeap();const r=[__tb.c.cnc,__tb.e.cnc,__tb.out.cnc||0,J.dr.x-o.x,J.dr.z-o.z,100-__tb.c.hp,100-__tb.e.hp];blocked=__bl1;los=__lo1;drEnd();return r;})()');
  if(!ok)fail('Trailblazer: need three live bots');else eq(ok.map(n=>+(+n).toFixed(2)),[4,2.71,0,0,-4,30,0],'Trailblazer leap 4 m: 4 s at the landing spot, 2.71 s at 3 m, none at 3.8 m (was 2 s flat inside 3 m); bites the bot it lands on for 30 (wiki), not the one 3 m off');
  xe('bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');await adv(200);}
 // ---- Breach Rolling Thunder (wiki Rolling_Thunder: 32 m x 18 m strip from 8 m in front, concuss 4 s); client XRT2 == server ULT.quake ----
 {const usrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/ults.js'),'utf8'),qm=usrc.match(/quake:\{delay:[^,]+,near:([\d.]+),length:([\d.]+),width:([\d.]+),concuss:([\d.]+)\}/);
  eq(xe('[XRT2.near,XRT2.len,XRT2.w,XRT2.cnc]'),qm?qm.slice(1).map(Number):null,'client XRT2 == server ULT.quake');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Breach');await adv(200);
  const ok=xe('(()=>{const al=bots.filter(b=>b.g);if(al.length<5)return null;const o={x:player.x,z:player.z},was=al.map(b=>b.alive);bots.forEach(b=>b.g.position.set(player.x+200,b.g.position.y,player.z));const P=[[2,-12],[8.5,-38],[0,-5],[-9.6,-20],[0,-41]];al.slice(0,5).forEach((b,i)=>{b.alive=true;b.cnc=0;b.blind=0;b.g.position.x=o.x+P[i][0];b.g.position.z=o.z+P[i][1];});bcCone({x:o.x,z:o.z,ry:0});const r=al.slice(0,5).map(b=>b.cnc||0);al.forEach((b,i)=>{b.alive=was[i];b.cnc=0;b.blind=0;});return r;})()');/* dead bots stood up for the check only (revived bots are put back as they were) */
  if(!ok)fail('Rolling Thunder: need five bots');else eq(ok,[4,4,0,0,0],'Rolling Thunder: 12 m ahead and 38 m ahead / 8.5 m aside concussed 4 s; 5 m ahead (inside the old cone), 9.6 m aside and 41 m ahead spared');
  xe('bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');await adv(200);}
 // ---- Sova Hunter's Fury (wiki Hunter's_Fury: 3 charges, 1 every 2.125 s, 6 s, 66 m x 1.76 m radius, 80, reveal 1 s); client XHFU == server ULT.fury ----
 {const usrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/ults.js'),'utf8'),fm=usrc.match(/fury:\{blasts:([\d.]+),cycle:([\d.]+),window:([\d.]+),range:([\d.]+),width:([\d.]+),damage:([\d.]+),reveal:([\d.]+)\}/);
  eq(xe('[XHFU.n,XHFU.cyc,XHFU.win,XHFU.len,XHFU.r,XHFU.dmg,XHFU.rv]'),fm?fm.slice(1).map(Number):null,'client XHFU == server ULT.fury');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Sova');await adv(200);
  const ok=xe('(()=>{const al=bots.filter(b=>b.g);if(al.length<3)return null;const o={x:player.x,z:player.z},was=al.map(b=>b.alive);window.__hf={o,a:al[0],b:al[1],was,al};bots.forEach(b=>b.g.position.set(player.x+200,b.g.position.y,player.z));[[al[0],1.4],[al[1],-2]].forEach(([b,x])=>{b.alive=true;b.hp=1000;b.g.position.x=o.x+x;b.g.position.z=o.z-30;});jUnreveal();window.__hd=new Map();window.__jh2=jHit;jHit=function(b,n,w){if(w==="Hunter\'s Fury")__hd.set(b,(__hd.get(b)||0)+n);return __jh2.apply(this,arguments);};window.__hD=b=>__hd.get(b)||0;yaw=0;pitch=0;J.hf=XHFU.n;J.hfT=XHFU.win;J.cd.x=0;jBeam();return [__hD(__hf.a),__hD(__hf.b),J.rv.indexOf(__hf.a)>=0,J.rv.indexOf(__hf.b)>=0,J.rvT,J.hf,+J.cd.x.toFixed(3)];})()');
  if(!ok)fail("Hunter's Fury: need three bots");else{
   eq(ok,[80,0,true,false,1,2,2.125],"Hunter's Fury blast: 1.4 m off the line hit for 80 and revealed 1 s (was 0.9 m, no reveal), 2 m off missed, 2.125 s cycle");
   xe('jBeam();true');eq(xe('J.hf'),2,'no second blast before 2.125 s');await adv(1100);eq(xe('J.rv.indexOf(__hf.a)'),-1,'reveal over after 1 s');
   await adv(1150);xe('jBeam();true');eq(xe('[J.hf,__hD(__hf.a)]'),[1,160],'second blast after 2.125 s');
   await adv(3900);eq(xe('J.hf'),0,'the unfired charge is lost 6 s after the cast');
   // bot Hunter's Fury (an ally Sova bot at the bots): 3 blasts 2.125 s apart, 66 m x 1.76 m, reveals for the player
   const bo=xe('(()=>{const s=allies[0];if(!s||!s.g)return null;s.alive=true;const o=__hf.o;s.g.position.x=o.x;s.g.position.z=o.z;[[__hf.a,0,-20],[__hf.b,1.5,-40],[__hf.al[2],2,-30]].forEach(([b,x,z])=>{b.alive=true;b.hp=1000;b.g.position.x=o.x+x;b.g.position.z=o.z+z;});jUnreveal();window.__hs=s;__hd.clear();window.__hu2=hurt;hurt=function(t,n,by){if(by===__hs.name&&n===XHFU.dmg)__hd.set(t,(__hd.get(t)||0)+n);return __hu2.apply(this,arguments);};const r=xBotSovaUlt(s,false);return [r,__hD(__hf.a),__hD(__hf.b),__hD(__hf.al[2]),J.rv.indexOf(__hf.a)>=0&&J.rv.indexOf(__hf.b)>=0,J.rvT];})()');
   if(!bo)fail("bot Hunter's Fury: no ally bot");else{eq(bo,[1,80,80,0,true,1],"bot Hunter's Fury: 20 m and 40 m / 1.5 m off hit and revealed 1 s (was 1.1 m, no reveal), 2 m off missed");
    const keep=()=>xe('__hs.g.position.x=__hf.o.x;__hs.g.position.z=__hf.o.z;__hs.alive=true;[[__hf.a,0,-20],[__hf.b,1.5,-40]].forEach(([b,x,z])=>{b.alive=true;b.g.position.x=__hf.o.x+x;b.g.position.z=__hf.o.z+z;});true');
    for(let t=0;t<2000;t+=100){await adv(100);keep();}eq(xe('__hD(__hf.a)'),80,'bot: no second blast before 2.125 s');
    for(let t=0;t<300;t+=100){await adv(100);keep();}eq(xe('__hD(__hf.a)'),160,'bot: second blast at 2.125 s');
    for(let t=0;t<2200;t+=100){await adv(100);keep();}eq(xe('__hD(__hf.a)'),240,'bot: third blast at 4.25 s');
    for(let t=0;t<2500;t+=100){await adv(100);keep();}eq(xe('__hD(__hf.a)'),240,'bot: three blasts only');
    // an enemy Sova bot at the player: the blast hits and the round-clear token cancels the rest
    const en=xe('(()=>{const s=__hf.a;s.g.position.x=__hf.o.x;s.g.position.z=__hf.o.z-20;player.x=__hf.o.x;player.z=__hf.o.z;player.hp=100;window.__ar=player.armor;player.armor=0;allies.forEach(a=>a.g&&a.g.position.set(__hf.o.x+200,a.g.position.y,__hf.o.z));const r=xBotSovaUlt(s,true);XHFU.g++;return [r,100-player.hp];})()');
    eq(en,[1,80],"enemy bot Hunter's Fury hits the player for 80");await adv(2500);eq(xe('100-player.hp'),80,'cancelled blasts never fire');}
   xe('jHit=__jh2;if(window.__hu2)hurt=__hu2;player.hp=100;if(window.__ar!=null)player.armor=__ar;__hf.al.forEach((b,i)=>{b.hp=100;b.alive=__hf.was[i];});jUnreveal();J.hf=0;bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');await adv(200);}}
 // ---- Raze Showstopper splash (wiki Showstopper: 4 m inner / 7 m outer, 30 - 150); client XSS == server ULT.rocket ----
 {const usrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/ults.js'),'utf8'),rm=usrc.match(/rocket:\{speed:[\d.]+,life:[\d.]+,inner:([\d.]+),outer:([\d.]+),damage:([\d.]+),min:([\d.]+),/);
  eq(xe('[XSS.inner,XSS.outer,XSS.max,XSS.min]'),rm?rm.slice(1).map(Number):null,'client XSS == server ULT.rocket');eq(xe('[0,3.5,4,5.5,7,8].map(xSsDmg)'),[150,150,150,90,0,0],'Showstopper falloff table');
  const ok=xe('(()=>{const al=bots.filter(b=>b.g);if(al.length<3)return null;const was=al.map(b=>[b.alive,b.hp]),o={x:player.x,z:player.z-10};bots.forEach(b=>b.g.position.set(player.x+200,b.g.position.y,player.z));[[al[0],3.5],[al[1],5.5],[al[2],7.5]].forEach(([b,x])=>{b.alive=true;b.hp=1000;b.g.position.x=o.x+x;b.g.position.z=o.z;});const d=new Map(),jh=jHit,lo=los;jHit=function(b,n,w){if(w==="Showstopper")d.set(b,(d.get(b)||0)+n);return jh.apply(this,arguments);};los=()=>true;try{rsBoom(new RV(o.x,1,o.z),XSS.outer,XSS.max,"Showstopper",0xff8a1f,null,true);}finally{jHit=jh;los=lo;}const r=al.slice(0,3).map(b=>+(d.get(b)||0).toFixed(1));al.forEach((b,i)=>{b.alive=was[i][0];b.hp=was[i][1];});return r;})()');
  if(!ok)fail('Showstopper: need three bots');else eq(ok,[150,90,0],'Showstopper splash: 150 at 3.5 m (inside the 4 m inner; was 75 by 1 - d / 7), 90 at 5.5 m, none past 7 m');}
 // ---- Killjoy Turret fire (wiki Turret: 0.75 s windup, 3-shot bursts every 1.25 s, 8 / 6 / 4 per shot by distance); client XTUR == server DEV.turret ----
 {const dsrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/devices.js'),'utf8'),tm=dsrc.match(/turret:\{life:[\d.]+,range:([\d.]+),arc:(\d+)\*Math.PI\/180,interval:[\d.]+,deploy:([\d.]+),active:([\d.]+),windup:([\d.]+),shots:([\d.]+),gap:([\d.]+),cycle:([\d.]+),near:([\d.]+),mid:([\d.]+),dmg:\[([\d.]+),([\d.]+),([\d.]+)\]/);
  eq(xe('[XTUR.range,XTUR.cone/2,XTUR.deploy,XTUR.active,XTUR.windup,XTUR.shots,XTUR.gap,XTUR.cycle,XTUR.near,XTUR.mid].concat(XTUR.dmg)'),tm?tm.slice(1).map(Number):null,'client XTUR == server DEV.turret');eq(xe('[0,19.9,20,34.9,35,50].map(xTurDmg)'),[8,8,6,6,4,4],'Turret damage tiers');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Killjoy');await adv(200);
  const ok=xe('(()=>{const al=bots.filter(b=>b.g);if(al.length<1)return null;const o={x:player.x,z:player.z},b=al[0];window.__tu={o,b,was:[b.alive,b.hp],d:0};bots.forEach(q=>q.g.position.set(player.x+200,q.g.position.y,player.z));b.alive=true;b.hp=1000;b.g.position.x=o.x;b.g.position.z=o.z-10;window.__lo3=los;los=()=>true;window.__jh3=jHit;jHit=function(t,n,w){if(w==="Turret"&&t===__tu.b)__tu.d+=n;return __jh3.apply(this,arguments);};const m=new THREE.Mesh(kjTur,new THREE.MeshBasicMaterial());m.position.set(o.x,0.45,o.z);scene.add(m);J.tur={m,p:m.position,fx:0,fz:-1,hp:100,cd:0};return true;})()');
  if(!ok)fail('Turret: need a bot');else{const keep=()=>xe('__tu.b.alive=true;__tu.b.g.position.x=__tu.o.x;__tu.b.g.position.z=__tu.o.z-10;if(J.tur)J.tur.hp=100;true'),h=[];
   for(const ms of [700,600,600,600]){for(let t=0;t<ms;t+=50){await adv(50);keep();}h.push(xe('__tu.d'));}
   xe('jHit=__jh3;los=__lo3;if(J.tur){scene.remove(J.tur.m);J.tur=null;}__tu.b.alive=__tu.was[0];__tu.b.hp=__tu.was[1];bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');
   eq(h,[0,24,24,48],'Turret at 10 m: nothing in the 0.75 s windup, one 3 x 8 burst by 1.3 s and still at 1.9 s, the next by 2.5 s (was 10 every 0.35 s)');}}
 // Turret cone / proximity (wiki: 100 degree cone; off while Killjoy is dead or beyond 40 m)
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Killjoy');await adv(200);
  const ok=xe('(()=>{const b=bots.find(b=>b.g);if(!b)return null;const o={x:player.x,z:player.z};window.__tc={o,b,was:[b.alive,b.hp],d:0};bots.forEach(q=>q.g.position.set(player.x+200,q.g.position.y,player.z));b.alive=true;b.hp=1000;window.__lo5=los;los=()=>true;window.__jh5=jHit;jHit=function(t,n,w){if(w==="Turret"&&t===__tc.b)__tc.d+=n;return __jh5.apply(this,arguments);};return true;})()');
  if(!ok)fail('Turret cone: need a bot');else{const run=async(ang,px)=>{xe('__tc.d=0;if(J.tur)scene.remove(J.tur.m);const m=new THREE.Mesh(kjTur,new THREE.MeshBasicMaterial());m.position.set(__tc.o.x,0.45,__tc.o.z);scene.add(m);J.tur={m,p:m.position,fx:0,fz:-1,hp:100,cd:0};true');
    for(let t=0;t<1500;t+=50){await adv(50);xe('__tc.b.alive=true;__tc.b.hp=1000;__tc.b.g.position.x=__tc.o.x+Math.sin('+ang+')*10;__tc.b.g.position.z=__tc.o.z-Math.cos('+ang+')*10;player.x=__tc.o.x+'+px+';player.z=__tc.o.z;player.hp=100;if(J.tur)J.tur.hp=100;true');}return xe('__tc.d');};
   const r=[await run(45*Math.PI/180,0)>0,await run(55*Math.PI/180,0),await run(0,41),await run(0,39)>0];
   xe('jHit=__jh5;los=__lo5;if(J.tur){scene.remove(J.tur.m);J.tur=null;}player.x=__tc.o.x;__tc.b.alive=__tc.was[0];__tc.b.hp=__tc.was[1];bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');
   eq(r,[true,0,0,true],'Turret: 45 degrees off shot, 55 degrees off not (100 degree cone, was 180), Killjoy 41 m away off, 39 m on');}}
 // ---- Skye Guiding Light (wiki Guiding_Light: 18 m/s, 2 s, max blind 1 - 2.25 s over the first 0.75 s of flight); client XGL == server GUIDING ----
 {const asrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/abilities.js'),'utf8'),gm=asrc.match(/GUIDING=\{speed:([\d.]+),min:([\d.]+),max:([\d.]+),ramp:([\d.]+),act:([\d.]+)\}/);
  eq(xe('[XGL.speed,XGL.min,XGL.max,XGL.ramp,XGL.act,XGL.life]'),gm?gm.slice(1).map(Number).concat([2]):null,'client XGL == server GUIDING (2 s flight)');eq(xe('[0,0.375,0.75,2].map(xGlBlind)'),[1,1.625,2.25,2.25],'Guiding Light blind ramp');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Skye');await adv(200);
  const ok=xe('(()=>{const b=bots.find(b=>b.g);if(!b)return null;const o={x:player.x,z:player.z};window.__gl={o,b,was:[b.alive,b.hp]};bots.forEach(q=>q.g.position.set(player.x+200,q.g.position.y,player.z));b.alive=true;b.blind=0;b.g.position.x=o.x;b.g.position.z=o.z-10;b.g.rotation.y=0;window.__lo4=los;los=()=>true;RS.hk={m:rsMesh(0xffe27a,1.4,new RV(o.x,1.6,o.z-4)),d:new RV(0,0,-1),t:XGL.life-0.25};hkPop();return [+b.blind.toFixed(3),!!RS.hk];})()');
  if(!ok)fail('Guiding Light: need a bot');else{eq(ok,[0,true],'Guiding Light pop: no flash yet (0.3 s activation windup, was instant)');await adv(250);eq(xe('[+__gl.b.blind.toFixed(3),!!RS.hk]'),[0,true],'still winding up at 0.25 s');await adv(100);eq(xe('+__gl.b.blind.toFixed(1)'),+(1+1.25/3).toFixed(1),'flash 0.3 s after a pop at 0.25 s of flight: ~1.42 s blind (was 2.25 s flat)');
   xe('__gl.b.blind=0;__gl.b.alive=true;RS.hk={m:rsMesh(0xffe27a,1.4,new RV(__gl.o.x,1.6,__gl.o.z-4)),d:new RV(0,1,0),t:0.1};true');await adv(500);
   const r=xe('[RS.hk===null,+__gl.b.blind.toFixed(2)]');xe('los=__lo4;__gl.b.alive=__gl.was[0];__gl.b.hp=__gl.was[1];__gl.b.blind=0;bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');
   eq([r[0],r[1]>2&&r[1]<=2.25],[true,true],'the hawk flashes at the end of its 2 s flight with the full 2.25 s blind (was: faded, no flash): '+JSON.stringify(r));}}
 // ---- Owl Drone / Spycam darts (wiki Owl_Drone: pings 0.6 s at 1.6 s and 3.4 s; Spycam: a ping every 2 s); client XOWL / XSPY == server DEV.owl / DEV.spycam ----
 {const dsrc=require('fs').readFileSync(require('path').join(__dirname,'../server/src/devices.js'),'utf8'),om=dsrc.match(/owl:\{pings:\[([\d.]+),([\d.]+)\],reveal:([\d.]+)/),sm=dsrc.match(/spycam:\{deploy:[\d.]+,every:([\d.]+),pings:([\d.]+),reveal:([\d.]+)/);
  eq(xe('XOWL.pings.concat([XOWL.reveal])'),om?om.slice(1).map(Number):null,'client XOWL == server DEV.owl');eq(xe('[XSPY.every,XSPY.pings,XSPY.reveal]'),sm?sm.slice(1).map(Number):null,'client XSPY == server DEV.spycam');}
 await live();{xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');pick('Sova');await adv(200);
  const ok=xe('(()=>{const b=bots.find(b=>b.g&&b.alive);if(!b)return null;window.__dt=b;window.__dthp=b.hp;b.hp=1000;jUnreveal();window.__dt0=performance.now();drTag(b);return J.rv.indexOf(b)<0;})()');
  if(!ok)fail('Owl dart: need a live bot, not revealed at the tag');else{const t0=xe('__dt0'),at=async ms=>{while(xe('performance.now()')-t0<ms){await adv(50);xe('__dt.alive=true;__dt.hp=1000;true');}},on=()=>xe('J.rv.indexOf(__dt)>=0&&J.rvT>0'),h=[];
   for(const ms of [1500,1700,2350,3500,4150]){await at(ms);h.push(on());}
   eq(h,[false,true,false,true,false],'Owl dart: ping 0.6 s at 1.6 s and at 3.4 s (was a 5 s reveal at the tag)');
   xe('jUnreveal();window.__dt1=performance.now();xDartPings(__dt,Array.from({length:XSPY.pings},(_,k)=>k*XSPY.every),XSPY.reveal);true');const t1=xe('__dt1'),at1=async ms=>{while(xe('performance.now()')-t1<ms){await adv(50);xe('__dt.alive=true;__dt.hp=1000;true');}},h2=[];
   for(const ms of [100,1150,2100,8100,9300]){await at1(ms);h2.push(on());}
   eq(h2,[true,false,true,true,false],'Spycam dart: 1 s pings every 2 s, 5 of them (was one 3 s reveal)');
   xe('window.__dt2=performance.now();drTag(__dt);XRCN.g++;true');const t2=xe('__dt2');while(xe('performance.now()')-t2<1800){await adv(50);xe('__dt.alive=true;__dt.hp=1000;true');}eq(on(),false,'a round clear cancels pending dart pings');
   xe('jUnreveal();__dt.hp=Math.min(100,__dthp);bots.concat(allies).forEach(b=>{if(b.det>1e8)b.det=0;});true');await adv(200);}}
 if(xe('XAF.err&&!/load|fetch|Request/i.test(XAF.err)?XAF.err:null'))fail('ability viewmodel error: '+xe('XAF.err'));
 if(H.errors.length>errs0)fail('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.message||e)).join(' | '));
 if(fails.length){console.log(fails.join('\n'));process.exit(1);}console.log('ability equip: binds, migration, HUD labels, equip -> fire flow, first-person equip viewmodel, wiki equip times + windups, Sova bow charge + bounces, Fault Line hold-to-extend, Hot Hands spread, Neural Theft 18 m / 2 s + 6 s, Cyber Cage cylinder, Recon Bolt 30 m pulses, Nanoswarm 4.5 m / 1 s windup, Paranoia 25 m orb, Boom Bot 15 m / 2.5 m / 80-30 falloff / 0.6 s windup / 60 HP, Trailblazer 3.5 m / 4-2.5 s / 30 bite, Rolling Thunder 32 x 18 m strip, Hunter\'s Fury 1.76 m / 2.125 s / 6 s / 1 s reveal, Showstopper 4 / 7 m 150-30, Turret windup / bursts / falloff / 100 degree cone / 40 m, Guiding Light blind by flight time / 0.3 s activation windup, Owl Drone / Spycam dart pings, Cloudburst flight + steering, per-ability smoke radii, kit table ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
