// Offline bot aim KPIs (bot-gun, user 2026-10-29: "their aim is like purposely bad ... their aim isn't improving as they
// have more time"). Real page (work/page_harness.cjs, real three.js), offline 5v5: an allied and an enemy bot (Vandal, kept
// alive, endless rounds) duel at 15 m; 16 times the line of sight drops for 0.5 s and the enemy reappears 0.25-0.6 rad off
// the ally's view (a fresh fight each time, both ways). Per fight (xbShot = the bot's human aim model):
//  - first shot never before the reaction floor (BotBrain.REACT[0] 0.2 s) and never mid-flick: the first bullet of a fight
//    leaves within 0.15 rad of the target (was: an ally's burst left over from the last fight fired 0.5-0.7 rad off before
//    the flick, and the tracking lag read the re-peek's bearing jump as a 3 rad/s crossing: 0.1-0.17 rad behind);
//  - an average player's time to the first hit: median 0.5-0.9 s from first sight (reaction + flick + correction);
//  - the crosshair converges: first bullets of a pull (no spray climb) sit closer to the target 1 s+ into a fight than in
//    its first second;
//  - headshots modest: 5-38 % of hits.
//   node work/test_bot_aim_kpi_offline.cjs
const {boot}=require('./page_harness.cjs');
const D=15,N=16,CYC=2.2,fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{const H=boot({real3:true,seed:7}),xe=H.xe,errs0=H.errors.length;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 ok(xe('running'),'no live round');
 xe(`(()=>{const a=allies[0],b=bots[0];window.__A=a;window.__B=b;bots.concat(allies).forEach(u=>{if(u!==a&&u!==b){u.alive=false;u.hp=0;u.g.position.set(player.x+300,u.g.position.y,player.z+300);}});
  hurt=function(t,n,by){return 0;};if(typeof xbAmFire==="function")xbAmFire=function(){};if(typeof xbAmBlocked==="function")xbAmBlocked=function(){return false;};/* endless magazines: the fight, not the reloads */
  window.__L=true;los=(p,q)=>__L;if(typeof xbLosNow==="function")xbLosNow=()=>__L;
  a.alive=true;a.hp=100;a.w="Vandal";b.alive=true;b.hp=100;b.w="Vandal";a.g.position.set(player.x,a.g.position.y,player.z);b.g.position.set(player.x,b.g.position.y,player.z-${D});
  window.__S=[];window.__C=0;const s0=xbShot;xbShot=function(u,tg,from,w,W,d,Dd){const r=s0.apply(this,arguments);if(r!==undefined){const P=tg.t&&tg.t.g?tg.t.g.position:tg,o=u.g.position,ye=xAng(u.g.rotation.y-Math.atan2(P.x-o.x,P.z-o.z));__S.push([u===__A?'A':'B',__C,+(u.see||0).toFixed(3),r||'miss',+ye.toFixed(4),u.sn||0]);}return r;};
  timeLeft=999;player.hp=0;player.x+=200;return 1})()`);
 for(let c=0;c<N;c++){xe('__L=false;true');await adv(500);
  xe(`(()=>{__C=${c};const a=__A,b=__B,ang=a.g.rotation.y+(${c}%2?1:-1)*(.25+.35*((${c}*37)%10)/10);b.g.position.set(a.g.position.x+Math.sin(ang)*${D},b.g.position.y,a.g.position.z+Math.cos(ang)*${D});b.g.rotation.y=Math.atan2(a.g.position.x-b.g.position.x,a.g.position.z-b.g.position.z)+(${c}%3-1)*.4;__L=true;return 1})()`);
  for(let t=0;t<CYC*1000;t+=50){await adv(50);xe('timeLeft=999;__A.hp=100;__B.hp=100;__A.alive=true;__B.alive=true;true');}}
 const S=JSON.parse(xe('JSON.stringify(__S)')),md=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?a[a.length>>1]:NaN;};
 const fs=[],fh=[],fe=[];for(let c=0;c<N;c++)for(const w of ['A','B']){const q=S.filter(x=>x[0]===w&&x[1]===c);if(!q.length)continue;fs.push(q[0][2]);fe.push(Math.abs(q[0][4]));const h=q.find(x=>x[3]!=='miss');fh.push(h?h[2]:CYC);}
 const hits=S.filter(x=>x[3]!=='miss'),hs=hits.filter(x=>x[3]==='head').length/Math.max(1,hits.length);
 const first=S.filter(x=>x[5]<=3),early=first.filter(x=>x[2]<1),late=first.filter(x=>x[2]>=1),me=a=>a.reduce((s,x)=>s+Math.abs(x[4]),0)/Math.max(1,a.length);
 ok(fs.length>=20,'fights with shots: '+fs.length);
 ok(Math.min(...fs)>=.2,'first shot before the reaction floor: '+Math.min(...fs).toFixed(3)+' s');
 ok(fe.every(e=>e<.15),'first bullet of a fight mid-flick (yaw error > 0.15 rad): '+JSON.stringify(fe.filter(e=>e>=.15).map(e=>+e.toFixed(3))));
 ok(md(fh)>=.5&&md(fh)<=.9,'median time to the first hit '+md(fh).toFixed(3)+' s (0.5-0.9)');
 ok(early.length>=15&&late.length>=15&&me(late)<me(early)*.8,'crosshair converges: first bullets of a pull |yaw error| '+(1000*me(early)).toFixed(1)+' mrad (<1 s, '+early.length+') -> '+(1000*me(late)).toFixed(1)+' mrad (1 s+, '+late.length+')');
 ok(hs>=.05&&hs<=.38,'headshot share of hits '+(100*hs).toFixed(0)+' % (5-38)');
 if(H.errors.length>errs0)fails.push('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.msg||e).slice(0,160)).join(' | '));
 if(fails.length){console.error('FAIL:\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Offline bot aim KPIs: '+fs.length+' fights / '+S.length+' shots at 15 m - first shot >= '+Math.min(...fs).toFixed(2)+' s and on the target (max '+Math.max(...fe).toFixed(3)+' rad), first hit median '+md(fh).toFixed(2)+' s, first-bullet error '+(1000*me(early)).toFixed(1)+' -> '+(1000*me(late)).toFixed(1)+' mrad, headshots '+(100*hs).toFixed(0)+' % of hits');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
