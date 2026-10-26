// Page side of the qa-36 weapon fixes (= server test-weapon-cadence.js; sources in work/validation/values-weapons.md):
//  1. fire cadence: index.html xCadShot / xRate and the production feel xRate (work/feel_runtime.js) give the same shot times as the
//     server fire() for Bulldog / Stinger ADS bursts (wiki rows), the Odin hip spin-up and every other gun (shared motor CADENCE).
//  2. the index.html base WEAP table (seen by the feel-less page harness) = models/valorant/weapon-calibration.js (mag, rate, pellets,
//     floored damage per range): no stale Operator 0.75/s etc.
//  3. online Classic ALT FIRE: xBurst's click sends alt:1 with the fire pulse (server fires 3 rounds at once).
//  4. real page (work/page_harness.cjs): Bucky ALT FIRE canister inside 7.5 m = 40 / 20 / 15 only, past it pellets; an ADS
//     Bulldog tap fires the whole 3-round burst; Jett Cloudburst puts the gun away for 0.25 s + the fast re-equip (= server recoverTime).
//   node work/test_weapon_cadence_page.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8'),srt=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const Motor=require(path.join(root,'vendor/valorant-feel.js'));
const line=(src,start)=>{const i=src.indexOf(start);assert(i>=0,'missing '+start.slice(0,60));return src.slice(i,src.indexOf('\n',i));};
const close=(a,b,e,m)=>assert.ok(Math.abs(a-b)<=e,`${m}: ${a} vs ${b}`);
(async()=>{
 const S=await import(path.join(root,'server/src/simulation.js')),weapons=S.weapons;
 const win={};vm.runInNewContext(fs.readFileSync(path.join(root,'models/valorant/weapon-calibration.js'),'utf8'),{window:win});const cal=win.VALORANT_WEAPON_STATS.weapons;
 // ---- 1. cadence: page (base + feel xRate) vs the server on a 1 ms clock ----
 const a=html.indexOf('const XCAD = {};'),b=html.indexOf('\n',html.indexOf('function xRate(W)',a));assert(a>0&&b>a,'xCad block');
 const pageShots=(w,ads,T,useFeel)=>{const now={t:0},C={window:{ValorantFeel:Motor},performance:{now:()=>now.t},ads,Math,Object,WEAP:{},VF:{profiles:cal},wName:()=>w};for(const n of Object.keys(cal))C.WEAP[n]={rate:cal[n].fireRate};vm.createContext(C);
  vm.runInContext(html.slice(a,b)+(useFeel?';'+line(feel,'xRate=function(W){'):'')+';globalThis.T={shot:w=>xCadShot(w),rate:W=>xRate(W)};',C);const shots=[];let next=0;
  for(let t=0;t<=T*1000;t++){now.t=t;if(t>=next){C.T.shot(w);shots.push(t/1000);next=t+1000/C.T.rate(C.WEAP[w]);}}return shots;};
 const serverShots=(w,ads,T)=>{const s=new S.Simulation({map:{attacker:[0,0,0],defender:[0,0,-40]},nav:{nodes:[[0,0,0],[0,0,-40]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity},'tdm','ascent',()=>.5),u=s.add('a');s.start(false);u.human=true;
  Object.assign(u,{weapon:w,ammo:500,x:0,y:0,z:0,look:0,pitch:0,fireAt:0,protectedUntil:0});const t0=s.time,shots=[];let seq=0;
  while(s.time-t0<T+1e-9){s.command(u,{t:'in',seq:++seq,r:0,p:0,fire:1,ads:ads?1:0});s.events.length=0;s.step(.001);if(s.events.some(e=>e[0]==='s'))shots.push(s.time-t0);}return shots;};
 let n=0;
 for(const [w,ads] of [['Bulldog',1],['Stinger',1],['Odin',0],['Odin',1],['Vandal',0],['Vandal',1],['Spectre',1],['Phantom',0]]){
  const sv=serverShots(w,ads,1.2),pf=pageShots(w,ads,1.2,true),pb=ads?null:pageShots(w,ads,1.2,false);
  const gaps=x=>x.slice(1).map((t,i)=>t-x[i]);const gs=gaps(sv),gp=gaps(pf);assert.ok(Math.abs(gs.length-gp.length)<=1,w+' ads='+ads+' shot counts '+sv.length+' / '+pf.length);
  for(let i=0;i<Math.min(gs.length,gp.length);i++)close(gp[i],gs[i],.0021,`${w} ads=${ads} gap ${i} page (feel) = server`);
  if(pb){const gb=gaps(pb);for(let i=0;i<Math.min(gs.length,gb.length);i++)close(gb[i],gs[i],.0021,`${w} hip gap ${i} page (base, harness) = server`);}n++;}
 {const B=Motor.CADENCE.burst.Bulldog,g=pageShots('Bulldog',1,1,true);close(g[3]-g[0],1/B.bps,.0011,'page Bulldog burst period 1/2.105');close(g[1]-g[0],1/B.rate,.0011,'page Bulldog round 1/13.333');}
 // ---- 2. base WEAP = calibration ----
 const wa=html.indexOf('const WEAP = { Vandal:'),wb=html.indexOf('\nlet ',html.indexOf('WEAP.Outlaw = ',wa));const W=JSON.parse(JSON.stringify(vm.runInNewContext(html.slice(wa,wb).replace('const WEAP','var WEAP')+';WEAP',{})));/* own-realm arrays for deepEqual */
 for(const [name,c] of Object.entries(cal)){if(name==='Knife')continue;const X=W[name];assert(X,name+' in base WEAP');const R=c.damageRanges,f=r=>[Math.floor(r.bodyDamage),Math.floor(r.headDamage),Math.floor(r.legDamage)];
  assert.equal(X.mag,c.magazineSize,name+' mag');assert.equal(X.rate,c.fireRate,name+' rate');if(c.shotgunPelletCount>1)assert.equal(X.pel,c.shotgunPelletCount,name+' pellets');
  assert.deepEqual([X.body,X.head,X.legs],f(R[0]),name+' damage 0 m');if(R[1]){assert.deepEqual(X.ff,f(R[1]),name+' 2nd range');assert.equal(X.ffd,R[1].rangeStartMeters);}else assert.equal(X.ff,undefined,name+' no 2nd range');
  if(R[2]){assert.deepEqual(X.ff2,f(R[2]),name+' 3rd range');assert.equal(X.ffd2,R[2].rangeStartMeters);}assert.equal(X.spin,undefined,name+': no stale spin');}
 assert.deepEqual([W.Operator.rate,W.Marshal.rate,W.Bulldog.rate,W.Shorty.rate,W.Shorty.pel,W.Judge.mag,W.Frenzy.mag],[.6,1.5,10,3,15,5,15],'the stale values named in values-weapons.md');
 // ---- 3. online Classic alt pulse ----
 assert(srt.includes("if(typeof xAD!=='undefined'&&xAD.bs&&rw!=='knife'){NET.altPulse=NET.firePulse;NET.firePendA=1;}")&&srt.includes('alt:NET.altPulse>performance.now()||fa?1:0'),'online alt pulse wiring');
 {const C={NET:{seq:0,firePend:1,firePendH:0,firePendA:1,altPulse:0,fireHeavy:0,firePulse:0},performance:{now:()=>1e6},yaw:0,pitch:0,ads:0,WEAP:{Classic:{semi:1}},fireHeld:false,J:{pick:'Sage'}};vm.createContext(C);vm.runInContext(line(srt,'function netInputMsg(kk,w)')+'\n;globalThis.m1=netInputMsg({},"Classic");globalThis.m2=netInputMsg({},"Classic");',C);
  assert.deepEqual([C.m1.fire,C.m1.alt,C.m2.fire,C.m2.alt],[1,1,0,0],'a pending alt click rides one input message');}
 // ---- 4. real page ----
 const {boot}=require('./page_harness.cjs');const H=boot({real3:true,seed:5}),xe=H.xe;const e0=H.errors.length;/* load-phase harness notes (e.g. 'unexpected external script ...manifest.js') are not page exceptions */const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);xe('FV.buy=0;true');await adv(300);
 for(let i=0;i<300&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 assert(xe('running&&player.hp>0'),'live round');xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,60);true');
 // Bucky canister / air burst at a bot straight ahead
 const put=d=>xe(`(()=>{const b=bots.find(b=>b.g&&b.alive)||bots[0];bots.forEach(q=>{if(q!==b)q.g.position.set(player.x+200,q.g.position.y,player.z);});b.alive=true;b.hp=500;b.armor=0;b.blind=0;b.g.position.set(player.x-Math.sin(yaw)*${d},b.g.position.y,player.z-Math.cos(yaw)*${d});window.__b=b;camera.updateMatrixWorld(true);b.g.updateMatrixWorld(true);return true;})()`);
 const bucky=async(d,alt)=>{put(d);xe(`FV.pri="Bucky";rw="pri";ammo=5;fcd=0;VM.sw=0;reloading=0;pitch=-0.12;ads=${alt?1:0};true`);await adv(50);put(d);xe('fcd=0;VM.sw=0;shoot();true');return xe('500-__b.hp');};
 const c5=await bucky(4,true);assert(c5===20||c5===40||c5===15,'canister inside 7.5 m: one 40 / 20 / 15 hit, got '+c5);
 const p9=await bucky(10,true);assert(p9>0&&p9!==20&&p9!==40&&p9!==15,'past 7.5 m: pellets from the burst point, got '+p9);
 const h4=await bucky(4,false);assert(h4>40,'primary fire: pellets from the muzzle, got '+h4);xe('ads=0;true');
 // ADS Bulldog tap: the whole burst
 xe('FV.pri="Bulldog";rw="pri";ammo=24;fcd=0;VM.sw=0;reloading=0;ads=1;for(const k in XCAD)delete XCAD[k];true');await adv(50);xe('ammo=24;fcd=0;VM.sw=0;reloading=0;ads=1;fireHeld=true;shoot();fireHeld=false;true');const b0=xe('ammo');if(b0!==23)console.log('DBG',xe('JSON.stringify([fcd,VM.sw,reloading,player.hp,FV.buy,!!J.eq,XABT.inst,XCA.on,wName(),rw,ads,ammo,mode,typeof xBurst])'));await adv(400);
 assert.deepEqual([b0,xe('ammo')],[23,21],'a tapped ADS Bulldog burst fires its other 2 rounds without the trigger, then stops');
 // held ADS Bulldog: burst after burst (2.105 bursts/s) while the trigger stays down; a tapped ADS Stinger fires all 4 (qa-37: the old setTimeout
 // wrapper dropped the trigger after one burst and swallowed the click when the harness had no timers)
 xe('ammo=24;fcd=0;VM.sw=0;reloading=0;ads=1;for(const k in XCAD)delete XCAD[k];fireHeld=true;shoot();true');await adv(1200);const held=24-xe('ammo');xe('fireHeld=false;true');await adv(500);
 assert(held>=7&&held<=9,'held ADS Bulldog 1.2 s = 3 bursts at 0 / 0.475 / 0.95 s (7-9 rounds on 50 ms frames), got '+held);
 xe('FV.pri="Stinger";rw="pri";ammo=20;fcd=0;VM.sw=0;reloading=0;ads=1;for(const k in XCAD)delete XCAD[k];true');await adv(50);xe('ammo=20;fcd=0;VM.sw=0;reloading=0;ads=1;fireHeld=true;shoot();fireHeld=false;true');await adv(400);
 assert.equal(xe('ammo'),16,'a tapped ADS Stinger burst fires 4 rounds');xe('ads=0;true');
 // Jett Cloudburst: gun away 0.25 s + Classic fast 0.45 s
 xe('FV.pri="";rw="pis";ammo=12;fcd=0;VM.sw=0;reloading=0;J.pick="Jett";J.c=2;J.cd.c=0;J.eq=null;XABT.inst=null;xCaEnd();true');
 const tap=async(code)=>{H.key(code,true);await adv(20);H.key(code,false);};await tap('KeyC');
 assert.equal(xe('XABT.inst&&XABT.inst.t>0'),true,'Cloudburst: the gun is being put away');const a0=xe('ammo');xe('fcd=0;shoot();true');assert.equal(xe('ammo'),a0,'no fire 20 ms after the press');
 await adv(300);assert.equal(xe('XABT.inst'),null,'unequip over after 0.25 s');assert(xe('VM.sw')>0.2,'the Classic re-equips (VM.sw '+xe('VM.sw')+')');xe('fcd=0;shoot();true');assert.equal(xe('ammo'),a0,'no fire during the re-equip');
 await adv(450);xe('fcd=0;shoot();true');assert.equal(xe('ammo'),a0-1,'fires again after 0.25 + 0.45 s (= server recoverTime Jett c Classic 0.7)');
 const {recoverTime}=await import(path.join(root,'server/src/windups.js'));assert.equal(recoverTime('Jett','c','Classic'),.7);
 assert.equal(xe('JSON.stringify([XAB_UNEQ.Jett,XAB_UNEQ.Reyna])'),JSON.stringify([{c:.25,e:.2},{c:.5,q:.5,e:.6}]),'page unequip table = server');
 if(H.errors.length>e0)throw new Error('page errors: '+H.errors.slice(e0,e0+3).map(e=>typeof e==='string'?e:JSON.stringify(e)||String(e)).join(' | '));
 console.log(`weapon cadence (page): ${n} gun / ADS cadences = server (bursts, Odin spin-up), base WEAP = calibration, online Classic alt pulse, Bucky canister / air burst, ADS bursts finish (tap, held, Stinger 4), Cloudburst unequip + re-equip ok`);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
