// TDM Ultimate Orbs, page side (vs-lane-parity4 2026-10-28) = VALORANT (wiki Team_Deathmatch / Orbs: 10 points on contact, all
// spawn together periodically, a zone giving allies the same 10) = server (server/src/tdmorbs.js TDM_UO, server/test-tdm-ult-orbs.js).
//  A. page numbers (xTdmUo) == server TDM_UO; spots XUO_SPOTS == server ORB_SPOTS.
//  B. offline TDM on native Ascent: no orbs before 30 s, then both up together on their callouts; the player runs over one: +10
//     points (tdmAbPts), orb gone, zone ring; the next wave 60 s later brings it back.
//  C. online: the snapshot's tuo / tuz rows are drawn (taken orb hidden, zone ring), cleared without them.
const assert=require('assert/strict'),path=require('path');
const {boot}=require('./page_harness.cjs');
if(!process.env.TU_CHILD){(async()=>{const S=await import(path.join(__dirname,'..','server/src/tdmorbs.js')),O=await import(path.join(__dirname,'..','server/src/ultorbs.js'));
  const H=boot({real3:true,seed:3}),xe=H.xe;
  assert.deepEqual(JSON.parse(xe('JSON.stringify([xTdmUo.pts,xTdmUo.first,xTdmUo.every,xTdmUo.r,xTdmUo.dy,xTdmUo.zone,xTdmUo.zoneLife])')),[S.TDM_UO.pts,S.TDM_UO.first,S.TDM_UO.every,S.TDM_UO.r,S.TDM_UO.dy,S.TDM_UO.zone,S.TDM_UO.zoneLife],'numbers == server');
  assert.deepEqual(JSON.parse(xe('JSON.stringify(XUO_SPOTS)')),JSON.parse(JSON.stringify(O.ORB_SPOTS)),'spots == server');
  xe('MP.on=true;mpCliSnap({t:"s",u:[],tuo:[[0,1,2,3,1],[1,4,5,6,0]],tuz:[[1,2,3,4.2,0]]});true');
  assert.deepEqual(JSON.parse(xe('JSON.stringify(xTdmUo.L.map(o=>[o.id,o.x,o.y,o.z,o.g&&o.g.visible]))')),[[0,1,2,3,true],[1,4,5,6,false]],'online orbs drawn, taken one hidden');
  assert.equal(xe('xTdmUo.Z.length'),1,'zone drawn');
  xe('mpCliSnap({t:"s",u:[]});true');assert.equal(xe('xTdmUo.L.length+xTdmUo.Z.length'),0,'cleared without rows');xe('MP.on=false;true');
  const r=require('child_process').spawnSync(process.execPath,[__filename],{env:{...process.env,TU_CHILD:'1'},stdio:'inherit'});assert.equal(r.status,0,'offline native TDM');
  console.log('TDM Ultimate Orbs (page): numbers / spots == server, online tuo / tuz drawn');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});}
else{const H=boot({real3:true,seed:3,native:true}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 (async()=>{xe('J.pick="Jett";FV.pick="ascent";startTDM();true');await adv(600);
  for(let k=0;k<400&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');k++)await adv(200);
  assert.equal(xe('FV.tdm&&!FV.esc&&J.on&&!!nmActive()'),true,'offline TDM with abilities on native Ascent');
  xe('window.xLdOn=false;DM.abT=1e9;for(const b of bots.concat(allies))if(b&&b.g){b.g.position.set(-200,0,-200);b.alive=false;}player.x=-150;player.z=-150;true');
  const tick=s=>xe(`window.xLdOn=false;DM.abT=1e9;for(let t=0;t<${s};t+=0.05)tdmTick(0.05);true`);
  tick(29);assert.equal(xe('xTdmUo.L.filter(o=>o.up).length'),0,'none before 30 s');
  tick(1.2);const L=JSON.parse(xe('JSON.stringify({o:xTdmUo.L.map(o=>[o.x,o.y,o.z,o.up]),c:XUO_SPOTS.ascent.map(n=>(nmActive().meta.callouts.find(q=>q.name===n)||{}).position)})'));
  assert.equal(L.o.length,2,'two orbs');L.o.forEach((o,i)=>{assert.equal(o[3],true,'up');const c=L.c[i];assert(Math.hypot(o[0]-c[0],o[2]-c[2])<2&&Math.abs(o[1]-c[1])<1.5,'orb '+i+' on its callout');});
  const tp0=xe('J.tp||0');xe('{const o=xTdmUo.L[0];player.x=o.x;player.z=o.z;player.y=o.y;player.hp=100;tdmTick(0.05);}true');
  assert.equal(xe('J.tp')-tp0,10,'+10 points');assert.equal(xe('xTdmUo.L[0].up||xTdmUo.L[0].g.visible'),false,'taken');assert.equal(xe('xTdmUo.Z.length'),1,'zone');
  xe('player.x=-150;player.z=-150;true');tick(60);assert.equal(xe('xTdmUo.L.every(o=>o.up)'),true,'next wave: back');
  console.log('TDM Ultimate Orbs (offline native Ascent): first wave at 30 s, both on callouts, contact +10 points, zone, back 60 s later');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});}
