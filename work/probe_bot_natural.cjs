// Bot "plays like a human" probe (bots run 2026-11-09). Real page (work/page_harness.cjs native Ascent), offline 5v5,
// the player dead so every unit is a bot, sampled every 0.1 s of the action phase. Prints per seed and pooled:
//  A. movement with purpose, out of a fight (no enemy in sight for 1 s+): reversals = two back-to-back 0.3 s legs of
//     >= 0.25 m each pointing > 120 deg apart, per bot-minute of moving; dither = 3 s windows with >= 2 m walked but
//     < 25 % of it as net displacement (walking back and forth on the spot), share of the moving windows.
//  B. angle discipline while holding (standing < 0.3 m/s, no enemy in sight): mean |yaw speed| (rad/s), share of the
//     hold samples turning faster than 1.5 rad/s (swinging the view around), and the view's offset from the enemy at the
//     start of a fresh fight for a holding bot (xbEngage ctx.off, deg; lower = pre-aimed).
//  C. post-plant (Spike planted, attackers alive, no enemy in sight, defuse not started): attacker share of time
//     running (> 2.5 m/s), metres walked per attacker-second, share of time still and how far from the Spike.
//   node work/probe_bot_natural.cjs          (SEEDS=3,5,7 SECS=200 by default; each seed its own child process)
const {boot}=require('./page_harness.cjs');const {spawn}=require('child_process');
const SECS=+(process.env.SECS||200),SEEDS=(process.env.NAT_WORKER||process.env.SEEDS||'3,5,7').split(',').map(Number);
async function play(seed){
 const H=boot({real3:true,seed,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('window.xBotSeed='+seed+';J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true');
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 if(!xe('!!nmActive()'))throw Error('native Ascent not loaded');
 xe(`(()=>{const Q=window.QNA={eng:[]};const e0=xbEngage;xbEngage=function(u,pre,ctx){try{if(ctx&&u&&u.g&&!(FV.buy>0)){Q.eng.push({off:ctx.off,hold:(u.spd||0)<.3})}}catch(e){}return e0.apply(this,arguments);};return 1})()`);
 const tr=new Map(),M={mvS:0,rev:0,win:0,dith:0,hS:0,hYaw:0,hSwing:0,ppS:0,ppRun:0,ppDist:0,ppStill:0,ppR:0,plants:0,ppSetS:0,ppSetDist:0,ppSetRun:0};let lastPlant=false;
 for(let k=0;k<SECS*10;k++){await adv(100);
  if(xe('player.hp>0'))xe('pDie(null,"Vandal");true');xe('if(FV.buy>1)FV.buy=1;true');/* buy phase cut to 1 s: the window is the action phase */
  const r=JSON.parse(xe(`JSON.stringify((()=>{const s=FV.sp,o={b:FV.buy>0||!running,pl:s.st==='plant'&&!s.du,sx:s.x,sz:s.z,u:[]};for(const [L,atk] of [[bots,!FV.atk],[allies,FV.atk]])for(const u of L){if(!u||!u.g||!u.alive)continue;const p=u.g.position;o.u.push([u.name,atk?1:0,+p.x.toFixed(3),+p.z.toFixed(3),+u.g.rotation.y.toFixed(4),(u.see>0||u.blind>0)?1:0,${process.env.NAT_DETAIL?1:0}?{pk:u.pk||0,uw:u.uw?1:0,tr:u.trT>0?1:0,hr:u.hearT>0?1:0,g:u.xUg?[+u.xUg[0].toFixed(1),+u.xUg[1].toFixed(1)]:null,blk:u.blk||0,xr:u.xr?u.xr.length:-1,hp:u.xHp?(u.xHp.seat?'seat':'hold'):'-',sp:s.st,car:s.c===u?1:0,pp:(()=>{try{const P=XBV.plans&&XBV.plans.get(u);return P?{act:P.postAct||null,post:P.post?+Math.hypot(P.post[0]-p.x,P.post[2]-p.z).toFixed(1):null,hide:P.hide?1:0}:null}catch(e){return 'x'}})(),wk:u.wk||0,xpa:u.xpaA?1:0,ai:u.xHp?u.xHp.ai:-1,gl:typeof xbGlance==='function'&&xbGlance(u)?1:0,kn:typeof xbKnown==='function'?+xbKnown(u,p)[2].toFixed(1):-1}:0]);}return o;})())`));
  if(r.b){tr.clear();continue;}
  if(r.pl&&!lastPlant)M.plants++;lastPlant=r.pl;
  const live=new Set();
  for(const [nm,atk,x,z,yaw,see,dt] of r.u){live.add(nm);let T=tr.get(nm);if(!T){T={p:[],quiet:0};tr.set(nm,T);}
   T.quiet=see?0:T.quiet+.1;T.p.push([x,z,yaw,T.quiet,dt]);if(T.p.length>31)T.p.shift();const P=T.p,n=P.length;if(n<2)continue;
   const a=P[n-1],b=P[n-2],sp=Math.hypot(a[0]-b[0],a[1]-b[1])/.1,dy=Math.abs(Math.atan2(Math.sin(a[2]-b[2]),Math.cos(a[2]-b[2])))/.1;
   if(a[3]>=1){/* out of a fight for 1 s+ */
    if(sp>.8)M.mvS+=.1;
    if(n>=7&&P[n-7][3]>=.4){const c=P[n-4],d=P[n-7],ux=a[0]-c[0],uz=a[1]-c[1],vx=c[0]-d[0],vz=c[1]-d[1],lu=Math.hypot(ux,uz),lv=Math.hypot(vx,vz);
     if(k%3===0&&lu>=.25&&lv>=.25&&(ux*vx+uz*vz)/(lu*lv)<-.5){M.rev++;if(process.env.NAT_DETAIL)(M.revD||(M.revD=[])).push({nm,t:k/10,pos:[x,z],a:a[4],c:c[4],d:d[4]});}}
    if(n===31&&k%10===0&&P[0][3]>=.3){let L=0;for(let i=1;i<n;i++)L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(L>=2){M.win++;if(Math.hypot(a[0]-P[0][0],a[1]-P[0][1])<.25*L)M.dith++;}}
    if(sp<.3){M.hS++;M.hYaw+=dy;if(dy>1.5){M.hSwing++;if(a[4])(M.swD||(M.swD=[])).push({nm,t:k/10,dy:+dy.toFixed(2),a:a[4],b:b[4]});}}}
   if(r.pl&&atk&&!see&&a[3]>=1&&r.sx!=null){M.ppS++;if(sp>2.5)M.ppRun++;if(sp<.3)M.ppStill++;M.ppDist+=sp*.1;if(sp>2.5&&a[4])(M.ppD||(M.ppD=[])).push({nm,set:T.set||0,t:k/10,dS:+Math.hypot(x-r.sx,z-r.sz).toFixed(1),s:a[4]});M.ppR+=Math.hypot(x-r.sx,z-r.sz);/* settled = stood still 1.5 s since the plant: what it walks after that is re-positioning */T.pst=sp<.3?(T.pst||0)+.1:0;if(T.pst>=1.5)T.set=1;if(T.set){M.ppSetS++;M.ppSetDist+=sp*.1;if(sp>2.5)M.ppSetRun++;}}
   if(!r.pl){T.set=0;T.pst=0;}}
  for(const nm of [...tr.keys()])if(!live.has(nm))tr.delete(nm);}
 const eng=JSON.parse(xe('JSON.stringify(QNA.eng)'));return {M,eng,errors:H.errors.length};}
const fmt=(M,eng)=>{const hold=eng.filter(e=>e.hold).map(e=>e.off*57.3).sort((x,y)=>x-y),med=a=>a.length?a[a.length>>1]:NaN,u10=a=>a.length?a.filter(x=>x<10).length/a.length:NaN;
 return {reversalsPerMovingMin:+(M.rev/Math.max(1e-9,M.mvS/60)).toFixed(2),movingMin:+(M.mvS/60).toFixed(1),ditherShare:+(M.dith/Math.max(1,M.win)).toFixed(3),windows:M.win,
  holdYawRadS:+(M.hYaw/Math.max(1,M.hS)).toFixed(3),holdSwingShare:+(M.hSwing/Math.max(1,M.hS)).toFixed(3),holdSamples:M.hS,holdFightOffMedDeg:+med(hold).toFixed(1),holdFightUnder10:+u10(hold).toFixed(2),holdFights:hold.length,
  plants:M.plants,postPlantAtkSec:+(M.ppS/10).toFixed(1),ppRunShare:+(M.ppRun/Math.max(1,M.ppS)).toFixed(3),ppMetresPerSec:+(M.ppDist/Math.max(1e-9,M.ppS/10)).toFixed(2),ppStillShare:+(M.ppStill/Math.max(1,M.ppS)).toFixed(3),ppMeanDistToSpike:+(M.ppR/Math.max(1,M.ppS)).toFixed(1),ppSettledSec:+(M.ppSetS/10).toFixed(1),ppSettledRunShare:+(M.ppSetRun/Math.max(1,M.ppSetS)).toFixed(3),ppSettledMetresPerSec:+(M.ppSetDist/Math.max(1e-9,M.ppSetS/10)).toFixed(2)};};
if(process.env.NAT_WORKER){play(+process.env.NAT_WORKER).then(r=>{process.stdout.write('@@'+JSON.stringify(r)+'\n',()=>process.exit(0));}).catch(e=>{console.error(e);process.exit(1);});}
else (async()=>{const all={M:{},eng:[]};const res=await Promise.all(SEEDS.map(s=>new Promise(ok=>{const c=spawn(process.execPath,[__filename],{env:{...process.env,NAT_WORKER:String(s)}});let o='';c.stdout.on('data',d=>o+=d);c.stderr.on('data',d=>process.stderr.write(d));c.on('close',code=>{const m=o.match(/@@(.*)/);ok(m?JSON.parse(m[1]):{fail:code});});})));
 res.forEach((r,i)=>{if(r.fail!=null){console.log('seed '+SEEDS[i]+' FAILED rc='+r.fail);return;}console.log('seed '+SEEDS[i]+' '+JSON.stringify(fmt(r.M,r.eng))+(r.errors?' page errors '+r.errors:''));if(r.M.revD){console.log('REVERSALS seed '+SEEDS[i]);for(const v of r.M.revD)console.log(JSON.stringify(v));delete r.M.revD;}if(r.M.swD){for(const v of r.M.swD)console.log('SW '+JSON.stringify(v));delete r.M.swD;}if(r.M.ppD){console.log('PPRUN seed '+SEEDS[i]);for(const v of r.M.ppD)console.log('PP '+JSON.stringify(v));delete r.M.ppD;}for(const k in r.M)all.M[k]=(all.M[k]||0)+r.M[k];all.eng.push(...r.eng);});
 console.log('POOLED '+JSON.stringify(fmt(all.M,all.eng)));})();
