// Weapon values pinned to their published sources (qa-35 values audit, work/validation/values-weapons.md).
// valorant-api.com/v1/weapons (game build release-13.08, fetched 2026-10-26) for the stat blocks; wiki.playvalorant.com/en-us/<Weapon>
// for reserve, spread rows, alt fires, re-equip speeds and the Melee table. Any change here needs a newer source.
//   node work/test_weapon_values.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),h=fs.readFileSync(path.join(root,'index.html'),'utf8'),feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8');
(async()=>{
 const S=await import(path.join(root,'server/src/simulation.js'));const win={};vm.runInNewContext(fs.readFileSync(path.join(root,'models/valorant/weapon-calibration.js'),'utf8'),{window:win});
 const cal=JSON.parse(JSON.stringify(win.VALORANT_WEAPON_STATS.weapons));assert.deepEqual(cal,JSON.parse(fs.readFileSync(path.join(root,'server/src/weapons.json'),'utf8')).weapons,'page calibration == server weapons.json');
 // valorant-api.com/v1/weapons (13.08; Bandit / Warden fetched 2026-10-28, the Bandit's pellet count is the API's -1 = one bullet): [fireRate, magazine, run x, equip, reload, first-shot deg, pellets, ADS rate]
 const API={Classic:[6.75,12,.85,.75,1.75,.4,1],Shorty:[3,2,.8,.75,1.75,4,15],Frenzy:[10,15,.85,1,1.5,.65,1],Ghost:[6.75,13,.85,.75,1.5,.3,1],Bandit:[5.1,8,.85,.75,1.5,.275,-1],Sheriff:[4,6,.8,1,2.25,.25,1],
  Stinger:[16,20,.85,.75,2.25,.65,1,8.470589],Spectre:[13.333,30,.85,.75,2.25,.4,1,11.9997],Bucky:[1.1,5,.75,1,2.5,3,15],Judge:[3.5,5,.75,1,2.2,2.5,12],Bulldog:[10,24,.8,1,2.5,.3,1,6.315715],
  Guardian:[5.25,12,.8,1,2.5,.1,1,5.25],Warden:[6.5,18,.8,1,2.5,.15,1,6.5],Phantom:[11,30,.8,1,2.5,.2,1,9.9],Vandal:[9.75,25,.8,1,2.5,.25,1,8.775],Marshal:[1.5,5,.8,1.25,2.5,1,1,1.2],Outlaw:[2.75,2,.8,1.25,3.8,3.5,-1,2.75],
  Operator:[.6,5,.76,1.5,3.7,5,1,.6],Ares:[13,50,.76,1.25,3.25,1,1,13],Odin:[12,100,.76,1.25,5,.8,1,15.6]};
 for(const [w,v] of Object.entries(API)){const p=cal[w];assert.deepEqual([p.fireRate,p.magazineSize,p.runSpeedMultiplier,p.equipTimeSeconds,p.reloadTimeSeconds,p.firstBulletAccuracy,p.shotgunPelletCount],v.slice(0,7),w+' stats = valorant-api 13.08');if(v[7]!=null)assert.equal(p.adsStats.fireRate,v[7],w+' ADS rate');}
 // valorant-api shopData.cost (13.08) = server prices = page BUY
 const COST={Classic:0,Shorty:300,Frenzy:450,Ghost:500,Bandit:600,Sheriff:800,Stinger:1100,Spectre:1600,Bucky:850,Judge:1850,Bulldog:2050,Guardian:2250,Warden:2900,Phantom:2900,Vandal:2900,Marshal:950,Outlaw:2400,Operator:4700,Ares:1600,Odin:3200};
 const sp=fs.readFileSync(path.join(root,'server/src/spike.js'),'utf8');assert.deepEqual(Function('return '+sp.match(/const prices=(\{[^}]*\})/)[1])(),COST,'server prices');
 const buy=Function('return '+h.match(/const BUY = (\[\[.*?\]\]\]\]);/)[1])();const bc={};for(const c of buy)for(const it of c[1])if(COST[it[0]]!=null)bc[it[0]]=it[1];assert.deepEqual(bc,COST,'page buy menu prices');
 // wiki.playvalorant.com/en-us/<Weapon> "Spread values" rows: [1st st, 1st cr, max st, max cr, crouch-walk, walk, run, air(, ADS 1st st, cr, max st, cr)]
 const M=require(path.join(root,'vendor/valorant-feel.js'));
 const WIKI_SPREAD={Classic:[.4,.3,1.8,1.35,.5,1.1,2.3,7],Shorty:[4,3.4,4,3.4,.5,1,2,4],Frenzy:[.65,.55,1.7,1.45,.5,.8,2,7],Ghost:[.3,.23,1.65,1.24,.5,1.1,2.3,7],Bandit:[.275,.21,1.97,1.48,.5,1.2,2.7,7],Sheriff:[.25,.19,2.75,2.06,.5,1.2,3,7],
  Stinger:[.65,.55,1.5,1.28,.15,1,2.5,10,.35,.26,2.74,2.06],Spectre:[.4,.34,1.4,1.19,.15,1,2.5,10,.25,.21,1.25,1.06],Bucky:[3,2.55,3,2.55,.5,1,2,4],Judge:[2.5,2.12,4,3.4,.5,1,2,4],
  Bulldog:[.3,.26,1.25,1.06,.8,3,6,10,.1,.08,1.5,1.12],Guardian:[.1,.09,1.58,1.34,.8,3,6,10,0,0,1.48,1.25],Warden:[.15,.13,1,.85,.8,3,6,10,.04,.034,1.02,.87],Phantom:[.2,.17,.9,.76,.8,3,6,10,.11,.09,.91,.78],Vandal:[.25,.21,1,.85,.8,3,6,10,.157,.13,1.02,.87],
  Marshal:[1,.9,1,.9,7.5,10,15,20,0,0,0,0],Outlaw:[3.5,3.15,3.5,3.15,7.5,10,15,20,0,0,2.25,2.25],Operator:[5,4.5,5,4.5,7.5,10,15,15,0,0,0,0],Ares:[1,.6,.7,.42,.4,3,6.5,10,.9,.54,.55,.33],Odin:[.8,.48,1.3,.78,.4,3,6.5,10,.79,.47,1.36,.82]};
 assert.deepEqual(M.SPREAD,WIKI_SPREAD,'shared motor SPREAD = wiki spread rows');
 // wiki Reserve (also server/test-weapons.js) = page XRSV
 assert.deepEqual(Function('return '+h.match(/const XRSV = (\{[^}]*\})/)[1])(),{...S.RESERVE},'page reserve == server RESERVE');
 // wiki re-equip Fast / Instant (weapon pages "Equip Speeds"; Melee 0.3 / 0)
 const {REEQUIP}=await import(path.join(root,'server/src/windups.js'));
 assert.deepEqual({...REEQUIP},{Classic:[.45,.15],Shorty:[.45,.15],Frenzy:[.45,.15],Ghost:[.45,.15],Bandit:[.45,.15],Sheriff:[.6,.2],Stinger:[.45,.15],Spectre:[.45,.15],Bucky:[.6,.2],Judge:[.6,.2],Bulldog:[.6,.2],Guardian:[.6,.2],Warden:[.6,.2],Phantom:[.6,.2],Vandal:[.6,.2],Marshal:[.6,.2],Outlaw:[.6,.2],Operator:[.9,.5],Ares:[.75,.25],Odin:[.75,.25],Knife:[.3,0]});
 // scopes (wiki zoom): Operator 2.5x / 5x, Marshal 3.5x, Outlaw 3.5x; ADS zooms come from adsStats.zoomMultiplier (feel_runtime)
 assert(h.includes('var XSZ = { Operator: [2.5, 5], Marshal: [3.5], Outlaw: [3.5] }'),'sniper scopes');assert(feel.includes('if(p.adsStats)XZ[w]=p.adsStats.zoomMultiplier;'),'ADS zoom from adsStats');
 // Melee (wiki.playvalorant.com/en-us/Melee): Front 50 / 75, Back 100 / 150 (Primary / Alt), no headshot bonus; equip 0.6 s; 2 m
 assert.deepEqual([S.KNIFE_LIGHT.front,S.KNIFE_LIGHT.back,S.KNIFE_HEAVY.body,S.KNIFE_HEAVY.crit,S.weapons.Knife.equipTimeSeconds,S.KNIFE_RANGE],[50,100,75,150,.6,2]);
 assert(/const KNIFE = \{ light: 50, lightBack: 100, heavy: 75, heavyCrit: 150 \}/.test(h)&&feel.includes("xEq=function(w){return w==='Knife'?.6:"),'page knife table / equip');
 // Classic ALT FIRE (wiki Classic: shotgun, 3 pellets, 2.22 bursts/sec; Alt Fire spread 1.9 / 1.71 -> 5.78 / 5.21, +0 / 0.6 / 1.5 / 2.25; crouch x0.9)
 assert.deepEqual(cal.Classic.altShotgunStats,{shotgunPelletCount:3,burstRate:2.22},'valorant-api Classic alt');
 const xs=h.slice(h.indexOf('const XCLA='),h.indexOf('function xBurst()'));const C={xAD:{bn:0},window:{ValorantFeel:M},ValorantFeel:M,Math};vm.createContext(C);vm.runInContext(xs.replace('const XCLA=','var XCLA=')+';globalThis.alt=xClassicAlt;',C);
 const deg=r=>+(Math.atan(r)*180/Math.PI).toFixed(4);assert.equal(C.XCLA.pellets,3);assert.ok(Math.abs(C.XCLA.cycle-1/2.22)<1e-12);
 assert.equal(deg(C.alt({})),1.9,'first burst standing');assert.equal(deg(C.alt({cr:1})),1.71,'first burst crouched');C.xAD.bn=1;assert.equal(deg(C.alt({})),2.5,'second back-to-back burst');
 C.xAD.bn=5;assert.equal(deg(C.alt({})),5.78,'max');assert.equal(deg(C.alt({cr:1})),5.202,'max crouched (5.21)');C.xAD.bn=0;assert.equal(deg(C.alt({air:1})),4.15,'airborne +2.25');assert.equal(deg(C.alt({sf:1})),3.4,'running +1.5');assert.equal(deg(C.alt({sf:1,wk:1})),2.5,'walking +0.6');
 const xb=h.slice(h.indexOf('function xBurst()'),h.indexOf('\n}',h.indexOf('function xBurst()')));assert(!/setTimeout/.test(xb)&&/for \(let i = 0; i < XCLA\.pellets; i\+\+\)/.test(xb),'Classic alt: three rounds at once (no 60 ms staggering)');
 assert(feel.includes('if(xAD.bs)cone=xClassicAlt(P)+'),'feel gSpread uses the alt row');
 // Bucky ALT FIRE (wiki Bucky: 5 pellets, same damage table as primary fire): 17 / 34 / 14, 8-12 m 13 / 26 / 11, 12+ m 9 / 18 / 7
 assert(h.includes('alt: { pel: 5, k: 0.28, body: 17, head: 34, legs: 14, ff: [13, 26, 11], ffd: 8, ff2: [9, 18, 7], ffd2: 12 }'),'Bucky alt pellet table');assert.equal(cal.Bucky.airBurstStats.shotgunPelletCount,5);
 const dr=cal.Bucky.damageRanges.map(r=>[r.rangeStartMeters,Math.floor(r.headDamage),Math.floor(r.bodyDamage),Math.floor(r.legDamage)]);assert.deepEqual(dr,[[0,34,17,14],[8,26,13,11],[12,18,9,7]]);
 console.log('weapon values: calibration == weapons.json == valorant-api 13.08 (20 guns incl. Bandit + Warden), prices server == page == API, motor SPREAD == wiki rows, reserve, re-equip fast / instant, scopes, Melee 50/100 + 75/150 no head bonus, Classic alt 3 rounds at once + wiki alt spread, Bucky alt pellet table');
})().catch(e=>{console.error(e);process.exit(1);});
