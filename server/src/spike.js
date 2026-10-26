import {finisherEvent} from './finishers.js';
import {reynaState} from './reyna.js';
import {floorReset,floorTick,floorPick,floorDropHeld,floorRows} from './floor.js';
import {Simulation,weapons,reserveOf,armorItem,armorOwned,regenTick,tagMul} from './simulation.js';
import Motor from './motor.cjs';
import kits from './kits.json' with {type:'json'};
import {path} from './path.js';
import {persona,flankNode,plan,spotNear,variedPath,spaceLook,strategy,stageNode,roundTime,botSeed} from './bots.js';
import BotBrain from '../../vendor/bot-brain.cjs';
const BOT_TURN=9,BOT_RUN=5.4;// BOT_RUN: m/s a bot covers on foot (rifle run, 6.75 x 0.8), for post-plant timing// rad/s: a bot turns at most this fast when lining up utility (no instant 180)
import {initAbilities,buyAbility,castAbility,tickAbilities,smokeBlocks,sightClear,types,rewardAbilityKill,gainUlt,barrierBlocked,nearestBarrier,damageBarrier,barrierPoints,SLOW_ORB} from './abilities.js';
// VALORANT round phases (wiki.playvalorant.com/en-us/Unrated): buy phase 30 s, 45 s for the first buy phase of each half and
// of overtime / endgame (rounds 1, 13, 25); post-round phase 7 s.
// VALORANT 1.11 (wiki.playvalorant.com/en-us/Credits): a player who survives a lost round gets 1000 instead of the loss bonus when
// they are an attacker who never planted (time ran out) or a defender alive after the Spike detonated.
export function survivorLoss(sim,u,text){if(!u.alive)return false;if(u.team===sim.atk)return text==='Time ran out';return text==='Spike detonated';}
export const SPIKE_RADIUS=32.5;export const POST_ROUND=7;export function buyPhaseSeconds(round){return round===1||round===13||round===25?45:30;}
const prices={Classic:0,Shorty:300,Frenzy:450,Ghost:500,Sheriff:800,Stinger:1100,Spectre:1600,Bucky:850,Judge:1850,Bulldog:2050,Guardian:2250,Phantom:2900,Vandal:2900,Marshal:950,Outlaw:2400,Operator:4700,Ares:1600,Odin:3200};
import {revealedFor,showstopperFire} from './ults.js';import {nearestDevice,damageDevice,devicePoints,deviceHp,SHOOT,deviceRows} from './devices.js';
import {soulKill,DISMISS} from './reyna.js';
export class SpikeSimulation extends Simulation{
 static LOAD_GRACE=15;
 constructor(...args){super(...args);this.objectiveRoutes=true;this.mode='five';this.round=0;this.atk=0;this.buy=0;this.roundScores=[0,0];this.spike={st:'',carrier:null,x:0,y:0,z:0,t:45,pt:0,dt:0,site:''};this.roundDelay=0;this.losses=[0,0];this.roundEvents=[];this.effects=[];this.effectSeq=0;this.castEvents=[];this.motorFn=Motor.step;this.findPath=path;const base=this.world;this.baseWorld=base;this.world={...base,blocked:(x,z,r,y,h=1.8)=>base.blocked(x,z,r,y,h)||this.effects.some(e=>e.kind==='barrier'&&e.hp>0&&e.until>this.time&&barrierBlocked(e,x,z,r,y,h)),ray:(o,d,max=Infinity)=>{const wall=base.ray(o,d,max),hit=nearestBarrier(this,o,d,Math.min(max,wall));return hit?hit.distance:wall;}};}
 // A joiner who takes a bot's seat (a full room gives one up) also takes over any utility left on the field by a unit
 // no longer in the match on that team, so its kills are still recorded and credited.
 add(...args){const u=super.add(...args);for(const e of this.effects||[])if(e.team===u.team&&!this.units.some(v=>v.id===e.owner))e.owner=u.id;u.credits=this.qaCredits??800;u.primary=null;u.secondary='Classic';u.weapon='Classic';u.ammo=12;u.armor=0;u.rgn=null;u.purchases=[];initAbilities(u,true);if(this.phase==='game')u.alive=false;return u;}
 start(fill=true){super.start(fill);this.roundScores=[0,0];this.round=0;this.atk=0;this.newRound();}
 newRound(){this.round++;for(const u of this.units){u.goalOff=null;u.flankDone=false;u.flankGoal=-1;u.utilAt=0;}if(this.round===13){this.atk=1;this.losses=[0,0];for(const u of this.units){u.credits=this.qaCredits??800;u.primary=null;u.secondary='Classic';u.armor=0;u.rgn=null;}}
 // Overtime (12-12 after 24 rounds; the match goes on until a two-round lead): sides swap every round and everyone starts
 // the round on 5000 credits (weapons and armor kept by survivors, loss streaks reset), as the offline 5v5 plays it.
 if(this.round>=25){this.atk=1-this.atk;this.losses=[0,0];for(const u of this.units)u.credits=5000;}
 floorReset(this);this.effects=[];this.loadPause=0;this.buy=this.qaBuy??buyPhaseSeconds(this.round);this.remaining=100;this.roundDelay=0;for(const u of this.units){const armor=this.round===1?0:u.armor;super.spawn(u);u.armor=armor;if(this.round===1)u.rgn=null;u.rgnAt=0;u.equipAt=0;u.invulnerableUntil=0;u.slowUntil=0;u.blindUntil=0;u.nearsightUntil=0;u.concussUntil=0;u.pendingTeleport=null;u.weapon=u.primary||u.secondary;u.ammo=weapons[u.weapon].magazineSize;u.inventory={[u.weapon]:u.ammo};u.reserve=reserveOf(u.weapon);u.reserves={[u.weapon]:u.reserve};u.purchases=[];initAbilities(u,this.round===1||this.round===13);u.route=null;u.roundKills=0;if(!u.human)this.autoBuy(u);const anchor=u.team===this.atk?this.world.map.attacker:this.world.map.defender,want=[anchor[0]+(u.id%3-1)*1.1,anchor[2]+Math.floor(u.id/3)],candidates=this.world.playable.map(i=>this.world.nav.nodes[i]).filter(p=>Math.abs(p[1]-anchor[1])<1.5&&Math.hypot(p[0]-anchor[0],p[2]-anchor[2])<12&&!this.world.blocked(p[0],p[2],.43,p[1],1.92)).sort((a,b)=>Math.hypot(a[0]-want[0],a[2]-want[1])-Math.hypot(b[0]-want[0],b[2]-want[1])),p=candidates.find(p=>!this.units.some(v=>v!==u&&v.alive&&Math.hypot(v.x-p[0],v.z-p[2])<.9))||candidates[0]||this.world.nav.nodes[this.world.near(anchor[0],anchor[2],anchor[1])];[u.x,u.y,u.z]=p;u.protectedUntil=0;}
 // Overtime: every player starts each overtime round 3 ult points short of their ultimate
 // (wiki.playvalorant.com/en-us/Competitive: every overtime round: 5000 credits and ultimate points "set to being 3 short").
 if(this.round>=25)for(const u of this.units)if(u.ability)u.ability.ult=Math.max(0,(kits[u.agent]||kits.Jett).u-3);
 const carrier=this.units.filter(u=>u.team===this.atk).sort((a,b)=>a.id-b.id)[0];this.spike={st:'carry',carrier:carrier?.id,x:carrier?.x||0,y:carrier?.y||0,z:carrier?.z||0,t:45,pt:0,dt:0,site:Object.keys(this.world.map.sites)[this.round%Object.keys(this.world.map.sites).length]};/* bot attackers: the site comes from the round strategy (seeded, weighted away from recent sites), not round % sites */if(this.units.some(u=>!u.human&&u.team===this.atk))this.spike.site=strategy(this,this.atk).plan.site;this.roundEvents.push({t:'rd'});}
 // Bot buys follow a team economy call for the round (pistol / full / half / force / eco / save from every bot's credits and
 // the loss streak, vendor/bot-brain.cjs) and each bot's own pick inside it (Vandal or Phantom, an Operator for patient
 // players, Judge / Odin on defence, Sheriff / Ghost ecos), so bots no longer all buy the same thing on the same money.
 autoBuy(u){const team=u.team,k=this.round+'|'+team;this.teamCall||(this.teamCall={});this._callK||(this._callK={});
  if(this._callK[team]!==k){this._callK[team]=k;const cr=this.units.filter(v=>!v.human&&v.team===team).map(v=>v.credits);this.teamCall[team]=BotBrain.teamBuy(cr,this.losses[team]||0,this.round,BotBrain.rng(BotBrain.hash(botSeed(this)+'|buy|'+this.map+'|'+k)),12);}
  const P=persona(this,u),b=BotBrain.buyFor(this.teamCall[team],u.credits,P.brain,BotBrain.rng(BotBrain.hash(botSeed(this)+'|'+u.name+'|'+u.id+'|'+k)),team!==this.atk);u.buyCall=this.teamCall[team];
  if(b.armor)this.command(u,{t:'buy',n:b.armor==='heavy'?'Heavy Armor':'Light Armor'});if(b.side)this.command(u,{t:'buy',n:b.side});if(b.weapon)this.command(u,{t:'buy',n:b.weapon});}
 command(u,m){if(m?.t==='blade')return this.fireBlade(u);if(m?.t==='ab')return this.phase==='game'&&this.roundDelay<=0&&castAbility(this,u,m);if(m?.t==='buy'&&String(m.n).startsWith('ab:'))return this.buy>0&&u.alive&&buyAbility(u,String(m.n));if(m?.t==='buy'){if(!(this.buy>0)||!u.alive)return false;const n=String(m.n||''),AR=armorItem(n),armor=AR?AR.a:0,cost=AR?AR.p:prices[n];if(!Number.isFinite(cost)||u.credits<cost||(!armor&&!weapons[n]))return false;if(armor){if(armorOwned(u,n))return false;u.purchases.push({n,cost,armor:u.armor,rgn:u.rgn??null});u.armor=armor;u.rgn=AR.rg??null;u.rgnAt=0;}else{const side=['Classic','Shorty','Frenzy','Ghost','Sheriff'].includes(n),key=side?'secondary':'primary';if(u[key]===n)return false;u.purchases.push({n,cost,key,prior:u[key]});u[key]=n;u.weapon=n;u.ammo=weapons[n].magazineSize;u.inventory[n]=u.ammo;u.reserve=reserveOf(n);u.reserves[n]=u.reserve;}u.credits-=cost;return true;}
 if(m?.t==='sell'){if(!(this.buy>0)||!u.alive||u.loading)return false;const i=u.purchases.findLastIndex(p=>p.n===m.n);if(i<0)return false;const p=u.purchases[i];if(p.ab&&!(u.ability[p.ab]>0))return false;if(u.purchases.slice(i+1).some(q=>p.key?q.key===p.key:!p.ab&&!q.key&&!q.ab))return false;u.purchases.splice(i,1);u.credits=Math.min(9000,u.credits+p.cost);if(p.ab)u.ability[p.ab]--;else if(p.key)u[p.key]=p.prior;else{u.armor=p.armor;u.rgn=p.rgn??null;}u.weapon=u.primary||u.secondary||'Knife';u.ammo=u.inventory[u.weapon]??weapons[u.weapon].magazineSize;u.reserve=u.reserves[u.weapon]??reserveOf(u.weapon);return true;}
 if(m?.t==='equip'){if(!u.alive||typeof m.w!=='string'||!Object.hasOwn(weapons,m.w)||![u.primary,u.secondary,'Knife'].includes(m.w))return false;/* an empty slot is null: equip {w:null} on a sidearm-only round matched it and left the unit holding no weapon (every tick then threw) *//* any time, as the client: the new gun's equip time gates its first shot */if(m.w!==u.weapon){u.reloadAt=0;/* a swap cancels the reload (as the client's swapW): the magazine stays as it was */u.inventory[u.weapon]=u.ammo;u.reserves[u.weapon]=u.reserve;u.weapon=m.w;u.reserve=u.reserves[m.w]??reserveOf(m.w);u.ammo=u.inventory[m.w]??weapons[m.w].magazineSize;u.fireAt=this.time+weapons[m.w].equipTimeSeconds;u.equipAt=u.fireAt;}return true;}
 if(m?.t==='pick')return this.phase==='game'&&floorPick(this,u,Number(m.id));
 if(m?.t==='dropw')return this.phase==='game'&&floorDropHeld(this,u);
 if(m?.t==='drop'&&this.spike.st==='carry'&&this.spike.carrier===u.id&&u.alive&&this.buy<=0){Object.assign(this.spike,{st:'drop',carrier:null,x:u.x,y:u.y,z:u.z,dropper:u.id,pickupAt:this.time+1});return true;}
 const r=super.command(u,m);if(r&&m.t==='in'){u.input.interact=m.h4===1;u.input.cb=m.cb===1;/* Jett: C held steers a Cloudburst in flight */}return r;}
 // A player leaving the room (worker drop) while carrying the spike: during the buy phase or between rounds another
 // attacker is handed it, otherwise it drops where the carrier stood. A leaving defuser stops defusing.
 release(u){const sp=this.spike;if(!sp||!u)return;if(sp.st==='carry'&&sp.carrier===u.id){const next=(this.buy>0||this.roundDelay>0)&&this.units.filter(v=>v!==u&&v.team===this.atk&&v.alive&&!v.loading).sort((a,b)=>a.id-b.id)[0];
  if(next){sp.carrier=next.id;sp.x=next.x;sp.y=next.y;sp.z=next.z;sp.pt=0;}else Object.assign(sp,{st:'drop',carrier:null,x:Number.isFinite(u.x)?u.x:sp.x,y:Number.isFinite(u.y)?u.y:sp.y,z:Number.isFinite(u.z)?u.z:sp.z,pt:0,dropper:null,pickupAt:0});}
  if(sp.defuser===u.id){sp.defuser=null;sp.dt=sp.dt>=3.5?3.5:0;}}
 siteAt(u){if(this.world.plantAt){const name=this.world.plantAt(u.x,u.z)||'',p=this.world.map.sites[name];return p&&Math.abs(u.y-p[1])<2?name:'';}let name='';for(const [k,p]of Object.entries(this.world.map.sites))if(Math.hypot(u.x-p[0],u.z-p[2])<5&&Math.abs(u.y-p[1])<2)name=k;return name;}
 step(dt){if(this.phase!=='game')return;dt=Math.min(.05,Math.max(0,dt));this.time+=dt;this.deathUlts();if(this.roundDelay>0){this.roundDelay-=dt;if(this.roundDelay<=0){if(Math.max(...this.roundScores)>=13&&Math.abs(this.roundScores[0]-this.roundScores[1])>=2){this.phase='post';this.scores=[...this.roundScores];}else this.newRound();}return;}if(this.loadHold(dt))return;if(this.buy>0){if(this.buy<=dt)this.benchLoading();this.buy=Math.max(0,this.buy-dt);for(const u of this.units){if(!u.alive||!u.human||u.loading)continue;const i=this.time-(u.inputAt||0)<.3?u.input:{},c=Math.cos(u.look),sn=Math.sin(u.look),anchor=u.team===this.atk?this.world.map.attacker:this.world.map.defender,old=[u.x,u.y,u.z];this.motor(u,{x:-sn*(i.forward||0)+c*(i.side||0),z:-c*(i.forward||0)-sn*(i.side||0),jump:i.jump,duck:i.duck,walk:i.walk,speed:6.75*weapons[u.weapon].runSpeedMultiplier},dt);this.guard(u);const edge=Math.min(Math.abs(this.world.map.attacker[2]),Math.abs(this.world.map.defender[2]))-7,z=u.team===this.atk?Math.max(edge,u.z):Math.min(-edge,u.z);if(z!==u.z){if(this.world.blocked(u.x,z,.4,u.y,1.8-(u.ch||0)))[u.x,u.y,u.z]=old;else u.z=z;u.vz=0;}}floorTick(this);return;}this.remaining-=dt;tickAbilities(this,dt);
 const shooters=[];for(const u of this.units){if(!u.alive||u.loading)continue;if(u.reloadAt&&this.time>=u.reloadAt){this.finishReload(u);}regenTick(this,u,dt);if(!u.human)this.bot(u);const i=this.time-(u.inputAt||0)<.3?u.input:{},c=Math.cos(u.look),sn=Math.sin(u.look),f=i.forward||0,s=i.side||0,ox=u.x,oz=u.z;this.motor(u,{x:-sn*f+c*s,z:-c*f-sn*s,jump:i.jump,duck:i.duck,walk:i.walk,speed:u.dismissUntil>this.time?DISMISS.speed/* Reyna's Dismiss: 12 m/s top speed (v8.11), intangible - no slow, no tag */:6.75*weapons[u.weapon].runSpeedMultiplier*(i.ads&&!(u.concussUntil>this.time)&&weapons[u.weapon].adsStats?weapons[u.weapon].adsStats.runSpeedMultiplier:1)*(u.slowUntil>this.time?.35:u.orbSlowUntil>this.time?SLOW_ORB.factor:1),hold:i.interact,tag:u.dismissUntil>this.time?1:tagMul(u,this.time)},dt);this.fall(u);this.guard(u);this.unwedge(u,ox,oz,f||s,dt);if(u.y<-20||!Number.isFinite(u.x)||!Number.isFinite(u.y)||!Number.isFinite(u.z)){u.hp=0;u.alive=false;u.deaths++;u.noUltDeaths=(u.noUltDeaths||0)+1;/* a fall: no death ult point */continue;}this.teleport(u);if(this.oobKill(u)){u.oobAt=0;u.hp=0;u.alive=false;u.deaths++;this.events.push(['k','Out of bounds',u.name,0,'Ability']);continue;}if(i.fire)shooters.push(u);}this.fireTick(shooters);
 floorTick(this);
 const sp=this.spike,carrier=this.units.find(u=>u.id===sp.carrier);if(sp.st==='carry'){if(!carrier?.alive){Object.assign(sp,{st:'drop',carrier:null,x:carrier?.x||sp.x,y:carrier?.y||sp.y,z:carrier?.z||sp.z});}else{sp.x=carrier.x;sp.y=carrier.y;sp.z=carrier.z;const site=this.siteAt(carrier),holding=this.canInteract(carrier);if(site&&holding){sp.pt+=dt;if(sp.pt>=4){sp.st='plant';sp.site=site;sp.t=45;sp.dt=0;sp.carrier=null;for(const v of this.units)if(v.team===this.atk)v.credits=Math.min(9000,v.credits+300);/* plant bonus: every attacker, as offline */gainUlt(carrier);this.events.push(['sp',carrier.id,carrier.name,site]);}}else sp.pt=0;}}
 if(sp.st==='drop'){const u=this.units.find(u=>u.team===this.atk&&u.alive&&!u.loading&&(u.id!==sp.dropper||this.time>=sp.pickupAt)&&Math.abs(u.y-sp.y)<2&&Math.hypot(u.x-sp.x,u.z-sp.z)<1.5);if(u){sp.st='carry';sp.carrier=u.id;}}
 if(sp.st==='plant'){sp.t-=dt;const d=this.units.find(u=>u.team!==this.atk&&this.canInteract(u)&&Math.hypot(u.x-sp.x,u.z-sp.z)<2.5&&Math.abs(u.y-sp.y)<2);if(d){if(sp.defuser!=null&&sp.defuser!==d.id)sp.dt=sp.dt>=3.5?3.5:0;sp.defuser=d.id;sp.dt+=dt;}else{sp.dt=sp.dt>=3.5?3.5:0;sp.defuser=null;}if(sp.dt>=7){if(d)gainUlt(d);return this.finishRound(1-this.atk,'Spike defused');}if(sp.t<=0){this.detonate(sp);return this.finishRound(this.atk,'Spike detonated');}}
 const alive=team=>this.units.some(u=>u.team===team&&(u.alive||u.runItBack));if(!alive(1-this.atk))return this.finishRound(this.atk,'Defenders eliminated');if(!alive(this.atk)&&sp.st!=='plant')return this.finishRound(1-this.atk,'Attackers eliminated');if(this.remaining<=0&&sp.st!=='plant')return this.finishRound(1-this.atk,'Time ran out');}
 canInteract(u){return u.alive&&!u.loading&&!u.pendingTeleport&&!(u.dismissUntil>this.time)&&!u.air&&u.input.interact&&!u.input.fire&&this.time-(u.inputAt||0)<.3&&Math.hypot(u.vx||0,u.vz||0)<.1&&Math.abs(u.vy||0)<.1;}
 // Bots cannot see (or shoot) through smokes or Sage barriers; the same target the base bot chose is checked.
 canSee(u,v,o,p){return sightClear(this,o,p);}
 motor(u,input,dt){return this.motorFn(u,input,dt,this.world);}
 // Sage barriers stop bullets (and cannot be wallbanged); shotImpact then damages the barrier the shot ended on.
 // Destroyable utility stops a shot too: the nearest of a Sage barrier and an enemy device (devices.js SHOOT); shotImpact
 // then puts the bullet's body damage on what the shot ended on (a device is removed at 0 HP, a barrier ends at 0).
 traceShot(o,d,max){const wall=this.baseWorld.ray(o,d,max),barrier=nearestBarrier(this,o,d,Math.min(max,wall)),lim=barrier?barrier.distance:wall,dv=nearestDevice(this,o,d,Math.min(max,lim),this.shotBy);this.shotBlockedBy=dv?dv.effect.kind:barrier?'barrier':null;/* the device kind ('boombot', 'turret' ...) */return dv?dv.distance:lim;}
 shotImpact(o,d,distance,weapon){const range=weapon.damageRanges.find(r=>distance>=r.rangeStartMeters&&distance<r.rangeEndMeters)||weapon.damageRanges.at(-1);
  if(this.shotBlockedBy&&this.shotBlockedBy!=='barrier'){const h=nearestDevice(this,o,d,distance+.001,this.shotBy);if(h)damageDevice(this,h.effect,range.bodyDamage);return;}
  const barrier=nearestBarrier(this,o,d,distance+.001);if(!barrier||Math.abs(barrier.distance-distance)>.002)return;damageBarrier(this,barrier.effect,barrier.seg,range.bodyDamage);}/* the segment it hit (BARRIER: 4 x 400 -> 600) */

 onGunKill(killer,victim){finisherEvent(this,killer,victim);}
 fireBlade(u){const A=u.ability;if(this.phase!=='game'||this.buy>0||this.roundDelay>0||u.agent!=='Jett'||!A?.bladesActive||A.blades<1)return false;const weapon=u.weapon,ammo=u.ammo,kills=u.kills;u.weapon='Blade Storm';u.ammo=A.blades;try{const fired=this.fire(u);if(fired){A.blades=this.lastKills>0?5:u.ammo;A.bladesActive=A.blades>0;}return fired;}finally{u.weapon=weapon;u.ammo=ammo;}}
 // A Phoenix killed inside Run It Back is not a kill or a death in VALORANT (no kill / death on the scoreboard, no ult point
 // either side, no signature recharge): the soul orb (Reyna, patch 1.02) and the Blade Storm refresh (Jett, patch 1.02) still trigger.
 // The 200 kill credits are kept: no source says they are withheld.
 fire(u){if(this.buy>0||this.roundDelay>0||u.detainUntil>this.time)return false;u.shotAt=this.time;/* heard by bots (botSense) */if(u.showstopper){const r=showstopperFire(this,u);if(r!==undefined)return r;}const before=u.kills,living=this.units.filter(v=>v.alive),r=super.fire(u);this.lastKills=0;if(u.kills>before){for(const v of living)if(!v.alive){this.lastKills++;if(v.runItBack){u.kills--;v.deaths--;this.scores[u.team]=(this.scores[u.team]||0)-1;u.credits=Math.min(9000,u.credits+200);soulKill(this,u,v);continue;}u.credits=Math.min(9000,u.credits+200);u.roundKills++;rewardAbilityKill(u,this,v);}}return r;}
 // A human leaving mid-round: the bot taking the seat takes over their body (alive where they stood, health, loadout,
 // credits, abilities) instead of sitting the round out dead, which cost the team a player for every disconnect.
 // The leaver's live utility (turret, Nanoswarm, Boom Bot, Lockdown windup, Showstopper rocket ...) now belongs to the seat
 // bot, alive or not: before, its owner id pointed at a removed unit, so its kills went unrecorded (no kill event, no
 // score, no credits or ult point). Active ult/device state (Tour de Force, Headhunter, Run It Back) and status effects
 // move with the body, so a disconnect neither strands a free Operator nor shakes off a detain.
 takeOver(b,u){if(!b||!u||b.team!==u.team)return false;for(const e of this.effects||[])if(e.owner===u.id)e.owner=b.id;
  if(this.phase!=='game'||!u.alive||u.loading)return false;for(const k of ['x','y','z','look','pitch','hp','armor','rgn','rgnAt','weapon','ammo','reserve','primary','secondary','credits','ch','ultWeapon','showstopper','headhunter','runItBack','detainUntil','slowUntil','concussUntil','blindUntil','nearsightUntil','vulnerableUntil','revealedUntil','tetheredUntil','tether','invulnerableUntil','tagUntil','tagSoft'])if(u[k]!==undefined)b[k]=u[k];
  b.inventory={...u.inventory};b.reserves={...u.reserves};b.ability={...u.ability};b.purchases=[];b.vx=b.vy=b.vz=0;b.alive=true;b.reloadAt=0;b.route=null;b.safe=b.anchor=null;b.seq++;return true;}
 // A human still loading holds the buy phase only briefly: at most LOAD_GRACE s per player since their load began and
 // LOAD_GRACE s per round in total, and only while they are in the round (alive) and the round has not started. Joiners
 // mid-game are already out for the round (add), so they never hold it. When the buy phase ends with someone still
 // loading, they sit the round out as dead (spectating once loaded) and come back next round.
 loadHold(dt){const t=this.time;let hold=false;for(const u of this.units){if(!u.human||!u.loading){u.loadSince=null;continue;}if(u.loadSince==null)u.loadSince=t-dt;if(u.alive&&this.buy>0&&t-u.loadSince<SpikeSimulation.LOAD_GRACE)hold=true;}
  if(hold&&(this.loadPause||0)<SpikeSimulation.LOAD_GRACE){this.loadPause=(this.loadPause||0)+dt;return true;}return false;}
 benchLoading(){for(const u of this.units)if(u.human&&u.loading&&u.alive){this.release(u);u.alive=false;u.hp=0;}}
 // +1 ult point per death to an enemy (gun or utility; not a fall, fall damage, the Spike or a teamkill: u.noUltDeaths), once each, before a half-time reset can run: the server
 // counted kills only, so online ults charged slower than offline (where deaths, plants and defuses count too).
 deathUlts(){for(const u of this.units){const n=(u.deaths||0)-(u.noUltDeaths||0);if(n>(u.ultDeaths??0))gainUlt(u,n-(u.ultDeaths??0));u.ultDeaths=n;}}
 // VALORANT: the detonation's expanding sphere instantly kills every player it reaches, either team
 // (wiki.playvalorant.com/en-us/Spike, Countdown and Detonation); outer radius 3250 uu = 32.5 m (valorant.gs/rules, game data).
 // No kill credit and no death ult point (the Spike is not an enemy agent: wiki.playvalorant.com/en-us/Unrated, an ult point
 // for being "killed by an enemy agent"); the dead lose their gear in finishRound.
 detonate(sp){for(const u of this.units){if(!u.alive||u.loading||Math.hypot(u.x-sp.x,(u.y||0)-(sp.y||0),u.z-sp.z)>SPIKE_RADIUS)continue;u.hp=0;u.alive=false;/* not a death (wiki Spike, patch 1.11: dying to the Spike no longer counts in KDA), so no ult point either */this.events.push(['k','',u.name,0,'Spike']);}}
 finishRound(winner,text){if(this.roundDelay>0)return;this.roundScores[winner]++;this.losses[winner]=0;this.losses[1-winner]++;for(const u of this.units){u.credits=Math.min(9000,u.credits+(u.team===winner?3000:survivorLoss(this,u,text)?1000:Math.min(2900,1900+(this.losses[u.team]-1)*500)));if(!u.alive&&!u.runItBack){/* a Phoenix inside Run It Back is coming back: he keeps his gear */u.primary=null;u.secondary='Classic';u.armor=0;u.rgn=null;}}this.roundDelay=POST_ROUND;this.roundEvents.push({t:'re',w:winner===0?1:0,tx:text,sc:[...this.roundScores],o:Math.max(...this.roundScores)>=13&&Math.abs(this.roundScores[0]-this.roundScores[1])>=2?1:0});}
 bot(u){const sp=this.spike,W=this.world;let goal=null;this.botSense();if(u.team===this.atk){if(sp.st==='carry'&&sp.carrier===u.id){const p=(!u.human&&this.plantGoal(u))||W.map.sites[sp.site];goal=p;if(this.siteAt(u)&&this.plantNow(u,p)){u.input={interact:true};u.inputAt=this.time;return;}}else if(sp.st==='drop')goal=[sp.x,sp.y,sp.z];else if(sp.st==='plant')goal=[sp.x+(u.id%3-1)*5,sp.y,sp.z+5];else goal=W.map.sites[sp.site];}else goal=sp.st==='plant'?[sp.x,sp.y,sp.z]:W.map.sites[Object.keys(W.map.sites)[u.id%Object.keys(W.map.sites).length]];
 // Variety: the round strategy's staged positions (defaults, fakes, lurks, splits, aggressive defenders), spread spots,
 // rotations on information, staggered starts (u.spread: the goal is already a spread nav spot, so no extra offset)
 u.spread=false;const carrier=sp.st==='carry'&&sp.carrier===u.id,loose0=!(sp.st==='drop'&&u.team===this.atk)&&!carrier;let loose=loose0;
 if(!u.human&&(sp.st==='carry'||sp.st==='plant'||sp.st==='')){const L=plan(this,u),N=W.nav.nodes,atk=u.team===this.atk;
  if(atk&&sp.st==='plant'){const k=sp.x+','+sp.z;if(L.post0!==k){L.post0=k;L.post=this.postNode(u,L,false);L.hide=null;}
   const pp=L.postAct=BotBrain.postPlay(persona(this,u).brain,{left:sp.t,defusing:sp.defuser!=null,dt:sp.dt,eta:Math.hypot(u.x-sp.x,u.z-sp.z)*1.25/BOT_RUN});
   if(pp==='stop')goal=[sp.x,sp.y,sp.z];/* a defuse that can still finish: go stop it */
   else if(pp==='hide'){if(L.hide==null)L.hide=this.postNode(u,L,true);if(L.hide>=0){goal=N[L.hide];u.spread=true;}}/* the fuse beats any defuse: out of sight */
   else if(L.post>=0){goal=N[L.post];u.spread=true;}}
  else if(!atk&&sp.st==='plant'){const R=this.retakeCall(u,L);/* retake vs save, group up, then ninja / stick / tap / clear on the Spike */
   if(R.act==='save'||R.act==='wait'){const k=R.act+'|'+sp.x+','+sp.z;if(L.holdK!==k){L.holdK=k;const dx=u.x-sp.x,dz=u.z-sp.z,l=Math.hypot(dx,dz)||1,want=R.act==='save'?Math.max(l,22):14;L.holdN=l>=want-1?W.near(u.x,u.z,u.y):W.near(sp.x+dx/l*want,sp.z+dz/l*want,u.y);}if(L.holdN>=0){goal=N[L.holdN];u.spread=true;}}else if(R.act!=='clear')loose=false;/* retake: walk onto the Spike itself */}
  else if(sp.st!=='plant'){if(L.go==null)L.go=this.time+L.delay;
   const rt=roundTime(this);let stage=null;for(const g of L.stages)if(rt<g.until){stage=g;break;}
   let site=atk?sp.site:L.site;const info=this.atkInfo&&this.atkInfo.round===this.round?this.atkInfo:null;
   if(!atk&&info&&L.role.rotator&&info.site!==L.site&&this.time>=info.at+(L.rotDelay??(L.rotDelay=1+L.rand()*3))){site=info.site;stage=null;} // defenders rotate on information
   if(stage){const i=stageNode(this,u,stage,this.findPath);if(i>=0){goal=N[i];u.spread=true;loose=true;site=null;}}
   if(site&&!carrier&&W.map.sites[site]){if(L.spotSite!==site){L.spotSite=site;L.spot=spotNear(this,u,W.map.sites[site],'spot',atk?{rMin:1.5,rMax:7,gap:3}:L.role.offAngle?{rMin:6,rMax:14,gap:4}:{rMin:2,rMax:10,gap:4});}if(L.spot>=0){goal=N[L.spot];u.spread=true;}}}}
 if(u.team!==this.atk&&sp.st==='plant'&&Math.hypot(u.x-sp.x,u.z-sp.z)<2&&this.defuseNow(u)){u.input={interact:true};u.inputAt=this.time;return;}
 if(u.blindUntil>this.time||u.concussUntil>this.time||u.nearsightUntil>this.time){/* bots have no nearsight model: held like a blinded bot, as offline (b.blind) */u.input={};u.inputAt=this.time;return;}const route=u.route,routeAt=u.routeAt;u.route=null;super.bot(u);const combat=u.input.fire||u.sawTarget;if(!combat){u.route=route;u.routeAt=routeAt;}if(combat)return;
 if(this.shootUtility(u,goal))return;/* no enemy in sight: shoot down enemy utility in the way (Boom Bot, Turret, Alarmbot, Trademark, Trapwire, Nanoswarm; a Sage Barrier across its way) */
 if(this.planUtility(u))return;/* lining up plan utility (smoke / flash / recon before the entry, post-plant mollies, defender delay) */
 // reactions: trade / fall back after a teammate dies, hold or push a sound (not the carrier, not a late retake)
 const R=u.react;if(R&&R.until>this.time&&!carrier&&!(sp.st==='drop'&&u.team===this.atk)&&!(sp.st==='plant'&&u.team!==this.atk&&sp.t<15)){
  if(R.kind==='hold'){u.input=R.duck?{duck:true}:{};u.look=BotBrain.turnStep(persona(this,u).brain,u.look||0,Math.atan2(u.x-R.x,u.z-R.z),.05).yaw;/* turns onto the angle at its own turn rate */u.inputAt=this.time;return;}
  goal=[R.x,R.y,R.z];u.spread=true;loose=true;}
 if(u.plan&&u.plan.round===this.round&&this.time<u.plan.go&&!carrier){u.input={};u.inputAt=this.time;return;}/* staggered start */
 if(goal){const target={x:goal[0],y:goal[1],z:goal[2]};this.goalPath(u,target,loose);if(u.plan&&u.plan.walk&&u.input&&u.input.forward&&!carrier&&roundTime(this)<70)u.input.walk=true;} }
 // ---- Bots shoot down destroyable enemy utility (vendor/bot-brain.cjs shootUtility; offline index.html xUtilShoot) ----
 // Candidates: live enemy devices (devices.js SHOOT: aim point = the device / nearer Trapwire anchor, needs sightClear) and
 // enemy Sage barriers (aim at the wall's middle, needs a clear map line; blocking = the wall stands across the bot's way
 // within 14 m: the straight line to its goal or its route). Aims at its own turn rate and fires the gun it holds (real
 // bullets: traceShot / shotImpact take the HP off); reloads when empty. u.utilShot names what it is shooting (tests).
 barrierAcross(u,e,goal){const pts=[[u.x,u.z]];if(goal)pts.push([goal[0],goal[2]]);const N=this.world.nav.nodes,R=u.route;
  const lines=[pts];if(R&&R.length){let k=0,best=Infinity;R.forEach((n,i)=>{const q=N[n];if(!q)return;const d=Math.hypot(q[0]-u.x,q[2]-u.z);if(d<best){best=d;k=i;}});const l=[[u.x,u.z]];for(let i=k;i<R.length&&l.length<8;i++){const q=N[R[i]];if(q)l.push([q[0],q[2]]);}lines.push(l);}
  for(const l of lines){let left=14;for(let i=1;i<l.length&&left>0;i++){const [ax,az]=l[i-1],[bx,bz]=l[i],len=Math.hypot(bx-ax,bz-az);if(len<1e-6)continue;const run=Math.min(len,left);for(let t=0;t<=run;t+=.25){const x=ax+(bx-ax)*t/len,z=az+(bz-az)*t/len;if(barrierBlocked(e,x,z,.4,u.y,1.8))return true;}left-=run;}}return false;}
 shootUtility(u,goal){if(u.human||this.buy>0||this.roundDelay>0||this.phase!=='game'){u.utilShot=null;return false;}const Wp=weapons[u.weapon];if(!Wp||u.weapon==='Knife'||Wp.abilityOnly){u.utilShot=null;return false;}
  const eye=[u.x,u.y+1.6-(u.ch||0),u.z],c=[];
  for(const e of this.effects){if(e.team===u.team||!(e.until>=this.time))continue;
   if(e.kind==='barrier'){if(!(e.hp>0))continue;const pt=barrierPoints(e).sort((a,b)=>Math.hypot(a[0]-eye[0],a[2]-eye[2])-Math.hypot(b[0]-eye[0],b[2]-eye[2]))[0]||[e.p[0],e.p[1]+1.5,e.p[2]],d=Math.hypot(pt[0]-eye[0],pt[2]-eye[2]);/* the nearest live segment */if(d>16)continue;const q=pt.map((n,i)=>n-eye[i]),l=Math.hypot(...q);c.push({kind:'barrier',d,los:this.baseWorld.ray(eye,q.map(n=>n/l),Math.max(0,l-.4))===Infinity,blocking:this.barrierAcross(u,e,goal),e,pt});continue;}
   if(!SHOOT[e.kind]||!(deviceHp(e)>0))continue;let pt=null,d=Infinity;for(const q of devicePoints(e)){const dd=Math.hypot(q[0]-eye[0],q[1]-eye[1],q[2]-eye[2]);if(dd<d){d=dd;pt=q;}}if(!pt||d>32)continue;
   if(e.kind==='turret'&&this.time<(e.at||0)&&d>12)continue;/* a turret still deploying far away is not a threat yet */
   c.push({kind:e.kind,d,los:sightClear(this,eye,pt),blocking:false,e,pt});}
  const pick=BotBrain.shootUtility(c);if(!pick){u.utilShot=null;return false;}
  const P=persona(this,u),dx=pick.pt[0]-eye[0],dz=pick.pt[2]-eye[2],h=Math.hypot(dx,dz)||1e-6,bdt=Math.min(.1,Math.max(.02,this.time-(u.utilT??(this.time-.05))||.05));u.utilT=this.time;
  const ts=BotBrain.turnStep(P.brain,u.look||0,Math.atan2(-dx,-dz),bdt);u.look=ts.yaw;u.pitch=Math.atan2(pick.pt[1]-eye[1],h);
  const size=pick.kind==='barrier'?1.2:(SHOOT[pick.kind]?.r||.3),aligned=Math.abs(ts.left)<Math.max(.03,Math.atan2(size,h)*.8);
  u.input={};u.inputAt=this.time;if(u.ammo<=0){if(!u.reloadAt)this.command(u,{t:'reload'});}else if(aligned&&!u.reloadAt){u.input.fire=true;if(Wp.fireMode==='EWeaponFireModeDisplayType::SemiAutomatic'&&this.time>=(u.fireAt||0))u.triggerHeld=false;}
  u.utilShot={id:pick.e.id,kind:pick.kind,at:this.time};return true;}
 // ---- Spike play (vendor/bot-brain.cjs plantSpot / postPlant / postPlay / retake) ----
 // The carrier's plant spot this round: default (near the centre), safe (toward the attackers' entrance) or open (toward the
 // defenders' side), the nearest plantable nav node (shrunk toward the centre until it is inside the plant zone).
 plantGoal(u){const sp=this.spike,W=this.world,L=plan(this,u),c=W.map.sites[sp.site];if(!c)return null;if(L.plantSite===sp.site)return L.plantP;L.plantSite=sp.site;L.plantP=null;
  const r=BotBrain.rng(BotBrain.hash('plant|'+sp.site+'|'+this.round+'|'+u.team+'|'+botSeed(this))),Q=BotBrain.plantSpot(r,persona(this,u).brain),to=Q.kind==='safe'?W.map.attacker:Q.kind==='open'?W.map.defender:null;
  let dx,dz;if(to){dx=to[0]-c[0];dz=to[2]-c[2];}else{const a=r()*Math.PI*2;dx=Math.cos(a);dz=Math.sin(a);}const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  for(const f of [1,.7,.4,0]){const x=c[0]+(dx*Q.r-dz*Q.side*1.5)*f,z=c[2]+(dz*Q.r+dx*Q.side*1.5)*f,n=W.nav.nodes[W.near(x,z,c[1])];if(n&&this.siteAt({x:n[0],y:n[1],z:n[2]})===sp.site){L.plantP=[n[0],n[1],n[2]];L.plantKind=f?Q.kind:'default';break;}}
  const G=this.plantLog||(this.plantLog=[]);if(L.plantP&&!G.some(e=>e.round===this.round&&e.team===u.team)){G.push({round:this.round,team:u.team,site:sp.site,kind:L.plantKind,p:[...L.plantP]});if(G.length>200)G.shift();}
  return L.plantP;}
 // Plant once on the spot, or after 3 s inside the site (spot unreachable / contested), or when time is short or a fight is on.
 plantNow(u,p){if(u.human)return true;const L=plan(this,u);if(L.inSite==null)L.inSite=this.time;return !L.plantP||Math.hypot(p[0]-u.x,p[2]-u.z)<1.6||this.time-L.inSite>3||this.remaining<15||!!u.sawTarget;}
 // Post-plant spot: this bot's crossfire slot (angle around the Spike from its attackers' side, close or far), the nav node
 // near it that sees the Spike; far=true: a hiding spot 15 m out (no sight needed). Falls back to any spread spot.
 postNode(u,L,far){const sp=this.spike,W=this.world,S=strategy(this,u.team),key=this.round+'|'+sp.x+','+sp.z;
  if(!S.post||S.post.k!==key)S.post={k:key,slots:BotBrain.postPlant(S.members.length,BotBrain.rng(BotBrain.hash('post|'+key+'|'+u.team+'|'+botSeed(this))))};
  const i=Math.max(0,S.members.findIndex(v=>v.id===u.id)),q=S.post.slots[i%Math.max(1,S.post.slots.length)]||{ang:0,r:7,far:false},A=W.map.attacker;
  let bx=A[0]-sp.x,bz=A[2]-sp.z;const bl=Math.hypot(bx,bz)||1;bx/=bl;bz/=bl;const ca=Math.cos(q.ang),sa=Math.sin(q.ang),dx=bx*ca-bz*sa,dz=bx*sa+bz*ca,r=far?15:q.r,pt=[sp.x+dx*r,sp.y,sp.z+dz*r];
  const sees=i2=>{const n=W.nav.nodes[i2];return this.canSee(u,null,[n[0],n[1]+1.5,n[2]],[sp.x,sp.y+.5,sp.z]);};
  let k=spotNear(this,u,pt,far?'hideN':'post',far?{rMin:0,rMax:5,gap:2}:{rMin:0,rMax:3.5,gap:2.5,also:sees});if(k<0&&!far)k=spotNear(this,u,[sp.x,sp.y,sp.z],'post',{rMin:3,rMax:9,gap:3.5,also:sees});if(k<0&&!far)k=spotNear(this,u,[sp.x,sp.y,sp.z],'post',{rMin:3,rMax:9,gap:3.5});
  if(!far){L.postSlot=q;(this.postLog||(this.postLog=[])).push({round:this.round,id:u.id,ang:q.ang,r:q.r,far:q.far,node:k});if(this.postLog.length>400)this.postLog.shift();}
  return k;}
 // A defender after the plant: BotBrain.retake on what this bot knows (fuse, its own travel time, half kept, numbers, mates
 // around it, attackers seen / shooting near the Spike in the last 3 s); re-thought every 0.5 s.
 retakeCall(u,L){const sp=this.spike;if(L.ret&&this.time<L.retAt)return L.ret;const U=this.units,R=L.retR||(L.retR=BotBrain.rng(BotBrain.hash('ret|'+u.name+'|'+u.id+'|'+this.round+'|'+botSeed(this))));
  let mates=0,enemies=0,grouped=0;for(const v of U){if(!v.alive)continue;if(v.team===u.team){mates++;if(v!==u&&Math.hypot(v.x-u.x,v.z-u.z)<12)grouped++;}else enemies++;}
  for(const e of U){if(!e.alive||e.team===u.team||Math.hypot(e.x-sp.x,e.z-sp.z)>12)continue;if(e.shotAt>this.time-3||U.some(m=>m.alive&&m.team===u.team&&m.sawTarget&&m.aimTarget===e.id)){L.seenAt=this.time;break;}}
  const dist=Math.hypot(u.x-sp.x,u.z-sp.z),c=BotBrain.retake(persona(this,u).brain,R,{left:sp.t,eta:dist*1.25/BOT_RUN,half:sp.dt>=3.5,mates,enemies,grouped,seen:this.time-(L.seenAt??-1e9)<3,at:dist<2,tapped:!!L.tapped});
  if(c.style==='tap'&&L.tapAt==null)L.tapAt=this.time;L.ret=c;L.retAt=this.time+.5;(this.retakeLog||(this.retakeLog=[])).push({round:this.round,id:u.id,t:+sp.t.toFixed(2),act:c.act,style:c.style});if(this.retakeLog.length>400)this.retakeLog.shift();return c;}
 // On the Spike: ninja / stick hold the defuse; a tap defuses 0.8 s then lets go 1.2 s once (baiting a peek); clear fights first.
 defuseNow(u){const L=u.plan;if(u.human||!L||L.round!==this.round)return true;const c=this.retakeCall(u,L);if(c.act==='save'||c.act==='clear')return false;
  if(c.style==='tap'||L.tapAt!=null&&!L.tapped){const e=this.time-(L.tapAt??this.time);if(e<.8)return true;if(e<2)return false;L.tapped=true;L.ret=null;}return true;}
 // Once per tick: what the bots perceive. Deaths (teammates react: trade the killer, fall back or hold), sounds (gunshots
 // within 35 m, running footsteps within 16 m: hold the angle, glance or push) and defender information (attackers seen
 // or heard near a site: rotators rotate there after their own delay).
 botSense(){if(this._senseT===this.time)return;this._senseT=this.time;const U=this.units,sites=this.world.map.sites,names=Object.keys(sites);
  for(const d of U){const was=d._wasAlive;d._wasAlive=d.alive;if(!(was&&!d.alive))continue;let k=null,kd=Infinity;for(const e of U)if(e.alive&&e.team!==d.team){const q=Math.hypot(e.x-d.x,e.z-d.z);if(q<kd){kd=q;k=e;}}
   const alive=U.filter(v=>v.alive&&v.team===d.team).length;
   for(const m of U){if(!m.alive||m.human||m.team!==d.team||m.sawTarget)continue;const dist=Math.hypot(m.x-d.x,m.z-d.z),P=persona(this,m),c=BotBrain.onMateDeath(P.brain,P.r,dist,alive);if(c==='hold'||!k)continue;
    if(c==='trade')m.react={kind:'trade',x:k.x,y:k.y,z:k.z,until:this.time+2.5+P.r()*1.5};
    else{const dx=m.x-k.x,dz=m.z-k.z,l=Math.hypot(dx,dz)||1,n=this.world.nav.nodes[this.world.near(m.x+dx/l*6,m.z+dz/l*6,m.y)];if(n)m.react={kind:'fallback',x:n[0],y:n[1],z:n[2],until:this.time+1.5+P.r()*1.5};}}}
  for(const m of U){if(!m.alive||m.human||m.sawTarget||(m.react&&m.react.until>this.time))continue;let best=null,bd=Infinity;
   for(const e of U){if(!e.alive||e.team===m.team)continue;const dist=Math.hypot(e.x-m.x,e.z-m.z),shot=e.shotAt>this.time-.12&&dist<35,run=!shot&&dist<16&&Math.hypot(e.vx||0,e.vz||0)>4.5&&!(e.input&&(e.input.walk||e.input.duck));if((shot||run)&&dist<bd){bd=dist;best={e,kind:shot?'shot':'step',dist};}}
   if(!best||m.heardAt>this.time-1.5)continue;m.heardAt=this.time;const P=persona(this,m),c=BotBrain.onSound(P.brain,P.r,best.kind,best.dist),e=best.e;
   if(c==='push')m.react={kind:'push',x:e.x,y:e.y,z:e.z,until:this.time+2+P.r()};else m.react={kind:'hold',x:e.x,z:e.z,duck:P.r()<.25,until:this.time+(c==='hold'?.6+P.brain.patience*1.2:.25+P.r()*.25)};
   if(m.team!==this.atk&&this.spike.st!=='plant')for(const n of names){const c2=sites[n];if(Math.hypot(e.x-c2[0],e.z-c2[2])<16){this.siteInfo(n,e);break;}}}
  if(this.spike.st!=='plant')for(const m of U)if(m.alive&&m.team!==this.atk&&m.sawTarget){const e=U.find(v=>v.id===m.aimTarget);if(e)for(const n of names){const c2=sites[n];if(Math.hypot(e.x-c2[0],e.z-c2[2])<16){this.siteInfo(n,e);break;}}}}
 siteInfo(n,e){const I=this.atkInfo;if(!I||I.round!==this.round||(I.site!==n&&this.time>I.at+6))this.atkInfo={site:n,at:this.time,round:this.round};const J=this.atkInfo;if(J.site===n&&e){J.x=e.x;J.y=e.y;J.z=e.z;J.seen=this.time;}}
 // Persona-driven objective movement: own spot inside the site, own repath/accept/lateral jitter, lurker flanks,
 // walking near the objective for quiet roles. loose=false keeps exact goals (spike pickup, defuse).
 goalPath(u,target,loose=true){const W=this.world,P=persona(this,u);if(loose&&!u.goalOff)u.goalOff=[(P.r()-.5)*6,(P.r()-.5)*6];const o=loose&&!u.spread?u.goalOff:[0,0],gx=target.x+o[0],gz=target.z+o[1];
  if(!u.route||u.goalAt<this.time){let goal=W.near(gx,gz,target.y);if(loose&&P.flank&&!u.flankDone&&Math.hypot(gx-u.x,gz-u.z)>15){const f=flankNode(this,u,{x:gx,y:target.y,z:gz});if(f>=0){goal=f;u.flankGoal=f;}}u.route=loose?variedPath(this,u,W.near(u.x,u.z,u.y),goal,this.findPath):this.findPath(W,W.near(u.x,u.z,u.y),goal);u.goalAt=this.time+P.repath;}
  if(u.flankGoal>=0){const n=W.nav.nodes[u.flankGoal];if(!n||Math.hypot(n[0]-u.x,n[2]-u.z)<1.5){u.flankDone=true;u.flankGoal=-1;u.route=null;u.goalAt=0;}}
  while(u.route&&u.route.length>1&&Math.hypot(W.nav.nodes[u.route[0]][0]-u.x,W.nav.nodes[u.route[0]][2]-u.z)<P.accept)u.route.shift();const p=u.route&&W.nav.nodes[u.route[0]];u.inputAt=this.time;
  if(p){const far=Math.hypot(gx-u.x,gz-u.z),tx=p[0]-u.x,tz=p[2]-u.z,l=Math.hypot(tx,tz)||1,j=loose&&far>3?P.jitter*Math.sin((u.route[0]||0)*1.7+P.jitterPhase):0;u.look=Math.atan2(u.x-(p[0]-tz/l*j),u.z-(p[2]+tx/l*j));if(far>2.5)spaceLook(this,u);/* The goal itself can lie off the nav graph (a loose offset into a wall or onto another floor): standing on the route's last node is arrival, not a reason to keep walking into the wall. Exact goals (spike) step straight at the goal from there. */const arrived=u.route.length<=1&&Math.hypot(tx,tz)<P.accept;if(arrived&&!loose)u.look=Math.atan2(u.x-gx,u.z-gz);u.input={forward:far>(loose?1.2:1)&&!(arrived&&loose)?1:0,walk:P.walk&&far<20};}
  // No progress while walking (a prop edge, a corner, another unit): repath, then the shared probed escape (botEscape).
  if(u.input?.forward&&u.goalPos&&Math.hypot(u.x-u.goalPos[0],u.z-u.goalPos[1])<.01)u.goalStuck=(u.goalStuck||0)+.05;else u.goalStuck=0;u.goalPos=[u.x,u.z];
  if(u.goalStuck>1||u.escapeUntil>this.time){if(u.goalStuck>1&&u.goalStuck<1.06){u.route=null;u.goalAt=0;}if(this.botEscape(u,u.goalStuck))u.goalAt=0;}this.botProgress(u);}
 // Plan utility (vendor/bot-brain.cjs utility()): attackers smoke / flash / recon the site before the execute (only when the
 // plan said utility first; lurkers stay quiet), the fake group throws its utility at the fake site, post-plant mollies /
 // traps on the Spike when a defender comes for it, defenders delay a push on their site and flash / recon a retake.
 // Casts go through the same command(ab) / castAbility as every other cast (charges, values, effects unchanged); the bot
 // stops and turns (turn-rate limited) to line the throw up, aimed at the furthest point of its own nav path toward the
 // target it can see within the ability's reach, at the floor there.
 planUtility(u){const A=u.ability;if(u.human||!A||this.buy>0||this.roundDelay>0||this.phase!=='game'||!(this.time>=(u.putilAt||0)))return false;
  const sp=this.spike,W=this.world,sites=W.map.sites;if(!(sp.st==='carry'||sp.st==='plant'||sp.st==='drop'))return false;
  const L=plan(this,u),S=strategy(this,u.team),atk=u.team===this.atk,planted=sp.st==='plant',P=persona(this,u),U=L.util||(L.util={used:0,rand:BotBrain.rng(BotBrain.hash('util|'+u.name+'|'+u.id+'|'+this.round+'|'+botSeed(this)))});
  const d2=c=>c?Math.hypot(c[0]-u.x,c[2]-u.z):Infinity,site=atk?sites[sp.site]:sites[L.site],info=!atk&&this.atkInfo&&this.atkInfo.round===this.round&&this.atkInfo.site===L.site&&this.time-this.atkInfo.at<8?this.atkInfo:null;
  let threat=null;if(atk&&planted)for(const e of this.units){if(!e.alive||e.team===u.team||Math.hypot(e.x-sp.x,e.z-sp.z)>12)continue;if(sp.defuser===e.id||e.shotAt>this.time-1||Math.hypot(e.vx||0,e.vz||0)>4.5||this.units.some(m=>m.alive&&m.team===u.team&&m.sawTarget&&m.aimTarget===e.id)){threat=e;break;}}
  const call=BotBrain.utility(P.brain,{atk,plan:S.plan,role:L.role,rt:roundTime(this),siteDist:d2(site),otherDist:d2(sites[S.plan.other]),planted,spikeDist:Math.hypot(sp.x-u.x,sp.z-u.z),threat:!!threat,info:!!info,used:U.used});
  if(!call){u.putilAt=this.time+.4+U.rand()*.4;u.castAim=null;return false;}
  const ty=types[u.agent]||[];let k=null,kind=null;for(const w of call.want){const i=ty.indexOf(w);if(i>=0&&A['cqe'[i]]>0&&!(this.time<(A.cool['cqe'[i]]||0))){k='cqe'[i];kind=w;break;}}
  if(!k){u.putilAt=this.time+1.5+U.rand();u.castAim=null;return false;}
  const goal=call.aim==='spike'?[sp.x,sp.y,sp.z]:call.aim==='other'?sites[S.plan.other]:call.aim==='info'?(info.x!=null?[info.x,info.y,info.z]:site):site;if(!goal){u.putilAt=this.time+1;return false;}
  const reach=kind==='smoke'&&u.agent==='Omen'?40:kind==='recon'||kind==='shock'?(u.agent==='Cypher'?20:40):kind==='drone'?20:13;
  if(!u.castAim||u.castAim.k!==k||this.time>u.castAim.until){const p=this.utilAim(u,goal,reach);if(!p){u.putilAt=this.time+.8+U.rand()*.6;return false;}u.castAim={k,kind,p,phase:call.phase,until:this.time+1.2};}
  const p=u.castAim.p,eye=u.y+1.6-(u.ch||0),dx=p[0]-u.x,dz=p[2]-u.z,want=Math.atan2(-dx,-dz),dl=Math.atan2(Math.sin(want-(u.look||0)),Math.cos(want-(u.look||0)));
  u.inputAt=this.time;u.input={};u.pitch=Math.max(-.7,Math.min(.6,Math.atan2(p[1]-eye,Math.hypot(dx,dz)||1)));
  if(Math.abs(dl)>.12){u.look=(u.look||0)+Math.sign(dl)*Math.min(Math.abs(dl),BOT_TURN*.05);return true;}/* turning to line it up */
  u.look=want;const ok=this.command(u,{t:'ab',k});u.castAim=null;
  if(ok){U.used++;u.utilAt=Math.max(u.utilAt||0,this.time+3);u.putilAt=this.time+1.2+U.rand()*1.8;(this.utilLog||(this.utilLog=[])).push({round:this.round,t:roundTime(this),id:u.id,team:u.team,atk,phase:call.phase,kind,k,agent:u.agent,p:[...p]});if(this.utilLog.length>400)this.utilLog.shift();}
  else u.putilAt=this.time+1+U.rand();
  return ok;}
 // Where to throw: the furthest node of the bot's own path toward goal that it can see and that is within reach, at the
 // floor (a smoke / molly lands there, a flash pops there); the goal itself when it is in sight and in reach.
 utilAim(u,goal,reach){const W=this.world,N=W.nav.nodes,eye=[u.x,u.y+1.6-(u.ch||0),u.z],vis=q=>this.canSee(u,null,eye,[q[0],q[1]+.4,q[2]]);
  if(Math.hypot(goal[0]-u.x,goal[2]-u.z)<=reach&&vis(goal))return [goal[0],goal[1]+.1,goal[2]];
  const path=this.findPath(W,W.near(u.x,u.z,u.y),W.near(goal[0],goal[2],goal[1]));if(!path||path.length<2)return null;let best=null;
  for(const i of path){const n=N[i],d=Math.hypot(n[0]-u.x,n[2]-u.z);if(d>reach)break;if(d>3&&vis(n))best=n;}
  return best?[best[0],best[1]+.1,best[2]]:null;}
 // Utility on each bot's own timing and role: entries open with flashes/mobility, supports smoke/heal, anchors slow/trap.
 botUtility(u,target,dist,P,engaged){const A=u.ability;if(!A||this.buy>0||this.roundDelay>0||engaged<P.util||this.time<(u.utilAt||0))return;const ty=types[u.agent]||[],want=P.role==='entry'?['flash','dash','updraft']:P.role==='support'?['smoke','flash','slow','heal']:P.role==='anchor'?['slow','trap','fire','turret','smoke']:['flash','smoke','recon'];for(const w of want){const i=ty.indexOf(w);if(i<0)continue;const k='cqe'[i];if(A[k]>0&&this.command(u,{t:'ab',k})){u.utilAt=this.time+4+P.r()*6;return;}}u.utilAt=this.time+1+P.r();}
 snapshot(){return {...super.snapshot(),fw:floorRows(this),fx:[...this.effects.filter(e=>e.kind==='barrier'&&e.hp>0&&e.until>this.time).map(e=>({id:e.id,kind:e.kind,p:e.p,yaw:e.yaw,hp:e.hp,seg:e.seg})),/* Jett Cloudburst: the projectile (s 0) then its smoke (s 1, p = centre, tl = seconds left) */...this.effects.filter(e=>(e.kind==='cloudburst'||e.kind==='smoke'&&e.cb)&&e.until>this.time).map(e=>e.kind==='cloudburst'?{id:e.id,kind:'cb',o:e.owner,p:e.p.map(n=>Math.round(n*100)/100),s:0}:{id:e.id,kind:'cb',o:e.owner,p:e.c.map(n=>Math.round(n*100)/100),s:1,tl:Math.round((e.until-this.time)*100)/100}),/* Turret / Alarmbot / Trapwire / Trademark / Blast Pack / Spycam / Owl Drone bodies (devices.js deviceRows) */...deviceRows(this)]};}
 roundState(u){const s=this.spike,mine=u.team===this.atk,visible=mine||s.st==='plant';return {t:'rs',tm:this.time,b:this.buy,bl:this.buy>0&&Array.isArray(u.purchases)?u.purchases.map(p=>p.n):undefined,ld:[u.primary,u.secondary],tw:u.ultWeapon||u.headhunter?u.weapon:null,tl:this.remaining,sc:this.roundScores,atk:this.atk===0?1:0,me:u.credits,ab:u.ability,reyna:u.agent==='Reyna'?reynaState(this,u):null,channel:u.pendingTeleport?{kind:u.pendingTeleport.kind,remaining:Math.max(0,u.pendingTeleport.at-this.time)}:null,status:{concuss:Math.max(0,(u.concussUntil||0)-this.time),blind:Math.max(0,(u.blindUntil||0)-this.time),nearsight:Math.max(0,(u.nearsightUntil||0)-this.time),slow:Math.max(0,(u.slowUntil||0)-this.time),oslow:Math.max(0,(u.orbSlowUntil||0)-this.time),detain:Math.max(0,(u.detainUntil||0)-this.time),vulnerable:Math.max(0,(u.vulnerableUntil||0)-this.time),tether:Math.max(0,(u.tetheredUntil||0)-this.time),ssr:u.showstopper?Math.max(0,u.showstopper.ready-this.time):0,ssu:u.showstopper?Math.max(0,u.showstopper.until-this.time):0/* Showstopper launcher: equip left, window left (the page's launcher follows the server clock) */},rv:revealedFor(this,u),cr:Object.fromEntries(this.units.filter(v=>v.team===u.team).map(v=>[v.name,v.credits])),sp:[s.st,visible?s.carrier??-1:-1,visible?s.x:0,visible?s.z:0,s.t,s.dt,mine?s.pt:0,visible?s.site:'',s.st==='plant'?1:0]};}
}
