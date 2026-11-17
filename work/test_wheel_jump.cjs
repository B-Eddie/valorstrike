// Scroll-wheel jump (VALORANT bunny hopping: holding Space never re-jumps, so players bind a second Jump to the mouse wheel and every
// notch is a fresh press). The real page (audit.js fake DOM, real three.js scene graph, the native map loader and the shared motor) in
// an offline 5v5 on Ascent:
//  1. the Settings keybind list has a "Jump (alt)" row, unbound by default (shown "—"); Space stays the primary Jump;
//  2. clicking the row and scrolling binds it ("Wheel Down" / "Wheel Up"); Backspace clears it again;
//  3. with the pointer locked, one wheel notch jumps a grounded player (the motor sees a press: keydown held 2 frames, then keyup);
//  4. a notch per landing chains hops (a bunny hop) and the player never exceeds melee speed;
//  5. a wheel notch with the pointer unlocked (scrolling a menu) and an unbound wheel never jump;
//  6. online, a press released before the 60 Hz input send still reaches the server (netInputMsg carries j once).
//   node work/test_wheel_jump.cjs
const assert=require('node:assert/strict');const {boot}=require('./page_harness.cjs');
(async()=>{
 const H=boot({real3:true,seed:5,native:true}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=16){H.advance(Math.min(16,ms-t));await new Promise(r=>setImmediate(r));}};
 const errs0=H.errors.length;let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
 const wheel=(dy)=>H.dispatch(H.win,H.mkEvent('wheel',{deltaY:dy,isTrusted:true}));
 const row=a=>H.doc.querySelector('#xKb button[data-a="'+a+'"]');
 // 1. defaults
 ok(xe('XS.keys.jumpW')==='' && xe('XS.keys.jump')==='Space','alt jump unbound by default, Space is Jump');
 ok(row('jumpW')&&/Jump \(alt\)/.test(row('jumpW').textContent)&&/—/.test(row('jumpW').textContent),'settings list shows the unbound Jump (alt) row');
 // 2. bind with the wheel through the row, clear with Backspace, bind again
 row('jumpW').click();ok(xe('xKbWait')==='jumpW','row waits for a key');wheel(120);
 ok(xe('XS.keys.jumpW')==='WheelDown'&&xe('xKbWait')===null&&/Wheel Down/.test(row('jumpW').textContent),'a wheel notch binds Wheel Down');
 row('jumpW').click();H.dispatch(H.win,H.mkEvent('keydown',{code:'Backspace',key:'Backspace',isTrusted:true}));ok(xe('XS.keys.jumpW')==='','Backspace clears the alt row');
 row('jumpW').click();wheel(120);ok(xe('XS.keys.jumpW')==='WheelDown'&&xe('xKbRev.WheelDown')==='Space','re-bound: Wheel Down sends Space');
 // start an offline match on the native map with the shared motor
 const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=[...H.doc.querySelectorAll('#xAg .x-ag')].find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);ok(await through('Jett'),'offline 5v5 started');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9;b.armor=0});allies.forEach(a=>{a.cd=1e9});true');
 ok(xe('running&&mode==="five"&&typeof nmActive==="function"&&!!nmActive()'),'offline 5v5 on the native map with the shared motor');
 const grounded=async()=>{for(let i=0;i<120&&xe('player.air');i++)await adv(16);return !xe('player.air');};
 ok(await grounded(),'player settles on the floor');
 // 5a. pointer unlocked: scrolling (a menu) does not jump
 H.doc.pointerLockElement=null;const y0=xe('player.y');wheel(120);await adv(200);ok(!xe('player.air')&&Math.abs(xe('player.y')-y0)<.01,'wheel without pointer lock does not jump');
 // 3. one notch, pointer locked
 H.doc.pointerLockElement=xe('renderer.domElement');wheel(120);let up=false,apex=y0;for(let i=0;i<20;i++){await adv(16);if(xe('player.air'))up=true;apex=Math.max(apex,xe('player.y'));}
 ok(up&&apex-y0>.5,'one wheel notch jumps ('+(apex-y0).toFixed(2)+' m after 0.32 s)');
 ok(!xe('keys.Space'),'the pulse released Space');
 // 4. chained hops: a notch each time the player is back on the floor, running forward with the knife
 xe('rw="knife";true');H.key('KeyW',true);await adv(400);let hops=0,top=0;
 for(let i=0;i<400&&hops<4;i++){const g=!xe('player.air');if(g)wheel(120);await adv(16);if(g&&xe('player.air'))hops++;top=Math.max(top,xe('Math.hypot(player.vx,player.vz)'));}
 H.key('KeyW',false);ok(hops===4,'four wheel hops in a row ('+hops+')');ok(top<=6.75+1e-6,'bunny hop never exceeds melee speed ('+top.toFixed(3)+' m/s)');
 // 5b. unbound: Wheel Down does nothing
 for(let i=0;i<60&&xe('xWpOn');i++)await adv(16);ok(!xe('xWpOn')&&!xe('keys.Space'),'queued notches drain (at most 3 after a flick) and release Space');await adv(800);await grounded();xe('XS.keys.jumpW="";xKbBuild();true');const y1=xe('player.y');wheel(120);await adv(200);ok(!xe('player.air')&&Math.abs(xe('player.y')-y1)<.01,'unbound wheel does not jump');
 // 6. online latch (message builder only: no server here)
 xe('NET.socket=NET.socket||{readyState:1,send(){}};MP.st="game";true');H.dispatch(H.win,H.mkEvent('keydown',{code:'Space',key:' ',isTrusted:true}));H.dispatch(H.win,H.mkEvent('keyup',{code:'Space',key:' ',isTrusted:true}));
 const j=xe('[netInputMsg({},"Knife").j,netInputMsg({},"Knife").j]');ok(j[0]===1&&j[1]===0,'a released press rides the next input message once ('+j+')');
 xe('NET.socket=null;MP.st="";true');
 const errs=H.errors.slice(errs0).map(e=>String(e&&e.message||e));ok(!errs.length,'no page errors: '+errs.slice(0,3).join(' | '));
 console.log(`wheel jump: ${checks} checks - Jump (alt) row binds the wheel, a notch jumps once, notches chain hops at <= melee speed, unlocked / unbound wheel never jumps, online latch`);
 process.exit(0);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
