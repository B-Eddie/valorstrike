// TDM Recovery Orbs, page side (vs-lane-parity 2026-10-28) = VALORANT (wiki.playvalorant.com/en-us/Team_Deathmatch "Orbs": a 6 s buff
// restoring health and loadout armour, not the Regen Shield pool; respawns every 30 s; a zone allies can enter) = server
// (server/src/tdmorbs.js, server/test-tdm-orbs.js).
//  A. page spots XTDM_REC_SPOTS == server TDM_REC_SPOTS, same buff / respawn / reach / zone numbers.
//  B. offline TDM on native Ascent: one orb per spot on the nav floor; the hurt player runs over one: healed over 6 s to 100 HP and
//     the Stage 1 Classic Regen Shield 25; the orb is back 30 s later; a full-health player does not take it.
//  C. online: the snapshot's tro / trz rows are drawn (orb hidden while respawning, zone ring), and cleared without them.
const assert=require('assert/strict'),path=require('path');
const {boot}=require('./page_harness.cjs');
if(!process.env.TR_CHILD){(async()=>{const S=await import(path.join(__dirname,'..','server/src/tdmorbs.js'));
  const H=boot({real3:true,seed:3}),xe=H.xe;
  assert.deepEqual(JSON.parse(xe('JSON.stringify(XTDM_REC_SPOTS)')),JSON.parse(JSON.stringify(S.TDM_REC_SPOTS)),'page spots == server');
  assert.deepEqual(JSON.parse(xe('JSON.stringify([xTdmRec.buff,xTdmRec.respawn,xTdmRec.r,xTdmRec.zone,xTdmRec.zoneLife,xTdmRec.hpRate])')),[S.TDM_REC.buff,S.TDM_REC.respawn,S.TDM_REC.r,S.TDM_REC.zone,S.TDM_REC.zoneLife,S.TDM_REC.hpRate],'numbers == server');
  // C. online draw (no server needed: feed snapshots)
  xe('MP.on=true;mpCliSnap({t:"s",u:[],tro:[[0,1,2,3,0],[1,4,5,6,12.5]],trz:[[1,2,3,4.2,0]]});true');
  assert.deepEqual(JSON.parse(xe('JSON.stringify(xTdmRec.L.map(o=>[o.id,o.x,o.y,o.z,o.g&&o.g.visible]))')),[[0,1,2,3,true],[1,4,5,6,false]],'online orbs drawn, respawning one hidden');
  assert.equal(xe('xTdmRec.Z.length'),1,'zone drawn');
  xe('mpCliSnap({t:"s",u:[]});true');assert.equal(xe('xTdmRec.L.length+xTdmRec.Z.length'),0,'cleared without rows');xe('MP.on=false;true');
  const r=require('child_process').spawnSync(process.execPath,[__filename],{env:{...process.env,TR_CHILD:'1'},stdio:'inherit'});assert.equal(r.status,0,'offline native TDM');
  console.log('TDM Recovery Orbs (page): spots / numbers == server, online tro / trz drawn');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});}
else{const H=boot({real3:true,seed:3,native:true}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 (async()=>{xe('J.pick="Jett";FV.pick="ascent";startTDM();true');await adv(600);
  for(let k=0;k<400&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');k++)await adv(200);
  assert.equal(xe('FV.tdm&&!FV.esc&&!!nmActive()'),true,'offline TDM on native Ascent');
  // the TDM tick runs the orbs (the harness's native boot does not tick the match clock, so the test steps the orb tick itself)
  xe('tdmTick(0);true');
  const O=JSON.parse(xe('JSON.stringify({o:xTdmRec.L.map(o=>[o.x,o.y,o.z]),c:XTDM_REC_SPOTS.ascent.map(n=>(nmActive().meta.callouts.find(q=>q.name===n)||{}).position)})'));
  assert.equal(O.o.length,4,'four orbs (placed by tdmTick)');O.o.forEach((o,i)=>{const c=O.c[i];assert(Math.hypot(o[0]-c[0],o[2]-c[2])<2&&Math.abs(o[1]-c[1])<1.5,'orb '+i+' on its callout at floor height');});
  xe('for(const b of bots.concat(allies))if(b&&b.g){b.g.position.set(-200,0,-200);b.alive=false;}true');
  const step=(ms,dx)=>xe(`{const o=xTdmRec.L[0];for(let t=0;t<${ms};t+=50){player.x=o.x+${dx};player.z=o.z;player.y=o.y;tdmRecTick(0.05);}}true`);
  xe('player.hp=100;player.armor=25;true');step(300,0);assert.equal(xe('xTdmRec.L[0].readyAt<=xTdmRec.t'),true,'full health: not taken');
  xe('player.hp=30;player.armor=0;window.__pool=player.rgn;true');step(50,0);assert.equal(xe('xTdmRec.L[0].readyAt>xTdmRec.t+29'),true,'taken: back in 30 s');
  assert.equal(xe('xTdmRec.L[0].g.visible'),false,'hidden while respawning');
  step(3000,6);const mid=xe('player.hp');assert(mid>60&&mid<95,'about half way after 3 s ('+mid+')');
  step(3100,6);assert.equal(Math.round(xe('player.hp')),100,'100 HP after the 6 s buff');assert.equal(Math.round(xe('player.armor')),25,'Regen Shield 25 (Stage 1 Classic)');
  assert(xe('player.rgn==null||player.rgn<=__pool'),'pool not refilled by the orb');
  xe('player.hp=50;true');step(1000,6);assert.equal(xe('player.hp'),50,'buff over');
  step(25000,6);assert.equal(xe('xTdmRec.L[0].readyAt<=xTdmRec.t&&xTdmRec.L[0].g.visible'),true,'back after 30 s');
  // an ally in the zone is restored, an enemy bot is not
  xe('{const o=xTdmRec.L[1],a=allies[0],b=bots[0];for(const u of [a,b]){u.alive=true;u.hp=20;}a.g.position.set(o.x+1,o.y,o.z);b.g.position.set(o.x+1.5,o.y,o.z);player.hp=50;player.x=o.x;player.z=o.z;player.y=o.y;tdmRecTick(0.05);player.x+=8;for(let t=0;t<2000;t+=50)tdmRecTick(0.05);}true');
  assert(xe('allies[0].hp')>20,'ally in the zone restored');assert.equal(xe('bots[0].hp'),20,'enemy bot not');
  console.log('TDM Recovery Orbs (offline native Ascent): 4 orbs on callouts, hurt-only pickup, 6 s heal to 100 / loadout armour, ally zone, back in 30 s');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});}
