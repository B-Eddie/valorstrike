// TDM transitions (row 7): loadout tiers unlock by elapsed match time exactly as the server's weaponAllowed (120 s rifles/
// shotguns, 300 s snipers/MGs) and the call-out fires once per unlock, also on the ONLINE client (whose tick never ran
// tdmTick) with an open loadout re-rendered; Escalation levels advance on team kill counts (7, knife 1); respawn: 2 s
// spawn protection that ends when the unit attacks (server rule), movement state reset, "respawning" message, HUD chip;
// online client mirrors the protection on respawn and closes the loadout on damage or death.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),h=fs.readFileSync(path.join(root,'index.html'),'utf8');
const between=(a,b,from=0)=>{const i=h.indexOf(a,from);assert(i>=0,'missing '+a.slice(0,60));const j=h.indexOf(b,i+a.length);assert(j>=0,'missing end '+b.slice(0,40));return h.slice(i,j);};
const fn=name=>between('function '+name+'(','\nfunction ');
(async()=>{
 // ---- Tier unlocks (offline and online share tdmTier / tdmTierTick) and parity with the server.
 const said=[];let renders=0;const T={DM:{len:570,tier:0,menu:false},timeLeft:570,say:(t)=>said.push(t),dmMR:()=>renders++,WEAP:{},Object};
 const all='Classic Shorty Frenzy Ghost Sheriff Stinger Spectre Bucky Judge Bulldog Guardian Phantom Vandal Marshal Outlaw Operator Ares Odin'.split(' ');for(const n of all)T.WEAP[n]={mag:10};
 vm.createContext(T);vm.runInContext(between('const DM_C =','\nconst DM_BW')+between('const TDM_C =','\nconst tdmBW')+'\n'+fn('tdmTierTick')+';globalThis.api={tdmTier,tdmTierTick,TDM_C,TDM_T};',T);
 const {tdmTier,tdmTierTick,TDM_C,TDM_T}=T.api;
 const {Simulation}=await import(path.join(root,'server/src/simulation.js'));
 const clientAllowed=n=>{const c=Object.keys(TDM_C).find(k=>TDM_C[k].includes(n));return !!c&&TDM_T[c]<=tdmTier();};
 for(let e=0;e<=570;e+=0.5){T.timeLeft=570-e;for(const n of all)assert.equal(clientAllowed(n),Simulation.prototype.weaponAllowed.call({mode:'tdm',remaining:570-e},n),'tier mismatch '+n+' at '+e+' s');}
 T.timeLeft=570;T.DM.tier=0;said.length=0;for(let e=0;e<=570;e+=0.05){T.timeLeft=570-e;if(Math.abs(e-200)<0.03)T.DM.menu=true;if(Math.abs(e-250)<0.03)T.DM.menu=false;if(Math.abs(e-299)<0.03)T.DM.menu=true;tdmTierTick();}
 assert.deepEqual(said,['Rifles & shotguns unlocked · B','Snipers & machine guns unlocked · B'],'unlock call-outs: '+said);assert.equal(renders,1,'an open loadout must re-render at the unlock');assert.equal(T.DM.tier,2);
 T.timeLeft=570;said.length=0;tdmTierTick();assert.equal(said.length,0,'a new match (tier back to 0) is not an unlock');
 // Online client tick now runs the tier step; a late joiner starts at the current tier (no stale call-out).
 {const i=h.indexOf('// client tick: own movement + gun only'),j=h.indexOf('return; // the client tick never ran tdmTick',i);assert(i>0&&j>i&&j-i<400&&h.slice(i,j).includes('tick(dt); if (FV.tdm) try { tdmTierTick(); } catch (e) {}'),'online client tick does not run the tier step');}
 assert(h.includes('DM.over = null; DM.tier = tdm ? tdmTier() : 0; DM.pp = 0;'),'online start does not adopt the current tier');
 assert(/function tdmTick\(dt\) \{[^}]*\}[^}]*\}\n  tdmTierTick\(\);/.test(h),'offline tdmTick does not use the tier step');
 // ---- Escalation: team kill counts drive the weapon level.
 {const E={mode:'five',FV:{dm:true,tdm:true,esc:true},WEAP:T.WEAP,DM:{over:null,tsS:''},DM_C:{Sidearms:['Classic','Shorty','Frenzy','Ghost','Sheriff']},allies:[{name:'A1',w:''}],bots:[{name:'B1',w:''}],said:[],dmAmmo(){},onSkin(){},setScope(){},updHud(){},tdmTS(){},feed(){},rw:'pri',Math};E.WEAP.Knife={mag:1};E.say=t=>E.said.push(t);E.dmScore=()=>{};
  vm.createContext(E);vm.runInContext(between('const ESC_W =','\nfunction startESC')+'\n'+between('{ const c0 = dmScore; dmScore = function (by, victim) {','\n{ const s1 = tdmTS;')+';globalThis.api={ESC,ESC_W,escNeed,escBW,get FV(){return FV;},get rw(){return rw;}};',E);
  const {ESC,ESC_W}=E.api;ESC.lv=[0,0];ESC.k=[0,0];assert.equal(ESC_W.length,12);
  for(let i=0;i<6;i++)E.dmScore('You','B1');assert.equal(ESC.lv[0],0);E.dmScore('A1','B1');assert.equal(ESC.lv[0],1,'7 team kills advance a level');assert.equal(E.FV.pri,'Ares');assert.equal(E.allies[0].w,'Ares');assert.equal(ESC.lv[1],0);
  for(let i=0;i<7;i++)E.dmScore('B1','You');assert.equal(ESC.lv[1],1);assert.equal(E.bots[0].w,'Ares');
  ESC.lv[0]=10;ESC.k[0]=0;for(let i=0;i<7;i++)E.dmScore('You','B1');assert.equal(ESC.lv[0],11);assert.equal(E.api.rw,'knife','knife level arms the knife');assert.equal(E.api.escNeed(0),1);
  E.dmScore('You','B1');assert.equal(E.DM.over,'t','one knife kill finishes Escalation');}
 // ---- Spawn protection: attacks end it, damage to a protected unit is ignored.
 const now=()=>P.performance.now();const P={performance:{t:1e6,now(){return this.t;}},mode:'five',FV:{dm:true,tdm:true},DM:{pp:0,ph:0,menu:false},player:{hp:100},bots:[],allies:[],fcd:0,kSwing:0,ammo:20,menuClosed:0,dmMenu(){P.menuClosed++;P.DM.menu=false;},hurt:(t,n)=>{t.hp-=n;},shoot(){},window:{},document:{},running:true,say(){}};
 vm.createContext(P);vm.runInContext(between('function dmUnprot(by)','\n{ const k0 = kill;')+';globalThis.api={hurt:(...a)=>hurt(...a),shoot:(...a)=>shoot(...a),dmProtHud}',P);
 const bot={name:'Bot Sova',hp:100,pp:now()+2000},ally={name:'Ally',hp:100,pp:now()+2000};P.bots.push(bot);P.allies.push(ally);P.DM.pp=now()+2000;
 P.api.hurt(P.player,30,'Bot Sova');assert.equal(P.player.hp,100,'protected player took damage');assert.equal(bot.pp,0,'a bot that attacks keeps its spawn protection');
 P.api.hurt(bot,30,'You');assert.equal(bot.hp,70);P.api.hurt(ally,40,'Bot Sova');assert.equal(ally.hp,100,'protected ally took damage');
 P.DM.menu=true;P.DM.pp=0;P.api.hurt(P.player,20,'Bot Sova');assert.equal(P.player.hp,80);assert.equal(P.menuClosed,1);assert.equal(P.DM.ph,now());
 // The player's own shot ends it (wrapper sees fcd/ammo/kSwing change), a blocked trigger pull does not.
 P.DM.pp=now()+2000;P.api.shoot();assert(P.DM.pp>now(),'no shot happened, protection must stay');

 {const Q={...P};vm.createContext(Q);Q.shoot=function(){Q.fcd=0.1;Q.ammo--;};Q.DM={pp:now()+2000};vm.runInContext(between('{ const s0 = shoot; shoot = function (hv) { const f = fcd, k = kSwing, a = ammo,','\nfunction dmProtHud')+';globalThis.go=()=>shoot();',Q);Q.go();assert.equal(Q.DM.pp,0,'firing must end spawn protection');
  const K={...P};vm.createContext(K);K.shoot=function(){K.kSwing=0.45;};K.DM={pp:now()+2000};vm.runInContext(between('{ const s0 = shoot; shoot = function (hv) { const f = fcd, k = kSwing, a = ammo,','\nfunction dmProtHud')+';globalThis.go=()=>shoot();',K);K.go();assert.equal(K.DM.pp,0,'a knife swing must end spawn protection');}
 // HUD chip while protected and alive.
 const els=[];P.document={createElement:()=>{const e={style:{},hidden:false,setAttribute(){}};els.push(e);return e;},body:{appendChild(){}}};
 P.DM.pp=now()+1500;P.api.dmProtHud();assert.equal(els.length,1);assert.equal(els[0].hidden,false);assert.equal(els[0].textContent,'SPAWN PROTECTED');
 P.performance.t+=1600;P.api.dmProtHud();assert.equal(els[0].hidden,true);P.DM.pp=now()+1000;P.player.hp=0;P.api.dmProtHud();assert.equal(els[0].hidden,true,'chip must not show while dead');
 // ---- Offline respawn resets movement state and starts protection; death says "respawning".
 {const R={player:{x:5,z:5,hp:0,armor:0,y:3,vy:-2,vx:4,vz:-3,ch:.45,st:2,air:true},DM:{prt:0},dmSpot:()=>[1,2],dmAmmo(){},xKLReset(){R.kl=1;},setScope(){},updHud(){},performance:{now:()=>5000},Math,yaw:0,pitch:0};vm.createContext(R);vm.runInContext(fn('dmSpawnP')+';dmSpawnP();',R);
  assert.deepEqual([R.player.x,R.player.z,R.player.hp,R.player.armor,R.player.vx,R.player.vz,R.player.ch,R.player.st,R.player.air],[1,2,100,50,0,0,0,0,false]);assert.equal(R.DM.pp,7000);assert.equal(R.kl,1);}
 assert(h.includes('DM.prt = 1.5; DM.pp = 0; if (DM.menu) dmMenu(false); dmScore(by, "You"); say("You died · respawning", 1400);'),'DM death does not announce the respawn');
 // ---- Online client self rows: respawn mirrors protection, damage/death close the loadout.
 {const O={MP:{sq:1,m5:0},FV:{dm:true,tdm:true},DM:{pp:0,ph:0,menu:false},player:{x:0,z:0,y:0,hp:100,armor:50,ch:.3},performance:{now:()=>9000},said:[],menus:0,dmAmmo(){O.ammoed=1;},xKLReset(){O.kl=1;},setScope(){},updHud(){},dmMenu(){O.menus++;O.DM.menu=false;},$:()=>({style:{}}),setTimeout(){},Math,yaw:0,pitch:0,reloading:0,fireHeld:true};O.say=t=>O.said.push(t);
  vm.createContext(O);vm.runInContext(fn('mpCliSelf')+';globalThis.self=mpCliSelf;',O);
  const row=(hp,alive,seq)=>[7,0,'You','Jett',3,0,4,0,hp,50,alive,'Spectre',1,0,seq];
  O.DM.menu=true;O.self(row(60,1,1));assert.equal(O.player.hp,60);assert.equal(O.menus,1,'damage must close the loadout');assert.equal(O.DM.ph,9000);
  O.DM.menu=true;O.self(row(0,0,1));assert.equal(O.player.hp,0);assert.equal(O.menus,2,'death must close the loadout');assert.deepEqual(O.said,['You died · respawning']);
  O.self(row(100,1,2));assert.equal(O.player.hp,100);assert.equal(O.player.ch,0);assert.equal(O.DM.pp,11000,'respawn must mirror the 2 s spawn protection');assert(O.ammoed&&O.kl);}
 console.log('TDM transitions: client tiers == server weaponAllowed for every weapon over 0-570 s; one call-out per unlock (online tick too), open loadout re-rendered; Escalation 7 team kills/level, knife 1, finish; spawn protection blocks damage and ends on attack/shot/swing; HUD chip; offline respawn resets movement; online respawn mirrors protection, damage/death close the loadout');
})().catch(e=>{console.error(e);process.exit(1);});
