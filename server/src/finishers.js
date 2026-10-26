// Server-owned, last-opponent gun finishers. Cosmetics never alter damage, revive or round rules.
import {validSkin} from './skins.js';
export function finisherEvent(sim,killer,victim){
 if(sim.mode!=='five'||!killer||!victim||victim.alive||victim.runItBack||killer.team===victim.team||killer.weapon==='Knife'||!validSkin(killer.weapon,killer.skins?.[killer.weapon]))return null;
 const id=killer.skins[killer.weapon],collection=id.split('.')[0];if(collection!=='prime'&&collection!=='blastx')return null;
 if(sim.units.some(u=>u.team===victim.team&&(u.alive||u.runItBack)))return null;
 if(![victim.x,victim.y,victim.z].every(v=>Number.isFinite(v)&&Math.abs(v)<10000))return null;
 const round=sim.round||1,key=round+':'+killer.team;if(sim.finisherRoundsRound!==round){sim.finisherRounds=new Set();sim.finisherRoundsRound=round;}if(sim.finisherRounds.has(key))return null;sim.finisherRounds.add(key);
 const e=['fin',sim.finisherSerial=(sim.finisherSerial||0)+1,killer.id,victim.id,killer.weapon,id,victim.x,victim.y,victim.z,round];sim.events.push(e);return e;
}
