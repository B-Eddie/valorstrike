// Buy phase abilities (the owner, 2026-11-07: the actual VALORANT buy phase; supersedes the 2026-11-06 universal allowance).
// Only the VALORANT buy-phase setup abilities cast while the spawn walls stand (wiki.playvalorant.com/en-us/Abilities,
// valorant.fandom.com/wiki/Abilities, fetched 2026-11-07): Astra Astral Form, Chamber all, Cypher Trapwire / Cyber Cage
// (placement) / Spycam, Deadlock Sonic Sensor, Jett Updraft, Killjoy Nanoswarm (placement) / Alarmbot / Turret, Neon High Gear
// (no energy / slide charge), Omen Shrouded Step, Raze Blast Pack, Sage Healing Orb, Viper Poison Cloud / Toxic Screen
// (placement), Vyse Razorvine / Arc Rose (placement) / Shear, Yoru Fakeout (stationary) / Gatecrash (placement). Hush and Miks
// (not VALORANT agents) are left as they were. Credits are spent at purchase; a used charge cannot be bought back past the
// round's maximum and buy / sell never makes a charge (Riot 13.01); cooldowns start at the round start.
//  1. the page's XBPA = the server's BUY_PHASE (abilities.js).
//  2. real page (page_harness, offline 5v5, buy phase, menu closed): the outermost jKey refuses keys outside the table (charges
//     and ult kept), casts the listed ones, keeps placement-only ones from activating; jBuy's round maximum; cooldown hold.
//    node work/test_buy_phase_abilities.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
(async()=>{
 // ---------- 1. page table = server table ----------
 const {BUY_PHASE}=await import(path.join(__dirname,'..','server','src','abilities.js'));
 const m=/const XBPA = (\{[^}]*\});/.exec(html);assert.ok(m,'XBPA on the page');const XBPA=Function('return '+m[1])();
 assert.deepEqual(XBPA,BUY_PHASE,'page XBPA = server BUY_PHASE');
 // ---------- 2. real page ----------
 const {boot}=require('./page_harness.cjs');const H=boot({seed:4,real3:true}),xe=H.xe;
 const tick=()=>new Promise(r=>setImmediate(r)),adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();}};
 const frames=async(n,ms=1000/60)=>{for(let i=0;i<n;i++){H.advance(ms);await tick();}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 const as=(ag)=>{xe(`FV.buy=40;FV.cr=9000;if(FV.menu)buyMenu(false);player.hp=100;J.pick=${JSON.stringify(ag)};jRound(false);if(typeof a18Reset==="function"&&A18SET.has(J.pick))a18Reset();J.c=Math.max(1,K().mx.c||1);J.q=Math.max(1,K().mx.q||1);J.e=Math.max(1,K().mx.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};true`);};
 const st=()=>JSON.parse(xe('JSON.stringify({c:J.c,q:J.q,e:J.e,ult:J.ult})'));
 const key=k=>xe(`jKey("Key${k.toUpperCase()}")`);
 const cast=async k=>{key(k);await frames(40);if(xe('!!J.eq'))xe('fcd=0;shoot();true');await frames(40);};/* equip-then-fire abilities: FIRE throws */
 // refused keys keep everything
 let refused=0;
 for(const ag of ['Jett','Phoenix','Sova','Sage','Reyna','Omen','Killjoy','Raze','Skye','Breach','Cypher','Chamber','Brimstone','Clove','Fade','Gekko','KAY/O','Iso','Waylay','Tejo','Veto','Harbor','Viper','Neon','Deadlock','Vyse','Yoru','Astra']){
  for(const k of ['c','q','e','x']){if((XBPA[ag]||'').includes(k))continue;as(ag);const s0=st();key(k);await frames(2);const s1=st();
   assert.deepEqual(s1,s0,ag+' '+k+' must not cast in the buy phase (charges / ult kept)');assert.ok(!xe('!!J.eq'),ag+' '+k+': nothing drawn');refused++;}}
 console.log('refused',refused,'buy-phase keys outside XBPA');
 assert.ok(!xe('xBpBlock("x")||(J.pick="Hush",xBpBlock("x"))||xBpBlock("c")'),'Hush unchanged: every key passes');
 // Jett: Updraft casts, credits at purchase, round maximum, no sell of a used charge, no Blade Storm throws
 as('Jett');xe('J.q=0;J.r0={c:J.c,q:0,e:J.e};J.r0R=FV.you+FV.them;FV.bt=null;true');const cr0=xe('FV.cr');
 xe('fBuy("ab:q");true');assert.equal(xe('J.q'),1);assert.equal(xe('FV.cr'),cr0-150,'credits spent at purchase');
 xe('player.vy=0;true');key('q');await frames(40);assert.equal(xe('J.q'),0,'Updraft cast in the buy phase');assert.equal(xe('FV.cr'),cr0-150,'nothing charged at cast');
 xe('J.cd.q=0;fBuy("ab:q");true');assert.equal(xe('J.q'),0,'a used Updraft is not bought back (round max 1)');assert.equal(xe('FV.cr'),cr0-150);
 assert.equal(xe('fSell("ab:q")'),false,'the used charge is not refunded');
 xe('J.bsOn=true;J.bs=5;J.cd.x=0;jThrow();true');assert.equal(xe('J.bs'),5,'no Blade Storm throw in the buy phase');xe('J.bsOn=false;J.bs=0;true');
 // buy / resell never makes a charge: Cypher Trapwire (max 2)
 as('Cypher');xe('J.c=0;J.r0={c:0,q:J.q,e:J.e};J.r0R=FV.you+FV.them;FV.bt=null;FV.cr=1000;true');
 xe('fBuy("ab:c");fBuy("ab:c");fBuy("ab:c");true');assert.equal(xe('J.c'),2);assert.equal(xe('FV.cr'),600);
 xe('J.c--;true');/* one used */assert.equal(xe('fSell("ab:c")'),true);assert.equal(xe('J.c'),0);assert.equal(xe('FV.cr'),800);assert.equal(xe('fSell("ab:c")'),false,'the used one is not refunded');
 xe('fBuy("ab:c");true');assert.equal(xe('J.c'),1,'one more: 1 used + 1 held = 2');xe('fBuy("ab:c");true');assert.equal(xe('J.c'),1,'the round max counts the used charge');
 xe('for(let i=0;i<6;i++){fSell("ab:c");fBuy("ab:c");}true');assert.equal(xe('J.c'),1);assert.equal(xe('FV.cr'),600,'buy / sell cycles end where they started');
 // Omen: Shrouded Step casts; Sage: Healing Orb casts and its cooldown waits for the round start
 as('Omen');const oc=xe('J.c');key('c');await frames(40);if(xe('!!J.eq'))xe('fcd=0;shoot();true');await frames(40);assert.ok(xe('!!J.om')||xe('J.c')<oc,'Shrouded Step in the buy phase');xe('if(J.om){okRm(J.om);J.om=null;}true');
 as('Sage');xe('player.hp=60;true');await cast('e');const cd0=xe('J.cd.e');assert.ok(cd0>40,'Healing Orb cast, cooldown set ('+cd0+')');
 await frames(60);assert.equal(xe('J.cd.e'),cd0,'the cooldown holds in the buy phase');
 xe('FV.buy=0.02;true');await frames(70);assert.ok(xe('!(FV.buy>0)'),'round started');assert.ok(xe('J.cd.e')<cd0-0.9,'the cooldown runs from the round start ('+xe('J.cd.e')+')');
 // Viper: emitters placed off, no toggle in the buy phase; on at round start through the toggle
 as('Viper');key('q');await frames(2);assert.ok(xe('!!J.a18.cloud&&!J.a18.cloudOn&&!J.a18.cloudM'),'Poison Cloud placed off');xe('J.cd.q=0;true');key('q');assert.ok(xe('!J.a18.cloudOn'),'no toggle in the buy phase');
 key('e');assert.ok(xe('!!J.a18.screen&&!J.a18.toxOn'),'Toxic Screen placed off');
 xe('FV.buy=0;J.cd.q=0;true');key('q');assert.ok(xe('J.a18.cloudOn&&!!J.a18.cloudM'),'round: the toggle turns it on with its cloud');
 // Yoru: tether at his feet, no teleport / fake; Fakeout stands still
 as('Yoru');const p0=JSON.parse(xe('JSON.stringify([player.x,player.z])'));key('e');assert.deepEqual(JSON.parse(xe('JSON.stringify([J.a18.gate.x,J.a18.gate.z])')),p0,'tether at his feet');
 xe('J.cd.e=0;true');key('e');assert.ok(!xe('J.a18.gateTp>0'),'no Gatecrash teleport');xe('xdUse();true');assert.ok(xe('!!J.a18.gate'),'no fake: the tether stays');
 key('c');const dc=()=>xe('JSON.stringify((J.a18fx||[]).filter(f=>f.kind==="decoy").map(f=>[+f.p.x.toFixed(3),+f.p.z.toFixed(3)]))');const d0=dc();await frames(30);assert.equal(dc(),d0,'Fakeout stands still');assert.ok(JSON.parse(d0).length>0,'Fakeout placed');
 // Neon: High Gear spends no charge, no energy
 as('Neon');const e0=xe('J.e'),f0=xe('J.a18.fuel');key('e');assert.ok(xe('J.a18.gear>0'),'High Gear on');assert.equal(xe('J.e'),e0,'no charge');await frames(60);assert.equal(xe('J.a18.fuel'),f0,'no energy');
 // buy menu open: every key is swallowed
 as('Jett');xe('buyMenu(true);true');const s2=st();key('q');assert.deepEqual(st(),s2,'menu open: no cast');xe('buyMenu(false);true');
 console.log('test_buy_phase_abilities: ok (XBPA = server BUY_PHASE; '+refused+' keys refused; Updraft / Shrouded Step / Healing Orb / placements cast; placement only; round max; no buy-resell charge; cooldowns from the round start)');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
