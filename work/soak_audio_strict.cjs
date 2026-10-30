// Audio error soak (tool) on the real page (work/page_harness.cjs native: Ascent nav + collision, real three.js) against
// work/fake_audio.cjs in STRICT + FIREFOX mode (Gecko automation-timeline rules too): AudioParam / connect / start / stop throw what Chrome and Firefox throw
// (non-finite values, an exponential ramp to 0, negative times, connect to a non-node or another context's node, start
// twice, stop before start). User 2026-10-30 18:01 EDT: "There's a bug with the audio ... There was an error. Offline ...
// error: something" = the page's "Something broke: <msg>" toast (window.xErr) in an offline match since sound became
// on by default (a54532f: every synthesized path now runs for everyone).
// Offline 5v5, sound unlocked by a click, for each agent: buy, swap, fire, reload, abilities, bots fighting (remote
// gunfire, footsteps, damage), clutch, hidden / visible, volume, mute / unmute, plant, detonation, defuse, death, round
// and match end, play again; with the downloaded audio decoded (GA path) and without it (synthesized fallback: offline,
// blocked or not yet decoded).
// Asserts: no window.xErr call, no page exception, no unhandled rejection; no strict Web Audio violation anywhere (also
// ones a page try / catch swallowed: each is a sound that silently failed).
//   node work/soak_audio_strict.cjs        (a tool, not in test_all: minutes per agent; AGENTS=Jett,Sova,... SEED=3 GA=1|0|both)
'use strict';
const {boot}=require('./page_harness.cjs');const FA=require('./fake_audio.cjs');const fs=require('fs'),path=require('path');
const SEED=+(process.env.SEED||3),AGENTS=(process.env.AGENTS||'Jett,Sova,Phoenix,Sage,Omen,Killjoy').split(','),MODES=process.env.GA==='1'?[1]:process.env.GA==='0'?[0]:[0,1];
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(String((e&&e.stack)||e).slice(0,400)));
const fails=[];
(async()=>{
 for(const ga of MODES){
 const H=boot({real3:true,seed:SEED,native:true}),xe=H.xe,A=FA.install(H,{strict:true,firefox:true});
 const adv=async ms=>{for(let t=0;t<ms;t+=50){const d=Math.min(50,ms-t);H.advance(d-1e-6);A.tick(d/1000);await new Promise(r=>setImmediate(r));}};
 const e0=H.errors.length,x0=H.xErrCalls.length;const step=[];let cur='boot';
 const mark=n=>{cur=n;const v=A.violations.length,e=H.errors.length,x=H.xErrCalls.length;step.push({n,v,e,x});};
 xe('ac=undefined;master=undefined;true');await adv(300);
 const cv=xe('renderer.domElement');for(const t of ['pointerdown','mousedown','mouseup','click'])H.dispatch(cv,H.mkEvent(t,{button:0}));await adv(300);
 if(xe('S.muted'))fails.push('sound muted by default');if(!A.ctx()||A.ctx().state!=='running')fails.push('audio not unlocked by a click');
 // the downloaded audio decoded: every manifest file as a fake buffer (the harness page has no fetch of its own files)
 const preload=()=>xe('GA.limit=1e12;for(const k in GA.manifest.files)if(!GA.buffers.has(k)){const f=GA.manifest.files[k];GA.buffers.set(k,ac.createBuffer(1,Math.max(1,Math.round((f.duration||.5)*48000)),48000));}true');
 if(ga)preload();
 xe(`window.__qa={god(){if(player){player.hp=Math.max(player.hp,1000);player.armor=50;}},
  ring(p,r,a){for(let k=0;k<16;k++){const t=a+(k%2?1:-1)*Math.floor((k+1)/2)*0.25,x=p.x+Math.sin(t)*r,z=p.z+Math.cos(t)*r,y=p.y||0;const gy=groundAt(x,z,0.5,y+1);if(Math.abs(gy-y)>1.2)continue;if(!blocked(x,z,0.45,gy))return [x,gy,z];}return null;},
  aimAt(b){const q=b.g.position,dx=q.x-player.x,dz=q.z-player.z,dy=(q.y||0)+1.2-((player.y||0)+1.6);yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));}};true`);
 const key=(c,ms=80)=>{H.key(c,true);return adv(ms).then(()=>H.key(c,false));};
 for(const AG of AGENTS){
  mark(AG+' start');xe(`J.pick=${JSON.stringify(AG)};FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true`);
  for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
  if(ga)preload();await adv(1500);
  mark(AG+' buy');await key('KeyB');xe('try{fBuy("Vandal");fBuy("Ghost");fBuy("Heavy Shields")}catch(e){}true');await key('KeyB');xe('FV.buy=0.02;true');await adv(800);
  mark(AG+' swap');for(const k of ['Digit2','Digit3','Digit1']){await key(k);await adv(700);}
  mark(AG+' fire');xe('(()=>{const b=bots.find(x=>x.alive);if(b){const s=__qa.ring(player,9,0.7);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.aimAt(b);}__qa.god();return 1})()');H.mouse(0,true);await adv(700);H.mouse(0,false);
  mark(AG+' reload');await key('KeyR');await adv(2600);mark(AG+' inspect');await key('KeyY');await adv(1200);
  mark(AG+' bots fight');xe('__qa.god();window.__gT=setInterval(()=>{try{__qa.god()}catch(e){}},100);true');await adv(7000);
  for(const k of ['KeyC','KeyQ','KeyE','KeyX']){mark(AG+' abil '+k);xe('(()=>{const M=K().mx;J.c=Math.max(J.c|0,M.c||1);J.q=Math.max(J.q|0,M.q||1);J.e=Math.max(J.e|0,M.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};return 1})()');await key(k);await adv(450);H.mouse(0,true);await adv(60);H.mouse(0,false);await adv(700);H.mouse(0,true);await adv(60);H.mouse(0,false);await adv(1500);await key('Digit1');await adv(300);}
  mark(AG+' clutch');xe('for(const a of allies)if(a.alive){a.hp=1;try{hurt(a,999,bots[0].name)}catch(e){a.alive=false}}true');await adv(3000);
  mark(AG+' hidden');xe('Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));true');await adv(800);
  xe('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"));true');for(const t of ['pointerdown','mousedown','click'])H.dispatch(cv,H.mkEvent(t,{button:0}));await adv(800);
  mark(AG+' volume');xe('(()=>{const v=$("sVol");for(const x of [0,35,100,70]){v.value=String(x);v.oninput&&v.oninput({target:v});}return 1})()');await adv(300);
  mark(AG+' mute');xe('$("sndBtn").onclick()');await adv(1500);xe('$("sndBtn").onclick()');await adv(1500);
  mark(AG+' plant');xe('clearInterval(window.__gT);__qa.god();(()=>{const s=FV.sp;s.st="carry";s.c=player;s.pt=0;let best=null;for(let gx=-80;gx<=80&&!best;gx+=2)for(let gz=-80;gz<=80;gz+=2){if(inSite({x:gx,z:gz})&&!blocked(gx,gz,0.5,0)){best=[gx,gz];break;}}if(best){player.x=best[0];player.z=best[1];player.y=groundAt(best[0],best[1],0.3,5);player.vx=player.vz=0;}keys.Digit4=true;return 1})()');
  for(let i=0;i<100;i++){xe('keys.Digit4=true;__qa.god();true');await adv(50);}xe('keys.Digit4=false;true');await adv(2000);
  mark(AG+' detonate');xe('if(FV.sp.st==="plant")FV.sp.t=0.03;true');await adv(9000);
  mark(AG+' defuse');xe('(()=>{if(!running)return 0;FV.buy=0.02;const s=FV.sp;const d=bots.find(b=>b.alive);s.st="plant";s.t=30;s.x=player.x+1;s.z=player.z;s.y=player.y||0;s.dt=6.9;if(d){d.g.position.set(s.x+0.5,s.y,s.z);d.g.updateMatrixWorld(true);s.du=d;d.h4=1;}return 1})()');await adv(9000);
  mark(AG+' death');xe('(()=>{if(!running)return 0;FV.buy=0;const b=bots.find(x=>x.alive);player.hp=1;player.armor=0;hurt(player,999,b?b.name:"Bot");if(player.hp>0)pDie(b?b.name:"Bot","Vandal");return 1})()');await adv(4000);
  mark(AG+' spectate');H.mouse(0,true);await adv(60);H.mouse(0,false);await adv(8000);
  mark(AG+' match end');for(let i=0;i<60&&!xe('running');i++)await adv(200);xe('FV.you=FIVE_WIN-1;if(running)fCheck(true,"QA");true');await adv(3500);
  mark(AG+' play again');if(H.shown('result'))xe('$("againBtn").onclick()');await adv(2500);
  mark(AG+' lobby');xe('$("lobbyBtn").onclick()');await adv(500);
 }
 mark('end');
 const tag=ga?'GA':'synth';
 const vio=A.violations;const by={};for(const v of vio){const k=v.m.slice(0,90)+' @ '+v.s.split(' | ')[0];by[k]=(by[k]||0)+1;}
 const stepOf=i=>{let s='boot';for(const x of step)if(x.v<=i)s=x.n;return s;};
 console.log(`[${tag}] plays ${xe('GA.plays')} started ${A.started} audible ${A.audible}; GA.errors ${JSON.stringify(xe('GA.errors')).slice(0,400)}`);
 for(const k in by)console.log(`[${tag}] VIOLATION x${by[k]}: ${k}`);
 for(let i=0;i<Math.min(vio.length,8);i++)console.log(`[${tag}]  #${i} in "${stepOf(i)}": ${vio[i].m.slice(0,100)}\n      ${vio[i].s}`);
 const ex=H.errors.slice(e0),xc=H.xErrCalls.slice(x0);
 for(const e of ex.slice(0,8))console.log(`[${tag}] PAGE ERROR`,JSON.stringify(e).slice(0,500));for(const e of xc.slice(0,8))console.log(`[${tag}] xErr`,JSON.stringify(e).slice(0,400));
 if(vio.length)fails.push(`[${tag}] ${vio.length} strict Web Audio violations (${Object.keys(by).length} kinds)`);
 if(ex.length)fails.push(`[${tag}] ${ex.length} page errors`);if(xc.length)fails.push(`[${tag}] ${xc.length} xErr toasts: ${[...new Set(xc.map(x=>x.msg))].slice(0,4).join(' | ')}`);
 if(!(xe('GA.plays')>(ga?20:-1)))fails.push(`[${tag}] downloaded audio barely played (${xe('GA.plays')})`);if(!(A.audible>200))fails.push(`[${tag}] too few sounds heard (${A.audible})`);
 }
 if(unhandled.length)fails.push(unhandled.length+' unhandled rejections: '+unhandled.slice(0,3).join(' | '));
 if(fails.length){console.log('FAIL\n - '+fails.join('\n - '));process.exit(1);}
 console.log('PASS audio strict soak: '+AGENTS.join(', ')+' x '+MODES.map(m=>m?'downloaded audio':'synthesized fallback').join(' + ')+'; no toast, page error, unhandled rejection or Web Audio violation');process.exit(0);
})().catch(e=>{console.log('FAIL harness',e&&e.stack);process.exit(1);});
