// Ultimate orbs in the Spike modes that VALORANT gives them to (wiki.playvalorant.com/en-us/Orbs, fetched 2026-10-28):
// "Ultimate Orbs are the primary type of orbs ... in Unrated, Competitive, Swiftplay, Replication" (not Spike Rush, which has its
// own powerup orbs, modes.js srRound); "two orbs, each one positioned in passageways just outside the A and B spike sites ...
// Haven and Lotus, where the B Orb is located outside C Site instead"; capture = interact and "channel for 2 seconds whilst they
// hold down the hotkey"; "Once captured, the orb disappears for the rest of the round. They will also disappear when a spike is
// planted or when a round enters its end phase"; one ult point each.
// Riot publishes no coordinates: ORB_SPOTS names the map callout (the map's own callout table, world.map.callouts) of the
// passageway outside each site - an inference from the wiki rule, shared with the offline page (index.html XUO_SPOTS, pinned equal
// by server/test-ult-orbs.js). The orb sits on the nav node nearest that callout.
import {gainUlt} from './abilities.js';
export const ULT_ORB=Object.freeze({cap:2,r:1.6,dy:2,botChance:.2,botRange:45});
export const ORB_SPOTS=Object.freeze({ascent:['A Main','B Main'],bind:['A Short','B Long'],haven:['A Long','C Long'],split:['A Ramps','B Alley'],lotus:['A Main','C Mound'],breeze:['A Shop','B Elbow']});
// The round's orbs: [{id, x, y, z, by: unit id channelling, t: seconds channelled}] (empty when the map has no callout table).
export function ultOrbSpawn(sim){const W=sim.world,calls=W.map?.callouts||[],names=ORB_SPOTS[sim.map]||[],N=W.nav?.nodes||[];sim.ultOrbs=[];
 names.forEach((name,id)=>{const c=calls.find(q=>q.name===name);if(!c?.position)return;const p=c.position,i=W.near?W.near(p[0],p[2],p[1]):-1,q=i>=0&&N[i]?N[i]:p;sim.ultOrbs.push({id,x:q[0],y:q[1],z:q[2],by:null,t:0});});
 for(const u of sim.units){u.orbT=0;u.orbGo=null;u.orbR=-1;}}
// Channelling: Use (F, the orb's interact key; the page sends it as input.use) or the Spike interact held, standing on the ground,
// not firing (= SpikeSimulation.canInteract with either key).
const channelOk=(sim,u)=>{const i=sim.time-(u.inputAt||0)<.3?u.input||{}:{};return u.alive&&!u.loading&&!u.pendingTeleport&&!(u.dismissUntil>sim.time)&&!u.air&&(i.use||i.interact)&&!i.fire&&Math.hypot(u.vx||0,u.vz||0)<.1&&Math.abs(u.vy||0)<.1;};
// Per tick: channel (channelOk; never while the interact goes to the Spike),
// capture at 2 s, all gone once the Spike is planted or the round is over.
export function ultOrbTick(sim,dt){const O=sim.ultOrbs;if(!O?.length)return;
 if(sim.spike?.st==='plant'||sim.roundDelay>0){O.length=0;for(const u of sim.units)u.orbT=0;return;}
 if(sim.buy>0)return;
 for(const o of O){let ch=null;for(const u of sim.units){if(Math.hypot(u.x-o.x,u.z-o.z)<ULT_ORB.r&&Math.abs(u.y-o.y)<ULT_ORB.dy&&channelOk(sim,u)&&!sim.spikeInteract(u)&&(o.by==null||o.by===u.id||!sim.units.some(v=>v.id===o.by&&v.orbT>0))){ch=u;break;}}
  if(!ch){if(o.by!=null){const v=sim.units.find(w=>w.id===o.by);if(v)v.orbT=0;}o.by=null;o.t=0;continue;}
  if(o.by!==ch.id){o.by=ch.id;o.t=0;}o.t+=dt;ch.orbT=o.t;
  if(o.t>=ULT_ORB.cap-1e-9){gainUlt(ch,1);ch.orbT=0;o.done=true;sim.events.push(['uorb',ch.id,ch.name,o.id]);}}
 for(let i=O.length-1;i>=0;i--)if(O[i].done)O.splice(i,1);
 for(const u of sim.units)if(u.orbT>0&&!O.some(o=>o.by===u.id))u.orbT=0;}
// Bots: about one in five walks to the nearest orb within 45 m at the start of the action phase (deterministic per bot and round, no
// draw from the room's random stream), unless it carries the Spike; channels it while no enemy is in sight; an enemy seen or the
// orb gone drops the errand. Returns true (channelling: the bot's input is set), an orb to walk to, or null.
export function ultOrbBot(sim,u){const O=sim.ultOrbs;if(!O?.length||u.human||sim.buy>0)return null;const sp=sim.spike;
 if(u.orbR!==sim.round){u.orbR=sim.round;u.orbGo=null;if(((u.id*7919+sim.round*104729)%100)/100<ULT_ORB.botChance){let best=null,bd=ULT_ORB.botRange;for(const o of O){const d=Math.hypot(o.x-u.x,o.z-u.z);if(d<bd){bd=d;best=o;}}u.orbGo=best?best.id:null;}}
 if(u.orbGo==null)return null;const o=O.find(q=>q.id===u.orbGo);if(!o||sp?.carrier===u.id||sp?.st==='plant'){u.orbGo=null;return null;}
 const eye=[u.x,u.y+1.6-(u.ch||0),u.z];if(sim.units.some(v=>v!==u&&v.alive&&!v.loading&&v.team!==u.team&&Math.hypot(v.x-u.x,v.z-u.z)<55&&sim.canSee(u,v,eye,[v.x,v.y+1.1,v.z]))){u.orbGo=null;return null;}
 if(Math.hypot(u.x-o.x,u.z-o.z)<ULT_ORB.r*.6&&Math.abs(u.y-o.y)<ULT_ORB.dy){u.input={interact:true};u.inputAt=sim.time;return true;}
 return o;}
// Snapshot rows (roundState): uo [[id, x, y, z, channelled 0..1]] (none in the round's end phase or once planted), uoc = this
// player's own channel 0..1.
export const ultOrbRows=sim=>sim.roundDelay>0||sim.spike?.st==='plant'?[]:(sim.ultOrbs||[]).map(o=>[o.id,Math.round(o.x*100)/100,Math.round(o.y*100)/100,Math.round(o.z*100)/100,Math.round(Math.min(1,o.t/ULT_ORB.cap)*100)/100]);
