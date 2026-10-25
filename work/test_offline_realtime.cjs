// Offline game time follows the real clock at any frame rate (browser-found: at SwiftShader frame rates a 45 s buy phase
// did not end within 180 s, because every frame advanced the game by at most the 50 ms physics cap).
// Boots the real page (work/page_harness.cjs) and drives its own rAF loop at 1, 5 and 20 fps:
//  - buy phase, round clock, Spike fuse and player plant progress advance by the real elapsed time (+-3 %)
//  - movement still substeps (a 1 s frame = 20 steps of 50 ms, never one 1 s physics step)
//  - a hidden tab's span is not game time; a single stalled frame counts at most XRT.max (2.5 s)
//  - deathmatch respawn and the death cam run on real time too
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:3}),xe=H.xe,fails=[],out=[],errs0=H.errors.length,x0=H.xErrCalls.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const run=async(fps,secs)=>{const f=1000/fps;for(let t=0;t<secs*1000-1e-6;t+=f){H.frameMs(f);if((t/f)%5===0)await new Promise(r=>setImmediate(r));}};
const near=(name,got,want,tol)=>{out.push(`${name} ${(+got).toFixed(2)} (want ${want.toFixed(2)})`);if(!(Math.abs(got-want)<=tol))fails.push(`${name}: ${(+got).toFixed(3)} not ${want.toFixed(3)} +- ${tol}`);};
const through=async()=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
// No AI: bots and allies become online-driven puppets (b.nt) so nobody ends the round while the clocks are measured.
const freeze='for(const b of bots)b.nt=true;for(const a of allies)a.nt=true;player.hp=100;true';
(async()=>{
 xe('FV.pick="split";window.xQPick="split";try{mpSet("split")}catch(e){}true');
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe(freeze);xe('FV.buy=45;true');
 // buy phase at 1 / 5 / 20 fps
 for(const [fps,secs] of [[1,10],[5,10],[20,10]]){const b0=xe('FV.buy');xe('typeof XRT!=="undefined"&&(XRT.n=0);true');await run(fps,secs);near(`buy phase ${fps} fps, ${secs} s`,b0-xe('FV.buy'),secs,secs*0.03);
  if(fps===1&&xe('typeof XRT!=="undefined"?XRT.n:0')!==20)fails.push(`a 1 s frame ran ${xe('typeof XRT!=="undefined"?XRT.n:0')} sim steps, not 20 of 50 ms`);}
 await run(1,16);if(!(xe('FV.buy')===0))fails.push('buy phase did not end after 46 s of real time at 1-20 fps (FV.buy '+xe('FV.buy')+')');
 // round clock
 for(const fps of [1,5,20]){xe(freeze);const t0=xe('timeLeft');await run(fps,6);near(`round clock ${fps} fps, 6 s`,t0-xe('timeLeft'),6,0.2);}
 // player plant progress: carrier in a site holding 4, standing still
 for(const fps of [1,5,20]){
  xe(`${freeze};const s=FV.sp,k=Object.keys(SITES)[0];player.x=SITES[k][0];player.z=SITES[k][1];player.vx=player.vz=0;s.st="carry";s.c=player;s.pt=0;since=1;keys.Digit4=true;true`);
  await run(fps,2);const pt=xe('FV.sp.pt'),st=xe('FV.sp.st');xe('keys.Digit4=false;true');
  if(st!=='carry')fails.push(`plant ${fps} fps: state ${st}`);else near(`plant progress ${fps} fps, 2 s`,pt,2,0.12);}
 // Spike fuse after a plant
 for(const fps of [1,5,20]){xe(`${freeze};const s=FV.sp;s.st="plant";s.t=45;s.dt=0;s.x=player.x+30;s.z=player.z;timeLeft=45;true`);await run(fps,5);near(`spike fuse ${fps} fps, 5 s`,45-xe('FV.sp.t'),5,0.2);}
 // hidden tab: 30 s hidden is not game time; first frame back counts one step
 {xe(`${freeze};FV.sp.t=45;true`);const t0=xe('FV.sp.t');H.doc.hidden=true;await run(1,30);H.doc.hidden=false;H.frameMs(1000);near('fuse across a 30 s hidden tab + 1 frame',t0-xe('FV.sp.t'),0.05,0.01);}
 // stall: one 10 s frame counts XRT.max
 {const t0=xe('FV.sp.t');H.frameMs(10000);near('fuse across one 10 s stalled frame',t0-xe('FV.sp.t'),2.5,0.01);}
 // deathmatch: respawn on real time at 1 fps
 H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);H.$('xHome').click();await adv(300);
 xe('FV.pick="ascent";window.xQPick=null;true');H.$('dmBtn').click();await adv(50);assert.ok(await through(),'DM did not start');
 xe('for(const b of bots)b.nt=true;true');
 const dmT0=xe('timeLeft');await run(1,5);near('DM clock 1 fps, 5 s',dmT0-xe('timeLeft'),5,0.2);
 xe('player.hp=0;DM.prt=0;true'); // the page's 1.5 s DM respawn
 let back=-1;for(let s=1;s<=12;s++){await run(1,1);if(xe('player.hp')>0){back=s;break;}}
 out.push('DM respawn at 1 fps after '+back+' s');if(back<0||back>2)fails.push('DM respawn (1.5 s) took '+back+' s of real time at 1 fps');
 {const e=H.errors.slice(errs0),x=H.xErrCalls.slice(x0);if(e.length||x.length)fails.push('page exceptions: '+JSON.stringify({e:e.slice(0,4),x:x.slice(0,4)}));}
 if(process.env.VERBOSE||fails.length)console.log(out.join('\n'));
 if(fails.length){console.error(fails.join('\n'));process.exit(1);}
 console.log('Offline real-time clocks (1/5/20 fps): buy phase, round clock, plant progress, Spike fuse and DM clock follow real time within 3 %; a 1 s frame = 20 physics steps; hidden tab / stalled frame guarded; DM respawn on real time at 1 fps');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
