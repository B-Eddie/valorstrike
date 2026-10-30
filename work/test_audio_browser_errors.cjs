// Audio errors a real browser raises that the old fakes let through (user 2026-10-30 18:01 EDT: "There's a bug with the
// audio ... There was an error. Offline ... error: something" = the page's "Something broke: <msg>" toast in an offline
// match; the user's earlier audio errors were Firefox's wording). The real page (work/page_harness.cjs) runs against
// work/fake_audio.cjs strict + firefox: Web Audio calls throw what Chrome / Firefox throw, and every violation is logged
// even when a page try / catch swallows it.
//  1. decode failure: decodeAudioData(bytes, ok, err) calls err AND rejects the promise it returns (Chrome "Unable to
//     decode audio data", Firefox "The buffer passed to decodeAudioData contains an unknown content type", both
//     verified in headless Chromium / Firefox). gaDecodePump only handled the callbacks, so any download that did not
//     decode became an unhandled rejection = the "Something broke: EncodingError ..." toast. Asserted: none, the key
//     is in GA.errors, the next key still decodes.
//  2. clutch heartbeat (last alive vs 1+, xClTick): when the clutch ended mid-beat, cancelScheduledValues(t) +
//     setValueAtTime(0, t) on the heartbeat gain landed inside the running 0.42 s value curve: Firefox keeps that curve
//     and throws NotSupportedError "Can't add events during a curve event" (Chrome cancels it; verified in both). The
//     xVis wrapper swallowed it, so the Sova drone stayed ducked, the heartbeat volume was never zeroed and
//     xAbWrap skipped the frame. Asserted: no violation over clutch on / off cycles ended at every phase of the beat,
//     the heartbeat bus silent after each, the drone back on the master bus.
//  3. the master-bus limiter (a54532f) stays in the path after the clutch audio is built: xClAud used to
//     master.disconnect() and reconnect master -> lowpass -> destination, dropping the limiter for the rest of the
//     session. Asserted: no path from master to the destination that skips the compressor.
//   node work/test_audio_browser_errors.cjs
'use strict';
const {boot}=require('./page_harness.cjs');const FA=require('./fake_audio.cjs');
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(String((e&&e.message)||e)));
const fails=[];const check=(c,m)=>{if(!c)fails.push(m);};
(async()=>{
 const H=boot({real3:true,seed:5});const BAD=new Uint8Array([60,33,100,111,99]);// "<!doc": an HTML page where an mp3 was expected
 const A=FA.install(H,{strict:true,firefox:true,undecodable:b=>{const u=new Uint8Array(b);return u.length===BAD.length&&u.every((x,i)=>x===BAD[i]);}});const xe=H.xe;
 const tick=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));A.tick(Math.min(50,ms-t)/1000);await new Promise(r=>setImmediate(r));}};
 xe('ac=undefined;master=undefined;true');await tick(200);const cv=xe('renderer.domElement');
 for(const t of ['pointerdown','mousedown','mouseup','click'])H.dispatch(cv,H.mkEvent(t,{button:0}));await tick(200);
 check(A.ctx()&&A.ctx().state==='running','setup: audio unlocked by a click');
 // 1. decode failure
 {const u0=unhandled.length,x0=H.xErrCalls.length;
  H.win.__bad=BAD.buffer.slice(0);xe('GA.raw.set("ui/tick_001",window.__bad);GA.raw.set("ui/tick_002",new ArrayBuffer(64));gaDecode("ui/tick_001").catch(()=>{});gaDecode("ui/tick_002").catch(()=>{});true');
  await tick(300);await new Promise(r=>setTimeout(r,50));
  check(unhandled.length===u0,`1. an undecodable download is an unhandled rejection (the toast): ${unhandled.slice(u0).join(' | ')}`);
  check(H.xErrCalls.length===x0,`1. toast on a decode failure: ${JSON.stringify(H.xErrCalls.slice(x0))}`);
  check(/EncodingError/.test(xe('GA.errors["ui/tick_001"]||""')),'1. the failed key is recorded in GA.errors');
  check(xe('GA.buffers.has("ui/tick_002")'),'1. the next download still decodes after a failure');}
 // 2 + 3. clutch heartbeat on / off at every phase of the beat
 xe('J.pick="Sova";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true');
 for(let i=0;i<200&&!xe('!!running');i++)await tick(100);
 check(xe('!!running'),'setup: offline 5v5 running');
 xe('window.__god=setInterval(()=>{try{if(player){player.hp=1000;}for(const b of bots){b.cd=1e9;b.hp=Math.max(b.hp,1)}}catch(e){}},20);FV.buy=0;true');await tick(300);
 const v0=A.violations.length;let cycles=0,offs=[];
 const env=()=>xe('XCL.env&&XCL.env.gain');
 for(let k=0;k<10;k++){
  xe('for(const a of allies){a.alive=false;a.hp=0;}true');await tick(300);// clutch on: you are the last alive
  if(k===0)check(xe('XCL.on===true&&!!XCL.lp'),'setup: clutch on (last alive vs 1+)');
  // a Sova drone running so the ambience duck is exercised
  if(k===0){xe('AB.drone();clearInterval(abDr.i);true');} // its own stop interval needs a flying drone (J.dr; the camera would follow it): kept alive by hand
  // wait for a beat, then end the clutch k/10 of the way through the 0.92 s cycle (inside the 0.42 s curve for k<5)
  const g=env();const last=()=>{const e=(g&&g._e)||[];const c=e.filter(x=>x.d);return c.length?c[c.length-1].t:null;};
  let c0=null;for(let i=0;i<60&&c0==null;i++){await tick(20);c0=last();}
  const now=()=>A.ctx().currentTime;while(now()<c0+0.092*k)await tick(10);
  xe('allies[0].alive=true;allies[0].hp=100;true');await tick(60);cycles++;
  offs.push(xe('JSON.stringify({on:XCL.on,dr:!!XCL.dr})'));
  check(xe('XCL.on')===false,`2. cycle ${k}: clutch did not end`);
  {const ev=xe('JSON.stringify((XCL.vol.gain._e||[]).filter(e=>e.v!=null))'),E=JSON.parse(ev),t=now()+0.5,past=E.filter(e=>e.t<=t);check(past.length&&past[past.length-1].v===0,`2. cycle ${k}: the heartbeat volume is not back to 0 after the clutch (${JSON.stringify(past.slice(-2))})`);}
  check(xe('XCL.dr')===null,`2. cycle ${k} (${(0.092*k).toFixed(2)} s into the beat): the drone stayed on the ducked ambience bus`);
 }
 const vio=A.violations.slice(v0);if(process.env.DBGV){const by={};for(const v of vio){const k=v.m.slice(0,60)+" @ "+v.s.split(" | ").slice(0,9).join(" < ");by[k]=(by[k]||0)+1;}console.log(JSON.stringify(by,null,1));}
 check(vio.length===0,`2. ${vio.length} Web Audio violations ending the clutch mid-beat (Firefox throws them): ${[...new Set(vio.map(v=>v.m))].join(' | ')} @ ${vio[0]&&vio[0].s}`);
 // 3. limiter in the path
 {const bad=xe(`(()=>{const comp=master.outs.find(n=>n&&n.kind==='comp')||null;const seen=new Set();const go=n=>{if(!n||seen.has(n))return false;seen.add(n);if(n===ac.destination)return true;if(n.kind==='comp')return false;return (n.outs||[]).some(go);};return go(master);})()`);
  check(!bad,'3. after the clutch audio is built a path from master reaches the destination without the limiter');
  check(xe('!!XCL.lp'),'3. setup: clutch audio built');}
 check(unhandled.length===0,'unhandled rejections: '+unhandled.join(' | '));{const pe=H.errors.filter(e=>e.phase!=='load');check(pe.length===0,'page errors: '+JSON.stringify(pe.slice(0,3)));}
 if(fails.length){console.log('FAIL\n - '+fails.join('\n - '));process.exit(1);}
 console.log(`PASS audio browser errors: decode failure handled (no toast); ${cycles} clutch on / off cycles across the beat with no Firefox automation error, drone unducked; limiter kept after the clutch bus`);process.exit(0);
})().catch(e=>{console.log('FAIL harness',e&&e.stack);process.exit(1);});
