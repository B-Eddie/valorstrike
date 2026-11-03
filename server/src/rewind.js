// Server-owned hit history. Rewind hit volumes only; never mutate live actors, objectives,
// collision, protection or damage state. Client clocks are deliberately not trusted.
import {rayHit} from './hitboxes.js';
// frames: history entries kept per unit (one per step); 48 covers keep (.5 s) up to a 60 Hz step (worker.js GameRoom.TICK; 40 Hz
// by default) as 16 did at 20 Hz. minView: the page's interpolation delay floor, 2 snapshots (50 ms at 40 Hz, 35 ms at 60 Hz;
// a 20 Hz room's pages send >= 100).
export const REWIND=Object.freeze({max:.35,keep:.5,frames:48,minView:30,maxView:220});
export function recordHistory(sim){for(const u of sim.units){const h=u.hitHistory||(u.hitHistory=[]),p={t:sim.time,seq:u.seq,alive:u.alive,x:u.x,y:u.y,z:u.z,look:u.look,ch:u.ch||0,vx:u.vx||0,vz:u.vz||0,air:!!u.air};if(h.at(-1)?.t===sim.time)h[h.length-1]=p;else h.push(p);while(h.length>REWIND.frames||h.length>1&&h[1].t<sim.time-REWIND.keep)h.shift();}}
export function shotTime(sim,u){if(!u.human||u.weapon==='Knife')return sim.time;const view=Math.max(REWIND.minView,Math.min(REWIND.maxView,u.viewMs??100)),rtt=Math.max(0,Math.min(1000,u.ping||0));return sim.time-Math.min(REWIND.max,(rtt/2+view)/1000);}
export function historicalPose(u,t){const h=u.hitHistory;if(!h?.length||t>=h.at(-1).t)return u;
 // Do not grant hits before this life existed, across teleports or through stale history.
 if(t<h[0].t)return u;let a=h[0],b=a;for(let i=1;i<h.length;i++){b=h[i];if(b.t>=t)break;a=b;}
 if(!a.alive||!b.alive||a.seq!==u.seq||b.seq!==u.seq||Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>3)return u;
 const k=b.t>a.t?Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))):0,mix=n=>a[n]+(b[n]-a[n])*k;
 return {x:mix('x'),y:mix('y'),z:mix('z'),look:a.look+Math.atan2(Math.sin(b.look-a.look),Math.cos(b.look-a.look))*k,ch:mix('ch'),vx:mix('vx'),vz:mix('vz'),air:k<.5?a.air:b.air};}
export function rewindHit(sim,shooter,target,o,d,max){return rayHit(historicalPose(target,shotTime(sim,shooter)),o,d,max);}
