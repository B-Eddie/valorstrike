// Omen From the Shadows tactical-map targeting (work/ability_target_runtime.js) on the real page with native Ascent
// (work/page_harness.cjs native:true). User 2026-10-27 23:00: "one of the ultimates says to pick point on map but map doesn't
// show up" - the pick was a click on the 160 px corner minimap, hidden outside 5v5 / Retake and 96 px on a phone.
// Checked (Valorant wiki From_the_Shadows: equip shows the whole map, select a location, cast):
//  * X with the ult ready opens a big map overlay (#xTac shown), J.ftp up; the camera does not turn while it is up
//  * pointer-locked mouse movement moves the reticle; the reticle's world point follows the map projection
//  * the spot is checked live: off the nav mesh -> invalid (red, message), a click there casts nothing and fires no shot
//  * left click on a valid spot casts: J.fts at that x / z with y = the nav floor there, ult spent, overlay gone, gun not fired;
//    after the channel Omen stands there at floor height
//  * right click, Esc and X again each cancel (ult kept); touch: tap on the map + CONFIRM casts
//  * the overlay is its own full-screen canvas: it does not need the corner minimap (hidden / 96 px on a phone)
//  * online 5v5: the confirm sends {t:'ab', k:'x', p:[x, z]} and spends nothing locally
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const click=async(b=0)=>{H.mouse(b,true);await adv(40);H.mouse(b,false);await adv(60);};
const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
const ult=()=>xe('J.ult=K().u;J.fts&&(scene.remove(J.fts.m),J.fts=null);player.hp=100;true');
const st=()=>xe('({on:xTac.on(),ftp:!!J.ftp,ult:J.ult,fts:J.fts?{x:J.fts.x,y:J.fts.y,z:J.fts.z}:null,v:xTac.st.v,cx:xTac.st.cx,cy:xTac.st.cy,msg:document.getElementById("xTacM")&&document.getElementById("xTacM").textContent,ammo:typeof ammo!=="undefined"?ammo:null})');
// move the reticle to world (x, z) with pointer-locked mouse movement (the way a mouse moves it in a browser)
// (pointer lock: a browser sends mousemove to the locked element - the game canvas - so window capture listeners run first)
const look=(mx,my)=>H.dispatch(xe('renderer.domElement'),H.mkEvent('mousemove',{movementX:mx,movementY:my}));
const moveTo=async(x,z)=>{const c=xe(`xTac.canvas(${x},${z})`),s=xe('xTac.st.sens');for(let i=0;i<3;i++){const p=st();look(Math.round((c[0]-p.cx)/s),Math.round((c[1]-p.cy)/s));}await adv(60);};

(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Omen'),'offline 5v5 started');
 assert.equal(xe('nmActive()&&nmActive().key'),'ascent');assert.equal(xe('J.pick'),'Omen');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});true');
 xe('document.pointerLockElement=renderer.domElement;true');
 // a playable destination ~25 m+ away: B site, else the farthest playable nav node
 const T=xe(`(()=>{const C=nmActive(),b=C.meta.sites.B;let best=null,bd=-1;C.nav.nodes.forEach((n,i)=>{if(C.playable&&!C.playable[i])return;const d=-Math.hypot(n[0]-b[0],n[2]-b[2]);if(d>bd&&okFtsValid(n[0],n[2])){bd=d;best=n;}});return best&&{x:best[0],y:best[1],z:best[2],floor:nmHeight(C,best[0],best[2],best[1]),d:Math.hypot(best[0]-player.x,best[2]-player.z)};})()`);
 assert.ok(T&&T.d>10,'a destination away from the spawn '+JSON.stringify(T));
 // 1. X opens the tactical map
 xe('MM.style.display="none";true');ult();const yaw0=xe('yaw');await tap('KeyX');let s=st();
 check(s.on&&H.shown('xTac'),'X with the ult ready opens the tactical map overlay (#xTac shown)');check(s.ftp,'J.ftp up while the map is open');
 // 2. reticle follows locked mouse movement; the camera does not turn
 await moveTo(T.x,T.z);s=st();const w=xe('xTac.st.w');
 check(w&&Math.hypot(w[0]-T.x,w[1]-T.z)<1,'reticle world point follows the mouse to the destination ('+JSON.stringify(w)+' vs '+T.x.toFixed(2)+','+T.z.toFixed(2)+')');
 check(s.v&&Math.abs(s.v.y-T.floor)<0.05,'the spot under the reticle is valid with y = the nav floor');check(Math.abs(xe('yaw')-yaw0)<1e-9,'camera yaw unchanged while the map is up');
 // 3. invalid spot: the map corner (off the nav mesh)
 const W0=xe('xTac.world(4,4)');await moveTo(W0[0],W0[1]);s=st();
 check(!s.v&&/Can't go there|Out of range/.test(s.msg),'off-mesh spot is invalid with a message ('+s.msg+')');
 const ammo0=s.ammo;await click(0);s=st();check(s.on&&s.ftp&&s.ult===xe('K().u')&&!s.fts,'a click on an invalid spot casts nothing and keeps the map open');check(s.ammo===ammo0,'no shot fired from the map click');
 // 4. valid spot + click: cast
 await moveTo(T.x,T.z);await click(0);s=st();
 check(!s.on&&!H.shown('xTac'),'the map closes on the cast');check(s.fts&&Math.hypot(s.fts.x-T.x,s.fts.z-T.z)<1&&Math.abs(s.fts.y-xe(`nmHeight(nmActive(),${s.fts&&s.fts.x},${s.fts&&s.fts.z},${T.y})`))<0.05,'J.fts at the picked spot, floor height '+JSON.stringify(s.fts));
 check(s.ult===0,'ult spent');check(s.ammo===ammo0,'the confirm click did not fire the gun');
 await adv(xe('XPAR2.shadows')*1000+400);const P=xe('({x:player.x,y:player.y,z:player.z})');
 check(Math.hypot(P.x-T.x,P.z-T.z)<1.2&&Math.abs(P.y-T.floor)<0.6,'Omen arrives at the picked spot on the floor '+JSON.stringify(P));
 // 5. cancels: right click, Esc, X again (ult kept)
 for(const [how,fn] of [['right click',()=>click(2)],['Esc',()=>tap('Escape')],['X again',()=>tap('KeyX')]]){ult();await tap('KeyX');check(st().on,how+': map opened');await fn();s=st();check(!s.on&&!s.ftp&&s.ult===xe('K().u'),how+' cancels and keeps the ult '+JSON.stringify({on:s.on,ftp:s.ftp,ult:s.ult}));check(!xe('paused'),how+': no pause menu');}
 // 6. touch: tap the map + CONFIRM
 ult();xe('document.pointerLockElement=null;true');await tap('KeyX');const T2=xe(`(()=>{const C=nmActive(),a=C.meta.sites.A;let best=null,bd=1e9;C.nav.nodes.forEach((n,i)=>{if(C.playable&&!C.playable[i])return;const d=Math.hypot(n[0]-a[0],n[2]-a[2]);if(d<bd&&okFtsValid(n[0],n[2])){bd=d;best=n;}});return {x:best[0],z:best[2]};})()`);
 const cl=xe(`xTac.client(${T2.x},${T2.z})`);H.dispatch(H.$('xTacC'),H.mkEvent('touchstart',{touches:[{clientX:cl[0],clientY:cl[1]}],changedTouches:[{clientX:cl[0],clientY:cl[1]}]}));await adv(60);
 s=st();check(s.v&&Math.hypot(s.v.x-T2.x,s.v.z-T2.z)<1,'a tap moves the reticle to the tapped spot');H.$('xTacOk').click();await adv(60);s=st();
 check(!s.on&&s.fts&&Math.hypot(s.fts.x-T2.x,s.fts.z-T2.z)<1,'CONFIRM casts at the tapped spot');
 // 8. online 5v5 intent
 xe('window.__qaSent=[];window.__qaNS=netSend;netSend=m=>__qaSent.push(m);NET.socket={readyState:1,send(){}};MP.st="game";MP.m5=true;FV.buy=0;true');ult();
 H.key('KeyX',true);H.key('KeyX',false);xe(`(()=>{const v=okFtsValid(${T.x},${T.z});xTac.st.cx=xTac.canvas(${T.x},${T.z})[0];xTac.st.cy=xTac.canvas(${T.x},${T.z})[1];return xTac.confirm();})()`);
 const sent=xe('__qaSent.filter(m=>m.t==="ab")');xe('netSend=__qaNS;NET.socket=null;MP.m5=false;MP.st="";true');
 check(sent.length===1&&sent[0].k==='x'&&Math.hypot(sent[0].p[0]-T.x,sent[0].p[1]-T.z)<1&&xe('J.ult')===xe('K().u'),'online: confirm sends the spot to the server and spends nothing locally '+JSON.stringify(sent));
 const errs=H.errors.filter(e=>!/WebGL|AudioContext|fetch|unexpected external script/i.test(String(e.msg||e)));
 check(errs.length===0&&H.xErrCalls.length===0,'no page errors '+JSON.stringify(errs.slice(0,3))+JSON.stringify(H.xErrCalls.slice(0,3)));
 if(fails.length){console.log(fails.length+' FAILED');process.exit(1);}
 console.log('PASS tactical map: X opens the map overlay, locked-mouse reticle, live valid/invalid check, click casts at the nav floor and Omen arrives there, right click / Esc / X cancel (ult kept), touch tap + Confirm, no corner minimap needed, online intent');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
