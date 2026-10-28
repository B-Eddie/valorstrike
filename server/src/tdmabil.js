// Team Deathmatch abilities and ultimates (wiki.playvalorant.com/en-us/Team_Deathmatch, fetched 2026-10-28; raw copy
// /workspace/work/qa/parity/src/Team_Deathmatch.txt):
//  - "Players have immediate access to their basic and signature abilities and spent charges will recharge over time, with
//    recharge rates varying depending on the ability" (Abilities: "Ability Cooldowns for Agents in TDM", seconds per use);
//  - "Most agents start the match with one full charge of their signature ability (plus 50% progress on the next charge if
//    their signature has more than one charge available) and 50% progress towards the first charge of their basic abilities";
//  - "Players gain access to their ultimate by charging it up with points gained from kills (3 points) or collecting Ultimate
//    Orbs (10 points)", with a TDM ult cost per agent ("Ultimate Cost for Agents in TDM").
// No buying, no kill-based signature refill (Jett / Phoenix / Raze 2 kills) and no round restock timers: only the TDM cooldowns.
// The page uses the same table (work/game_rules_runtime.js TDMAB, pinned by work/test_tdm_abilities_offline.cjs).
//
// Kit keys are this game's (server/src/kits.json): Phoenix's Hot Hands is Q and Curveball E here; Reyna's Devour (Q) and Dismiss
// (E) share the Q soul charge (abilities.js castAbility0), so her E recharges nothing of its own. sig = the VALORANT signature.
// Points: u.ability.tp (0 .. TDM_ULT cost). The ult the rest of the game reads stays in kit pips (u.ability.ult, 0 .. kits u),
// derived from the points, so every ult check (castAbility0, the page's K().u, HUD pips) works unchanged: full points = full pips.
import kits from './kits.json' with {type:'json'};
export const TDM_CD=Object.freeze({
 Jett:{c:29,q:44,e:44,sig:'e'},Phoenix:{c:48,q:54,e:44,sig:'q'},Sova:{c:51,q:26,e:48,sig:'e'},Sage:{c:94,q:51,e:22,sig:'e'},
 Reyna:{c:51,q:44,sig:'q'},Omen:{c:33,q:73,e:65,sig:'e'},Killjoy:{c:54,q:44,e:36,sig:'e'},Raze:{c:48,q:26,e:58,sig:'e'},
 Skye:{c:65,q:51,e:44,sig:'e'},Breach:{c:58,q:44,e:55,sig:'e'},Cypher:{c:29,q:58,e:22,sig:'e'},Chamber:{c:46,q:9,e:51,sig:'e'}});
export const TDM_ULT=Object.freeze({Jett:60,Phoenix:70,Sova:70,Sage:50,Reyna:80,Omen:60,Killjoy:90,Raze:80,Skye:70,Breach:90,Cypher:50,Chamber:70});
export const TDM_PTS=Object.freeze({kill:3,orb:10});
const K=u=>kits[u.agent]||kits.Jett;
export const tdmMax=(u,k)=>k==='e'?(K(u).mx.e||1):(K(u).mx[k]||0);
export const tdmCost=u=>TDM_ULT[u.agent]||TDM_ULT.Jett;
export const tdmPips=u=>{const A=u.ability,c=tdmCost(u),n=K(u).u;return (A.tp||0)>=c?n:Math.floor((A.tp||0)/c*n);};
// Match start: signature 1 (+50 % of the next when it holds more), basics 0 with 50 % progress, no ult points.
export function tdmAbInit(u){const A=u.ability,T=TDM_CD[u.agent]||TDM_CD.Jett;if(!A)return;A.tdp={};for(const k of ['c','q','e']){if(!(T[k]>0))continue;const mx=tdmMax(u,k);if(!(mx>0))continue;if(k===T.sig){A[k]=1;A.tdp[k]=mx>1?.5:0;}else{A[k]=0;A.tdp[k]=.5;}}
 A.tp=0;A.ult=0;A.rechargeAt=0;A.signatureKills=0;u.tdmKills=u.kills||0;A.tdUlt=0;}
export function tdmAddPoints(u,n){const A=u.ability;if(!A||!(n>0))return;A.tp=Math.min(tdmCost(u),(A.tp||0)+n);A.ult=tdmPips(u);A.tdUlt=A.ult;}
// Per tick, before tickAbilities: an ult cast since the last tick (castAbility0 zeroes ult) spends the points; kills since the
// last tick add 3 each; charges below their cap progress at 1 / cooldown per second; the standard restock and kill refills are off.
export function tdmAbTick(sim,dt){for(const u of sim.units){const A=u.ability;if(!A)continue;if(!A.tdp)tdmAbInit(u);const T=TDM_CD[u.agent]||TDM_CD.Jett;
 if((A.ult||0)<(A.tdUlt||0))A.tp=0;/* the ult was cast */
 const dk=(u.kills||0)-(u.tdmKills??0);u.tdmKills=u.kills||0;if(dk>0)A.tp=Math.min(tdmCost(u),(A.tp||0)+dk*TDM_PTS.kill);
 A.ult=tdmPips(u);A.tdUlt=A.ult;A.rechargeAt=0;A.signatureKills=0;
 for(const k of ['c','q','e']){const cd=T[k];if(!(cd>0))continue;const mx=tdmMax(u,k);if(!((A[k]||0)<mx)){A.tdp[k]=0;continue;}A.tdp[k]=(A.tdp[k]||0)+dt/cd;if(A.tdp[k]>=1){A[k]=Math.min(mx,(A[k]||0)+1);A.tdp[k]=A[k]<mx?A.tdp[k]-1:0;}}}}
