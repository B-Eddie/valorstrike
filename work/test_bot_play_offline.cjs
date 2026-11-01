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
//     far, in the live fights (automatic guns only: a semi-auto pull is a tap by necessity) and in a direct draw at fixed ranges.
//  5. stopped before each shot: every shot of a disciplined fight leaves at or under the accuracy deadzone (botStopped:
//     the counter-strafe has stopped it); only the fights a bot plays sloppy (xbSl, BotBrain.discipline) may fire moving.
// Human limits stay: reactions and turn rates are the shared model's (not touched here); no shot through a wall.
// Seeds: one seed's round flow decides how many rounds / fights / rifle rounds fit in the window, so a single seed is
// fragile both ways (fd0793f: seed 3 ok, seeds 5 / 7 defenders moving 23.0 / 24.9 %; b01c0ab: seed 7 ok, seed 3 21 shots
// in 16 fights, seed 5 defenders 21.6 %) while each seed replays identically (repeat runs print the same numbers). One
// 180 s window holds 8 to 50 fights and 21 to 75 shots depending on the seed. So the run plays several seeds (SEEDS,
// default 3,5,7,11; each its own child process, PLAY_JOBS at a time, default one per CPU, so about one seed's wall time on
// a 4-CPU runner) and asserts the behaviour on the pooled samples, scaled per seed, with per-seed floors only for what no
// seed may do (a side frozen, bots not shooting, a page error, stale holds, a disciplined shot fired moving).
// Pooled over 3,5,7,11: fd0793f moving A 40.6 / D 36.3 %, still >= 8 s 2.9 %, 119 fights, 217 shots;
// b01c0ab moving A 42.0 / D 35.7 %, still >= 8 s 5.0 %, 65 fights, 139 shots (lowest single seed: 21.6 % moving, 8 fights, 21 shots).
//   node work/test_bot_play_offline.cjs        (SECS=180 per seed, SEEDS=3,5,7,11 by default; SEED=n plays that seed alone)
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');const {spawn}=require('child_process'),os=require('os');
const SECS=+(process.env.SECS||180),SEEDS=(process.env.PLAY_WORKER||process.env.SEED||process.env.SEEDS||'3,5,7,11').split(',').map(Number);
async function play(seed){
 const H=boot({real3:true,seed,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true');
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 if(!xe('!!nmActive()'))throw Error('native Ascent not loaded (seed '+seed+')');
 // instruments: new fights (xbEngage ctx.off = |view - enemy| at the start), trigger pulls (xbBurst range + kind), shots (SFX.at from a bot)
 xe(`(()=>{const Q=window.QPL={eng:[],pull:[],shot:[]};
  const e0=xbEngage;xbEngage=function(u,pre,ctx){try{if(ctx&&u&&u.g&&mode==='five'&&!(FV.buy>0)){const H=u.xHp;Q.eng.push({off:ctx.off,hold:!!(H&&!H.seat&&H.ang&&H.ang.length&&!(u.spd>.5)),walk:(u.spd||0)>1.5,d:ctx.d});}}catch(e){}return e0.apply(this,arguments);};
  if(typeof xbBurst==='function'){const b0=xbBurst;xbBurst=function(u,d,W){const n=b0.apply(this,arguments);try{if(!(FV.buy>0))Q.pull.push({d,k:u.xbPat||null,n,semi:!!(W&&W.semi)});}catch(e){}return n;};}
  const s0=SFX.at;SFX.at=function(p,w){try{if(p&&!(FV.buy>0)&&w!=='Spike'&&w!=='Blade Storm'){let u=null;for(const v of bots.concat(allies))if(v&&v.g&&v.g.position===p){u=v;break;}if(u)Q.shot.push({st:botStopped(u),sl:!!u.xbSl,sf:+(u.sf||0).toFixed(2)});}}catch(e){}return s0.apply(this,arguments);};return true;})()`);
 const prev=new Map(),still=new Map(),acc={atk:[0,0],def:[0,0]},hold={n:0,on:0,corners:new Map(),seats:new Map()};let longStill=0,stillN=0,staleHold=0;
 for(let k=0;k<SECS*5;k++){await adv(200);
  const r=JSON.parse(xe(`JSON.stringify((()=>{const o={buy:FV.buy,run:running,u:[]};for(const [L,atk] of [[bots,!FV.atk],[allies,FV.atk]])for(const u of L){if(!u||!u.g)continue;const p=u.g.position,H=u.xHp;let on=null;
   if(u.alive&&H&&!H.seat&&H.ang&&H.ang.length&&!(u.see>0)&&!(u.hearT>0)&&!(u.blind>0)){on=0;for(const a of H.ang){const y=Math.atan2(a.x-p.x,a.z-p.z);if(Math.abs(xAng(u.g.rotation.y-y))<.3)on=1;}}
   if(u.alive&&H&&!H.seat&&!(u.see>0)&&!(u.trT>0)&&!(u.hearT>0)&&!(u.blind>0)&&Math.hypot(H.bx-p.x,H.bz-p.z)>5)o.st=(o.st||0)+1;o.u.push([u.name+(atk?'A':'D'),u.alive,p.x,p.z,u.see||0,atk,on,H?H.ai:null,H?H.shifts:null]);}return o;})())`));
  if(r.buy>0||!r.run){prev.clear();still.clear();continue;}
  staleHold+=r.st||0;
  if(xe('player.hp>0'))xe('pDie(null,"Vandal");true');
  for(const [nm,al,x,z,see,atk,on,ai,sh] of r.u){if(!al){prev.delete(nm);continue;}const p=prev.get(nm);
   if(p){const m=Math.hypot(x-p[0],z-p[1])/.2>.5,A=acc[atk?'atk':'def'];A[0]+=m;A[1]++;const s=m||see>0?0:(still.get(nm)||0)+.2;still.set(nm,s);stillN++;if(s>=8)longStill++;}
   prev.set(nm,[x,z]);
   if(on!=null){hold.n++;hold.on+=on;if(!hold.corners.has(nm))hold.corners.set(nm,new Set());hold.corners.get(nm).add(ai);}
   if(sh!=null)hold.seats.set(nm,Math.max(hold.seats.get(nm)||0,sh));}}
 const Q=JSON.parse(xe('JSON.stringify(QPL)'));/* before the direct draw: its xbBurst calls would land in QPL.pull */
 const D=JSON.parse(xe(`JSON.stringify((()=>{const u=bots.concat(allies).find(v=>v&&v.g),o={};for(const d of [5,25,40]){const c={tap:0,burst:0,spray:0};for(let i=0;i<400;i++){xbBurst(u,d,WEAP.Vandal);c[u.xbPat]=(c[u.xbPat]||0)+1;}o[d]=c;}return o;})())`));
 return {seed,acc,longStill,stillN,staleHold,hold:{n:hold.n,on:hold.on,corners:[...hold.corners.entries()].map(([k,v])=>[k,v.size]),seats:[...hold.seats.entries()]},
  Q,D,em:+xe('(XBV.emlog||[]).length'),errors:H.errors.length,err:H.errors.slice(1,3)};
}
if(process.env.PLAY_WORKER){play(+process.env.PLAY_WORKER).then(r=>{process.stdout.write('PLAYJSON '+JSON.stringify(r)+'\n');process.exit(0);},e=>{console.error(e);process.exit(1);});}
else (async()=>{
 const t0=Date.now(),jobs=Math.max(1,Math.min(SEEDS.length,+(process.env.PLAY_JOBS||os.cpus().length))),R=[];let next=0;
 const one=seed=>new Promise((res,rej)=>{const c=spawn(process.execPath,[__filename],{env:{...process.env,PLAY_WORKER:String(seed)},stdio:['ignore','pipe','inherit']});let out='';c.stdout.on('data',d=>out+=d);
  c.on('close',code=>{const m=out.match(/^PLAYJSON (.*)$/m);if(code||!m)return rej(Error('seed '+seed+' worker exit '+code+'\n'+out.slice(-2000)));const r=JSON.parse(m[1]);console.log(`seed ${seed} played (${((Date.now()-t0)/1000).toFixed(0)} s)`);res(r);});});
 await Promise.all(Array.from({length:jobs},async()=>{while(next<SEEDS.length){const s=SEEDS[next++];R.push(await one(s));}}));
 R.sort((a,b)=>SEEDS.indexOf(a.seed)-SEEDS.indexOf(b.seed));const N=R.length,sum=f=>R.reduce((t,r)=>t+f(r),0);
 const pc=(n,d)=>d?n/d*100:0,f1=v=>v.toFixed(1),med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:NaN;},deg=v=>(v*180/Math.PI).toFixed(1);
 const mvS=(r,k)=>pc(r.acc[k][0],r.acc[k][1]),lsS=r=>r.stillN?r.longStill/r.stillN*100:100;
 for(const r of R)console.log(`   seed ${r.seed}: moving A ${f1(mvS(r,'atk'))} % D ${f1(mvS(r,'def'))} %, still>=8s ${f1(lsS(r))} % of ${r.stillN}, hold ${r.hold.n} (${f1(pc(r.hold.on,r.hold.n))} % on a corner), fights ${r.Q.eng.length}, pulls ${r.Q.pull.length}, shots ${r.Q.shot.length}`);
 // 1. moving / long-still (pooled: one seed's round flow, e.g. defenders sitting out a long post-plant, moves a single seed's share a lot)
 const mvA=pc(sum(r=>r.acc.atk[0]),sum(r=>r.acc.atk[1])),mvD=pc(sum(r=>r.acc.def[0]),sum(r=>r.acc.def[1])),stillN=sum(r=>r.stillN),ls=pc(sum(r=>r.longStill),stillN),mvMin=Math.min(...R.flatMap(r=>[mvS(r,'atk'),mvS(r,'def')]));
 console.log(`1. moving (${N} seeds pooled): attackers ${f1(mvA)} %, defenders ${f1(mvD)} % (lowest side in one seed ${f1(mvMin)} %), still >= 8 s ${f1(ls)} % of ${stillN} bot samples; bots put back out of the geometry ${sum(r=>r.em)}`);
 for(const r of R)assert(r.stillN>1500,`enough action-phase samples (seed ${r.seed}: ${r.stillN})`);
 assert(ls<=15,`long-still share ${f1(ls)} % <= 15 % pooled (55b5ef7 seeds 3 / 5: 31.7 / 50.3 %: bots froze on their spots; fd0793f / b01c0ab seeds 3,5,7,11 <= 9.3 % each)`);
 assert(mvA>=25&&mvD>=25,`moving share pooled attackers ${f1(mvA)} % / defenders ${f1(mvD)} % >= 25 % each (55b5ef7 seed 5: 18.8 / 21.0 %)`);
 assert(mvMin>=12,`no side frozen in any seed: lowest moving share ${f1(mvMin)} % >= 12 % (fd0793f / b01c0ab seeds 3,5,7,11: >= 21.6 %)`);
 // 2. holding angles (holders counted per seed and bot)
 const holdN=sum(r=>r.hold.n),onPct=pc(sum(r=>r.hold.on),holdN),holders=sum(r=>r.hold.corners.length),multi=sum(r=>r.hold.corners.filter(([,n])=>n>=2).length),seated=sum(r=>r.hold.seats.filter(([,v])=>v>=1).length),stale=sum(r=>r.staleHold);
 console.log(`2. holding: crosshair on a corner ${f1(onPct)} % of ${holdN} hold samples, ${multi}/${holders} holders (bot x seed) checked 2+ corners, ${seated} re-seated`);
 assert(stale===0,`a bot that left its spot (> 5 m from the hold's base: dropped at 4.5 m, seats sit <= 3.5 m; a trade push / sound keeps it until it ends) drops the hold instead of carrying its corners along (${R.map(r=>'seed '+r.seed+': '+r.staleHold).join(', ')} samples)`);
 assert(holdN>=200*N,`bots hold angles on their spots (${holdN} samples >= ${200*N})`);
 assert(onPct>=70,`a holding bot's crosshair sits on one of its corners (${f1(onPct)} % >= 70 %)`);
 assert(multi>=3*N,`holders check more than one corner (${multi} >= ${3*N})`);assert(seated>=3*N,`holders re-seat instead of standing in one spot (${seated} >= ${3*N})`);
 // 3. pre-aim at first contact
 const E=R.flatMap(r=>r.Q.eng),hE=E.filter(e=>e.hold).map(e=>e.off),wE=E.filter(e=>e.walk).map(e=>e.off),all=E.map(e=>e.off);
 console.log(`3. first contact: median view-to-enemy ${deg(med(hE))} deg holding (n ${hE.length}), ${deg(med(wE))} deg walking (n ${wE.length}), all ${deg(med(all))} deg (n ${all.length})`);
 assert(E.length>=10*N,`fights happen (${E.length} >= ${10*N}; per seed ${R.map(r=>r.Q.eng.length).join(' / ')})`);
 if(hE.length>=4)assert(med(hE)<=.35,`a holding bot is pre-aimed at first contact (median ${deg(med(hE))} deg <= 20 deg)`);
 assert(med(all)<=.6,`first contact within the pre-aimed cone overall (median ${deg(med(all))} deg <= 34 deg)`);
 // 4. fire mode by range (live pulls + a direct draw)
 const P=R.flatMap(r=>r.Q.pull),band=(lo,hi)=>P.filter(p=>p.d>=lo&&p.d<hi),share=(L,k)=>L.length?L.filter(p=>p.k===k).length/L.length*100:0,near=band(0,10).filter(p=>!p.semi),far=band(20,99).filter(p=>!p.semi),semiN=P.filter(p=>p.semi).length;/* a semi-auto gun (Classic, Sheriff, Guardian, Marshal...) never sprays: its pulls say nothing about fire mode by range */
 console.log(`4. live trigger pulls ${P.length} (${semiN} semi-auto, left out): automatic < 10 m n ${near.length} spray ${share(near,'spray').toFixed(0)} % tap ${share(near,'tap').toFixed(0)} %; >= 20 m n ${far.length} spray ${share(far,'spray').toFixed(0)} % tap+burst ${(share(far,'tap')+share(far,'burst')).toFixed(0)} %`);
 const D=R[0].D;console.log(`   direct draw (Vandal, 400 each, seed ${R[0].seed}): `+Object.entries(D).map(([d,c])=>d+' m tap/burst/spray '+c.tap+'/'+c.burst+'/'+c.spray).join(', '));
 assert(D[5].spray>D[40].spray*1.5,'more sprays at 5 m than at 40 m');assert(D[40].tap+D[40].burst>D[5].tap+D[5].burst,'more taps / bursts at 40 m than at 5 m');
 assert(D[5].spray>=D[5].tap+D[5].burst,'up close a pull is mostly a spray');assert(D[40].tap+D[40].burst>=D[40].spray,'far a pull is mostly a tap / burst');
 if(near.length>=8&&far.length>=8)assert(share(near,'spray')>share(far,'spray'),'live fights: sprays up close more than far');
 // 5. stopped before each shot
 const S=R.flatMap(r=>r.Q.shot),dis=S.filter(s=>!s.sl),dStop=dis.filter(s=>s.st).length,allStop=S.filter(s=>s.st).length;
 console.log(`5. shots ${S.length} (per seed ${R.map(r=>r.Q.shot.length).join(' / ')}): stopped ${(allStop/Math.max(1,S.length)*100).toFixed(1)} % (disciplined fights ${dStop}/${dis.length})`);
 assert(S.length>=20*N,`bots shoot (${S.length} >= ${20*N} pooled)`);
 for(const r of R)assert(r.Q.shot.length>=8,`bots shoot in every seed (seed ${r.seed}: ${r.Q.shot.length} >= 8)`);
 assert.equal(dStop,dis.length,'every shot of a disciplined fight is fired stopped (counter-strafed to the deadzone)');
 assert(allStop/S.length>=.75,`>= 75 % of all shots stopped (${(allStop/S.length*100).toFixed(1)} %)`);
 for(const r of R)assert(r.errors<=1,`no page errors (seed ${r.seed}): `+JSON.stringify(r.err));
 console.log(`bots play the round (moving, holding angles, pre-aim, fire mode, stop to shoot) ok: ${N} seeds in ${((Date.now()-t0)/1000).toFixed(0)} s`);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
