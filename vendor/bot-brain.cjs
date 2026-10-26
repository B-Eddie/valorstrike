// Shared client/server bot decisions (UMD: the server imports it, index.html inlines it in the BOT VARIETY block and
// reads window.BotBrain). Pure and seeded: the same seed replays the same personality, round strategy, buy, reaction
// and fire rhythm, so tests are deterministic, while different bots / rounds / matches differ the way players do.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BotBrain=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function hash(s){let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
 function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
 // weighted pick: w = {key: weight}
 function pickW(rand,w){let s=0;for(const k in w)s+=Math.max(0,w[k]);let x=rand()*s;for(const k in w){x-=Math.max(0,w[k]);if(x<0)return k;}return Object.keys(w)[0];}
 const REACT=[.18,.32]; // seconds: human reaction to an enemy appearing (average player ~0.25 s)
 // A bot's character for the whole match. role: optional 'entry' | 'anchor' | 'lurker' | 'support' bias.
 function personality(seed,role){
  const r=rng(seed),ag=role==='entry'?.65+r()*.35:role==='anchor'?.1+r()*.4:.2+r()*.6,pa=clamp(1-ag+(r()-.5)*.5,0,1),acc=.35+r()*.65;
  return {seed,role:role||null,
   aggression:ag,patience:pa,accuracy:acc,
   react:lerp(.2,.29,r())-ag*.015,reactJit:.015+r()*.03,          // mean reaction (aggressive players a hair quicker), spread per engagement
   xh:(.022+.035*(1-acc))*(.8+r()*.4),settle:.14+r()*.22,xhFloor:.12+(1-acc)*.18, // crosshair error (rad) when a fight starts, settle time constant, residual share
   crouchSpray:.08+r()*.5,tapBias:r(),stand:.18+pa*.25,strafeRhythm:.25+r()*.35,
   peek:{jiggle:.2+pa*.6,wide:.15+ag*.8,tight:.5,hold:.1+pa*.5},
   angle:r()<.5?'close':'long',head:.25+acc*.4,
   turn:7+ag*4+r()*3,                                              // rad/s: how fast the bot can swing its crosshair (a 180 takes ~0.25-0.45 s)
   lag:.05+(1-acc)*.09+r()*.03};                                   // s: tracking lag on a moving target (aims where it was), settles with P.settle

 }
 // One reaction draw per engagement, always inside REACT.
 function reaction(P,rand){const j=(rand()+rand()+rand()-1.5)*1.4;return clamp(P.react+j*P.reactJit*2,REACT[0],REACT[1]);}
 // Crosshair placement error for a new engagement: random direction, magnitude around P.xh; crosshairAt(e,P,t) settles it
 // toward P.xhFloor of the start error over P.settle seconds of tracking (a flick that corrects, not a laser).
 function crosshair(P,rand,preaimed){const a=rand()*Math.PI*2,m=P.xh*(.55+rand()*.9)*(preaimed?.45:1);return {y:Math.cos(a)*m,p:Math.sin(a)*m*.55};}
 function crosshairAt(e,P,t,out){const k=P.xhFloor+(1-P.xhFloor)*Math.exp(-Math.max(0,t)/P.settle),o=out||[0,0];o[0]=e.y*k;o[1]=e.p*k;return o;}
 // Turning and tracking: turnStep() moves a yaw toward the wanted one at most P.turn rad/s (no instant 180s); trackLag()
 // is how far behind a moving target the crosshair runs (P.lag at the start of a fight, settling to 35%).
 function wrapA(a){return Math.atan2(Math.sin(a),Math.cos(a));}
 function turnStep(P,from,want,dt){const d=wrapA(want-from),m=(P.turn||10)*dt;return Math.abs(d)<=m?{yaw:want,left:0}:{yaw:from+Math.sign(d)*m,left:Math.abs(d)-m};}
 function trackLag(P,t){return (P.lag||.08)*(.35+.65*Math.exp(-Math.max(0,t)/((P.settle||.25)*2)));}
 // Fire rhythm by range: taps far, bursts mid, sprays close (semi-auto guns always single shots). shots = trigger pulls
 // or the burst length, pause = seconds before the next one.
 function firePattern(P,rand,dist,auto){
  if(!auto)return {kind:'tap',shots:1,pause:.12+rand()*.25+(dist>25?.1:0)};
  if(dist>26)return rand()<.35+P.tapBias*.5?{kind:'tap',shots:1,pause:.3+rand()*.25}:{kind:'burst',shots:2,pause:.35+rand()*.25};
  if(dist>12)return {kind:'burst',shots:2+Math.floor(rand()*3),pause:.22+rand()*.2};
  return {kind:'spray',shots:6+Math.floor(rand()*7),pause:.15+rand()*.2};
 }
 // How to take a corner the bot cannot see past yet.
 function peek(P,rand,ctx={}){if(ctx.sniper)return rand()<.75?'jiggle':'hold';const w=Object.assign({},P.peek);if(ctx.mate)w.wide+=.6;if(ctx.carrier)return 'tight';return pickW(rand,w);}
 // ---- Round strategy ----
 const ATTACK={default:.22,execute:.2,rush:.12,split:.14,fake:.12,lurk:.12,slow:.08},DEFENSE={standard:.38,stack:.18,retake:.16,aggro:.28};
 // ctx: {eco: 'full'|'half'|'force'|'eco'|'save'|'pistol', last: [{type,site}] previous rounds (newest last)}
 function attackPlan(seed,sites,ctx={}){
  const r=rng(seed),w=Object.assign({},ATTACK),last=ctx.last||[],prev=last[last.length-1];
  if(ctx.eco==='eco'||ctx.eco==='save'){w.rush+=.25;w.execute*=.5;w.slow*=.5;}if(ctx.eco==='pistol'){w.rush+=.1;w.split+=.05;}
  if(prev&&w[prev.type]!=null)w[prev.type]*=.35; // humans rarely run the same thing twice in a row
  if(sites.length<2){w.fake=0;w.lurk=0;w.split=0;}
  const type=pickW(r,w),sw={};for(const s of sites){let k=1;for(let i=0;i<last.length;i++)if(last[i].site===s)k*=.55+.4*(1-(i+1)/last.length);sw[s]=k;}
  const site=pickW(r,sw),others=sites.filter(s=>s!==site),other=others.length?others[Math.floor(r()*others.length)]:site;
  const P={type,site,other,utilFirst:false,executeAt:0,rotateAt:0,walk:false};
  if(type==='rush'){P.executeAt=r()*2;P.utilFirst=r()<.3;}
  else if(type==='execute'){P.executeAt=10+r()*14;P.utilFirst=r()<.9;}
  else if(type==='default'){P.executeAt=26+r()*22;P.utilFirst=r()<.6;}
  else if(type==='slow'){P.executeAt=42+r()*18;P.utilFirst=r()<.7;P.walk=true;}
  else if(type==='split'){P.executeAt=16+r()*16;P.utilFirst=r()<.7;}
  else if(type==='fake'){P.executeAt=8+r()*10;P.rotateAt=P.executeAt+7+r()*7;P.utilFirst=true;}
  else if(type==='lurk'){P.executeAt=14+r()*16;P.rotateAt=P.executeAt+4+r()*8;P.utilFirst=r()<.7;}
  return P;
 }
 function defensePlan(seed,sites,ctx={}){
  const r=rng(seed),w=Object.assign({},DEFENSE),prev=(ctx.last||[]).slice(-1)[0];if(prev&&w[prev.type]!=null)w[prev.type]*=.45;
  if(ctx.eco==='eco'||ctx.eco==='save'){w.stack+=.15;w.retake+=.1;}
  const type=pickW(r,w);return {type,stack:sites[Math.floor(r()*sites.length)],aggroAt:15+r()*12,rotate:type==='retake'?.9:type==='stack'?.75:.45+r()*.25,rotateDelay:[1+r()*1.5,3+r()*3]};
 }
 // Per-bot roles for one round. team: array of stable ids in a seeded order (index 0 = the carrier for attackers when
 // carrierIndex is given). Returns one entry per member:
 //   attack  {site, stages:[{site,frac,until}], delay, lurk, fakeGroup, walk}
 //   defense {site, stages:[{site,frac,until,from}], aggro, retake, rotator, offAngle}
 // A stage is "stand at fraction frac of the way from spawn to site (1 = inside the site)" until round time `until`.
 function roles(plan,n,seed,atk,sites,carrierIndex=-1){
  const r=rng(seed),out=[],ord=[];for(let i=0;i<n;i++)ord.push(i);for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[ord[i],ord[j]]=[ord[j],ord[i]];}
  if(atk){
   const lurker=plan.type==='lurk'&&n>=3?ord.find(i=>i!==carrierIndex):-1,fakeN=plan.type==='fake'?Math.max(1,Math.min(n-1,Math.round(n*.6))):0;
   const fakers=new Set(ord.filter(i=>i!==carrierIndex).slice(0,fakeN));
   for(let i=0;i<n;i++){const d=r(),e={site:plan.site,stages:[],delay:0,lurk:false,fakeGroup:false,walk:plan.walk,entry:false};
    if(i===lurker){e.lurk=true;e.stages=[{site:plan.other,frac:.8,until:plan.rotateAt}];e.delay=1+d*2;e.walk=true;}
    else if(plan.type==='rush'){e.delay=plan.executeAt*d;e.entry=d<.4;}
    else if(plan.type==='fake'&&fakers.has(i)){e.fakeGroup=true;e.stages=[{site:plan.other,frac:.9,until:plan.rotateAt}];e.delay=d*1.5;}
    else if(plan.type==='fake'){e.stages=[{site:plan.site,frac:.5,until:plan.rotateAt-2}];e.delay=1+d*3;e.walk=true;}
    else if(plan.type==='default'||plan.type==='slow'){const s=sites[Math.floor(r()*sites.length)];e.stages=[{site:s,frac:.35+r()*.3,until:plan.executeAt+d*3}];e.delay=d*2.5;}
    else if(plan.type==='split'){const s=i%2?plan.site:plan.other;e.stages=[{site:s,frac:i%2?.6:.45,until:plan.executeAt+d*2}];e.delay=d*2;}
    else {e.stages=[{site:plan.site,frac:.55+r()*.15,until:plan.executeAt+d*2}];e.delay=d*2;} // execute / lurk main
    if(i===carrierIndex)e.delay=Math.min(e.delay,1.5);
    out[i]=e;}
  }else{
   // seats: every site keeps at least one anchor; extra bodies by setup
   const seat=[];for(let k=0;k<n;k++)seat.push(sites[k%sites.length]);
   if(plan.type==='stack'){for(let k=sites.length;k<n;k++)seat[k]=plan.stack;}
   for(let k=0;k<n;k++){const i=ord[k],d=r(),e={site:seat[k],stages:[],aggro:false,retake:false,rotator:d<plan.rotate*(k>=sites.length?1:.5),offAngle:r()<.35};
    if(plan.type==='retake'&&k>=sites.length){e.retake=true;e.rotator=true;e.stages=[{site:seat[k],frac:.4+r()*.2,until:999,from:'def'}];}
    if(plan.type==='aggro'&&(k===sites.length||k===sites.length+1&&d<.5)){e.aggro=true;e.stages=[{site:seat[k],frac:.3+r()*.15,until:plan.aggroAt,from:'atk'}];}
    out[i]=e;}
  }
  return out;
 }
 // ---- Economy ----
 // Team call for the round from every member's credits, the loss streak and the round number.
 function teamBuy(credits,lossStreak,round,rand,half=12){
  const n=credits.length||1,avg=credits.reduce((s,v)=>s+v,0)/n,low=Math.min(...credits);
  if(round===1||round===half+1)return 'pistol';
  if(avg>=3900&&low>=2900)return 'full';
  if(avg>=3900)return rand()<.6?'full':'half';
  if(avg>=2500)return rand()<.45?'half':lossStreak>=2?'force':'eco';
  if(lossStreak>=3&&rand()<.55)return 'force';
  return rand()<.15?'force':rand()<.75?'eco':'save';
 }
 // What one bot buys for the team call. Returns {weapon|null, side|null, armor:'heavy'|'light'|null}; weapon names as
 // the shop has them. def: defending (Operator / Odin / Judge more likely).
 function buyFor(call,credits,P,rand,def){
  const out={weapon:null,side:null,armor:null};let c=credits;const take=(k,n,p)=>{if(c>=p){out[k]=n;c-=p;return true;}return false;};
  if(call==='pistol'){const x=rand();if(x<.4)take('armor','light',400);else if(x<.65)take('side','Ghost',500);else if(x<.8)take('side','Sheriff',800);else if(x<.9)take('side','Frenzy',450);return out;}
  if(call==='save'){if(c>=3400&&rand()<.3)take('side','Sheriff',800);return out;}
  if(call==='eco'){const x=rand();if(x<.35)take('side','Sheriff',800);else if(x<.6)take('side','Ghost',500);else if(x<.75)take('weapon','Stinger',1100);if(rand()<.5)take('armor','light',400);return out;}
  if(call==='force'||call==='half'){const x=rand();
   if(x<.3)take('weapon','Spectre',1600);else if(x<.5)take('weapon','Bulldog',2050);else if(x<.62)take('weapon',def?'Judge':'Stinger',def?1850:1100);else if(x<.72)take('weapon','Marshal',950);else if(x<.82)take('weapon','Ares',1600);else take('weapon','Spectre',1600);
   take('armor',c>=1000+(call==='half'?400:0)?'heavy':'light',c>=1000?1000:400);return out;}
  // full
  const x=rand(),awp=(def?.16:.08)+P.patience*.08;
  if(c>=5700&&x<awp){take('weapon','Operator',4700);}else if(def&&c>=4200&&x<awp+.05)take('weapon','Odin',3200);else take('weapon',rand()<.55?'Vandal':'Phantom',2900);
  if(!take('armor','heavy',1000))take('armor','light',400);if(c>=800&&rand()<.25)take('side',rand()<.5?'Sheriff':'Ghost',rand()<.5?800:500);
  return out;
 }
 // ---- Reactions ----
 // A teammate died at dist metres: trade (push the killer), fall back, or hold. Returns 'trade' | 'fallback' | 'hold'.
 function onMateDeath(P,rand,dist,alive){if(dist>18)return 'hold';const t=P.aggression*.8+(alive>=3?.15:0)-(dist>12?.2:0);const x=rand();return x<t?'trade':x<t+P.patience*.5?'fallback':'hold';}
 // A sound heard (gunshot / running footsteps): 'turn' (face it, keep going), 'hold' (stop and hold that angle) or 'push'.
 function onSound(P,rand,kind,dist){const x=rand();if(kind==='shot'&&dist<20&&x<P.aggression*.35)return 'push';return x<P.patience*.6?'hold':'turn';}
 // ---- Utility timing ("use utility before entry") ----
 // Which utility a bot wants right now for the round plan. Pure; the caller supplies what the bot knows:
 // ctx {atk, plan (attackPlan/defensePlan), role (this bot's roles() entry), rt (round seconds since the buy phase),
 //      siteDist (m to the plan / held site), otherDist (m to plan.other, fakes), planted, spikeDist (m),
 //      threat (attacker side: an enemy seen / heard within 12 m of the planted Spike or defusing it),
 //      info (defender: attackers seen / heard at this bot's site in the last 8 s), used (utility casts this round)}
 // Returns null or {phase, want: ability types in order, aim}: phase 'entry' (smokes / flashes / recon before the
 // execute; rush: right away, only if the plan said utility first), 'fake' (the fake group's utility at the other site just
 // before it rotates), 'post' (mollies / traps on the Spike when a defender comes for it, a wall over it last), 'delay'
 // (defenders slow / burn / wall off the push on their site: Sage Slow Orb then Barrier Orb, Phoenix Hot Hands then Blaze), 'retake' (defenders flash / recon the planted site before going in). aim: 'site' | 'other' |
 // 'spike' | 'info'. Lurkers stay quiet. The ability itself (charges, values, effect) is the caller's existing logic.
 const UTIL={entry:['smoke','flash','recon','drone','stun','shock','fire'],entryFirst:['flash','drone','recon','smoke','stun','shock'],fake:['smoke','flash','recon','stun'],
  post:['fire','grenade','turret','trap','slow','shock','stun','wall'],delay:['slow','fire','wall','smoke','stun','flash','trap','shock','grenade','recon'],retake:['flash','recon','drone','stun','smoke','shock']};
 function utility(P,ctx){
  const used=ctx.used||0,pl=ctx.plan,e=ctx.role||{};
  if(ctx.atk){
   if(ctx.planted)return used<3&&ctx.threat&&ctx.spikeDist<16?{phase:'post',want:UTIL.post,aim:'spike'}:null;
   if(!pl||e.lurk||!(ctx.rt>=0))return null;
   if(e.fakeGroup)return used<1&&pl.rotateAt&&ctx.rt>=pl.rotateAt-6&&ctx.rt<pl.rotateAt&&ctx.otherDist<30?{phase:'fake',want:UTIL.fake,aim:'other'}:null;
   if(!pl.utilFirst||used>=2)return null;
   const at=pl.type==='rush'?0:Math.max(0,pl.executeAt-3);
   return ctx.rt>=at&&ctx.siteDist<30&&ctx.siteDist>6?{phase:'entry',want:e.entry||(P&&P.aggression>.7)?UTIL.entryFirst:UTIL.entry,aim:'site'}:null;
  }
  if(ctx.planted)return used<2&&ctx.spikeDist<26&&ctx.spikeDist>7?{phase:'retake',want:UTIL.retake,aim:'spike'}:null;
  return used<2&&ctx.info&&ctx.siteDist<28?{phase:'delay',want:UTIL.delay,aim:'info'}:null;
 }
 // ---- Spike play ----
 // Valorant Spike: 45 s fuse, 7 s defuse, progress kept at the 3.5 s half when a defender lets go after it.
 const SPIKE={fuse:45,defuse:7,half:3.5};
 // Where the carrier plants this round, relative to the site centre (the caller turns it into a plantable spot):
 // 'default' (the usual spot, within 2 m of the centre), 'safe' (2.5-5.5 m toward the attackers' entrance, out of the
 // retake's sight), 'open' (2.5-5.5 m toward the defenders' side, in sight of the post-plant spots). side: -1..1 sideways
 // share. Patient bots lean safe.
 function plantSpot(rand,P){const x=rand(),p=P?P.patience:.5,ws=.3*(.6+p*.8),kind=x<.42?'default':x<.42+ws?'safe':'open';return {kind,r:kind==='default'?rand()*2:2.5+rand()*3,side:rand()*2-1};}
 // Post-plant crossfire for n attackers: angles (rad) around the Spike, 0 = from the Spike toward the attackers' side, spread
 // over ~125 degrees so two of them cross any defuser, each at its own range: close (5-9 m, on site) or far (11-17 m, off the
 // site, playing time). One far player from three up, sometimes two; seeded per round. Returns [{ang, r, far}].
 function postPlant(n,rand){const out=[],span=2.2,base=(rand()-.5)*.6,ang=[];for(let i=0;i<n;i++)ang.push(n<2?base:base-span/2+span*i/(n-1));
  for(let i=n-1;i>0;i--){const j=Math.floor(rand()*(i+1));[ang[i],ang[j]]=[ang[j],ang[i]];}
  const far=new Set(),nf=n>=3?1+(rand()<.4?1:0):n===2&&rand()<.5?1:0;while(far.size<nf)far.add(Math.floor(rand()*n));
  for(let i=0;i<n;i++){const f=far.has(i);out.push({ang:ang[i]+(rand()-.5)*.25,r:f?11+rand()*6:5+rand()*4,far:f});}return out;}
 // A defender after the plant. ctx {left: s on the fuse, eta: s to reach the Spike, half: the defuse is already at half,
 //  mates: living defenders (self included), enemies: living attackers, grouped: mates within 12 m (self excluded),
 //  seen: attackers seen / heard / shooting near the Spike in the last 3 s, at: on the Spike (can defuse), tapped: faked once}
 // -> {act, style}: 'save' (no time: eta + defuse beats the fuse, or badly outnumbered with little time: keep the gun),
 //  'wait' (alone with time to spare: hold off the site until a mate joins, retake together), 'go' (retake now),
 //  on the Spike 'defuse' with style 'ninja' (nobody seen: just defuse), 'stick' (half done or no time to fight first: keep
 //  defusing under fire), 'tap' (attackers around and time to spare: tap the defuse to bait a peek, once), or 'clear'
 //  (attackers around and time to spare: fight first).
 function retake(P,rand,ctx){const need=ctx.eta+(ctx.half?SPIKE.half:SPIKE.defuse),slack=ctx.left-need;
  if(ctx.at){if(slack<-.25&&!ctx.half)return {act:'save',style:null};if(!ctx.seen)return {act:'defuse',style:'ninja'};if(ctx.half||slack<2.5)return {act:'defuse',style:'stick'};
   if(!ctx.tapped&&slack>4&&rand()<.3+(P?P.aggression:.5)*.4)return {act:'defuse',style:'tap'};return {act:'clear',style:null};}
  if(slack<-.25)return {act:'save',style:null};
  if(ctx.enemies>=ctx.mates+2&&slack<6&&(P?P.patience:.5)>.35)return {act:'save',style:null};
  if(ctx.mates>1&&ctx.grouped<1&&ctx.enemies>0&&slack>8)return {act:'wait',style:null};
  return {act:'go',style:null};}
 // An attacker after the plant. ctx {left: s on the fuse, defusing: a defender is on the Spike, dt: defuse seconds done,
 //  eta: s to reach the Spike}: 'hide' (the fuse beats any defuse now, even from half: stay out of sight, keep the gun),
 //  'stop' (a defuse that can still finish and this bot gets there first: go stop it), 'hold' (play the post-plant spot).
 function postPlay(P,ctx){const prog=ctx.defusing?ctx.dt:ctx.dt>=SPIKE.half?SPIKE.half:0,rem=SPIKE.defuse-prog;if(ctx.left<rem-.1)return 'hide';if(ctx.defusing&&ctx.eta<rem)return 'stop';return 'hold';}
 // Destroyable enemy utility a bot shoots down when no enemy is in sight (server spike.js shootUtility, offline index.html
 // xUtilShoot). c = [{kind, d: m to it, los: a clear line, blocking: (barrier) it stands across the bot's way}] -> the one
 // to shoot, or null. Threats first: an incoming Boom Bot, a Lockdown, a Turret that can fire on the bot, then the trap /
 // information devices near it (Alarmbot, Trademark, Trapwire, Spycam), a Nanoswarm it found; a Sage Barrier only when it
 // blocks the bot's route (blocking) and is close: a barrier off to the side is walked around, not shot.
 const SHOOT_UTIL={boombot:{range:15,pri:6},lockdown:{range:30,pri:5},turret:{range:30,pri:4},alarmbot:{range:12,pri:3},trademark:{range:12,pri:3},trapwire:{range:12,pri:3},spycam:{range:20,pri:2},owl:{range:20,pri:2},nanoswarm:{range:8,pri:1},barrier:{range:14,pri:0,block:true}};
 function shootUtility(c){let best=null,bs=-Infinity;for(const x of c||[]){const S=SHOOT_UTIL[x&&x.kind];if(!S||!x.los||!(x.d<=S.range)||(S.block&&!x.blocking))continue;const sc=S.pri*100-x.d;if(sc>bs){bs=sc;best=x;}}return best;}

 // Jett Tailwind for bots (server spike.js botUtility and the offline index.html xBJett share it). The first E arms it at
 // the entry (an entry bot's utility when a fight starts, wiki Tailwind v7.04: 1 s windup, 7.5 s window); the armed dash is
 // kept to get OUT of the fight, not spent at once: after a kill in the window (the entry is done), when hurt (under 50 HP
 // or 30+ lost since arming), or with under 0.6 s of the window left while still fighting (the charge is lost unused).
 // c = {armed: windup over, hp, hp0: hp when armed, kills: kills since arming, left: window seconds left} -> reason or null.
 // tailwindKeys: dash keys relative to a look at the enemy: backwards and to one side (out of its line of fire).
 const TAILWIND={hp:50,lost:30,last:.6};
 function tailwindDash(c){if(!c||!c.armed)return null;if(c.kills>0)return 'kill';if(c.hp<TAILWIND.hp||c.hp0-c.hp>=TAILWIND.lost)return 'hurt';if(c.left<TAILWIND.last)return 'expiring';return null;}
 function tailwindKeys(rand){return {f:-1,s:rand()<.5?-1:1};}
 return {hash,rng,clamp,pickW,REACT,personality,reaction,crosshair,crosshairAt,firePattern,peek,attackPlan,defensePlan,roles,teamBuy,buyFor,onMateDeath,onSound,ATTACK,DEFENSE,utility,UTIL,turnStep,trackLag,wrapA,SPIKE,plantSpot,postPlant,retake,postPlay,SHOOT_UTIL,shootUtility,TAILWIND,tailwindDash,tailwindKeys};
});
