// Offline bot shots go where the bot's crosshair points and leave from its gun (user 2026-10-29: "i dont think the bullet
// is coming out of the right place for bots and i think their shots aren't going to their crosshair"). Real page
// (work/page_harness.cjs), offline 5v5: a teammate and an enemy bot fight on open ground (kept alive), the player spectates
// the teammate. For every fight shot of either bot (xbShot):
//  - the crosshair = the bot's view (yaw u.g.rotation.y, pitch xObsPitch(u): what the spectator's first-person camera and
//    the third-person gun use); the bullet (the tracer's end, seen from the bot's eye) is within the gun's spread + the
//    uncontrolled spray climb of that crosshair - never a separate aim; on average the bullets centre on the crosshair;
//  - the tracer starts at the third-person gun's muzzle (u.xm.gun: MuzzlePoint / bore end), not the hip, and ends where
//    the hitscan ray ends: on the target's body exactly when the shot is a hit (xbShot 'head' / 'body' / 'legs'), off it
//    on a miss;
//  - the third-person barrel points along the crosshair.
// Was: the shot built its own direction toward the target (flick plan, lag) apart from the drawn yaw / pitch, and the
// tracer was a random level ray along the body's facing from 1.45 m, unrelated to the hit.
//   node work/test_bot_shot_alignment.cjs
const {boot}=require('./page_harness.cjs');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{
 const H=boot({real3:true,seed:9}),xe=H.xe,errs0=H.errors.length;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 ok(xe('running&&player.hp>0'),'no live round');
 xe(`(()=>{const a=allies[0],b=bots[0];window.__A=a;window.__B=b;bots.concat(allies).forEach(u=>{if(u!==a&&u!==b){u.alive=false;u.hp=0;u.g.position.set(player.x+300,u.g.position.y,player.z+300);}});
  window.__hu=hurt;hurt=function(t,n,by){if(t===player)return __hu.apply(this,arguments);return 0;};
  los=(a,q)=>true;if(typeof xbLosNow==="function")xbLosNow=()=>true;
  a.alive=true;a.hp=100;a.w="Vandal";b.alive=true;b.hp=100;b.w="Vandal";a.g.position.set(player.x,a.g.position.y,player.z);b.g.position.set(player.x+3,b.g.position.y,player.z-15);
  timeLeft=999;hurt(player,500,b.name);pDie(b.name,"Vandal");
  window.__R=[];window.__T=null;const f0=bFx;bFx=function(from,dir,hit,far){if(from&&dir){const e=hit&&hit.point?hit.point:{x:from.x+dir.x*(far||60),y:from.y+dir.y*(far||60),z:from.z+dir.z*(far||60)};window.__T={o:[from.x,from.y,from.z],e:[e.x,e.y,e.z]};}return f0.apply(this,arguments);};
  const s0=xbShot;xbShot=function(u,tg,from,w,W,d,D){const ry=u.g.rotation.y,vp=xObsPitch(u),q=u.g.position;let mz=null,bar=null;try{const g=u.xm&&u.xm.gun;if(g){g.updateWorldMatrix(true,false);const ud=g.userData||{},m=new THREE.Vector3(0,Number.isFinite(ud.my)?ud.my:0,Number.isFinite(ud.mz)?ud.mz:-.5);g.localToWorld(m);mz=[m.x,m.y,m.z];const v=new THREE.Vector3(0,0,-1).transformDirection(g.matrixWorld);bar=[v.x,v.y,v.z];}}catch(e){}
   const mv=!!u.mv,n0=(u.lt||9)>.35?0:(u.sn||0),rk=w==="Vandal"?1:w==="Phantom"?.7:0,ae=D&&D.ae||1,ck=u.cr&&!u.mv?.85:1,cone=((typeof gSpread==="function"?gSpread(w,W,{mv:u.mv,n:n0}):.03)+.004*(1+d*.05))*ae*ck*1.42+ck*(rk?Math.min(n0,6)*.0065*rk:Math.min(n0,6)*.004*(W.rec||1))*ae*.6+(rk&&n0>6?.016*rk*ae:0)+.006;/* bSpread's own cone for this bullet: uniform spread per axis (x sqrt 2) + climb + sway *//* the tracer of this shot: drawn just before (SFX.at -> bfxBot) or inside xbShot */const r=s0.apply(this,arguments);const t=tg.t,tp=t===player?{x:player.x,y:player.y||0,z:player.z}:t.g.position;
   __R.push({who:u===__A?"A":"B",r:r===undefined?"U":r||"miss",ry,vp,eye:[q.x,(q.y||0)+1.6,q.z],pos:[q.x,q.y||0,q.z],mz,bar,T:window.__T,tp:[tp.x,tp.y||0,tp.z],sn:(u.sn||1)-1,mv,w,cone});window.__T=null;return r;};return 1})()`);
 for(let t=0;t<14000;t+=50){await adv(50);xe('timeLeft=999;__A.hp=100;__B.hp=100;__A.alive=true;__B.alive=true;true');}
 const R=JSON.parse(xe('JSON.stringify(__R)')),out=[];
 ok(R.length>=40,'fight shots: '+R.length);ok(R.every(s=>s.r!=='U'),'every fight shot on the human aim model');
 const ang=(a,b)=>{const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2],l=Math.hypot(...a)*Math.hypot(...b);return Math.acos(Math.max(-1,Math.min(1,d/l)));};
 let noTr=0,origBad=[],devBad=[],hitBad=[],barBad=[],sx=0,sy=0,n=0;
 for(const s of R){if(!s.T){noTr++;continue;}
  const view=[Math.sin(s.ry)*Math.cos(s.vp),Math.sin(s.vp),Math.cos(s.ry)*Math.cos(s.vp)],e=s.T.e,toE=[e[0]-s.eye[0],e[1]-s.eye[1],e[2]-s.eye[2]];
  // tracer origin = the muzzle
  if(s.mz){const dm=Math.hypot(s.T.o[0]-s.mz[0],s.T.o[1]-s.mz[1],s.T.o[2]-s.mz[2]);if(dm>.05)origBad.push([s.who,+dm.toFixed(3)]);}
  else origBad.push([s.who,'no gun']);
  const hb=s.T.o[1]-s.pos[1];if(!(hb>.9&&hb<1.75))origBad.push([s.who,'height '+hb.toFixed(2)]);
  // bullet within spread + uncontrolled climb of the crosshair: bSpread's cone for that bullet (spray count, moving, range)
  const dv=ang(view,toE);if(dv>s.cone)devBad.push([s.who,+dv.toFixed(3),+s.cone.toFixed(3),s.sn,s.mv]);
  // signed deviation (yaw / pitch) for the centring check: first bullets of a pull only (no climb)
  if(s.sn===0){const yv=Math.atan2(toE[0],toE[2]),pv=Math.atan2(toE[1],Math.hypot(toE[0],toE[2]));sx+=Math.atan2(Math.sin(yv-s.ry),Math.cos(yv-s.ry));sy+=pv-s.vp;n++;}
  // the tracer ends on the body exactly on a hit (the eye ray's end: lateral to the target's axis, height over its feet)
  const lat=Math.hypot(e[0]-s.tp[0],e[2]-s.tp[2]),hh=e[1]-s.tp[1],onBody=lat<.36&&hh>0&&hh<2.05;
  if((s.r!=='miss')!==onBody)hitBad.push([s.who,s.r,+lat.toFixed(2),+hh.toFixed(2)]);
  if(s.bar){const db=ang(view,s.bar);if(db>.12)barBad.push([s.who,+db.toFixed(3)]);}}
 ok(noTr===0,'every fight shot draws its tracer ('+noTr+' without)');
 ok(origBad.length===0,'tracer starts at the third-person muzzle: '+JSON.stringify(origBad.slice(0,6))+' ('+origBad.length+')');
 ok(devBad.length<=R.length*.02,'bullets within spread + climb of the crosshair (view yaw / pitch): '+JSON.stringify(devBad.slice(0,6))+' ('+devBad.length+'/'+R.length+')');
 ok(n>=5&&Math.abs(sx/n)<.012&&Math.abs(sy/n)<.012,'first bullets centre on the crosshair: mean yaw '+(sx/n).toFixed(4)+' pitch '+(sy/n).toFixed(4)+' rad over '+n);
 ok(hitBad.length===0,'tracer ends on the body exactly on hits: '+JSON.stringify(hitBad.slice(0,6))+' ('+hitBad.length+')');
 ok(barBad.length<=R.length*.05,'third-person barrel along the crosshair: '+JSON.stringify(barBad.slice(0,6))+' ('+barBad.length+')');
 if(H.errors.length>errs0)fails.push('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.msg||e).slice(0,160)).join(' | '));
 if(fails.length){console.error('FAIL:\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Offline bot shots: '+R.length+' fight shots - tracer from the third-person muzzle to the hitscan end, on the body exactly on hits, bullets within spread of the crosshair (first bullets centred: '+(sx/n*1000).toFixed(1)+' / '+(sy/n*1000).toFixed(1)+' mrad), barrel along the crosshair');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
