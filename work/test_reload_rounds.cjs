// Per-round reloads and shotgun far tagging on the real page (offline 5v5): Bucky / Marshal reload one round every 0.5 s
// (wiki "0.5 per shell" / "0.5 per bullet") until full or out of reserve, a shot goes out mid-reload and stops it; the
// Outlaw takes 2.3 s for one barrel and 3.8 s for both; a magazine reload still blocks a Vandal shot. A shotgun hit past
// 10 m tags 30% slow easing back over 0.5 s (patch 1.07) and never weakens a standard tag. Page XRLP == server RELOAD_ROUND.
const path=require('path'),assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
(async()=>{
 const {RELOAD_ROUND}=await import(path.join(__dirname,'..','server','src','simulation.js'));
 const H=boot({real3:true,seed:5}),xe=H.xe,errs0=H.errors.length;
 assert.deepEqual(JSON.parse(xe('JSON.stringify(XRLP)')),{...RELOAD_ROUND},'page XRLP == server RELOAD_ROUND');
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe('FV.buy=0;FV.menu=false;try{buyMenu(false)}catch(e){};player.hp=1e6;true');
 const arm=async w=>{xe(`bEquip(${JSON.stringify(w)},"pri");if(rw!=="pri")swapW("pri");true`);await adv(1600);};
 const st=()=>JSON.parse(xe('JSON.stringify({ammo,rsv,rl:+reloading.toFixed(3),w:wName()})'));
 for(const w of ['Marshal','Bucky']){await arm(w);xe('ammo=0;rsv=12;reloading=0;fcd=0;true');
  xe('reloading=xRT();true');assert.equal(st().rl,0.5,w+' one round = 0.5 s');
  await adv(550);assert.equal(st().ammo,1,w+' 1 round after 0.55 s '+JSON.stringify(st()));assert.equal(st().rsv,11);
  await adv(2100);assert.equal(st().ammo,5,w+' full '+JSON.stringify(st()));assert.equal(st().rl,0);
  xe('ammo=2;reloading=xRT();fcd=0;true');await adv(200);const a0=st().ammo;xe('fcd=0;shoot();true');const s1=st();
  assert.equal(s1.rl,0,w+' the shot stopped the reload');assert.equal(s1.ammo,a0-1,w+' and fired');}
 await arm('Outlaw');xe('ammo=1;true');assert.equal(xe('xRT()'),2.3);xe('ammo=0;true');assert.equal(xe('xRT()'),3.8);
 await arm('Vandal');xe('ammo=3;rsv=50;reloading=xRT();fcd=0;true');const v0=st();xe('shoot();true');assert.equal(st().ammo,v0.ammo,'Vandal reload blocks the shot');xe('reloading=0;true');
 // tagging
 const tag=(js)=>JSON.parse(xe(`(()=>{const t={};${js};return JSON.stringify({T:t.tagT,K:t.tagK,S:t.tagS||0,k:+xTagK(t).toFixed(4)})})()`));
 assert.deepEqual(tag('xTagAt(t,20,"Bucky",12)'),{T:0.5,K:0.7,S:1,k:0.7});
 assert.equal(tag('xTagAt(t,20,"Bucky",12);t.tagT=0.25').k,0.85,'eases out');
 /* the standard tag is whatever xTag gives (.275 with the feel runtime loaded) */
 assert.deepEqual(tag('xTagAt(t,20,"Bucky",8)'),tag('xTag(t,20)'),'near shotgun hit: standard tag');
 assert.deepEqual(tag('xTagAt(t,40,"Vandal",30)'),tag('xTag(t,40)'),'rifles: standard tag at range');
 assert.deepEqual(tag('xTagAt(t,40,"Vandal",3);xTagAt(t,20,"Judge",15)'),tag('xTag(t,40)'),'a far pellet never weakens a standard tag');
 assert.equal(H.errors.length,errs0,'page errors: '+H.errors.slice(errs0).join(' | '));
 console.log('Per-round reloads (page): Bucky / Marshal one round per 0.5 s to full, a shot interrupts it; Outlaw 2.3 / 3.8 s; Vandal reload blocks the shot; shotgun hit past 10 m = 30% slow easing out, standard tag kept otherwise; XRLP == server RELOAD_ROUND');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
