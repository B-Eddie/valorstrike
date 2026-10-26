// Spawn barriers (Valorant's buy-phase walls), shared by the server (spike.js world, bots.js) and the page (UMD:
// index.html inlines it in the BOT VARIETY block and reads window.SpawnBarriers; native_maps_runtime nmBlocked and the
// offline / online buy phase use it). Each spawn's walls stand in its real exits: per map and side a list of panels,
// p = a polyline [[x, z], ...] across one doorway (wall to wall), y = [bottom, top] in world metres, in = +1 when the
// left normal (-dz, dx) of each piece faces into the spawn (-1: the right normal). Generated from the native map's
// navigation by server/tools/spawn-barriers-gen.mjs (minimum vertex cut between the spawn core and the rest of the map
// = the narrowest doorways, extended to the walls) and checked by server/test-spawn-barriers.js (no leak from any
// spawn node, capsule collision, bot staging). While the buy phase runs every panel is solid for every player and bot
// (movement: a 0.1 m-thick vertical slab; shots / sight / thrown utility: a vertical quad) and drawn as a translucent
// team-tinted hex wall; at round start the walls drop (no collision) and dissolve.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SpawnBarriers=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const HALF=.05;/* half the slab thickness */
 // ---- DATA (server/tools/spawn-barriers-gen.mjs --write) ----
 const DATA={
  ascent:{atk:[{p:[[-18,38.75],[-11.5,38.75]],y:[6.67,10.07],in:1},{p:[[12.45,36.42],[15.15,40.91]],y:[7.67,14.07],in:1},{p:[[15.15,40.91],[15.25,48.75]],y:[7.67,11.07],in:1}],def:[{p:[[-17.75,-45.09],[-17.75,-39.75]],y:[6,9.4],in:-1},{p:[[-6.7,-31.75],[-2.24,-31.75]],y:[7.67,14.07],in:-1},{p:[[10.89,-40.75],[17.3,-40.75]],y:[8.67,14.2],in:-1},{p:[[16,-52.08],[16,-46.5]],y:[8.85,12.79],in:1}]},
  bind:{atk:[{p:[[-7.53,54.75],[-0.41,54.75]],y:[3.67,7.07],in:1},{p:[[5.75,57.75],[13.63,57.75]],y:[3.82,7.22],in:1}],def:[{p:[[-11.02,-59.25],[-5.05,-59.25]],y:[6.51,11.05],in:-1},{p:[[5.31,-57.75],[10.28,-57.75]],y:[6.51,11.05],in:-1}]},
  breeze:{atk:[{p:[[-10.64,38],[-5.75,38],[-5.75,36.4]],y:[3.54,9.94],in:1},{p:[[4.97,31.25],[12.39,31.5]],y:[3.64,10.04],in:1},{p:[[12.39,31.5],[13,36.75]],y:[3.61,9.29],in:1}],def:[{p:[[-12.5,-44.75],[-12.5,-39.41]],y:[10.76,17.16],in:-1},{p:[[-3.27,-31],[-0.25,-31]],y:[11.62,15.89],in:-1}]},
  haven:{atk:[{p:[[-17.55,44.75],[-12.92,44.75]],y:[5.86,10.47],in:1},{p:[[-0.64,38.75],[3.48,38.75]],y:[6.61,12.77],in:1}],def:[{p:[[-21,-38.31],[-21,-32.65]],y:[6.61,10.02],in:-1},{p:[[13,-36.21],[18.34,-36.63]],y:[6.61,13.02],in:-1},{p:[[18,-42.95],[18.34,-36.63]],y:[6.61,13.02],in:1}]},
  lotus:{atk:[{p:[[-12,39.78],[-12,47.21]],y:[5.4,9.91],in:-1},{p:[[-5.11,29],[0.04,29]],y:[5.9,9.3],in:1},{p:[[10.5,29.29],[10.5,35.57]],y:[5.9,12.3],in:1}],def:[{p:[[-16.5,-37.25],[-16.5,-29.27]],y:[5.9,12.3],in:-1},{p:[[1.5,-23],[1.5,-17.55]],y:[7.86,14.26],in:-1},{p:[[13.5,-36.69],[13.5,-31.81]],y:[7.07,10.47],in:1}]},
  split:{atk:[{p:[[-16.25,35.82],[-16.25,41.12]],y:[6.61,10.02],in:-1},{p:[[12.25,34.62],[12.25,39.67]],y:[6.61,10.02],in:1}],def:[{p:[[-4.25,-32.27],[-4.25,-27.21]],y:[8.62,12.02],in:-1},{p:[[10.75,-40.03],[10.75,-35.63]],y:[8.62,15.02],in:1}]}
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
 // sinks into the floor and fades in DROP s (Valorant: a bright pulse and the walls dissolve as the round starts)
 const DROP=.6;function drop(t){const k=Math.max(0,Math.min(1,t/DROP));return {alpha:(1-k)*(1-k),sink:k*k*2.5,glow:k<.25?1+k*4:Math.max(0,2-(k-.25)*2.6)};}
 // replace one map's panels (generator / tests)
 function set(map,v){if(v)DATA[map]=v;else delete DATA[map];delete CACHE[map];}
 return {DATA,set,HALF,DROP,has,pieces,blocked,ray,crossing,nearest,drop,segSeg};
});
