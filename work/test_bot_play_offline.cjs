// Bots play the round like Valorant players instead of standing still (user 17:41-17:45 2026-10-26: "bots constantly
// standing still", "no corner checking / clearing angles", "not aiming / shooting smartly: crosshair placement, tap / burst
// vs spray by range, counter-strafe / stop to shoot"). Measured on the real page (work/page_harness.cjs native: the real
// native-map loader on Ascent nav + collision, the shipped FEEL motor and BOT VARIETY block), 5v5 Unrated, the player dead
// so every fight is bot vs bot, sampled every 0.2 s of the action phase:
//  1. moving share per side (> 0.5 m/s, an alive bot, out of the buy phase) and the long-still share (a bot not moving
//     and not fighting for 8 s or more). 55b5ef7: the bots reached their spots and froze (xFace does nothing at zero
//     velocity), a defender stood in the geometry, and after the attackers died the defenders froze for the fuse.
//  2. angle holding: a bot on its spot keeps its crosshair on one of its XHP corners (the routes an enemy comes from, cut
//     where the line of sight breaks), checks more than one, and re-seats instead of standing in one spot all round.
//  3. pre-aim at first contact: a holding bot's view is already near the enemy when the fight starts (BotBrain.reaction /
//     crosshair get the pre-aimed bonus), much nearer than a bot that is walking.
//  4. fire mode by range: the trigger pulls (BotBrain.firePattern through xbBurst) are sprays up close and taps / bursts
//     far, in the live fights and in a direct draw at fixed ranges.
//  5. stopped before each shot: every shot of a disciplined fight leaves at or under the accuracy deadzone (botStopped:
//     the counter-strafe has stopped it); only the fights a bot plays sloppy (xbSl, BotBrain.discipline) may fire moving.
// Human limits stay: reactions and turn rates are the shared model's (not touched here); no shot through a wall.
//   node work/test_bot_play_offline.cjs        (SECS=180 SEED=3 by default)
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const SECS=+(process.env.SECS||180),SEED=+(process.env.SEED||3);
(async()=>{
 const H=boot({real3:true,seed:SEED,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true');
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 assert(xe('!!nmActive()'),'native Ascent loaded');
 // instruments: new fights (xbEngage ctx.off = |view - enemy| at the start), trigger pulls (xbBurst range + kind), shots (SFX.at from a bot)
 xe(`(()=>{const Q=window.QPL={eng:[],pull:[],shot:[]};
  const e0=xbEngage;xbEngage=function(u,pre,ctx){try{if(ctx&&u&&u.g&&mode==='five'&&!(FV.buy>0)){const H=u.xHp;Q.eng.push({off:ctx.off,hold:!!(H&&!H.seat&&H.ang&&H.ang.length&&!(u.spd>.5)),walk:(u.spd||0)>1.5,d:ctx.d});}}catch(e){}return e0.apply(this,arguments);};
  if(typeof xbBurst==='function'){const b0=xbBurst;xbBurst=function(u,d,W){const n=b0.apply(this,arguments);try{if(!(FV.buy>0))Q.pull.push({d,k:u.xbPat||null,n});}catch(e){}return n;};}
  const s0=SFX.at;SFX.at=function(p,w){try{if(p&&!(FV.buy>0)&&w!=='Spike'&&w!=='Blade Storm'){let u=null;for(const v of bots.concat(allies))if(v&&v.g&&v.g.position===p){u=v;break;}if(u)Q.shot.push({st:botStopped(u),sl:!!u.xbSl,sf:+(u.sf||0).toFixed(2)});}}catch(e){}return s0.apply(this,arguments);};return true;})()`);
 const prev=new Map(),still=new Map(),acc={atk:[0,0],def:[0,0]},hold={n:0,on:0,corners:new Map(),seats:new Map()};let longStill=0,stillN=0;
 for(let k=0;k<SECS*5;k++){await adv(200);
  const r=JSON.parse(xe(`JSON.stringify((()=>{const o={buy:FV.buy,run:running,u:[]};for(const [L,atk] of [[bots,!FV.atk],[allies,FV.atk]])for(const u of L){if(!u||!u.g)continue;const p=u.g.position,H=u.xHp;let on=null;
   if(u.alive&&H&&!H.seat&&H.ang&&H.ang.length&&!(u.see>0)&&!(u.hearT>0)&&!(u.blind>0)){on=0;for(const a of H.ang){const y=Math.atan2(a.x-p.x,a.z-p.z);if(Math.abs(xAng(u.g.rotation.y-y))<.3)on=1;}}
   o.u.push([u.name+(atk?'A':'D'),u.alive,p.x,p.z,u.see||0,atk,on,H?H.ai:null,H?H.shifts:null]);}return o;})())`));
  if(r.buy>0||!r.run){prev.clear();still.clear();continue;}
  if(xe('player.hp>0'))xe('pDie(null,"Vandal");true');
  for(const [nm,al,x,z,see,atk,on,ai,sh] of r.u){if(!al){prev.delete(nm);continue;}const p=prev.get(nm);
   if(p){const m=Math.hypot(x-p[0],z-p[1])/.2>.5,A=acc[atk?'atk':'def'];A[0]+=m;A[1]++;const s=m||see>0?0:(still.get(nm)||0)+.2;still.set(nm,s);stillN++;if(s>=8)longStill++;}
   prev.set(nm,[x,z]);
   if(on!=null){hold.n++;hold.on+=on;if(!hold.corners.has(nm))hold.corners.set(nm,new Set());hold.corners.get(nm).add(ai);}
   if(sh!=null)hold.seats.set(nm,Math.max(hold.seats.get(nm)||0,sh));}}
 const pc=a=>a[1]?a[0]/a[1]*100:0,mvA=pc(acc.atk),mvD=pc(acc.def),ls=stillN?longStill/stillN*100:100;
 const Q=JSON.parse(xe('JSON.stringify(QPL)'));
 // 1. moving / long-still
 console.log(`1. moving: attackers ${mvA.toFixed(1)} %, defenders ${mvD.toFixed(1)} %, still >= 8 s ${ls.toFixed(1)} % of ${stillN} bot samples; bots put back out of the geometry ${xe('(XBV.emlog||[]).length')}`);
 assert(stillN>1500,'enough action-phase samples ('+stillN+')');
 assert(ls<=15,`long-still share ${ls.toFixed(1)} % <= 15 % (55b5ef7 seeds 3 / 5: 31.7 / 50.3 %: bots froze on their spots; branch 1.2-2.4 %)`);
 assert(mvA>=25&&mvD>=25,`moving share attackers ${mvA.toFixed(1)} % / defenders ${mvD.toFixed(1)} % >= 25 % each (55b5ef7 seed 5: 18.8 / 21.0 %; branch runs 37-50 / 30-55 %)`);
 // 2. holding angles
 const holders=[...hold.corners.entries()],multi=holders.filter(([,s])=>s.size>=2).length,seated=[...hold.seats.values()].filter(v=>v>=1).length,onPct=hold.n?hold.on/hold.n*100:0;
 console.log(`2. holding: crosshair on a corner ${onPct.toFixed(1)} % of ${hold.n} hold samples, ${multi}/${holders.length} holders checked 2+ corners, ${seated} bots re-seated`);
 assert(hold.n>=200,'bots hold angles on their spots ('+hold.n+' samples)');
 assert(onPct>=70,`a holding bot's crosshair sits on one of its corners (${onPct.toFixed(1)} % >= 70 %)`);
 assert(multi>=3,`holders check more than one corner (${multi})`);assert(seated>=3,`holders re-seat instead of standing in one spot (${seated})`);
 // 3. pre-aim at first contact
 const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:NaN;},hE=Q.eng.filter(e=>e.hold).map(e=>e.off),wE=Q.eng.filter(e=>e.walk).map(e=>e.off),deg=v=>(v*180/Math.PI).toFixed(1);
 console.log(`3. first contact: median view-to-enemy ${deg(med(hE))} deg holding (n ${hE.length}), ${deg(med(wE))} deg walking (n ${wE.length}), all ${deg(med(Q.eng.map(e=>e.off)))} deg (n ${Q.eng.length})`);
 assert(Q.eng.length>=15,'fights happen ('+Q.eng.length+')');
 if(hE.length>=4)assert(med(hE)<=.35,`a holding bot is pre-aimed at first contact (median ${deg(med(hE))} deg <= 20 deg)`);
 assert(med(Q.eng.map(e=>e.off))<=.6,`first contact within the pre-aimed cone overall (median ${deg(med(Q.eng.map(e=>e.off)))} deg <= 34 deg)`);
 // 4. fire mode by range (live pulls + a direct draw)
 const band=(lo,hi)=>Q.pull.filter(p=>p.d>=lo&&p.d<hi),share=(L,k)=>L.length?L.filter(p=>p.k===k).length/L.length*100:0,near=band(0,10),far=band(20,99);
 console.log(`4. live trigger pulls ${Q.pull.length}: < 10 m n ${near.length} spray ${share(near,'spray').toFixed(0)} % tap ${share(near,'tap').toFixed(0)} %; >= 20 m n ${far.length} spray ${share(far,'spray').toFixed(0)} % tap+burst ${(share(far,'tap')+share(far,'burst')).toFixed(0)} %`);
 const D=JSON.parse(xe(`JSON.stringify((()=>{const u=bots.concat(allies).find(v=>v&&v.g),o={};for(const d of [5,25,40]){const c={tap:0,burst:0,spray:0};for(let i=0;i<400;i++){xbBurst(u,d,WEAP.Vandal);c[u.xbPat]=(c[u.xbPat]||0)+1;}o[d]=c;}return o;})())`));
 console.log('   direct draw (Vandal, 400 each): '+Object.entries(D).map(([d,c])=>d+' m tap/burst/spray '+c.tap+'/'+c.burst+'/'+c.spray).join(', '));
 assert(D[5].spray>D[40].spray*1.5,'more sprays at 5 m than at 40 m');assert(D[40].tap+D[40].burst>D[5].tap+D[5].burst,'more taps / bursts at 40 m than at 5 m');
 assert(D[5].spray>=D[5].tap+D[5].burst,'up close a pull is mostly a spray');assert(D[40].tap+D[40].burst>=D[40].spray,'far a pull is mostly a tap / burst');
 if(near.length>=8&&far.length>=8)assert(share(near,'spray')>share(far,'spray'),'live fights: sprays up close more than far');
 // 5. stopped before each shot
 const dis=Q.shot.filter(s=>!s.sl),dStop=dis.filter(s=>s.st).length,allStop=Q.shot.filter(s=>s.st).length;
 console.log(`5. shots ${Q.shot.length}: stopped ${(allStop/Math.max(1,Q.shot.length)*100).toFixed(1)} % (disciplined fights ${dStop}/${dis.length})`);
 assert(Q.shot.length>=30,'bots shoot ('+Q.shot.length+')');
 assert.equal(dStop,dis.length,'every shot of a disciplined fight is fired stopped (counter-strafed to the deadzone)');
 assert(allStop/Q.shot.length>=.75,`>= 75 % of all shots stopped (${(allStop/Q.shot.length*100).toFixed(1)} %)`);
 assert(H.errors.length<=1,'no page errors: '+JSON.stringify(H.errors.slice(1,3)));
 console.log('bots play the round (moving, holding angles, pre-aim, fire mode, stop to shoot) ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
