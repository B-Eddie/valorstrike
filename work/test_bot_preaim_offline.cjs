// Offline bots pre-aim the angle a heard / remembered enemy comes from (lane-preaim; integrate-16 probe: an offline bot's
// crosshair was within 10 deg of the enemy at the start of a fresh fight 37 % of the time, the server's 48 %; on seed 3,
// 42 of 53 fresh fights started with the bot turned to the raw spot of a sound behind cover, 13-50 deg off the corner the
// enemy came round).
//  1. BotBrain.pathCorner (shared, vendor/bot-brain.cjs): walking the nav route back from the contact to the bot, the first
//     point the bot can see -> the midpoint with the hidden one before it, at head height (where the enemy comes into view);
//     the spot in view -> the spot; a corner at the shoulder / nothing in view -> null (keep the spot)
//  2. real page (work/page_harness.cjs, native Ascent): an ally bot hears an enemy run behind cover for 1 s, the enemy then
//     creeps (silent) up its own nav route to the ally, the last 3 nodes before it comes into view walked; when the ally first sees it (xbEngage, a fresh fight) its view is within
//     10 deg of the enemy in most staged scenes (scenes picked so the raw sound spot is >= 15 deg off where the enemy first
//     comes into view). An average player does this, not better: the view turns at the bot's own turn cap (no frame step
//     above turn * dt), and with no sound / contact (a silent enemy) the view does not find the angle
//  3. wiring: the pre-aim wraps the off-fight facing (xFace) outermost, uses only the heard / remembered spot (u.hear /
//     xbGlance), turns with xbFaceTo
//   node work/test_bot_preaim_offline.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const B=require(path.join(root,'vendor','bot-brain.cjs')),out=[],fails=[];const sec=(n,f)=>{try{f();}catch(e){fails.push(n+': '+(e&&e.message||e));}};
// 1. pathCorner
sec('pathCorner',()=>{assert.equal(typeof B.pathCorner,'function','BotBrain.pathCorner');
 // an L route: out along +x to (10,0,0), then round the corner to (10,0,12); the bot at the origin sees x <= 10, z < 2
 const L=[[0,0,0],[2,0,0],[4,0,0],[6,0,0],[8,0,0],[10,0,0],[10,0,2],[10,0,4],[10,0,6],[10,0,8],[10,0,12]],vis=q=>q[2]<2;
 const c=B.pathCorner(L,vis);assert.deepEqual(c,[10,1.5,1],'corner: midpoint of the last point in view and the first hidden one, at head height ('+c+')');
 assert.deepEqual(B.pathCorner(L,()=>true),[10,1.5,12],'all in view: the spot');
 assert.equal(B.pathCorner([[0,0,0],[1,0,0],[1,0,3]],q=>q[2]<1),null,'a break at the shoulder (< PRE.near m): none');
 // in view, behind a pillar, in view again, then round the far corner: the enemy walking in shows up at the far corner
 const P2=[[0,0,0],[3,0,0],[6,0,0],[9,0,0],[12,0,0],[15,0,0],[15,0,3]],v2=q=>!(q[0]===6||q[2]>0),c2=B.pathCorner(P2,v2);
 assert.deepEqual(c2,[15,1.5,1.5],'two breaks: where its way in leaves cover last, not the first break ('+c2+')');
 assert.equal(B.pathCorner([[0,0,0],[4,0,0],[8,5,0],[8,5,6]],q=>q[0]<6),null,'another floor before the break: none');
 out.push('pathCorner: L corner '+c.join(','));});
// 3. wiring
sec('wiring',()=>{const s=fs.readFileSync(path.join(root,'work','bot_variety_runtime.js'),'utf8'),k=s.indexOf('function xpaCorner(');assert(k>0,'xpaCorner in the BOT VARIETY block');
 const w=s.slice(s.indexOf("if(typeof xFace==='function'){const f1=xFace;"));assert(w.length>0&&w.indexOf("if(typeof xFace==='function'){const f1=xFace;")===0,'pre-aim xFace wrapper');
 assert(s.indexOf("if(typeof xFace==='function'){const f0=xFace;")<s.indexOf("if(typeof xFace==='function'){const f1=xFace;"),'outermost: after the hold / corner wrapper');
 assert(/xbFaceTo\(u,Math\.atan2\(k\[0\]-p\.x,k\[2\]-p\.z\)\+\(u\.xpaK&&u\.xpaK\.o\|\|0\),dt\)/.test(w),'turns with xbFaceTo (turn cap + hand acceleration)');
 assert(/function xpaSpot\(u\)\{if\(u\.hearT>0&&u\.hear\)/.test(s)&&/xbGlance\(u\)/.test(s.slice(s.indexOf('function xpaSpot('))),'only what it heard (u.hear) or remembers (xbGlance)');
 out.push('wiring ok');});
// 2. staged scenes on the real page
const {boot}=require('./page_harness.cjs');
(async()=>{const H=boot({real3:true,seed:11,native:true}),xe=H.xe,errs0=H.errors.length;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;window.xBotSeed=11;xLob0=false;startFive();true');
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running&&!(FV.buy>0))');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 assert(xe('!!(nmActive()&&running)'),'native Ascent live round');
 // one ally bot (the listener, pinned) and one enemy bot (no AI: the test walks it); everyone else out of the map, no damage, no utility
 xe(`(()=>{const a=allies[0],b=bots[0];window.__A=a;window.__B=b;bots.concat(allies).forEach(u=>{if(u!==a&&u!==b){u.alive=false;u.hp=0;u.g.position.set(player.x+300,u.g.position.y,player.z+300);}});
  hurt=function(){return 0;};botAb=function(){};xUtilShoot=function(){return false;};if(typeof xbAmFire==="function")xbAmFire=function(){};b.nt=true;player.hp=0;player.x+=400;timeLeft=999;
  window.__E=[];const e0=xbEngage;xbEngage=function(u,pre,ctx){if(u===__A&&ctx&&ctx.e0y!=null&&window.__rec&&!__E.some(e=>e.s===__rec.s))__E.push({s:__rec.s,yaw:ctx.e0y});return e0.apply(this,arguments);};
  window.__T={max:0,cap:xbBrain(a).turn};return 1;})()`);
 // scenes: nav node pairs 9-22 m apart, no eye line, the enemy's route to the ally <= 34 m; the enemy first comes into
 // view on its route >= 5 m from the ally and >= 15 deg off the bearing of its start spot (the raw sound)
 const S=JSON.parse(xe(`JSON.stringify((()=>{const C=nmActive(),N=C.nav.nodes,R=BotRoutes.rng(77),S=[],ok=i=>(!C.playable||C.playable[i])&&(!C.nav.valid||C.nav.valid[i])&&!blocked(N[i][0],N[i][2],.45,N[i][1]);/* a clear capsule: a pinned listener inside a prop lip would be moved off it (xbUnembed) */let tries=0;
  const E=new THREE.Vector3(),Q=new THREE.Vector3();
  while(S.length<24&&tries++<6000){const i=Math.floor(R()*N.length),j=Math.floor(R()*N.length);if(!ok(i)||!ok(j))continue;const a=N[i],b=N[j],d=Math.hypot(a[0]-b[0],a[2]-b[2]);
   if(d<9||d>22||Math.abs(a[1]-b[1])>1)continue;if(S.some(s=>Math.hypot(s.a[0]-a[0],s.a[2]-a[2])<6))continue;E.set(a[0],a[1]+1.6,a[2]);if(losRaw(E,Q.set(b[0],b[1]+1.5,b[2])))continue;
   const P=nmPath(C,j,i);if(!P||P.length<3||P[P.length-1]!==i)continue;let run=0,k=-1;for(let m=1;m<P.length;m++){const p=N[P[m]],o=N[P[m-1]];run+=Math.hypot(p[0]-o[0],p[2]-o[2]);if(run>34)break;if(Math.abs(p[1]-a[1])>1.5)break;if(losRaw(E,Q.set(p[0],p[1]+1.5,p[2]))){k=m;break;}}
   if(k<1)continue;const v=N[P[k]];if(Math.hypot(v[0]-a[0],v[2]-a[2])<5)continue;const off=Math.abs(xAng(Math.atan2(v[0]-a[0],v[2]-a[2])-Math.atan2(b[0]-a[0],b[2]-a[2])));if(off<15*Math.PI/180)continue;
   S.push({a:[a[0],a[1],a[2]],b:[b[0],b[1],b[2]],route:P.slice(0,Math.min(P.length,k+4)).map(n=>N[n]),k,off:+(off*180/Math.PI).toFixed(1)});}
  return S;})())`));
 assert(S.length>=12,'enough staged scenes ('+S.length+')');
 const run=async(heard,tag)=>{const res=[];xe('__E.length=0;true');
  for(let s=0;s<Math.min(S.length,+(process.env.NS||99));s++){const c=S[s];
   xe(`(()=>{const a=__A,b=__B,c=${JSON.stringify(c)};window.__rec=null;window.__c=c;b.g.position.set(c.b[0],c.b[1],c.b[2]);a.g.position.set(c.a[0],c.a[1],c.a[2]);a.alive=true;a.hp=100;b.alive=true;b.hp=100;
    a.xMem=null;a.hear=null;a.hearT=0;a.xHold=null;a.xHp=null;a.trT=0;a.see=0;a.xTg=null;a.xpaK=null;a.xpaH=null;a.g.rotation.y=Math.atan2(c.b[0]-c.a[0],c.b[2]-c.a[2])+Math.PI*(${s}%2?.75:-.75);return 1;})()`);
   await adv(300);
   // 1 s of running footsteps at its start spot (heard 9-22 m away), then 0.4 s quiet, then the silent walk into view
   xe(`window.__rec={s:${s}};window.__tmax=0;true`);
   for(let t=0;t<1000;t+=50){if(heard&&t%300===0)xe('SFX.step({x:__B.g.position.x,y:__B.g.position.y,z:__B.g.position.z});true');await adv(50);xe(`(()=>{const a=__A;a.g.position.set(__c.a[0],__c.a[1],__c.a[2]);timeLeft=999;return 1})()`);}
   for(let t=0;t<400;t+=50){await adv(50);xe(`(()=>{const a=__A;a.g.position.set(__c.a[0],__c.a[1],__c.a[2]);timeLeft=999;return 1})()`);}if(process.env.DBG)console.log('scene',s,tag,xe(`JSON.stringify({hearT:__A.hearT,ry:+__A.g.rotation.y.toFixed(2),raw:+Math.atan2(__c.b[0]-__c.a[0],__c.b[2]-__c.a[2]).toFixed(2),xpaA:__A.xpaA,see:__A.see,E:__E.length,alive:[__A.alive,__B.alive],run:running,pos:[__A.g.position.x,__A.g.position.z]})`));
   const R=c.route.slice(Math.max(0,c.k-3));let seg=0,f=0; /* it has crept up quietly: the walk starts 3 route nodes before it comes into view (inside the bot's 3 s glance at what it heard) */
   for(let t=0;t<6000&&!xe(`__E.some(e=>e.s===${s})`);t+=50){const y0=xe('__A.g.rotation.y');f+=2.9*.05;while(seg<R.length-1){const L=Math.hypot(R[seg+1][0]-R[seg][0],R[seg+1][2]-R[seg][2]);if(f<=L)break;f-=L;seg++;}
    const p=seg<R.length-1?(()=>{const A0=R[seg],A1=R[seg+1],L=Math.hypot(A1[0]-A0[0],A1[2]-A0[2])||1,k=Math.min(1,f/L);return [A0[0]+(A1[0]-A0[0])*k,A0[1]+(A1[1]-A0[1])*k,A0[2]+(A1[2]-A0[2])*k];})():R[R.length-1];
    xe(`__B.g.position.set(${p[0]},${p[1]},${p[2]});true`);await adv(50);H.__drift=Math.max(H.__drift||0,xe('Math.hypot(__A.g.position.x-__c.a[0],__A.g.position.z-__c.a[2])'));xe(`(()=>{const a=__A;a.g.position.set(__c.a[0],__c.a[1],__c.a[2]);timeLeft=999;return 1})()`);
    if(process.env.DBG2)console.log('  t',t,xe(`JSON.stringify({ry:+__A.g.rotation.y.toFixed(2),hT:+(__A.hearT||0).toFixed(2),gl:(()=>{const c=xbGlance(__A);return c&&[+c.x.toFixed(1),c.y,+c.z.toFixed(1),c.kind]})(),xpaA:__A.xpaA,K:__A.xpaK&&__A.xpaK.key,see:__A.see,tg:!!__A.xTg,xHold:!!__A.xHold})`));
    if(!xe('__A.see>0'))H.__mx=Math.max(H.__mx||0,Math.abs(xe(`xAng(__A.g.rotation.y-(${y0}))`))/.05);}
   const e=JSON.parse(xe(`JSON.stringify(__E.find(e=>e.s===${s})||null)`));res.push(e?Math.abs(e.yaw)*180/Math.PI:null);if(process.env.DBG)console.log(' ->',e&&(e.yaw*180/Math.PI).toFixed(1),xe(`JSON.stringify({ry:+__A.g.rotation.y.toFixed(2),A:[+__A.g.position.x.toFixed(1),+__A.g.position.z.toFixed(1)],B:[+__B.g.position.x.toFixed(1),+__B.g.position.y.toFixed(1),+__B.g.position.z.toFixed(1)],appear:__c.route[__c.k],xpaA:__A.xpaA,hearT:+(__A.hearT||0).toFixed(2),gl:!!xbGlance(__A),mem:__A.xMem&&Object.values(__A.xMem.c).map(c=>[+c.x.toFixed(1),+c.z.toFixed(1),c.kind])})`));
   xe('window.__rec=null;__B.g.position.set(__B.g.position.x+300,__B.g.position.y,__B.g.position.z+300);true');await adv(600);}
  return res;};
 const heard=await run(true,'heard');const silent=await run(false,'silent');
 const seen=heard.filter(v=>v!=null),u10=seen.filter(v=>v<10).length,sil=silent.filter(v=>v!=null),s10=sil.filter(v=>v<10).length;
 const med=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?a[a.length>>1]:NaN;},cap=xe('__T.cap');
 out.push(`scenes ${S.length} (raw spot off by med ${med(S.map(c=>c.off)).toFixed(0)} deg); heard: seen ${seen.length}, <10 deg ${u10} (${(u10/Math.max(1,seen.length)*100).toFixed(0)} %), med ${med(seen).toFixed(1)} deg; silent: seen ${sil.length}, <10 deg ${s10}, med ${med(sil).toFixed(1)}; turn max ${(H.__mx||0).toFixed(1)} rad/s (cap ${cap.toFixed(1)}), listener drift max ${(H.__drift||0).toFixed(2)} m`);
sec('staged',()=>assert(seen.length>=S.length*.6,'the enemy comes into view in most heard scenes ('+seen.length+'/'+S.length+')'));
sec('staged',()=>assert(u10>=seen.length*.6,'heard enemy behind cover: crosshair already on the angle it comes from (<10 deg) in >= 60 % ('+u10+'/'+seen.length+')'));
sec('staged',()=>assert(s10<=Math.max(2,sil.length*.35)&&s10<u10,'silent enemy: no omniscience - the view does not find the angle ('+s10+'/'+sil.length+')'));
sec('staged',()=>assert((H.__mx||0)<=cap*1.02+.05,'off-fight view turns within the bot\'s own cap ('+(H.__mx||0).toFixed(2)+' vs '+cap.toFixed(2)+' rad/s)'));
 sec('errors',()=>assert.equal(H.errors.length,errs0,'page errors: '+H.errors.slice(errs0,errs0+3).map(e=>String(e&&e.stack||e).slice(0,200)).join(' | ')));
 console.log(out.join('\n'));if(fails.length){console.log(fails.join('\n'));console.log('test_bot_preaim_offline: FAIL');process.exit(1);}console.log('test_bot_preaim_offline: PASS');process.exit(0);
})().catch(e=>{console.log(out.join('\n'));console.error(e&&e.stack||e);console.log('test_bot_preaim_offline: FAIL');process.exit(1);});
