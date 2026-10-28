// Team Deathmatch Recovery Orbs (wiki.playvalorant.com/en-us/Team_Deathmatch "Orbs", fetched 2026-10-28): "Recovery Orbs: Grants a
// 6-second buff that restores Health and Armor or Shield (not including the regeneration pool from Regen Shield) depending on the
// player's loadout. Each Recovery Orb respawns every 30 seconds"; players "run over" an orb and it generates "a zone that allies can
// enter to also receive its effects".
// Published: 6 s buff, 30 s respawn, health + loadout armour (Regen pool untouched), ally zone. Inferred (unpublished, noted in
// work/validation/parity-audit-2026-10-28.md): the restore rate (a full bar over the 6 s: 100 HP and the loadout's armour cap per
// 6 s), the 0.9 m pickup reach, taken only by a hurt player (as the Deathmatch health pack), the zone's 3 m radius and its 6 s life,
// and the spots: Riot's TDM maps (Piazza, District, Kasbah, Drift, Glitch) are not in this game, so each orb sits on the nav node
// nearest a named callout of our maps (TDM_REC_SPOTS; mid and both sides, away from the spawns).
// Real TDM rooms only (createSim('tdm') sets sim.tdmOrbs). TDM Ultimate Orbs: below (TDM_UO).
import {tdmArmor,tdmStage} from './simulation.js';
import {tdmAddPoints,TDM_PTS} from './tdmabil.js';
import {ORB_SPOTS} from './ultorbs.js';
export const TDM_REC=Object.freeze({buff:6,respawn:30,r:.9,dy:1.8,zone:3,zoneLife:6,hpRate:100/6});
export const TDM_REC_SPOTS=Object.freeze({ascent:['Mid Courtyard','Mid Market','A Main','B Main'],bind:['A Short','B Long','A Lobby','B Hall'],haven:['Mid Courtyard','A Long','C Long','B Site'],split:['Mid Bottom','Mid Top','A Main','B Lobby'],lotus:['B Main','A Main','C Main','B Site'],breeze:['Mid Wood Doors','Mid Top','A Shop','B Elbow']});
const armorCap=(sim,u)=>tdmArmor(tdmStage((sim.matchLen||570)-sim.remaining),u.weapon).a;
const hurt=(sim,u)=>u.hp<100||u.armor<armorCap(sim,u);
export function recSpawn(sim){const W=sim.world,calls=W.map?.callouts||[],N=W.nav?.nodes||[];sim.recOrbs=[];sim.recZones=[];
 (TDM_REC_SPOTS[sim.map]||[]).forEach((name,id)=>{const c=calls.find(q=>q.name===name);if(!c?.position)return;const p=c.position,i=W.near?W.near(p[0],p[2],p[1]):-1,q=i>=0&&N[i]?N[i]:p;sim.recOrbs.push({id,x:q[0],y:q[1],z:q[2],readyAt:0});});}
// Per tick (after movement): pickups, zone, the buff's restore.
export function recTick(sim,dt){if(!sim.recOrbs)recSpawn(sim);const O=sim.recOrbs,Z=sim.recZones,t=sim.time;
 for(const o of O){if(o.readyAt>t)continue;for(const u of sim.units){if(!u.alive||u.loading||Math.hypot(u.x-o.x,u.z-o.z)>TDM_REC.r||Math.abs(u.y-o.y)>TDM_REC.dy||!hurt(sim,u))continue;
   o.readyAt=t+TDM_REC.respawn;u.recUntil=t+TDM_REC.buff;Z.push({x:o.x,y:o.y,z:o.z,team:u.team,by:u.id,until:t+TDM_REC.zoneLife});sim.events.push(['rec',u.id,u.name,o.id]);break;}}
 for(let i=Z.length-1;i>=0;i--){const z=Z[i];if(z.until<=t){Z.splice(i,1);continue;}for(const u of sim.units)if(u.alive&&u.team===z.team&&u.id!==z.by&&Math.hypot(u.x-z.x,u.z-z.z)<=TDM_REC.zone&&Math.abs(u.y-z.y)<=TDM_REC.dy)u.recUntil=Math.max(u.recUntil||0,z.until);}
 for(const u of sim.units){if(!(u.recUntil>t))continue;if(!u.alive){u.recUntil=0;continue;}const cap=armorCap(sim,u);
  u.hp=Math.min(100,u.hp+TDM_REC.hpRate*dt);if(u.armor<cap)u.armor=Math.min(cap,u.armor+cap/TDM_REC.buff*dt);}}
// Snapshot rows: tro [[id, x, y, z, seconds until back (0 = up)]], trz [[x, y, z, seconds left, team]].
export const recRows=sim=>(sim.recOrbs||[]).map(o=>[o.id,+o.x.toFixed(2),+o.y.toFixed(2),+o.z.toFixed(2),+Math.max(0,o.readyAt-sim.time).toFixed(1)]);
export const recZoneRows=sim=>(sim.recZones||[]).filter(z=>z.until>sim.time).map(z=>[+z.x.toFixed(2),+z.y.toFixed(2),+z.z.toFixed(2),+(z.until-sim.time).toFixed(1),z.team]);
// TDM Ultimate Orbs (wiki.playvalorant.com/en-us/Team_Deathmatch "Orbs" + /en-us/Orbs, fetched 2026-10-28): "Grants 10 points towards
// the player's ultimate charge"; "All Ultimate Orbs spawn onto the map together periodically"; "fixed timing and placements that players
// can come in contact with to gain 10 points to their ultimate charge for themselves and by generating a zone that allies can enter
// to also receive the same amount of ultimate charge" (contact, no channel). Inferred (unpublished): waves at 30 s then every 60 s,
// spots = the Unrated orb callouts (ultorbs.js ORB_SPOTS, two per map; Riot's TDM maps are not in the game), a 3 m zone for 6 s
// (as the Recovery Orb's) that gives each ally the 10 points once. Real TDM rooms with abilities (tdm.js) only.
export const TDM_UO=Object.freeze({pts:TDM_PTS.orb,first:30,every:60,r:.9,dy:1.8,zone:3,zoneLife:6});
export function tdmUltSpawn(sim){const W=sim.world,calls=W.map?.callouts||[],N=W.nav?.nodes||[];sim.tdmUo=[];sim.tdmUz=[];sim.tdmUoWave=0;
 (ORB_SPOTS[sim.map]||[]).forEach((name,id)=>{const c=calls.find(q=>q.name===name);if(!c?.position)return;const p=c.position,i=W.near?W.near(p[0],p[2],p[1]):-1,q=i>=0&&N[i]?N[i]:p;sim.tdmUo.push({id,x:q[0],y:q[1],z:q[2],up:false});});}
export function tdmUltTick(sim){if(!sim.tdmUo)tdmUltSpawn(sim);const t=sim.time,el=(sim.matchLen||570)-sim.remaining,U=TDM_UO;
 const wave=el<U.first-1e-9?0:1+Math.floor((el-U.first+1e-9)/U.every);if(wave>sim.tdmUoWave){sim.tdmUoWave=wave;for(const o of sim.tdmUo)o.up=true;sim.events.push(['tuo',wave]);}
 for(const o of sim.tdmUo){if(!o.up)continue;for(const u of sim.units){if(!u.alive||u.loading||!u.ability||Math.hypot(u.x-o.x,u.z-o.z)>U.r||Math.abs(u.y-o.y)>U.dy)continue;
   o.up=false;tdmAddPoints(u,U.pts);sim.tdmUz.push({x:o.x,y:o.y,z:o.z,team:u.team,got:new Set([u.id]),until:t+U.zoneLife});sim.events.push(['uorb',u.id,u.name,o.id]);break;}}
 for(let i=sim.tdmUz.length-1;i>=0;i--){const z=sim.tdmUz[i];if(z.until<=t){sim.tdmUz.splice(i,1);continue;}for(const u of sim.units)if(u.alive&&u.ability&&u.team===z.team&&!z.got.has(u.id)&&Math.hypot(u.x-z.x,u.z-z.z)<=U.zone&&Math.abs(u.y-z.y)<=U.dy){z.got.add(u.id);tdmAddPoints(u,U.pts);}}}
// Snapshot rows: tuo [[id, x, y, z, up 1 / 0]], tuz [[x, y, z, seconds left, team]].
export const tdmUltRows=sim=>(sim.tdmUo||[]).map(o=>[o.id,+o.x.toFixed(2),+o.y.toFixed(2),+o.z.toFixed(2),o.up?1:0]);
export const tdmUltZoneRows=sim=>(sim.tdmUz||[]).filter(z=>z.until>sim.time).map(z=>[+z.x.toFixed(2),+z.y.toFixed(2),+z.z.toFixed(2),+(z.until-sim.time).toFixed(1),z.team]);
