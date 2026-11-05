// Offline bots pre-aim and strafe like Valorant players (user 2026-11-03: "the bots aren't preaiming or strafing"), the
// offline twin of server/test-bot-preaim-strafe.js. Real page (work/page_harness.cjs native Ascent, the shipped FEEL motor
// and BOT VARIETY block), 5v5 Unrated, the player dead so every fight is bot vs bot, sampled every 50 ms of the action phase.
// Every fight a bot starts (xbEngage: its first sight of an enemy) is measured from its side:
//  1. pre-aim: |view yaw - enemy bearing| when it first sees the enemy (xbEngage ctx.off) - the share within 10 deg over
//     the fresh fights (that enemy not fought in the 3 s before): a walking bot checks the corners / common angles on its
//     route, a still one the angle it holds, not only a heard / remembered spot;
//  2. strafing: an ADAD fight changes strafe direction (the sign of its velocity across the line to the enemy, > 1 m/s) at
//     least once in most fights that last 1.2 s or more;
//  3. never accurate on the move: every shot of a disciplined fight leaves stopped (botStopped; = test_bot_play_offline 5).
// Seeds pooled (one seed's round flow decides how many fights fit): SEEDS (default 3,5,7), SECS per seed (default 240; lane-adad: 150 s left 13.7 fresh / 4.7 long fights a seed, under the 15 / 5 a seed asserted below),
// each seed its own child process.
//   node work/test_bot_preaim_strafe_offline.cjs        (PROBE=1 prints and never fails)
const {boot}=require('./page_harness.cjs');const {spawn}=require('child_process'),os=require('os');
const SECS=+(process.env.SECS||240),SEEDS=(process.env.PS_WORKER||process.env.SEEDS||'3,5,7').split(',').map(Number),PROBE=!!process.env.PROBE;
async function play(seed){
 const H=boot({real3:true,seed,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true');
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 if(!xe('!!nmActive()'))throw Error('native Ascent not loaded (seed '+seed+')');
 xe(`(()=>{const Q=window.QPS={f:[],cur:new Map(),last:new Map(),shot:[]};
  const e0=xbEngage;xbEngage=function(u,pre,ctx){try{if(ctx&&u&&u.g&&mode==='five'&&!(FV.buy>0)){const F={off:ctx.off*180/Math.PI,fresh:null,d:ctx.d,mv:(u.spd||0)>1,dur:0,n:0,flips:0,sg:0,still:0,u,t:null};Q.cur.set(u,F);}}catch(e){}return e0.apply(this,arguments);};
  const s0=SFX.at;SFX.at=function(p,w){try{if(p&&!(FV.buy>0)&&w!=='Spike'&&w!=='Blade Storm'){let u=null;for(const v of bots.concat(allies))if(v&&v.g&&v.g.position===p){u=v;break;}if(u)Q.shot.push({st:botStopped(u),sl:!!u.xbSl});}}catch(e){}return s0.apply(this,arguments);};
  window.QPSstep=function(dt){if(FV.buy>0||!running){Q.cur.clear();return;}for(const [u,F] of Q.cur){if(!F.t&&u.xTt){F.t=u.xTt;F.fresh=!(Q.last.get((u.name||'')+'>'+(F.t.name||'p'))>performance.now()-3000);}const t=F.t;if(!u.alive||!(u.see>0)||!t||(t.hp<=0)){if(F.fresh)Q.f.push({off:F.off,d:F.d,mv:F.mv,dur:F.dur,flips:F.flips,still:F.n?F.still/F.n:0});Q.cur.delete(u);continue;}
   const p=u.g.position,q=t===player?player:t.g.position,dx=q.x-p.x,dz=q.z-p.z,dl=Math.hypot(dx,dz)||1,o=F.o||(F.o={x:p.x,z:p.z});const vx=(p.x-o.x)/dt,vz=(p.z-o.z)/dt;o.x=p.x;o.z=p.z;
   Q.last.set((u.name||'')+'>'+(t.name||'p'),performance.now());F.dur+=dt;F.n++;const lat=(vx*dz-vz*dx)/dl,sp=Math.hypot(vx,vz);if(sp<.3)F.still++;if(Math.abs(lat)>1){const s=Math.sign(lat);if(F.sg&&s!==F.sg)F.flips++;F.sg=s;}}};
  return true;})()`);
 for(let k=0;k<SECS*20;k++){await adv(50);if(k%4===0&&xe('player.hp>0'))xe('pDie(null,"Vandal");true');xe('QPSstep(.05);true');}
 const Q=JSON.parse(xe('JSON.stringify({f:QPS.f,shot:QPS.shot})'));return {seed,f:Q.f,shot:Q.shot,errors:H.errors.length,err:H.errors.slice(0,3)};}
if(process.env.PS_WORKER){play(+process.env.PS_WORKER).then(r=>{process.stdout.write('PSJSON '+JSON.stringify(r)+'\n');process.exit(0);},e=>{console.error(e);process.exit(1);});}
else (async()=>{const t0=Date.now(),jobs=Math.max(1,Math.min(SEEDS.length,+(process.env.PS_JOBS||os.cpus().length))),R=[];let next=0;
 const one=seed=>new Promise((res,rej)=>{const c=spawn(process.execPath,[__filename],{env:{...process.env,PS_WORKER:String(seed)},stdio:['ignore','pipe','inherit']});let out='';c.stdout.on('data',d=>out+=d);
  c.on('close',code=>{const m=out.match(/^PSJSON (.*)$/m);if(code||!m)return rej(Error('seed '+seed+' worker exit '+code+'\n'+out.slice(-2000)));res(JSON.parse(m[1]));});});
 await Promise.all(Array.from({length:jobs},async()=>{while(next<SEEDS.length){const s=SEEDS[next++];R.push(await one(s));}}));
 const F=R.flatMap(r=>r.f),S=R.flatMap(r=>r.shot),pc=(a,b)=>b?(a/b*100).toFixed(1):'0.0',med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[s.length>>1]:NaN;};
 const pre10=F.filter(f=>f.off<=10).length,long=F.filter(f=>f.dur>=1.2),strafed=long.filter(f=>f.flips>=1).length,rate=long.reduce((a,f)=>a+f.flips/f.dur,0)/Math.max(1,long.length),still=long.reduce((a,f)=>a+f.still,0)/Math.max(1,long.length);
 const dis=S.filter(s=>!s.sl),dStop=dis.filter(s=>s.st).length;
 console.log(`seeds ${SEEDS.join(',')} (${((Date.now()-t0)/1000).toFixed(0)} s): fights per seed ${R.map(r=>r.f.length).join(' / ')}`);
 console.log(`1. pre-aim: view within 10 deg of the enemy at first sight ${pc(pre10,F.length)} % of ${F.length} fresh fights (median ${med(F.map(f=>f.off)).toFixed(1)} deg; moving ${pc(F.filter(f=>f.mv&&f.off<=10).length,F.filter(f=>f.mv).length)} % of ${F.filter(f=>f.mv).length}, still ${pc(F.filter(f=>!f.mv&&f.off<=10).length,F.filter(f=>!f.mv).length)} % of ${F.filter(f=>!f.mv).length})`);
 console.log(`2. strafing: ${pc(strafed,long.length)} % of ${long.length} fights >= 1.2 s change strafe direction, ${rate.toFixed(2)} changes / s, still ${(still*100).toFixed(1)} % of fight time`);
 console.log(`3. shots ${S.length}: disciplined fights stopped ${dStop}/${dis.length}`);
 const fails=[];if(F.length<15*R.length)fails.push(`enough fresh fights (${F.length} >= ${15*R.length})`);
 /* the server twin's bars (server/test-bot-preaim-strafe.js: >= 45 %, median <= 14 deg) */const mdo=med(F.map(f=>f.off));if(pre10<.45*F.length)fails.push(`1. view within 10 deg at first sight in only ${pc(pre10,F.length)} % of fresh fights (>= 45 %)`);if(!(mdo<=14))fails.push(`1. median view error at first sight ${mdo.toFixed(1)} deg (<= 14)`);
 /* Jeff delegated 2026-11-04: long-fight sample floor 6 -> 5 a seed (measured 17 long fights over 3 seeds at the default SECS 240 on 5c7d9404, 26 at SECS=720; the strafe bar itself held at 58.8 / 50.0 %) */if(long.length<5*R.length)fails.push(`enough fights >= 1.2 s (${long.length} >= ${5*R.length})`);
 /* Jeff approved 2026-11-04: strafe direction-change bar 60 % -> 50 % of long fights (measured 50.0 % at SECS=720 on lane-adad-cs d4a786c1) */if(strafed<.5*long.length)fails.push(`2. only ${pc(strafed,long.length)} % of fights >= 1.2 s change strafe direction (>= 50 %)`);
 if(dStop!==dis.length)fails.push(`3. ${dis.length-dStop} disciplined shots fired moving`);
 for(const r of R)if(r.errors>1)fails.push('page errors seed '+r.seed+': '+JSON.stringify(r.err));
 if(fails.length&&!PROBE){console.error('FAIL test_bot_preaim_strafe_offline\n - '+fails.join('\n - '));process.exit(1);}
 console.log(fails.length?'PROBE (would fail): '+fails.join('; '):'test_bot_preaim_strafe_offline ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
