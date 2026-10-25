// v9.10 armor on the real page (offline 5v5; wiki.playvalorant.com/en-us/Armor_and_Shield): the buy menu's Armor column reads
// Light Armor 400 / Regen Shield 650 / Heavy Armor 1000 (renamed from Light / Heavy Shields); the Regen Shield holds 25,
// absorbs 100% of a hit, refills from its 50 pool XRGN.delay s after the last absorbed hit (XRGN == server RGN); sell and
// replace restore it; the HUD shows the pool; a surviving player carries armor and pool into the next round.
const path=require('path'),assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
(async()=>{
 const {RGN}=await import(path.join(__dirname,'..','server','src','simulation.js'));
 const H=boot({real3:true,seed:11}),xe=H.xe,errs0=H.errors.length;
 assert.deepEqual(JSON.parse(xe('JSON.stringify(XRGN)')),{...RGN},'page XRGN == server RGN');
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 assert.equal(xe('JSON.stringify(BUY.find(c=>c[0]==="Armor"))'),JSON.stringify(['Armor',[['Light Armor',400,25],['Regen Shield',650,25],['Heavy Armor',1000,50]]]));
 assert.ok(!/Shields/.test(xe('JSON.stringify(BUY)')),'no "Shields" item left');
 xe('FV.cr=9000;FV.buy=20;FV.menu=true;player.armor=0;player.rgn=undefined;FV.bt=[];buyRender();true');
 const grid=()=>xe('document.getElementById("xBG").innerHTML');assert.ok(/Light Armor/.test(grid())&&/Regen Shield/.test(grid())&&/Heavy Armor/.test(grid()),'cards');
 const st=()=>JSON.parse(xe('JSON.stringify({a:player.armor,r:player.rgn===undefined?"u":player.rgn,cr:FV.cr})'));
 xe('fBuy("Regen Shield");true');assert.deepEqual(st(),{a:25,r:50,cr:8350});
 xe('fBuy("Regen Shield");true');assert.equal(st().cr,8350,'full Regen Shield not bought twice');
 xe('fBuy("Light Armor");true');assert.deepEqual(st(),{a:25,r:'u',cr:8600},'light replaces regen (regen refunded)');
 xe('fBuy("Regen Shield");true');assert.deepEqual(st(),{a:25,r:50,cr:8350});
 xe('fSell("Regen Shield");true');assert.deepEqual(st(),{a:0,r:'u',cr:9000},'sell back');
 xe('fBuy("Regen Shield");true');xe('xHud();true');assert.equal(xe('document.getElementById("xArm").getAttribute("data-rg")'),'50','HUD pool');
 assert.ok(/Regen Shield/.test(xe('document.getElementById("xBL").textContent'))||/25 armor/.test(xe('document.getElementById("xBL").textContent')),'loadout line says armor');
 // 100% absorb, delay, refill (the page's own tick)
 xe('FV.buy=0;FV.menu=false;try{buyMenu(false)}catch(e){};player.hp=100;true');
 const ab=xe('armAbs(player,20)');assert.equal(ab,20);assert.equal(st().a,5);
 await adv(2500);assert.equal(st().a,5,'no refill inside the delay');
 await adv(3000);assert.equal(st().a,25,'refilled');assert.equal(st().r,30);
 xe('xHud();true');assert.equal(xe('document.getElementById("xArm").getAttribute("data-rg")'),'30');assert.equal(xe('document.getElementById("xArm").textContent'),'25');
 // Light / Heavy still 66%
 assert.equal(xe('(()=>{const t={armor:50};return armAbs(t,30)})()'),19.8);
 // a bot with a Regen Shield refills too
 assert.equal(xe('(()=>{const b=globalThis.__rb=bots.find(x=>x.alive);b.armor=25;b.rgn=50;b.hp=1e6;armAbs(b,25);return b.armor})()'),0);await adv(5500);
 {const r=JSON.parse(xe('JSON.stringify([__rb.alive,__rb.armor,__rb.rgn])'));assert.ok(r[0]&&r[2]<50&&r[1]+r[2]<=50+1e-6&&r[1]>0,'bot refilled from its pool '+JSON.stringify(r));xe('__rb.hp=100;true');}
 // round carry: a surviving player keeps armor and pool
 xe('player.armor=10;player.rgn=20;player.hp=100;fCheck(true,"QA","QA");true');
 assert.equal(xe('FV.arm'),10);assert.equal(xe('FV.rgn'),20);
 assert.equal(H.errors.length,errs0,'page errors: '+H.errors.slice(errs0).join(' | '));
 console.log('Regen Shield (page, offline 5v5): Armor column Light Armor 400 / Regen Shield 650 / Heavy Armor 1000, 100% absorb, refill after the 3 s delay from the 50 pool (player and bots), sell / replace restore, HUD pool, round carry; XRGN == server RGN');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
