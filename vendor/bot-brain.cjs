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
 const REACT=[.2,.35]; // seconds: a mid-ranked player's reaction to an enemy appearing on a pre-aimed angle (~0.25 s); reaction() adds the off-angle / flash costs
 // Mouse: VALORANT turns 0.07 deg per mouse count at sensitivity 1, so a mid-ranked 0.35 sens at 800 DPI is 46.7 cm per 360.
 // A bot's sensitivity (0.31-0.41 at 800 DPI, separate stream) and its flick hand speed (m/s of mouse travel, 0.6-0.88: a
 // 23 cm half-turn swipe in 0.25-0.42 s) give its top crosshair speed in rad/s: no instant 180s, no 360 flick kills.
 const SENS={sens:.35,dpi:800,yaw:.07};
 function cm360(sens,dpi){return 360/(SENS.yaw*(sens||SENS.sens)*(dpi||SENS.dpi))*2.54;}
 function sensOf(seed){const r=rng(((seed>>>0)^0x5e45a1d3)>>>0);return Math.round((.31+r()*.1)*1000)/1000;}
 function turnRate(sens,hand,dpi){return hand/(cm360(sens,dpi)/100)*Math.PI*2;}
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
   turn:turnRate(sensOf(seed),.6+ag*.08+r()*.2),                // rad/s: how fast the bot can swing its crosshair, from its mouse sensitivity and hand speed (a 180 takes ~0.25-0.45 s)
   lag:.05+(1-acc)*.09+r()*.03,                                    // s: tracking lag on a moving target (aims where it was), settles with P.settle
   sens:sensOf(seed),dpi:SENS.dpi};

 }
 // One reaction draw per engagement: inside REACT for a pre-aimed angle, then human costs on top (ctx, optional):
 // ctx.pre false (crosshair not on the angle) +30-70 ms, ctx.off (rad between the view and the enemy) > 0.6 +50-110 ms,
 // > 1.4 (from the side) +80-160 ms more, > 2.4 (behind) +100-200 ms more (the turn itself is aimPlan / turnStep), ctx.flashed
 // (blind until just now) +120-220 ms; ctx.k scales the whole draw (difficulty).
 function reaction(P,rand,ctx){const j=(rand()+rand()+rand()-1.5)*1.4;let t=clamp(P.react+j*P.reactJit*2,REACT[0],REACT[1]);
  if(ctx){const off=Math.abs(ctx.off||0);if(!ctx.pre)t+=.03+rand()*.04;if(off>.6)t+=.05+rand()*.06;if(off>1.4)t+=.08+rand()*.08;if(off>2.4)t+=.1+rand()*.1;if(ctx.flashed)t+=.12+rand()*.1;t*=ctx.k||1;}
  return t;}
 // Crosshair placement error for a new engagement: random direction, magnitude around P.xh; crosshairAt(e,P,t) settles it
 // toward P.xhFloor of the start error over P.settle seconds of tracking (a flick that corrects, not a laser).
 function crosshair(P,rand,preaimed){const a=rand()*Math.PI*2,m=P.xh*(.55+rand()*.9)*(preaimed?.45:1);return {y:Math.cos(a)*m,p:Math.sin(a)*m*.55};}
 function crosshairAt(e,P,t,out){const k=P.xhFloor+(1-P.xhFloor)*Math.exp(-Math.max(0,t)/P.settle),o=out||[0,0];o[0]=e.y*k;o[1]=e.p*k;return o;}
 // Turning and tracking: turnStep() moves a yaw toward the wanted one at most P.turn rad/s (no instant 180s); trackLag()
 // is how far behind a moving target the crosshair runs (P.lag at the start of a fight, settling to 35%).
 function wrapA(a){return Math.atan2(Math.sin(a),Math.cos(a));}
 function turnStep(P,from,want,dt){const d=wrapA(want-from),m=(P.turn||10)*dt;return Math.abs(d)<=m?{yaw:want,left:0}:{yaw:from+Math.sign(d)*m,left:Math.abs(d)-m};}
 function trackLag(P,t){return (P.lag||.08)*(.35+.65*Math.exp(-Math.max(0,t)/((P.settle||.25)*2)));}
 // ---- Human aim (default: a mid-ranked player, think Gold-Plat; LEVEL easy / hard scale it) ----
 // A fight's crosshair path is a planned human flick, not a laser: aimPlan() takes where the crosshair is when the enemy
 // appears (e0 = crosshair minus the aim point, radians yaw / pitch) and aimAt(A, t) returns the error at t s into the fight:
 //  - until A.start (the reaction) the crosshair stays where it was;
 //  - flick: minimum-jerk (ease-in / ease-out) over A.T1 = Fitts' law (0.06 s + fitts x log2(1 + error / target half-width),
 //    never faster than the bot's turn rate), past the target by A.over (overshoot) on a big flick;
 //  - correction: a second, smaller min-jerk move over A.T2 back to a resting error A.res (placement: a little off the angle);
 //  - micro-adjust: the resting error shrinks toward 45 % with a slow tremor on top, never exactly zero.
 // aimHeight() is where the crosshair sits on the body (head / neck / chest: most fights start at chest-neck height, more
 // head for accurate bots), readyToFire() lets the first shot go while still slightly off (eager players miss it at range),
 // recoilPull() is the share of the spray climb the bot drags down (never all of it), and discipline is the chance a fight's
 // shots are counter-strafed (stopped) rather than fired on the move.
 const LEVEL={easy:{rt:1.3,err:1.7,head:.55,pull:.65,disc:.75},normal:{rt:1,err:1,head:1,pull:1,disc:1},hard:{rt:.82,err:.6,head:1.4,pull:1.2,disc:1.15}};
 function level(name){return LEVEL[name]||LEVEL.normal;}
 // Per-bot aim traits (pure, from P.seed on a separate stream: personality() draws are unchanged).
 function aimTraits(P){const r=rng(((P.seed>>>0)^0x51ed270b)>>>0),acc=P.accuracy==null?.6:P.accuracy;
  return {headAim:.06+acc*.12+r()*.05,neckAim:.3+r()*.15,place:.01+(1-acc)*.012+r()*.005,over:.04+r()*.08,fitts:.045+(1-acc)*.035+r()*.015,
   trem:.003+(1-acc)*.006,pull:.25+acc*.25+r()*.1,eager:.6+r()*.8+(P.aggression||0)*.4,discipline:clamp(.45+(P.patience==null?.5:P.patience)*.35+r()*.15,0,.97),idle:Math.atan2(AIM_H.head-1.6,15)-(.004+(1-acc)*.016+r()*.01)};}
 const AIM_H={head:1.8,neck:1.45,chest:1.2}; // metres above the feet, standing (server hitboxes: head sphere centre 1.815, body capsule top ~1.6)
 function aimHeight(P,rand,lvl,pre){const A=aimTraits(P),L=level(lvl),x=rand(),h=Math.min(.85,A.headAim*L.head*(pre?1.8:1));return x<h?'head':x<h+(1-h)*A.neckAim?'neck':'chest';}
 function gauss(rand){return (rand()+rand()+rand()+rand()-2)*1.732;}
 function mj(x){x=x<0?0:x>1?1:x;return x*x*x*(10-15*x+6*x*x);}
 // Target half-width (rad) at dist m: a 0.3 m wide body.
 function halfWidth(dist){return Math.max(.004,Math.atan(.3/Math.max(.5,dist||1)));}
 function aimPlan(P,rand,e0y,e0p,dist,ctx){ctx=ctx||{};const A=aimTraits(P),L=level(ctx.level),mag=Math.hypot(e0y||0,e0p||0),w=halfWidth(dist);
  const T1=Math.max(mag/Math.max(.5,(P.turn||10)*.9),(.06+A.fitts*Math.log2(1+mag/w))*(.85+rand()*.3)*L.rt),big=mag>w*2.5;
  const sd=A.place*L.err*(ctx.moving?1.5:1)*(.65+.35*Math.min(1,w/.03)),/* players aim finer (and slower, Fitts) at a small far target */res=[gauss(rand)*sd,gauss(rand)*sd*.6-sd*.25],over=big?A.over*(.6+rand()*.8):0;
  return planFire({start:Math.max(0,ctx.start||0),e0:[e0y||0,e0p||0],T1,T2:big?.07+rand()*.09:0,o:big?[-(e0y||0)*over+res[0]*1.6,-(e0p||0)*over+res[1]*1.6]:[res[0],res[1]],res,
   trem:A.trem*L.err,ph:rand()*6.283,settle:.3+rand()*.35,eager:A.eager*Math.sqrt(L.err),w,fireAt:0},P,rand);}
 // When the player believes the crosshair is on: the end of the flick (eager players, before the correction) or the end of
 // the correction (careful ones), plus a beat; A.fireAt in s after the reaction. The residual error is not perceived, so
 // the shot goes regardless of it (that is what misses at range).
 function planFire(A,P,rand){const e=aimTraits(P).eager;A.fireAt=A.T1*(.8+rand()*.2)+(e>1.1&&rand()<.6?0:A.T2)+rand()*.06;return A;}
 function aimAt(A,t,out){const o=out||[0,0];if(!A){o[0]=o[1]=0;return o;}const s=t-A.start;let y,p;
  if(s<=0){y=A.e0[0];p=A.e0[1];}
  else if(s<A.T1){const k=mj(s/A.T1);y=A.e0[0]+(A.o[0]-A.e0[0])*k;p=A.e0[1]+(A.o[1]-A.e0[1])*k;}
  else if(s<A.T1+A.T2){const k=mj((s-A.T1)/A.T2);y=A.o[0]+(A.res[0]-A.o[0])*k;p=A.o[1]+(A.res[1]-A.o[1])*k;}
  else{const q=s-A.T1-A.T2,k=.7+.3*Math.exp(-q/A.settle);y=A.res[0]*k+A.trem*Math.sin(q*6.1+A.ph);p=A.res[1]*k+A.trem*.7*Math.sin(q*4.3+A.ph*1.7);}
  o[0]=y;o[1]=p;return o;}
 // May the trigger go now? err: the current crosshair error (rad); the first shot goes once within eager x half-width.
 function readyToFire(A,err,dist,t){if(!A)return false;if(t!=null&&A.fireAt&&t-A.start>=A.fireAt)return true;return Math.abs(err)<A.eager*.5*halfWidth(dist);}
 // Resting crosshair pitch while moving / holding (rad): head height at ~15 m with this bot's own placement error, mostly a
 // little low (a mid-ranked player's crosshair drifts toward the neck), so fights start near the head, not on it. A fight
 // that starts on a pre-aimed angle more often stays at head height (aimHeight pre).
 function idlePitch(P){return aimTraits(P).idle;}
 function recoilPull(P,lvl){return clamp(aimTraits(P).pull*level(lvl).pull,.2,.9);}
 function discipline(P,lvl){return clamp(aimTraits(P).discipline*level(lvl).disc,0,.97);}
 // Which hit volume a shot passing lat m beside the target's axis at h m above its feet lands in (server hitboxes, standing;
 // crouch ch lowers the head and the body top by ch): 'head' | 'body' | 'legs' | null.
 function hitPart(lat,h,ch){ch=ch||0;const hc=1.815-ch,top=1.605-ch;if(lat*lat+(h-hc)*(h-hc)<.195*.195)return 'head';
  if(Math.abs(lat)<.288&&h>.06&&h<top){const a=.348,b=top-.288,y=h<a?a:h>b?b:h;if(lat*lat+(h-y)*(h-y)<.288*.288||(h>=a&&h<=b))return h<.9*(hc/1.815)?'legs':'body';}return null;}
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
 // Pace (bots-human-1): mid-ranked teams mostly default and take their time; a flat-out rush is rare.
 const ATTACK={default:.3,execute:.18,rush:.06,split:.13,fake:.1,lurk:.11,slow:.12},DEFENSE={standard:.38,stack:.18,retake:.16,aggro:.28};
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
  const r=rng(seed),pace=rng(((seed>>>0)^0x2f6e2b1)>>>0),out=[],ord=[];for(let i=0;i<n;i++)ord.push(i);for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[ord[i],ord[j]]=[ord[j],ord[i]];}
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
    // Not everyone leaves spawn on the buzzer: outside a rush some players linger (2-7 s: last buys, comms, utility first),
    // the rest leave a beat apart, and some walk the default to stay quiet (separate stream: the role draws are unchanged).
    if(plan.type!=='rush'&&!e.lurk){e.delay+=pace()<.25?2+pace()*5:.2+pace();if(plan.type==='default'||plan.type==='execute'||plan.type==='split')e.walk=e.walk||pace()<.3;}
    if(i===carrierIndex)e.delay=Math.min(e.delay,plan.type==='rush'?1.5:3);
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
  areas(plan,out,n,seed,atk,sites,carrierIndex);
  return out;
 }
 // ---- Team areas (bots-spread-1, user: "the opponent bots all just bunch up ... I just get jumped by the entire team") ----
 // A real team splits the map: defenders set up 2-1-2 / 1-3-1 / heavy-side / stack formations with an anchor on every
 // site, a mid player, a rotator, off-angle supports and sometimes an early info push; attackers default spread (entry +
 // trade partner on the plan's site, a map-control player through mid, a flank pair on the other side) and only group
 // for an execute / split / lurk hit, and even then in a line a few metres apart (stage `back`: metres short of the stage
 // point, so entry and trade partner never share a spot). Runs after the delays / walk draws above on its own stream, so
 // pacing (167ec76) is unchanged. Stage site 'mid' is the map's middle (the caller resolves it: midPoint below).
 // Every entry gains slot ('anchor' | 'support' | 'off' | 'mid' | 'rot' | 'push' | 'retake' | 'entry' | 'trade' | 'stack' |
 // 'control' | 'flank' | 'lurk' | 'fake' | 'rush') and the array gains .formation. rotator = may rotate on information
 // (anchors never do); who actually rotates is decided at the time (rotation(): only the nearest RESPOND.rotate).
 const GAP=3.5; // m between an entry and its trade partner (and down an execute line)
 const DFORM={2:{'2-1-2':[['anchor',0],['anchor',1],['mid'],['support',0],['support',1]],'1-3-1':[['anchor',0],['anchor',1],['mid'],['rot'],['push']],
   'heavy':[['anchor',0],['anchor',1],['mid'],['support','h'],['off','h']],'stack':[['anchor','x'],['anchor','y'],['support','x'],['off','x'],['support','x']],
   'retake':[['anchor',0],['anchor',1],['retake',0],['retake',1],['rot']],'aggro':[['anchor',0],['anchor',1],['mid'],['push'],['support','h']]},
  3:{'1-1-1-2':[['anchor',0],['anchor',1],['anchor',2],['rot'],['support','h']],'2-1-2':[['anchor',0],['anchor',1],['anchor',2],['support',0],['support',2]],
   '1-3-1':[['anchor',0],['anchor',1],['anchor',2],['support',1],['rot']],'stack':[['anchor','x'],['anchor','y'],['anchor','z'],['support','x'],['off','x']],
   'retake':[['anchor',0],['anchor',1],['anchor',2],['retake','h'],['rot']],'aggro':[['anchor',0],['anchor',1],['anchor',2],['push'],['support','h']]}};
 function areas(plan,out,n,seed,atk,sites,carrierIndex){
  const r=rng(((seed>>>0)^0x5bd1e995)>>>0),ord=[];for(let i=0;i<n;i++)ord.push(i);for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[ord[i],ord[j]]=[ord[j],ord[i]];}
  if(!n||!sites.length)return out;
  if(!atk){
   const F=DFORM[sites.length>=3?3:2]||DFORM[2];let name=plan.type;
   if(name==='standard'){const x=r();name=sites.length>=3?(x<.35?'1-1-1-2':x<.75?'2-1-2':'1-3-1'):(x<.45?'2-1-2':x<.75?'1-3-1':'heavy');}
   const form=F[name]||F[Object.keys(F)[0]];out.formation=name;
   const xi=Math.max(0,sites.indexOf(plan.stack)),others=sites.map((_,k)=>k).filter(k=>k!==xi),hi=Math.floor(r()*sites.length);
   const si=v=>v==='x'?xi:v==='y'?others[0]:v==='z'?(others[1]??others[0]):v==='h'?hi:typeof v==='number'?Math.min(v,sites.length-1):hi;
   for(let k=0;k<n;k++){const i=ord[k],e=out[i],f=form[k<form.length?k:form.length-2+(k-form.length)%2]||['support','h'],kind=f[0],S=sites[si(f[1])];
    e.slot=kind;e.stages=[];e.aggro=false;e.retake=false;e.site=S;
    if(kind==='anchor'){e.rotator=false;e.offAngle=false;}
    else if(kind==='support'){e.rotator=true;e.offAngle=true;}
    else if(kind==='off'){e.rotator=false;e.offAngle=true;}
    else if(kind==='mid'){e.rotator=true;e.offAngle=false;e.site=sites[Math.floor(r()*sites.length)];e.stages=[{site:'mid',frac:.85+r()*.15,until:999}];}
    else if(kind==='rot'){e.rotator=true;e.offAngle=false;e.site=sites[Math.floor(r()*sites.length)];e.stages=[{site:'mid',frac:.45+r()*.15,until:999}];}
    else if(kind==='push'){e.rotator=true;e.aggro=true;e.offAngle=false;e.site=sites[Math.floor(r()*sites.length)];e.stages=[{site:sites.length>=3?S:'mid',frac:.25+r()*.15,until:plan.aggroAt||15+r()*10,from:'atk'}];}
    else if(kind==='retake'){e.rotator=true;e.retake=true;e.offAngle=false;e.stages=[{site:S,frac:.4+r()*.2,until:999,from:'def'}];}}
   return out;
  }
  const X=plan.site,Y=plan.other&&plan.other!==X?plan.other:sites.find(s=>s!==X)||X,Z=sites.find(s=>s!==X&&s!==Y)||Y,t=plan.type,ex=plan.executeAt||0;
  if(t==='rush'){for(const e of out)e.slot='rush';out.formation='rush';return out;}
  // slot lists in priority order (a short team takes the first n)
  const L={default:[['entry',X],['trade',X],['control','mid'],['flank',Y],['flank2',sites.length>=3?Z:Y]],slow:null,
   execute:[['entry',X],['trade',X],['stack',X,2],['control','mid'],['stack',X,3]],
   split:[['entry',X],['trade',X],['control','mid'],['control2','mid'],['stack',X,2]],
   lurk:[['entry',X],['trade',X],['control','mid'],['stack',X,2]],
   fake:[['fake',Y,0],['fake',Y,1],['fake',Y,2],['entry',X],['trade',X]]};L.slow=L.default;
  const list=(L[t]||L.default).slice();out.formation=t==='default'||t==='slow'?(sites.length>=3?'2-1-1-1':'2-1-2'):t;
  const lurker=out.findIndex(e=>e.lurk);
  // the carrier plays the trade slot (behind the entry), the plan's lurker keeps its own stage
  const seq=ord.filter(i=>i!==lurker),slotOf=new Map();let li=0;
  if(carrierIndex>=0&&carrierIndex!==lurker){const k=list.findIndex(x=>x[0]==='trade');if(k>=0){slotOf.set(carrierIndex,list[k]);list.splice(k,1);}}
  for(const i of seq){if(slotOf.has(i))continue;slotOf.set(i,list[li++]||['stack',X,2+li]);}
  if(lurker>=0)out[lurker].slot='lurk';
  for(const [i,f] of slotOf){const e=out[i],kind=f[0],S=f[1],until=e.stages[0]?e.stages[0].until:ex+r()*2;e.slot=kind.replace(/2$/,'');if(kind==='entry')e.entry=true;
   if(kind==='fake'){e.fakeGroup=true;e.site=X;e.stages=[{site:S,frac:.9,until:plan.rotateAt||until,back:(f[2]||0)*GAP}];continue;}
   if(t==='fake'){e.stages=[{site:X,frac:.5,until:(plan.rotateAt||until)-2,back:kind==='trade'?GAP+.5:0}];continue;}
   e.site=X;
   if(kind==='entry')e.stages=[{site:X,frac:(t==='default'||t==='slow'?.45:.55)+r()*.12,until,back:0}];
   else if(kind==='trade')e.stages=[{site:X,frac:(t==='default'||t==='slow'?.45:.55)+r()*.12,until,back:GAP}];
   else if(kind==='stack')e.stages=[{site:X,frac:.55+r()*.12,until,back:(f[2]||2)*GAP}];
   else if(kind==='control'||kind==='control2')e.stages=[{site:'mid',frac:t==='split'?.85+r()*.1:.75+r()*.15,until,back:kind==='control2'?GAP:0,avoid:X,alt:Y}];
   else if(kind==='flank'||kind==='flank2')e.stages=[{site:S,frac:.4+r()*.15,until:until+(t==='default'||t==='slow'?2+r()*4:0),back:kind==='flank2'&&S===Y?GAP:0}];}
  // entry and trade partner share the stage point: the trade partner stands GAP m behind it (same frac)
  // (and an execute line behind them on the same point, each `back` GAP m further)
  const en=out.find(e=>e.slot==='entry'),g0=en&&en.stages[0];if(g0)for(const e of out){const g=e.stages[0];if(e!==en&&g&&(e.slot==='trade'||e.slot==='stack')&&g.site===g0.site){g.frac=g0.frac;delete g.pair;}}
  return out;
 }
 // A 'mid' stage with avoid / alt (attack map control): when the map's middle is the plan's own site (Haven / Lotus B is
 // the middle), the caller sends it toward alt instead, so map control never just joins the execute.
 // The map's middle for stage site 'mid': the site nearest the midpoint between the spawns when one is within 25 m of it
 // (Haven / Lotus B), otherwise that midpoint (the caller snaps it to its nav graph). sites {name: [x, y, z]}.
 function midPoint(sites,attacker,defender){const mx=(attacker[0]+defender[0])/2,mz=(attacker[2]+defender[2])/2,my=(attacker[1]+defender[1])/2;let best=null,bd=25;
  for(const k in sites){const c=sites[k],d=Math.hypot(c[0]-mx,c[2]-mz);if(d<bd){bd=d;best=c;}}return best?[best[0],best[1],best[2]]:[mx,my,mz];}
 // ---- Who answers a contact (bots-spread-1) ----
 // Not everyone collapses on the first contact: at most RESPOND.trade teammates go for a trade (the nearest ones that chose
 // to), at most RESPOND.push answer a gunshot by pushing it (one at a time per team), at most RESPOND.rotate defenders
 // rotate on information (the nearest rotation-eligible ones, after their own 1.5-4 s delay); everyone else holds their
 // area. A second trader takes the killer's spot GAP m to the side (a trade, not a two-man clump).
 const RESPOND={trade:2,push:1,rotate:2,gap:GAP,delay:[1.5,4],follow:3.6,pass:4};
 // list: [{id, d}] -> Set of the ids of the `max` nearest (ties by id, so the pick is stable).
 function nearest(list,max){return new Set(list.slice().sort((a,b)=>a.d-b.d||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,Math.max(0,max)).map(c=>c.id));}
 // k-th trader's spot: the killer's position pushed GAP m sideways (alternating sides) from the line trader -> killer.
 function tradeSpot(k,ux,uz,kx,kz,out){const o=out||[0,0];if(!k){o[0]=kx;o[1]=kz;return o;}const dx=kx-ux,dz=kz-uz,l=Math.hypot(dx,dz)||1,s=(k%2?1:-1)*GAP*Math.ceil(k/2);o[0]=kx-dz/l*s;o[1]=kz+dx/l*s;return o;}
 // Trade spacing while walking: a teammate a few metres ahead on the same heading -> walk speed factor (1 = run). Keeps an
 // execute line ~RESPOND.follow m apart instead of nose-to-tail. mates: [[x, z, speed?], ...] (moving teammates only). A teammate
 // ahead at a walk (speed under RESPOND.pass m/s: a quiet walker, a lingerer) is overtaken, not queued behind: a line never
 // jams behind its slowest member (Breeze defender ramp: all five share one spawn exit).
 function follow(px,pz,vx,vz,mates){const l=Math.hypot(vx,vz);if(l<1e-6)return 1;const hx=vx/l,hz=vz/l;let k=1;for(const m of mates){const dx=m[0]-px,dz=m[1]-pz,d=Math.hypot(dx,dz);if(d<.3||d>RESPOND.follow||(m[2]!=null&&m[2]<RESPOND.pass))continue;const ahead=(dx*hx+dz*hz)/d;if(ahead>.6)k=Math.min(k,.55);}return k;}
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
 // ---- Buy phase: bots mill around spawn, then line up at the spawn barrier (server bots.js buyMill, offline
 // work/bot_variety_runtime.js xbbTick). The barrier = the side's spawn walls (vendor/spawn-barriers.cjs pieces: vertical
 // panels in the spawn's real exits, {ax, az, bx, bz, nx, nz: unit normal into spawn, tx, tz: unit along, len}); every
 // player and bot collides with them while the buy phase runs. Bots walk only on BUY_AREA: the spawn's own connected nav
 // region reached without crossing a wall, every node BUY.margin+ from every wall, so a route can never lead through one;
 // standing spots sit BUY.depth inside the wall on its spawn side (a 0.4 m capsule never touches it) and BUY.gap apart.
 const BUY={margin:.5,depth:[.55,.7],gap:.9,peek:[.3,.55],wander:[1.5,6],run:4.6};
 function buyOri(ax,az,bx,bz,cx,cz){return Math.sign((bx-ax)*(cz-az)-(bz-az)*(cx-ax));}
 // nearest wall to (x, z) -> {w: the piece, d: metres, t: metres along it, inside: on its spawn side} | null
 function buyNear(walls,x,z){let best=null;for(const w of walls||[]){const t=Math.max(0,Math.min(w.len,(x-w.ax)*w.tx+(z-w.az)*w.tz)),d=Math.hypot(w.ax+w.tx*t-x,w.az+w.tz*t-z);if(!best||d<best.d)best={w,d,t,inside:(x-w.ax)*w.nx+(z-w.az)*w.nz>=0};}return best;}
 // the step a -> b crosses a wall -> the piece | null
 function buyCross(walls,ax,az,bx,bz){for(const w of walls||[])if(buyOri(ax,az,bx,bz,w.ax,w.az)*buyOri(ax,az,bx,bz,w.bx,w.bz)<0&&buyOri(w.ax,w.az,w.bx,w.bz,ax,az)*buyOri(w.ax,w.az,w.bx,w.bz,bx,bz)<0)return w;return null;}
 // ok(i): the node is playable. -> {f: Uint8Array flags, list: node ids} (empty when start is not inside)
 function buyArea(nodes,adj,start,walls,ok){
  const f=new Uint8Array(nodes.length),list=[],inside=i=>{const n=buyNear(walls,nodes[i][0],nodes[i][2]);return (!n||n.d>=BUY.margin)&&(!ok||ok(i));};
  if(start==null||start<0||!inside(start))return {f,list};f[start]=1;list.push(start);
  for(let k=0;k<list.length;k++){const a=nodes[list[k]];for(const j of adj[list[k]])if(!f[j]&&inside(j)&&!buyCross(walls,a[0],a[2],nodes[j][0],nodes[j][2])){f[j]=1;list.push(j);}}
  return {f,list};}
 // A* inside the area; cost(i): extra metres for entering node i (a node whose capsule touches a prop), may be omitted.
 function buyRoute(nodes,adj,area,a,b,cost){
  if(a<0||b<0||!area.f[a]||!area.f[b])return [];if(a===b)return [a];
  const g=new Map(),prev=new Map(),done=new Set(),H=[],h=i=>Math.hypot(nodes[i][0]-nodes[b][0],nodes[i][2]-nodes[b][2]);
  const push=(i,sc)=>{H.push([i,sc]);let k=H.length-1;while(k){const p=(k-1)>>1;if(H[p][1]<=H[k][1])break;[H[p],H[k]]=[H[k],H[p]];k=p;}};
  const pop=()=>{const r=H[0],l=H.pop();if(H.length){H[0]=l;let k=0;for(;;){let c=k*2+1;if(c>=H.length)break;if(c+1<H.length&&H[c+1][1]<H[c][1])c++;if(H[c][1]>=H[k][1])break;[H[c],H[k]]=[H[k],H[c]];k=c;}}return r[0];};
  g.set(a,0);push(a,h(a));
  while(H.length){const i=pop();if(done.has(i))continue;done.add(i);if(i===b){const p=[];for(let k=b;k!=null;k=prev.get(k))p.push(k);return p.reverse();}
   for(const j of adj[i]){if(!area.f[j]||done.has(j))continue;const c=g.get(i)+Math.hypot(nodes[i][0]-nodes[j][0],nodes[i][2]-nodes[j][2])+Math.abs(nodes[i][1]-nodes[j][1])*.2+(cost?cost(j):0);
    if(!(g.get(j)<=c)){g.set(j,c);prev.set(j,i);push(j,c+h(j));}}}
  return [];}
 // Where a planned route (node ids from spawn toward the bot's first round goal) leaves spawn: the first step that
 // crosses one of the walls -> {x, y, z, dx, dz, w} with (x, z) the crossing, w the wall and (dx, dz) the unit heading
 // out along the route (always some way out through the wall, never back into spawn), or null when it never crosses.
 function buyExit(nodes,path,walls){
  if(!path||path.length<2)return null;
  for(let k=1;k<path.length;k++){const a=nodes[path[k-1]],b=nodes[path[k]],w=buyCross(walls,a[0],a[2],b[0],b[2]);if(!w)continue;
   const da=(a[0]-w.ax)*w.nx+(a[2]-w.az)*w.nz,db=(b[0]-w.ax)*w.nx+(b[2]-w.az)*w.nz,t=da/((da-db)||1),x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t,y=a[1]+(b[1]-a[1])*t;
   let m=k,acc=0;while(m+1<path.length&&acc<5){const p=nodes[path[m]],q=nodes[path[m+1]];acc+=Math.hypot(q[0]-p[0],q[2]-p[2]);m++;}
   const f=nodes[path[m]];let dx=f[0]-x,dz=f[2]-z,l=Math.hypot(dx,dz);if(l<.5){dx=-w.nx;dz=-w.nz;l=1;}dx/=l;dz/=l;
   // at least 0.4 of the heading points out through the wall (-n)
   let o=-(dx*w.nx+dz*w.nz);if(o<.4){const al=dx*w.tx+dz*w.tz,s=Math.sign(al||1)*Math.sqrt(1-.16);dx=-w.nx*.4+w.tx*s;dz=-w.nz*.4+w.tz*s;}
   return {x,y,z,dx,dz,w};}
  return null;}
 // A standing spot just inside that wall: BUY.depth in from it on its spawn side, shifted along it in 0.5 m steps
 // (alternating sides, seeded) until it is free and BUY.gap from every spot a teammate took: the front row within 2.25 m of
 // the exit, a second row 0.75 m behind it (staggered half a step, like players stacking in a doorway), then wider; a
 // spot whose nearest wall is nearer than BUY.depth (a corner where two walls meet) is skipped. ok(x, z) -> [floorY,
 // node] where a capsule may stand and walk to from its area node, else null.
 function buySpot(exit,walls,taken,rand,ok){
  const w=exit.w,depth=BUY.depth[0]+rand()*(BUY.depth[1]-BUY.depth[0]),side=rand()<.5?-1:1,t0=(exit.x-w.ax)*w.tx+(exit.z-w.az)*w.tz;
  for(const [row,reach] of [[0,9],[1,9],[0,40],[1,40],[2,40],[3,40]]){const dn=depth+row*.75;
   for(let i=0;i<=reach;i++){const t=t0+(i?Math.ceil(i/2)*(i%2?side:-side):0)*.5+(row%2)*.25*side;if(t<-.5||t>w.len+.5)continue;const x=w.ax+w.tx*t+w.nx*dn,z=w.az+w.tz*t+w.nz*dn;
    if(taken.some(q=>Math.hypot(q[0]-x,q[2]-z)<BUY.gap))continue;const nr=buyNear(walls,x,z);if(nr&&(nr.d<depth-1e-6||!nr.inside&&nr.d<1.5))continue;const r=ok(x,z);if(!r)continue;return {p:[x,r[0],z],node:r[1]};}}
  return null;}
 // A short wander target inside spawn: an area node BUY.wander m away, 1.2 m+ from every wall, clear of the points
 // teammates stand on or walk to (avoid), ok(i) when given (not a node inside a prop). -> node id or -1.
 function buyWander(nodes,area,from,rand,avoid,walls,ok){
  const L=area.list;if(!L.length)return -1;
  for(let k=0;k<24;k++){const i=L[Math.floor(rand()*L.length)],n=nodes[i],d=Math.hypot(n[0]-from[0],n[2]-from[1]);
   if(d<BUY.wander[0]||d>BUY.wander[1])continue;const nr=buyNear(walls,n[0],n[2]);if(nr&&nr.d<1.2)continue;if((ok&&!ok(i))||avoid.some(a=>Math.hypot(a[0]-n[0],a[1]-n[2])<1.4))continue;return i;}
  return -1;}
 // One bot's buy-phase schedule (seeded): it stands at its spawn spot (the buy menu), walks a few short legs around spawn
 // with pauses and look-arounds (more for patient players), then walks to its barrier spot, timed so it arrives with a
 // margin (cautious players earlier), faces out along its route and makes small peeks along the barrier until it drops.
 function buyNew(P,rand){const ag=P&&P.aggression!=null?P.aggression:.5,pa=P&&P.patience!=null?P.patience:.5;
  return {mode:'shop',t:0,until:.4+rand()*1.5+pa*.6,legs:Math.floor(1+rand()*2.2+pa*.9),leg:0,legT:0,margin:2.5+(1-ag)*3+rand()*2.5,walkLeg:false,
   goal:null,look:null,lookAt:0,sway:rand()*6.283,peekAt:1.2+rand()*2.5,peekSide:rand()<.5?-1:1,peekT:0,rand};}
 // c: {dt, left: buy seconds left, pos: [x, z], spot: [x, y, z] | null, face: [fx, fz] (out along the route),
 //     wander(): [x, y, z] | null, free(x, z): a peek target is clear}. -> {goal: [x, y, z] | null, walk, face: [fx, fz] | null
 // (null: face along the walk)}. Modes: shop -> mill <-> pause -> go -> wait <-> peek / hold.
 function buyTick(st,c){
  st.t+=c.dt;const r=st.rand,px=c.pos[0],pz=c.pos[1],sp=c.spot,dS=sp?Math.hypot(sp[0]-px,sp[2]-pz):0,eta=dS/BUY.run+.8,late=!!sp&&c.left<=eta+st.margin;
  const around=()=>{if(st.t>=st.lookAt||!st.look){const a=(r()-.5)*Math.PI*1.6,f=c.face||[0,-1],b=Math.atan2(f[0],f[1])+a;st.look=[Math.sin(b),Math.cos(b)];st.lookAt=st.t+.7+r()*1.4;}return st.look;};
  if(st.mode==='shop'){if(st.t>=st.until||late)st.mode='mill';else return {goal:null,walk:false,face:around()};}
  if((st.mode==='mill'||st.mode==='pause')&&(late||st.leg>=st.legs)){st.mode=sp?'go':'idle';st.goal=null;}
  if(st.mode==='pause'){if(st.t<st.until)return {goal:null,walk:false,face:around()};st.mode='mill';}
  if(st.mode==='mill'){
   if(!st.goal){st.goal=c.wander();st.legT=0;st.walkLeg=r()<.3;if(!st.goal){st.leg=st.legs;st.mode=sp?'go':'idle';}}
   if(st.goal){st.legT+=c.dt;const d=Math.hypot(st.goal[0]-px,st.goal[2]-pz);
    if(d<.5||st.legT>5){st.leg++;st.goal=null;st.mode='pause';st.until=st.t+.5+r()*1.7;st.lookAt=0;return {goal:null,walk:false,face:around()};}
    return {goal:st.goal,walk:st.walkLeg,face:null};}}
  if(st.mode==='idle'||!sp)return {goal:null,walk:false,face:around()};
  if(st.mode==='go'){if(dS<.12){st.mode='wait';st.peekAt=st.t+1+r()*2.5;}else return {goal:sp,walk:dS<1.1,face:dS<1.5?c.face:null};}
  const f=c.face||[0,-1],sw=.12*Math.sin(st.t*.9+st.sway),fa=Math.atan2(f[0],f[1])+sw,face=[Math.sin(fa),Math.cos(fa)];
  if(st.mode==='peek'){st.peekT+=c.dt;const d=Math.hypot(st.goal[0]-px,st.goal[2]-pz);if(d<.12||st.peekT>.9){st.mode='hold';st.until=st.t+.25+r()*.6;}else return {goal:st.goal,walk:true,face};}
  if(st.mode==='hold'){if(st.t<st.until)return {goal:null,walk:false,face};st.mode='wait';st.peekAt=st.t+1.4+r()*3;}
  // wait: back onto the spot when drifted, otherwise a small peek along the barrier now and then
  if(dS>.2)return {goal:sp,walk:true,face};
  if(st.t>=st.peekAt&&c.left>1.2){st.peekAt=st.t+1.4+r()*3;const o=st.peekSide*(BUY.peek[0]+r()*(BUY.peek[1]-BUY.peek[0])),q=[sp[0]+o,sp[1],sp[2]];st.peekSide=-st.peekSide;
   if(c.free(q[0],q[2])){st.mode='peek';st.goal=q;st.peekT=0;return {goal:q,walk:true,face};}}
  return {goal:null,walk:false,face};}
 // walking past a teammate: push the move away from anyone closer than 1.2 m (others: [[x, z]]) -> out [vx, vz] (unit or 0)
 function buySep(px,pz,others,vx,vz,out){let ax=vx,az=vz;for(const o of others){const dx=px-o[0],dz=pz-o[1],d=Math.hypot(dx,dz);if(d>=1.2||d<1e-6)continue;const k=(1.2-d)*3/d;ax+=dx*k;az+=dz*k;}
  const l=Math.hypot(ax,az);out[0]=l>1e-6?ax/l:0;out[1]=l>1e-6?az/l:0;return out;}
 // steering target along a route (node ids, drained as they are reached) and then the exact goal -> out [x, z]
 function buyNext(nodes,route,px,pz,gx,gz,out){
  while(route.length&&Math.hypot(nodes[route[0]][0]-px,nodes[route[0]][2]-pz)<.45)route.shift();
  if(!route.length||Math.hypot(gx-px,gz-pz)<1){out[0]=gx;out[1]=gz;return out;}
  const n=nodes[route[0]];out[0]=n[0];out[1]=n[2];return out;}
 // ---- Perception (bots-perception-2): what a bot can know. No omniscience: an enemy is SEEN only inside the bot's view
 // cone (VALORANT's fixed 103 deg horizontal hip FOV, plus the body's half-width at that range) with a clear line of sight
 // (the caller's ray: map, smokes, walls), and HEARD only by what VALORANT lets a player hear: running footsteps inside the
 // minimap sound circle (~30 m; walking and crouching are silent), gunshots across the map (suppressed Ghost / Spectre /
 // Phantom only within 40 m), ability casts within 30 m. Both feed a per-bot memory of last-known positions (a heard one
 // placed with an error that grows with range); the bot looks at / hunts / pre-aims those, never at where an enemy really is.
 const SENSE={fov:103*Math.PI/180,step:30,shot:150,shotSup:40,cast:30,near:2,sup:{Ghost:1,Spectre:1,Phantom:1},
  mem:{seen:6,heard:4},glance:3,hunt:10,repeek:2,repeekAng:.3,ear:.08};
 // off: rad between where the bot looks and the enemy's bearing (any sign / wrap); dist: m (pads the cone by the body's half-width).
 function inView(off,dist){return Math.abs(wrapA(off))<=SENSE.fov/2+(dist>0?Math.atan(.3/Math.max(.5,dist)):0);}
 // kind 'step' | 'shot' | 'cast' | 'near' (anyone within 2 m), weapon: the shooter's gun (suppressed guns carry 40 m).
 function audible(kind,dist,weapon){if(!(dist>=0))return false;if(kind==='step')return dist<=SENSE.step;if(kind==='shot')return dist<=(SENSE.sup[weapon]?SENSE.shotSup:SENSE.shot);if(kind==='cast')return dist<=SENSE.cast;return dist<=SENSE.near;}
 // Where a heard sound seems to be: the true spot off by up to SENSE.ear x range (stereo: direction is decent, range is not).
 // n1, n2: two noise draws in [0, 1) from the caller's own deterministic source.
 function earSpot(sx,sz,lx,lz,n1,n2){const d=Math.hypot(sx-lx,sz-lz),e=d*SENSE.ear*n1,a=n2*Math.PI*2;return [sx+Math.cos(a)*e,sz+Math.sin(a)*e];}
 // Memory: {c: {enemyId: {x, y, z, t, kind: 'seen' | 'heard', seenT}}}. memNote keeps the newest contact per enemy (a heard
 // one never overwrites a fresher sighting); memBest is the freshest live contact (seen ones last SENSE.mem.seen s, heard
 // SENSE.mem.heard s, or maxAge), ties to the nearer; memForget on a kill / death.
 function memNew(){return {c:{}};}
 function memNote(m,id,x,y,z,t,kind){const c=m.c[id]||(m.c[id]={t:-1e9});if(kind!=='seen'&&c.kind==='seen'&&t-c.t<.5)return c;c.x=x;c.y=y;c.z=z;c.t=t;c.kind=kind;if(kind==='seen')c.seenT=t;return c;}
 function memForget(m,id){if(m&&m.c)delete m.c[id];}
 function memBest(m,now,px,pz,maxAge){let best=null,bs=Infinity;if(!m)return null;for(const id in m.c){const c=m.c[id],age=now-c.t,lim=maxAge!=null?maxAge:c.kind==='seen'?SENSE.mem.seen:SENSE.mem.heard;if(!(age>=0&&age<=lim))continue;const sc=age+Math.hypot(c.x-px,c.z-pz)*.02;if(sc<bs){bs=sc;best=c;best.id=id;}}return best;}
 // A re-peek: the enemy shows up again within SENSE.repeek s of being seen, at about the bearing the bot still holds (its
 // crosshair stayed on that spot) -> the fight starts pre-aimed. bearing / lastBearing: rad in the caller's yaw convention.
 function repeek(c,now,bearing,lastBearing){return !!c&&c.seenT!=null&&now-c.seenT<=SENSE.repeek&&Math.abs(wrapA(bearing-lastBearing))<=SENSE.repeekAng;}
 // Line of sight is checked every tick a bot shoots: a burst never keeps going at an enemy that has left its sight. A
 // glimpse shorter than the reaction (>= 200 ms) is never shot at; visibleFor (s of unbroken sight) >= reactionS gates the
 // trigger, so a 100 ms jiggle cannot be four-shot.
 function mayFire(visibleFor,reactionS,losNow){return !!losNow&&visibleFor>=Math.max(REACT[0],reactionS||0);}
 // Fire-rate cap: never faster than the gun (Vandal 9.75 rounds/s). Returns the earliest next shot time.
 function nextShot(t,rate){return t+1/Math.max(.1,rate||1);}
 return {hash,rng,clamp,pickW,REACT,personality,reaction,crosshair,crosshairAt,firePattern,peek,attackPlan,defensePlan,roles,teamBuy,buyFor,onMateDeath,onSound,ATTACK,DEFENSE,utility,UTIL,turnStep,trackLag,wrapA,SPIKE,plantSpot,postPlant,retake,postPlay,SHOOT_UTIL,shootUtility,TAILWIND,tailwindDash,tailwindKeys,LEVEL,level,aimTraits,AIM_H,aimHeight,halfWidth,aimPlan,aimAt,readyToFire,planFire,idlePitch,recoilPull,discipline,hitPart,BUY,buyArea,buyRoute,buyExit,buySpot,buyWander,buyNew,buyTick,buyNext,buySep,SENS,cm360,sensOf,turnRate,SENSE,inView,audible,earSpot,memNew,memNote,memForget,memBest,repeek,mayFire,nextShot,areas,DFORM,GAP,midPoint,RESPOND,nearest,tradeSpot,follow,buyNear,buyCross};
});
