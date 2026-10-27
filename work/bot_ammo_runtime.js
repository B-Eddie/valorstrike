// ---- BOT AMMO ----
// Offline bots (enemy + ally) carry real magazines, reserve ammo and per-weapon reload times, like the server's bots
// (server/src/simulation.js: magazineSize / reloadTimeSeconds from weapons.json = VF.profiles here, RESERVE = XRSV / xRsv,
// RELOAD_ROUND = XRLP, Outlaw 2.3 s one barrel / 3.8 s both, finishReload: a 5v5 round draws from a finite reserve, Deathmatch /
// Team Deathmatch reload from an endless one). Each gun a bot holds keeps its own magazine (b.xAm.inv); a new round refills
// all of them (xbAmRound, wrapped onto fRound / rRound), a death drops the state (the next life starts full).
// Human-like reload choice (xbAmTick, every frame of every living offline bot): an empty magazine reloads at once, mid-duel
// too (= the server's bots); otherwise a bot never starts a reload while it sees an enemy. Out of sight it reloads right
// after the enemy it was shooting dies (missing >= 20 % of the magazine), behind cover when low (<= 35 %) after ~0.6 s out of
// sight, and tops up anything missing in a lull of ~3 s. Per-bot jitter on the timing so a team does not reload in lockstep.
// The gun cannot fire while reloading (a Bucky / Marshal per-round reload excepted: a shot with rounds in the tube interrupts
// it, as the server's fire()), a weapon swap cancels the reload. Blade Storm knives are not gun ammo. The fire sites
// (index.html bot loop, ally loop, xUtilShoot) call xbAmFire per bullet; botCanShoot gates on xbAmBlocked. b.xAmRn / b.xAmRd
// count / time each started reload for the third-person reload clip (xUb).
const XBAM={r:0,low:.35,kill:.2,cover:.6,lull:3};
function xbAmMag(w){const p=typeof VF!=='undefined'&&VF&&VF.profiles&&VF.profiles[w];return p&&p.magazineSize>0?p.magazineSize:(WEAP[w]&&WEAP[w].mag)||0;}
function xbAmRes(w){return typeof xRsv==='function'?xRsv(w):xbAmMag(w)*3;}
function xbAmGun(w){return !!w&&w!=='Knife'&&w!=='Blade Storm'&&xbAmMag(w)>0;}
// = server reloadTime(u): per-round guns one round, Outlaw by barrels missing, else the gun's reloadTimeSeconds; Empress stim /1.1.
function xbAmRT(w,ammo,k){const p=typeof VF!=='undefined'&&VF&&VF.profiles&&VF.profiles[w],t=typeof XRLP!=='undefined'&&XRLP[w]?XRLP[w]:w==='Outlaw'?(xbAmMag(w)-(ammo||0)>=2?3.8:2.3):p&&p.reloadTimeSeconds>0?p.reloadTimeSeconds:(WEAP[w]&&WEAP[w].rld)||2.5;return t/(k||1);}
function xbAmEndless(){return typeof FV!=='undefined'&&!!FV&&!!(FV.dm||FV.tdm)&&mode==='five';}
function xbAmW(b){return b.w||(typeof allies!=='undefined'&&allies.indexOf(b)>=0?'Vandal':'Classic');}
// The state of the bot's current gun (created full on first use / after a round / a death).
function xbAm(b){let A=b.xAm;if(!A||A.r!==XBAM.r){A=b.xAm={r:XBAM.r,inv:{},w:null,mag:0,res:0,rl:0,rd:0,quiet:0,tg:null,j:.8+Math.random()*.4};}
 const w=xbAmW(b);if(A.w!==w){if(A.w){A.inv[A.w]=[A.mag,A.res];}if(A.rl>0){A.rl=0;}const s=A.inv[w];A.w=w;A.mag=s?s[0]:xbAmMag(w);A.res=s?s[1]:xbAmRes(w);}return A;}
function xbAmRound(){XBAM.r++;}
function xbAmStart(b,A){if(!xbAmGun(A.w)||A.rl>0)return false;const full=xbAmMag(A.w);if(A.mag>=full||(!xbAmEndless()&&A.res<=0))return false;A.rd=xbAmRT(A.w,A.mag,b.empress?1.1:1);A.rl=A.rd;b.xAmRn=(b.xAmRn||0)+1;b.xAmRd=A.rd;return true;}
function xbAmFinish(b,A){const full=xbAmMag(A.w),one=typeof XRLP!=='undefined'&&XRLP[A.w],need=one?Math.min(1,full-A.mag):full-A.mag,end=xbAmEndless(),n=end?need:Math.min(A.res,need);A.mag+=n;if(!end)A.res-=n;A.rl=0;
 if(one&&A.mag<full&&(end||A.res>0))xbAmStart(b,A);} // per-round: the next round on its own clock
// One bullet (or one shotgun blast) fired at t (the enemy unit, for the after-kill reload).
function xbAmFire(b,w,t){const A=xbAm(b);if(!xbAmGun(A.w))return;if(A.rl>0)A.rl=0;/* only a per-round reload lets a shot through: it interrupts it */A.mag=Math.max(0,A.mag-1);if(t)A.tg=t;if(A.mag<=0){b.bn=0;}}
function xbAmBlocked(b){if(!b||b.nt||!b.xAm)return false;if(typeof xBsBot==='function'&&xBsBot(b))return false;const A=xbAm(b);if(!xbAmGun(A.w))return false;if(A.mag<=0)return true;return A.rl>0&&!(typeof XRLP!=='undefined'&&XRLP[A.w]);}
function xbAmDead(t){return !t||(t===(typeof player!=='undefined'&&player)?!(t.hp>0):t.alive===false||!(t.hp>0));}
function xbAmTick(b,dt){if(!b||b.nt||!b.alive)return;const A=xbAm(b);if(!xbAmGun(A.w))return;
 const see=(b.see||0)>0;A.quiet=see?0:A.quiet+dt;
 if(A.rl>0){A.rl-=dt;if(A.rl<=0)xbAmFinish(b,A);return;}
 const full=xbAmMag(A.w);if(A.mag>=full)return;
 if(A.mag<=0){xbAmStart(b,A);return;}            // empty: reload now, even mid-duel
 if(see)return;                                    // never mid-duel otherwise
 const miss=(full-A.mag)/full,j=A.j;
 if(A.tg&&xbAmDead(A.tg)&&A.quiet>=.25*j&&miss>=XBAM.kill){A.tg=null;xbAmStart(b,A);return;} // after the kill
 if(A.quiet>=XBAM.cover*j&&A.mag/full<=XBAM.low){xbAmStart(b,A);return;}                      // behind cover, low
 if(A.quiet>=XBAM.lull*j)xbAmStart(b,A);}                                                      // a lull: top up
if(typeof botCanShoot==='function'){const am0=botCanShoot;botCanShoot=function(b){return !xbAmBlocked(b)&&am0.apply(this,arguments);};}
if(typeof fRound==='function'){const am1=fRound;fRound=function(){xbAmRound();return am1.apply(this,arguments);};}
if(typeof rRound==='function'){const am2=rRound;rRound=function(){xbAmRound();return am2.apply(this,arguments);};}
if(typeof kill==='function'){const am3=kill;kill=function(b){const r=am3.apply(this,arguments);try{if(b&&!b.alive)b.xAm=null;}catch(e){}return r;};}
if(typeof allyDie==='function'){const am4=allyDie;allyDie=function(a){const r=am4.apply(this,arguments);try{if(a&&!a.alive)a.xAm=null;}catch(e){}return r;};}
// ---- END BOT AMMO ----
