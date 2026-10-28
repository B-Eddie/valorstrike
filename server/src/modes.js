// Extra online game modes (modes-1, user 2026-10-26: "add more gamemodes for multiplayer and make it so you can change gamemode
// when in a team"). Rules from the VALORANT wiki pages fetched 2026-10-26 (valorant.fandom.com/wiki/<Mode>; summary and judgment
// calls in work/validation/modes-notes.md of the project workspace, ledger rows in work/remaining-validation.md).
//  - Escalation ('esc'): team deathmatch race through 12 weapon levels (internal sim mode 'esc', a team mode: everything that is not
//    'dm' treats it as two teams). Deployable without the Spike gate.
//  - Swiftplay ('swift'), Spike Rush ('sr'), Replication ('rep'): Spike rounds on SpikeSimulation with their own round rules. The
//    sim keeps mode 'five' (every Spike path in the worker, fog and abilities keys on it) and names the variant in `gm`; they sit
//    behind the same ENABLE_SPIKE release gate as Unrated ('five').
import {Simulation,weapons,reserveOf} from './simulation.js';
import {SpikeSimulation} from './spike.js';
import {gainUlt,initAbilities} from './abilities.js';
import kits from './kits.json' with {type:'json'};

export const SPIKE_VARIANTS=Object.freeze(['swift','sr','rep']);
export const ALL_MODES=Object.freeze(['dm','tdm','esc','skm','five','swift','sr','rep']);
export const isSpikeMode=m=>m==='five'||SPIKE_VARIANTS.includes(m);
export const MODE_NAMES=Object.freeze({dm:'Deathmatch',tdm:'Team Deathmatch',esc:'Escalation',five:'Unrated',swift:'Swiftplay',sr:'Spike Rush',rep:'Replication',skm:'Skirmish 1v1'});

// ---- Escalation ----
// Weapon ladder = the offline page's ESC_W (index.html ESCALATION block), so online and offline play the same 12 levels. The live
// mode also hands out abilities / Snowball Launcher / Big Knife levels (wiki "Escalation tools"); this game has no such weapons.
export const ESC_LEVELS=Object.freeze(['Odin','Ares','Spectre','Judge','Bulldog','Guardian','Marshal','Operator','Sheriff','Shorty','Classic','Knife']);
// Wiki: 7 team points per level; a kill by a player on the team's current level is 1 point, on a previous level 0.5; 10 minutes;
// respawn at a random spot, protected 5 s or until moving. The last (Knife) level ends on 1 point, as the offline page plays it.
export const ESC=Object.freeze({need:7,last:1,current:1,behind:.5,seconds:600,protect:5});
// Escalation health packs (wiki.playvalorant.com/en-us/Escalation: a kill "drops a health pack on the victim's body that lasts for 10
// seconds and can be picked up to fully restore the user's health, shields, and ammo"; playvalorant.com "New VALORANT mode: Escalation"
// (2021-02-16): "Every death drops a health pack that expires after 10 seconds"). Same pickup as fog-spec-3's Deathmatch packs
// (Simulation.packTick: one pack at the victim's feet, 0.5 m sphere + 0.35 m capsule, within 1.8 m vertically, not out of bounds),
// with Escalation's numbers: 10 s, health to 100 and armour to 50 (full: the 100 / 50 cap), the weapon's magazine + reserve
// refilled; a unit at full health / armour still takes it when its gun is not full.
export const ESC_PACK=Object.freeze({life:10,hp:100,armor:50,r:.5,cap:100,armorCap:50,ammo:true});
export const escNeed=lv=>lv>=ESC_LEVELS.length-1?ESC.last:ESC.need;
export class EscalationSimulation extends Simulation{
 constructor(world,mode='esc',map='ascent',random=Math.random){super(world,'esc',map,random);this.gm='esc';this.packRule=ESC_PACK;this.matchLen=ESC.seconds;this.remaining=ESC.seconds;this.maxKills=Infinity;this.esc={lv:[0,0],pt:[0,0]};}
 escWeapon(u){const t=u.team===1?1:0,lv=Math.min(u.escLv??0,this.esc.lv[t],ESC_LEVELS.length-1);return ESC_LEVELS[lv];}
 add(name,agent,human,want){const u=super.add(name,agent,human,want);u.escLv=Math.min(this.esc.lv[u.team===1?1:0],ESC_LEVELS.length-1);u.escK=false;this.arm(u);return u;}
 // Give u its level's weapon, full magazine and reserve (the only weapon besides the knife).
 arm(u){const w=this.escWeapon(u),g=weapons[w];if(!g)return;u.weapon=w;u.ammo=g.magazineSize;u.inventory={[w]:g.magazineSize};u.reserve=reserveOf(w);u.reserves={[w]:u.reserve};u.reloadAt=0;u.fireAt=Math.max(u.fireAt||0,this.time+(g.equipTimeSeconds||0));u.equipAt=u.fireAt;}
 spawn(u){if(u.escLv===undefined){u.escLv=0;u.escK=false;}u.weapon=this.escWeapon(u);super.spawn(u);const p=this.dmSpawnPoint(u);if(p){u.x=p[0];u.y=p[1];u.z=p[2];}u.protectedUntil=this.time+ESC.protect;u.escSpawnAt=this.time;}
 start(fill=true){this.esc={lv:[0,0],pt:[0,0]};for(const u of this.units){u.escLv=0;u.escK=false;}super.start(fill);this.remaining=ESC.seconds;this.scores=[0,0];}
 weaponAllowed(name){return !weapons[name]?.abilityOnly;}
 command(u,m){if(m?.t==='equip'&&m.w!==this.escWeapon(u)&&m.w!=='Knife')return false;if(['buy','sell','pick','dropw','ab'].includes(m?.t))return false;return super.command(u,m);}
 onGunKill(k,v){if(!k||!v||k.team===v.team||this.phase!=='game')return;const t=k.team===1?1:0;if(this.esc.lv[t]>=ESC_LEVELS.length)return;
  const onLevel=(k.escLv??0)>=this.esc.lv[t];this.esc.pt[t]+=onLevel?ESC.current:ESC.behind;k.escK=true;
  if(this.esc.pt[t]>=escNeed(this.esc.lv[t])-1e-9){this.esc.pt[t]=0;this.esc.lv[t]++;this.events.push(['esc',t,this.esc.lv[t]]);
   if(this.esc.lv[t]<ESC_LEVELS.length)for(const u of this.units)if(u.team===t&&u.escK&&u.escLv<this.esc.lv[t]){u.escLv++;u.escK=false;if(u.alive)this.arm(u);}}
  else if(k.escLv<this.esc.lv[t]){k.escLv++;k.escK=false;this.arm(k);}
  this.scores=[this.esc.lv[0],this.esc.lv[1]];}
 step(dt){if(this.phase!=='game')return super.step(dt);
  // spawn protection ends early once the unit moves or fires (wiki: "invulnerable for either 5 seconds or until they move")
  for(const u of this.units){if(!(u.protectedUntil>this.time)||!u.alive)continue;const i=u.input||{};if(this.time-(u.escSpawnAt||0)>.25&&(i.forward||i.side||i.fire||i.jump))u.protectedUntil=this.time;}
  super.step(dt);
  this.scores=[this.esc.lv[0],this.esc.lv[1]];
  if(this.esc.lv.some(l=>l>=ESC_LEVELS.length))this.phase='post';
  // time out: furthest along wins (levels, then points on the level); scores carry the points as a fraction for the result
  if(this.phase==='post')this.scores=[this.esc.lv[0]+this.esc.pt[0]/100,this.esc.lv[1]+this.esc.pt[1]/100];}
 snapshot(){const s=super.snapshot();s.esc={lv:[...this.esc.lv],pt:[...this.esc.pt],w:[0,1].map(t=>ESC_LEVELS[Math.min(this.esc.lv[t],ESC_LEVELS.length-1)]),n:[escNeed(Math.min(this.esc.lv[0],11)),escNeed(Math.min(this.esc.lv[1],11))]};return s;}
}

// ---- Spike round variants ----
const SIDEARMS=['Classic','Shorty','Frenzy','Ghost','Bandit','Sheriff'];
// Spike Rush loadouts (wiki Spike_Rush "Weapons"): round 1 any sidearm (the game's Bandit is not in this game) with no shields;
// round 2 a primary of 2050 or less with Light (25); round 3 and Endgame a primary of 2250 or more with Heavy (50).
export const SR_LOADOUT=Object.freeze([{w:SIDEARMS,a:0},{w:['Stinger','Spectre','Bucky','Judge','Bulldog','Marshal','Ares'],a:25},{w:['Guardian','Warden','Phantom','Vandal','Outlaw','Operator','Odin'],a:50}]);
// Per round in the half (1-based) and Endgame. credits: 'set' replaces, 'add' adds (cap 9000).
export const VARIANT_RULES=Object.freeze({
 // Swiftplay: first to 5, 4-round halves, 4-4 goes to an Endgame round 9. Ult: 2 points at the start of each half (3 for 9-point
 // ultimates). Credits the same for both teams, no loss-streak bonus: R1 800, R2 +2400 (+600 if the team won round 1), R3 +4250,
 // R4 +4250, Endgame 5000. Round 100 s, buy 45 s on the first round of a half else 30 s (= Unrated).
 swift:Object.freeze({name:'Swiftplay',win:5,half:4,round:100,buy:r=>r===1?45:30,credits:(r,won)=>r===1?{set:800}:r===2?{add:2400+(won?600:0)}:{add:4250},endgame:{set:5000}}),
 // Spike Rush: first to 4, 3-round halves, pre-round 20 s, rounds 80 s, everyone the same random gun, every attacker can plant,
 // all abilities but the ultimate charged every round, kill / death ult points x2, Endgame: everyone 3 points short of the ult.
 sr:Object.freeze({name:'Spike Rush',win:4,half:3,round:80,buy:()=>20,noBuy:true}),
 // Replication: first to 5, 4-round halves, 80 s rounds, each team one agent, weapons and shields reset every round, credits set
 // per round in the half regardless of the result: 900 / 2400 / 3900 / 6000 (R4 and Endgame); basic and signature abilities
 // refreshed every round, +1 ult point per round (not Endgame); FLASHGUARD: flashed twice within 4 s -> 5 s that cannot be blinded.
 rep:Object.freeze({name:'Replication',win:5,half:4,round:80,buy:r=>r===1?45:30,credits:r=>({set:[900,2400,3900,6000][r-1]??6000}),endgame:{set:6000},flashguard:{window:4,dur:5}})});
export class VariantSpikeSimulation extends SpikeSimulation{
 constructor(world,variant,map,random){super(world,'five',map,random);this.gm=variant;this.rules=VARIANT_RULES[variant];this.orbs=[];}
 // round number (1-based) inside its half, and whether `r` is the Endgame round (tied one short of the win after both halves)
 inHalf(r){return ((r-1)%this.rules.half)+1;}
 isEndgame(r){return r>2*this.rules.half;}
 // Replication: each team plays one agent, picked at random among the humans' picks on that team (a team of bots: a bot's agent).
 replicate(){for(const t of [0,1]){const team=this.units.filter(u=>u.team===t);if(!team.length)continue;const votes=team.filter(u=>u.human).map(u=>u.agent).filter(a=>kits[a]);const pool=votes.length?votes:team.map(u=>u.agent).filter(a=>kits[a]);const ag=pool[Math.floor(this.random()*pool.length)]||'Jett';(this.repAgent||(this.repAgent={}))[t]=ag;for(const u of team)u.agent=ag;}}
 add(name,agent,human,want){const u=super.add(name,agent,human,want);if(this.gm==='rep'&&this.repAgent&&this.repAgent[u.team])u.agent=this.repAgent[u.team];return u;}
 newRound(){const R=this.rules,r=this.round+1,rih=this.inHalf(r),end=this.isEndgame(r),wonPrev=this.lastWinner;
  if(r===1&&this.gm==='rep')this.replicate();/* after the room's bots are seated (Simulation.start), before round 1 spawns */
  if(r===R.half+1){this.atk=1;this.losses=[0,0];for(const u of this.units){u.primary=null;u.secondary='Classic';u.armor=0;u.rgn=null;}}
  if(end)this.atk=this.random()<.5?0:1;/* Endgame: side drawn at random */
  if(this.gm==='rep')for(const u of this.units){u.primary=null;u.secondary='Classic';u.armor=0;u.rgn=null;}
  const cr=end?R.endgame:R.credits?R.credits(rih,null):null;
  if(cr)for(const u of this.units){const c=this.gm==='swift'&&!end&&rih===2?R.credits(rih,wonPrev===u.team):cr;u.credits=this.qaCredits??Math.min(9000,c.set!==undefined?c.set:(u.credits||0)+c.add);}
  if(R.noBuy)for(const u of this.units)u.credits=0;
  super.newRound();
  this.remaining=R.round;this.buy=this.qaBuy??R.buy(rih);
  if(r===R.half+1)for(const u of this.units)initAbilities(u,true);/* second half: abilities reset as Unrated's round 13 */
  for(const u of this.units){const A=u.ability,K=kits[u.agent]||kits.Jett;if(!A)continue;
   if(this.gm==='swift'&&rih===1&&!end)A.ult=Math.max(A.ult||0,Math.min(K.u,K.u>=9?3:2));
   if(this.gm==='sr'||this.gm==='rep'){const M=K.mx||{};A.c=M.c||0;A.q=M.q||0;if(M.e!=null)A.e=M.e;}
   if(this.gm==='rep'&&r>1&&!end)gainUlt(u,1);
   if(end&&(this.gm==='sr'||this.gm==='rep'))A.ult=Math.max(A.ult||0,K.u-3);/* Swiftplay Endgame keeps ult points as they are (wiki Swiftplay: its only ult rule is 2 per half) */}
  if(this.gm==='sr')this.srRound(r,end);
  }
 // Spike Rush: one random gun for everyone this round, shields by round, Spike with any attacker, ult orbs on the map.
 srRound(r,end){const L=SR_LOADOUT[end?2:Math.min(2,this.inHalf(r)-1)],w=L.w[Math.floor(this.random()*L.w.length)];this.srGun=w;
  for(const u of this.units){const side=SIDEARMS.includes(w);u.primary=side?null:w;u.secondary=side?w:'Classic';u.weapon=w;const g=weapons[w];u.ammo=g.magazineSize;u.inventory={[w]:g.magazineSize};u.reserve=reserveOf(w);u.reserves={[w]:u.reserve};if(!side){u.inventory.Classic=weapons.Classic.magazineSize;u.reserves.Classic=reserveOf('Classic');}u.armor=L.a;u.rgn=null;u.purchases=[];}
  // Powerup orbs: 1-5 a round (wiki), each +1 ult point when touched; one of them is the Full Ultimate orb (always in the set).
  const W=this.world,N=W.nav?.nodes||[],P=W.playable||[],n=1+Math.floor(this.random()*5);this.orbs=[];
  for(let k=0;k<40&&this.orbs.length<n&&P.length;k++){const p=N[P[Math.floor(this.random()*P.length)]];if(!p||this.orbs.some(o=>Math.hypot(o.x-p[0],o.z-p[2])<12))continue;this.orbs.push({id:k,x:p[0],y:p[1],z:p[2],full:this.orbs.length===0?1:0});}}
 command(u,m){if(this.rules.noBuy&&['buy','sell'].includes(m?.t))return false;return super.command(u,m);}
 finishRound(winner,text){if(this.roundDelay>0)return;const before=new Map(this.units.map(u=>[u,u.credits]));super.finishRound(winner,text);this.lastWinner=winner;
  if(this.rules.credits||this.rules.noBuy)for(const u of this.units)u.credits=before.get(u)??u.credits;/* round-outcome money comes from the round table at the next round start */
  const e=this.roundEvents.at(-1);if(e&&e.t==='re')e.o=this.variantOver()?1:0;}
 variantOver(){return Math.max(...this.roundScores)>=this.rules.win;}
 step(dt){if(this.phase!=='game')return super.step(dt);
  const d=Math.min(.05,Math.max(0,dt));if(this.roundDelay>0&&this.roundDelay-d<=0&&this.variantOver()){this.time+=d;this.roundDelay=0;this.phase='post';this.scores=[...this.roundScores];return;}
  const seen=this.gm==='sr'?new Map(this.units.map(u=>[u,(u.kills||0)+(u.deaths||0)-(u.noUltDeaths||0)])):null;
  if(this.gm==='sr')this.srSpike();
  super.step(dt);
  if(seen)for(const u of this.units){const n=(u.kills||0)+(u.deaths||0)-(u.noUltDeaths||0),was=seen.get(u);if(was!==undefined&&n>was)gainUlt(u,n-was);/* kill and death ult points x2 */}
  if(this.gm==='sr'&&this.orbs.length&&!(this.buy>0))for(const u of this.units){if(!u.alive||u.loading)continue;for(let i=this.orbs.length-1;i>=0;i--){const o=this.orbs[i];if(Math.hypot(u.x-o.x,u.z-o.z)<1.6&&Math.abs(u.y-o.y)<2){this.orbs.splice(i,1);const K=kits[u.agent]||kits.Jett;if(o.full&&u.ability)u.ability.ult=K.u;else gainUlt(u,1);this.events.push(['orb',u.name,o.full?1:0]);}}}
  if(this.rules.flashguard)this.flashguard();}
 // Spike Rush: every attacker carries a Spike. Modelled as the one Spike moving to whichever living attacker needs it: one standing
 // in a site (the one already planting keeps it), else the carrier, else any living attacker (no dropped Spike to walk back to).
 srSpike(){const sp=this.spike;if(!sp||!['carry','drop',''].includes(sp.st)||this.buy>0)return;const A=this.units.filter(u=>u.team===this.atk&&u.alive&&!u.loading);if(!A.length)return;
  const cur=A.find(u=>u.id===sp.carrier);let c=cur&&this.siteAt(cur)?cur:A.find(u=>this.siteAt(u))||cur||A[0];if(sp.st!=='carry'||sp.carrier!==c.id){sp.st='carry';sp.carrier=c.id;sp.pt=0;sp.x=c.x;sp.y=c.y;sp.z=c.z;}}
 // Replication FLASHGUARD: a second blind starting within 4 s of the first gives 5 s that cannot be blinded (a blind applied inside
 // the guard is cleared on the next tick, 50 ms).
 flashguard(){const F=this.rules.flashguard;for(const u of this.units){const blind=u.blindUntil>this.time;if(u.fgUntil>this.time){if(blind)u.blindUntil=this.time;u.fgBlind=false;continue;}
  if(blind&&!u.fgBlind){u.fgOn=(u.fgOn||[]).filter(t=>this.time-t<=F.window);u.fgOn.push(this.time);if(u.fgOn.length>=2){u.fgUntil=this.time+F.dur;u.fgOn=[];this.events.push(['fg',u.name]);}}u.fgBlind=blind;}}
 roundState(u){const r=super.roundState(u);r.gm=this.gm;r.win=this.rules.win;r.half=this.rules.half;if(this.gm==='sr'){r.orb=this.buy>3?[]:this.orbs.map(o=>[o.id,Math.round(o.x*100)/100,Math.round(o.y*100)/100,Math.round(o.z*100)/100,o.full]);r.gun=this.srGun||null;}if(this.gm==='rep'&&this.repAgent)r.rag=this.repAgent[u.team]||null;if(u.fgUntil>this.time)r.fg=Math.round((u.fgUntil-this.time)*100)/100;return r;}
}

// ---- Skirmish 1v1 ('skm') ----
// VALORANT Skirmish (patch 11.07b notes, playvalorant.com 2025-10-07: "No economy system", "No abilities by default", "Set and
// forget your weapon, or change loadouts each round", "Unlimited round timer", "Supports 1v1 through 5v5"; valorant.fandom.com
// /wiki/Skirmish: "The team that kills all of the opposing team players wins the round", Heavy Armor on every spawn, infinite
// credits, buy phase 15 s on round 1 and 3 s after, no weapon drops). Here: two human players online, one per team, never a bot
// (the room refuses a third player, no bot fills an empty seat or replaces a leaver); elimination rounds with no Spike; first to 5
// round wins (user-approved; VALORANT's default is 10); a free loadout of one primary + one sidearm kept between rounds and
// changed only in the buy phase (equip of a new gun); Heavy Armor (50) and full health every round; walking and fire held during
// the buy phase (looking around and jumping stay free, as the page's plant / defuse hold); 3 s between rounds; no side swap. Unlimited rounds as VALORANT, with a 20 minute match cap (more round wins, else
// a draw). A seat left empty (the player left; a dropped connection keeps the unit for the resume window) pauses the match
// ('wait'): the player rejoining restarts the round (score kept); after 60 s the one still there wins by forfeit.
export const SKM=Object.freeze({win:5,buyFirst:15,buy:3,end:3,armor:50,cap:1200,forfeit:60,loadHold:20,kit:Object.freeze({pri:'Vandal',sec:'Classic'})});
const SKM_SIDE=Object.freeze(['Classic','Shorty','Frenzy','Ghost','Bandit','Sheriff']);
export class SkirmishSimulation extends Simulation{
 constructor(world,mode='skm',map='ascent',random=Math.random){super(world,'skm',map,random);this.gm='skm';this.maxHumans=2;this.minHumans=2;this.noBots=true;this.matchLen=SKM.cap;this.remaining=SKM.cap;this.maxKills=Infinity;this.roundWin=SKM.win;this.skm=this.skmFresh();}
 skmFresh(){return {r:0,sc:[0,0],ph:'room',t:0,lw:-1,why:'',at:0,waitAt:0,ld:0};}
 // One human per team: the free team (a returning player gets their side back when it is free); no bots, no third player.
 add(name,agent='Jett',human=true,want=null){if(!human)throw Error('no bots in Skirmish');if(this.units.filter(u=>u.human).length>=this.maxHumans)throw Error('full');
  const free=[0,1].filter(t=>!this.units.some(u=>u.team===t)),team=free.includes(want)?want:free[0];const u=super.add(name,agent,true,team);u.kit=u.kit||{...SKM.kit};return u;}
 start(){this.skm=this.skmFresh();super.start(false);this.remaining=this.matchLen;/* the 20 min cap: Simulation.start set the TDM 9:30 */this.newRound();}
 newRound(){const S=this.skm;S.r++;S.ph='buy';S.t=S.r===1?SKM.buyFirst:SKM.buy;S.at=this.time;S.lw=-1;S.why='';this.roundSpawn=true;try{for(const u of this.units)this.spawn(u);}finally{this.roundSpawn=false;}}
 // Round spawn: own team spawn, full health, Heavy Armor, the kept loadout with full magazines. A unit that died this round
 // stays out until the next one (a late 'ready' / rescue spawn never revives it).
 spawn(u){const S=this.skm;if(this.phase==='game'&&!this.roundSpawn&&!u.alive&&S&&!['buy','wait'].includes(S.ph)){u.respawnAt=Infinity;return;}
  u.kit=u.kit||{...SKM.kit};u.weapon=u.kit.pri&&weapons[u.kit.pri]?u.kit.pri:u.kit.sec;super.spawn(u);
  const inv={},res={};for(const w of [u.kit.pri,u.kit.sec])if(w&&weapons[w]){inv[w]=weapons[w].magazineSize;res[w]=reserveOf(w);}
  u.inventory=inv;u.reserves=res;u.ammo=inv[u.weapon];u.reserve=res[u.weapon];u.reloadAt=0;u.armor=SKM.armor;u.rgn=null;u.protectedUntil=0;u.respawnAt=Infinity;}
 // No economy, abilities or drops; a gun outside the kept loadout is taken (it replaces that slot) in the buy phase only.
 command(u,m){const t=m?.t;if(['buy','sell','pick','dropw','drop','ab','blade'].includes(t))return false;
  if(t==='equip'&&typeof m.w==='string'&&Object.hasOwn(weapons,m.w)&&m.w!=='Knife'&&!weapons[m.w].abilityOnly){const slot=SKM_SIDE.includes(m.w)?'sec':'pri';u.kit=u.kit||{...SKM.kit};
   if(u.kit[slot]!==m.w){if(this.phase==='game'&&this.skm.ph!=='buy')return false;const old=u.kit[slot];u.kit[slot]=m.w;if(old&&old!==u.weapon){delete u.inventory[old];delete u.reserves[old];}u.inventory[m.w]=weapons[m.w].magazineSize;u.reserves[m.w]=reserveOf(m.w);}}
  return super.command(u,m);}
 fire(u){if(this.skm.ph!=='live')return false;return super.fire(u);}
 alive(t){return this.units.some(u=>u.team===t&&u.alive);}
 endRound(w){const S=this.skm;S.ph='end';S.t=SKM.end;S.lw=w;if(w===0||w===1){S.sc[w]++;S.why='eliminated';}else S.why='draw';if(Math.max(...S.sc)>=SKM.win){this.phase='post';S.ph='over';}}
 step(dt){if(this.phase!=='game')return super.step(dt);const S=this.skm,d=Math.min(.05,Math.max(0,dt));
  const empty=[0,1].filter(t=>!this.units.some(u=>u.team===t));
  if(empty.length&&S.ph!=='wait'){S.ph='wait';S.waitAt=this.time;S.t=SKM.forfeit;}else if(!empty.length&&S.ph==='wait')this.newRound();
  if(S.ph==='buy'){/* a player still loading holds the buy clock for at most SKM.loadHold s from the round's start, then it runs regardless (S.ld = the wait left, sent as skm.ld: the page shows 'Waiting for opponent' instead of the buy timer) */const w=this.units.some(u=>u.loading)?SKM.loadHold-(this.time-S.at):0;S.ld=w>0?w:0;if(!(S.ld>0))S.t-=d;for(const u of this.units)if(u.input)u.input={...u.input,forward:0,side:0,fire:false};if(S.t<=0){S.ph='live';S.t=0;}}
  super.step(dt);for(const u of this.units)if(!u.alive)u.respawnAt=Infinity;
  if(this.phase==='game'){
   if(S.ph==='wait'){S.t=Math.max(0,SKM.forfeit-(this.time-S.waitAt));if(S.t<=0){const t=[0,1].find(t=>!empty.includes(t));if(t!==undefined){S.sc[t]=Math.max(S.sc[t],SKM.win);S.lw=t;}S.why='forfeit';S.ph='over';this.phase='post';}}
   else if(S.ph==='live'){const a0=this.alive(0),a1=this.alive(1);if(!a0||!a1)this.endRound(a0?0:a1?1:-1);}
   else if(S.ph==='end'){S.t-=d;if(S.t<=0)this.newRound();}}
  this.scores=[...S.sc];}
 snapshot(){const s=super.snapshot(),S=this.skm;s.skm={r:S.r,sc:[...S.sc],win:SKM.win,ph:S.ph,t:Math.max(0,Math.round(S.t*10)/10),lw:S.lw,why:S.why};if(S.ph==='buy'&&S.ld>0)s.skm.ld=Math.max(.1,Math.round(S.ld*10)/10);return s;}
}

// Room factory: the simulation class for a mode id. `five` = Unrated (as before), dm / tdm = Simulation.
export function createSim(world,mode,map,random){
 if(mode==='esc')return new EscalationSimulation(world,'esc',map,random);
 if(mode==='skm')return new SkirmishSimulation(world,'skm',map,random);
 if(SPIKE_VARIANTS.includes(mode))return new VariantSpikeSimulation(world,mode,map,random);
 if(mode==='five')return new SpikeSimulation(world,mode,map,random);
 const sim=new Simulation(world,mode,map,random);if(mode==='tdm')sim.loadoutArmor=true;/* TDM armour by loadout (simulation.js tdmArmor) */return sim;}
export const simMode=sim=>sim?.gm||sim?.mode;
