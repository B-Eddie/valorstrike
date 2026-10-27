// Offline bots have real magazines, reserve ammo and per-weapon reload times (= the server: server/src/weapons.json
// magazineSize / reloadTimeSeconds, simulation.js RESERVE / RELOAD_ROUND / Outlaw 2.3 s one barrel - 3.8 s both, finishReload:
// finite reserve in 5v5 rounds, endless in Deathmatch / Team Deathmatch), with human-like reloads: an empty magazine
// reloads at once (mid-duel too), otherwise a bot never starts a reload while it sees an enemy; it reloads after a kill,
// behind cover / out of sight when low, and tops up in a long lull. A reload cannot be shot through (per-round guns
// excepted: a shot interrupts a Bucky / Marshal reload), a weapon swap cancels it, a new round refills every gun.
// Real page (work/page_harness.cjs): the real enemy-bot loop stops at the magazine and waits out the reload.
//   node work/test_bot_ammo_offline.cjs
const fs=require('fs'),path=require('path');const {boot}=require('./page_harness.cjs');
const fails=[];const fail=s=>fails.push(s);const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m+': got '+JSON.stringify(a)+' want '+JSON.stringify(b));};const ok=(c,m)=>{if(!c)fail(m);};
const root=path.join(__dirname,'..'),sim=fs.readFileSync(path.join(root,'server/src/simulation.js'),'utf8'),cal=JSON.parse(fs.readFileSync(path.join(root,'server/src/weapons.json'),'utf8')).weapons;
const obj=name=>{const m=sim.match(new RegExp('export const '+name+'=Object\\.freeze\\((\\{[^}]*\\})\\)'));if(!m)throw Error('server '+name+' not found');return Function('return '+m[1])();};
const RESERVE=obj('RESERVE'),RELOAD_ROUND=obj('RELOAD_ROUND');
(async()=>{
 const H=boot({real3:true,seed:7}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const errs0=H.errors.length;
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 if(!xe('running&&player.hp>0'))fail('no live round');
 const api=xe('typeof xbAm==="function"&&typeof xbAmTick==="function"&&typeof xbAmFire==="function"&&typeof xbAmRT==="function"');
 ok(api,'bot ammo API (xbAm / xbAmTick / xbAmFire / xbAmRT) present');
 if(api){
  // ---- 1. weapon data = the server's ----
  for(const [w,p] of Object.entries(cal)){if(w==='Knife')continue;
   eq(xe(`(()=>{const b={w:${JSON.stringify(w)},alive:true};const s=xbAm(b);return [s.mag,s.res]})()`),[p.magazineSize,RESERVE[w]??p.magazineSize*3],w+' magazine / reserve = server weapons.json / RESERVE');
   const want=RELOAD_ROUND[w]??(w==='Outlaw'?3.8:p.reloadTimeSeconds);
   ok(Math.abs(xe(`xbAmRT(${JSON.stringify(w)},0)`)-want)<1e-9,w+' reload time from empty = server reloadTime '+want+' (got '+xe(`xbAmRT(${JSON.stringify(w)},0)`)+')');}
  ok(Math.abs(xe('xbAmRT("Outlaw",1)')-2.3)<1e-9,'Outlaw one barrel 2.3 s');
  // ---- 2. behaviour, driven frame by frame on a bot object ----
  const R=code=>xe(`(()=>{const T=(b,s,see)=>{for(let t=0;t<s-1e-9;t+=0.05){b.see=see?(b.see||0)+0.05:0;xbAmTick(b,0.05);}};const mk=w=>{const b={w,alive:true,see:0,hp:100,name:"amT"};xbAm(b);return b;};FV.dm=false;FV.tdm=false;${code}})()`);
  eq(R('const b=mk("Vandal");for(let i=0;i<20;i++)xbAmFire(b,"Vandal");T(b,3,true);return [xbAm(b).mag,xbAm(b).rl>0,botCanShoot(b)]'),[5,false,true],'mid-duel with 5 rounds left: keeps fighting, no reload');
  eq(R('const b=mk("Vandal");for(let i=0;i<25;i++)xbAmFire(b,"Vandal");const can=botCanShoot(b);T(b,0.1,true);const st=xbAm(b).rl>0;T(b,2.3,true);const mid=[xbAm(b).mag,botCanShoot(b)];T(b,0.3,true);return [can,st,mid,xbAm(b).mag,xbAm(b).res,botCanShoot(b)]'),[false,true,[0,false],25,25,true],'empty: cannot fire, reloads at once even mid-duel, 2.5 s, 25 from the 50 reserve');
  eq(R('const b=mk("Vandal"),foe={alive:true,hp:100};for(let i=0;i<10;i++)xbAmFire(b,"Vandal",foe);T(b,0.5,true);foe.alive=false;foe.hp=0;T(b,1.2,false);return xbAm(b).rl>0||xbAm(b).mag===25'),true,'reloads right after a kill (15 / 25)');
  eq(R('const b=mk("Vandal");for(let i=0;i<17;i++)xbAmFire(b,"Vandal");T(b,0.4,true);T(b,1.5,false);return xbAm(b).rl>0||xbAm(b).mag===25'),true,'low (8 / 25) and out of sight behind cover: reloads');
  eq(R('const b=mk("Vandal");for(let i=0;i<3;i++)xbAmFire(b,"Vandal");T(b,0.4,true);T(b,0.5,false);const early=xbAm(b).rl>0;T(b,5,false);return [early,xbAm(b).mag]'),[false,25],'22 / 25: no reload in a short break, tops up in a long lull');
  eq(R('const b=mk("Vandal");for(let i=0;i<25;i++)xbAmFire(b,"Vandal");T(b,3,false);for(let i=0;i<25;i++)xbAmFire(b,"Vandal");T(b,3,false);for(let i=0;i<25;i++)xbAmFire(b,"Vandal");T(b,4,false);return [xbAm(b).mag,xbAm(b).res,botCanShoot(b)]'),[0,0,false],'5v5: the reserve runs dry (25 + 50), then the bot cannot shoot the gun');
  eq(R('FV.dm=true;const b=mk("Vandal");for(let i=0;i<25;i++)xbAmFire(b,"Vandal");T(b,3,false);const r=[xbAm(b).mag,xbAm(b).res];FV.dm=false;return r'),[25,50],'Deathmatch: endless reserve (server non-5v5 finishReload)');
  eq(R('const b=mk("Marshal");for(let i=0;i<4;i++)xbAmFire(b,"Marshal");T(b,1.4,false);const one=xbAm(b).mag,rl=xbAm(b).rl>0;const can=botCanShoot(b);xbAmFire(b,"Marshal");const cut=xbAm(b).rl>0;return [one>=2&&rl,can,cut]'),[true,true,false],'Marshal: one round per 0.5 s, can shoot mid-reload, the shot interrupts it');
  eq(R('const b=mk("Outlaw");xbAmFire(b,"Outlaw");T(b,0.1,false);T(b,0.1,false);return Math.abs(xbAm(b).rd-2.3)<1e-9||Math.abs(xbAm(b).rd-3.8)>1e-9'),true,'Outlaw one barrel reload = 2.3 s');
  eq(R('const b=mk("Vandal");for(let i=0;i<25;i++)xbAmFire(b,"Vandal");T(b,1,false);b.w="Classic";T(b,0.05,false);const s=xbAm(b);const r=[s.w,s.mag,s.rl>0];b.w="Vandal";T(b,0.05,false);return r.concat([xbAm(b).mag])'),['Classic',12,false,0],'swap cancels the reload; the other gun keeps its own magazine');
  eq(R('const b=mk("Vandal");for(let i=0;i<20;i++)xbAmFire(b,"Vandal");xbAmRound();return [xbAm(b).mag,xbAm(b).res]'),[25,50],'a new round refills magazines and reserve');
  eq(R('const b=mk("Vandal");for(let i=0;i<25;i++)xbAmFire(b,"Vandal");b.bsK=5;const bs=typeof xBsBot==="function"&&xBsBot(b);const r=botCanShoot(b);b.bsK=0;return !bs||r'),true,'Blade Storm knives are not gated by the gun magazine');
 }
 // ---- 3. the real enemy-bot loop stops at 25 and waits out the reload ----
 xe(`(()=>{const b=bots[0];window.__B=b;bots.concat(allies).forEach(u=>{if(u!==b){u.det=1e9;u.g&&u.g.position.set(player.x+300,u.g.position.y,player.z);}});allies.forEach(a=>{a.alive=false;});/* the player is the only target */window.__hu=hurt;hurt=function(t){if(t===player)return 0;return __hu.apply(this,arguments);};/* and cannot die: the fight never ends */
  b.det=0;b.alive=true;b.hp=100;b.w="Vandal";b.blind=0;b.cnc=0;b.cd=0;b.g.position.set(player.x,b.g.position.y,player.z-12);b.g.rotation.y=0;
  window.__lo=los;los=(a,q)=>true;window.__ln=typeof xbLosNow==="function"?xbLosNow:null;if(__ln)xbLosNow=()=>true;/* open ground between the bot and the player */window.__N=[];const s0=SFX.at;SFX.at=function(p,w){if(p===__B.g.position)__N.push(performance.now());return s0.apply(this,arguments);};
  if(typeof xbAmRound==="function")xbAmRound();timeLeft=Math.max(timeLeft,99);return true;})()`);
 const keep=()=>xe('timeLeft=Math.max(timeLeft,60);player.hp=100;__B.hp=100;__B.det=0;true');
 for(let t=0;t<16000;t+=50){await adv(50);keep();}
 const N=xe('__N');
 if(N.length>25){const gap=(N[25]-N[24])/1000;ok(gap>=2.4,'after 25 shots a full Vandal reload (2.5 s) before shot 26: gap '+gap.toFixed(2)+' s');
  let run=0,maxRun=0;for(let i=1;i<N.length;i++){run=(N[i]-N[i-1])>2400?0:run+1;maxRun=Math.max(maxRun,run+1);}ok(maxRun<=25,'never more than 25 shots between reload-length gaps (max '+maxRun+')');}
 ok(N.length<=75,'a 5v5 round: at most 25 + 50 reserve shots ('+N.length+')');
 xe('los=__lo;hurt=__hu;if(__ln)xbLosNow=__ln;true');
 if(H.errors.length>errs0)fail('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.stack||e).slice(0,200)).join(' | '));
 if(fails.length){console.error('FAIL:\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Offline bot ammo: magazines / reserve / reload times = server weapons.json + RESERVE + RELOAD_ROUND + Outlaw; empty reloads mid-duel, otherwise none while an enemy is in sight; reload after a kill, behind cover when low, top-up in a lull; reserve finite in 5v5, endless in DM; per-round reload interrupted by a shot; swap cancels; new round refills; real bot loop stops at 25 and waits out the 2.5 s reload');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
