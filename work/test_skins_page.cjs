// Skins + knife inspect on the real page (work/page_harness.cjs, real three.js scene graph): saved skins load from
// localStorage at boot; the lobby Collection button opens the Collection page (every category / weapon, equipped
// names), a weapon opens its skin list with the preview canvas, Store renders FREE items; in a running offline 5v5 the
// fallback viewmodel and bot guns carry the shader-patched skin materials; Y inspects the gun (2.2 s) and the knife
// (native Tactical Inspect length) and a knife swing cancels it; no page errors throughout.
const assert=require('assert/strict');
const {boot,lsStore}=require('./page_harness.cjs');
const store=lsStore([['vs.skins',JSON.stringify({v:2,eq:{Vandal:'prime.1',Classic:'prime',Knife:'blastx.2'},owned:['prime:Vandal','prime:Classic','blastx:Knife']})]]);
const H=boot({real3:true,seed:4,ls:store}),xe=H.xe,errs0=H.errors.length,x0=H.xErrCalls.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const frames=async n=>{for(let i=0;i<n;i++){H.frameMs(50);if(i%5===0)await new Promise(r=>setImmediate(r));}};
const through=async()=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
(async()=>{
 // boot: saved skins restored
 assert.equal(xe('xskGet("Vandal")'),'prime.1');assert.equal(xe('xskGet("Knife")'),'blastx.2');assert.equal(xe('xskGet("Phantom")'),'standard');
 // lobby: Collection + Store
 assert.ok(H.$('navStore'),'Store button in the lobby nav');H.$('navInv').onclick();await adv(50);
 const root=H.$('xSk');assert.ok(root&&!root.hidden,'Collection page open');let body=xe('document.querySelector("#xSk .xsk-body").innerHTML');
 for(const c of ['Sidearms','SMGs','Shotguns','Rifles','Sniper Rifles','Heavy','Melee'])assert.ok(body.includes('<h3>'+c+'</h3>'),c);
 assert.ok(body.includes('Prime Vandal · Orange'),'equipped Vandal name');assert.ok(body.includes(xe('xskName("Knife","blastx.2")')),'equipped knife name');
 xe('xskAct("weapon","Vandal");true');body=xe('document.querySelector("#xSk .xsk-body").innerHTML');assert.ok(body.includes('id="xskCv"')&&body.includes('Prime Vandal'));
 xe('xskAct("pick",null,"mk-vii-liberty.3");xskAct("get",null,"mk-vii-liberty.3");true');assert.equal(xe('xskGet("Vandal")'),'mk-vii-liberty.3');assert.ok(JSON.parse(store.getItem('vs.skins')).eq.Vandal==='mk-vii-liberty.3','saved');
 xe('xskAct("tab",null,"store");true');body=xe('document.querySelector("#xSk .xsk-body").innerHTML');assert.ok(body.includes('Featured bundle')&&body.includes('FREE'));
 xe('xskClose();true');assert.ok(H.$('xSk').hidden);assert.equal(xe('XSK.pv'),null,'preview renderer released');
 xe('xskEquip("Vandal","prime.1");true');
 // offline 5v5: skins on the viewmodel and on bot guns
 xe('XSK.botSkins=true;FV.pick="ascent";window.xQPick="ascent";try{window.xQSetMap&&window.xQSetMap(FV.pick)}catch(e){}try{mpSet("ascent")}catch(e){}true');
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');xe('for(const b of bots)b.nt=true;for(const a of allies)a.nt=true;player.hp=100;FV.buy=0;true');await frames(20);
 // Native assets are asynchronous; the headless harness supplies placeholder GLTFs. Assert routing here;
 // actual GLB bytes/textures/clips are checked by test_skin_levels and in the browser.
 assert.equal(xe('VMS.Vandal.userData.xskId'),'prime.1');
 assert.equal(xe('(()=>{let n=0;KARM.traverse(o=>{if(o.isMesh&&o.material.userData&&o.material.userData.xsk)n++;});return n;})()'),0,'arms never skinned');
 const tp=xe('bots.concat(allies).filter(u=>u.xm&&u.xm.gun&&u.xm.gun.userData.xskId).length');assert.ok(tp>0,'bot guns carry validated selections');
 // Y inspect: gun 2.2 s, knife native length, swing cancels
 xe('swapW("pis");VM.sw=0;VM.ins=0;kSwing=0;ads=0;reloading=0;true');H.key('KeyY',true);H.key('KeyY',false);assert.equal(xe('VM.ins'),2.2,'gun inspect');
 xe('VM.ins=0;swapW("knife");VM.sw=0;true');await frames(2);H.key('KeyY',true);H.key('KeyY',false);const kins=xe('VM.ins');assert.ok(kins>3.1&&kins<3.3,'knife inspect '+kins);
 await frames(4);assert.ok(xe('VM.ins')>0&&xe('VM.ins')<kins,'knife inspect running');H.mouse(0,true);H.mouse(0,false);await frames(2);assert.equal(xe('VM.ins'),0,'swing cancels the inspect');
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);assert.equal(errs.length,0,'page errors: '+errs.map(e=>String(e&&e.message||e)).slice(0,3).join(' | '));assert.equal(xerr.length,0,'xE calls: '+xerr.slice(0,3).map(e=>String(e&&e.message||e)).join(' | '));
 console.log('skins page: boot restore, Collection/Store, viewmodel + bot gun skins, Y gun/knife inspect + swing cancel ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
