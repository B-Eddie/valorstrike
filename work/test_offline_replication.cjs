// Offline Replication (modes-2) on the real page (audit.js fake DOM): the REPLICATION queue card starts a 5v5 vs bots where
// your team all plays your agent and the bots all play one other agent (10 distinct names, models / kits / portraits read the
// replicated agent through xAgOf / xAg), first to 5 with the swap after 4, 80 s rounds, 45 s buy on the first round of each
// half, credits SET every round of a half regardless of the result (900 / 2400 / 3900 / 6000, the 4-4 decider 6000), guns
// and armour reset every round (a bought Phantom does not carry), basic + signature charges full each round, the HUD /
// result say Replication, Play again replays Replication, and any other start (plain 5v5) gets the agent-named roster back.
//   node work/test_offline_replication.cjs
const fs=require('fs'),path=require('path');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
const log=console.log;console.log=()=>{};
const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,doc,context,errors,xErrCalls,advance,mkEvent,dispatch,setPhase:p=>{phase=p;}};')(require,__dirname,process,module);
console.log=log;
const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||11);
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
require('vm').runInContext(`Math.random=(${mulberry})(${SEED*7919+3});`,H.context);
(async()=>{
 const xe=code=>require('vm').runInContext('__xe',H.context)(code);
 H.win.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 const errs0=H.errors.length,x0=H.xErrCalls.length,fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};
 const step=async ms=>{for(let t=0;t<ms;t+=50)H.advance(50);};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return true;await step(50);}fail('timed out: '+what);return false;};
 // ---- queue card: REPLICATION tab + card start through xGo / the loading gate
 const tab=xe('!!document.querySelector(\'.x-qtabs [data-q="rep"]\')&&!!document.getElementById("repBtn")');if(!tab)fail('no REPLICATION queue tab / card');
 xe('J.pick="Sova";FV.pick="ascent";window.xQPick=null;true');
 H.doc.getElementById('repBtn').click();
 await until(()=>xe('mode==="five"&&!!FV.rep&&running'),20000,'Replication start from the card');
 const st=()=>xe(`(()=>{const ag=b=>xAg(b)||xAgOf(b.name);return {rep:!!FV.rep,sw:!!FV.sw,xm:$("game").dataset.xMode,xw:$("game").dataset.xWin,repA:FV.repA,
   mates:F_MATES.slice(),en:F_EN.slice(),aAg:allies.map(ag),bAg:bots.map(ag),aOf:F_MATES.map(n=>xAgOf(n)),eOf:F_EN.map(n=>xAgOf(n)),
   cr:FV.cr,bs:Object.fromEntries(Object.entries(FV.bs).map(([n,s])=>[n,[s.cr,s.w,s.arm]])),t:timeLeft,buy:FV.buy,you:FV.you,them:FV.them,pri:FV.pri,sec:FV.sec,arm:FV.arm,
   jc:[J.c,J.q,J.e],mx:K().mx,hud:(document.getElementById("hud")||{}).textContent||""};})()`);
 let S=st();
 if(!S.rep||!S.sw||S.xm!=='rep'||S.xw!=='5')fail('mode flags '+JSON.stringify({rep:S.rep,sw:S.sw,xm:S.xm,xw:S.xw}));
 if(!S.repA||S.repA[0]!=='Sova'||!S.repA[1]||S.repA[1]==='Sova')fail('team agents '+JSON.stringify(S.repA));
 const E=S.repA&&S.repA[1];
 if(S.aAg.length!==4||S.aAg.some(a=>a!=='Sova')||S.aOf.some(a=>a!=='Sova'))fail('allies not all Sova '+JSON.stringify(S.aAg)+JSON.stringify(S.aOf));
 if(S.bAg.length!==5||S.bAg.some(a=>a!==E)||S.eOf.some(a=>a!==E))fail('bots not all '+E+' '+JSON.stringify(S.bAg));
 if(new Set(['You',...S.mates,...S.en]).size!==10)fail('names not distinct '+JSON.stringify([S.mates,S.en]));
 if(S.t!==80||S.buy!==45)fail(`round 1 timers ${S.t} s / buy ${S.buy} s (want 80 / 45)`);
 if(S.cr!==900)fail('round 1 credits '+S.cr);
 for(const [n,[c,w,a]] of Object.entries(S.bs)){if(c<0||c>900)fail(`bot ${n} round 1 credits ${c}`);}
 const kitFull=s=>{const M=s.mx||{};return s.jc[0]===(M.c||0)&&s.jc[1]===(M.q||0)&&(!M.e||s.jc[2]===M.e);};
 if(!kitFull(S))fail('round 1 kit not full '+JSON.stringify([S.jc,S.mx]));
 // ---- buy a Phantom + heavy armour, win the round: next round credits 2400 regardless, gun / armour gone
 xe('FV.cr=9000;FV.pri="Phantom";FV.arm=50;slots.pri={ammo:30,rsv:90};FV.buy=0;true');await step(200);
 const win=async()=>{const r0=xe('FV.you+FV.them');xe('bots.forEach(b=>b.alive&&kill(b,false));true');await until(()=>xe('FV.you+FV.them')===r0+1,6000,'round end');await until(()=>xe('FV.buy>0&&running'),15000,'next round');};
 const lose=async()=>{const r0=xe('FV.you+FV.them');xe('fCheck(false,"Bots win");true');await until(()=>xe('FV.you+FV.them')===r0+1,8000,'round lost');await until(()=>xe('FV.buy>0&&running'),15000,'next round');};
 await win();S=st();
 if(S.you!==1||S.cr!==2400||S.pri!==null||S.sec!=='Classic'||S.arm!==0)fail('round 2 after a win: '+JSON.stringify({you:S.you,cr:S.cr,pri:S.pri,sec:S.sec,arm:S.arm}));
 if(S.t!==80||S.buy!==30)fail(`round 2 timers ${S.t} / ${S.buy}`);
 if(!kitFull(S))fail('round 2 kit not full '+JSON.stringify(S.jc));
 if(Object.values(S.bs).some(([c])=>c>2400))fail('round 2 bot credits over 2400 '+JSON.stringify(S.bs));
 if(!/Replication/.test(S.hud)&&VERBOSE)console.log('hud',S.hud);
 xe('FV.buy=0;true');await step(100);await lose();S=st();
 if(S.them!==1||S.cr!==3900)fail('round 3 after a loss: credits '+S.cr+' score '+S.you+'-'+S.them);
 xe('FV.buy=0;true');await step(100);await win();S=st();
 if(S.cr!==6000)fail('round 4 credits '+S.cr);
 // ---- swap after 4: round 5 is the first of the second half: 900, 45 s buy, still the same agents
 xe('FV.buy=0;true');await step(100);await win();S=st();
 if(S.you+S.them!==4||S.cr!==900||S.buy!==45)fail('round 5 (second half) '+JSON.stringify({r:S.you+S.them,cr:S.cr,buy:S.buy}));
 if(S.aAg.some(a=>a!=='Sova')||S.bAg.some(a=>a!==E))fail('agents changed at the swap');
 // ---- 4-4 decider: 6000
 xe('FV.you=4;FV.them=3;FV.buy=0;true');await step(100);await lose();S=st();
 if(S.you!==4||S.them!==4||S.cr!==6000)fail('4-4 decider credits '+S.cr+' at '+S.you+'-'+S.them);
 xe('FV.buy=0;true');await step(100);{const r0=xe('FV.you+FV.them');xe('bots.forEach(b=>b.alive&&kill(b,false));true');await until(()=>xe('FV.you+FV.them')===r0+1,6000,'decider end');}
 await step(5000);
 {const R=xe('({res:document.getElementById("result").style.display,t:document.getElementById("resTitle").textContent,x:document.getElementById("resText").textContent})');
  if(R.res!=='flex'||R.t!=='Victory'||!/REPLICATION/.test(R.x)||!/5/.test(R.x))fail('match end '+JSON.stringify(R));}
 // ---- Play again: Replication again from 0-0
 H.doc.getElementById('againBtn').click();
 await until(()=>xe('mode==="five"&&!!FV.rep&&running&&FV.you+FV.them===0&&$("result").style.display==="none"'),20000,'play again');
 S=st();if(!S.rep||S.cr!==900||S.aAg.some(a=>a!=='Sova'))fail('play again not Replication '+JSON.stringify({rep:S.rep,cr:S.cr,aAg:S.aAg}));
 // ---- a plain 5v5 afterwards: agent-named roster, no Replication rules
 xe('running=false;FV.pick="ascent";window.xSwift=false;xGo(startFive);true');
 await until(()=>xe('mode==="five"&&running'),20000,'plain 5v5');
 S=st();
 if(S.rep||S.sw||S.xm!=='five')fail('plain 5v5 still flagged '+JSON.stringify({rep:S.rep,sw:S.sw,xm:S.xm}));
 if(S.mates.some(n=>/ \d$/.test(n))||S.en.some(n=>/ \d$/.test(n)))fail('plain 5v5 kept the Replication names '+JSON.stringify([S.mates,S.en]));
 if(S.aAg.some((a,i)=>a!==S.mates[i]))fail('plain 5v5 allies not their own agents '+JSON.stringify([S.aAg,S.mates]));
 if(S.cr!==800||S.t!==100)fail('plain 5v5 credits / round time '+S.cr+' / '+S.t);
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions '+JSON.stringify({errors:errors.slice(0,5),xerr:xerr.slice(0,5)}));
 if(fails.length){console.error(fails.slice(0,40).join('\n'));process.exit(1);}
 console.log('Offline Replication: queue card start, your team all your agent / bots all one other agent (10 distinct names, xAg / xAgOf), first to 5 + swap after 4, 80 s rounds, 45 s first buy of each half, credits 900 / 2400 / 3900 / 6000 regardless of the result + 6000 decider, gear reset every round, kit full every round, result REPLICATION, Play again, plain 5v5 afterwards restored; no page exceptions');
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
