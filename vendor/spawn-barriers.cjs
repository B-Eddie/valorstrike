// Spawn barriers (Valorant's buy-phase walls), shared by the server (spike.js world, bots.js) and the page (UMD:
// index.html inlines it in the BOT VARIETY block and reads window.SpawnBarriers; native_maps_runtime nmBlocked and the
// offline / online buy phase use it). Each team's walls stand where Valorant has them, on the boundary of that team's
// buy-phase area (tracker.gg's map overlays -> server/tools/spawn-zones.json): per map and side a list of panels,
// p = a polyline [[x, z], ...] across one doorway (wall to wall), y = [bottom, top] in world metres, in = +1 when the
// left normal (-dz, dx) of each piece faces into the spawn (-1: the right normal). Generated from the native map's
// navigation by server/tools/spawn-barriers-gen.mjs (minimum vertex cut between the team's zone and the neutral area +
// the other team's = the narrowest point of each boundary crossing, extended to the walls) and checked by
// server/test-spawn-barriers.js (on the zone boundary, no leak from any spawn node, capsule collision, bot staging), then
// sealed by server/tools/spawn-barriers-seal.mjs (hand fixes, ends grown until no real-motor run gets past, heights / feet)
// and checked by server/test-spawn-barrier-leaks.js + work/test_spawn_barrier_leaks_client.cjs (no way out on server or page).
// While the buy phase runs every panel is solid for every player and bot (movement: a 0.3 m-thick vertical slab; shots /
// sight / thrown utility: a vertical quad) and drawn as a translucent team-tinted hex wall; at round start the walls drop (no collision) and dissolve.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SpawnBarriers=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const HALF=.15;/* half the slab thickness: 0.3 m (was 0.1 m), so a long frame / fast move cannot step through it */
 // ---- DATA (server/tools/spawn-barriers-gen.mjs --write) ----
 const DATA={
  ascent:{atk:[{p:[[-38.75,8],[-33.04,8]],y:[5.67,27],in:1},{p:[[-17,7.25],[-17,12.3]],y:[5.65,27],in:1},{p:[[24.25,18.84],[24.25,26.57]],y:[8.67,27],in:-1},{p:[[30.81,8.36],[41.7,7.14]],y:[8.67,27],in:1}],def:[{p:[[-27.5,-10.75],[-22.49,-10.75]],y:[5.67,27],in:-1},{p:[[-5.63,-15.25],[2.11,-15.25]],y:[6.79,27],in:-1},{p:[[19.64,-12.25],[24.1,-12.25]],y:[8.67,27],in:-1},{p:[[45.99,-14.5],[51.68,-14.5]],y:[8.67,27],in:-1}]},
  bind:{atk:[{p:[[-41.25,15.65],[-41.25,22.31]],y:[6.52,24],in:-1},{p:[[-28.5,5.25],[-20.82,5.25]],y:[5.69,24],in:1},{p:[[3.75,-3.38],[3.75,0.07]],y:[7.55,24],in:1},{p:[[18.55,12],[24.75,12]],y:[5.71,24],in:1},{p:[[38.25,11.54],[38.25,21.26]],y:[5.38,24],in:1}],def:[{p:[[-52.15,-27.75],[-45.77,-27.75]],y:[8.54,24],in:-1},{p:[[-33.75,-19.88],[-33.75,-15.27]],y:[10.51,24],in:1},{p:[[10.5,-15],[17.25,-15]],y:[7.51,24],in:-1},{p:[[36.02,-18.75],[41.5,-18.75]],y:[6.51,24],in:-1}]},
  breeze:{atk:[{p:[[-47.11,18.69],[-39.51,15.65]],y:[3.6,27],in:1},{p:[[-42.16,31.25],[-40.25,31.25],[-40.25,37.28]],y:[3.61,27],in:-1},{p:[[-12.78,17.75],[-8.75,17.75],[-5.75,15.5],[-2.28,15.5]],y:[3.61,27],in:1},{p:[[25.5,13],[32,13]],y:[5.61,27],in:1}],def:[{p:[[-68,7.25],[-60.43,7.25]],y:[6.18,27],in:-1},{p:[[-41.75,-25.49],[-41.75,-21.25],[-41,-21.25],[-39.93,-18.03]],y:[7.59,27],in:1},{p:[[-32.75,-41.22],[-32.75,-36.25]],y:[10.62,27],in:-1},{p:[[-8.95,-37.75],[-2,-37.75]],y:[11.62,27],in:-1},{p:[[9.25,-18.66],[9.25,-11]],y:[7.46,27],in:-1},{p:[[25.2,-12.05],[26.84,-12.6],[27.7,-13.12],[28.08,-14.03],[31.75,-15.25],[31.75,-16],[34,-16],[37,-18.25],[46.41,-18.25]],y:[7.62,27],in:-1}]},
  haven:{atk:[{p:[[-36,25.93],[-36,31.55]],y:[4.59,27],in:-1},{p:[[-14.44,28.25],[-9.96,28.25]],y:[4.61,27],in:1},{p:[[3,17.79],[3,22.92]],y:[6.61,27],in:-1},{p:[[8.41,26],[20.75,26]],y:[6.61,27],in:1}],def:[{p:[[-27.79,1.25],[-15.75,1.25]],y:[4.61,27],in:-1},{p:[[-9,-5.5],[-3.82,-5.5]],y:[6.61,27],in:-1},{p:[[27,-10.81],[27,-6.14]],y:[6.03,27],in:-1},{p:[[41,-4.75],[46.62,-4.75]],y:[4.88,27],in:-1},{p:[[-52.5,5.2],[-47,5.2]],y:[5.5,27],in:-1}]},
  lotus:{atk:[{p:[[-18.75,29.25],[-18.75,40.24],[-17.25,40.24]],y:[4.38,19],in:-1},{p:[[-17.25,40.24],[-17.25,46.94]],y:[4.9,19],in:-1},{p:[[-5.26,29],[2.2,29]],y:[5.9,19],in:1},{p:[[15.01,19.25],[19.48,19.25]],y:[5.88,19],in:1}],def:[{p:[[-17.73,0.5],[-12.1,0.5]],y:[4.92,19],in:-1},{p:[[13.5,-12.87],[13.5,-8.5]],y:[5.9,19],in:1},{p:[[23.36,-14.5],[30.37,-14.5]],y:[5.9,19],in:-1},{p:[[45.75,-19],[51.67,-19]],y:[5.91,19],in:-1}]},
  split:{atk:[{p:[[-37.9,16.75],[-35,16.75],[-33.5,18.25],[-25.44,18.25]],y:[6.61,27],in:1},{p:[[-18.27,12.9],[-18,14.52],[-16.87,21.27]],y:[6.02,27],in:1},{p:[[16,11.81],[16,16.41]],y:[6.64,27],in:-1},{p:[[47.62,9.25],[55.75,9.25]],y:[6.61,27],in:1}],def:[{p:[[-51.67,-5],[-45.07,-5]],y:[6.58,27],in:-1},{p:[[-12.5,-3.91],[-12.5,0.63]],y:[11.86,27],in:1},{p:[[0.29,-7.25],[4.39,-7.25]],y:[10.12,27],in:-1},{p:[[19.25,-8.75],[28.37,-8.75]],y:[10.13,27],in:-1},{p:[[38.5,-12.5],[43.76,-12.5]],y:[4.6,27],in:-1}]}
 };
 // ---- END DATA ----
 const CACHE={};
 // flat pieces for a map: {ax, az, bx, bz, y0, y1, side: 'atk' | 'def', nx, nz: unit normal into that spawn, len, tx, tz: unit along}
 function pieces(map){if(CACHE[map])return CACHE[map];const M=DATA[map],L=[];if(M)for(const side of ['atk','def'])for(const P of M[side]||[])for(let i=1;i<P.p.length;i++){
   const [ax,az]=P.p[i-1],[bx,bz]=P.p[i],len=Math.hypot(bx-ax,bz-az);if(len<1e-6)continue;const tx=(bx-ax)/len,tz=(bz-az)/len;L.push({ax,az,bx,bz,y0:P.y[0],y1:P.y[1],side,nx:-tz*P.in,nz:tx*P.in,len,tx,tz});}
  return CACHE[map]=L;}
 function has(map){return !!DATA[map];}
 function dist2(s,x,z){const t=Math.max(0,Math.min(s.len,(x-s.ax)*s.tx+(z-s.az)*s.tz)),px=s.ax+s.tx*t-x,pz=s.az+s.tz*t-z;return px*px+pz*pz;}
 // a capsule of radius r standing at (x, y, z), height h, touches a wall (the motor's world.blocked contract)
 function blocked(map,x,z,r,y,h){const L=pieces(map);if(!L.length)return false;if(h==null)h=1.8;const y0=y+.025,y1=y+h,R=(r||0)+HALF;
  for(const s of L){if(y1<=s.y0||y0>=s.y1)continue;if(dist2(s,x,z)<R*R)return true;}return false;}
 // first wall a ray o + d t (d unit) meets before max -> {distance, piece} | null (shots, sight, thrown utility)
 function ray(map,o,d,max){const L=pieces(map);let best=null,bt=max==null?Infinity:max;
  for(const s of L){const den=d[0]*s.nx+d[2]*s.nz;/* d . n */if(Math.abs(den)<1e-9)continue;const t=((s.ax-o[0])*s.nx+(s.az-o[2])*s.nz)/den;if(!(t>0&&t<bt))continue;
   const px=o[0]+d[0]*t,pz=o[2]+d[2]*t,u=(px-s.ax)*s.tx+(pz-s.az)*s.tz,py=o[1]+d[1]*t;if(u<0||u>s.len||py<s.y0||py>s.y1)continue;bt=t;best={distance:t,piece:s};}
  return best;}
 // the 2-D segment a -> b crosses (or passes within r of) a wall whose height span holds y -> the piece | null
 function crossing(map,ax,az,bx,bz,y,r){const L=pieces(map);r=r||0;for(const s of L){if(y!=null&&(y<s.y0-.5||y>s.y1))continue;if(segSeg(ax,az,bx,bz,s.ax,s.az,s.bx,s.bz)||(r>0&&(dist2(s,ax,az)<r*r||dist2(s,bx,bz)<r*r||segDist2(ax,az,bx,bz,s)<r*r)))return s;}return null;}
 function segSeg(ax,az,bx,bz,cx,cz,dx,dz){const o=(px,pz,qx,qz,rx,rz)=>Math.sign((qx-px)*(rz-pz)-(qz-pz)*(rx-px));const a=o(ax,az,bx,bz,cx,cz),b=o(ax,az,bx,bz,dx,dz),c=o(cx,cz,dx,dz,ax,az),d=o(cx,cz,dx,dz,bx,bz);return a*b<0&&c*d<0;}
 function segDist2(ax,az,bx,bz,s){let m=Infinity;const l=Math.hypot(bx-ax,bz-az);if(l<1e-9)return dist2(s,ax,az);for(let k=0;k<=8;k++){const t=k/8;m=Math.min(m,dist2(s,ax+(bx-ax)*t,az+(bz-az)*t));}
  // end points of the wall against a -> b
  for(const [px,pz] of [[s.ax,s.az],[s.bx,s.bz]]){const t=Math.max(0,Math.min(1,((px-ax)*(bx-ax)+(pz-az)*(bz-az))/(l*l))),qx=ax+(bx-ax)*t-px,qz=az+(bz-az)*t-pz;m=Math.min(m,qx*qx+qz*qz);}return m;}
 // nearest wall of a side to (x, z) -> {piece, d: horizontal distance, t: metres along it, inside: on the spawn side}
 function nearest(map,side,x,z){let best=null;for(const s of pieces(map)){if(side&&s.side!==side)continue;const d=Math.sqrt(dist2(s,x,z));if(!best||d<best.d){const t=Math.max(0,Math.min(s.len,(x-s.ax)*s.tx+(z-s.az)*s.tz));best={piece:s,d,t,inside:(x-s.ax)*s.nx+(z-s.az)*s.nz>=0};}}return best;}
 // drop animation (round start): 0..1 progress -> {alpha, sink: metres the wall has sunk, glow}; the wall flashes, then
 // sinks into the floor and fades in DROP s (Valorant: a bright pulse and the walls dissolve as the round starts). h = the
 // wall's height (barrier-3: tops go to the sky, 12 - 22 m): it sinks its whole height (at least 2.5 m), so it is under the
 // floor when it hides at DROP s, as the 3 - 6 m walls were
 const DROP=.6;function drop(t,h){const k=Math.max(0,Math.min(1,t/DROP));return {alpha:(1-k)*(1-k),sink:k*k*Math.max(2.5,+h||0),glow:k<.25?1+k*4:Math.max(0,2-(k-.25)*2.6)};}
 // replace one map's panels (generator / tests)
 function set(map,v){if(v)DATA[map]=v;else delete DATA[map];delete CACHE[map];}
 return {DATA,set,HALF,DROP,has,pieces,blocked,ray,crossing,nearest,drop,segSeg};
});
