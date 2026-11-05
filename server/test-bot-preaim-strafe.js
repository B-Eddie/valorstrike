// Server bots pre-aim and strafe like Valorant players (user 2026-11-03: "the bots aren't preaiming or strafing").
// Ascent 5v5 Spike, all bots, ROUNDS rounds per line-up (two seeds). Every fight (a bot's first sight of an enemy: u.engagedAt
// set, the same enemy not seen in the 3 s before) is measured from the bot's side:
//  1. pre-aim: the angle between the bot's crosshair (look yaw + pitch) and the enemy's head the tick it first sees it -
//     >= 45 % within 10 deg and a median <= 14 deg (9738429: 40.3 %, 18.1 deg): a walking bot checks where its route
//     leaves its sight, a standing one the corner toward the enemy side, a heard / remembered spot's corner (pathCorner);
//  2. strafing: an ADAD fight changes strafe direction (the sign of its velocity across the line to the enemy, > 1 m/s)
//     at least once in >= 60 % of the fights that last 1.2 s or more, >= 0.5 changes / s (9738429: 38.7 %, 0.24 / s);
//  3. never shooting accurately on the move: of the shots of disciplined fights (u.stopShoot) past 8 m, the share fired
//     above 1.6 m/s stays at 0 (the counter-strafe stops the bot first; aim KPI: server/test-bot-aim-kpi.js).
//   node test-bot-preaim-strafe.js     (ROUNDS=6 by default; PROBE=1 prints and never fails)
import fs from 'node:fs/promises';
import {SpikeSimulation} from './src/spike.js';import {loadWorld} from './src/world.js';
const ROUNDS=+(process.env.ROUNDS||6),PROBE=!!process.env.PROBE;
const assets={async fetch(r){try{return new Response(await fs.readFile(new URL('./public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
const W=await loadWorld(assets,'ascent');
const LINEUPS=[['Raze','Cypher','Skye','Sage','Sova','Killjoy','Breach','Omen','Phoenix','Jett'],['Jett','Breach','Reyna','Sage','Chamber','Omen','Cypher','Skye','Killjoy','Raze']];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),D=180/Math.PI;
const fights=[],shots={dis:0,disMoving:0,all:0,moving:0};
for(const [li,L] of LINEUPS.entries()){let seed=23+li*11;const S=new SpikeSimulation(W,'five','ascent',()=>(seed=(seed*16807)%2147483647)/2147483647);
 L.forEach((a,i)=>S.add('b'+i+a,a,false));S.start(false);
 const f0=S.fire.bind(S);S.fire=function(u){const r=f0.apply(this,arguments);if(r&&!u.human&&u.aimTarget!=null&&!(S.buy>0)){const v=Math.hypot(u.vx||0,u.vz||0),t=S.units.find(w=>w.id===u.aimTarget),d=t?Math.hypot(t.x-u.x,t.z-u.z):0;shots.all++;if(v>1.6)shots.moving++;if(u.stopShoot&&d>8){shots.dis++;if(v>1.6){shots.disMoving++;if(process.env.DIAG)console.log("MV",v.toFixed(2),d.toFixed(2),u.stopShoot,JSON.stringify(u.adad),JSON.stringify(u.input),u.pkSt&&u.pkSt.style,u.firePat&&u.firePat.kind,(S.time-(u.fireUntil||0)).toFixed(2),u.weapon);}}}return r;};
 const cur=new Map(),last=new Map();
 for(let k=0;k<ROUNDS*200/.05&&S.round<ROUNDS;k++){S.step(.05);if(S.buy>0){cur.clear();continue;}
  for(const u of S.units){if(u.human)continue;let F=cur.get(u.id);
   if(F&&(!u.alive||!u.engagedAt||u.engagedAt!==F.at||u.aimTarget!==F.tid)){if(F.fresh)fights.push(F);cur.delete(u.id);F=null;}
   if(!u.alive)continue;
   if(u.engagedAt&&!F){const t=S.units.find(w=>w.id===u.aimTarget);const lk=u.id+'>'+u.aimTarget,fresh=!(last.get(lk)>S.time-3);
    F={at:u.engagedAt,tid:u.aimTarget,fresh,cp:Number.isFinite(u.cp0)?u.cp0*D:null,dur:0,flips:0,sg:0,still:0,n:0};
    if(t){const dx=t.x-u.x,dz=t.z-u.z,dist=Math.hypot(dx,dz),want=Math.atan2(-dx,-dz),py=Math.atan2(t.y+1.55-(u.y+1.6),dist),ey=wrap((u.look||0)-want),ep=(u.pitch||0)-py;F.cp3=Math.hypot(ey,ep)*D;F.ey=Math.abs(ey)*D;F.ep=ep*D;F.d=dist;F.mv=Math.hypot(u.vx||0,u.vz||0)>1;F.info=u.viewAt!=null||!!u.pv0;F.cor=!!u.corner;F.st=(F.mv?'mv-':'st-')+(u.viewAt!=null?(u.pcK&&u.pcK.pt?'pc':'raw'):u.hold?'hold':u.corner?'corner':(u.react&&u.react.until>S.time?'react-'+u.react.kind:'none'));}
    cur.set(u.id,F);}
   if(F){F.dur+=.05;F.n++;const t=S.units.find(w=>w.id===u.aimTarget);if(t){last.set(u.id+'>'+u.aimTarget,S.time);const dx=t.x-u.x,dz=t.z-u.z,dl=Math.hypot(dx,dz)||1,lat=((u.vx||0)*dz-(u.vz||0)*dx)/dl,sp=Math.hypot(u.vx||0,u.vz||0);
     if(sp<.3)F.still++;if(Math.abs(lat)>1){const s=Math.sign(lat);if(F.sg&&s!==F.sg)F.flips++;F.sg=s;}}}}}
 console.log(`line-up ${li}: ${S.round} rounds`);}
const fr=fights.filter(f=>f.fresh&&f.cp3!=null),pre10=fr.filter(f=>f.cp3<=10).length,long=fights.filter(f=>f.dur>=1.2),strafed=long.filter(f=>f.flips>=1).length,flipRate=long.reduce((a,f)=>a+f.flips/f.dur,0)/Math.max(1,long.length),stillSh=long.reduce((a,f)=>a+f.still/f.n,0)/Math.max(1,long.length);
const pc=(a,b)=>b?(a/b*100).toFixed(1):'0.0',med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[s.length>>1]:NaN;};
console.log(`1. pre-aim: crosshair within 10 deg of the head at first sight ${pc(pre10,fr.length)} % of ${fr.length} fresh fights (median ${med(fr.map(f=>f.cp3)).toFixed(1)} deg; cp0 yaw-only within 10 deg ${pc(fr.filter(f=>f.cp!=null&&f.cp<=10).length,fr.filter(f=>f.cp!=null).length)} %)`);
console.log(`2. strafing: ${pc(strafed,long.length)} % of ${long.length} fights >= 1.2 s change strafe direction, ${flipRate.toFixed(2)} changes / s, still ${(stillSh*100).toFixed(1)} % of fight time`);
console.log(`3. shots: ${shots.all}, moving > 1.6 m/s ${pc(shots.moving,shots.all)} %; disciplined past 8 m moving ${shots.disMoving}/${shots.dis}`);
if(process.env.DIAG){const g=(n,a)=>console.log(`  ${n}: n ${a.length} within10 ${pc(a.filter(f=>f.cp3<=10).length,a.length)} % med ${med(a.map(f=>f.cp3)).toFixed(1)} yaw ${med(a.map(f=>f.ey)).toFixed(1)} pitch ${med(a.map(f=>f.ep)).toFixed(1)} d ${med(a.map(f=>f.d)).toFixed(1)}`);g('moving',fr.filter(f=>f.mv));g('still',fr.filter(f=>!f.mv));g('corner',fr.filter(f=>f.cor));g('info',fr.filter(f=>f.info));const ks=[...new Set(fr.map(f=>f.st))];for(const k of ks)g(k,fr.filter(f=>f.st===k));}
const fails=[];
if(fr.length<80)fails.push(`enough fresh fights (${fr.length} >= 80)`);
const md=med(fr.map(f=>f.cp3));if(pre10<.45*fr.length)fails.push(`1. crosshair within 10 deg at first sight in only ${pc(pre10,fr.length)} % of fresh fights (>= 45 %; 9738429: 40.3 %)`);
if(!(md<=14))fails.push(`1. median crosshair error at first sight ${md.toFixed(1)} deg (<= 14; 9738429: 18.1)`);
if(long.length<25)fails.push(`enough fights >= 1.2 s (${long.length} >= 25)`);
if(strafed<.6*long.length)fails.push(`2. only ${pc(strafed,long.length)} % of fights >= 1.2 s change strafe direction (>= 60 %; 9738429: 38.7 %)`);
if(!(flipRate>=.5))fails.push(`2. ${flipRate.toFixed(2)} strafe direction changes / s in fights >= 1.2 s (>= 0.5; 9738429: 0.24)`);
if(shots.disMoving>0)fails.push(`3. ${shots.disMoving} disciplined shots past 8 m fired moving`);
if(fails.length&&!PROBE){console.error('FAIL test-bot-preaim-strafe\n - '+fails.join('\n - '));process.exit(1);}
console.log(fails.length?'PROBE (would fail): '+fails.join('; '):'test-bot-preaim-strafe ok');
