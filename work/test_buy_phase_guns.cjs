// Buy phase guns (the owner, 2026-11-07: actual-VALORANT buy phase). In VALORANT a player inside the spawn walls fires on the
// gun's real magazine during the buy phase: held automatic fire keeps firing at the gun's rate, a semi-auto fires again once
// its fire interval passes, a reload finishes, and nothing refills the magazine when the walls drop at round start. The walls
// stop the bullets (server: SpikeSimulation.traceShot / world.ray against SpawnBarriers while spawnWalls()).
// Red before: the page's buy-phase branches (fiveTick offline / P2P host, mpCliTick5 P2P client) returned before tick(),
// so the gun clock never ran: the fire cooldown fcd set by the first shot never counted down (one shot per gun, held fire
// fired once), and a reload never finished.
//  1. real page (page_harness, offline 5v5, buy phase, menu closed): Vandal bought; FIRE held 1 s fires ~9.75 rounds
//     (>= 8) on the real magazine; a Classic (semi) fires a 2nd shot after its interval; an empty magazine reloads to full
//     inside the buy phase; with the buy menu open shoot() still refuses; the barrier drop refills nothing.
//  2. P2P client buy branch (mpCliTick5) runs the same gun clock (source check: xGunTick in both buy branches).
//  3. xSbShotD (vm): a shot ray stops at the spawn wall during the buy phase (SpawnBarriers.ray), not in deathmatch, not
//     after the buy phase, not while NMB.sbOff (bot route warm-up); no native map -> the full range.
//    node work/test_buy_phase_guns.cjs
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fnBlock=s=>{const i=html.indexOf(s);if(i<0)throw Error('page function missing: '+s);return html.slice(i,html.indexOf('\n}',i)+2);};
// ---------- 2. both buy branches run the gun clock ----------
{const ft=fnBlock('function fiveTick(dt) {'),ct=fnBlock('function mpCliTick5(dt) {');
 const buyPart=src=>src.slice(src.indexOf('if (FV.buy > 0) {'),src.indexOf('\n    return;\n  }',src.indexOf('if (FV.buy > 0) {')));
 assert.match(buyPart(ft),/xGunTick\(dt, player\.hp > 0\)/,'offline fiveTick buy branch runs the gun clock');
 assert.match(buyPart(ct),/xGunTick\(dt, player\.hp > 0\)/,'P2P client mpCliTick5 buy branch runs the gun clock');
 assert.match(fnBlock('function tick(dt) {'),/xGunTick\(dt, alive\);/,'the round tick runs the same gun clock');}
// ---------- 3. xSbShotD ----------
{const src=fnBlock('function xSbShotD(o, d, max) {');const calls=[];
 const ctx={mode:'five',FV:{dm:false,buy:20},running:true,NMB:{sbOff:0},nmActive:()=>({key:'ascent'}),
  window:{},Math};
 ctx.window.SpawnBarriers=ctx.SpawnBarriers={has:k=>k==='ascent',ray:(k,o,d,max)=>{calls.push([k,o,d,max]);return 4<max?{distance:4}:null;}};
 vm.createContext(ctx);vm.runInContext(src,ctx);const D=(m)=>vm.runInContext('xSbShotD({x:0,y:7,z:0},{x:0,y:0,z:-1},'+m+')',ctx);
 assert.equal(D(200),4,'buy phase: the shot stops at the wall 4 m out');assert.equal(JSON.stringify(calls[0]),JSON.stringify(['ascent',[0,7,0],[0,0,-1],200]),'ray from the shot origin along its direction');
 assert.equal(D(2),2,'a 2 m knife reach ends before the wall');
 ctx.FV.buy=0;assert.equal(D(200),200,'round running: no wall');ctx.FV.buy=20;
 ctx.FV.dm=true;assert.equal(D(200),200,'deathmatch: no spawn walls');ctx.FV.dm=false;
 ctx.NMB.sbOff=1;assert.equal(D(200),200,'NMB.sbOff (walls treated as down): no wall');ctx.NMB.sbOff=0;
 ctx.mode='duel';assert.equal(D(200),200,'not 5v5: no wall');ctx.mode='five';
 ctx.nmActive=()=>null;assert.equal(D(200),200,'legacy map: no native spawn walls');}
// shoot() / xPellets cap their ray at it
{const sh=fnBlock('function shoot(hv) {'),pl=fnBlock('function xPellets(W, targets) {');
 assert.match(sh,/ray\.far = xSbShotD\(ray\.ray\.origin, ray\.ray\.direction, rf0\)/,'shoot() caps its ray at the spawn wall');
 assert.match(pl,/ray\.far = xSbShotD\(ray\.ray\.origin, d, pf0\)/,'each pellet stops at the spawn wall');
 assert.match(pl,/ray\.far = xSbShotD\(ray\.ray\.origin, d, BA\.dist\)/,'the Bucky canister stops at the spawn wall');}
// ---------- 1. real page ----------
(async()=>{
 const {boot}=require('./page_harness.cjs');const H=boot({seed:3,real3:true}),xe=H.xe;/* real3: the real THREE.Clock, so game time advances (the stub clock's getDelta is 0) */
 const tick=()=>new Promise(r=>setImmediate(r));
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 const frames=async(n,ms=1000/60)=>{for(let i=0;i<n;i++){H.advance(ms);await tick();}};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe('FV.cr=9000;FV.buy=40;player.hp=100;if(FV.menu)buyMenu(false);true');await frames(3);
 assert.ok(xe('FV.buy>0&&!FV.menu&&running'),'in the buy phase, menu closed');
 // Classic (semi-auto): two clicks 0.5 s apart both fire
 xe('fireHeld=false;true');const c0=xe('ammo');assert.equal(xe('wName()'),'Classic','holding the Classic');
 xe('shoot();true');await frames(30);xe('shoot();true');await frames(2);const c1=xe('ammo');
 console.log('Classic: ammo',c0,'->',c1,'(two clicks 0.5 s apart)');
 assert.equal(c0-c1,2,'buy phase: the Classic fires again after its fire interval (fired '+(c0-c1)+' of 2; one-shot lock)');
 // Vandal: held FIRE for 1 s on the real magazine
 xe('fBuy("Vandal");true');await frames(50);/* equip time */assert.equal(xe('wName()'),'Vandal','the bought Vandal is in hand');
 const v0=xe('ammo'),r0=xe('rsv');xe('fireHeld=true;true');await frames(60);xe('fireHeld=false;true');await frames(3);const v1=xe('ammo');
 console.log('Vandal held 1 s: ammo',v0,'->',v1,'reserve',r0);
 assert.ok(v0-v1>=8&&v0-v1<=11,'buy phase: held FIRE fires the Vandal at its rate on the real magazine (fired '+(v0-v1)+' in 1 s, want ~9.75)');
 assert.equal(xe('rsv'),r0,'firing takes from the magazine, not the reserve');
 // empty magazine: the reload finishes inside the buy phase
 xe('ammo=0;reloading=0;fcd=0;shoot();true');assert.ok(xe('reloading>0'),'an empty click starts the reload');
 await frames(Math.ceil(xe('reloading')*60)+10);const mag=xe('MAG()');
 console.log('reload in the buy phase: ammo',xe('ammo'),'/',mag,'reserve',xe('rsv'),'reloading',xe('reloading'));
 assert.equal(xe('reloading'),0,'the reload finished in the buy phase');assert.equal(xe('ammo'),mag,'the reload filled the magazine');assert.equal(xe('rsv'),r0-mag,'from the reserve');
 // menu open: clicks buy, never fire
 xe('fcd=0;buyMenu(true);true');assert.ok(xe('FV.menu'),'menu open');const m0=xe('ammo');xe('shoot();fireHeld=true;true');await frames(20);xe('fireHeld=false;buyMenu(false);true');
 assert.equal(xe('ammo'),m0,'buy menu open: no shot');
 // barrier drop: no refill
 xe('fcd=0;fireHeld=true;true');await frames(12);xe('fireHeld=false;true');await frames(30);const d0=xe('ammo'),dr=xe('rsv');assert.ok(d0<mag,'some rounds spent before the drop ('+d0+'/'+mag+')');
 xe('FV.buy=0.05;true');await frames(10);assert.ok(xe('!(FV.buy>0)&&running'),'the round started');
 console.log('barrier drop: ammo',d0,'->',xe('ammo'),'reserve',dr,'->',xe('rsv'));
 assert.equal(xe('ammo'),d0,'the barrier drop refills nothing (magazine)');assert.equal(xe('rsv'),dr,'the barrier drop refills nothing (reserve)');
 console.log('test_buy_phase_guns: ok (guns fire on real ammo in the buy phase: held fire at the gun rate, semi-auto refire, reload; menu open refuses; no refill at the drop; spawn walls stop shots)');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
