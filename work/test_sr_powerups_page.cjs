// Spike Rush Powerup Orbs, page side (vs-lane-parity4 2026-10-28) = VALORANT (wiki.playvalorant.com/en-us/Spike_Rush "Powerup Orbs")
// = server (server/src/srpowerups.js, server/test-sr-powerups.js).
//  A. page numbers / pool / names (xSrPw) == server SR_PW / SR_POOL / SR_NAMES.
//  B. offline Spike Rush: the game's set of five (Ultimate + Decay or Paranoia + built ones), orbs typed from it; captures: +1 ult
//     point (Ultimate: full), Damage Amp x1.3 on the player's gun damage, Health Regen 10 HP/s out of combat (3 s after a hit),
//     Crippling Decay -50 on enemy bots after 3 s (never below 1) and back after 8 s, Combat Stim beacon (xStimK 1.1 inside, 1 out),
//     Weapon Upgrade (round 1 -> a round-2 primary); all cleared at the next round.
//  C. online: round state pw drives the stim and the HUD line; orb rows coloured by their type (o[5]).
const assert=require('assert/strict'),path=require('path');
const {boot}=require('./page_harness.cjs');
(async()=>{const S=await import(path.join(__dirname,'..','server/src/srpowerups.js')),M=await import(path.join(__dirname,'..','server/src/modes.js'));
 const H=boot({real3:true,seed:5,native:true}),xe=H.xe,J_=s=>JSON.parse(xe('JSON.stringify('+s+')'));
 const P=J_('{amp:xSrPw.amp,regen:xSrPw.regen,decay:xSrPw.decay,paranoia:xSrPw.paranoia,stim:xSrPw.stim,pool:xSrPw.pool,names:xSrPw.names}');
 assert.deepEqual({amp:P.amp,regen:P.regen,decay:P.decay,paranoia:P.paranoia,stim:P.stim},JSON.parse(JSON.stringify(S.SR_PW)),'numbers == server');
 assert.deepEqual(P.pool,[...S.SR_POOL],'pool == server');assert.deepEqual(P.names,{...S.SR_NAMES},'names == server');
 // B. offline
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 const live=async()=>{for(let k=0;k<200&&!xe('running&&FV.buy<=0');k++)await adv(200);assert(xe('running'),'round live');};
 xe('J.pick="Jett";FV.pick="ascent";window.xSwift=0;FV.repOn=0;xLob0=false;startSR();true');await adv(400);await live();xe('FV.buy=0;true');
 const set=J_('xSrPw.set');assert.equal(set.length,5);assert(set.includes('ult'));assert.equal(set.filter(t=>t==='decay'||t==='paranoia').length,1,'one of Decay / Paranoia');
 assert(J_('SR.orbs.map(o=>o.type)').every(t=>set.includes(t)),'orbs typed from the set');
 const tick=s=>xe(`window.xLdOn=false;for(let t=0;t<${s};t+=0.05)srTick(0.05);true`);
 const take=ty=>{xe(`SR.orbs.push({x:player.x,z:player.z,m:null,type:"${ty}"});srTick(0.05);true`);};
 // +1 ult / Ultimate full
 xe('J.ult=0;true');take('amp');assert.equal(xe('J.ult'),1,'any orb: +1 ult point');assert.equal(xe('xSrPw.ampOn'),true,'Damage Amp on');
 const base=xe('wDmg(WEAP.Vandal,"body",5)'),amp=xe('xSrPw.mine=1;const n=wDmg(WEAP.Vandal,"body",5);xSrPw.mine=0;n');assert.equal(amp,Math.floor(base*1.3+1e-9),'player gun damage x1.3 ('+base+' -> '+amp+')');
 assert.equal(xe('wDmg(WEAP.Vandal,"body",5)'),base,'bot damage (not inside the player shot) unchanged');
 xe('J.ult=0;true');take('ult');assert.equal(xe('J.ult'),xe('K().u'),'Ultimate orb: full');
 // Health Regen
 xe('player.hp=50;xSrPw.lastHp=50;true');take('regen');tick(1);const h1=xe('player.hp');assert(h1>59&&h1<61.5,'10 HP/s out of combat ('+h1+')');
 xe('player.hp=40;true');tick(2);assert(xe('player.hp')<40.5,'hit (hp dropped): in combat for 3 s');tick(1.5);assert(xe('player.hp')>44,'healing again after 3 s');
 // Crippling Decay on the enemy bots
 xe('bots.forEach((b,i)=>{b.alive=true;b.hp=i?100:30;});true');take('decay');tick(2.9);assert.equal(xe('bots[1].hp'),100,'not before 3 s');tick(0.2);
 assert.equal(xe('bots[1].hp'),50,'-50 after 3 s');assert.equal(xe('bots[0].hp'),1,'never kills');tick(8.1);assert.equal(xe('bots[1].hp'),100,'given back after 8 s');
 // Combat Stim beacon
 take('stim');assert.equal(xe('xStimK()'),1.1,'inside the beacon: stim');xe('player.x+=20;true');tick(0.05);assert.equal(xe('xStimK()'),1,'outside: none');xe('player.x-=20;true');
 // Weapon Upgrade: round 1 (sidearm) -> a round-2 primary
 take('upgrade');assert(M.SR_LOADOUT[1].w.includes(xe('FV.pri')),'upgrade: a round-2 primary ('+xe('FV.pri')+')');
 // next round: cleared
 xe('FV.buy=0;FV.det=0;FV.sp.st="";fCheck(true,"Test");true');await live();assert.equal(xe('xSrPw.ampOn||xSrPw.beacons.length>0||xSrPw.regenUntil>xSrPw.t'),false,'cleared at the next round');
 // C. online
 xe('MP.on=true;MP.st="game";NET.socket={readyState:1,send(){}};true');
 xe('mpCliRS({gm:"sr",win:4,gun:"Vandal",pw:["stim","amp"],orb:[[0,1,0,1,0,"amp"],[1,5,0,5,1,"ult"]],sp:[0,0,0,0,0,0,0,0,0],tm:1,ab:{c:0,q:0,e:1,ult:0},status:{},channel:null,reyna:null,rv:[]});true');
 assert.equal(xe('xSrPw.net.join()'),'stim,amp','pw from the server');assert.equal(xe('xStimK()'),1.1,'online stim from pw');
 xe('nmVarHud({gm:"sr",win:4,gun:"Vandal",pw:["stim","amp"],orb:[[0,1,0,1,0,"amp"],[1,5,0,5,1,"ult"]]});true');
 assert.match(xe('document.getElementById("xGmHud").textContent'),/COMBAT STIM · DAMAGE AMP/,'HUD lists the active powerups');
 assert.deepEqual(J_('[...NM_ORBS.values()].map(m=>[m.userData.srType,m.material.color.getHex()===new THREE.Color(xSrPw.col[m.userData.srType]).getHex()])'),[['amp',true],['ult',true]],'orb colours by type (SRPW.col)');
 console.log('Spike Rush powerups (page): numbers / pool / names == server; offline set of five, typed orbs, +1 ult / full, Damage Amp x1.3, Health Regen out of combat, Crippling Decay 50 / 8 s, Stim beacon, Weapon Upgrade, reset per round; online pw stim + HUD, orbs coloured by type');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
