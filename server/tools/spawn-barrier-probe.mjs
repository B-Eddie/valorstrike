// Spawn wall escape probe (server side): SpikeSimulation in its buy phase (world.blocked = map + vendor/spawn-barriers.cjs
// walls, the buy-phase move-back), real inputs from the spawn side of every wall piece trying to get out. Used by
// test-spawn-barrier-leaks.js (no escape on any map) and tools/spawn-barriers-seal.mjs (grows a wall end until none).
// Runs per piece, from the spawn side (own Valorant buy zone, tools/spawn-zones.json): at points along the piece (every 1.5 m)
// and just past / 1 m past both of its ends, up to 4 s (a run held in place for 1.5 s ends early): a run-up from 4 m and from
// 1.2 m straight in, 45 deg either way, crouch-jump, all with jump spam; and hugging the wall towards each end from 1.5 m / 3 m
// short of it (20 deg into the wall) for 2.5 s, then straight out for 2.5 s, jump spam.
// Out = its path crossed a wall of its own spawn, or it stands more than 1.5 m beyond the nearest wall's line outside its own zone
// (nearest navigation node within 4 m: neutral / enemy, or none).
import {SpikeSimulation} from '../src/spike.js';import {zoneOf} from './spawn-barriers-gen.mjs';
const yaw=(dx,dz)=>Math.atan2(-dx,-dz);/* page / server look: forward = (-sin, -cos) */
export function polylines(SB,key){const R=[];for(const side of ['atk','def'])SB.DATA[key][side].forEach((P,i)=>{const segs=[];for(let k=1;k<P.p.length;k++){const [ax,az]=P.p[k-1],[bx,bz]=P.p[k],len=Math.hypot(bx-ax,bz-az);if(len<1e-6)continue;const tx=(bx-ax)/len,tz=(bz-az)/len;segs.push({ax,az,len,tx,tz,nx:-tz*P.in,nz:tx*P.in});}R.push({side,i,P,segs});});return R;}
// signed distance to a panel polyline (+ = spawn side), by its nearest segment
export function sdist(poly,x,z){let best=null;for(const s of poly.segs){const t=Math.max(0,Math.min(s.len,(x-s.ax)*s.tx+(z-s.az)*s.tz)),px=s.ax+s.tx*t,pz=s.az+s.tz*t,d=Math.hypot(x-px,z-pz);if(!best||d<best.d-1e-9)best={d,sg:(x-px)*s.nx+(z-pz)*s.nz>=0?1:-1};}return best.d*best.sg;}
// signed distance to the nearest of a side's panels (within 6 m; Infinity when none)
export function nearestSd(polys,x,z){let b=Infinity;for(const q of polys){const v=sdist(q,x,z);if(Math.abs(v)<6&&Math.abs(v)<Math.abs(b))b=v;}return b;}
// -> {runs, leaks: [{side, piece (index in SB.pieces(key) of that side), panel, t, din, pat, how, from, at}]}
export function escapes(w,key,SB,o={}){const Z=zoneOf(key,w.nav);if(!Z)throw Error(key+': spawn zones do not match the navigation');const N=w.nav.nodes;
 const zoneAt=(x,z,y,r=1.5)=>{const i=w.near(x,z,y);return i>=0&&Math.hypot(N[i][0]-x,N[i][2]-z)<r?Z[i]:'';};
 const polys=polylines(SB,key),s=new SpikeSimulation(w,'five',key,()=>.5),u=s.add('one');s.add('two');s.start(false);let SEQ=1,runs=0;const leaks=[];
 for(const side of o.sides||['atk','def']){const own=side==='atk'?'A':'D',mine=polys.filter(q=>q.side===side);u.team=side==='atk'?s.atk:1-s.atk;
  // piece -> its panel (polyline) index
  const owner=[];mine.forEach(q=>q.segs.forEach(()=>owner.push(q.i)));
  for(const [pi,p] of SB.pieces(key).filter(q=>q.side===side).entries()){if(o.panels&&!o.panels.includes(owner[pi]))continue;
   const ts=[-1,-.3,p.len+.3,p.len+1];for(let t=.75;t<p.len;t+=1.5)ts.push(t);
   const R=[];for(const t of ts)for(const [pat,din] of [['fj',1.2],['fj',4],['l45j',1.2],['r45j',1.2],['fcj',1.2]])R.push([t,pat,din]);
   for(const [t,g] of [[p.len-3,1],[p.len-1.5,1],[3,-1],[1.5,-1]])if(t>0&&t<p.len)R.push([t,'hug'+(g>0?'+':'-')+'j',.7]);
   for(const [t,pat,din] of R){
    const sx=p.ax+p.tx*t+p.nx*din,sz=p.az+p.tz*t+p.nz*din,gy=w.ground(sx,sz,p.y0+1.4);if(!Number.isFinite(gy)||Math.abs(gy-p.y0)>2.5)continue;if(w.blocked(sx,sz,.42,gy,1.8)||SB.blocked(key,sx,sz,.42,gy,1.8))continue;if(!own.includes(zoneAt(sx,sz,gy)))continue;
    let dx=-p.nx,dz=-p.nz;if(pat.startsWith('l45')){dx=-p.nx*.707-p.tx*.707;dz=-p.nz*.707-p.tz*.707;}if(pat.startsWith('r45')){dx=-p.nx*.707+p.tx*.707;dz=-p.nz*.707+p.tz*.707;}if(pat.startsWith('hug')){const g=pat[3]==='+'?1:-1;dx=p.tx*g*.94-p.nx*.34;dz=p.tz*g*.94-p.nz*.34;}
    Object.assign(u,{x:sx,y:gy,z:sz,vx:0,vz:0,vy:0,alive:true,hp:100,dash:null,loading:false});s.buy=30;
    const j=pat.includes('j'),c=pat.includes('c'),Tmax=pat.startsWith('hug')?5:4;let px=sx,pz=sz,esc=null,hx=sx,hz=sz,ht=0;runs++;
    for(let k=0;k*.05<Tmax;k++){const tt=k*.05;if(tt-ht>=1.5){if(Math.hypot(u.x-hx,u.z-hz)<.1)break;/* held */hx=u.x;hz=u.z;ht=tt;}
     if(pat.startsWith('hug')&&tt>=2.5){dx=-p.nx;dz=-p.nz;}/* along the wall to its end, then out */
     s.command(u,{t:'in',seq:SEQ++,r:yaw(dx,dz),p:0,f:1,s:0,j:j&&(k%8<4)?1:0,c:c?1:0});s.step(.05);
     const cr=SB.crossing(key,px,pz,u.x,u.z,u.y+.5);if(cr&&cr.side===side){esc='crossed';break;}px=u.x;pz=u.z;
     if(k%2===0){const sd=nearestSd(mine,u.x,u.z);if(sd<-1.5){const zz=zoneAt(u.x,u.z,u.y,4);if(!(own+own.toLowerCase()).includes(zz||'?')){esc='out '+(zz||'off-nav')+' '+sd.toFixed(2)+' m past the wall';break;}}}}
    if(esc)leaks.push({side,piece:pi,panel:owner[pi],t:+t.toFixed(2),din,pat,how:esc,from:[sx,gy,sz].map(v=>+v.toFixed(2)),at:[u.x,u.y,u.z].map(v=>+v.toFixed(2))});}}}
 return {runs,leaks};}
// Wall height / foot: the highest floor a player can reach beside a panel (a 0.25 m flood from the doorway floor with jump-up
// rises of up to 1.3 m, within 3.5 m of the wall, map collision only) -> the top must be above a jump from it (feet at the
// apex 1.165 m + 0.6 m margin); the foot at most 0.3 m over the doorway floor (a crouched body still meets it).
export const JUMP=1.165,MARGIN=.6;
export function heights(w,key,SB,blocked=(x,z,r,y,h)=>w.blocked(x,z,r,y,h)){const out=[];const S=.25,RISE=1.3,BAND=3.5;
 for(const q of polylines(SB,key)){const P=q.P;let top=-1e9,low=1e9;const seen=new Set(),Q=[],kf=(x,z)=>Math.round(x/S)+','+Math.round(z/S);
  for(const s of q.segs)for(let t=0;t<=s.len+1e-9;t+=S)for(const off of [-.6,.6]){const x=s.ax+s.tx*t+s.nx*off,z=s.az+s.tz*t+s.nz*off,g=w.ground(x,z,P.y[0]+1);if(!Number.isFinite(g)||g<P.y[0]-1.5||g>P.y[0]+1.5)continue;low=Math.min(low,g);if(blocked(x,z,.3,g,1.2))continue;const k=kf(x,z);if(!seen.has(k)){seen.add(k);Q.push([x,z,g]);}}
  for(let n=0;n<Q.length&&n<60000;n++){const [x,z,y]=Q[n];top=Math.max(top,y);for(const [dx,dz] of [[S,0],[-S,0],[0,S],[0,-S]]){const nx=x+dx,nz=z+dz,k=kf(nx,nz);if(seen.has(k))continue;if(Math.abs(sdist(q,nx,nz))>BAND)continue;const g=w.ground(nx,nz,y+RISE);if(!(g<=y+RISE+.01&&g>y-3))continue;if(blocked(nx,nz,.3,g,1.2))continue;seen.add(k);Q.push([nx,nz,g]);}}
  out.push({side:q.side,panel:q.i,y:P.y,floor:low,reach:top,needTop:top+JUMP+MARGIN,okTop:P.y[1]>=top+JUMP+MARGIN,okFoot:!Number.isFinite(low)||P.y[0]<=low+.3});}
 return out;}
