// Omen Dark Cover offline (work/ability_equip_runtime.js XAB_HOLD mark / XDARK / xDarkPt, index.html okKey E), native Ascent. Valorant
// (wiki.playvalorant.com/en-us/Dark_Cover): equipped, a 4.1 m marker shows where the smoke goes; HOLD FIRE moves it farther, HOLD ALT FIRE
// closer, through walls, up to 80 m; casting sends the smoke there and it sinks onto the floor below. E again or a quick FIRE tap casts.
// Was: E + FIRE put the smoke at the first wall within 30 m, 1.5-4 m high. Server: test-darkcover.js (m.dist).
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Omen'),'offline 5v5 started');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});xBUse=function(){return false;};true');/* no bot ability casts (a bot Omen's Dark Cover would add to J.smokes) */
 assert.equal(xe('JSON.stringify([XDARK.max,XDARK.min,XDARK.rate])'),'[80,1,20]','= server DARK');assert.equal(xe('xEqHold({k:"e"})||XAB_HOLD.Omen.e'),'mark');
 const smokes=()=>xe('J.smokes.length'),eqs=()=>xe('J.eq&&{st:J.eq.st,md:J.eq.md}');
 // 1. equip: marker shown; HOLD FIRE pushes it out, HOLD ALT FIRE pulls it in; neither casts
 xe('J.e=2;J.cd.e=0;pitch=0;true');const n0=smokes();await tap('KeyE');await adv(900);let q=eqs();assert.ok(q&&q.st==='ready','equipped: '+JSON.stringify(q));
 xe('fireHeld=true;xEqFire(false);true');await adv(1200);q=eqs();assert.equal(q.st,'mark');const m1=q.md;xe('fireHeld=false;true');await adv(200);q=eqs();assert.equal(q.st,'ready','hold released: no cast');assert.equal(smokes(),n0);
 assert.ok(xe('!!(xDarkMesh&&xDarkMesh.visible)'),'marker outline shown');assert.equal(xe('xDarkMesh.material.depthTest'),false,'seen through walls');
 xe('fireHeld=true;xEqFire(false);true');await adv(1500);const m2=eqs().md;xe('fireHeld=false;true');await adv(200);assert.ok(m2>m1+15,'HOLD FIRE: farther '+m1+' -> '+m2);
 xe('mpAltHeld=true;xEqFire(true);true');await adv(800);const m3=eqs().md;xe('mpAltHeld=false;true');await adv(200);assert.ok(m3<m2-8,'HOLD ALT FIRE: closer '+m2+' -> '+m3);
 xe('fireHeld=true;xEqFire(false);true');await adv(6000);assert.equal(eqs().md,80,'capped at 80 m');xe('fireHeld=false;true');await adv(200);
 // 2. E casts at the marker: the smoke on the aim line 80 m out (through walls), sunk to the floor below
 const pt=xe('(()=>{const p=xDarkPt(80);return p;})()'),P=xe('({x:player.x,z:player.z})');await tap('KeyE');await adv(800);assert.equal(smokes(),n0+1,'cast');assert.equal(xe('J.e'),1);
 const s=xe('(()=>{const s=J.smokes[J.smokes.length-1];return {x:s.p.x,y:s.p.y,z:s.p.z,r:s.r,t:s.t};})()');
 assert.ok(Math.hypot(s.x-pt.x,s.z-pt.z)<1,'at the marker: '+JSON.stringify([s,pt]));assert.ok(Math.abs(Math.hypot(s.x-P.x,s.z-P.z)-80)<2,'80 m out');assert.ok(Math.abs(s.y-(pt.f+1.7))<.3,'sunk to the floor + 1.7: '+s.y+' floor '+pt.f);assert.equal(s.r,4.1);
 assert.ok(!xe('xDarkMesh.visible||!!xDarkMesh.parent'),'marker hidden and out of the scene after the cast');
 // 3. a quick FIRE tap casts too
 await adv(1500);xe('J.cd.e=0;true');await tap('KeyE');await adv(900);xe('fireHeld=true;xEqFire(false);true');await adv(100);xe('fireHeld=false;true');await adv(800);assert.equal(smokes(),n0+2,'FIRE tap casts');
 // 4. online cast carries the marker distance
 const msg=xe('(()=>{let out=null;const s0=mpSend;mpSend=(c,m)=>{out=m;};const r={on:MP.on,st:MP.st,role:MP.role,hc:MP.hc};try{MP.role="client";XABT.mark={d:42.5,p:{x:1,y:2,z:3}};mpCastSelf("e");}finally{mpSend=s0;XABT.mark=null;}return out;})()');
 assert.equal(msg&&msg.dist,42.5,'mpCastSelf sends dist: '+JSON.stringify(msg));
 console.log('PASS Dark Cover offline: marker (4.1 m, through walls) moved by HOLD FIRE / ALT FIRE to 80 m, E or a FIRE tap casts there, smoke sunk to the floor; online sends dist');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
