// Audio unlock / resume regression (user 2026-10-26 17:25: "no sounds" on computer and iPhone, iPhone showed
// "failed to start audio device"). The real page (page_harness) runs against work/fake_audio.cjs, a Web Audio fake with
// a browser's autoplay rules: a context only starts / resumes inside a user gesture. Two browsers:
//  - iOS Safari (WebKit): resume() outside a gesture REJECTS with "Failed to start the audio device"; pointerdown /
//    touchstart are not audio gestures (touchend / click / keydown are); the context can go 'interrupted' (call, Siri,
//    lock screen); the first context construction throws and the first in-gesture resume is refused.
//  - Chrome: resume() outside a gesture stays pending; every gesture counts.
// Asserts: no unhandled rejection or page exception anywhere; the sound button starts audio; a refused start / resume is
// retried on the next tap; 'interrupted' and 'suspended' (after the page was hidden) come back on the next tap (touchend
// on the game canvas); sounds are heard (sources reaching the destination while running) after each recovery; nothing
// downloaded is queued while the context is not running (no burst on resume).
//   node work/test_audio_unlock.cjs
'use strict';
const {boot}=require('./page_harness.cjs');const FA=require('./fake_audio.cjs');
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(String((e&&e.message)||e)));
const fails=[];const check=(c,m)=>{if(!c)fails.push(m);};
async function run(name,opt){
 const H=boot({real3:false,seed:3,coarse:!!opt.webkit});const A=FA.install(H,opt);const xe=H.xe;
 const tick=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));A.tick(Math.min(50,ms-t)/1000);await new Promise(r=>setImmediate(r));}};
 const e0=H.errors.length,u0=unhandled.length;xe('ac=undefined;master=undefined;true');await tick(300);
 const cv=xe('renderer.domElement');
 const tap=async el=>{for(const t of ['pointerdown','touchstart','touchend','pointerup','mousedown','mouseup'])H.dispatch(el,H.mkEvent(t,{touches:[],changedTouches:[{identifier:1,clientX:100,clientY:100}]}));await tick(60);};
 const touchOnly=async el=>{for(const t of ['pointerdown','touchstart','touchend','pointerup'])H.dispatch(el,H.mkEvent(t,{touches:[],changedTouches:[{identifier:1,clientX:100,clientY:100}]}));await tick(60);}; // in-game touch controls: no click follows
 const state=()=>{const c=A.ctx();return c?c.state:'none';};
 const heard=async()=>{const a0=A.audible;xe('try{SFX.low()}catch(e){};try{SFX.empty()}catch(e){};try{blip(500,0.05)}catch(e){};true');await tick(60);return A.audible-a0;};
 // 1. default-on sound: the first tap unlocks audio without toggling it off. If a future persisted setting starts
 // muted, use the button once to enable it and still assert the same contract.
 const b=H.$('sndBtn');if(xe('S.muted')){await tap(b);H.dispatch(b,H.mkEvent('click'));}else{await tap(cv);}await tick(200);
 check(xe('S.muted')===false,`${name}: sound did not remain enabled by default`);
 if(opt.rejectFirst)check(state()!=='running',`${name}: fake did not refuse the first start (test setup)`);
 // 2. a refused start is retried on the next tap (iOS: a touch on the game canvas, no click)
 await touchOnly(cv);
 check(state()==='running',`${name}: context not running after the next tap (state ${state()}, resume calls ${A.resumeCalls}, contexts ${A.contexts.length})`);
 check(JSON.stringify(xe('master.outs.map(n=>n.kind)'))==='["comp"]',`${name}: master bus limiter is missing`);
 check(await heard()>0,`${name}: no sound heard after unlock`);
 // 3. 'interrupted' (iOS call / Siri / lock screen): no sound queued while interrupted, back on the next tap
 xe('GA.buffers.set("ui/tick_001",ac.createBuffer(1,4800,48000));true');const p0=xe('GA.plays');
 A.ctx().interrupt();await tick(100);for(let i=0;i<5;i++){xe('try{SFX.low()}catch(e){};true');await tick(50);}
 check(xe('GA.plays')===p0,`${name}: downloaded sounds started while the context was interrupted (${xe('GA.plays')-p0}; they burst out on resume)`);
 await touchOnly(cv);
 check(state()==='running',`${name}: still ${state()} after a tap following an interruption`);
 check(await heard()>0,`${name}: no sound after the interruption`);
 // 4. page hidden (app switch / lock) and shown again: the outside-gesture resume may be refused; never thrown; next tap restores it
 H.doc.hidden=true;H.dispatch(H.doc,H.mkEvent('visibilitychange'));await tick(100);
 check(state()==='suspended',`${name}: context not suspended while hidden (${state()})`);
 H.doc.hidden=false;H.dispatch(H.doc,H.mkEvent('visibilitychange'));await tick(100);
 for(let i=0;i<10;i++){xe('try{SFX.low();SFX.empty()}catch(e){};true');await tick(100);} // game sounds while not yet resumed
 await touchOnly(cv);
 check(state()==='running',`${name}: context not running after a tap following hide / show (${state()})`);
 check(await heard()>0,`${name}: no sound after hide / show`);
 // 5. keyboard gesture (desktop) after a suspension
 if(!opt.webkit){H.doc.hidden=true;H.dispatch(H.doc,H.mkEvent('visibilitychange'));await tick(50);H.doc.hidden=false;H.dispatch(H.doc,H.mkEvent('visibilitychange'));await tick(50);
  H.key('KeyW',true);H.key('KeyW',false);await tick(60);check(state()==='running',`${name}: keydown did not resume (${state()})`);}
 check(A.contexts.length===1,`${name}: ${A.contexts.length} AudioContexts created (want exactly one)`);
 const errs=H.errors.slice(e0),un=unhandled.slice(u0);
 check(!errs.length,`${name}: page exceptions ${JSON.stringify(errs.slice(0,4)).slice(0,600)}`);
 check(!un.length,`${name}: unhandled promise rejections (the page's "Something broke" toast): ${JSON.stringify([...new Set(un)])}`);
 return {resumeCalls:A.resumeCalls,refused:A.refused,audible:A.audible};
}
(async()=>{
 const ios=await run('iOS Safari',{webkit:true,gestures:['touchend','click','keydown','mouseup'],ctorThrows:1,rejectFirst:1});
 const chrome=await run('Chrome',{});
 if(fails.length){console.error('FAIL\n'+fails.join('\n'));process.exit(1);}
 console.log(`Audio unlock: iOS Safari (refused start retried, interrupted + hidden contexts resumed on the next touchend, ${ios.refused} outside-gesture refusals caught, no toast) and Chrome (gesture / keydown resume) - one AudioContext, sounds heard after every recovery`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
