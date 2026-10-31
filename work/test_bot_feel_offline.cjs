// Offline bots feel like real players beyond aim (lane-botfeel, user 2026-10-30: "bots have to feel like actual players";
// server twin: server/test-bot-feel.js; stats tool: work/probe_bot_feel.cjs). On the real page (work/page_harness.cjs
// native Ascent, shipped BOT VARIETY / BOT AMMO blocks):
//  1. reloading is not done in the open (shared BotBrain.reloadPlay / reloadBack / reloadSpot): direct - a reloading bot's
//     xFight backs toward the spot it peeked from (its unseen trail u.xbTr) or away (a free side with a wall behind), never strafes; unsighted mid-reload with a remembered enemy
//     close it holds (xbReHold); live 5v5 - of the reload time spent in an enemy's sight, most is spent backing away
//     (09a42d4 seeds 3/5/7: 7 / 23 / 8 %)
//  2. corner holds drawn like the server's (BotBrain.peek): a new peek onto a known contact holds the angle when the bot's
//     personality draws a hold (09a42d4: 0 holds in 150 live fights); a hold stands on the angle PEEK.hold s, then peeks tight;
//     other draws keep the page's own pick (no jiggle without a sniper); against an Operator only jiggle / hold
//  3. trading like a player (lane-botfeel2; a8c64fa seed 3: 10.5 % of deaths traded within 3 s): the trader goes for the
//     actual killer (the killfeed name, u.xKb; was the enemy nearest the body) from up to BotBrain.TRADE.range m (was 15), knows
//     its spot (a 'heard' memory: it comes round the corner pre-aimed), swings the corner wide (pk 2; jiggle into an Operator),
//     and a killer's next fight inside TRADE.focus s of its kill reacts TRADE.lag later (BotBrain.reaction ctx.postKill)
//  4. moving quietly (BotBrain.quiet / WALK, = server): unsighted with an enemy it knows of within WALK.range m a 5v5 bot
//     shift-walks (was 12 m); never while trading, swinging wide or carrying the Spike
//   node work/test_bot_feel_offline.cjs        (SECS=260 SEED=3 by default: lane-botfeel2 trades changed the seed-3 rounds, 200 s gave 24 reload samples)
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const SECS=+(process.env.SECS||260),SEED=+(process.env.SEED||3);
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
 // 2. direct: peek kinds
 const P=JSON.parse(xe(`JSON.stringify((()=>{const o={k:{},sn:{},hold:null};const L=bots.filter(u=>u&&u.g&&u.alive);
  for(const b of L){const sv=[b.pk,b.pkTh,b.pkP,b.xbPkR];for(let i=0;i<60;i++){b.pk=0;b.pkTh=0;xPeekThink(b,.2,false,false,10,'Vandal',bots,false);o.k[b.pk]=(o.k[b.pk]||0)+1;}
   for(let i=0;i<30;i++){b.pk=0;b.pkTh=0;xPeekThink(b,.2,false,false,10,'Operator',bots,false);o.sn[b.pk]=(o.sn[b.pk]||0)+1;}[b.pk,b.pkTh,b.pkP,b.xbPkR]=sv;}
  const b=L[0],sv=[b.pk,b.pkP,b.pkH];b.pk=4;b.pkP=0;b.pkH=1.2;let still=0,t=0;for(;t<3&&b.pk===4;t+=.1){const v=xPeekMove(b,.1,6,0,6,1,0);if(!v[0]&&!v[1])still+=.1;}o.hold={still:+still.toFixed(2),after:b.pk};[b.pk,b.pkP,b.pkH]=sv;return o;})())`));
 console.log('2. direct: peek kinds (1 jiggle / 2 wide / 3 tight / 4 hold) '+JSON.stringify(P.k)+', vs an Operator '+JSON.stringify(P.sn)+', hold '+JSON.stringify(P.hold));
 assert(!P.k[1]&&(P.k[4]||0)>0&&(P.k[2]||0)+(P.k[3]||0)>0,'without a sniper: holds are drawn, the rest keep the page\'s wide / tight pick, no jiggle: '+JSON.stringify(P.k));
 assert(!P.sn[2]&&!P.sn[3]&&(P.sn[1]||0)>(P.sn[4]||0),'against an Operator: jiggle (mostly) or hold, no wide / tight swing: '+JSON.stringify(P.sn));
 assert(P.hold.still>=1.0&&P.hold.still<=1.31&&P.hold.after===3,'a hold stands still on the angle for its time, then peeks tight: '+JSON.stringify(P.hold));
 // 3. direct: trades
 const T=JSON.parse(xe(`JSON.stringify((()=>{const o={fn:typeof BotBrain.TRADE==='object'&&typeof BotBrain.quiet==='function'};if(!o.fn)return o;const R=BotBrain.TRADE.range;
  const A=allies.filter(u=>u&&u.g&&u.alive),E=bots.filter(u=>u&&u.g&&u.alive);if(A.length<2||E.length<2){o.short=1;return o;}
  const v=A[0],m=A[1],k=E[0],e2=E[1],sv=[v,m,k,e2].map(u=>[u.g.position.x,u.g.position.z,u.alive,u.wasA,u.trT,u.tr,u.xMem,u.xHold,u.xKb]),others=A.slice(2).map(u=>[u,u.alive]);
  for(const [u] of others)u.alive=false;const live=xbLive;xbLive=()=>true;
  const put=(u,x,z)=>{u.g.position.x=x;u.g.position.z=z;};const vx=v.g.position.x,vz=v.g.position.z;
  put(m,vx+R-2,vz);put(k,vx,vz-14);put(e2,vx-5,vz-3);m.trT=0;m.xMem=BotBrain.memNew();v.wasA=true;v.alive=false;v.xKb=k.name;m.wasA=true;
  xTradeChk(allies,bots,true);o.tr=m.trT>0?[+(m.tr[0]-k.g.position.x).toFixed(2),+(m.tr[1]-k.g.position.z).toFixed(2)]:null;
  const c=xbBest(m,BotBrain.SENSE.hunt);o.mem=c?[+(c.x-k.g.position.x).toFixed(2),+(c.z-k.g.position.z).toFixed(2)]:null;
  // peek kinds while trading
  const pk={},sn={};for(let i=0;i<40;i++){m.pk=0;m.pkTh=0;m.trT=3;xPeekThink(m,.2,false,false,8,'Vandal',allies,true);pk[m.pk]=(pk[m.pk]||0)+1;m.pk=0;m.pkTh=0;xPeekThink(m,.2,false,false,8,'Operator',allies,true);sn[m.pk]=(sn[m.pk]||0)+1;}o.pk=pk;o.sn=sn;m.pk=0;m.trT=0;
  // post-kill reaction
  let a=0,b=0;const n=200;for(let i=0;i<n;i++){m.xKillT=-1e9;xbEngage(m,true,{off:.1,d:15});a+=m.rtE;m.xKillT=xbNow()-.3;xbEngage(m,true,{off:.1,d:15});b+=m.rtE;}o.rt=[+(a/n).toFixed(3),+(b/n).toFixed(3)];o.lag=BotBrain.TRADE.lag[0];m.xKillT=-1e9;
  // quiet
  const W=BotBrain.WALK.range;o.walk=[botWalk(m,false,W-2),botWalk(m,false,10),botWalk(m,false,W+4),botWalk(m,true,8)];m.trT=3;o.walk.push(botWalk(m,false,8));m.trT=0;
  for(const [u,al] of others)u.alive=al;xbLive=live;[v,m,k,e2].forEach((u,i)=>{const q=sv[i];put(u,q[0],q[1]);u.alive=q[2];u.wasA=q[3];u.trT=q[4];u.tr=q[5];u.xMem=q[6];u.xHold=q[7];u.xKb=q[8];});return o;})())`));
 assert(T.fn,'BotBrain.TRADE / BotBrain.quiet on the page');assert(!T.short,'two allies and two enemies alive for the trade check');
 assert(T.tr&&Math.hypot(T.tr[0],T.tr[1])<.6,'a mate TRADE.range-2 m from the body trades the killer (killfeed), not the enemy nearest the body: '+JSON.stringify(T.tr));
 assert(T.mem&&Math.hypot(T.mem[0],T.mem[1])<.6,'the trader knows the killer\'s spot: '+JSON.stringify(T.mem));
 assert.deepEqual(T.pk,{2:40},'a trader swings the corner wide: '+JSON.stringify(T.pk));assert(!T.sn[2]&&!T.sn[3],'into an Operator it jiggles: '+JSON.stringify(T.sn));
 assert(T.rt[1]>=T.rt[0]+T.lag*.9,'a killer\'s next fight 0.3 s after its kill reacts later: '+T.rt);
 console.log('3. direct: trade the killer '+JSON.stringify(T.tr)+', its spot known, peeks '+JSON.stringify(T.pk)+', post-kill reaction '+T.rt);
 // 4. direct: walking
 assert.deepEqual(T.walk,[true,true,false,false,false],'walks with a contact inside WALK.range, runs far / seeing / trading: '+JSON.stringify(T.walk));
 console.log('4. direct: walk '+JSON.stringify(T.walk));
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
 assert(S.rl>=25,'bots reload in the live rounds ('+S.rl+' samples of 0.2 s; seed 3 runs saw 34-105)');
 if(S.rlSee>=8)assert(pc(S.rlSeeBack,S.rlSee)>=30,`a reload in an enemy's sight is spent backing away (${pc(S.rlSeeBack,S.rlSee).toFixed(1)} % >= 30 %, above every 09a42d4 seed; 09a42d4 seeds 3/5/7: 7 / 23 / 8 %)`);
 assert(H.errors.length<=1,'no page errors: '+JSON.stringify(H.errors.slice(1,3)));
 console.log('bots feel like players (reload, corner holds) ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
