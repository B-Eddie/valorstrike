// Offline TDM armour by loadout = VALORANT = server (vs-lane-parity 2026-10-28).
// wiki.playvalorant.com/en-us/Team_Deathmatch Loadout: "The amount of armor or shield a player has each stage depends on the gun they
// have chosen for that stage": Stage 1 Classic Regen Shield, Frenzy / Ghost none; Stage 2 Sheriff Light, Stinger Heavy, Ares Light;
// Stage 3 Spectre / Ares / Bulldog Heavy, Guardian Light; Stage 4 Phantom / Vandal Heavy. No kill heal in VALORANT TDM (healing comes
// from Recovery Orbs, not in this game): the page's old killer top-up to 100 HP / 50 armour is gone (the server never had it).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),h=fs.readFileSync(path.join(root,'index.html'),'utf8');
(async()=>{const sim=await import(path.join(root,'server/src/simulation.js'));
 const i=h.indexOf('const TDM_ARM =');assert(i>=0,'page TDM_ARM table');const j=h.indexOf('\n',h.indexOf('function tdmArmOf(',i));
 const c=vm.createContext({XRGN:{pool:50,cap:25}});vm.runInContext(h.slice(i,j)+';globalThis.f=tdmArmOf;',c);
 const guns='Classic Shorty Frenzy Ghost Sheriff Stinger Spectre Bucky Judge Bulldog Guardian Phantom Vandal Marshal Outlaw Operator Ares Odin'.split(' ');
 for(let st=0;st<4;st++)for(const w of guns){const p=c.f(st,w),s=sim.tdmArmor(st,w);assert.deepEqual([p.a,p.rg??null],[s.a,s.rg],'stage '+(st+1)+' '+w+' page = server');}
 assert.deepEqual([c.f(1,'Stinger').a,c.f(1,'Stinger').rg??null],[50,null]);assert.equal(JSON.stringify(c.f(0,'Classic')),'{"a":25,"rg":50}');
 const sc=h.slice(h.indexOf('function dmScore('),h.indexOf('\nfunction dmRank('));assert(!/player\.armor = 50/.test(sc)&&!/k\.armor = 50/.test(sc),'no TDM kill top-up');
 // the real page: offline TDM, the player on the Classic spawns with the Regen Shield, bots by their gun; Deathmatch keeps Heavy
 const {boot}=require('./page_harness.cjs');const H=boot({real3:true,seed:3}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";startTDM();true');await adv(600);
 assert.equal(xe('FV.tdm&&!FV.esc'),true,'TDM');assert.equal(xe('player.armor'),25,'Stage 1 Classic: 25');assert.equal(xe('player.rgn'),50,'Regen Shield pool');
 const bad=xe('JSON.stringify(bots.concat(allies).filter(b=>{const e=tdmArmOf(0,b.w);return b.armor!==e.a||(b.rgn??null)!==(e.rg??null)}).map(b=>[b.name,b.w,b.armor,b.rgn]))');assert.equal(bad,'[]','bots armoured by their Stage 1 gun');
 xe('FV.pri="Vandal";timeLeft=DM.len-300;DM.tier=3;dmSpawnP();true');assert.equal(xe('player.armor'),50,'Stage 4 Vandal: Heavy');assert.equal(xe('player.rgn==null'),true);
 xe('timeLeft=DM.len-160;FV.pri="Guardian";dmSpawnP();true');assert.equal(xe('player.armor'),25,'Stage 3 Guardian: Light');
 xe('player.hp=40;player.armor=0;dmScore("You",bots[0].name);true');assert.deepEqual([xe('player.hp'),xe('player.armor')],[40,0],'a kill does not heal in TDM');
 console.log('TDM armour by loadout (page = server = wiki), no kill heal');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
