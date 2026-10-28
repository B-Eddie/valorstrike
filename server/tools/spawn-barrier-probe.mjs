// Spawn wall escape probe (server side): SpikeSimulation in its buy phase (world.blocked = map + vendor/spawn-barriers.cjs
// walls, the buy-phase move-back), real inputs from the spawn side of every wall piece trying to get out. Used by
// test-spawn-barrier-leaks.js (no escape on any map) and tools/spawn-barriers-seal.mjs (grows a wall end until none).
// Runs per piece, from the spawn side (own Valorant buy zone, tools/spawn-zones.json): at points along the piece (every 1.5 m)
// and just past / 1 m past both of its ends, up to 4 s (a run held in place for 1.5 s ends early): a run-up from 4 m and from
// 1.2 m straight in, 45 deg either way, crouch-jump, all with jump spam; and hugging the wall towards each end from 1.5 m / 3 m
// short of it (20 deg into the wall) for 2.5 s, then straight out for 2.5 s, jump spam.
// Out = its path crossed a wall of its own spawn, or it stands more than 1.5 m beyond the nearest wall's line outside its own zone
// (nearest navigation node within 4 m: neutral / enemy, or none).
import {SpikeSimulation} from '../src/spike.js';import Motor from '../src/motor.cjs';import {zoneOf} from './spawn-barriers-gen.mjs';
const yaw=(dx,dz)=>Math.atan2(-dx,-dz);/* page / server look: forward = (-sin, -cos) */
export function polylines(SB,key){const R=[];for(const side of ['atk','def'])SB.DATA[key][side].forEach((P,i)=>{const segs=[];for(let k=1;k<P.p.length;k++){const [ax,az]=P.p[k-1],[bx,bz]=P.p[k],len=Math.hypot(bx-ax,bz-az);if(len<1e-6)continue;const tx=(bx-ax)/len,tz=(bz-az)/len;segs.push({ax,az,len,tx,tz,nx:-tz*P.in,nz:tx*P.in});}R.push({side,i,P,segs});});return R;}
// signed distance to a panel polyline (+ = spawn side), by its nearest segment
export function sdist(poly,x,z){let best=null;for(const s of poly.segs){const t=Math.max(0,Math.min(s.len,(x-s.ax)*s.tx+(z-s.az)*s.tz)),px=s.ax+s.tx*t,pz=s.az+s.tz*t,d=Math.hypot(x-px,z-pz);if(!best||d<best.d-1e-9)best={d,sg:(x-px)*s.nx+(z-pz)*s.nz>=0?1:-1};}return best.d*best.sg;}
// signed distance to the nearest of a side's panels (within 6 m; Infinity when none)
export function nearestSd(polys,x,z){let b=Infinity;for(const q of polys){const v=sdist(q,x,z);if(Math.abs(v)<6&&Math.abs(v)<Math.abs(b))b=v;}return b;}
// -> {runs, leaks: [{side, piece (index in SB.pieces(key) of that side), panel, t, din, pat, how, from, at}]}
export function escapes(w,key,SB,o={}){const Z=zoneOf(key,w.nav);if(!Z)throw Error(key+': spawn zones do not match the navigation');const N=w.nav.nodes;
 const zoneAt=(x,z,y,r=1.5)=>{const i=w.near(x,z,y);return i>=0&&Math.hypot(N[i][0]-x,N[i][2]-z)<r?Z[i]:'';};
 const polys=polylines(SB,key),s=new SpikeSimulation(w,'five',key,()=>.5),u=s.add('one');s.add('two');s.start(false);let SEQ=1,runs=0;const leaks=[],NL=nearLevel(N,w.nav.valid);
 for(const side of o.sides||['atk','def']){const own=side==='atk'?'A':'D',mine=polys.filter(q=>q.side===side);u.team=side==='atk'?s.atk:1-s.atk;
  // piece -> its panel (polyline) index
  const owner=[];mine.forEach(q=>q.segs.forEach(()=>owner.push(q.i)));
  for(const [pi,p] of SB.pieces(key).filter(q=>q.side===side).entries()){if(o.panels&&!o.panels.includes(owner[pi]))continue;
   const ts=[-1,-.3,p.len+.3,p.len+1];for(let t=.75;t<p.len;t+=1.5)ts.push(t);
   const R=[];for(const t of ts)for(const [pat,din] of [['fj',1.2],['fj',4],['l45j',1.2],['r45j',1.2],['fcj',1.2]])R.push([t,pat,din]);
   for(const [t,g] of [[p.len-3,1],[p.len-1.5,1],[3,-1],[1.5,-1]])if(t>0&&t<p.len)R.push([t,'hug'+(g>0?'+':'-')+'j',.7]);
   for(const [t,pat,din] of R)for(const qy of [1.4,3.4]){/* from the floor over the foot, and one 3.4 m up: a foot lowered to a trench / lower layer (Bind attackers' east door: 5.69 under its 8.9 m doorway) still gets runs from the doorway floor */
    const sx=p.ax+p.tx*t+p.nx*din,sz=p.az+p.tz*t+p.nz*din,gy=w.ground(sx,sz,p.y0+qy);if(!Number.isFinite(gy)||gy<p.y0-2.5||gy>p.y0+4)continue;if(qy>2&&Math.abs(gy-w.ground(sx,sz,p.y0+1.4))<.5)continue;/* the same floor */if(w.blocked(sx,sz,.42,gy,1.8)||SB.blocked(key,sx,sz,.42,gy,1.8))continue;if(!own.includes(zoneAt(sx,sz,gy)))continue;if(w.leash&&!w.leash(sx,sz,gy))continue;{const j=NL(sx,sz,gy);if(w.allowed&&(j<0||!w.allowed.has(j)||Math.hypot(N[j][0]-sx,N[j][2]-sz)>1.2||Math.abs(N[j][1]-gy)>.6))continue;}/* barrier-3: a start a player can stand on (the playable floor, on the leash; not Bind's off-graph layer under a lowered foot) */
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
// Reach flood (barrier-3; user: "Make barriers higher in buy phase, I can jump past one in Haven"): every place a player can
// get to from inside its own spawn zone with the walls up, by walking, stepping / jumping up onto anything up to RISE_UP
// (a jump's 1.165 m apex + a crouch tuck), dropping off any ledge (stairs, boxes, trenches, the floor under a platform),
// crouched (1.35 m body: a gap under a wall's foot counts), inside the map's playable leash. Seeds: every node of the own
// zone (upper case) within SEED m of one of the side's walls. A cell is OUT when the nearest navigation node (1.5 m) belongs
// to the neutral area / the other team's zone and the cell stands more than 1.5 m past the nearest own wall's line (or the
// node is upper case neutral / enemy: > 2 m inside it). -> {cells, leaks: [{side, at:[x,y,z], zone, sd, from:[x,y,z]}]}
// blocked(x,z,r,y,h) defaults to map + spawn walls (the buy phase); pass the page's own for the client test.
export const RISE_UP=1.45,CROUCH_H=1.35;
// nearest navigation node on the same level (within 1.6 m up / down; world.near prefers the playable floor above / below)
export function nearLevel(N,valid){const C=new Map();N.forEach((p,i)=>{if(valid&&!valid[i])return;const k=Math.floor(p[0]/1.5)*8192+Math.floor(p[2]/1.5);let l=C.get(k);if(!l)C.set(k,l=[]);l.push(i);});
 return (x,z,y)=>{const cx=Math.floor(x/1.5),cz=Math.floor(z/1.5);let b=-1,bd=Infinity;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const i of C.get((cx+dx)*8192+cz+dz)||[]){const p=N[i];if(Math.abs(p[1]-y)>1.6)continue;const d=(p[0]-x)**2+(p[2]-z)**2;if(d<bd){bd=d;b=i;}}return b;};}
export function reach(w,key,SB,o={}){const Z=zoneOf(key,w.nav);if(!Z)throw Error(key+': spawn zones do not match the navigation');const N=w.nav.nodes,G=o.grid||.4,SEED=o.seed||10,MAXC=o.max||400000;
 const blocked=o.blocked||((x,z,r,y,h)=>w.blocked(x,z,r,y,h)||SB.blocked(key,x,z,r,y,h)),g0=o.ground||((x,z,y)=>w.ground(x,z,y)),
  /* a body is held up by its footprint: the highest of the centre and 4 points 0.3 m out (a crack / seam in a floor is no drop: Split's 13 m floor at x -22) */ground=(x,z,y)=>{let m=g0(x,z,y);for(const [a,b] of [[.3,0],[-.3,0],[0,.3],[0,-.3]]){const v=g0(x+a,z+b,y);if(Number.isFinite(v)&&!(v<=m))m=v;}return m;},leash=o.leash||((x,z,y,x0,z0)=>!w.leash||w.leash(x,z,y,x0,z0)),near=o.near||nearLevel(N,w.nav.valid);
 const polys=polylines(SB,key),out=[];let total=0;
 for(const side of o.sides||['atk','def']){const own=side==='atk'?'A':'D',mine=polys.filter(q=>q.side===side);if(!mine.length)continue;
  const seen=new Map(),Q=[],kf=(x,z,y)=>Math.round(x/G)+','+Math.round(z/G)+','+Math.round(y/.6),leaks=[];
  const push=(x,z,y,from)=>{const k=kf(x,z,y);if(seen.has(k))return;seen.set(k,from);Q.push([x,z,y]);};
  const seedOk=o.seedOk||(i=>w.allowed?w.allowed.has(i):!w.nav.valid||!!w.nav.valid[i]);/* the playable navigation only: a floor off it (Bind's under-platform layers) counts only when a drop reaches it */
  for(let i=0;i<N.length;i++){if(Z[i]!==own||!seedOk(i))continue;const p=N[i];if(!(Math.abs(nearestSd(mine,p[0],p[2]))<SEED))continue;const x=Math.round(p[0]/G)*G,z=Math.round(p[2]/G)*G,g=ground(x,z,p[1]+.5);if(!Number.isFinite(g)||Math.abs(g-p[1])>.6)continue;if(blocked(x,z,.4,g,CROUCH_H))continue;push(x,z,g,null);}
  const isOut=(x,z,y)=>{const sd=nearestSd(mine,x,z);if(sd>=-1.5&&sd!==Infinity)return null;const i=near(x,z,y);if(i<0)return null;const n=N[i];if(Math.hypot(n[0]-x,n[2]-z)>1.5||Math.abs(n[1]-y)>2)return null;const zc=Z[i];if(zc===own||zc===own.toLowerCase())return null;if(sd===Infinity&&(zc!==zc.toUpperCase()||zc==='?'))return null;/* away from every wall: only > 2 m inside the neutral area / enemy zone; '?' (off the zone overlay: the floor behind Bind's attacker spawn, z 45 - 56, reached once a floor crack is no drop) is no way out on its own - the flood walks on through it and a neutral / enemy cell beyond still counts */return {zone:zc,sd};};
  for(let n=0;n<Q.length&&n<MAXC;n++){const [x,z,y]=Q[n],from=[x,y,z];
   for(const [dx,dz] of [[G,0],[-G,0],[0,G],[0,-G]]){const nx=+(x+dx).toFixed(3),nz=+(z+dz).toFixed(3);
    for(const top of [y+RISE_UP,y+.45]){const g=ground(nx,nz,top);if(!Number.isFinite(g)||g<y-9||g>y+RISE_UP+.01)continue;
     if(seen.has(kf(nx,nz,g)))continue;if(blocked(nx,nz,.4,g,CROUCH_H))continue;if(!leash(nx,nz,g))continue;/* strict: a body off the playable footprint only moves back */
     // the step itself must not pass through a wall (a 0.3 m slab between two clear cells)
     const cr=SB.crossing(key,x,z,nx,nz,Math.min(y,g)+.5);if(cr&&cr.side===side){/* through a wall: only when its span misses the body */const lo=Math.min(y,g),hi=Math.max(y,g)+CROUCH_H;if(!(hi<=cr.y0||lo>=cr.y1))continue;}
     const O=isOut(nx,nz,g);if(O){leaks.push({side,at:[nx,+g.toFixed(2),nz],zone:O.zone,sd:+O.sd.toFixed(2),from:from.map(v=>+v.toFixed(2))});seen.set(kf(nx,nz,g),from);continue;}
     push(nx,nz,g,from);}}}
  if(o.cellsOut)o.cellsOut[side]=[...seen.keys()];if(o.keep)(o.keep[side]=Q.slice());if(o.trace)for(const l of leaks){const P=[];let f=l.from;for(let g=0;f&&g<5000;g++){P.push(f);f=seen.get(kf(f[0],f[2],f[1]));}l.path=P;}total+=seen.size;out.push(...leaks);if(o.log)o.log(key,side,'cells',seen.size,'leaks',leaks.length);}
 return {cells:total,leaks:out};}
// Ledge / ability runs (barrier-3): from the highest places a player reaches beside each wall (reach() cells 0.6 - 4 m in
// from its line: boxes, ledges, stairs, steps; best 10 per panel, 1.5 m apart) and from the doorway floor right at it, the
// real motor runs at the wall: jump spam, crouch-jump spam, and a vertical launch (Jett Updraft: vy = sqrt(2 * 18 * 6), the
// strongest vertical boost in the kits) then forward with jump spam; also a horizontal dash (Tailwind: 11 m / 0.45 s) straight
// at it. The casts themselves are refused in the buy phase (server castAbility0 sim.buy > 0, page jKey) - these runs check the
// wall would hold even so. Out = as escapes(). -> {runs, leaks}
export const UPDRAFT=Math.sqrt(2*18*6);
export function ledgeStarts(key,SB,keep,side,o={}){const polys=polylines(SB,key).filter(q=>q.side===side),K=o.per||10,S=[];
 for(const q of polys){const C=[];for(const [x,z,y] of keep[side]||[]){const sd=sdist(q,x,z);if(sd<.6||sd>4)continue;C.push([x,y,z,sd]);}
  C.sort((a,b)=>b[1]-a[1]);const pick=[];for(const c of C){if(pick.length>=K)break;if(pick.some(p=>Math.hypot(p[0]-c[0],p[2]-c[2])<1.5))continue;pick.push(c);}
  for(const c of pick)S.push({panel:q.i,q,at:c});}
 return S;}
export function ledgeRuns(w,key,SB,keep,o={}){const Z=zoneOf(key,w.nav);const N=w.nav.nodes,nl=nearLevel(N,w.nav.valid);
 const zoneAt=(x,z,y,r=1.5)=>{const i=nl(x,z,y);return i>=0&&Math.hypot(N[i][0]-x,N[i][2]-z)<r?Z[i]:'';};
 const polys=polylines(SB,key),s=new SpikeSimulation(w,'five',key,()=>.5),u=s.add('one');s.add('two');s.start(false);let SEQ=1,runs=0;const leaks=[];
 for(const side of o.sides||['atk','def']){const own=side==='atk'?'A':'D',mine=polys.filter(q=>q.side===side);u.team=side==='atk'?s.atk:1-s.atk;
  for(const st of ledgeStarts(key,SB,keep,side,o)){const [sx,sy,sz]=st.at;
   // the nearest point of the panel: run straight at it
   let bp=null;for(const g of st.q.segs){const t=Math.max(0,Math.min(g.len,(sx-g.ax)*g.tx+(sz-g.az)*g.tz)),px=g.ax+g.tx*t,pz=g.az+g.tz*t,d=Math.hypot(px-sx,pz-sz);if(!bp||d<bp.d)bp={d,px,pz};}
   const dl=Math.hypot(bp.px-sx,bp.pz-sz)||1,dx=(bp.px-sx)/dl,dz=(bp.pz-sz)/dl;
   for(const pat of ['fj','fcj','up','dash']){
    Object.assign(u,{x:sx,y:sy,z:sz,vx:0,vz:0,vy:0,alive:true,hp:100,dash:null,loading:false,air:false});s.buy=30;runs++;
    if(pat==='up'){u.vy=UPDRAFT;u.air=true;}if(pat==='dash')u.dash=Motor.dash(1,0,yaw(dx,dz),11,.45);
    let px=sx,pz=sz,esc=null;
    for(let k=0;k*.05<3;k++){s.command(u,{t:'in',seq:SEQ++,r:yaw(dx,dz),p:0,f:1,s:0,j:pat!=='dash'&&(k%8<4)?1:0,c:pat==='fcj'?1:0});s.step(.05);if(u.dash&&Motor.dashStep(u,u.dash,.05,s.world).left<=0)u.dash=null;/* the buy phase steps no dash: as the round's Simulation.step */
     const cr=SB.crossing(key,px,pz,u.x,u.z,u.y+.5);if(cr&&cr.side===side){esc='crossed';break;}px=u.x;pz=u.z;
     const sd=nearestSd(mine,u.x,u.z);if(sd<-1.5){const g=w.ground(u.x,u.z,u.y+.05),zz=zoneAt(u.x,u.z,Number.isFinite(g)&&g<u.y?g:u.y,4);/* in the air: the zone of the floor under the body (Haven attackers' Updraft over their own floor beside panel 2, Breeze defenders' jump at panel 0: no way out) */if(!(own+own.toLowerCase()).includes(zz||'?')){esc='out '+(zz||'off-nav')+' '+sd.toFixed(2)+' m past the wall';break;}}}
    if(esc)leaks.push({side,panel:st.panel,pat,how:esc,from:[sx,sy,sz].map(v=>+v.toFixed(2)),at:[u.x,u.y,u.z].map(v=>+v.toFixed(2))});}}}
 return {runs,leaks};}
