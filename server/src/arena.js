// Iso Kill Contract pocket arena (wiki.playvalorant.com/en-us/Kill_Contract, fetched 2026-11-03): the ult pulls Iso and
// the caught enemy into a separate arena for the duel. None of the six maps carries arena geometry and the world loader
// ships one map per room, so the arena is analytic - no build step, no assets: a flat platform with perimeter energy
// walls and two cover blocks, placed far outside every map's coordinate range (first cell at x = ARENA_X; simultaneous
// duels stack cells every ARENA_STRIDE on x). arenaWrap routes the world queries a duel touches by position; everything
// inside the match maps reaches the match world untouched.
export const ARENA_X=10000,ARENA_STRIDE=100,ARENA_REACH=5000,ARENA_HALF=15,ARENA_WALL_H=4;
const COVER=[[-6,-5,3,2,1.4],[6,5,3,2,1.4]];/* [cx,cz,w,d,h] cover blocks in local cell coords */
export const inArena=(x,z)=>Math.abs(x)>ARENA_REACH||Math.abs(z)>ARENA_REACH;
export const cellX=x=>ARENA_X+Math.round((x-ARENA_X)/ARENA_STRIDE)*ARENA_STRIDE;
const groundA=(x,z,y)=>Math.abs(x)<=ARENA_HALF&&Math.abs(z)<=ARENA_HALF?0:y-10;/* off the platform: the void (fall rescue respawns) */
const blockedA=(x,z,r,y,h=1.8)=>{if(x-r<-ARENA_HALF||x+r>ARENA_HALF||z-r<-ARENA_HALF||z+r>ARENA_HALF)return true;/* the energy walls */
 for(const[cx,cz,w,d,hh]of COVER)if(y<hh&&y+h>0&&x+r>cx-w/2&&x-r<cx+w/2&&z+r>cz-d/2&&z-r<cz+d/2)return true;return false;};
// Slab tests against the floor, the four walls and the cover blocks; the nearest hit wins. Returns [distance, normal].
function castA(o,d,max){let best=Infinity,norm=null;
 if(Math.abs(d[1])>1e-9){const t=-o[1]/d[1];if(t>1e-6&&t<max){const px=o[0]+d[0]*t,pz=o[2]+d[2]*t;if(Math.abs(px)<=ARENA_HALF&&Math.abs(pz)<=ARENA_HALF){best=t;norm=[0,d[1]>0?-1:1,0];}}}/* the floor, both sides (the world's rays are DoubleSide) */
 for(const a of[0,2])for(const s of[1,-1]){const dd=d[a];if(Math.abs(dd)<1e-9)continue;const t=(s*ARENA_HALF-o[a])/dd;if(t<=1e-6||t>=max)continue;const py=o[1]+d[1]*t,pq=o[2-a]+d[2-a]*t;
  if(py>=0&&py<=ARENA_WALL_H&&Math.abs(pq)<=ARENA_HALF&&t<best){best=t;norm=a===0?[dd>0?-1:1,0,0]:[0,0,dd>0?-1:1];}}
 for(const[cx,cz,w,d2,hh]of COVER){const mn=[cx-w/2,0,cz-d2/2],mx=[cx+w/2,hh,cz+d2/2];let t0=0,t1=max,ni=-1,ok=true;
  for(let a=0;a<3;a++){if(Math.abs(d[a])<1e-9){if(o[a]<mn[a]||o[a]>mx[a]){ok=false;break;}continue;}let ta=(mn[a]-o[a])/d[a],tb=(mx[a]-o[a])/d[a];if(ta>tb){const q=ta;ta=tb;tb=q;}if(ta>t0){t0=ta;ni=a;}if(tb<t1)t1=tb;if(t0>t1){ok=false;break;}}
  if(ok&&ni>=0&&t0>1e-6&&t0<max&&t0<best){best=t0;norm=[0,0,0];norm[ni]=d[ni]>0?-1:1;}}
 return norm?[best,norm]:null;}
export function arenaWrap(w){if(!w||w.arenaWrapped)return w;
 const out=Object.create(null);for(const k of Object.keys(w))out[k]=w[k];out.arenaWrapped=true;
 if(typeof w.ground==='function')out.ground=(x,z,y)=>inArena(x,z)?groundA(x-cellX(x),z,y):w.ground(x,z,y);
 if(typeof w.blocked==='function')out.blocked=(x,z,r,y,h)=>inArena(x,z)?blockedA(x-cellX(x),z,r,y,h):w.blocked(x,z,r,y,h);
 if(typeof w.leash==='function')out.leash=(x,z,y,x0,z0)=>inArena(x,z)||inArena(x0,z0)?true:w.leash(x,z,y,x0,z0);/* the walls bound the cell; there is no nav leash inside */
 if(typeof w.ray==='function')out.ray=(o,d,max=Infinity)=>{if(!inArena(o[0],o[2]))return w.ray(o,d,max);const h=castA([o[0]-cellX(o[0]),o[1],o[2]],d,max);return h?h[0]:Infinity;};
 if(typeof w.rayN==='function')out.rayN=(o,d,max=Infinity)=>{if(!inArena(o[0],o[2]))return w.rayN(o,d,max);const h=castA([o[0]-cellX(o[0]),o[1],o[2]],d,max);return h&&h[0]<=max?{distance:h[0],normal:h[1]}:null;};
 if(typeof w.ceiling==='function')out.ceiling=(x,z,l,h)=>inArena(x,z)?false:w.ceiling(x,z,l,h);/* the cell is open-topped */
 if(typeof w.plantAt==='function')out.plantAt=(x,z)=>inArena(x,z)?'':w.plantAt(x,z);
 return out;}
