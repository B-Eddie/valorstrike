// Offline bots shoot down destroyable enemy utility (qa-20; index.html xUtilShoot / xUtilCands / xUtilAcross, decision = the
// shared vendor/bot-brain.cjs shootUtility, as the server's spike.js shootUtility). Real page (work/page_harness.cjs):
// an enemy bot with no enemy in sight turns onto the player's Turret and shoots it down with its gun in the real bot loop;
// the player's Barrier only when it stands across the bot's way; ally bots shoot an enemy bot's Turret / Boom Bot / Barrier;
// the player's Alarmbot; direct calls clear xywT (the turn-rate pass, BOT VARIETY xbTurned, runs only in the frame loop); damage = the gun's body damage per bullet (wDmg) at its fire rate; HP = server devices.js SHOOT.
//   node work/test_bot_shoot_utility_offline.cjs
const {boot}=require('./page_harness.cjs');
const fails=[];const fail=s=>fails.push(s);const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m+': got '+JSON.stringify(a)+' want '+JSON.stringify(b));};const ok=(c,m)=>{if(!c)fail(m);};
(async()=>{
 const H=boot({real3:true,seed:5}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const errs0=H.errors.length;
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 if(!xe('running&&player.hp>0'))fail('no live round');
 eq(xe('[XSHOOT.boombot,XSHOOT.turret,XSHOOT.alarmbot,XSHOOT.barrier,typeof BotBrain.shootUtility]'),[60,100,20,600,'function'],'device HP = server devices.js SHOOT / barrier 600');
 // every bot frozen (detained) and parked far away; the units never see each other (los only sees the device under test)
 xe(`(()=>{window.__S={o:{x:player.x,z:player.z},t:null};bots.concat(allies).forEach(b=>{b.det=1e9;b.g&&b.g.position.set(player.x+300,b.g.position.y,player.z);});
  window.__lo=los;los=(a,q)=>!!__S.t&&Math.hypot(q.x-__S.t.x,q.z-__S.t.z)<2.5;window.__bl=blocked;timeLeft=Math.max(timeLeft,90);player.x+=200;return true;})()`);
 const keep=()=>xe('timeLeft=Math.max(timeLeft,60);if(player.hp<100)player.hp=100;true');
 const run=async ms=>{for(let t=0;t<ms;t+=50){await adv(50);keep();}};
 if(!xe('bots.filter(b=>b.g).length>=1&&allies.filter(a=>a.g).length>=1'))fail('need a bot and an ally bot');else{
  // ---- 1. real bot loop: an enemy bot (Vandal) 10 m from the player's Turret shoots it down ----
  xe(`(()=>{const o=__S.o,b=bots[0];b.det=0;b.alive=true;b.hp=100;b.w="Vandal";b.blind=0;b.cnc=0;b.g.position.set(o.x,b.g.position.y,o.z);b.xUsN=0;b.cd=0;
   const m=new THREE.Mesh(kjTur,new THREE.MeshBasicMaterial());m.position.set(o.x,0.45,o.z-10);scene.add(m);J.tur={m,p:m.position,fx:0,fz:1,hp:100,cd:99};__S.t=m.position;return true;})()`);
  await run(3000);
  ok(xe('J.tur===null'),'enemy bot shot the player\'s Turret down in the real bot loop (J.tur '+xe('J.tur&&J.tur.hp')+')');
  const n=xe('bots[0].xUsN');ok(n>=3&&n<=8,'bullets fired at it: '+n+' (100 HP / Vandal body 40 at 10 m = 3)');
  xe('bots[0].det=1e9;bots[0].g.position.x+=300;__S.t=null;true');
  // ---- 2. the player's Barrier: shot only when across the bot's way ----
  xe(`(()=>{const o=__S.o,b=bots[0];b.det=0;b.g.position.set(o.x,b.g.position.y,o.z);b.xUsN=0;b.cd=0;sgWallEnd();
   const m=new THREE.Mesh(sgWallGeo,new THREE.MeshBasicMaterial({transparent:true}));const p=new THREE.Vector3(o.x,1.5,o.z-6);m.position.copy(p);scene.add(m);solids.push(m);m.userData.sw=true;
   J.sw={m,p,ax:1,az:0,t:40,hp:600,arr:solids};__S.t=p;b.xUg=[o.x+20,o.z];return true;})()`);
  const from='new THREE.Vector3(bots[0].g.position.x,(bots[0].g.position.y||0)+1.7,bots[0].g.position.z)';
  eq(xe(`[xUtilAcross(bots[0],J.sw),xUtilShoot(bots[0],0.05,${from},true),J.sw.hp]`),[false,false,600],'heading off to the side: the barrier is left alone');
  xe('bots[0].xUg=[__S.o.x,__S.o.z-25];true');eq(xe('xUtilAcross(bots[0],J.sw)'),true,'heading through it: across its way');
  xe(`(()=>{for(let i=0;i<200&&J.sw;i++){bots[0].xywT=0;xUtilShoot(bots[0],0.05,${from},true);}return true;})()`);
  ok(xe('J.sw===null'),'barrier across the way shot down (600 HP)');const nb=xe('bots[0].xUsN');ok(nb>=15&&nb<=17,'Vandal bullets to break it: '+nb+' (600 / 40 = 15)');
  xe('bots[0].xUg=[__S.o.x+0.2,__S.o.z-25];bots[0].g.position.z=__S.o.z-15;true');
  xe(`(()=>{const m=new THREE.Mesh(sgWallGeo,new THREE.MeshBasicMaterial({transparent:true}));const p=new THREE.Vector3(__S.o.x,1.5,__S.o.z-6);m.position.copy(p);scene.add(m);solids.push(m);J.sw={m,p,ax:1,az:0,t:40,hp:600,arr:solids};return true;})()`);
  eq(xe(`[xUtilAcross(bots[0],J.sw),xUtilShoot(bots[0],0.05,${from},true)]`),[false,false],'barrier behind the bot (heading away): not shot');xe('sgWallEnd();bots[0].det=1e9;bots[0].g.position.x+=300;true');
  // ---- 3. ally bot shoots an enemy bot's Turret, Boom Bot and Barrier; never its own team's ----
  xe(`(()=>{const o=__S.o,a=allies[0];a.det=0;a.alive=true;a.hp=100;a.w="Phantom";a.g.position.set(o.x,a.g.position.y,o.z);a.xUsN=0;a.cd=0;window.__af=new THREE.Vector3(o.x,(a.g.position.y||0)+1.7,o.z);
   const m=new THREE.Mesh(kjTur,new THREE.MeshBasicMaterial());m.position.set(o.x+2,0.45,o.z-12);scene.add(m);window.__T=xBbShootable({m,p:m.position,fx:0,fz:1,hp:100,cd:99,lock:0,shot:0,own:bots[0],en:true});XBTU.push(__T);
   const m2=new THREE.Mesh(kjTur,new THREE.MeshBasicMaterial());m2.position.set(o.x-2,0.45,o.z-12);scene.add(m2);window.__T2={m:m2,p:m2.position,fx:0,fz:1,hp:100,cd:99,own:allies[1]||allies[0],en:false};XBTU.push(__T2);__S.t=null;return true;})()`);
  xe('los=()=>true;true');
  xe(`(()=>{for(let i=0;i<40&&__T.hp>0;i++){allies[0].xywT=0;xUtilShoot(allies[0],0.05,__af,false);}return true;})()`);
  eq(xe('[__T.hp<=0,__T2.hp]'),[true,100],'ally bot shot the enemy Turret, not its own team\'s');
  xe('xBTurClr();true');
  xe(`(()=>{const o=__S.o;window.__B=xBbShootable({m:rsMesh(0xff8a1f,1.6,new RV(o.x,0.4,o.z-9)),dx:0,dz:1,t:5,hp:60,own:bots[0],en:true});__B.t=99;RS.bb.push(__B);allies[0].cd=0;return true;})()`);
  eq(xe('(()=>{allies[0].xywT=0;xUtilShoot(allies[0],0.05,__af,false);return [allies[0].xUs,__B.hp<60];})()'),['boombot',true],'ally bot shoots an incoming enemy Boom Bot first');
  xe(`(()=>{for(let i=0;i<40&&__B.hp>0;i++){allies[0].xywT=0;xUtilShoot(allies[0],0.05,__af,false);}return true;})()`);ok(xe('__B.hp<=0'),'enemy Boom Bot shot down (60 HP)');xe('RS.bb.forEach(xBbGone);RS.bb.length=0;true');
  xe(`(()=>{const o=__S.o,w=xBBarrier(bots[0],false,new THREE.Vector3(o.x,0,o.z-8.5),o.x,o.z);allies[0].xUg=[o.x,o.z-30];window.__W=w;return true;})()`);
  eq(xe('[__W.en,xUtilAcross(allies[0],__W)]'),[true,true],'enemy bot barrier across the ally\'s way');
  xe(`(()=>{for(let i=0;i<200&&XBSW.includes(__W);i++){allies[0].xywT=0;xUtilShoot(allies[0],0.05,__af,false);}return true;})()`);ok(xe('!XBSW.includes(__W)'),'ally broke the enemy barrier');
  // ---- 4. the player's Alarmbot (20 HP) ----
  xe(`(()=>{const o=__S.o,b=bots[0];b.det=0;b.g.position.set(o.x,b.g.position.y,o.z);b.cd=0;const m=new THREE.Mesh(kjBox,new THREE.MeshBasicMaterial());m.position.set(o.x,0.3,o.z-6);scene.add(m);J.ab={m,p:m.position};return true;})()`);
  xe(`(()=>{for(let i=0;i<20&&J.ab;i++){bots[0].xywT=0;xUtilShoot(bots[0],0.05,${from},true);}return true;})()`);ok(xe('J.ab===null'),'enemy bot shot the player\'s Alarmbot (20 HP)');
  // ---- 5. a knife or a blinded bot does not shoot ----
  xe(`(()=>{const o=__S.o;const m=new THREE.Mesh(kjTur,new THREE.MeshBasicMaterial());m.position.set(o.x,0.45,o.z-10);scene.add(m);J.tur={m,p:m.position,fx:0,fz:1,hp:100,cd:99};bots[0].cd=0;return true;})()`);
  eq(xe(`(()=>{const b=bots[0];b.w="Knife";const k=xUtilShoot(b,0.05,${from},true);b.w="Vandal";b.blind=2;const bl=xUtilShoot(b,0.05,${from},true);b.blind=0;return [k,bl,J.tur.hp];})()`),[false,false,100],'knife / blinded: no shooting');
  xe('okRm(J.tur);J.tur=null;los=__lo;blocked=__bl;bots.concat(allies).forEach(b=>{b.det=0;});true');}
 if(H.errors.length>errs0)fail('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.message||e)).join(' | '));
 if(fails.length){console.log(fails.join('\n'));process.exit(1);}console.log('bots shoot utility offline: real bot loop downs the player\'s Turret; Barrier only across the way (600 HP); allies down enemy Turret / Boom Bot / Barrier, not their own; Alarmbot; knife / blind do not shoot');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
