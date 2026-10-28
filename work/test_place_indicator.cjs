// Aimed placement + placement indicator (work/ability_target_runtime.js xAimPlace / xPlaceTick) on the real page, native Ascent.
// User 2026-10-27: "abilities not right". Valorant (wiki Alarmbot / Turret / Trademark / Rendezvous / Barrier_Orb): while a placed
// ability is equipped the crosshair becomes an indicator on horizontal terrain, coloured on a viable spot and red on an unviable one;
// the device goes there, up to the ability's max cast distance. Was: Killjoy's Alarmbot / Turret 1.5 m in front whatever she aimed at,
// no indicator.
// Checked: Killjoy Q (Alarmbot, 10 m) equipped -> a floor ring (xPlaceRing) in the scene at xPlace.aim(10), viable colour, inside 10 m;
// the ring follows the aim; FIRE places the Alarmbot at the ring; aiming at an unviable spot turns the ring red and FIRE places nothing
// (charge kept). Same rule as the server (test-placement.js).
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const click=async(b=0)=>{H.mouse(b,true);await adv(40);H.mouse(b,false);await adv(60);};
const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
const ring=()=>xe('(()=>{const r=xPlace.st.ring,l=xPlace.st.line;return {on:!!(r&&r.parent),line:!!(l&&l.parent),x:r&&r.position.x,y:r&&r.position.y,z:r&&r.position.z,col:xPlace.st.mat&&xPlace.st.mat.color.getHex(),ok:xPlace.st.s&&xPlace.st.s.ok,px:player.x,pz:player.z}})()');
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Killjoy'),'offline 5v5 started');
 assert.equal(xe('J.pick'),'Killjoy');xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});true');
 xe('document.pointerLockElement=renderer.domElement;true');
 // 1. not equipped: no indicator
 check(!ring().on,'no indicator while nothing is equipped');
 // 2. Q equipped, aimed at the floor ahead: viable ring inside 10 m at xPlace.aim(10)
 xe('J.q=1;pitch=-0.25;true');await tap('KeyQ');await adv(900);let r=ring();const q=xe('(()=>{const p=xPlace.aim(10);return {x:p.x,y:p.y,z:p.z,ok:p.ok}})()');
 check(r.on,'Alarmbot equipped: a floor ring is shown '+JSON.stringify(r));check(r.ok&&q.ok&&r.col===0xf2c230,'viable spot: Killjoy yellow');
 check(Math.hypot(r.x-r.px,r.z-r.pz)<=10.01,'inside 10 m');check(Math.abs(r.x-q.x)<.3&&Math.abs(r.z-q.z)<.3,'ring at the crosshair floor point');
 // 3. the ring follows the aim
 const y0=xe('yaw');xe('yaw+=0.6;true');await adv(120);const r2=ring();check(Math.hypot(r2.x-r.x,r2.z-r.z)>1,'the ring follows the crosshair');
 // 4. FIRE places the Alarmbot at the ring
 await click(0);await adv(300);const ab=xe('J.ab&&{x:J.ab.p.x,z:J.ab.p.z}');check(ab&&Math.hypot(ab.x-r2.x,ab.z-r2.z)<.5,'Alarmbot placed at the ring '+JSON.stringify(ab)+' '+JSON.stringify(r2));check(xe('J.q')===0,'charge spent');
 await adv(1200);check(!ring().on,'indicator gone after the cast');
 // 5. an unviable spot: red ring, FIRE places nothing, charge kept
 xe('yaw='+y0+';J.q=1;J.ab&&J.ab.m&&scene.remove(J.ab.m);J.ab=null;true');
 await tap('KeyQ');await adv(900);xe('(()=>{const a0=xAimPlace;window.__a0=a0;xAimPlace=function(m){const p=a0(m);p.ok=false;return p;};xPlace.aim=xAimPlace;})();true');await adv(120);
 r=ring();check(r.on&&r.ok===false&&(r.col>>16)>0xf0&&((r.col>>8)&255)<0x50,'unviable spot: red ring '+JSON.stringify(r));await click(0);await adv(300);check(!xe('J.ab'),'nothing placed on an unviable spot');check(xe('J.q')===1,'charge kept');
 xe('xAimPlace=window.__a0;xPlace.aim=xAimPlace;true');await tap('KeyQ');await adv(900);
 console.log(fails.length?'FAILED '+fails.length:'place indicator: Killjoy Alarmbot ring at the crosshair (10 m), follows the aim, places there, red + refused on an unviable spot');
 process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
