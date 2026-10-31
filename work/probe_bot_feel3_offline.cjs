// Bot "feels like an average player" probe, part 3 (lane-botfeel3), OFFLINE: the real page (work/page_harness.cjs, native
// Ascent 5v5, the player killed so every fight is bot vs bot). Measurement only, no asserts; same KPIs as the server
// probe work/probe_bot_feel3.mjs:
//   crosshair: |yaw| between where a bot looked and the enemy when a fresh fight starts (xbEngage ctx.e0y; no sighting in
//     the 2 s before), median deg and share under 10 deg
//   economy: team buy call per team-round (XBV.call), primaries split, mixed team-rounds outside pistol rounds
//   endings, time-outs; hopeless attacker deaths (pre-plant, under 20 s on the clock, outnumbered by 2+)
//   routes: each bot's first 35 s as 5 m cells; Jaccard of same-side mates per round / of a bot with itself across rounds
//   node work/probe_bot_feel3_offline.cjs     SECS=420 SEED=3 JSON=out.json
const fs=require('fs'),path=require('path');const {boot}=require(path.join(process.env.ROOT||path.join(__dirname,'..'),'work','page_harness.cjs'));
const SECS=+(process.env.SECS||420),SEED=+(process.env.SEED||3),MAP=process.env.MAP||'ascent';
(async()=>{
 const H=boot({real3:true,seed:SEED,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe(`J.pick="Jett";FV.pick="${MAP}";FV.srOn=0;FV.repOn=0;window.xSwift=0;window.xBotSeed=${SEED};xLob0=false;startFive();true`);
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 if(!xe('!!nmActive()')){console.log('native map did not load');process.exit(1);}
 xe(`(()=>{const Q=window.QB3={xh:[],death:[],end:[]};
  const e0=xbEngage;xbEngage=function(u,pre,ctx){try{const t=performance.now();if(ctx&&!(FV.buy>0)&&t-(u.q3See||-1e9)>2000&&ctx.e0y!=null)Q.xh.push({yaw:+(ctx.e0y*180/Math.PI).toFixed(2),d:+(ctx.d||0).toFixed(1),pre:!!pre});u.q3See=t;}catch(e){}return e0.apply(this,arguments);};
  const rec=(v)=>{try{if(FV.buy>0||!running)return;const atkB=!FV.atk,isA=allies.indexOf(v)>=0,atkV=isA?FV.atk:atkB;if(!atkV||FV.sp.st==='plant')return;
   const mates=(isA?allies:bots).filter(m=>m.alive).length+(isA&&player.hp>0?1:0),foes=(isA?bots:allies).filter(m=>m.alive).length;const s=FV.bs&&FV.bs[v.name];Q.death.push({left:+timeLeft.toFixed(1),atk:mates+1,def:foes,gun:s?s.w:null});}catch(e){}};
  const k0=kill;kill=function(b){const al=b&&b.alive;const r=k0.apply(this,arguments);if(al&&b&&!b.alive)rec(b);return r;};
  const a0=allyDie;allyDie=function(a){const al=a&&a.alive;const r=a0.apply(this,arguments);if(al&&a&&!a.alive)rec(a);return r;};
  const f0=fCheck;fCheck=function(win,text){const was=running;const r=f0.apply(this,arguments);if(was&&!running)Q.end.push({text,atkAlive:(FV.atk?allies:bots).filter(u=>u.alive).length,plant:FV.sp.st==='plant'});return r;};
  return true;})()`);
 const RIFLE=new Set(['Warden','Vandal','Phantom','Bulldog','Guardian','Operator','Odin','Ares','Marshal','Outlaw']),SMG=new Set(['Spectre','Stinger','Judge','Bucky']);
 const ECO=[],ROUT={},seen=new Set();let curRd=null,t0=0,cells={};
 const flush=()=>{if(curRd==null)return;for(const n in cells){const c=cells[n];(ROUT[c.key]||(ROUT[c.key]=[])).push({round:curRd,id:n,cells:[...c.s]});}cells={};};
 for(let k=0;k<SECS*5;k++){await adv(200);
  const r=JSON.parse(xe(`JSON.stringify((()=>{const o={buy:FV.buy,run:running,rd:FV.you+FV.them,atk:FV.atk,site:FV.sp.site,tl:timeLeft,u:[],call:[XBV.call&&XBV.call[true]?XBV.call[true].c:null,XBV.call&&XBV.call[false]?XBV.call[false].c:null],ls:[FV.lsY||0,FV.lsT||0]};
   for(const [L,tm] of [[allies,'A'],[bots,'B']])for(const u of L){if(!u||!u.g)continue;const s=FV.bs&&FV.bs[u.name];o.u.push({n:tm+u.name,tm,al:!!u.alive,x:u.g.position.x,z:u.g.position.z,w:s?s.w:null});}return o;})())`));
  if(xe('player.hp>0'))xe('pDie(null,"Vandal");true');
  if(r.buy>0||!r.run)continue;
  if(r.rd!==curRd){flush();curRd=r.rd;t0=k;
   for(const tm of ['A','B']){const L=r.u.filter(u=>u.tm===tm),q={rifle:0,smg:0,pistol:0};for(const u of L){if(RIFLE.has(u.w))q.rifle++;else if(SMG.has(u.w))q.smg++;else q.pistol++;}
    const atk=tm==='A'?r.atk:!r.atk;ECO.push({round:r.rd+1,team:tm,atk,call:tm==='A'?r.call[0]:r.call[1],ls:tm==='A'?r.ls[0]:r.ls[1],...q,mixed:r.rd!==0&&r.rd!==12&&q.rifle>0&&q.pistol>0});}}
  const rt=(k-t0)*.2;if(rt<=35&&(k-t0)%2===0)for(const u of r.u){if(!u.al)continue;const atk=u.tm==='A'?r.atk:!r.atk,key=u.tm+'|'+(atk?'A':'D')+'|'+r.site;const c=cells[u.n]||(cells[u.n]={key,s:new Set()});c.s.add(Math.round(u.x/5)+','+Math.round(u.z/5));}}
 flush();
 const Q=JSON.parse(xe('JSON.stringify(QB3)'));
 const J=(a,b)=>{const A=new Set(a);let i=0;for(const x of b)if(A.has(x))i++;const u=A.size+b.length-i;return u?i/u:0;};let mates=[],self=[];
 for(const key in ROUT){const L=ROUT[key],by=new Map();for(const e of L)(by.get(e.round)||by.set(e.round,[]).get(e.round)).push(e);
  for(const [,E] of by)for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++)mates.push(J(E[i].cells,E[j].cells));
  const byId=new Map();for(const e of L)(byId.get(e.id)||byId.set(e.id,[]).get(e.id)).push(e);for(const [,E] of byId)for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++)self.push(J(E[i].cells,E[j].cells));}
 const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?+s[Math.floor(s.length/2)].toFixed(3):null;},mean=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):null,pc=(a,b)=>b?+(a/b*100).toFixed(1):null;
 const ay=Q.xh.map(x=>Math.abs(x.yaw)),calls={};for(const e of ECO){const k=(e.atk?'A':'D')+':'+e.call;calls[k]=(calls[k]||0)+1;}
 const out={seed:SEED,secs:SECS,side:'offline',rounds:Q.end.length,
  xhFights:Q.xh.length,xhYawMedDeg:med(ay),xhYawUnder10Pct:pc(ay.filter(x=>x<10).length,ay.length),xhPrePct:pc(Q.xh.filter(x=>x.pre).length,Q.xh.length),
  ecoCalls:calls,ecoWinnerSaveCalls:ECO.filter(e=>e.round!==1&&e.round!==13&&e.ls===0&&(e.call==='eco'||e.call==='save')).length,ecoWinnerRounds:ECO.filter(e=>e.round!==1&&e.round!==13&&e.ls===0).length,ecoMixedPct:pc(ECO.filter(e=>e.mixed).length,ECO.filter(e=>e.round!==1&&e.round!==13).length),
  endings:Q.end.map(e=>e.text),atkAliveAtEnd:Q.end.map(e=>e.atkAlive),
  atkPrePlantDeaths:Q.death.length,hopelessDeaths:Q.death.filter(d=>d.left<20&&d.def-(d.atk-1)>=2).length,lateDeathsUnder20:Q.death.filter(d=>d.left<20).length,
  routeMateJaccardMean:mean(mates),routeSelfJaccardMean:mean(self),routePairsMates:mates.length,routePairsSelf:self.length,errors:H.errors.length,eco:ECO,deaths:Q.death,xh:Q.xh};
 const o2={...out};delete o2.eco;delete o2.xh;delete o2.deaths;console.log(JSON.stringify(o2));if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(out,null,1));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
