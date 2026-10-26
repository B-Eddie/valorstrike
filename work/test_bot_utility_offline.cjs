// Offline bot utility casts that had no bot path (index.html xBHotHands / xBSlowOrb / xBShock / xBParanoia / xBCage /
// xBTrail / xBTurret), on the real page (work/page_harness.cjs): team-aware with the player's values. Hot Hands spreads to
// XHOT.r and burns the other team 60/s (the caster's team a third, the caster never), Slow Orb halves speed in 3.5 m for 7 s,
// Shock Bolt 75 in 3 m on landing, Paranoia nearsights everyone it passes but Omen (the player too), Cyber Cage is a 7 s
// cylinder smoke, Trailblazer concusses in 3.5 m and bites the nearest for 30, Turret: nothing before deploy + windup, then
// 8-damage shots at 10 m on the other team only; a round clear removes bot turrets. Each lands short of a wall.
//   node work/test_bot_utility_offline.cjs
const {boot}=require('./page_harness.cjs');
const fails=[];const fail=s=>fails.push(s);const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m+': got '+JSON.stringify(a)+' want '+JSON.stringify(b));};
const ok=(c,m)=>{if(!c)fail(m);};
(async()=>{
 const H=boot({real3:true,seed:5}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const errs0=H.errors.length;
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 if(!xe('running&&player.hp>0'))fail('no live round');
 // freeze every bot (detained: no moving / shooting), park them far away, record ability damage per target
 xe(`(()=>{window.__U={d:new Map(),o:{x:player.x,z:player.z}};bots.concat(allies).forEach(b=>{b.det=1e9;b.g&&b.g.position.set(player.x+300,b.g.position.y,player.z);});
  window.__hu=hurt;hurt=function(t,n,by){if(__U.w){const k=(t===player?'P':t.name)+'|'+by;__U.l=__U.l||[];__U.l.push([k,__U.w,n,performance.now()]);__U.d.set(k,(__U.d.get(k)||0)+n);}return __hu.apply(this,arguments);}; /* ability damage only (bots still trade gunfire) */
  window.__bd=xBotDmg;xBotDmg=function(t,n,by,w){__U.w=w;try{return __bd.apply(this,arguments);}finally{__U.w=null;}};window.__ff=xFFArea;xFFArea=function(c,en,w){__U.w=w;try{return __ff.apply(this,arguments);}finally{__U.w=null;}};
  window.__lo=los;los=()=>true;window.__bl=blocked;timeLeft=Math.max(timeLeft,90);return true;})()`);
 const keep=()=>xe('player.hp=100;player.armor=0;bots.concat(allies).forEach(b=>{if(b.__p){b.alive=true;b.hp=1000;b.armor=0;b.g.position.x=b.__p[0];b.g.position.z=b.__p[1];}});timeLeft=Math.max(timeLeft,60);true');
 const place=(list)=>xe(`(()=>{const o=__U.o;bots.concat(allies).forEach(b=>{b.__p=null;if(b.g)b.g.position.set(o.x+300,b.g.position.y,o.z);});
  for(const [w,i,x,z] of ${JSON.stringify(list)}){const b=(w==='b'?bots:allies)[i];if(!b||!b.g)return false;b.__p=[o.x+x,o.z+z];}player.x=o.x;player.z=o.z;player.hp=100;player.armor=0;__U.d.clear();return true;})()`);
 const run=async ms=>{for(let t=0;t<ms;t+=50){await adv(50);keep();}};
 const D=k=>Math.round(xe(`__U.d.get(${JSON.stringify(k)})||0`));
 if(!xe('bots.filter(b=>b.g).length>=3&&allies.filter(a=>a.g).length>=2'))fail('need three bots and two ally bots');else{
  const A0=xe('allies[0].name'),A1=xe('allies[1].name'),B0=xe('bots[0].name'),B1=xe('bots[1].name');
  // ---- Hot Hands: ally bot Phoenix at an enemy bot 8 m away; caster's mate in it takes a third; the caster none ----
  place([['a',0,0,-2],['b',0,0,-10],['a',1,1.5,-10],['b',1,0,-30]]);keep();
  xe('blocked=()=>false;window.__z=xBHotHands(allies[0],true,allies[0].g.position,bots[0].g.position.x,bots[0].g.position.z);blocked=__bl;true');
  eq(xe('[Math.round(Math.hypot(__z.p.x-allies[0].g.position.x,__z.p.z-allies[0].g.position.z)),__z.R,__z.t,__z.own===allies[0],__z.en]'),[8,4.5,4,true,false],'Hot Hands lands at the target (8 m, inside the 13 m reach), XHOT radius / life, owned by the ally bot');
  await run(2000);const hb=D(B0+'|'+A0),hm=D(A1+'|'+A0),hc=D(A0+'|'+A0),hf=D(B1+'|'+A0);
  const hl=xe('__U.l.filter(e=>e[0]==='+JSON.stringify(B0+'|'+A0)+').map(e=>e[3])'),rate=hb/((hl[hl.length-1]-hl[0])/1000+1/60);ok(hb>80&&Math.abs(rate-60)<4,'Hot Hands burns the enemy bot 60/s ('+hb+', '+rate.toFixed(1)+'/s)');ok(hm>hb/3-8&&hm<=hb/3+1,'the caster\'s mate in it takes a third ('+hm+' vs '+hb+')');eq([hc,hf],[0,0],'never the caster, nobody outside');
  await run(2600);eq(xe('J.zones.includes(__z)'),false,'Hot Hands gone after its 4 s');
  // enemy bot Phoenix at the player
  place([['b',0,0,-6]]);keep();xe('blocked=()=>false;xBHotHands(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;true');await run(1000);
  ok(D('P|'+B0)>20,'enemy bot Hot Hands burns the player ('+D('P|'+B0)+')');
  // ---- Slow Orb: enemy bot Sage; everyone in 3.5 m slowed 7 s ----
  place([['b',0,0,-8],['a',0,2,-1]]);keep();xe('blocked=()=>false;window.__s=xBSlowOrb(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;true');
  eq(xe('[sgSlow(player),sgSlow(allies[0].g.position),sgSlow(bots[0].g.position),__s.t]'),[0.5,0.5,1,7],'Slow Orb halves speed in 3.5 m (player, ally), not 8 m away; 7 s');
  await run(7200);eq(xe('sgSlow(player)'),1,'Slow Orb over after 7 s');
  // ---- Shock Bolt: ally bot Sova onto an enemy bot 12 m away: 75 on landing, 3 m ----
  place([['a',0,0,0],['b',0,0,-12],['b',1,3.5,-12]]);keep();xe('blocked=()=>false;xBShock(allies[0],true,allies[0].g.position,bots[0].g.position.x,bots[0].g.position.z);blocked=__bl;true');
  eq(D(B0+'|'+A0),0,'Shock Bolt: nothing in flight');await run(600);eq([D(B0+'|'+A0),D(B1+'|'+A0)],[75,0],'Shock Bolt 75 in 3 m on landing (3.5 m aside spared)');
  // ---- Paranoia: enemy bot Omen at the player: player nearsighted, ally bot in the path blinded, Omen not ----
  place([['b',0,0,-10],['a',0,1,-5]]);keep();xe('xBParanoia(bots[0],false,bots[0].g.position,player.x,player.z);allies[0].blind=0;bots[0].blind=0;true');await run(1400);
  eq(xe('[document.getElementById("xNs").classList.contains("on"),allies[0].blind>0,!(bots[0].blind>0)]'),[true,true,true],'Paranoia nearsights the player and the ally bot it passes, never Omen');
  // ---- Cyber Cage: a 7 s cylinder smoke short of a wall, within 10 m ----
  const n0=xe('J.smokes.length');place([['b',0,0,-4]]);keep();xe('blocked=()=>false;window.__cg=xBCage(bots[0],false,bots[0].g.position,player.x,player.z+20);blocked=__bl;true');
  eq(xe(`[J.smokes.length-${n0},J.smokes[J.smokes.length-1].t,J.smokes[J.smokes.length-1].cyl>0,Math.round(__cg.k)]`),[1,7,true,10],'Cyber Cage: one 7 s cylinder, 10 m reach');
  xe('blocked=(x,z)=>Math.hypot(x-bots[0].g.position.x,z-(bots[0].g.position.z+3))<0.4;window.__cg=xBCage(bots[0],false,bots[0].g.position,player.x,player.z+20);blocked=__bl;true');ok(xe('__cg.k<3'),'Cyber Cage lands short of a wall');
  // ---- Trailblazer: enemy bot Skye at the player 5 m away: concussed + 30 bite ----
  place([['b',0,0,-12],['a',0,6,0]]);keep();xe('xCU=0;allies[0].cnc=0;blocked=()=>false;window.__tb=xBTrail(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;true');
  eq(xe('[__tb,xCU>performance.now(),!(allies[0].cnc>0)]'),[1,true,true],'Trailblazer concusses the player in 3.5 m (ally bot 6 m off spared)');eq(D('P|'+B0),30,'Trailblazer bite 30 on the nearest');
  // ---- Turret: enemy bot Killjoy facing the player 10 m away ----
  place([['b',0,0,-11.5],['a',0,0,-30]]);keep();xe('blocked=()=>false;window.__t=xBTurret(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;true');
  const h=[];for(const ms of [2700,700,600]){await run(ms);h.push(D('P|'+B0));}
  eq(h,[0,0,24],'bot Turret: nothing through the 2.7 s deploy + 0.75 s windup, then a 3 x 8 burst at 10 m');eq(D(A0+'|'+B0),0,'the turret never shoots its own team');
  xe('__t.hp=0;true');await run(100);eq(xe('XBTU.length'),0,'a shot-down turret is removed');
  xe('xBTurret(bots[0],false,bots[0].g.position,player.x,player.z);jClear();true');eq(xe('XBTU.length'),0,'a round clear removes bot turrets');
  xe('hurt=__hu;xBotDmg=__bd;xFFArea=__ff;los=__lo;blocked=__bl;bots.concat(allies).forEach(b=>{b.det=0;b.__p=null;});true');}
 if(H.errors.length>errs0)fail('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.message||e)).join(' | '));
 if(fails.length){console.log(fails.join('\n'));process.exit(1);}console.log('bot utility offline: Hot Hands, Slow Orb, Shock Bolt, Paranoia, Cyber Cage, Trailblazer, Turret team-aware with the player values');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
