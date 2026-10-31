// Bot "feels like a player" probe (lane-botfeel, user 2026-10-30: "bots have to feel like actual players"): logs behaviour
// stats beyond aim in an offline 5v5 on the real page (work/page_harness.cjs native Ascent, the player killed so every
// fight is bot vs bot), sampled every 0.2 s of the action phase. Measurement only, no asserts:
//   shots: share fired while moving faster than the accuracy deadzone (botStopped false)
//   reload: share of reload time spent with an enemy in sight (standing in the open reloading), moving share then, and
//           the share of in-sight reload time spent backing away from the enemy
//   low hp: hp < 40 and in sight: share backing away / moving toward
//   clumping: nearest living teammate distance (median, share < 2 m), share of bots with 2+ mates within 4 m
//   idle: still >= 8 s not fighting, wall stare (unsighted, standing, its eye-level view blocked within 1.2 m: a wall,
//         not a box it looks over)
//   trades: share of deaths whose killer died to the victim's team within 3 s; deaths with a mate within 15 m
//   abilities: casts per bot-round (xBUse), peek kinds at new fights (pk 1 jiggle / 2 wide / 3 tight / 0 none)
//   sounds: hearing onsets; running (loud) while a remembered enemy is within 15 m and unsighted
//   node work/probe_bot_feel.cjs     SECS=240 SEED=3 JSON=out.json
const fs=require('fs');const {boot}=require('./page_harness.cjs');
const SECS=+(process.env.SECS||240),SEED=+(process.env.SEED||3),MAP=process.env.MAP||'ascent';
(async()=>{
 const H=boot({real3:true,seed:SEED,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe(`J.pick="Jett";FV.pick="${MAP}";FV.srOn=0;FV.repOn=0;window.xSwift=0;window.xBotSeed=${SEED};xLob0=false;startFive();true`);
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 if(!xe('!!nmActive()')){console.log('native map did not load');process.exit(1);}
 xe(`(()=>{const Q=window.QBF={shot:[],death:[],use:0,eng:[],hear:0,rounds:0};
  const team=u=>allies.indexOf(u)>=0?'A':'B';
  const s0=SFX.at;SFX.at=function(p,w){try{if(p&&!(FV.buy>0)&&w!=='Spike'&&w!=='Blade Storm'){let u=null;for(const v of bots.concat(allies))if(v&&v.g&&v.g.position===p){u=v;break;}if(u)Q.shot.push({st:botStopped(u),sf:+(u.sf||0).toFixed(2),sl:!!u.xbSl});}}catch(e){}return s0.apply(this,arguments);};
  const rec=(v,by)=>{try{if(FV.buy>0)return;const t=team(v),q=v.g.position;let mate=0;for(const m of (t==='A'?allies:bots))if(m!==v&&m.alive&&Math.hypot(m.g.position.x-q.x,m.g.position.z-q.z)<15)mate=1;
   let k=null;for(const o of (t==='A'?bots:allies))if(o&&o.name===by){k=o;break;}Q.death.push({v:t+v.name,vt:t,k:k?(t==='A'?'B':'A')+k.name:null,by,t:performance.now(),mate,rd:FV.you+FV.them});}catch(e){}};
  const k0=kill;kill=function(b,hs,by){const al=b&&b.alive;const r=k0.apply(this,arguments);if(al&&b&&!b.alive)rec(b,by);return r;};
  const a0=allyDie;allyDie=function(a,by){const al=a&&a.alive;const r=a0.apply(this,arguments);if(al&&a&&!a.alive)rec(a,by);return r;};
  const u0=xBUse;xBUse=function(b,k){const r=u0.apply(this,arguments);if(r&&!(FV.buy>0))Q.use++;return r;};
  const e0=xbEngage;xbEngage=function(u,pre,ctx){try{if(ctx&&!(FV.buy>0))Q.eng.push({pk:u.pk||0,pre:!!pre});}catch(e){}return e0.apply(this,arguments);};
  return true;})()`);
 const prev=new Map(),still=new Map(),S={samp:0,rl:0,rlSee:0,rlSeeMv:0,rlSeeBack:0,low:0,lowBack:0,lowFwd:0,nn:[],nn2:0,mates2:0,longStill:0,stare:0,unsStand:0,loud:0,nearUns:0,roundsSeen:new Set(),botRounds:0};
 let lastHear=new Map();
 for(let k=0;k<SECS*5;k++){await adv(200);
  const r=JSON.parse(xe(`JSON.stringify((()=>{const o={buy:FV.buy,run:running,rd:FV.you+FV.them,u:[]};
   const tp=t=>!t?null:t===player?[player.x,player.z]:t.g?[t.g.position.x,t.g.position.z]:t.x!=null?[t.x,t.z]:null;
   for(const [L,tm] of [[allies,'A'],[bots,'B']])for(const u of L){if(!u||!u.g||!u.alive)continue;const p=u.g.position,A=u.xAm,see=(u.see||u.ts||0)>0,tg=see?tp(u.xTt||u.xTg):null;
    let wall=99;if(!see){const y=u.g.rotation.y,cx=Math.sin(y),cz=Math.cos(y),E=window.QBFv||(window.QBFv=[new THREE.Vector3(),new THREE.Vector3()]),ey=(p.y||0)+1.6;E[0].set(p.x,ey,p.z);for(let s=.4;s<=1.2;s+=.4){E[1].set(p.x+cx*s,ey,p.z+cz*s);if(!losRaw(E[0],E[1])){wall=s;break;}}}
    let kn=null;try{const c=typeof xbBest==='function'?xbBest(u,BotBrain.SENSE.hunt):null;if(c)kn=Math.hypot(c.x-p.x,c.z-p.z);}catch(e){}
    o.u.push({n:tm+u.name,tm,x:p.x,z:p.z,hp:u.hp,see,tg,rl:!!(A&&A.rl>0),spd:u.spd||0,wall,hear:(u.hearT||0)>0,kn,wk:u.wk||0,cr:!!u.cr});}return o;})())`));
  if(r.buy>0||!r.run){prev.clear();still.clear();continue;}
  if(xe('player.hp>0'))xe('pDie(null,"Vandal");true');
  if(!S.roundsSeen.has(r.rd)){S.roundsSeen.add(r.rd);S.botRounds+=r.u.length;}
  for(const u of r.u){const p=prev.get(u.n);S.samp++;
   let vx=0,vz=0;if(p){vx=(u.x-p.x)/.2;vz=(u.z-p.z)/.2;}const sp=Math.hypot(vx,vz),mv=sp>.5;
   let back=false,fwd=false;if(u.tg&&mv){const dx=u.tg[0]-u.x,dz=u.tg[1]-u.z,d=Math.hypot(dx,dz)||1,c=(vx*dx+vz*dz)/(d*sp);back=c<-.3;fwd=c>.3;}
   if(u.rl){S.rl++;if(u.see){S.rlSee++;if(mv)S.rlSeeMv++;if(back)S.rlSeeBack++;}}
   if(u.see&&u.hp<40){S.low++;if(back)S.lowBack++;if(fwd)S.lowFwd++;}
   let nn=1e9,m4=0;for(const o of r.u)if(o!==u&&o.tm===u.tm){const d=Math.hypot(o.x-u.x,o.z-u.z);nn=Math.min(nn,d);if(d<4)m4++;}
   if(nn<1e8){S.nn.push(nn);if(nn<2)S.nn2++;if(m4>=2)S.mates2++;}
   const s=mv||u.see?0:(still.get(u.n)||0)+.2;still.set(u.n,s);if(s>=8)S.longStill++;
   if(!u.see&&!mv){S.unsStand++;if(u.wall<=1.2)S.stare++;}
   if(!u.see&&u.kn!=null&&u.kn<15){S.nearUns++;if(u.spd>4&&!u.wk&&!u.cr)S.loud++;}
   if(u.hear&&!lastHear.get(u.n))S.hearOn=(S.hearOn||0)+1;lastHear.set(u.n,u.hear);
   prev.set(u.n,{x:u.x,z:u.z});}}
 const Q=JSON.parse(xe('JSON.stringify(QBF)'));
 const pc=(a,b)=>b?+(a/b*100).toFixed(1):null,med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?+s[Math.floor(s.length/2)].toFixed(2):null;};
 let traded=0;for(const d of Q.death){if(!d.k)continue;if(Q.death.some(e=>e.v===d.k&&e.t>=d.t&&e.t-d.t<=3000))traded++;}
 const pk={};for(const e of Q.eng)pk[e.pk]=(pk[e.pk]||0)+1;
 const out={seed:SEED,map:MAP,secs:SECS,samples:S.samp,rounds:S.roundsSeen.size,
  shots:Q.shot.length,shotMovingPct:pc(Q.shot.filter(s=>!s.st).length,Q.shot.length),shotSloppyPct:pc(Q.shot.filter(s=>s.sl).length,Q.shot.length),
  reloadSamples:S.rl,reloadInSightPct:pc(S.rlSee,S.rl),reloadInSightMovingPct:pc(S.rlSeeMv,S.rlSee),reloadInSightBackingPct:pc(S.rlSeeBack,S.rlSee),
  lowHpInSight:S.low,lowHpBackingPct:pc(S.lowBack,S.low),lowHpPushingPct:pc(S.lowFwd,S.low),
  nearestMateMedian:med(S.nn),nearestMateUnder2Pct:pc(S.nn2,S.nn.length),twoMatesWithin4Pct:pc(S.mates2,S.nn.length),
  longStillPct:pc(S.longStill,S.samp),wallStarePctOfUnsightedStanding:pc(S.stare,S.unsStand),wallStarePctAll:pc(S.stare,S.samp),
  deaths:Q.death.length,tradedPct:pc(traded,Q.death.filter(d=>d.k).length),deathsWithMate15Pct:pc(Q.death.filter(d=>d.mate).length,Q.death.length),
  abilityCasts:Q.use,castsPerBotRound:S.botRounds?+(Q.use/S.botRounds).toFixed(2):null,fights:Q.eng.length,peekKinds:pk,preAimedPct:pc(Q.eng.filter(e=>e.pre).length,Q.eng.length),
  hearOnsets:S.hearOn||0,loudNearKnownEnemyPct:pc(S.loud,S.nearUns),errors:H.errors.length};
 console.log(JSON.stringify(out,null,1));if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(out,null,1));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
