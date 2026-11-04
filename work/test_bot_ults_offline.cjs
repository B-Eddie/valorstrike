// Bots use their ultimates (user 2026-11-03 19:14 EST: "the bots aren't using their ultimates"). Offline 5v5 on the real
// page (work/page_harness.cjs, legacy Ascent blockout for speed), the player dead each round so every fight is bot vs bot,
// every bot handed its full ult points at each round start. Two line-ups cover the 12 agents. Asserted:
//  1. at least 75 % of the bots cast their ultimate within ROUNDS rounds (pooled over both line-ups), and every agent with
//     an ult (all 12: Cypher Neural Theft and Skye Seekers had no offline bot ult at all) casts at least once over the two
//     line-ups (Sage aside: Resurrection needs a teammate's body in reach and 3.3 s with no enemy in sight - asserted in
//     server/test-bot-ults.js, situational in 4 offline rounds);
//  2. human timing, not instant: a cast goes through BotBrain.ultReady - the situation must hold for a drawn
//     ULTX.delay (0.45 s+) first - so no cast lands within ULTX.delay[0] of the bot first wanting it; no cast in the buy
//     phase;
//  3. no page errors.
//   node work/test_bot_ults_offline.cjs        (LINEUP=a|b runs one line-up in this process)
'use strict';
const {spawn}=require('child_process');
const ROUNDS=+(process.env.ROUNDS||4),CAP=+(process.env.CAP||520);
const LINEUPS={a:{en:['Raze','Skye','Sova','Breach','Phoenix'],al:['Cypher','Sage','Killjoy','Omen']},b:{en:['Jett','Reyna','Chamber','Cypher','Killjoy'],al:['Breach','Sage','Omen','Skye']}};
async function run(key){
 const {boot}=require('./page_harness.cjs');const L=LINEUPS[key];
 const H=boot({real3:true,seed:key==='a'?3:5}),xe=H.xe;let gt=0;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);gt+=50;await new Promise(r=>setImmediate(r));}};
 xe(`F_EN.splice(0,F_EN.length,...${JSON.stringify(L.en)});F_MATES.splice(0,F_MATES.length,...${JSON.stringify(L.al)});J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;true`);
 // full ult points for everyone at each round start; log BotBrain.ultReady wants (first want time per unit state)
 xe(`(()=>{const f0=fRound;fRound=function(){const r=f0.apply(this,arguments);try{for(const u of bots.concat(allies)){const a=xAg(u);window.xBotUC[u.name]=(KITS[a]&&KITS[a].u)||0;}}catch(e){}return r;};
  window.__ur=[];const B=window.BotBrain;if(B&&B.ultReady){const r0=B.ultReady;B.ultReady=function(st,t,want){const k0=st&&st.k,r=r0.apply(this,arguments);try{if(want&&k0!==want)st.t0=t;if(r)__ur.push({t,t0:st.t0});}catch(e){}return r;};}return true;})()`);
 xe('startFive();true');for(let i=0;i<100&&!xe('running');i++)await adv(100);
 const casts={},last={};let n0=-1;const bad=[];
 while(gt/1000<CAP){await adv(200);
  const s=JSON.parse(xe(`(()=>{if(running&&player.hp>0&&FV.buy<=0){const b=bots.find(b=>b.alive);hurt(player,999,b.name);updHud();pDie(b.name,b.w);}if(FV.buy>2)FV.buy=2;
   return JSON.stringify({n:FV.you+FV.them,res:document.getElementById("result").style.display,buy:FV.buy>0,u:bots.concat(allies).map(u=>[u.name,xAg(u),window.xBotUC[u.name]||0,(KITS[xAg(u)]||{}).u||0])});})()`));
  if(s.n!==n0){n0=s.n;}
  for(const [name,ag,c,m] of s.u){if(last[name]>=m&&m&&c<m){casts[name]=(casts[name]||0)+1;if(s.buy)bad.push('cast in the buy phase: '+name);}last[name]=c;}
  if(s.n>=ROUNDS||s.res==='flex')break;}
 const ur=xe('JSON.stringify(window.__ur||[])'),D=xe('JSON.stringify((window.BotBrain&&BotBrain.ULTX&&BotBrain.ULTX.delay)||null)');
 const errs=H.errors.filter(e=>!/unexpected external script/.test(e.msg)).map(e=>e.msg.slice(0,200));
 return {key,agents:xe('JSON.stringify(bots.concat(allies).map(u=>[u.name,xAg(u)]))'),casts,ur:JSON.parse(ur),delay:JSON.parse(D),rounds:n0,secs:gt/1000,bad,errs,xerr:H.xErrCalls.length};
}
if(process.env.LINEUP){run(process.env.LINEUP).then(r=>{process.stdout.write('RESULT '+JSON.stringify(r)+'\n');process.exit(0);}).catch(e=>{console.error(e);process.exit(2);});}
else (async()=>{
 const one=k=>new Promise(res=>{const c=spawn(process.execPath,[__filename],{env:{...process.env,LINEUP:k},stdio:['ignore','pipe','inherit']});let o='';c.stdout.on('data',d=>o+=d);c.on('close',()=>{const m=/RESULT (.*)/.exec(o);res(m?JSON.parse(m[1]):{key:k,crash:o.slice(-500)});});});
 const R=await Promise.all(['a','b'].map(one));const fails=[];let units=0,cast=0;const byAgent={};
 for(const r of R){if(r.crash){fails.push('line-up '+r.key+' crashed: '+r.crash);continue;}
  const ag=JSON.parse(r.agents);for(const [n,a] of ag){units++;const c=r.casts[n]||0;if(c)cast++;byAgent[a]=(byAgent[a]||0)+c;}
  console.log(`line-up ${r.key}: ${r.rounds} rounds, ${r.secs.toFixed(0)} s; casts ${JSON.stringify(ag.map(([n,a])=>a+':'+(r.casts[n]||0)))}`);
  if(r.bad.length)fails.push(r.key+': '+r.bad.slice(0,3).join('; '));if(r.errs.length||r.xerr)fails.push(r.key+' page errors: '+JSON.stringify(r.errs.slice(0,3))+' xErr '+r.xerr);
  if(!r.delay||!(r.delay[0]>=0.3))fails.push('2. BotBrain.ULTX.delay missing or under 0.3 s: '+JSON.stringify(r.delay));
  const quick=r.ur.filter(x=>x.t0==null||x.t-x.t0<(r.delay?r.delay[0]:0.3)-1e-6);if(quick.length)fails.push('2. '+quick.length+' casts within the hesitation delay of first wanting it');
  if(r.ur.length<Object.values(r.casts).reduce((a,b)=>a+b,0))fails.push(`2. ${r.key}: casts that did not go through BotBrain.ultReady (${r.ur.length} ready / ${JSON.stringify(r.casts)})`);}
 if(cast<0.75*units)fails.push(`1. only ${cast}/${units} bots cast their ultimate within ${ROUNDS} rounds`);
 const never=Object.entries(byAgent).filter(([a,c])=>!c&&a!=='Sage').map(([a])=>a);/* Sage's only call is a teammate's body within reach with no enemy in sight, then a 3.3 s revive: in 4 offline rounds it depends on where fights happen (the server test asserts it) */if(never.length)fails.push('1. agents that never cast: '+never.join(', '));
 if(fails.length){console.error('FAIL test_bot_ults_offline\n - '+fails.join('\n - '));process.exit(1);}
 console.log(`PASS test_bot_ults_offline: ${cast}/${units} bots cast within ${ROUNDS} rounds, every agent cast (${JSON.stringify(byAgent)}), all through the ${R[0].delay} s hesitation`);process.exit(0);
})();
