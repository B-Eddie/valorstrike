// Per-ability windups from wiki.playvalorant.com (agent pages, fetched 2026-10-25), shared by abilities.js / devices.js /
// ults.js and mirrored by the client's XAB_WIND (index.html). Three kinds:
//  - FIRE -> effect (aftershock, flashpoint, faultLine, rollingThunder, curveball, leer): the equip flow's hand release
//    (XAB_REL, client XABT.rel) happens before the cast reaches the server, so the server fuse is the windup minus it (wf).
//  - arm time from placement (trapwire, trademark, blastPack damage, lockdown): counted from the cast.
//  - ult gun equip time (showstopper, tourDeForce): the gun cannot fire until it is up.
export const WINDUP={aftershock:2.2,flashpoint:.5,faultLine:1.1,rollingThunder:1.2,curveball:.6,leer:.4,lockdown:13,trapwire:.7,trademark:2,blastPack:1.5,showstopper:1.4,tourDeForce:2.3};
export const XAB_REL=.2;
export const wf=k=>Math.max(0,Math.round((WINDUP[k]-XAB_REL)*1e6)/1e6);
// Ability unequip + weapon re-equip (qa-34). wiki.playvalorant.com Abilities: "After casting an ability, an agent will reequip
// the last weapon they were using at its normal, fast, or instant equip time, depending on which one each ability utilizes";
// each ability page lists its "Unequip time" (game files) and "Weapon Reequip Speed"; each weapon page its equip time
// Normal / Fast / Instant (fetched 2026-10-26). After an equip-flow cast (the hand release, XAB_REL) the ability is put away
// over UNEQUIP[agent][key] s, then the gun comes back over its Fast time (Instant for Curveball, Leer and Rendezvous); only
// then can it fire. Empress (+10 % equip speed) shortens the re-equip. Mirrored by the client's XAB_UNEQ / XAB_REEQ.
// qa-36: the instant casts too (Jett Cloudburst 0.25 / Tailwind dash 0.2, Reyna Devour 0.5 / Dismiss 0.6; wiki ability pages
// 'Unequip time' (game files) + 'Weapon Reequip Speed: Fast', fetched 2026-10-26): the gun goes down on the press (abilities.js INSTANT_UNEQUIP).
export const UNEQUIP=Object.freeze({Jett:{c:.25,e:.2},Phoenix:{c:.5,q:.7,e:.48},Sova:{c:.7,q:.7,e:.7,x:1},Sage:{c:.7,q:.4,e:.7,x:1},Reyna:{c:.5,q:.5,e:.6},Omen:{c:.7,q:.7,e:.7},Killjoy:{c:.7,q:.75,e:.7,x:.15},Raze:{c:0,q:.7,e:.7},Skye:{e:.85,x:.55},Breach:{c:.7,q:.7,e:.7,x:.4},Cypher:{c:.7,q:.7,e:.7,x:1},Chamber:{c:.7,e:.6}});
export const REEQ_INSTANT=Object.freeze({Phoenix:'e',Reyna:'c',Chamber:'e'});
// weapon -> [Fast, Instant] equip seconds (Normal = weapons.json equipTimeSeconds); Knife = the Melee page.
export const REEQUIP=Object.freeze({Classic:[.45,.15],Shorty:[.45,.15],Frenzy:[.45,.15],Ghost:[.45,.15],Sheriff:[.6,.2],Stinger:[.45,.15],Spectre:[.45,.15],Bucky:[.6,.2],Judge:[.6,.2],Bulldog:[.6,.2],Guardian:[.6,.2],Phantom:[.6,.2],Vandal:[.6,.2],Marshal:[.6,.2],Outlaw:[.6,.2],Operator:[.9,.5],Ares:[.75,.25],Odin:[.75,.25],Knife:[.3,0]});
// seconds from the hand release until the gun can fire again
export const recoverTime=(agent,k,weapon,stim=1)=>{const u=UNEQUIP[agent]&&UNEQUIP[agent][k],r=REEQUIP[weapon]||REEQUIP.Classic,i=(REEQ_INSTANT[agent]||'').includes(k);return Math.round(((u??.7)+r[i?1:0]/(stim||1))*1e6)/1e6;};
