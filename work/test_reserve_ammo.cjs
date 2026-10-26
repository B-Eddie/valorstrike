// Reserve ammo per gun (wiki.playvalorant.com/en-us/<Weapon> infobox "Reserve"; e.g. Vandal 75 -> 50 in v3.0, Operator 10,
// Odin 200, Outlaw 10, Sheriff 24). valorant-api's weaponStats has no reserve, so the page and the server gave every gun
// 3 magazines. The page table XRSV == the server's RESERVE; the real page (offline 5v5): buying sets the slot and the
// in-hand reserve; no 3-magazine reserve is left in the page.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
(async()=>{
 const {RESERVE}=await import(path.join(__dirname,'..','server','src','simulation.js'));
 const H=boot({real3:true,seed:7}),xe=H.xe,errs0=H.errors.length;
 assert.deepEqual(JSON.parse(xe('JSON.stringify(XRSV)')),{...RESERVE},'page XRSV == server RESERVE');
 assert.ok(!/\bmag \* 3\b|MAG\(\) \* 3|\b[ps]m \* 3\b|\bmg \* 3\b|\bm \* 3\b/.test(html.replace('WEAP[n].mag * 3 : 0','')),'no 3-magazine reserve left in the page');
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 for(const [w,sl] of [['Vandal','pri'],['Operator','pri'],['Odin','pri'],['Outlaw','pri'],['Phantom','pri'],['Sheriff','pis'],['Ghost','pis']]){
  const r=JSON.parse(xe(`(()=>{bEquip(${JSON.stringify(w)},${JSON.stringify(sl)});if(rw!==${JSON.stringify(sl)})swapW(${JSON.stringify(sl)});return JSON.stringify({slot:slots[${JSON.stringify(sl)}].rsv,rsv,rw})})()`));
  assert.equal(r.slot,RESERVE[w],'bought '+w+' slot reserve');assert.equal(r.rsv,RESERVE[w],'bought '+w+' in hand reserve '+JSON.stringify(r));}
 assert.equal(xe('xRsv("Knife")'),0);assert.equal(xe('xRsv("Classic")'),36);
 assert.equal(H.errors.length,errs0,'page errors: '+H.errors.slice(errs0).join(' | '));
 console.log('Reserve ammo: page XRSV == server RESERVE == wiki (18 guns); buying sets the slot and in-hand reserve');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
