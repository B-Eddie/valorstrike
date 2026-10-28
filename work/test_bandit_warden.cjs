// Bandit + Warden in the offline page = VALORANT and = the server (vs-lane-parity 2026-10-28).
// Sources: wiki.playvalorant.com/en-us/Bandit (Sidearm, 600, semi 5.1/s, mag 8 / reserve 24, reload 1.5, equip .75/.45/.15, Medium
// pen, 152/39/33 0-10 m, 128/39/33 10-30 m, 112/34/28 30-50 m, no ADS) and /en-us/Warden (Rifle, 2900, auto 6.5/s, mag 18 / reserve 36,
// reload 2.5, equip 1/.6/.2, Medium pen, 200/50/42 no falloff, ADS 2x); valorant-api.com/v1/weapons (= server/src/weapons.json);
// wiki Team_Deathmatch (Bandit added to Stage 1, no armour) and Spike_Rush (round 1 any sidearm incl. Bandit; round 3 any primary
// >= 2250 credits).
// Real page (work/page_harness.cjs): the buy menu sells both in VALORANT's columns, a Bandit goes to the sidearm slot, both fire,
// the native Kingdom Archives model files are listed for the viewmodel loader; page tables = server tables.
//   node work/test_bandit_warden.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sim=fs.readFileSync(path.join(root,'server/src/simulation.js'),'utf8'),spike=fs.readFileSync(path.join(root,'server/src/spike.js'),'utf8'),modes=fs.readFileSync(path.join(root,'server/src/modes.js'),'utf8'),floor=fs.readFileSync(path.join(root,'server/src/floor.js'),'utf8');
const cal=JSON.parse(fs.readFileSync(path.join(root,'server/src/weapons.json'),'utf8')).weapons;
// 1. data present on both sides
for(const w of ['Bandit','Warden']){assert(cal[w],w+' in weapons.json');assert(fs.existsSync(path.join(root,'models/valorant/'+w.toLowerCase()+'.glb')),w+' model');
 assert(fs.existsSync(path.join(root,'models/valorant/animations/'+w.toLowerCase()+'.json')),w+' FP animation set');}
const PR=Function('return '+spike.match(/const prices=(\{[^}]*\})/)[1])();assert.equal(PR.Bandit,600);assert.equal(PR.Warden,2900);
assert(/export const SIDEARMS=new Set\(\[[^\]]*'Bandit'/.test(floor),'server: Bandit is a sidearm (floor / spike buy slot)');
assert(/const SIDEARMS=\[[^\]]*'Bandit'/.test(modes),'server Spike Rush round 1 sidearms include the Bandit');
assert(/\{w:\['Guardian','Warden',/.test(modes),'server Spike Rush round 3: Warden (2900 >= 2250)');
assert(/TDM_STAGES=Object\.freeze\(\[\['Classic','Frenzy','Ghost','Bandit'\]/.test(sim),'server TDM Stage 1 Bandit');
assert(/const TDM_C = \{ "Stage 1": \["Classic", "Frenzy", "Ghost", "Bandit"\]/.test(html),'page TDM Stage 1 Bandit');
assert(/const TDM_ARM = \[\{ Classic: "r", Frenzy: 0, Ghost: 0, Bandit: 0 \}/.test(html),'page TDM Bandit no armour');
assert(/const SR_LOAD = \[\{ w: \["Classic", "Shorty", "Frenzy", "Ghost", "Bandit", "Sheriff"\]/.test(html),'page SR round 1 Bandit');
assert(/\{ w: \["Guardian", "Warden", "Phantom"/.test(html),'page SR round 3 Warden');
(async()=>{
 const H=boot({real3:true,seed:11}),xe=c=>{const v=H.xe(c);return v&&typeof v==='object'?JSON.parse(JSON.stringify(v)):v;};/* page-realm arrays -> this realm for deepEqual */const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const errs0=H.errors.length;
 // 2. page tables
 assert.deepEqual(xe('[WEAP.Bandit&&[WEAP.Bandit.mag,WEAP.Bandit.head,WEAP.Bandit.body,WEAP.Bandit.legs,!!WEAP.Bandit.semi],WEAP.Warden&&[WEAP.Warden.mag,WEAP.Warden.head,WEAP.Warden.body,WEAP.Warden.legs,!!WEAP.Warden.semi]]'),[[8,152,39,33,true],[18,200,50,42,false]],'page WEAP rows');
 assert.deepEqual(xe('[wDmg(WEAP.Bandit,"head",5),wDmg(WEAP.Bandit,"head",20),wDmg(WEAP.Bandit,"body",40),wDmg(WEAP.Warden,"head",49)]'),[152,128,34,200],'page damage bands');
 assert.deepEqual(xe('[XRSV.Bandit,XRSV.Warden]'),[24,36],'page reserve');
 assert.deepEqual(xe('BUY[0][1].map(x=>x[0])'),['Classic','Shorty','Frenzy','Ghost','Bandit','Sheriff'],'buy menu sidearms (VALORANT order)');
 assert.deepEqual(xe('BUY[2][1].map(x=>x[0])'),['Bulldog','Guardian','Warden','Phantom','Vandal'],'buy menu rifles');
 assert.deepEqual(xe('[XGM.F.Bandit,XGM.F.Warden]'),['valorant/bandit','valorant/warden'],'native models listed for the viewmodel loader');
 assert.deepEqual(xe('[xPen("Bandit")===XPN.M,xPen("Warden")===XPN.M]'),[true,true],'Medium wall penetration');
 assert.equal(xe('XZ.Warden'),2,'Warden ADS 2x');
 assert.deepEqual(xe('[XAB_REEQ.Bandit,XAB_REEQ.Warden]'),[[.45,.15],[.6,.2]],'re-equip Fast / Instant');
 assert(xe('!!(window.ValorantFeel&&ValorantFeel.SPREAD&&ValorantFeel.SPREAD.Bandit&&ValorantFeel.SPREAD.Warden)')!==false,'motor spread rows');
 // 3. a real 5v5 round: buy, slot, fire
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&FV.buy>0');i++)await adv(200);
 assert(xe('running&&FV.buy>0'),'buy phase');
 xe('FV.cr=9000;fBuy("Bandit");true');assert.deepEqual(xe('[FV.sec,FV.cr]'),['Bandit',8400],'Bandit 600 into the sidearm slot');
 xe('fBuy("Warden");true');assert.deepEqual(xe('[FV.pri,FV.cr]'),['Warden',5500],'Warden 2900 into the primary slot');
 assert.equal(xe('wName()'),'Warden');assert.equal(xe('ammo'),18,'Warden magazine');
 for(let i=0;i<150&&xe('FV.buy>0');i++){xe('FV.buy=Math.min(FV.buy,0.05);true');await adv(200);}
 await adv(1500);
 const a0=xe('ammo');xe('fcd=0;try{shoot()}catch(e){window.__bwE=String(e)}true');await adv(100);
 assert.equal(xe('window.__bwE||""'),'','Warden shot');assert.equal(xe('ammo'),a0-1,'Warden fired one round');
 xe('swapW("pis");true');await adv(1200);
 assert.equal(xe('wName()'),'Bandit','sidearm in hand');const b0=xe('ammo');assert.equal(b0,8,'Bandit magazine');xe('fcd=0;shoot();true');await adv(100);assert.equal(xe('ammo'),b0-1,'Bandit fired one round');
 const errors=H.errors.slice(errs0);assert.deepEqual(errors.slice(0,4),[],'no page exceptions');
 console.log('Bandit + Warden: weapons.json / prices / slots / TDM Stage 1 / Spike Rush = server and page; page WEAP damage bands, reserve, buy menu (6 sidearms, 5 rifles), native model files, Medium pen, Warden ADS 2x, re-equip; a 5v5 round buys both into the right slots and fires each');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
