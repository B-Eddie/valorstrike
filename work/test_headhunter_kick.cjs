// Chamber Headhunter on the real page (work/page_harness.cjs): the shot goes through the Sheriff pipeline the server uses for it
// (server/src/simulation.js ABILITY_GUNS.Headhunter = Sheriff spread / spray / recoil weight; wiki Headhunter: 0.25 deg first-shot
// spread standing = the Sheriff row, recoil that recovers). Before hk-36 bcFire shot the exact screen centre with no kick.
// Checks: gFire runs with "Sheriff" for a Headhunter shot (not for Tour De Force), the aim (yaw / pitch) does not move, the camera
// kick (rcl) rises on the shot and recovers to ~0 within 0.5 s, and since resets (plant refusal right after a shot).
//   node work/test_headhunter_kick.cjs
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
(async()=>{
 const H=boot({real3:true,seed:3}),xe=H.xe,e0=H.errors.length;/* load-phase harness notes (external manifest script) are not page errors */const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Chamber";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);xe('FV.buy=0;true');await adv(300);
 assert.ok(xe('running&&mode==="five"'),'match started');
 xe('window.__gf=[];{const g=gFire;gFire=function(d,w){window.__gf.push(w);return g.apply(this,arguments);};}bots.forEach(b=>{b.g.position.set(player.x+200,player.y-50,player.z+200);});true');
 xe('yaw=0.3;pitch=0.05;rcl=0;rclH=0;since=5;player.hp=100;J.q=2;BC.eq="hp";BC.cd=0;true');
 const r=xe('[bcFire(),J.q,+yaw.toFixed(6),+pitch.toFixed(6),rcl,since,window.__gf.slice()]');
 assert.equal(r[0],true,'bcFire handled the click');assert.equal(r[1],1,'one Headhunter round spent');
 assert.deepEqual([r[2],r[3]],[0.3,0.05],'the aim (yaw / pitch) never moves on a Headhunter shot');
 assert.deepEqual(JSON.parse(JSON.stringify(r[6])),['Sheriff'],'Headhunter shot goes through gFire with the Sheriff profile (server ABILITY_GUNS.Headhunter)');
 assert.ok(r[4]>0.003&&r[4]<0.06,'camera kick (rcl) after the shot: '+r[4]);assert.equal(r[5],0,'since resets on the shot');
 await adv(500);const k=xe('rcl');assert.ok(k<r[4]*0.05,'the kick recovers within 0.5 s: rcl '+k+' (was '+r[4]+')');
 assert.equal(xe('+pitch.toFixed(6)'),0.05,'pitch still where it was after the recovery');
 // Tour De Force keeps its own path (no Sheriff pipeline)
 xe('window.__gf.length=0;BC.eq="sn";BC.td=5;BC.cd=0;true');xe('bcFire();true');assert.deepEqual(JSON.parse(JSON.stringify(xe('window.__gf.slice()'))),[],'Tour De Force does not use the Sheriff pipeline');
 assert.equal(H.errors.length,e0,'no page errors: '+JSON.stringify(H.errors.slice(0,3).map(e=>String(e&&e.stack||e.message||JSON.stringify(e)).slice(0,300))));
 console.log('test_headhunter_kick: PASS (kick '+r[4].toFixed(4)+' rad -> '+k.toExponential(1)+' after 0.5 s; aim unchanged)');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
