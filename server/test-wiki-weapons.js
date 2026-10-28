// Every gun = the wiki infobox (wiki.playvalorant.com/en-us/<Weapon>, pages saved by qa-27 2026-10-26, patch 13.01):
// price, damage rows per range band (head / body / leg, the wiki shows the floored value the game applies), fire rate (and
// the alt-fire / ADS rate), magazine, reserve, reload (Bucky / Marshal per round, Outlaw one / both barrels), equip, run speed
// (runSpeedMultiplier x 6.75 m/s knife speed), pellets. Checked on the server (weapons.json through simulation.js, spike.js
// prices, RESERVE, reloadTime) and on the page (its calibration file is weapons.json byte for byte; the buy menu prices;
// XRSV). Plus the Outlaw's 13.01 scoped bloom (max spread 0 -> 2.25 deg, 0.15 s recovery; the second scoped shot at the
// 2.75/s cadence ~2.14 deg) through the shared motor and a real server shot, unscoped unchanged; server motor == page motor.
// Bandit (sidearm, v12.00, buffed v13.00) and Warden (rifle, v13.06, buffed v13.09): wiki.playvalorant.com/en-us/Bandit and
// /en-us/Warden fetched 2026-10-28 (parity lane), stats = valorant-api.com/v1/weapons.
import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import Motor from './src/motor.cjs';
import {Simulation,weapons,RESERVE,RELOAD_ROUND,reloadTime} from './src/simulation.js';
const require=createRequire(import.meta.url),root=new URL('..',import.meta.url).pathname;
// [price, rate, altRate|null, mag, reserve, reload, equip, run m/s, pellets, [[start,end,head,body,leg],...]]
const WIKI={
 Classic:[0,6.75,null,12,36,1.75,.75,5.73,1,[[0,30,78,26,22],[30,50,66,22,18]]],
 Shorty:[300,3,null,2,6,1.75,.75,5.4,15,[[0,7,22,11,9],[7,15,12,6,5],[15,50,6,3,2]]],
 Frenzy:[450,10,null,15,45,1.5,1,5.73,1,[[0,20,78,26,22],[20,50,63,21,17]]],
 Ghost:[500,6.75,null,13,39,1.5,.75,5.73,1,[[0,30,105,30,25],[30,50,87,25,21]]],
 Bandit:[600,5.1,null,8,24,1.5,.75,5.73,1,[[0,10,152,39,33],[10,30,128,39,33],[30,50,112,34,28]]],
 Sheriff:[800,4,null,6,24,2.25,1,5.4,1,[[0,30,159,55,46],[30,50,145,50,42]]],
 Stinger:[1100,16,8.471,20,60,2.25,.75,5.73,1,[[0,15,67,27,22],[15,50,57,23,19]]],
 Spectre:[1600,13.33,12,30,90,2.25,.75,5.73,1,[[0,15,78,26,22],[15,30,66,22,18],[30,50,60,20,17]]],
 Bucky:[850,1.1,null,5,10,2.5,1,5.06,15,[[0,8,34,17,14],[8,12,26,13,11],[12,50,18,9,7]]],
 Judge:[1850,3.5,null,5,15,2.2,1,5.06,12,[[0,10,34,17,14],[10,15,20,10,8],[15,50,14,7,5]]],
 Bulldog:[2050,10,6.316,24,72,2.5,1,5.4,1,[[0,50,115,35,29]]],
 Guardian:[2250,5.25,5.25,12,36,2.5,1,5.4,1,[[0,50,195,65,48]]],
 Warden:[2900,6.5,6.5,18,36,2.5,1,5.4,1,[[0,50,200,50,42]]],
 Phantom:[2900,11,9.9,30,60,2.5,1,5.4,1,[[0,20,156,39,33],[20,50,140,35,29]]],
 Vandal:[2900,9.75,8.775,25,50,2.5,1,5.4,1,[[0,50,160,40,34]]],
 Marshal:[950,1.5,1.2,5,15,2.5,1.25,5.4,1,[[0,50,202,101,85]]],
 Outlaw:[2400,2.75,2.75,2,10,3.8,1.25,5.4,1,[[0,50,238,140,119]]],
 Operator:[4700,.6,.6,5,10,3.7,1.5,5.13,1,[[0,50,255,150,120]]],
 Ares:[1600,13,13,50,100,3.25,1.25,5.13,1,[[0,30,75,30,25],[30,50,70,28,23]]],
 Odin:[3200,12,15.6,100,200,5,1.25,5.13,1,[[0,30,95,38,32],[30,50,77,31,26]]]};
const r2=n=>Math.round(n*100)/100,r3=n=>Math.round(n*1000)/1000;
const guns=Object.keys(weapons).filter(w=>w!=='Knife'&&!weapons[w].abilityOnly).sort();
assert.deepEqual(guns,Object.keys(WIKI).sort(),'the game\'s guns = the wiki table (20 guns incl. Bandit + Warden)');
// Server prices (spike.js buy table) and the page buy menu.
const spike=fs.readFileSync(root+'server/src/spike.js','utf8'),PRICES=Function('return '+spike.match(/const prices=(\{[^}]*\})/)[1])();
const html=fs.readFileSync(root+'index.html','utf8');
for(const [w,[price,rate,alt,mag,rsv,rld,equip,run,pel,rows]] of Object.entries(WIKI)){const p=weapons[w];
 assert.equal(PRICES[w],price,w+' price (server)');const m=[...html.matchAll(new RegExp('\\["'+w+'", (\\d+)\\]','g'))].map(x=>+x[1]);assert.deepEqual(m,[price],w+' price (page buy menu)');
 assert.equal(r2(p.fireRate),rate,w+' fire rate');
 if(alt==null)assert.equal(p.adsStats?.fireRate??null,null,w+' has no ADS rate');else assert.equal(r3(p.adsStats.fireRate),alt,w+' alt-fire / ADS rate');
 assert.equal(p.magazineSize,mag,w+' magazine');assert.equal(RESERVE[w],rsv,w+' reserve');
 assert.equal(p.equipTimeSeconds,equip,w+' equip');assert.equal(Math.floor(p.runSpeedMultiplier*Motor.C.knifeSpeed*100+1e-6)/100,run,w+' run speed (the wiki shows 2 decimals, truncated: 0.85 x 6.75 = 5.7375 -> 5.73)');
 assert.equal(Math.max(1,p.shotgunPelletCount),pel,w+' pellets');
 assert.equal(p.damageRanges.length,rows.length,w+' range bands');
 rows.forEach(([a,b,h,bo,l],i)=>{const R=p.damageRanges[i];assert.deepEqual([R.rangeStartMeters,R.rangeEndMeters,Math.floor(R.headDamage),Math.floor(R.bodyDamage),Math.floor(R.legDamage)],[a,b,h,bo,l],w+' band '+a+'-'+b+' m');});
 const u={weapon:w,ammo:0};assert.equal(reloadTime(u),RELOAD_ROUND[w]?RELOAD_ROUND[w]:rld,w+' reload');
 if(RELOAD_ROUND[w])assert.equal(r2(RELOAD_ROUND[w]*mag),rld,w+' reload to full, one round at a time');}
assert.equal(reloadTime({weapon:'Outlaw',ammo:1}),2.3,'Outlaw one barrel 2.3 s');
// Page calibration = weapons.json, page reserve table = RESERVE.
{const g={window:{}};Function('window',fs.readFileSync(root+'models/valorant/weapon-calibration.js','utf8'))(g.window);
 assert.deepEqual(g.window.VALORANT_WEAPON_STATS,JSON.parse(fs.readFileSync(root+'server/src/weapons.json','utf8')),'page calibration == weapons.json');
 assert.deepEqual(Function('return '+html.match(/const XRSV = (\{[^}]*\});/)[1])(),{...RESERVE},'page XRSV == RESERVE');}
// Bandit / Warden spread rows (wiki "Spread values"): Bandit .275/.21 -> 1.97/1.48, +.5/1.2/2.7/7, no ADS; Warden .15/.13 -> 1/.85,
// +.8/3/6/10, ADS .04/.034 -> 1.02/.87; recovery Bandit .4 (v13.00 buff .45 -> .4).
assert.deepEqual(Motor.SPREAD.Bandit,[.275,.21,1.97,1.48,.5,1.2,2.7,7]);assert.deepEqual(Motor.SPREAD.Warden,[.15,.13,1,.85,.8,3,6,10,.04,.034,1.02,.87]);assert.equal(Motor.recoveryTime('Bandit'),.4);
// Outlaw 13.01 bloom: scoped first shot 0 deg; the second scoped shot (1/2.75 s later) ~2.14 deg; the bloom holds 2.25 deg for the
// 0.15 s recovery; the spray resets after .375 s; unscoped spread stays 3.5 deg every shot.
{const deg=t=>Math.atan(t)*180/Math.PI,p=weapons.Outlaw;
 assert.deepEqual(Motor.SPREAD.Outlaw.slice(8),[0,0,2.25,2.25],'Outlaw ADS row: first 0, max 2.25');assert.equal(Motor.recoveryTime('Outlaw'),.15);
 const R={};Motor.sprayReset(R,'Outlaw',1);Motor.sprayStep(R,'Outlaw',1,1,()=>.5,Motor.bloomCap({ads:1},'Outlaw',p));
 assert.ok(Math.abs(deg(Motor.sprayBloom(R,'Outlaw',1.1))-2.25)<.01,'held at 2.25 within recovery');
 assert.ok(Math.abs(deg(Motor.sprayBloom(R,'Outlaw',1+1/2.75))-2.14)<.01,'second shot ~2.14 deg');
 assert.equal(Motor.sprayBloom(R,'Outlaw',1.4),0,'reset after .375 s');
 const R2={};Motor.sprayReset(R2,'Outlaw',1);Motor.sprayStep(R2,'Outlaw',1,1,()=>.5,Motor.bloomCap({},'Outlaw',p));assert.equal(Motor.sprayBloom(R2,'Outlaw',1+1/2.75),0,'unscoped: no added bloom');
 // Real server shots: random ~1 puts the disk point on the right axis at the cone's edge, so the right offset is the cone.
 const W={map:{attacker:[0,0,0],defender:[0,0,-30]},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const shots=ads=>{const s=new Simulation(W,'tdm','ascent',()=>.9999999),a=s.add('a');s.start(false);const out=[];s.traceShot=(o,d)=>{out.push(deg(Math.atan2(d[0],-d[2])));return Infinity;};
  for(let i=0;i<2;i++){Object.assign(a,{weapon:'Outlaw',ammo:2,x:0,y:0,z:0,look:0,pitch:0,sf:0,mv:false,air:false,cr:false,lp:0,triggerHeld:false,alive:true,input:{fire:true,ads}});s.fire(a);s.time+=1/2.75+1e-9;}return out;};
 const sc=shots(true);assert.ok(Math.abs(sc[0])<1e-6,'scoped first shot 0 deg: '+sc[0]);assert.ok(Math.abs(Math.tan(sc[1]*Math.PI/180)-Math.tan(2.14*Math.PI/180))<.0005,'scoped second shot ~2.14 deg: '+sc[1]);
 const un=shots(false);assert.ok(Math.abs(un[0]-3.5)<.01&&Math.abs(un[1]-3.5)<.01,'unscoped 3.5 deg both shots: '+un);
 assert.ok(fs.readFileSync(root+'work/feel_runtime.js','utf8').includes('const bloom=VF.model.sprayBloom(VF,w,VF.time);'),'page gSpread uses the shared motor bloom (Outlaw hold)');assert.ok(html.includes('const bloom=VF.model.sprayBloom(VF,w,VF.time);'),'regenerated page carries it');
 assert.equal(fs.readFileSync(root+'server/src/motor.cjs','utf8'),fs.readFileSync(root+'vendor/valorant-feel.js','utf8'),'server motor == page motor');}
console.log(`Wiki weapons: ${guns.length} guns = wiki infobox (price, damage bands, fire / alt rate, mag, reserve, reload, equip, run speed, pellets), server + page tables; Outlaw 13.01 scoped bloom 0 -> ~2.14 deg second shot, unscoped 3.5`);
