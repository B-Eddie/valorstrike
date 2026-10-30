// Spectated bot ammo (user 2026-10-29: "the bots still have infinite ammo. im spectating one and when it shoots, the ammo
// goes down to 11, but immediately switches back to 12"). Real page (work/page_harness.cjs), offline 5v5: the player dies,
// the last living teammate fights an enemy bot (both kept alive, open line of sight) while the player spectates it.
//  - the teammate's magazine (BOT AMMO xbAm: b.xAm is its state object) only goes down per shot and only refills through a
//    reload that takes the gun's reload time and draws from the finite 5v5 reserve; the reserve runs dry and the bot stops
//    shooting that gun (Classic: 12 + 36 = at most 48 shots). Was: index.html's bfxBot wrapper kept a second "spectated
//    mag count" in the same a.xAm field (a number, refilled whenever it was not > 0 - always, for the state object), so
//    every ally shot replaced the bot's magazine state with 11 and BOT AMMO rebuilt it full on its next frame: infinite
//    ammo for every offline teammate, and the spectator HUD flashed 11 then 12.
//  - the spectator HUD (#xWn / #xMag / #xRs) shows that true state every frame: the magazine ("…" while reloading, as the
//    player's own HUD), the reserve left, the gun.
//   node work/test_bot_ammo_spectate.cjs
const {boot}=require('./page_harness.cjs');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{
 const H=boot({real3:true,seed:7}),xe=H.xe,errs0=H.errors.length;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 ok(xe('running&&player.hp>0'),'no live round');
 const W=process.env.GUN||'Classic',mag=xe(`xbAmMag(${JSON.stringify(W)})`),res=xe(`xbAmRes(${JSON.stringify(W)})`),rld=xe(`xbAmRT(${JSON.stringify(W)},0)`);
 xe(`(()=>{const a=allies[0],b=bots[0];window.__A=a;window.__B=b;bots.concat(allies).forEach(u=>{if(u!==a&&u!==b){u.alive=false;u.hp=0;u.g.position.set(player.x+300,u.g.position.y,player.z+300);}});
  window.__hu=hurt;hurt=function(t,n,by){if(t===player)return __hu.apply(this,arguments);return 0;};/* the fight never ends */
  los=(a,q)=>true;if(typeof xbLosNow==="function")xbLosNow=()=>true;/* open ground */
  a.alive=true;a.hp=100;a.w=${JSON.stringify(W)};a.xAm=null;b.alive=true;b.hp=100;b.w="Vandal";a.g.position.set(player.x,a.g.position.y,player.z);b.g.position.set(player.x,b.g.position.y,player.z-12);
  window.__N=0;const s0=SFX.at;SFX.at=function(p,w){if(p===__A.g.position)__N++;return s0.apply(this,arguments);};
  timeLeft=999;hurt(player,500,b.name);pDie(b.name,"Classic");return 1})()`);
 const S=[];let typeBad=0,hudBad=[],grow=[],reloads=0,rlStart=null,rlDur=[];
 for(let t=0;t<30000;t+=50){await adv(50);xe('timeLeft=999;__A.hp=100;__B.hp=100;__A.alive=true;__B.alive=true;true');
  const r=JSON.parse(xe(`JSON.stringify({sp:!!xKL.sp,cur:xKL.cur&&xKL.cur.name,ty:typeof __A.xAm,st:__A.xAm&&typeof __A.xAm==='object'?[__A.xAm.w,__A.xAm.mag,__A.xAm.res,__A.xAm.rl]:null,mag:document.getElementById('xMag').textContent,rs:document.getElementById('xRs').textContent,wn:document.getElementById('xWn').textContent,n:__N})`));
  if(r.ty!=='object'&&r.ty!=='undefined'&&!(r.ty==='object'&&r.st===null))typeBad++;
  const p=S[S.length-1];
  if(r.st&&p&&p.st&&r.st[0]===p.st[0]){if(r.st[1]>p.st[1]&&!(p.st[3]>0))grow.push([t,p.st,r.st]);if(r.st[3]>0&&!(p.st[3]>0)){reloads++;rlStart=t;}if(!(r.st[3]>0)&&p.st[3]>0&&rlStart!=null){rlDur.push((t-rlStart)/1000);rlStart=null;}}
  if(r.sp&&r.cur===xe('__A.name')&&r.st&&t>3000){const want=r.st[3]>0?'…':String(r.st[1]);if(r.mag!==want&&!(r.st[3]>0&&r.mag===String(r.st[1])))hudBad.push([t,'mag',r.mag,want]);if(r.rs!==String(r.st[2]))hudBad.push([t,'rs',r.rs,r.st[2]]);if(r.wn!==r.st[0])hudBad.push([t,'wn',r.wn,r.st[0]]);}
  S.push(r);}
 const L=S[S.length-1];
 ok(S.some(r=>r.sp&&r.cur===xe('__A.name')),'spectating the teammate');
 ok(typeBad===0,'the teammate\'s magazine state stays BOT AMMO\'s object (overwritten by a number '+typeBad+' times)');
 ok(grow.length===0,'the magazine never refills without a reload: '+JSON.stringify(grow.slice(0,4)));
 ok(reloads>=2,'reloads seen: '+reloads);
 ok(rlDur.length>0&&rlDur.every(d=>Math.abs(d-rld)<=0.16),'each reload takes the gun\'s reload time '+rld+' s: '+JSON.stringify(rlDur));
 ok(L.n<=mag+res,'5v5 finite reserve: at most '+(mag+res)+' shots ('+L.n+')');
 ok(L.st&&L.st[1]===0&&L.st[2]===0,'the reserve ran dry: '+JSON.stringify(L.st));
 ok(hudBad.length===0,'spectator HUD shows the teammate\'s true magazine / reserve / gun: '+JSON.stringify(hudBad.slice(0,5))+' ('+hudBad.length+')');
 if(H.errors.length>errs0)fails.push('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.msg||e).slice(0,160)).join(' | '));
 if(fails.length){console.error('FAIL:\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Spectated bot ammo: '+W+' '+mag+' + '+res+' -> '+L.n+' shots, '+reloads+' reloads of '+rld+' s, magazine never refilled by a shot, spectator HUD = the bot\'s true magazine / reserve / gun');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
