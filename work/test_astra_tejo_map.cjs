// Astra Astral Form and Tejo Guided Salvo / Armageddon tactical-map targeting (work/agents18_runtime.js a18Tac,
// riding work/ability_target_runtime.js xTac) on the real page with native Ascent (work/page_harness.cjs).
// The real kits pick these spots on an overhead map (wiki.playvalorant.com Astra / Tejo, fetched 2026-11-03).
// Checked:
//  * Astra X with the ult ready opens the xTac overlay as "Astral Form"; C / Q / E arm a star type while it is up
//  * a bare map click places a persistent Star AT THE CLICKED POINT (spends one star, map stays open); C/Q/E arm,
//    clicking the placed Star activates the effect AT THE STAR and consumes it; clicking a Star unarmed dissipates it;
//    X inside the map arms Cosmic Divide: two clicks spend the ult and close it
//  * Esc closes the map (ult kept); X without the ult does not open it
//  * Tejo E opens the map: two clicks fire both salvos at the picked points for one charge; E again after one
//    click launches a single salvo; X opens Armageddon and the click sets its origin (direction Tejo -> point)
//  * online 5v5: opening Astral Form sends {t:'ab',k:'x'}, a star click sends {t:'ab',k,p:[x,z]}, the Divide
//    sends four numbers, Tejo salvos send two points, Armageddon sends its origin - nothing spent locally
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:7,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const click=async(b=0)=>{H.mouse(b,true);await adv(40);H.mouse(b,false);await adv(60);};
const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
const st=()=>xe('({on:xTac.on(),mode:A18TAC.mode,ult:J.ult,stars:J.a18?J.a18.stars:null,e:J.e,v:!!xTac.st.v,cx:xTac.st.cx,cy:xTac.st.cy})');
const look=(mx,my)=>H.dispatch(xe('renderer.domElement'),H.mkEvent('mousemove',{movementX:mx,movementY:my}));
const moveTo=async(x,z)=>{const c=xe(`xTac.canvas(${x},${z})`),s=xe('xTac.st.sens');for(let i=0;i<3;i++){const p=st();look(Math.round((c[0]-p.cx)/s),Math.round((c[1]-p.cy)/s));}await adv(60);};
const node=async label=>xe(`(()=>{const C=nmActive();let best=null,bd=-1;C.nav.nodes.forEach((n,i)=>{if(C.playable&&!C.playable[i])return;const d=Math.hypot(n[0]-player.x,n[2]-player.z);if(d>bd&&d<55){bd=d;best=n;}});return best&&{x:best[0],y:best[1],z:best[2],d:bd};})()`);

(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Astra'),'offline 5v5 started');
 assert.equal(xe('J.pick'),'Astra');assert.ok(xe('nmActive()&&nmActive().key'),'native map active');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});true');
 xe('document.pointerLockElement=renderer.domElement;true');
 const P0=await node();assert.ok(P0,'a reachable nav node');
 // X without the ult: no map
 xe('J.ult=0;true');await tap('KeyX');let s=st();
 check(!s.on&&s.mode===null,'Astra X without the ult does not open Astral Form');
 // X with the ult: Astral Form opens
 xe(`J.ult=K().u;true`);await tap('KeyX');s=st();
 check(s.on&&H.shown('xTac')&&s.mode==='astra','X with the ult ready opens Astral Form on the map overlay');
 const stars0=s.stars;
 // a bare click places a persistent Star at the clicked point and keeps the map open (wiki Stars)
 await moveTo(P0.x,P0.z);await click(0);s=st();
 check(s.on&&s.mode==='astra','the map stays open after placing a star');
 check(s.stars===stars0-1,'placing a star spends one star');
 const st0=xe('J.a18.starList.length?({n:J.a18.starList.length,x:J.a18.starList[0].x,z:J.a18.starList[0].z}):null');
 check(st0&&st0.n===1&&Math.hypot(st0.x-P0.x,st0.z-P0.z)<1,'a persistent Star marker sits at the clicked point '+JSON.stringify(st0));
 // arm Nebula with E and click the placed Star: the smoke lands AT THE STAR and consumes it
 await tap('KeyE');check(xe('A18TAC.arm')==='e','E arms Nebula while the map is up');
 const sm0=xe('J.smokes.length');await moveTo(P0.x,P0.z);await click(0);s=st();
 const smk=xe('J.smokes.length?({x:J.smokes[J.smokes.length-1].m.position.x,z:J.smokes[J.smokes.length-1].m.position.z}):null');
 check(xe('J.smokes.length')>sm0&&smk&&Math.hypot(smk.x-P0.x,smk.z-P0.z)<1,'Nebula activates on the placed star '+JSON.stringify(smk));
 check(xe('J.a18.starList.length')===0,'activating consumes the placed star');
 check(s.stars===stars0-1,'activation consumes the placed star, not the pool');
 // place a second Star elsewhere, arm Gravity Well, click it: gwell at the star
 const P1=xe(`(()=>{const C=nmActive();for(const n of C.nav.nodes){const d=Math.hypot(n[0]-(${P0.x}),n[2]-(${P0.z}));if(d>12&&d<40)return {x:n[0],z:n[2]};}return null;})()`);
 await moveTo(P1.x,P1.z);await click(0);check(xe('J.a18.starList.length')===1,'second Star placed elsewhere');
 await tap('KeyC');check(xe('A18TAC.arm')==='c','C arms Gravity Well while the map is up');
 await moveTo(P1.x,P1.z);await click(0);s=st();
 const gw=xe(`(J.a18fx||[]).filter(f=>f.kind==='gwell').map(f=>({kind:f.kind,x:f.p&&f.p.x,z:f.p&&f.p.z}))`);
 check(gw.length===1&&Math.hypot(gw[0].x-P1.x,gw[0].z-P1.z)<1,'a Gravity Well activates on the placed star '+JSON.stringify(gw));
 check(xe('J.a18.starList.length')===0,'the second star is consumed');
 // dissipate: a bare click on a placed Star recalls it; it reforms in the pool after 1.25 s
 xe('J.a18.stars=1;true'); // a bought star (the two placements emptied the round pool)
 await moveTo(P0.x,P0.z);await click(0);check(xe('J.a18.starList.length')===1,'third Star placed for dissipate');
 const sb=xe('J.a18.stars');await moveTo(P0.x,P0.z);await click(0);
 check(xe('J.a18.starList.length')===0,'clicking a placed Star dissipates it');
 await adv(1600);check(xe('J.a18.stars')===sb+1,'the dissipated Star reforms in the pool');
 // X inside the map arms Cosmic Divide: two clicks spend the ult and close the map
 await tap('KeyX');check(JSON.stringify(xe('A18TAC.wall'))==='[]','X inside Astral Form arms Cosmic Divide');
 await moveTo(P0.x,P0.z);await click(0);s=st();check(s.on,'the first Divide click keeps the map open');
 await moveTo(P1.x,P1.z);await click(0);s=st();
 const dv=xe(`(J.a18fx||[]).filter(f=>f.kind==='div').length`);
 check(!s.on&&s.mode===null&&s.ult===0&&dv===1,'two Divide clicks spend the ult, close the map and raise the wall');
 // Esc cancels (ult kept)
 xe('J.ult=K().u;true');await tap('KeyX');check(st().on,'Astral Form reopens');
 await tap('Escape');s=st();check(!s.on&&s.mode===null&&s.ult===xe('K().u'),'Esc exits Astral Form and keeps the ult');

 // --- Tejo (same match: switch the agent and reset the a18 state) ---
 xe('J.pick="Tejo";a18Reset();true');await adv(100);assert.equal(xe('J.pick'),'Tejo');
 const e0=xe('J.e');await tap('KeyE');s=st();
 check(s.on&&s.mode==='salvo','Tejo E opens Guided Salvo on the map overlay');
 const fx1=xe('(J.a18fx||[]).length');await moveTo(P0.x,P0.z);await click(0);s=st();
 check(s.on&&s.mode==='salvo','the first salvo click keeps the map open for the second target');
 await moveTo(P1.x,P1.z);await click(0);s=st();
 const pl=xe(`(J.a18fx||[]).slice(${fx1}).map(f=>({kind:f.kind,x:f.p&&f.p.x,z:f.p&&f.p.z}))`);
 check(!s.on&&pl.length===2&&pl.every(f=>f.kind==='pulses')&&Math.hypot(pl[0].x-P0.x,pl[0].z-P0.z)<1&&Math.hypot(pl[1].x-P1.x,pl[1].z-P1.z)<1,'two clicks fire both salvos at the picked points '+JSON.stringify(pl));
 check(xe('J.e')===e0-1,'both salvos cost one charge');
 // single-salvo launch: one click then E again
 xe('(J.a18fx||[]).forEach(f=>{if(f.m)try{jRel(f.m)}catch(e){}});J.a18fx.length=0;J.e=1;true');await tap('KeyE');await moveTo(P1.x,P1.z);await click(0);await tap('KeyE');s=st();
 const pl2=xe(`(J.a18fx||[]).filter(f=>f.kind==='pulses').map(f=>({kind:f.kind,x:f.p&&f.p.x,z:f.p&&f.p.z}))`); // clear-then-filter: impact 'burst' visuals share the fx list, so index slices drift
 check(!s.on&&pl2.length===1&&Math.hypot(pl2[0].x-P1.x,pl2[0].z-P1.z)<1,'E again after one click launches a single salvo '+JSON.stringify(pl2));
 // Armageddon: X opens the map, the click sets the origin with the direction Tejo -> point
 xe('J.ult=K().u;true');await tap('KeyX');s=st();check(s.on&&s.mode==='armag','Tejo X opens Armageddon on the map overlay');
 xe('(J.a18fx||[]).forEach(f=>{if(f.m)try{jRel(f.m)}catch(e){}});J.a18fx.length=0;true');await moveTo(P0.x,P0.z);await click(0);s=st();
 const ar=xe(`(J.a18fx||[]).filter(f=>f.kind==='armag').map(f=>({kind:f.kind,x:f.p&&f.p.x,z:f.p&&f.p.z,dx:f.d&&f.d.x,dz:f.d&&f.d.z}))`);
 const px=xe('player.x'),pz=xe('player.z');
 const dd=Math.hypot(P0.x-px,P0.z-pz);
 check(!s.on&&s.ult===0&&ar.length===1&&ar[0].kind==='armag'&&Math.hypot(ar[0].x-P0.x,ar[0].z-P0.z)<1,'Armageddon starts at the picked origin '+JSON.stringify(ar));
 check(ar.length===1&&Math.abs(ar[0].dx-(P0.x-px)/dd)<0.05&&Math.abs(ar[0].dz-(P0.z-pz)/dd)<0.05,'the Armageddon stripe marches from Tejo through the origin');

 // --- online 5v5 intent: picks ride the cast message as m.p, nothing spent locally ---
 xe('window.__qaSent=[];window.__qaNS=netSend;netSend=m=>__qaSent.push(m);NET.socket={readyState:1,send(){}};MP.st="game";MP.m5=true;FV.buy=0;true');
 xe('J.pick="Astra";a18Reset();J.ult=K().u;true');H.key('KeyX',true);H.key('KeyX',false);await adv(80);
 check(st().on,'online: Astral Form opens');
 await moveTo(P0.x,P0.z);await click(0);await adv(60);
 await tap('KeyX');await moveTo(P0.x,P0.z);await click(0);await moveTo(P1.x,P1.z);await click(0);await adv(60);
 let sent=xe('__qaSent.filter(m=>m.t==="ab")');
 check(sent.length===3&&sent[0].k==='x'&&!sent[0].p,'online: opening Astral Form sends a bare x '+JSON.stringify(sent));
 check(sent[1]&&sent[1].k==='s'&&Math.hypot(sent[1].p[0]-P0.x,sent[1].p[1]-P0.z)<1,'online: a star-placement click sends the point '+JSON.stringify(sent[1]));
 check(sent[2]&&sent[2].k==='x'&&sent[2].p.length===4&&Math.hypot(sent[2].p[0]-P0.x,sent[2].p[1]-P0.z)<1&&Math.hypot(sent[2].p[2]-P1.x,sent[2].p[3]-P1.z)<1,'online: the Divide sends both ends '+JSON.stringify(sent[2]));
 check(xe('J.ult')===xe('K().u')&&xe('J.a18.stars')===stars0,'online: the client spends nothing itself');
 xe('__qaSent.length=0;J.pick="Tejo";a18Reset();J.e=1;J.ult=K().u;true');await tap('KeyE');await moveTo(P0.x,P0.z);await click(0);await moveTo(P1.x,P1.z);await click(0);await adv(60);
 sent=xe('__qaSent.filter(m=>m.t==="ab")');
 check(sent.length===1&&sent[0].k==='e'&&sent[0].p.length===4,'online: both salvos ride one e message '+JSON.stringify(sent));
 xe('__qaSent.length=0;true');await tap('KeyX');await moveTo(P0.x,P0.z);await click(0);await adv(60);
 sent=xe('__qaSent.filter(m=>m.t==="ab")');
 check(sent.length===1&&sent[0].k==='x'&&sent[0].p.length===2&&Math.hypot(sent[0].p[0]-P0.x,sent[0].p[1]-P0.z)<1,'online: Armageddon sends its origin '+JSON.stringify(sent));
 check(xe('J.e')===1&&xe('J.ult')===xe('K().u'),'online: Tejo spends nothing locally');
 xe('netSend=__qaNS;NET.socket=null;MP.m5=false;MP.st="";true');
 const errs=H.errors.filter(e=>!/WebGL|AudioContext|fetch|unexpected external script/i.test(String(e.msg||e)));
 check(errs.length===0&&H.xErrCalls.length===0,'no page errors '+JSON.stringify(errs.slice(0,3))+JSON.stringify(H.xErrCalls.slice(0,3)));
 if(fails.length){console.log(fails.length+' FAILED');process.exit(1);}
 console.log('PASS astra/tejo tactical map: Astral Form opens, bare clicks place persistent Stars (one star each, map stays open), armed C/Q/E activate the placed Star (consumed), dissipate reforms the star, Cosmic Divide two-click, Esc cancel, no ult = no map; Tejo salvo two-pick + single-launch, Armageddon origin+direction; online picks ride m.p with no local spend');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
