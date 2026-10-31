// Offline bots feel like real players beyond aim (lane-botfeel, user 2026-10-30: "bots have to feel like actual players";
// server twin: server/test-bot-feel.js; stats tool: work/probe_bot_feel.cjs). On the real page (work/page_harness.cjs
// native Ascent, shipped BOT VARIETY / BOT AMMO blocks):
//  1. reloading is not done in the open (shared BotBrain.reloadPlay / reloadBack / reloadSpot): direct - a reloading bot's
//     xFight backs toward the spot it peeked from (its unseen trail u.xbTr) or away (a free side with a wall behind), never strafes; unsighted mid-reload with a remembered enemy
//     close it holds (xbReHold); live 5v5 - of the reload time spent in an enemy's sight, most is spent backing away
//     (09a42d4 seeds 3/5/7: 7 / 23 / 8 %)
//   node work/test_bot_feel_offline.cjs        (SECS=200 SEED=3 by default)
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const SECS=+(process.env.SECS||200),SEED=+(process.env.SEED||3);
(async()=>{
 const H=boot({real3:true,seed:SEED,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe(`J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;window.xBotSeed=${SEED};xLob0=false;startFive();true`);
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 assert(xe('!!nmActive()'),'native Ascent loaded');
 // 1. direct: the reload back-off and hold
 const D=JSON.parse(xe(`JSON.stringify((()=>{const o={};o.fn=typeof BotBrain.reloadPlay==='function'&&typeof xbReBack==='function'&&typeof xbReHold==='function';if(!o.fn)return o;
  const b=bots.find(u=>u&&u.g&&u.alive),p=b.g.position,x0=p.x,z0=p.z,A=xbAm(b);A.w=A.w||'Vandal';const sv={rl:A.rl,mag:A.mag,tr:b.xbTr,see:b.see,cd:b.cd,mem:b.xMem};
  const run=(rl,tr)=>{A.rl=rl;A.mag=rl>0?0:20;b.xbTr=tr;b.cd=0;const v=xFight(b,.05,x0,z0-12,12);return [+v[0].toFixed(3),+v[1].toFixed(3),!!b.xbRc];};
  o.cover=run(2,[[x0+2,z0+3,0]]);o.away=run(2,null);o.fight=run(0,null);o.awayWant=BotBrain.reloadBack(x0,z0,null,null,x0,z0-12,(x,z)=>!blocked(x,z,.45,p.y)).map(v=>+v.toFixed(3));
  b.xMem=BotBrain.memNew();BotBrain.memNote(b.xMem,'player',x0,0,z0-10,xbNow(),'seen');const live=xbLive;xbLive=()=>true;
  b.xbTr=null;A.rl=2;A.mag=0;o.hold=xbReHold(b);const tl=b.xbTr&&b.xbTr[b.xbTr.length-1];o.unAfter=tl&&[+(tl[0]-x0).toFixed(2),+(tl[1]-z0).toFixed(2)];A.rl=0;A.mag=20;o.noHold=xbReHold(b);
  b.xMem=BotBrain.memNew();BotBrain.memNote(b.xMem,'player',x0,0,z0-BotBrain.RELOAD.hold-5,xbNow(),'seen');A.rl=2;A.mag=0;o.farHold=xbReHold(b);xbLive=live;
  A.rl=sv.rl;A.mag=sv.mag;b.xbTr=sv.tr;b.see=sv.see;b.cd=sv.cd;b.xMem=sv.mem;b.xbRc=0;return o;})())`));
 assert(D.fn,'BotBrain.reloadPlay + BOT VARIETY xbReBack / xbReHold on the page');
 const s=Math.hypot(2,3);assert(Math.abs(D.cover[0]-2/s)<.01&&Math.abs(D.cover[1]-3/s)<.01&&D.cover[2],'reloading in sight: back toward the spot it peeked from ('+D.cover+')');
 assert(Math.abs(D.away[0]-D.awayWant[0])<.01&&Math.abs(D.away[1]-D.awayWant[1])<.01&&D.awayWant[1]>=-.01&&D.away[2],'no peek spot: away from the enemy (a free side when a wall is behind) ('+D.away+' want '+D.awayWant+')');
 assert(!D.fight[2],'not reloading: the fight goes on as before (no back-off flag)');
 assert(D.hold===true,'unsighted mid-reload, a remembered enemy 10 m away: hold');assert.deepEqual(D.unAfter,[0,0],'its unseen trail gets the spot where it stands');
 assert(D.noHold===false,'not reloading: no hold');assert(D.farHold===false,'a far contact: no hold');
 console.log('1. direct: back-off toward the peek spot '+D.cover.slice(0,2)+', away '+D.away.slice(0,2)+', unsighted hold ok');
 // live 5v5, the player dead: every fight bot vs bot
 const prev=new Map(),S={rl:0,rlSee:0,rlSeeBack:0};
 for(let k=0;k<SECS*5;k++){await adv(200);
  const r=JSON.parse(xe(`JSON.stringify((()=>{const o={buy:FV.buy,run:running,u:[]};const tp=t=>!t?null:t===player?[player.x,player.z]:t.g?[t.g.position.x,t.g.position.z]:null;
   for(const [L,tm] of [[allies,'A'],[bots,'B']])for(const u of L){if(!u||!u.g||!u.alive)continue;const p=u.g.position,see=(u.see||u.ts||0)>0;o.u.push({n:tm+u.name,x:p.x,z:p.z,see,tg:see?tp(u.xTt||u.xTg):null,rl:!!(u.xAm&&u.xAm.rl>0)});}return o;})())`));
  if(r.buy>0||!r.run){prev.clear();continue;}
  if(xe('player.hp>0'))xe('pDie(null,"Vandal");true');
  for(const u of r.u){const p=prev.get(u.n);prev.set(u.n,u);if(!p)continue;const vx=(u.x-p.x)/.2,vz=(u.z-p.z)/.2,sp=Math.hypot(vx,vz);
   if(u.rl){S.rl++;if(u.see){S.rlSee++;if(u.tg&&sp>.5){const dx=u.tg[0]-u.x,dz=u.tg[1]-u.z,d=Math.hypot(dx,dz)||1;if((vx*dx+vz*dz)/(d*sp)<-.3)S.rlSeeBack++;}}}}}
 const pc=(a,b)=>b?a/b*100:0;
 console.log(`1. live: reload samples ${S.rl}, in an enemy's sight ${pc(S.rlSee,S.rl).toFixed(1)} %, backing away ${pc(S.rlSeeBack,S.rlSee).toFixed(1)} % of those`);
 assert(S.rl>=40,'bots reload in the live rounds ('+S.rl+')');
 if(S.rlSee>=8)assert(pc(S.rlSeeBack,S.rlSee)>=30,`a reload in an enemy's sight is spent backing away (${pc(S.rlSeeBack,S.rlSee).toFixed(1)} % >= 30 %, above every 09a42d4 seed; 09a42d4 seeds 3/5/7: 7 / 23 / 8 %)`);
 assert(H.errors.length<=1,'no page errors: '+JSON.stringify(H.errors.slice(1,3)));
 console.log('bots feel like players (reload) ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
