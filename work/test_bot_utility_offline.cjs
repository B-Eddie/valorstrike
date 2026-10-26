// Offline bot utility casts that had no bot path (index.html xBHotHands / xBSlowOrb / xBShock / xBParanoia / xBCage /
// xBTrail / xBTurret / xBBlaze / xBBarrier), on the real page (work/page_harness.cjs): team-aware with the player's values. Hot Hands spreads to
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
  // ---- Shock Bolt: ally bot Sova onto an enemy bot 12 m away: 75 on landing inside 1.5 m, falling to 1 at 4 m (wiki) ----
  place([['a',0,0,0],['b',0,0,-12],['b',1,3.5,-12],['b',2,4.5,-12]]);keep();xe('blocked=()=>false;xBShock(allies[0],true,allies[0].g.position,bots[0].g.position.x,bots[0].g.position.z);blocked=__bl;true');
  eq(D(B0+'|'+A0),0,'Shock Bolt: nothing in flight');await run(600);eq([D(B0+'|'+A0),D(B1+'|'+A0),D(xe('bots[2].name')+'|'+A0)],[75,16,0],'Shock Bolt 75 on landing, 16 at 3.5 m aside, none at 4.5 m (falloff 75 -> 1 over 1.5-4 m)');
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
  // ---- Blaze (XBLZ = server DEV.blaze): enemy bot Phoenix 3 m from the player: a straight wall along its line toward the
  // player from 1 m ahead of its feet to 12 m, 8 s, 30/s within 0.8 m of the line (the caster's team a third), blocks sight
  // across it, not beside it; shorter in front of a wall ----
  eq(xe('[XBLZ.life,XBLZ.length,XBLZ.width,XBLZ.damage,XBLZ.heal,XHOT.heal]'),[8,12,0.8,30,12.5,12.5],'Blaze / Hot Hands values = server devices.js DEV.blaze / DEV.hotHands');
  place([['b',0,0,-3],['a',0,0.5,3],['b',1,-0.5,5],['a',1,1.2,0]]);keep();xe('blocked=()=>false;window.__bz=xBBlaze(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;true');
  eq(xe('[Math.round(Math.hypot(__bz.p.x-bots[0].g.position.x,__bz.p.z-bots[0].g.position.z)*10)/10,__bz.h,__bz.t,__bz.en,__bz.own===bots[0],Math.round(Math.abs(__bz.az)*100)/100,J.walls.includes(__bz),Math.round(__bz.m.scale.z*10)/10]'),[6.5,5.5,8,true,true,1,true,11],'Blaze: 11 m wall from 1 m to 12 m along the line to the player, 8 s, enemy-owned');
  await run(1000);{const bp=D('P|'+B0),ba=D(A0+'|'+B0),bm=D(B1+'|'+B0),bo=D(A1+'|'+B0);ok(bp>=25&&bp<=36,'Blaze burns the player ~30/s ('+bp+')');ok(ba>=25&&ba<=36,'and the ally bot 0.5 m off its line ('+ba+')');ok(bm>=7&&bm<=13,'the caster\'s mate in it takes a third ('+bm+')');eq(bo,0,'nobody 1.2 m off the line');}
  eq(xe('(()=>{const o=__U.o,a=new THREE.Vector3(o.x-6,1.5,o.z+1),d=new THREE.Vector3(1,0,0);const b2=new THREE.Vector3(o.x+2,1.5,o.z-6),d2=new THREE.Vector3(0,0,1);return [jBlock(a,d,12),jBlock(b2,d2,14)];})()'),[true,false],'Blaze blocks sight across it, not 2 m beside it');
  await run(7300);eq(xe('J.walls.includes(__bz)'),false,'Blaze gone after 8 s');
  xe('blocked=(x,z)=>Math.hypot(x-bots[0].g.position.x,z-bots[0].g.position.z)>=4&&Math.hypot(x-bots[0].g.position.x,z-bots[0].g.position.z)<4.3;window.__bz=xBBlaze(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;true');
  eq(xe('[Math.round(__bz.h*100)/100,Math.round(Math.hypot(__bz.p.x-bots[0].g.position.x,__bz.p.z-bots[0].g.position.z)*100)/100]'),[1.35,2.35],'Blaze stops 0.3 m short of a wall 4 m out');xe('jClear();true');
  // the player's Blaze: the same wall along the aim; Phoenix heals 12.5/s standing in it
  place([['b',0,30,0]]);keep();xe('blocked=()=>false;window.__pz=blazeWall(player.x,player.y||0,player.z,0,-1);blocked=__bl;player.z-=3;player.hp=50;true');eq(xe('[__pz.own===undefined,__pz.h,Math.round(__pz.ax*100)/100,Math.round(__pz.az*100)/100]'),[true,5.5,0,-1],'player Blaze along the aim');
  {const h0=xe('player.hp');for(let t=0;t<1000;t+=50){H.advance(50);await new Promise(r=>setImmediate(r));}const dh=xe('player.hp')-h0;ok(dh>=11&&dh<=14.5,'Phoenix heals 12.5/s in his own Blaze ('+dh.toFixed(1)+')');}xe('player.z+=3;jClear();true');
  // ---- Barrier Orb: enemy bot Sage 5 m from the player: the 6 m ice wall 2.5 m out, solid (movement, sight), 600 HP to gunfire, 40 s ----
  place([['b',0,0,-5]]);keep();xe('blocked=()=>false;window.__bw=xBBarrier(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;true');
  eq(xe('[XBSW.length,__bw.hp,__bw.t,Math.round(Math.hypot(__bw.p.x-bots[0].g.position.x,__bw.p.z-bots[0].g.position.z)*10)/10,solids.includes(__bw.m),__bw.m.userData.sw===__bw]'),[1,600,40,2.5,true,true],'Barrier: one wall 2.5 m out, 600 HP, 40 s, in solids');
  eq(xe('(()=>{const w=__bw,y=player.y||0;return [sgBlk(w.p.x,w.p.z,0.3,y),sgBlk(w.p.x+w.ax*2.5,w.p.z+w.az*2.5,0.3,y),sgBlk(w.p.x+w.ax*4,w.p.z+w.az*4,0.3,y),sgBlk(w.p.x-w.az*1,w.p.z+w.ax*1,0.3,y),blocked(w.p.x,w.p.z,0.3,y)];})()'),[true,true,false,false,true],'Barrier blocks movement along its 6 m (sgBlk / blocked), not past its end or 1 m in front');
  eq(xe('(()=>{const w=__bw,y=(player.y||0)+1.5,q=bots[0].g.position;XLOS.clear();return losRaw(new THREE.Vector3(player.x,y,player.z),new THREE.Vector3(q.x,(q.y||0)+1.5,q.z));})()'),false,'Barrier blocks sight / shots between the player and the Sage');
  xe('sgDmg(250,__bw.m.userData.sw);true');eq(xe('[XBSW.length,__bw.hp,J.sw]'),[1,350,null],'gunfire on a bot barrier damages that barrier (not the player\'s)');
  xe('sgDmg(400,__bw.m.userData.sw);true');eq(xe('[XBSW.length,solids.includes(__bw.m)]'),[0,false],'a broken barrier is gone from the world');
  xe('blocked=()=>false;window.__bw=xBBarrier(bots[0],false,bots[0].g.position,player.x,player.z);window.__bw2=xBBarrier(bots[0],false,bots[0].g.position,player.x+5,player.z);blocked=__bl;true');eq(xe('[XBSW.length,XBSW[0]===__bw2,solids.includes(__bw.m)]'),[1,true,false],'one barrier per Sage');
  xe('__bw2.t=0.1;true');await run(200);eq(xe('XBSW.length'),0,'barrier expires');
  xe('blocked=()=>false;xBBarrier(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;jClear();true');eq(xe('XBSW.length'),0,'a round clear removes bot barriers');
  xe('blocked=(x,z)=>Math.hypot(x-bots[0].g.position.x,z-(bots[0].g.position.z+2.5))<0.4;window.__bw=xBBarrier(bots[0],false,bots[0].g.position,player.x,player.z);blocked=__bl;true');ok(xe('Math.hypot(__bw.p.x-bots[0].g.position.x,__bw.p.z-bots[0].g.position.z)<2.2'),'Barrier set short of a wall');xe('jClear();true');
  xe('hurt=__hu;xBotDmg=__bd;xFFArea=__ff;los=__lo;blocked=__bl;bots.concat(allies).forEach(b=>{b.det=0;b.__p=null;});true');}
 if(H.errors.length>errs0)fail('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.message||e)).join(' | '));
 if(fails.length){console.log(fails.join('\n'));process.exit(1);}console.log('bot utility offline: Hot Hands, Slow Orb, Shock Bolt, Paranoia, Cyber Cage, Trailblazer, Turret, Blaze, Barrier Orb team-aware with the player values');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
