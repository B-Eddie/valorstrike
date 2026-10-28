// Sova Owl Drone / Cypher Spycam offline = wiki (qa-32; valorant.fandom.com/wiki/Owl_Drone, /wiki/Spycam).
// Owl Drone: 7 s flight, a marking dart every 5 s (dart cooldown; more than one per flight), the flight ends early when Sova's body
// takes damage, flight height 0.3 .. 4.5 m over the floor under the drone (before: absolute y 0.3 .. 4.5, which on a native map pinned
// the drone under the floor; one dart per flight). Spycam: placed within 20 m, 1.15 s deploy before it can be viewed, a dart every
// 6 s for the rest of the round (before: one dart per camera, viewable at once, 30 m), damage to Cypher's body closes the view.
//   node work/test_owl_spycam.cjs
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const J_=v=>JSON.parse(JSON.stringify(v));
(async()=>{
 const H=boot({real3:true,seed:7}),xe=H.xe,e0=H.errors.length;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const start=async ag=>{xe(`J.pick="${ag}";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true`);await adv(400);xe('FV.buy=0;true');await adv(300);
  assert.ok(xe('running&&mode==="five"'),ag+' match started');xe('bots.forEach(b=>{b.g.position.set(player.x+200,player.y-50,player.z+200);b.alive=false;});player.hp=100;true');};
 // ---- Sova Owl Drone ----
 await start('Sova');assert.deepEqual(J_(xe('[XOWL.life,XOWL.cd,XOWL.lo,XOWL.hi]')),[7,5,0.3,4.5],'XOWL = wiki (7 s, 5 s dart cooldown, 0.3 .. 4.5 m)');
 xe('J.c=1;J.cd.c=0;pitch=0;svKey("KeyC");true');assert.ok(xe('!!J.dr&&!J.dr.tb&&J.dr.t===7'),'C launches a 7 s drone');
 // the harness runs the legacy map (floor y 0): a native-map floor at 7.05 (Ascent) is stubbed into groundAt, the drone launched over it
 xe('window.__g0=groundAt;groundAt=function(x,z,r,y){return 7.05;};J.dr.y=7.05+1.4;true');assert.equal(xe('drFloor(J.dr.x,J.dr.z,J.dr.y)'),7.05,'drFloor reads groundAt');
 await adv(1000);const y1=xe('J.dr.y'),f1=xe('drFloor(J.dr.x,J.dr.z,J.dr.y)');
 assert.ok(y1-f1>1&&y1-f1<=4.5+1e-6,'hovering drone stays over its floor (the old absolute 4.5 m clamp pinned it under a 7.05 floor): y '+y1+' floor '+f1);
 xe('pitch=1.2;keys.KeyW=true;true');await adv(1500);xe('keys.KeyW=false;pitch=0;true');const y2=xe('J.dr?J.dr.y:null'),f2=xe('J.dr?drFloor(J.dr.x,J.dr.z,J.dr.y):null');
 assert.ok(y2!=null&&y2-f2<=4.5+1e-6&&y2-f2>3,'climbing tops out 4.5 m over the floor: '+(y2-f2));
 xe('pitch=-1.2;keys.KeyW=true;true');await adv(1500);xe('keys.KeyW=false;pitch=0;true');const y3=xe('J.dr?J.dr.y:null'),f3=xe('J.dr?drFloor(J.dr.x,J.dr.z,J.dr.y):null');
 assert.ok(y3!=null&&y3-f3>=0.3-1e-6&&y3-f3<1,'diving bottoms out 0.3 m over the floor: '+(y3-f3));
 xe('groundAt=window.__g0;true');
 const darts=()=>xe('J.arrows.filter(a=>a.kind==="dart").length+(window.__dn|0)');
 xe('{const d0=drDart;window.__dn=0;drDart=function(){const n=J.dr&&!J.dr.tb&&!(J.dr.dcd>0);const r=d0.apply(this,arguments);if(n)window.__dn++;return r;};}true');
 xe('drDart();drDart();true');assert.equal(xe('window.__dn'),1,'a 2nd dart inside the 5 s cooldown is refused');assert.ok(Math.abs(xe('J.dr.dcd')-5)<1e-9,'dart cooldown 5 s');
 await adv(2500);assert.ok(xe('!J.dr'),'the drone ends after 7 s');
 xe('J.c=1;J.cd.c=0;svKey("KeyC");drDart();true');await adv(5100);xe('drDart();true');assert.equal(xe('window.__dn'),3,'two darts in one flight (0 s and 5.1 s)');
 await adv(2000);assert.ok(xe('!J.dr'),'7 s flight over');
 xe('J.c=1;J.cd.c=0;svKey("KeyC");true');await adv(300);assert.ok(xe('!!J.dr'),'drone up');xe('hurt(player,10);true');assert.ok(xe('!J.dr'),'damage to Sova ends the flight');
 // ---- Cypher Spycam ----
 await start('Cypher');assert.deepEqual(J_(xe('[XSPY.reach,XSPY.deploy,XSPY.cd]')),[20,1.15,6],'XSPY = wiki (20 m, 1.15 s deploy, 6 s dart cooldown)');
 assert.ok(xe('pitch=0;let ok=false;for(let i=0;i<72&&!ok;i++){yaw=i*Math.PI/36;const s=cyCamSpot();ok=!!(s&&s.ok);}ok'),'some heading has a wall within 20 m for the Spycam (5ca299f: vertical terrain only)');
 xe('cyClear();cyKey("KeyE");true');assert.ok(xe('!!BC.cam&&ray.far===20'),'Spycam placed with a 20 m reach');
 xe('cyKey("KeyE");true');assert.equal(xe('BC.cv'),false,'not viewable while deploying');await adv(1250);xe('cyKey("KeyE");true');assert.equal(xe('BC.cv'),true,'viewable after the 1.15 s deploy');
 xe('cyDart();true');assert.ok(Math.abs(xe('BC.cam.dcd')-6)<1e-9,'dart fired: 6 s cooldown');await adv(1000);const c1=xe('BC.cam.dcd');xe('cyDart();true');assert.ok(Math.abs(xe('BC.cam.dcd')-c1)<1e-9,'a dart inside the cooldown is refused');
 xe('player.x=BC.cvx;player.z=BC.cvz;true');await adv(5200);assert.equal(xe('BC.cam.dcd'),0,'cooldown over');xe('cyDart();true');assert.ok(Math.abs(xe('BC.cam.dcd')-6)<1e-9,'a 2nd dart from the same camera');
 xe('hurt(player,5);true');assert.equal(xe('BC.cv'),false,'damage to Cypher closes the Spycam view');
 assert.equal(H.errors.length,e0,'no page errors: '+JSON.stringify(H.errors.slice(0,3).map(e=>String(e&&e.stack||e.message||JSON.stringify(e)).slice(0,300))));
 console.log('test_owl_spycam: PASS (Owl Drone 7 s / dart every 5 s / ends on damage / '+(y2-f2).toFixed(2)+' m max over the floor; Spycam 20 m / 1.15 s deploy / dart every 6 s)');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
