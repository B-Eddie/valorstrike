// Weapon skins are cosmetic and free: the server only stores each player's equipped skin id per weapon and relays it
// to the room. It never trusts the client's shape: unknown weapons, ids that weapon does not have (collection not
// covering it, variant out of range), malformed and oversize payloads are rejected whole.
import catalog from './skins.json' with {type:'json'};
export const SKIN_WEAPONS=Object.freeze(catalog.categories.flatMap(([,list])=>list));
// weapon -> Set of valid ids ("collection" for Base, "collection.N" for variant N of that weapon's skin)
export const SKIN_IDS=new Map(SKIN_WEAPONS.map(w=>[w,new Set(catalog.collections.flatMap(c=>Object.hasOwn(c.skins,w)?c.skins[w].ch.map((_,i)=>i?c.id+'.'+i:c.id):[]))]));
export const DEFAULT_SKIN='standard';
export const validSkin=(w,id)=>typeof id==='string'&&id.length<=24&&SKIN_IDS.has(w)&&SKIN_IDS.get(w).has(id);
// Returns the cleaned map (weapon -> skin id, defaults omitted) or null when the payload is not acceptable.
// A single invalid entry rejects the whole message, so a client can never get a partially-applied forged loadout.
export function cleanSkins(m){
 if(!m||typeof m!=='object'||Array.isArray(m))return null;const keys=Object.keys(m);if(keys.length>SKIN_WEAPONS.length)return null;
 const out={};for(const w of keys){if(!SKIN_WEAPONS.includes(w)||!validSkin(w,m[w]))return null;if(m[w]!==DEFAULT_SKIN)out[w]=m[w];}return out;}
