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
 await adv(900);eq(xe('J.q'),0,'buffered FIRE throws once the ability is out');eq(xe('ammo'),a0,'no gun fire through the cast');
 await adv(600);eq(xe('J.eq'),null,'gun back up after the recovery');
 await tap('KeyC');await adv(700);eq(xe('J.eq&&J.eq.st'),'ready','Blaze ready in hand');
 await tap('Digit2');eq(xe('J.eq'),null,'weapon key unequips');eq(xe('J.c'),1,'unequip keeps the charge');
 await tap('KeyC');await adv(100);await tap('KeyE');eq(xe('J.eq&&J.eq.k'),'e','another ability key switches the equipped ability');
 await tap('KeyE');eq(xe('J.eq'),null,'same key again puts it away');
 await adv(400);xe('fcd=0;reloading=0;ammo=Math.max(ammo,5);true');const a1=xe('ammo');await click(0);await adv(100);if(!(xe('ammo')<a1))fail('gun fires again after unequip');
 pick('Sage');xe('player.hp=60;true');await tap('KeyE');await adv(600);await click(2);await adv(500);eq(xe('!!(J.hl&&J.hl.tg===player)'),true,'Sage ALT FIRE heals herself');eq(xe('J.e'),0,'heal spent');
 pick('Jett');await tap('KeyQ');eq(xe('J.eq'),null,'Jett Updraft is INSTANT (no equip)');eq(xe('J.q'),0,'Updraft cast on press');
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
 await tap('KeyQ');await adv(700);const v1=xe(VM);if(VERBOSE)console.log('vm equipped',v1);
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
 if(xe('XEQV.err||null'))fail('ability viewmodel error: '+xe('XEQV.err'));
 if(H.errors.length>errs0)fail('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.message||e)).join(' | '));
 if(fails.length){console.log(fails.join('\n'));process.exit(1);}console.log('ability equip: binds, migration, HUD labels, equip -> fire flow, first-person equip viewmodel, kit table ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
