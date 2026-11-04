// Mouse look lost after a death / an Esc resume (bug lane, 2026-11-03: "the game is so buggy"). A browser only grants
// requestPointerLock inside a user gesture (Firefox always; Chrome after the user left the lock with Esc), and Escape is
// not a gesture. The page re-locked from places that are not gestures: the next round's start after spectating (a timer:
// spectating frees the cursor), and resume() on the Esc key. The request failed, nothing paused, nothing said so, and the
// mouse did not turn the view until the player clicked - and that click also fired a shot.
// Here the canvas's requestPointerLock follows the browser rule (granted only while a mousedown / mouseup / click /
// keydown other than Escape is being dispatched; pointerlockchange fires on lock and unlock). Asserted:
//  1. after a death + spectate, the next round starts without the lock (the request came from a timer) and the page shows
//     a "click to aim" prompt; the first click on the canvas takes the lock and does NOT shoot (ammo unchanged); the
//     prompt goes away; the next click shoots.
//  2. Esc (the browser drops the lock) pauses; Esc again resumes, the re-lock fails (Escape is not a gesture), the prompt
//     shows; the first click locks without a shot.
//  3. no prompt while the lock is held, during the buy menu, paused, or while spectating.
//   node work/test_pointer_relock.cjs
'use strict';
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:4}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const ACT=new Set(['mousedown','mouseup','click','keydown','pointerdown','pointerup','touchend']);let act=false;
const d0=H.dispatch;H.dispatch=(t,e)=>{const a=act;act=a||(ACT.has(e.type)&&e.key!=='Escape'&&e.code!=='Escape');try{return d0(t,e);}finally{act=a;}};
const cv=xe('renderer.domElement');
const lockEv=()=>H.dispatch(H.doc,H.mkEvent('pointerlockchange'));
cv.requestPointerLock=function(){if(!act){setTimeout(()=>H.dispatch(H.doc,H.mkEvent('pointerlockerror')),0);return Promise.reject(new Error('NotAllowedError: requestPointerLock needs a user gesture'));}
 const was=H.doc.pointerLockElement;H.doc.pointerLockElement=this;if(was!==this)setTimeout(lockEv,0);return Promise.resolve();};
H.doc.exitPointerLock=function(){if(!H.doc.pointerLockElement)return;H.doc.pointerLockElement=null;setTimeout(lockEv,0);};
const locked=()=>H.doc.pointerLockElement===cv;
const hint=()=>xe('(()=>{const e=document.getElementById("xLockHint");return !!e&&!e.hidden&&e.style.display!=="none";})()');
const fails=[];const check=(c,m)=>{if(!c)fails.push(m);};
(async()=>{
 // start a 5v5 from a click (the agent-select Lock in is a click): the lock is taken
 act=true;xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true');act=false;
 for(let i=0;i<100&&!xe('running');i++)await adv(100);await adv(300);
 check(xe('running')&&xe('mode')==='five','setup: 5v5 running');check(locked(),'setup: the lock is held after a click-started match');
 check(!hint(),'3. no prompt while the lock is held');
 // buy menu: B frees the cursor (programmatic), B again re-locks (a key gesture): no prompt either way
 H.key('KeyB',true);H.key('KeyB',false);await adv(200);check(xe('FV.menu'),'setup: buy menu open');check(!hint(),'3. no prompt with the buy menu open');
 H.key('KeyB',true);H.key('KeyB',false);await adv(200);check(locked(),'buy menu closed with B re-locks');check(!hint(),'3. no prompt after the buy menu closed with B');
 xe('FV.buy=0.05;true');await adv(400);
 // 1. death -> spectate (frees the cursor) -> next round from the round-end timer
 xe('(()=>{const b=bots.find(b=>b.alive);hurt(player,999,b.name);updHud();pDie(b.name,b.w);return true;})()');
 for(let i=0;i<40&&!xe('!!xKL.sp');i++)await adv(100);await adv(300);
 check(xe('!!xKL.sp'),'setup: spectating after the death');check(!locked(),'setup: spectating frees the cursor');check(!hint(),'3. no prompt while spectating');
 xe('allies.forEach(a=>{a.alive=false;a.hp=0;});fCheck(false,"QA");true');
 for(let i=0;i<120&&!(xe('running')&&xe('player.hp>0'));i++)await adv(100);await adv(800);
 check(xe('running')&&xe('player.hp>0'),'setup: next round started');
 check(!locked(),'setup (browser rule): the round-start re-lock from a timer is refused');
 check(hint(),'1. a "click to aim" prompt shows when the new round starts without the mouse lock');
 xe('FV.buy=0;true');await adv(100);
 const a0=xe('ammo');H.mouse(0,true);await adv(150);H.mouse(0,false);await adv(100);
 check(locked(),'1. the first click takes the lock');
 check(xe('ammo')===a0,`1. the click that takes the lock does not shoot (ammo ${a0} -> ${xe('ammo')})`);
 await adv(300);check(!hint(),'1. the prompt hides once locked');
 xe('fcd=0;true');H.mouse(0,true);await adv(120);H.mouse(0,false);await adv(100);
 check(xe('ammo')<a0,`1. the next click shoots (ammo ${a0} -> ${xe('ammo')})`);
 // 2. Esc pause / Esc resume
 xe('fcd=0;true');H.doc.pointerLockElement=null;lockEv();await adv(200);
 check(xe('paused'),'2. losing the lock (browser Esc) pauses');check(!hint(),'3. no prompt while paused');
 await adv(500);H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));H.dispatch(H.win,H.mkEvent('keyup',{key:'Escape',code:'Escape'}));await adv(600);
 check(!xe('paused'),'2. Esc resumes');check(!locked(),'setup (browser rule): the Esc-key re-lock is refused');
 check(hint(),'2. the prompt shows after an Esc resume without the lock');
 const a1=xe('ammo');H.mouse(0,true);await adv(150);H.mouse(0,false);await adv(300);
 check(locked(),'2. the first click locks');check(xe('ammo')===a1,`2. no shot on the locking click (ammo ${a1} -> ${xe('ammo')})`);check(!hint(),'2. prompt gone');
 const errs=H.errors.filter(e=>!/requestPointerLock needs a user gesture/.test(e.msg));check(!errs.length,'page errors: '+JSON.stringify(errs.slice(0,3)));
 check(!H.xErrCalls.length,'xErr toasts: '+JSON.stringify(H.xErrCalls.slice(0,3)));
 if(fails.length){console.error('FAIL test_pointer_relock\n - '+fails.join('\n - '));process.exit(1);}
 console.log('PASS test_pointer_relock: a round started after spectating and an Esc resume without the mouse lock show "click to aim"; the locking click does not shoot; no prompt while locked / buy menu / paused / spectating');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
