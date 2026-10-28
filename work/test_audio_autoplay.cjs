// No AudioContext before the first user gesture (user 2026-10-28, Firefox console on the live page: "An AudioContext was
// prevented from starting automatically. It must be created or resumed after a user gesture on the page."). The page
// (page_harness + work/fake_audio.cjs) plays its synthesized / downloaded sounds during boot and the lobby without any
// input: no context may be constructed then (sounds are skipped), and the first real activation (keydown / mousedown /
// pointerdown / touchend / click) creates exactly one context inside the gesture, running, and sounds are heard. A
// touchstart / pointerup (mouse) / mouseup is not a user activation and must not create it either.
//   node work/test_audio_autoplay.cjs
'use strict';
const {boot}=require('./page_harness.cjs');const FA=require('./fake_audio.cjs');const assert=require('node:assert/strict');
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(String((e&&e.message)||e)));
(async()=>{
 const H=boot({real3:false,seed:5});const A=FA.install(H,{});const xe=H.xe,e0=H.errors.length;
 const tick=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));A.tick(0.05);await new Promise(r=>setImmediate(r));}};
 xe('ac=undefined;master=undefined;S.muted=false;true');await tick(200);
 // sounds with no gesture yet: lobby / boot paths
 xe('try{blip(500,0.05)}catch(e){};try{SFX.low()}catch(e){};try{sOk()}catch(e){};try{audio()}catch(e){};try{xGameAudio.play("ui/tick_001")}catch(e){};true');await tick(300);
 assert.equal(A.contexts.length,0,'no AudioContext constructed before a user gesture (got '+A.contexts.length+', '+A.ctorOutside+' outside a gesture)');
 // non-activating input: touchstart / mouseup
 const cv=xe('renderer.domElement');H.dispatch(cv,H.mkEvent('touchstart',{touches:[],changedTouches:[{identifier:1,clientX:5,clientY:5}]}));H.dispatch(cv,H.mkEvent('mouseup'));await tick(100);
 xe('try{blip(500,0.05)}catch(e){};true');await tick(100);
 assert.equal(A.contexts.length,0,'touchstart / mouseup are not user activations: still no context');
 // first activation: a key press
 H.key('KeyW',true);H.key('KeyW',false);await tick(100);
 assert.equal(A.contexts.length,1,'exactly one context after the first keydown');assert.equal(A.ctorOutside,0,'constructed inside the gesture');
 assert.equal(A.ctx().state,'running','running after the gesture');
 const a0=A.audible;xe('try{blip(500,0.05)}catch(e){};try{SFX.low()}catch(e){};true');await tick(100);assert(A.audible>a0,'sounds heard after the gesture');
 xe('try{blip(500,0.05)}catch(e){};true');await tick(100);assert.equal(A.contexts.length,1,'still one context');
 assert.deepEqual(H.errors.slice(e0),[],'no page exceptions: '+JSON.stringify(H.errors.slice(e0)).slice(0,600));assert.deepEqual(unhandled,[],'no unhandled rejections');
 console.log('Audio autoplay: no AudioContext before the first user activation (boot / lobby sounds skipped, touchstart / mouseup ignored); first keydown creates one running context inside the gesture; sounds heard');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
