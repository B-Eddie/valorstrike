// Sage Slow Orb thrown on the page (offline 5v5, native Ascent; index.html sgKey Q / sgTick / J.sgo). Valorant (wiki.playvalorant.com/en-us/Slow_Orb):
// "On cast she throws a slow orb as a projectile [Class 3] that detonates on contact with horizontal terrain"; 7 s field, 50 % slow. The trusted server
// already flies it on the shared arc (vendor/sova-bolt.cjs orb(), server/test-sloworb.js); the page now does the same: an orb flies the arc from the eye,
// the 7 s field appears where and when it lands (off a wall it drops to the floor below). Was: the field appeared at once at the first wall within 15 m.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const click=async(b=0)=>{H.mouse(b,true);await adv(40);H.mouse(b,false);await adv(20);};
const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
(async()=>{
 // the page's arc is the server's: the same vendor function inlined
 const V=require('../vendor/sova-bolt.cjs');
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Sage'),'offline 5v5 started as Sage');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});xBUse=function(){return false;};document.pointerLockElement=renderer.domElement;true');
 check(xe('SovaBolt.orb.toString()')===V.orb.toString(),'page SovaBolt.orb = vendor/sova-bolt.cjs orb (server)');
 const nz=()=>xe('J.slz.length'),fly=()=>xe('(J.sgo||[]).length');
 // 1. aimed up a little: the orb flies, no field yet; the field appears at the arc's end after its flight time
 xe('J.q=2;J.cd.q=0;pitch=0.15;true');await tap('KeyQ');await adv(700);assert.equal(xe('J.eq&&J.eq.st'),'ready','Slow Orb in hand');
 const exp=xe('(()=>{const o=pEye(),d=jAim(),s=SovaBolt.orb([o.x,o.y,o.z],[d.x,d.y,d.z],xBoltRay,(x,z,y)=>groundAt(x,z,0.05,y));return {end:s.end,t:s.t,o:[o.x,o.y,o.z]}})()');
 check(exp.t>0.3,'a real flight ('+exp.t+' s)');const n0=nz();await click(0);
 let k=0;for(;k<40&&fly()===0;k++)await adv(10);check(fly()===1,'an orb in flight after the release');check(nz()===n0,'no field while it flies');
 const m=xe('(()=>{const g=J.sgo[0];return g&&g.m.parent?{x:g.m.position.x,y:g.m.position.y,z:g.m.position.z}:null})()');check(m,'the orb mesh is in the scene');
 await adv(Math.round(exp.t*1000*0.5));check(nz()===n0,'still no field half-way');const mid=xe('(()=>{const g=J.sgo[0];return g?{x:g.m.position.x,y:g.m.position.y,z:g.m.position.z}:null})()');
 check(mid&&Math.hypot(mid.x-exp.o[0],mid.z-exp.o[2])>1,'the orb travels along the arc '+JSON.stringify(mid));
 await adv(Math.round(exp.t*1000*0.5)+250);check(nz()===n0+1,'the field appears when it lands');check(fly()===0,'the orb is gone');
 const z=xe('(()=>{const z=J.slz[J.slz.length-1];return {x:z.p.x,y:z.p.y,z:z.p.z,t:z.t}})()');
 check(Math.hypot(z.x-exp.end[0],z.z-exp.end[2])<0.05,'field where the arc ends '+JSON.stringify([z,exp.end]));check(Math.abs(z.y-exp.end[1])<0.12,'on the floor there');check(z.t>6.5&&z.t<=7,'7 s field from landing ('+z.t+')');
 check(xe('sgSlow({x:'+z.x+',z:'+z.z+'})')===0.5,'50 % slow inside');
 // 2. a round reset clears an orb still in the air
 xe('J.cd.q=0;pitch=0.6;true');await tap('KeyQ');await adv(700);await click(0);for(k=0;k<40&&fly()===0;k++)await adv(10);check(fly()===1,'second orb in flight');
 const g=xe('(()=>{const g=J.sgo[0].m;window.__g=g;return 1})()');xe('sgClear();true');check(fly()===0&&!xe('!!window.__g.parent'),'round reset: no orb left in the air or in the scene');
 console.log(fails.length?'FAILED '+fails.length:'PASS Slow Orb thrown on the page: shared Class 3 arc (vendor orb = server), field where and when it lands, 7 s, 50 %; cleared on reset');
 process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
