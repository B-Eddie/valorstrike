// Spike Rush Powerup Orbs (wiki.playvalorant.com/en-us/Spike_Rush "Mechanics" + "Powerup Orbs", fetched 2026-10-28; raw copy
// /workspace/work/qa/parity/src/Spike_Rush.txt). "Five of the effects are randomly chosen (with Ultimate Ability orb always being
// chosen) before the game starts"; "Either Crippling Decay or Paranoia orb will be selected before the game starts and the orb only
// spawns once per round"; 1-5 orbs a round; "Capturing any powerup orb grants the agent one point towards" the ultimate. Effects:
//  ult      Ultimate Ability: full ultimate charge.
//  amp      Damage Amp: +30 % damage dealt for the round (gun damage here; ability damage is not amplified - noted in the audit).
//  regen    Health Regen: the player and every ally heal 10 HP/s for 20 s while out of combat.
//  decay    Crippling Decay: after 3 s every enemy takes a fixed 50 HP decay for 8 s.
//  paranoia Paranoia: after 3 s every enemy has reduced vision (Nearsight here) for 8 s (decoy audio / minimap: not built).
//  stim     Combat Stim: a beacon at the capture point granting Combat Stim (fire rate, equip, reload, recovery) to nearby allies
//           (movement speed and jump height: not built).
//  upgrade  Weapon Upgrade: a weapon of the next round's set; round 3 / Endgame an Operator or Odin; with an Operator, a random sidearm.
// Not built and kept out of the draw: Golden Gun (a new weapon), Tracer Rounds (penetration x2 + reveal), Twin Hunters (wolves).
// Inferred (unpublished): out of combat = no damage taken and no shot fired for 3 s; the decay cannot kill (stops at 1 HP) and is
// given back when the 8 s end; the Stim beacon covers 6 m for 12 s at the Empress strength (x1.1, simulation.js STIM); orb spots stay
// random nav nodes (modes.js srRound; the map's fixed spots are not published).
import {weapons,reserveOf} from './simulation.js';
import {SIDEARMS} from './floor.js';
export const SR_PW=Object.freeze({amp:Object.freeze({k:1.3}),regen:Object.freeze({rate:10,life:20,calm:3}),decay:Object.freeze({delay:3,life:8,hp:50}),paranoia:Object.freeze({delay:3,life:8}),stim:Object.freeze({radius:6,life:12})});
export const SR_POOL=Object.freeze(['stim','amp','regen','upgrade']);/* built random picks (plus ult and decay / paranoia) */
export const SR_NAMES=Object.freeze({ult:'Ultimate',amp:'Damage Amp',regen:'Health Regen',decay:'Crippling Decay',paranoia:'Paranoia',stim:'Combat Stim',upgrade:'Weapon Upgrade'});
export function srPickSet(random){const pool=[...SR_POOL],set=['ult',random()<.5?'decay':'paranoia'];while(set.length<5&&pool.length)set.push(pool.splice(Math.floor(random()*pool.length),1)[0]);return set;}
// A round's orb types: each from the game's set, Decay / Paranoia at most once.
export function srOrbTypes(set,n,random){const out=[];for(let i=0;i<n;i++){const ok=set.filter(t=>!((t==='decay'||t==='paranoia')&&out.includes(t)));out.push(ok[Math.floor(random()*ok.length)]);}return out;}
const sideOf=w=>SIDEARMS.has?SIDEARMS.has(w):SIDEARMS.includes(w);
function give(sim,u,w){const g=weapons[w];if(!g)return;const side=sideOf(w);if(side)u.secondary=w;else u.primary=w;u.inventory={...(u.inventory||{}),[w]:g.magazineSize};u.reserves={...(u.reserves||{}),[w]:reserveOf(w)};u.reloadAt=0;u.weapon=w;u.ammo=g.magazineSize;u.reserve=reserveOf(w);u.fireAt=sim.time+(g.equipTimeSeconds||0);u.equipAt=u.fireAt;}
// Capture effects (the +1 ult point / full ult is applied by the caller).
export function srEffect(sim,u,type,o,loadouts){const t=sim.time,P=SR_PW;
 if(type==='amp')u.srAmp=sim.round;
 else if(type==='regen'){for(const v of sim.units)if(v.team===u.team)v.srRegenUntil=t+P.regen.life;}
 else if(type==='decay'||type==='paranoia')(sim.srPending||(sim.srPending=[])).push({type,team:u.team,at:t+P[type].delay});
 else if(type==='stim')(sim.srBeacons||(sim.srBeacons=[])).push({x:o.x,y:o.y,z:o.z,team:u.team,until:t+P.stim.life});
 else if(type==='upgrade'){const li=sim.srLi??0,cur=u.weapon;let w;if(li>=2){if(cur==='Operator'){const S=[...SIDEARMS].filter(x=>x!=='Classic'&&x!==u.secondary);w=S[Math.floor(sim.random()*S.length)]||'Sheriff';}else w=sim.random()<.5?'Operator':'Odin';}else{const L=loadouts[li+1].w;w=L[Math.floor(sim.random()*L.length)];}give(sim,u,w);}}
// Per tick: scheduled Decay / Paranoia, the decay given back, Health Regen out of combat, Stim beacons.
export function srTick(sim,dt){const t=sim.time,P=SR_PW;
 for(const e of (sim.srPending||[]).splice(0)){if(e.at>t){sim.srPending.push(e);continue;}for(const v of sim.units){if(v.team===e.team||!v.alive||v.loading)continue;if(e.type==='paranoia'){v.nearsightUntil=Math.max(v.nearsightUntil||0,t+P.paranoia.life);v.srParaUntil=t+P.paranoia.life;}else{const d=Math.max(0,Math.min(P.decay.hp,v.hp-1));v.hp-=d;v.srDecay={amt:(v.srDecay?.until>t?v.srDecay.amt:0)+d,until:t+P.decay.life};}}}
 for(const v of sim.units){if(v.srDecay&&v.srDecay.until<=t){if(v.alive)v.hp=Math.min(100,v.hp+v.srDecay.amt);v.srDecay=null;}
  if(v.srRegenUntil>t&&v.alive&&v.hp<100&&t-(v.srHit??-1e9)>=P.regen.calm&&t-(v.shotAt??-1e9)>=P.regen.calm)v.hp=Math.min(100,v.hp+P.regen.rate*dt);
  const B=sim.srBeacons||[];v.srStim=v.alive&&B.some(b=>b.until>t&&b.team===v.team&&Math.hypot(v.x-b.x,v.z-b.z)<=P.stim.radius&&Math.abs(v.y-b.y)<3);}
 if(sim.srBeacons)sim.srBeacons=sim.srBeacons.filter(b=>b.until>t);}
export function srReset(sim){sim.srPending=[];sim.srBeacons=[];for(const v of sim.units){v.srAmp=0;v.srRegenUntil=0;v.srStim=false;v.srDecay=null;v.srParaUntil=0;}}
// The unit's active powerups (round state pw): what the page shows.
export function srActive(sim,u){const t=sim.time,a=[];if(u.srAmp===sim.round&&u.srAmp)a.push('amp');if(u.srRegenUntil>t)a.push('regen');if(u.srStim)a.push('stim');if(u.srDecay?.until>t)a.push('decay');if(u.srParaUntil>t)a.push('paranoia');return a;}
