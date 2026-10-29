// Shared deterministic character motor and accuracy model. Metres, seconds, radians.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ValorantFeel=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// Ground and jump physics follow frame-by-frame measurements of VALORANT ("VALORANT Physics: Explained", Stark, linked from
// reddit.com/r/VALORANT/comments/utc7qf): every stance reaches its top speed in 0.288 s (acceleration scales with the speed
// limit; crouched 0.472 s), releasing all keys decays speed by dv/dt = -(7.3625 v + 46.5) (stop from rifle speed in ~84 ms,
// ~0.20 m), jump launch 6.902 m/s under 20.45 m/s^2 gravity (1.165 m apex, 0.675 s airtime), crouch-walk 2.5 m/s with the
// knife (0.37x) and a 0.276 s crouch. Walk is 0.6x (Riot's 2020 weapon data: Classic run 5.73 / walk 3.43 m/s). Air speed
// never exceeds melee speed (patch 12.09) and landing keeps momentum (no landing slowdown in VALORANT).
const C={stepHeight:.4,knifeSpeed:6.75,walk:.6,crouch:2.5/6.75,accelTime:.288,crouchAccelTime:.472,frictionScale:7.3625,frictionFlat:46.5,airAcceleration:3.5,jumpSpeed:6.902,gravity:20.45,landingLock:.2,landSpreadTime:.225,landSpread:7,crouchEye:.45,crouchDown:.276,crouchUp:.276,deadzone:.275,operatorDeadzone:.15,eyeHeight:1.6,referenceAspect:16/9,horizontalFov:103};
C.verticalFov=2*Math.atan(Math.tan(C.horizontalFov*Math.PI/360)/C.referenceAspect)*180/Math.PI;
function approach(v,t,d){return v<t?Math.min(t,v+d):Math.max(t,v-d);}
function damp(v,t,k,dt){return t+(v-t)*Math.exp(-k*dt);}
function velocity(vx,vz,tx,tz,rate,dt){const dx=tx-vx,dz=tz-vz,d=Math.hypot(dx,dz);if(d<1e-8)return {vx:tx,vz:tz,dx:tx*dt,dz:tz*dt};const t=Math.min(dt,d/Math.max(1e-6,rate)),ax=dx/d*rate,az=dz/d*rate;return {vx:vx+ax*t,vz:vz+az*t,dx:vx*t+.5*ax*t*t+tx*(dt-t),dz:vz*t+.5*az*t*t+tz*(dt-t)};}
// VALORANT ground friction: speed s decays as ds/dt = -(S s + F + extra) until it reaches floor (exact solution).
// Returns the new speed, the distance covered and the time used (<= h).
function brake(s,floor,h,extra){const S=C.frictionScale,K=(C.frictionFlat+(extra||0))/S;if(s<=floor)return {s,d:s*h,t:h};const tStop=Math.log((s+K)/(floor+K))/S;const t=Math.min(h,tStop),e=Math.exp(-S*t);const ns=t>=tStop?floor:Math.max(floor,(s+K)*e-K);return {s:ns,d:(s+K)*(1-e)/S-K*t,t};}
// One grounded substep. Releasing every key brakes with the exact friction curve above. With a key held the velocity moves
// toward the target velocity: at the acceleration while speeding up along the input, with friction while slowing to a
// lower limit, and with friction plus acceleration while reversing (counter-strafing stops faster than releasing).
function groundMove(P,tx,tz,accel,h){const vx=P.vx||0,vz=P.vz||0,T=Math.hypot(tx,tz),s=Math.hypot(vx,vz);
 if(T<1e-6){if(s<1e-9){P.vx=P.vz=0;return {dx:0,dz:0};}const r=brake(s,0,h);P.vx=vx/s*r.s;P.vz=vz/s*r.s;return {dx:vx/s*r.d,dz:vz/s*r.d};}
 const dot=tx*vx+tz*vz,rate=dot<0?C.frictionScale*s+C.frictionFlat+accel:T+1e-9<s?C.frictionScale*s+C.frictionFlat:accel;
 const v=velocity(vx,vz,tx,tz,rate,h);P.vx=v.vx;P.vz=v.vz;return {dx:v.dx,dz:v.dz};}
// A capsule whose rounded base rests on a stair nosing cannot sink, so it is supported even though
// the floor under its centre is lower; treating that as airborne stalled every staircase.
// A capsule already embedded in geometry where it stands is not supported by it (it would hang inside a wall and
// could jump again from there, climbing it: Ascent -56,-22 wall, bots 2.5 m up inside the building).
// Vertical probes use a 2 cm thinner capsule than horizontal moves (.4): horizontal movement accepts a capsule grazing a
// wall at its .388 tolerance, where a same-radius blocked() flips with float noise as the capsule moves up or down. That made
// any wall corner read as a floor (hanging mid-air beside it and jumping again from there).
const VR=.38,LEAN_LIFTS=[.005,.015,.03,.05];
// A grazed wall reads blocked at y-.03 as often as not, so contact alone is not support: there must also be a floor under
// the capsule's footprint within a riser and a bit (a nosing's tread, a box edge), never a wall face mid-air.
function supported(P,world,y,height){if(!world.blocked(P.x,P.z,.4,y-.03,height)||world.blocked(P.x,P.z,VR,y,height))return false;if(world.ground(P.x,P.z,y+.05)>y-.45)return true;for(let k=0;k<8;k++){const a=k*Math.PI/4;if(world.ground(P.x+Math.cos(a)*.34,P.z+Math.sin(a)*.34,y+.05)>y-.45)return true;}return false;}
// Highest floor within 20 cm of the centre: seams between stair meshes read as deep holes at a single point. Also the
// footprint ring supported() stands on (.34 m): a capsule walking a stair's open side with its centre past the edge (Ascent
// A stairs, west rim over the 8 m pit) stands on the tread under its rim, not on the pit floor; measuring the next riser
// from the pit refused every step (10 m 'climb'), so it pressed into the riser corner until the unwedge moved it.
// Only floors at or below the feet count, so a wall top beside the capsule never becomes its base.
// Largest capsule radius in [.3, .4] free of collision at (x, z, feet y): .4 when the full capsule is free (0.1 mm steps).
function clearance(world,x,z,y,height){if(!world.blocked(x,z,.4,y,height))return .4;let lo=.3,hi=.4;if(world.blocked(x,z,lo,y,height))return lo;for(let n=0;n<10;n++){const m=(lo+hi)/2;if(world.blocked(x,z,m,y,height))hi=m;else lo=m;}return lo;}
function floorNear(world,x,z,y){let f=world.ground(x,z,y+.05);for(const [ox,oz]of [[.2,0],[-.2,0],[0,.2],[0,-.2]])f=Math.max(f,world.ground(x+ox,z+oz,y+.05));if(f<y-.45)for(let k=0;k<8;k++){const a=k*Math.PI/4;f=Math.max(f,world.ground(x+Math.cos(a)*.34,z+Math.sin(a)*.34,y+.05));}return f;}
// Player clips: invisible walls over open map edges the source collision leaves open (Ascent A: a hole beside the A ramp,
// open on every side, no floor below). Movement only: the client's nmBlocked and the server world's blocked() both ask
// clipBlocked, while shots, sight and floor rays never see a clip. Each clip is a vertical prism: polygon p of [x,z]
// (the void's outline, measured on the collision mesh) from y[0] to y[1]; a capsule (radius r, feet y, height) is blocked
// when its footprint comes within r of the polygon and the heights overlap, exactly as a wall standing on the rim would.
// Split (-4.12, 9, -46.4): a rounded 0.5 m wide, 0.8 m tall prop whose collision is a dome; walking into it the capsule
// stepped onto its lip and climbed the curved side a few cm per sub-step (each lift cleared by contact at the capsule's
// rim, no single riser over the step height) and ended 0.8 m up, embedded on its shoulder. The clip (an octagon on its
// footprint, feet band 9..9.85 m) makes it a post; jumping on top still works.
// Breeze (x 7.3..10.45, z -24.45..-21.4): crate blocks step down from the 12 m platform (10.95, 9.96, 9.0 m) to the 8 m floor
// off the nav footprint; a capsule walked off the platform edge dropped 1 m onto the top block, where the leash only let
// it move back toward the platform (1 m up: jump only). The clip spans the platform's height band only (feet 11..14.5 m;
// capsules on the 8 m floor, even at a jump apex, top out below 11 m), so the platform edge stops a walk as a wall would.
// Breeze west edge (x -34.9..-33.92, z -66..-58.4): the 8 m floor ends over a 5.2 m drop that is off the footprint, with
// no railing; walking off it diagonally, the leash's 0.6 m core let the capsule's centre 0.3 m past the edge, where it
// settled 26 cm down on the edge lip, could not drop (off the footprint) and met the edge at every lift back (0.2 m of
// travel in any direction, crouched too). The clip follows the edge 0.3 m out (never nearer than 0.42 m to the x -33.5
// nav row) and spans the body band 8.4..9.5 m (nothing on the 5.2 m floor reaches it), so the edge stops a walk like a
// railing would. A short clip on the trap spot alone left corner pockets against the edge either side of it.
// Breeze (-11.24, 6, -0.98): an open-lattice prop about 0.55 m across and 0.7 m tall against the low railing over the
// mid-west drop; walking past it toward (-0.71, -0.71) the capsule climbed its rim 0.6 m in three frames and perched on
// it at (-11.21, 6.61, -0.66) with no floor under its axis (0.06 m of travel in any direction). The clip (octagon r 0.3,
// feet band 6.05..6.75 m) makes it a post, as on Split.
// Bind (x -53.9..-53.2, z 21.35..21.75): rock crevices west and north of a 0.65 m rock bump (nav node (-53.25, 7.55, 21)),
// between the bump and a rock face that leans over at head height; walking off the bump toward (-0.71, 0.71) /
// (-0.38, 0.92) / (-0.92, 0.38), or up onto it from the floor to the south-east, the capsule wedged at (-53.49, 7.41,
// 21.32) / (-53.23, 7.51, 21.2), resting on the crevice rims 0.3 m above their floor, and met rock at every lift in every
// standing direction (only a crouch or a jump got out). The clip (inside the crevices, never nearer than 0.42 m to the
// node; body band 6.9..8.4 m) stops the walk at the bump's rim like a wall; the bump and the floor around it stay free.
const CLIPS={ascent:[{name:'A ramp pit',y:[-60,15],p:[[42.55,-25.15],[42.62,-24.95],[42.78,-24.25],[42.98,-23.25],[42.5,-23.13],[41,-22.83],[39.5,-22.52],[38,-22.2],[37.3,-22.18],[37.22,-22.7],[37.12,-23.1],[37,-23.55],[36.97,-23.82],[37.45,-23.92],[37.95,-24.02],[38.15,-24.25],[38.75,-24.42],[39.65,-24.62],[40.7,-24.82],[41.7,-25.02]]},
  {name:'7 cm plinth (0.5 m tall) along the slanted wall north of (-12.5, 7.07, 38), z 37.46..38.42 (a capsule walking along or into the wall rode up 0.27 m onto its edge, a camera hop; the clip makes the face vertical at the plinth line, the wall still stops a walk into it)',y:[6.95,7.6],p:[[-12,38.42],[-12.18,37.46],[-11.95,37.46],[-11.88,38.42]]}],
 split:[{name:'rounded 0.8 m prop by a wall (domed: a capsule climbed it rim-first)',y:[9,9.85],p:[[-3.85,-46.4],[-3.93,-46.21],[-4.12,-46.13],[-4.31,-46.21],[-4.39,-46.4],[-4.31,-46.59],[-4.12,-46.67],[-3.93,-46.59]]}],
 bind:[{name:'rock crevices west / north of the 0.65 m bump at (-53.25, 21) (a capsule wedged between bump and leaning rock face)',y:[6.9,8.4],p:[[-53.2,21.45],[-53.5,21.38],[-53.7,21.35],[-53.84,21.41],[-53.9,21.55],[-53.84,21.69],[-53.7,21.75],[-53.2,21.75]]}],
 breeze:[{name:'defender spawn 12 m platform north-east edge over the 8 m drop: a thin sloped rim along the edge (a capsule walking toward the drop rode up it to 0.5 m and ended embedded, worse with the wall slide; hk-36 bw6: 113 / 528 spawn walks on main). Face 0.1 m inside the rim line z = -45.45 - 0.42 x (the thin sloped bits of the rim sit on it), strip over the drop; the 4 m floor below is untouched',y:[11.5,14.5],p:[[-2.75,-44.403],[2.4,-46.566],[2.4,-45.858],[-2.5,-43.8]]},
  {name:'crate stack below the 12 m platform south-east edge',y:[11,14.5],p:[[8.6,-24.45],[10.45,-24.45],[10.45,-21.4],[7.3,-21.4],[7.3,-23.6],[8,-23.85],[8.35,-24.2]]},
  {name:'8 m floor west edge over the off-footprint 5.2 m drop (capsule settled on the edge lip)',y:[8.4,9.5],p:[[-34.9,-66],[-34.06,-66],[-33.92,-65.5],[-33.92,-64],[-34,-62],[-34.08,-60.5],[-34.18,-59],[-34.21,-58.4],[-34.9,-58.4]]},
  {name:'pocket west of the 1 m metal crate at (-30.5, 8.97, -28) (walking off its west edge left the capsule hanging 0.84 m up on the crate lip, unable to walk straight back; only a capsule on the crate top reaches this band, the 8 m floor beside it and the 2 m crate north of it (top 9.97) are untouched)',y:[9.85,9.95],p:[[-31.25,-28.6],[-31.25,-27.4],[-31.7,-27.4],[-31.7,-28.6]]},
  {name:'open-lattice 0.7 m prop by the mid-west railing (a capsule perched on its rim)',y:[6.05,6.75],p:[[-10.94,-0.98],[-11.03,-0.77],[-11.24,-0.68],[-11.45,-0.77],[-11.54,-0.98],[-11.45,-1.19],[-11.24,-1.28],[-11.03,-1.19]]}]};
for(const k in CLIPS)for(const c of CLIPS[k]){let a=1e9,b=-1e9,e=1e9,f=-1e9;for(const [x,z]of c.p){a=Math.min(a,x);b=Math.max(b,x);e=Math.min(e,z);f=Math.max(f,z);}c.b=[a,b,e,f];}
function polyDist(p,x,z){let inside=false,d=Infinity;for(let i=0,j=p.length-1;i<p.length;j=i++){const [ax,az]=p[j],[bx,bz]=p[i];if((bz>z)!==(az>z)&&x<(ax-bx)*(z-bz)/(az-bz)+bx)inside=!inside;const ex=bx-ax,ez=bz-az,t=Math.max(0,Math.min(1,((x-ax)*ex+(z-az)*ez)/(ex*ex+ez*ez||1)));d=Math.min(d,Math.hypot(ax+ex*t-x,az+ez*t-z));}return inside?0:d;}
function clipBlocked(map,x,z,r,y,height=1.8){const L=CLIPS[map];if(!L)return false;const y0=y+.025,y1=y+height;for(const c of L){if(y1<=c.y[0]||y0>=c.y[1]||x<c.b[0]-r||x>c.b[1]+r||z<c.b[2]-r||z>c.b[3]+r)continue;if(polyDist(c.p,x,z)<r)return true;}return false;}
// Fall damage (VALORANT: wiki.playvalorant.com/en-us/Unrated#Fall_damage): a fall of about 8 m deals 15, rising to the fatal
// 100 at about 17 m; it hits health directly and ignores shields. Linear between the two published points (the wiki gives
// only the end points). The drop is measured from the highest point of the airborne arc to the landing floor.
function fallDamage(drop){return !(drop>=8)?0:Math.min(100,Math.round(15+(drop-8)*85/9));}
// Playable leash (map boundary): the source collision has no player-blocking volumes, so a unit could walk, dash, satchel
// or updraft off the map edge into the void, out past spawn backs, or onto roofs and wall tops. A horizontal move must end
// on the navigation footprint: the playable nodes plus the other valid components no more than 4.6 m above the playable
// floor (box tops, drop-only areas the nav sampled; roofs it sampled stay out):
//  core: within .6 m of a node no more than 1 m above the feet and 7.5 m below them (updraft + jump reach) whose floor is
//        no more than 1.6 m below the surface under the capsule (a railing or a low box may be vaulted, a wall top or a
//        roof edge 2+ m above the street is not a place to stand unless the nav sampled it), or
//  rim:  within 1.5 m of a node whose floor is within 1 m of the floor under the capsule (the same floor just past the
//        nav's edge; never a void or a drop off the map).
// Movement only (shots, sight and floor rays never see it). Given the move's origin (x0, z0), a unit already off the
// footprint (it dropped straight down past a ledge after an updraft, or spawned outside) may move only toward the
// nearest node at its height (core height band, 6 m search): never trapped, never further out (Bind/Split: a jump
// up beside a box landed on the floor behind it, then walked off the map from there). Far from every node it is free.
function leashGrid(nodes,valid,adj){const keep=new Uint8Array(nodes.length);if(adj){const comp=new Int32Array(nodes.length).fill(-1),comps=[];for(let i=0;i<nodes.length;i++){if((valid&&!valid[i])||comp[i]>=0)continue;const q=[i];comp[i]=comps.length;for(let k=0;k<q.length;k++)for(const n of adj[q[k]])if((!valid||valid[n])&&comp[n]<0){comp[n]=comps.length;q.push(n);}comps.push(q);}let big=0;comps.forEach((c,k)=>{if(c.length>comps[big].length)big=k;});const pc=new Map();for(const i of comps[big]||[]){keep[i]=1;const p=nodes[i],k=Math.floor(p[0]/3)*4096+Math.floor(p[2]/3);let l=pc.get(k);if(!l)pc.set(k,l=[]);l.push(p);}
 /* other components (box tops, drop-only areas) count when no node stands more than 4.6 m above the playable floor around it: roofs the nav sampled (Haven 8-11 m, Ascent 6-9 m) stay off the footprint */
 comps.forEach((c,k)=>{if(k===big)return;let worst=-Infinity;for(const i of c){const p=nodes[i];let base=null,bd=Infinity;for(let r=1;r<=3&&base==null;r++)for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++)for(const q of pc.get((Math.floor(p[0]/3)+a)*4096+Math.floor(p[2]/3)+b)||[]){const d=(q[0]-p[0])**2+(q[2]-p[2])**2;if(d<bd){bd=d;base=q;}}const up=base?p[1]-base[1]:Infinity;if(up>worst)worst=up;if(worst>4.6)break;}if(worst<=4.6)for(const i of c)keep[i]=1;});}else for(let i=0;i<nodes.length;i++)keep[i]=valid?valid[i]:1;
 const cells=new Map();for(let i=0;i<nodes.length;i++){if(!keep[i])continue;const p=nodes[i],k=Math.floor(p[0])*4096+Math.floor(p[2]);let l=cells.get(k);if(!l)cells.set(k,l=[]);l.push(p[0],p[1],p[2]);}return cells;}
function leashNear(L,x,z,y){let best=Infinity;const cx=Math.floor(x),cz=Math.floor(z);for(let dx=-6;dx<=6;dx++)for(let dz=-6;dz<=6;dz++){const l=L.get((cx+dx)*4096+cz+dz);if(!l)continue;for(let i=0;i<l.length;i+=3){const ny=l[i+1];if(ny>y+1||ny<y-7.5)continue;const d=(l[i]-x)**2+(l[i+2]-z)**2;if(d<best)best=d;}}return best>36?Infinity:best;}
function leashOk(L,x,z,y,ground,x0,z0){if(!L)return true;if(x0!=null){if(leashOk(L,x,z,y,ground))return true;if(leashOk(L,x0,z0,y,ground))return false;const a=leashNear(L,x0,z0,y);return a===Infinity||leashNear(L,x,z,y)<=a+1e-9;}let core=-Infinity;const rim=[],cx=Math.floor(x),cz=Math.floor(z);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const l=L.get((cx+dx)*4096+cz+dz);if(!l)continue;for(let i=0;i<l.length;i+=3){const ny=l[i+1],d=(l[i]-x)**2+(l[i+2]-z)**2;if(d>2.25)continue;if(d<=.36&&ny<=y+1&&ny>=y-7.5){if(ny>=y-1.6)return true;if(ny>core)core=ny;}rim.push(ny);}}if(!rim.length||!ground)return false;const g=ground(x,z,y);if(core>-Infinity&&core>=g-1.6)return true;for(const ny of rim)if(Math.abs(ny-g)<=1)return true;return false;}
// Wall slide for a blocked move (rx, rz). A 20 cm probe turned 80 deg each way tells a slanted wall (free on exactly one side)
// from a head-on push or a gap (free on both) and a corner or an axis-aligned wall the other axis already slid along
// (free on neither): those get no slide, so they behave as before and a capsule in a corner settles instead of jittering.
// For a slanted wall the capsule first closes the gap along the move (6 halvings), then the smallest free turn of the probe
// (7.5 deg scan, then 6 halvings) is the wall's tangent, and the rest of the move is projected on it (length cos a). Every
// move is tested whole at its destination (halved up to 4 times if blocked), so a slide never tunnels.
const SLIDE_MAX=80*Math.PI/180,SLIDE_STEP=7.5*Math.PI/180,SLIDE_PROBE=.2,SLIDE_RISE=.02;
function slide(P,world,rx,rz,height){const r=slideFrom(P,world,rx,rz,height,0,0);if(r&&r[4])return r;
 // Pinned on a notch of a wall (a cm-scale step in the collision mesh: the probes find the wall's tangent but even a short move along it
 // is blocked): retry from a point backed off the wall along a blocked axis (1 / 2 / 4 cm); a real corner still stops (both probes stay
 // blocked from the backed-off point, so no slide is found). hk-35: Ascent (-57.46, 4.05, -20.07) slid at 20 Hz, stuck at 60 Hz on one.
 // A backed-off slide is taken only when its whole move (back-off included) goes at least 1 mm farther than the plain result (gap close
 // or nothing): at the Ascent plinth (-12.5, 7.07, 38) the back-off only re-ground the capsule into the wall it was already closing on
 // and pinned it (test-map-bounds 'slides'), qa-32.
 const g=r?Math.hypot(r[0],r[1]):0;
 for(const b of [.01,.02,.04])for(const ax of [0,1]){const c=ax?rz:rx;if(Math.abs(c)<1e-9)continue;const bx=ax?0:-Math.sign(c)*b,bz=ax?-Math.sign(c)*b:0,q=slideFrom(P,world,rx,rz,height,bx,bz);if(q&&q[4]&&Math.hypot(q[0],q[1])>g+1e-3)return q;}
 return r;}
function slideFrom(P,world,rx,rz,height,bx,bz){const L=Math.hypot(rx,rz);if(L<1e-7)return null;const ux=rx/L,uz=rz/L,probe=Math.max(SLIDE_PROBE,4*L);let ox=bx,oz=bz;
 const ok=(dx,dz)=>{const x=P.x+ox+dx,z=P.z+oz+dz;return !(world.leash&&!world.leash(x,z,P.y,P.x,P.z))&&!world.blocked(x,z,.4,P.y,height)&&!(world.ground(x,z,P.y+C.stepHeight)>P.y+SLIDE_RISE);};/* flat only: a slide never climbs (a plinth, a stair: moveAxis's step rules decide those) */
 if((bx||bz)&&!ok(0,0))return null;
 const dir=(a,s)=>{const c=Math.cos(a),sn=Math.sin(a)*s;return [ux*c-uz*sn,uz*c+ux*sn];},free=(a,s)=>{const d=dir(a,s);return ok(d[0]*probe,d[1]*probe);};
 const p=free(SLIDE_MAX,1),m=free(SLIDE_MAX,-1);if(p===m)return null;const s=p?1:-1;
 let f0=0,f1=1;for(let n=0;n<6;n++){const mid=(f0+f1)/2;if(ok(rx*mid,rz*mid))f0=mid;else f1=mid;}ox+=rx*f0;oz+=rz*f0;
 let lo=0,hi=SLIDE_MAX;if(!free(SLIDE_MAX,s))return f0>0?[ox,oz,ux,uz,0]:null;
 for(let a=SLIDE_STEP;a<SLIDE_MAX-1e-9;a+=SLIDE_STEP){if(free(a,s)){hi=a;break;}lo=a;}
 for(let n=0;n<6;n++){const mid=(lo+hi)/2;if(free(mid,s))hi=mid;else lo=mid;}
 const d=dir(hi,s);let len=L*(1-f0)*Math.cos(hi);for(let n=0;n<5;n++,len/=2)if(ok(d[0]*len,d[1]*len))return [ox+d[0]*len,oz+d[1]*len,d[0],d[1],1];return f0>0?[ox,oz,ux,uz,0]:null;}
// Rope ascenders (VALORANT Split; no other shipped map has ropes or ziplines: Icebox / Fracture are not in the game).
// Seven ascenders per wiki.playvalorant.com/en-us/Split ("Two that allow players to get up from Sewer to A Lobby, One that
// allows players to get up from B Hell to B Tower, Four that allow players to navigate through Vents"); spots from the wiki's
// interactive map (Map:Split markers, fitted to this map's callouts, 0.8 m rms) snapped onto the collision mesh: each rope
// hangs 0.5 m out from the upper floor's ledge face, near a side wall of the shaft as in the in-game screenshots.
// x, z: hang point (the climbing capsule's axis); y0 / y1: lower / upper floor; ex, ez: where the climber steps off at the top;
// ty: height of that step-off move (clears the ledge lip). Behaviour (VALORANT): Use (F) near a rope attaches (also from the
// ledge at the top, or mid-air); W / S climb look-relative (looking down past ~17 deg, W climbs down) at about Operator run
// speed (dev Pearl Hogbash, 2020: "about the same speed as when running with an Operator"; walk held = walk speed), reached
// almost at once; climbing past the top steps off onto the upper floor, reaching the floor at the bottom lets go; Jump pushes
// off the rope, Use again lets go. Weapons fire on ropes with the rope spread (patch 6.11 / 12.09, see spread()).
const ROPES={split:[
 {name:'B Hell - B Tower',x:-23.03,z:-8.9,y0:9,y1:13,ex:-21.1,ez:-8.9,ty:13.3},
 {name:'A Sewer - A Lobby (north)',x:41.13,z:12.15,y0:3.13,y1:7,ex:42.35,ez:12.15,ty:7.05},
 {name:'A Sewer - A Lobby (south)',x:41.19,z:14.85,y0:3.05,y1:7,ex:42.39,ez:14.85,ty:7.05},
 {name:'Vent - A Tower side (north)',x:15.3,z:-17.85,y0:6.5,y1:10.517,ex:16.5,ez:-17.85,ty:10.57},
 {name:'Vent - A Tower side (south)',x:15.37,z:-15.5,y0:6.5,y1:10.517,ex:16.57,ez:-15.5,ty:10.57},
 {name:'Vent - Mid Vent (north)',x:11.99,z:-10.8,y0:6.5,y1:10.5,ex:10.79,ez:-10.8,ty:10.55},
 {name:'Vent - Mid Vent (south)',x:12.06,z:-8.3,y0:6.5,y1:10.5,ex:10.86,ez:-8.3,ty:10.55}]};
// reach: grab distance from the rope (capsule axis); speed: 6.75 x Operator 0.76; accel: top speed in 0.1 s (patch 1.10: no
// sudden direction shifts); down: pitch under which W climbs down; hold: time on the rope before Jump / Use may let go;
// cooldown: before the same unit can grab again; push: Jump-off speed away from the rope; exit: step-off duration.
const ROPE_SG=new Set(['Shorty','Bucky','Judge']);
const ROPE={reach:.9,speed:6.75*.76,accel:6.75*.76/.1,down:.3,hold:.2,cooldown:.35,push:3,exit:.2};
function ropeFind(R,P){let best=-1,bd=Infinity;for(let k=0;k<R.length;k++){const r=R[k],d=Math.hypot(P.x-r.x,P.z-r.z),t=Math.hypot(P.x-r.ex,P.z-r.ez);
  let s=Infinity;if(d<=ROPE.reach&&P.y>=r.y0-.3&&P.y<=r.y1+.3)s=d;else if(t<=ROPE.reach+.4&&Math.abs(P.y-r.y1)<=.3)s=t;if(s<bd){bd=s;best=k;}}return best;}
// Climb direction -1..1: bots give input.climb; players give the forward axis (f, W = 1) and the camera pitch (+ up).
function ropeClimb(input){if(input.climb!=null)return Math.max(-1,Math.min(1,+input.climb||0));const f=Math.max(-1,Math.min(1,+input.f||0));return (input.pitch||0)<-ROPE.down?-f:f;}
function ropeLeave(P){P.rope=0;P.ropeT=0;P.ropeOut=null;P.ropeCd=ROPE.cooldown;P.ropeAt=null;}
function ropeStep(P,input,dt,world,press,usePress){const r=world.ropes[P.rope-1];P.ropeT=(P.ropeT||0)+dt;P.lp=0;P.ls=0;P.jumpBuffer=0;P.vx=P.vz=0;
 P.ch=approach(P.ch||0,0,C.crouchEye/C.crouchUp*dt);P.cr=false;P.wk=!!input.walk;const out={landed:false,jumped:false,speed:0,drop:0,rope:true};
 const done=()=>{const s=Math.abs(P.vy||0);P.mv=s>.1;P.sf=s/Math.max(.001,input.speed||1);P.speed=s;out.speed=s;P.fallTop=P.y;P.fallY=P.y;P.fallDrop=0;P.ropeAt=P.rope?[P.x,P.y,P.z]:null;return out;};
 if(P.ropeOut!=null){/* stepping off at the top: up to ty at the rope, then across onto the ledge */P.ropeOut=Math.min(1,P.ropeOut+dt/ROPE.exit);const k=P.ropeOut;P.vy=0;P.x=r.x+(r.ex-r.x)*k;P.z=r.z+(r.ez-r.z)*k;P.y=r.ty;
  if(k>=1){ropeLeave(P);P.air=true;P.vy=0;P.takeoffSpeed=0;P.fallTop=P.y;}else P.air=false;return done();}
 P.x=r.x;P.z=r.z;P.air=false;
 if(press&&P.ropeT>=ROPE.hold){/* jump off: pushed away from the rope (along the move keys, else away from the ledge) */let dx=input.x||0,dz=input.z||0,l=Math.hypot(dx,dz);if(l<.1){dx=r.x-r.ex;dz=r.z-r.ez;l=Math.hypot(dx,dz)||1;}
  ropeLeave(P);P.vx=dx/l*ROPE.push;P.vz=dz/l*ROPE.push;P.vy=C.jumpSpeed;P.air=true;P.takeoffSpeed=ROPE.push;out.jumped=true;return done();}
 if(usePress&&P.ropeT>=ROPE.hold){ropeLeave(P);P.vy=0;P.air=true;P.takeoffSpeed=0;return done();}
 const c=ropeClimb(input),want=c*ROPE.speed*(input.walk?C.walk:1);P.vy=approach(P.vy||0,want,ROPE.accel*dt);let y=P.y+P.vy*dt;
 if(y>=r.y1){if(c>0&&!world.blocked(r.ex,r.ez,.4,r.ty,1.8)){P.y=r.y1;P.ropeOut=0;P.vy=0;return done();}y=r.y1;if(P.vy>0)P.vy=0;}
 const floor=world.ground(r.x,r.z,Math.max(P.y,y)+.05);if(y<=floor){y=floor;if(P.vy<0)P.vy=0;if(c<0){P.y=y;ropeLeave(P);P.air=false;return done();}}
 P.y=y;return done();}
// Nav links for bots: lower floor node <-> upper floor node of every rope (both ends on nodes ok(i) accepts).
function ropeLinks(R,nodes,ok){const L=[];if(!R)return L;const pick=(x,y,z)=>{let b=-1,d=1.5*1.5;for(let i=0;i<nodes.length;i++){if(ok&&!ok(i))continue;const p=nodes[i];if(Math.abs(p[1]-y)>.5)continue;const e=(p[0]-x)**2+(p[2]-z)**2;if(e<d){d=e;b=i;}}return b;};
 R.forEach((r,k)=>{const a=pick(r.x,r.y0,r.z),b=pick(r.ex,r.y1,r.ez);if(a>=0&&b>=0&&a!==b)L.push({a,b,k,up:1},{a:b,b:a,k,up:0});});return L;}
function step(P,input,dt,world){
 const dt0=Math.max(0,Math.min(.1,dt)),parts=Math.max(1,Math.ceil(dt0*128)),h=dt0/parts;let landed=false,jumped=false,drop=0;
 // Moved from outside the motor since the last step (a teleport, a rescue, a respawn): the fall starts over from here.
 if(P.fallY==null||Math.abs(P.y-P.fallY)>1e-4)P.fallTop=P.y;
 const press=!!input.jump&&!P.jumpHeld;P.jumpHeld=!!input.jump;if(press)P.jumpBuffer=.07;
 // Ropes (world.ropes): Use grabs the nearest rope in reach; on a rope the rope moves the unit. A unit moved from outside
 // the motor since its last rope step (respawn, rescue, teleport, a dash) is off the rope.
 const usePress=!!input.use&&!P.useHeld;P.useHeld=!!input.use;const RS=world.ropes;
 if(P.rope&&(!RS||!RS[P.rope-1]||!P.ropeAt||Math.abs(P.x-P.ropeAt[0])+Math.abs(P.y-P.ropeAt[1])+Math.abs(P.z-P.ropeAt[2])>1e-6))ropeLeave(P);
 if(RS){P.ropeCd=Math.max(0,(P.ropeCd||0)-dt0);if(!P.rope&&usePress&&!(P.ropeCd>0)){const k=ropeFind(RS,P);if(k>=0){const r=RS[k];P.rope=k+1;P.ropeT=0;P.ropeOut=null;P.vx=P.vz=P.vy=0;P.y=Math.max(r.y0,Math.min(r.y1,P.y));P.x=r.x;P.z=r.z;P.ropeAt=[P.x,P.y,P.z];}}
  if(P.rope){P.jumpBuffer=0;const parts=Math.max(1,Math.ceil(dt0*128)),h=dt0/parts;let o=null,j=false;for(let k=0;k<parts&&P.rope;k++){o=ropeStep(P,input,h,world,press&&k===0,usePress&&k===0);j=j||o.jumped;}if(o){o.jumped=j;if(!P.rope&&parts>1){/* let go mid-step: the rest of the step is ordinary movement */}return o;}}}
 for(let k=0;k<parts;k++){
  const floor=world.ground(P.x,P.z,P.y),grounded=(P.vy||0)<=0&&(P.y<=floor+.025||supported(P,world,P.y,1.8-(P.ch||0)));
  P.lp=Math.max(0,(P.lp||0)-h);P.ls=Math.max(0,(P.ls||0)-h);P.jumpBuffer=Math.max(0,(P.jumpBuffer||0)-h);P.duckFatigue=Math.max(0,(P.duckFatigue||0)-h*.55);
  if(!!input.duck!==!!P.duckHeld){if(input.duck)P.duckFatigue=Math.min(.65,(P.duckFatigue||0)+.08);P.duckHeld=!!input.duck;}
  const chTarget=input.duck?C.crouchEye:0,allowed=chTarget>=(P.ch||0)||(!world.blocked(P.x,P.z,.4,P.y,C.eyeHeight+.2)&&(!world.ceiling||!world.ceiling(P.x,P.z,P.y+1.8-(P.ch||0),P.y+1.8)));if(allowed)P.ch=approach(P.ch||0,chTarget,C.crouchEye/((input.duck?C.crouchDown:C.crouchUp)*(1+(P.duckFatigue||0)))*h);
  P.cr=(P.ch||0)>C.crouchEye*.5;P.wk=!!input.walk;
  let mx=input.x||0,mz=input.z||0,l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l;l=1;}
  const duckK=1-(1-C.crouch)*(P.ch||0)/C.crouchEye,max=input.speed*Math.min(duckK,input.walk?C.walk:1)*(input.tag||1);let tx=input.hold?0:mx*max,tz=input.hold?0:mz*max;
  let v;if(grounded){const ck=(P.ch||0)/C.crouchEye,accel=max/Math.max(1e-3,C.accelTime+(C.crouchAccelTime-C.accelTime)*ck);v=groundMove(P,tx,tz,Math.max(1e-3,accel),h);}
  else{if(!l){tx=P.vx||0;tz=P.vz||0;}const cap=Math.min(C.knifeSpeed*(input.tag||1),Math.max(P.takeoffSpeed||input.speed,.1)),s=Math.hypot(tx,tz);if(s>cap){tx*=cap/s;tz*=cap/s;}v=velocity(P.vx||0,P.vz||0,tx,tz,C.airAcceleration,h);P.vx=v.vx;P.vz=v.vz;}
  const height=1.8-(P.ch||0);
  const moveAxis=(dx,dz)=>{const x=P.x+dx,z=P.z+dz;if(world.leash&&!world.leash(x,z,P.y,P.x,P.z))return false;if(!world.blocked(x,z,.4,P.y,height)){P.x=x;P.z=z;return true;}
   // Already embedded a few mm (a capsule pressed into a wall that leans in over uneven paving): the 0.5 mm sub-steps of a
   // move away never clear the wall, so velocity was zeroed every sub-step and the capsule stayed pinned until a jump
   // (Breeze (6.56, 8.04, -34.75), (17.8, 9.19, 7.59)). A move that strictly increases the clearance (largest free radius,
   // embedding no deeper than 10 cm) is let through, so the capsule backs out; sliding along or into the wall is not.
   {const c0=clearance(world,P.x,P.z,P.y,height);if(c0<.4&&c0>.3&&clearance(world,x,z,P.y,height)>c0+1e-5){P.x=x;P.z=z;return true;}}
   // A grounded capsule may step onto a low stair, never teleport onto a tall box. The lifted capsule needs 1 cm of clearance
   // ahead of it (along the move): a slanted wall lip that a .4 capsule only grazes is not a step (it sank into the lip,
   // embedded). Ahead only: a wall beside or behind the capsule (pressed into a corner over a bumpy floor) is no lip, and an
   // all-round 1 cm margin pinned it there for good. Where the capsule lifted by the full step height still meets geometry
   // (a wall that leans in above the feet), only a lift of at most 5 cm (a bump or seam in the floor) may pass, tested at
   // that height (Breeze: 44 walk-in traps against walls over uneven paving). The lowest such lift that clears is used
   // (0.5, 1.5, 3, 5 cm): under a low ceiling or a beam a 5 cm lift put the head into it while a few mm cleared the bump
   // (Ascent (30.25, 9.2, -10.19): wedged under a 1.66 m soffit over bumpy floor).
   // Lift by the step height, move, then settle onto the lowest free height above the destination floor.
   if(grounded&&(P.vy||0)<=0){const top=P.y+C.stepHeight,support=world.ground(x,z,top),ax=x+Math.sign(dx)*.01,az=z+Math.sign(dz)*.01;let cap=top;if(support>top+.001)return false;
    if(world.blocked(ax,az,.4,top,height)){const b0=Math.max(P.y,support);cap=0;for(const l of LEAN_LIFTS)if(b0+l<top&&!world.blocked(ax,az,.4,b0+l,height)){cap=b0+l;break;}if(!cap)return false;}
    // Headroom for the lift actually used (a full step, or the few cm of a bump under a lintel: Haven (9, 7.93, -57.7), a
    // low ceiling 1.8-2.2 m over the floor refused a 5 mm lift because it was tested for the full 40 cm step).
    if(world.ceiling&&world.ceiling(P.x,P.z,P.y+height,cap+height))return false;
    // Riser test: sampled every 10 cm ahead, no single rise may exceed the step height (stairs pass, a 60 cm box does not).
    {const sx=Math.sign(dx),sz=Math.sign(dz);let prev=Math.max(world.ground(P.x,P.z,top),P.y-.2);for(let d=.1;d<.55;d+=.1){const g=world.ground(P.x+sx*d,P.z+sz*d,top);if(g<prev-1)continue;if(g-prev>C.stepHeight+.01)return false;prev=Math.max(prev,g);}} /* samples through seams between stair meshes are ignored; a dip (a crack between floor slabs, a gutter) never lowers the reference, so the far side of a crack is no riser */let lo=Math.max(P.y,support),hi=cap;if(!world.blocked(x,z,.4,lo,height))hi=lo;else for(let n=0;n<10;n++){const mid=(lo+hi)/2;if(world.blocked(x,z,.4,mid,height))lo=mid;else hi=mid;}/* still blocked at the top of the search (a wall the capsule grazes beside it, not ahead: Ascent (-55.37, 4.03, -15.26) rose the full 0.40 m in one tick onto nothing and fell back, a camera hop; root cause hk-36): only a lean-wall lift of a few cm may end embedded */if(hi-Math.max(P.y,support)>LEAN_LIFTS[LEAN_LIFTS.length-1]+1e-6&&world.blocked(x,z,.4,hi,height))return false;const base=floorNear(world,P.x,P.z,P.y);if(hi-base>C.stepHeight+.12)return false;const rise=hi-P.y;P.x=x;P.z=z;P.y=hi;P.vy=0;if(rise>0)P.eyeOffset=(P.eyeOffset||0)-rise;return true;}return false;};
  const vx0=P.vx||0,vz0=P.vz||0,okx=moveAxis(v.dx,0);if(!okx)P.vx=0;
  const okz=moveAxis(0,v.dz);if(!okz)P.vz=0;
  // Wall slide: the axis-separated move above stops dead against a wall that is not world-axis aligned (Ascent's slanted
  // wall at (-12.5, 7.07, 38)). The blocked part of the move is projected onto the wall (VALORANT slides at ~cos of the
  // angle between the move and the wall); the velocity becomes its projection on the wall, so the slide holds the tangential
  // part of the walk sub-step to sub-step (the push into the wall is what the next acceleration adds back, and is clipped again).
  if(!okx||!okz){const sl=slide(P,world,okx?0:v.dx,okz?0:v.dz,height);if(sl){P.x+=sl[0];P.z+=sl[1];if(sl[4]){const k=Math.max(0,vx0*sl[2]+vz0*sl[3]);P.vx=sl[2]*k;P.vz=sl[3]*k;}}}
  let gy=world.ground(P.x,P.z,P.y),vy=P.vy||0;
  if(grounded&&P.jumpBuffer>0&&!input.hold){vy=C.jumpSpeed;P.jumpBuffer=0;P.takeoffSpeed=Math.hypot(P.vx,P.vz);P.air=true;jumped=true;}
  const oldY=P.y;let next=P.y+vy*h-.5*C.gravity*h*h;vy-=C.gravity*h;
  if(vy>0&&world.ceiling&&world.ceiling(P.x,P.z,P.y+height,next+height)){vy=0;next=P.y;}
  // Rising into geometry beside the axis (an overhang, a wall lip) the centre ceiling ray misses: stop at the highest free height.
  if(next>oldY&&world.blocked(P.x,P.z,VR,next,height)&&!world.blocked(P.x,P.z,VR,oldY,height)){let lo=oldY,hi=next;for(let n=0;n<10;n++){const mid=(lo+hi)/2;if(world.blocked(P.x,P.z,VR,mid,height))hi=mid;else lo=mid;}next=lo;vy=Math.min(vy,0);}
  if(next<=gy){next=gy;if(P.air&&vy<-.5){landed=true;P.lp=C.landingLock;P.ls=C.landSpreadTime;P.landImpact=Math.min(1,-vy/10);drop=Math.max(drop,(P.fallTop??oldY)-gy);}vy=0;}
  // Descending beside a riser must not settle the capsule inside the stair face.
  // (Thin probe up the wall, full radius in the last 45 cm above the floor so a landing beside a nosing never ends inside it.)
  if(next<oldY&&!world.blocked(P.x,P.z,VR,oldY,height)&&(world.blocked(P.x,P.z,VR,next,height)||(next-gy<.45&&world.blocked(P.x,P.z,.4,next,height)))){let lo=next,hi=oldY;for(let n=0;n<10;n++){const mid=(lo+hi)/2;if(world.blocked(P.x,P.z,.4,mid,height))lo=mid;else hi=mid;}next=hi;vy=0;}
  if(grounded&&!jumped&&next>oldY&&next-oldY<.5)P.eyeOffset=(P.eyeOffset||0)-(next-oldY);
  P.eyeOffset=damp(P.eyeOffset||0,0,18,h);P.y=next;P.vy=vy;P.air=vy>0||(next>gy+.00001&&!supported(P,world,next,height));P.fallTop=P.air?Math.max(P.fallTop??oldY,next):next;
 }
 const speed=Math.hypot(P.vx||0,P.vz||0);P.mv=speed>.1;P.sf=speed/Math.max(.001,input.speed);P.speed=speed;P.fallY=P.y;P.fallDrop=landed?drop:0;return {landed,jumped,speed,drop};
}
// Published spread (degrees; wiki.playvalorant.com/en-us/<Weapon>, "Spread values"): first shot standing / crouched,
// max (Ares: min) spread standing / crouched, then the movement penalties added on top, crouch-walking / walking / running /
// airborne. Rows with an ADS (alt-fire) entry list its first / max standing / crouched; the movement penalties are shared.
// Scoped snipers have 0 first-shot spread but keep the full movement / airborne penalty.
const SPREAD={Classic:[.4,.3,1.8,1.35,.5,1.1,2.3,7],Shorty:[4,3.4,4,3.4,.5,1,2,4],Frenzy:[.65,.55,1.7,1.45,.5,.8,2,7],Ghost:[.3,.23,1.65,1.24,.5,1.1,2.3,7],Bandit:[.275,.21,1.97,1.48,.5,1.2,2.7,7],Sheriff:[.25,.19,2.75,2.06,.5,1.2,3,7],
 Stinger:[.65,.55,1.5,1.28,.15,1,2.5,10,.35,.26,2.74,2.06],Spectre:[.4,.34,1.4,1.19,.15,1,2.5,10,.25,.21,1.25,1.06],Bucky:[3,2.55,3,2.55,.5,1,2,4],Judge:[2.5,2.12,4,3.4,.5,1,2,4],
 Bulldog:[.3,.26,1.25,1.06,.8,3,6,10,.1,.08,1.5,1.12],Guardian:[.1,.09,1.58,1.34,.8,3,6,10,0,0,1.48,1.25],Warden:[.15,.13,1,.85,.8,3,6,10,.04,.034,1.02,.87],Phantom:[.2,.17,.9,.76,.8,3,6,10,.11,.09,.91,.78],Vandal:[.25,.21,1,.85,.8,3,6,10,.157,.13,1.02,.87],
 Marshal:[1,.9,1,.9,7.5,10,15,20,0,0,0,0],Outlaw:[3.5,3.15,3.5,3.15,7.5,10,15,20,0,0,2.25,2.25],Operator:[5,4.5,5,4.5,7.5,10,15,15,0,0,0,0],Ares:[1,.6,.7,.42,.4,3,6.5,10,.9,.54,.55,.33],Odin:[.8,.48,1.3,.78,.4,3,6.5,10,.79,.47,1.36,.82]};
const rad=d=>Math.tan(d*Math.PI/180);
function spreadRow(state,weapon,stats){const T=SPREAD[weapon];if(!T)return null;const ads=!!(state.ads&&stats&&stats.adsStats&&T.length>8),o=ads?8:0,cr=!!state.cr;return {first:T[o+(cr?1:0)],max:T[o+(cr?3:2)],T};}
function moveRamp(sf,dead){return Math.max(0,Math.min(1,(sf-dead)/(1-dead)));}
function spread(state,weapon,stats){
 const dead=weapon==='Operator'?C.operatorDeadzone:C.deadzone,speed=state.sf!=null?state.sf:(state.mv?1:0),moving=speed>dead,row=spreadRow(state,weapon,stats);
 if(row){const T=row.T;let error=0;
  // Airborne: the published airborne penalty for every gun (a jumping scoped Operator is +15 deg). On the ground the crouch-walk /
  // walk / run penalty ramps with speed (wiki.playvalorant.com/en-us/Weapons: "Movement speed penalties scale up to their max value
  // as agents accelerate ... and fall off as agents decelerate"), from 0 at the deadzone to the full value at the mode's top speed
  // (sf = speed / the current mode's speed). Landing adds 7 deg for 0.225 s on top (Weapons: "an additional 7 deg spread upon
  // landing ... lasting for 0.225 seconds"; patch 1.09).
  // On a rope (patch 6.11): at least 65 % of the walking spread while still, the ground walk / run spread while climbing; shotguns
  // (patch 12.09): 0.75 still, 1.5 walking, 3.0 running.
  if(state.rope&&!state.air){const sg=ROPE_SG.has(weapon),still=sg?.75:.65*T[5];error=moving?Math.max(still,(state.wk?(sg?1.5:T[5]):(sg?3:T[6]))*moveRamp(speed,dead)):still;return rad(row.first+error);}
  if(state.air)error=T[7];else{if(moving)error=(state.cr?T[4]:state.wk?T[5]:T[6])*moveRamp(speed,dead);if(state.ls>0)error+=C.landSpread;}
  return rad(row.first+error);}
 let base=Math.max(0,stats.firstBulletAccuracy||0),error=0;if(state.ads&&stats.adsStats)base=Math.max(0,stats.adsStats.firstBulletAccuracy||0);
 if(state.air)error=12;else{if(moving)error=(state.cr?.5:state.wk?1.1:2.3)*moveRamp(speed,dead);if(state.ls>0)error+=C.landSpread;}
 return rad(base+error);
}
// Spray error growth caps at the published max spread (Ares: shrinks to its min) over the first-shot spread.
function bloomCap(state,weapon,stats){const row=spreadRow(state,weapon,stats);return row?rad(row.max)-rad(row.first):.024;}
// Spray (client gFire = server fire): per-shooter state R {sequence, recoilX, recoilY, bloom, shot, lastWeapon, drift}.
// Climb per shot (rifles .006 for the first 6 then .0015, others .008; cap .065 / .05) scaled by the gun's recoil weight
// (REC, x.85 crouched, x.85 aiming), sideways drift from the 8th shot, bloom +.0015/shot (cap .024) that recovers over
// .375 s (Vandal) / .35 s (Phantom) / .28 s; a pause over .375 s or a weapon change starts a fresh spray. Offsets are
// tangent-plane radians in the shot's right / up basis; random only picks the drift side, so the climb is identical.
const REC={Vandal:1,Phantom:.6,Operator:1.5,Classic:.5,Sheriff:1.3,Spectre:.45,Guardian:.9,Marshal:1.2,Bulldog:.8,Stinger:.55,Frenzy:.5,Shorty:1.2,Bucky:1.4,Judge:1.1,Ares:.7,Odin:.75,Ghost:.55,Outlaw:1.4,Bandit:.8,Warden:.9};/* Bandit / Warden weights: an approximation like the rest (Riot publishes deltas only: Bandit v13.00 'pitch recoil at max down 4 -> 3', Warden v13.09 'pitch recoil smoothed') */
const SPRAY_RIFLES=['Vandal','Phantom','Bulldog','Guardian','Warden'];
function sprayReset(R,w,t){if(R.lastWeapon!==w||t-(R.shot||0)>.375){R.sequence=0;R.recoilX=R.recoilY=R.bloom=0;}R.lastWeapon=w;}
// Gun recovery time (wiki update history: Vandal .375, Phantom / Bulldog / Guardian .35, Stinger .4, Bandit .4 (v13.00 .45 -> .4);
// others keep .28; the Warden's is unpublished).
const RECOVERY={Vandal:.375,Phantom:.35,Bulldog:.35,Guardian:.35,Stinger:.4,Outlaw:.15,Bandit:.4};
// Outlaw (patch 13.01): alt-fire max spread 0 -> 2.25 deg and recovery 0.1 -> 0.15 s after the first shot. Its first shot fills the
// bloom to the max (ADS 2.25 deg over 0; unscoped max = first, nothing to add) and the bloom holds for the 0.15 s recovery, then
// eases out by the next shot at the 2.75/s cadence only to the measured 2.14 deg (wiki note): BLOOM_HOLD keeps it, decaying
// 2.25 -> 2.14 over the 0.364 s shot gap, until the spray resets (.375 s).
const BLOOM_HOLD={Outlaw:{hold:.15,ease:(2.25-2.14)/2.25/(1/2.75-.15)}};
function recoveryTime(w){return RECOVERY[w]||.28;}
// Running / airborne recoil multiplier (patch 6.11: Vandal, Phantom, Spectre vertical x1.8; patch 4.0: Frenzy x1.5).
function recoilMove(state,w){const k=w==='Frenzy'?1.5:['Vandal','Phantom','Spectre'].includes(w)?1.8:1;if(k===1)return 1;const sp=state.sf!=null?state.sf:(state.mv?1:0);return state.air||(sp>=.65&&!state.wk&&!state.cr)?k:1;}
function sprayBloom(R,w,t){const rec=recoveryTime(w),el=t-(R.shot||0),H=BLOOM_HOLD[w];if(H)return el<.375?(R.bloom||0)*Math.max(0,1-Math.max(0,el-H.hold)*H.ease):0;return el<rec?(R.bloom||0)*Math.max(0,1-el/rec):0;}
function sprayStep(R,w,weight,t,random=Math.random,cap=.024){const n=R.sequence++,rifle=SPRAY_RIFLES.includes(w);
 if(n===0){R.drift=random()<.5?-1:1;R.recoilX=0;R.recoilY=0;}else{R.recoilY=Math.min(rifle?.065:.05,R.recoilY+(rifle?(n<7?.006:.0015):.008)*weight);if(n>6){R.recoilX+=R.drift*.003*weight;if(Math.abs(R.recoilX)>.022){R.drift=-Math.sign(R.recoilX);}if(random()<.12)R.drift*=-1;}}
 R.bloom=BLOOM_HOLD[w]?Math.max(0,cap):cap<0?Math.max(cap,(R.bloom||0)-.0015*weight):Math.min(cap,(R.bloom||0)+.0015*weight);R.shot=t;return n;}
function disk(random=Math.random){const a=random()*Math.PI*2,r=Math.sqrt(random());return [Math.cos(a)*r,Math.sin(a)*r];}
// Fire cadence (qa-36, wiki.playvalorant.com weapon pages, fetched 2026-10-26; shared by the server fire() and the page shoot()).
//  ADS bursts: Bulldog "Alt Fire: 3-round burst", rounds 13.333/s, 2.105 bursts/s; Stinger "4-round burst", rounds 18/s,
//  2.118 bursts/s (valorant-api adsStats.burstCount 3 / 4; adsStats.fireRate 6.315715 / 8.470589 = rounds x bursts/s). A
//  burst, once started, fires all its rounds (trigger released or not); the next burst starts 1/bursts-per-second after the
//  first round of the last one.
//  Odin spin-up: wiki Odin "Fire Rate 12-15.6 rounds/sec ... the fire rate will increase over the duration the weapon is fired to
//  a maximum amount"; Alt Fire (ADS) "starts firing at maximum fire rate" (adsStats.fireRate 15.6). The ramp time is not published
//  anywhere we found (wiki / fandom / Liquipedia / valorant.gs game-file dump list only 12 -> 15.6): ramp 1 s linear and a 0.25 s
//  gap resetting it are an ASSUMPTION (the page's pre-feel xRate model).
const CADENCE={burst:{Bulldog:{n:3,rate:13.333,bps:2.105},Stinger:{n:4,rate:18,bps:2.118}},spin:{Odin:{from:12,to:15.6,ramp:1,gap:.25}}};
// Record one shot of `weapon` at `now` (s) on the shooter's cadence state S (ads: aiming down sights / alt fire).
function cadenceShot(S,weapon,ads,now){if(S.w!==weapon){S.w=weapon;S.left=0;S.inB=false;S.bs=0;S.ss=now;S.sl=-1e9;}
 const B=CADENCE.burst[weapon];if(B&&(ads||S.left>0)){if(S.inB&&S.left>0)S.left--;else{S.left=B.n-1;S.bs=now;}S.inB=true;}else{S.left=0;S.inB=false;}
 const P=CADENCE.spin[weapon];if(P){if(now-S.sl>P.gap)S.ss=now;S.sl=now;}}
// Seconds from the shot just recorded to the next one; null = the gun's own rate (1 / fireRate or the ADS rate).
function cadenceGap(S,weapon,ads,now){if(S.w!==weapon)return null;const B=CADENCE.burst[weapon];
 if(B&&S.inB)return S.left>0?1/B.rate:Math.max(1/B.rate,S.bs+1/B.bps-now);
 const P=CADENCE.spin[weapon];if(P&&!ads)return 1/(P.from+(P.to-P.from)*Math.min(1,Math.max(0,now-S.ss)/P.ramp));return null;}
// a burst still owes rounds: the shooter keeps firing without the trigger
const cadenceOwed=(S,weapon)=>!!(S&&S.w===weapon&&S.inB&&S.left>0);
// Classic ALT FIRE (wiki.playvalorant.com/en-us/Classic, valorant-api altShotgunStats {shotgunPelletCount 3, burstRate 2.22}): three
// rounds at once, 2.22 bursts/s; spread = the wiki "Spread values" Alt Fire row 1.9 / 1.71 -> 5.78 / 5.21 deg, + crouch-walk 0 / walk
// 0.6 / run 1.5 / airborne 2.25 (ramped with speed past the deadzone like every gun); back-to-back bursts (within the cycle +
// chain s) step 1.9 -> 2.5 -> max (wiki update history). = the page's XCLA / xClassicAlt (index.html).
const CLASSIC_ALT={pellets:3,bps:2.22,chain:.3,steps:[1.9,2.5,5.78],cr:.9,move:[0,.6,1.5,2.25]};
function classicAltSpread(P,n){P=P||{};const A=CLASSIC_ALT,k=Math.min(A.steps.length-1,Math.max(0,n|0)),sp=P.sf!=null?P.sf:P.mv?1:0;let e=A.steps[k]*(P.cr?A.cr:1);
 if(P.air)e+=A.move[3];else if(sp>C.deadzone)e+=(P.cr?A.move[0]:P.wk?A.move[1]:A.move[2])*moveRamp(sp,C.deadzone);return rad(e);}
// Bucky ALT FIRE (wiki.playvalorant.com/en-us/Bucky "Air burst": a canister that detonates after 7.5 m into 5 pellets; "If a canister
// hits a target before 7.5m it will not detonate and only deal 40/20/15 damage from Head-Legs"; v3.0 "Alt fire now applies
// instantaneous, hitscan damage"; pellet distance measured from where the canister explodes, primary spread and damage table;
// valorant-api airBurstStats {shotgunPelletCount 5, burstDistance 7.5}). A canister stopped by a wall before 7.5 m bursts at the
// wall into it (no pellets come back: inferred, unpublished).
const BUCKY_ALT={dist:7.5,pellets:5,head:40,body:20,legs:15};
// Jett Tailwind dash (wiki: Dash duration 0.45 s): a constant-speed burst along (dx, dz) instead of a teleport. D = dash(...)
// {dx,dz,left,v}; dashStep moves the capsule v*dt (<= 0.25 m sub-steps) and stops at a wall / the playable leash. The server
// and the page (offline play and the online prediction) share it, so the predicted dash lands where the server's does.
function dash(f,s,look,dist,time){const sn=Math.sin(look),c=Math.cos(look);let dx=-sn*f+c*s,dz=-c*f-sn*s,len=Math.hypot(dx,dz);if(len<.001){dx=-sn;dz=-c;len=1;}return {dx:dx/len,dz:dz/len,left:dist,v:dist/time};}
function dashStep(P,D,dt,world){let s=Math.min(D.left,D.v*Math.max(0,dt));D.left-=s;const height=1.8-(P.ch||0);while(s>1e-9){const k=Math.min(.25,s);s-=k;const x=P.x+D.dx*k,z=P.z+D.dz*k;if(world.blocked(x,z,.4,P.y,height)||(world.leash&&!world.leash(x,z,P.y,P.x,P.z))){D.left=0;break;}P.x=x;P.z=z;}P.vx=P.vz=0;return D.left>1e-9;}
// Footsteps (VALORANT: running is heard, shift-walking and crouch-walking are silent, the first running step is silent - it
// builds a "step threshold" from distance moved; playvalorant.com Unrated / Riot support "Walking, Running, and Crouching").
// One rule for every unit: a unit RUNS when it moves faster than C.stepRun of its weapon's run speed (above walk speed 0.6x:
// accelerating / stopping / slowed under it is quiet) without walk / crouch; footfall() banks the distance it moves while
// running and sounds one step per C.stride (the player's 1.85 m stride), at most one per call (a long frame never bursts,
// hk-35), the rest carried; while quiet the bank drains one stride per second. The server's row flag [23] (simulation.js loud),
// the page's player, its offline bots / allies / buy-phase bots and the online remote units all use it.
C.stride=1.85;C.stepRun=.65;
function runs(speed,top,quiet){return !quiet&&speed>C.stepRun*Math.max(.1,top||0);}
function footfall(st,dist,dt,run){if(!run){st.fd=Math.max(0,(st.fd||0)-C.stride*Math.max(0,dt||0));return false;}st.fd=(st.fd||0)+Math.max(0,dist||0);if(st.fd<C.stride)return false;st.fd%=C.stride;return true;}
// Character collision (VALORANT: every living character, teammate or enemy, is a solid capsule - nobody walks through
// another, a walk into one stops at the contact and slides around it, nobody is shoved by someone walking into them).
// Each character is a vertical cylinder of radius C.bodyR (0.35 m: our estimate of VALORANT's capsule, Riot publishes no
// figure; 0.05 m inside the 0.4 m world-collision radius) from its feet to its head (1.8 m standing, less crouched). Two
// characters touch when their centres are closer than 2 x C.bodyR horizontally and their heights overlap by more than
// C.bodyLip, so a unit dropping onto a head slides off it rather than standing there.
// bodies(P, others, dt, world, ox, oz) runs after the mover P's own step ((ox, oz) = where P stood before it): the part of
// each overlap that P's step created is undone at once (a walk into someone stops at the contact; the sideways part of the
// walk is kept, so it slides around), overlap that was already there (a respawn, teleport or rescue onto someone, a unit
// landing on a head) is eased apart at C.bodySep m/s. Only P moves, never into world collision (an axis the world refuses is
// dropped), and P's velocity loses the part pointing into the other unit. Every unit runs it on its own step, so a unit
// standing still is never pushed by a walker; it only eases out of overlap it was already in.
// bodySteer(P, others, x, z) is for bots: with someone in its way less than C.bodyLook m ahead (centre to centre; contact is
// at 2 x C.bodyR, inside the two bodies' width), the walk turns to pass them - to the side away from them, on the right when
// they are dead ahead (two bots meeting head-on both keep right and pass) - from nothing at C.bodyLook to ~56 deg at the
// contact; the speed is kept. Short on purpose: a bot only sidesteps whoever it is about to bump, the rest of its walk
// (paths, holds, peeks) is its own.
// The server runs both for every unit (simulation.js, spike.js motor()) and the page for its player's prediction (moveP,
// against the units it draws) and its offline bots, so the prediction equals the server.
C.bodyR=.35;C.bodySep=3;C.bodyLip=.1;C.bodyLook=1.05;
function bodyMeet(P,Q){return P.y<Q.y+1.8-(Q.ch||0)-C.bodyLip&&Q.y<P.y+1.8-(P.ch||0)-C.bodyLip;}
function bodies(P,others,dt,world,ox,oz){
 if(!others||!others.length)return false;const R2=2*C.bodyR,sep=C.bodySep*Math.max(0,dt||0),was=ox!=null&&oz!=null;let px=0,pz=0,hit=false;
 for(const Q of others){if(!Q||Q===P||!bodyMeet(P,Q))continue;let dx=P.x-Q.x,dz=P.z-Q.z;const d=Math.hypot(dx,dz);if(d>=R2)continue;
  const d0=was?Math.hypot(ox-Q.x,oz-Q.z):d;
  if(d>1e-6){dx/=d;dz/=d;}else if(was&&d0>1e-6){dx=(ox-Q.x)/d0;dz=(oz-Q.z)/d0;}else{dx=1;dz=0;}/* exactly on top of each other: apart toward where P came from, else along +x */
  const pen=R2-d,fresh=Math.max(0,Math.min(pen,pen-Math.max(0,R2-d0))),push=fresh+Math.min(pen-fresh,sep);
  px+=dx*push;pz+=dz*push;hit=true;
  const vin=(P.vx||0)*dx+(P.vz||0)*dz;if(vin<0){P.vx=(P.vx||0)-vin*dx;P.vz=(P.vz||0)-vin*dz;}}
 if(!hit)return false;if(Math.abs(px)+Math.abs(pz)<1e-12)return true;
 const h=1.8-(P.ch||0),ok=(x,z)=>!world||(!(world.leash&&!world.leash(x,z,P.y,P.x,P.z))&&!world.blocked(x,z,.4,P.y,h));
 if(ok(P.x+px,P.z+pz)){P.x+=px;P.z+=pz;}else if(px&&ok(P.x+px,P.z))P.x+=px;else if(pz&&ok(P.x,P.z+pz))P.z+=pz;
 return true;}
function bodySteer(P,others,x,z){
 const m=Math.hypot(x,z);if(m<1e-9||!others||!others.length)return [x,z];const ux=x/m,uz=z/m,rx=-uz,rz=ux,R2=2*C.bodyR;let ahead=Infinity,side=0;
 for(const Q of others){if(!Q||Q===P||!bodyMeet(P,Q))continue;const dx=Q.x-P.x,dz=Q.z-P.z,a=dx*ux+dz*uz,l=dx*rx+dz*rz;if(a<=0||a>=C.bodyLook||Math.abs(l)>=R2||a>=ahead)continue;ahead=a;side=l>.02?-1:1;}
 if(ahead===Infinity)return [x,z];
 const k=1.5*Math.min(1,(C.bodyLook-ahead)/(C.bodyLook-R2)),sx=ux+rx*side*k,sz=uz+rz*side*k,L=Math.hypot(sx,sz);return [sx*m/L,sz*m/L];}
return {C,ROPES,ROPE,ropeFind,ropeLinks,step,dash,dashStep,runs,footfall,fallDamage,velocity,brake,groundMove,spread,bloomCap,SPREAD,CADENCE,cadenceShot,cadenceGap,cadenceOwed,CLASSIC_ALT,classicAltSpread,BUCKY_ALT,recoveryTime,recoilMove,disk,damp,approach,clipBlocked,CLIPS,REC,sprayReset,sprayBloom,sprayStep,leashGrid,leashOk,leashNear,bodies,bodySteer};
});
