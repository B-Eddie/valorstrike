// Server-authoritative bot personalities. Every bot gets a deterministic seed (its name, id and the map), its own
// random stream, a role profile and per-bot jittered traits, so bots under identical conditions still move,
// aim, peek, route and use utility differently, while the same bot replays identically (stable tests).
export const PROFILE_ORDER=['entry','anchor','lurker','support'];
// Ranges are [min,max]; each bot draws its own value inside them.
export const PROFILES={
 entry:  {react:[.13,.21],aim:[.012,.024],range:[3,9],  strafe:[.55,.9], crouch:.12,jiggle:.1, hold:0,  flank:0,  head:.55,walk:0,  util:[.15,.6]},
 anchor: {react:[.19,.29],aim:[.006,.014],range:[16,32],strafe:[.15,.35],crouch:.55,jiggle:.6, hold:.7, flank:0,  head:.65,walk:.6, util:[.6,1.6]},
 lurker: {react:[.22,.33],aim:[.01,.02],  range:[9,18], strafe:[.3,.6],  crouch:.3, jiggle:.35,hold:.25,flank:1,  head:.45,walk:.85,util:[1,2.5]},
 support:{react:[.21,.31],aim:[.014,.027],range:[11,20],strafe:[.35,.6], crouch:.25,jiggle:.2, hold:.35,flank:.3, head:.35,walk:.3, util:[.4,1.2]}
};
export function hash(s){let h=2166136261>>>0;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
export function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const pick=(r,[a,b])=>a+(b-a)*r();
// Lazily attaches u.persona. Profiles rotate per team (seeded by map) so a team always mixes roles.
export function persona(sim,u){
 if(u.persona)return u.persona;
 const seed=hash(u.name+'|'+u.id+'|'+sim.map),r=rng(seed),slot=sim.units.filter(v=>!v.human&&v.team===u.team&&v.persona).length,role=PROFILE_ORDER[(slot+hash(sim.map+'|'+u.team))%PROFILE_ORDER.length],P=PROFILES[role];
 const strafeTypes=['sine','switch','jiggle'],jig=r()<P.jiggle;
 return u.persona={seed,role,r,
  react:pick(r,P.react),aim:pick(r,P.aim),range:[P.range[0]*(.85+r()*.3),P.range[1]*(.85+r()*.3)],
  strafeAmp:pick(r,P.strafe),strafeFreq:1.1+r()*1.8,strafePhase:r()*Math.PI*2,strafe:jig?'jiggle':strafeTypes[Math.floor(r()*2)],
  crouch:r()<P.crouch,crouchRange:8+r()*10,head:P.head,hold:P.hold,flank:r()<P.flank,walk:r()<P.walk,
  repath:.8+r()*.9,accept:.35+r()*.45,jitter:.15+r()*.5,jitterPhase:r()*Math.PI*2,
  aimF:[.7+r()*1.6,2.1+r()*2.4],aimP:[r()*6.283,r()*6.283,r()*6.283,r()*6.283],util:pick(r,P.util)};
}
// Smoothly varying aim error (radians) that settles while a bot keeps tracking the same engagement.
export function aimError(P,t,engaged){const settle=.35+.65/(1+engaged*1.6),a=P.aimF[0],b=P.aimF[1];return [P.aim*settle*(Math.sin(t*a+P.aimP[0])+.5*Math.sin(t*b+P.aimP[1])),P.aim*.7*settle*(Math.sin(t*a*.83+P.aimP[2])+.5*Math.sin(t*b*1.21+P.aimP[3]))];}
// Lateral input while engaged: sine weave, random direction switches, or jiggle peeks (bursts then pauses).
export function strafe(sim,u,P){
 const t=sim.time;
 if(P.strafe==='sine')return Math.sin(t*P.strafeFreq+P.strafePhase)>0?P.strafeAmp:-P.strafeAmp;
 if(!(t<u.strafeUntil)){
  if(P.strafe==='jiggle'){u.strafeMove=!u.strafeMove;u.strafeDir=u.strafeMove?-(u.strafeDir||1):0;u.strafeUntil=t+(u.strafeMove?.14+P.r()*.18:.25+P.r()*.45);}
  else{u.strafeDir=P.r()<.5?-1:1;u.strafeUntil=t+.35+P.r()*1.1;}
 }
 return (u.strafeDir||0)*(P.strafe==='jiggle'?1:P.strafeAmp);
}
// Lurkers (and some supports) route through a flank waypoint beside the line to their target.
export function flankNode(sim,u,target){
 const W=sim.world,P=u.persona,dx=target.x-u.x,dz=target.z-u.z,len=Math.hypot(dx,dz)||1,side=P.r()<.5?-1:1;let best=-1,score=Infinity;
 const list=W.playable||[];if(!list.length)return -1;
 for(let k=0;k<16;k++){const i=list[Math.floor(P.r()*list.length)],n=W.nav.nodes[i];if(!n)continue;const ox=n[0]-target.x,oz=n[2]-target.z,d=Math.hypot(ox,oz),lateral=(ox*dz-oz*dx)/len*side;if(d<6||d>24||lateral<2)continue;const s=Math.abs(d-14)-lateral*.3;if(s<score){score=s;best=i;}}
 return best;
}
