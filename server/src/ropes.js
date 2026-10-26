// Bots on rope ascenders (Split). The shared motor climbs ropes (motor.cjs ROPES / ropeStep); world.js adds a nav link
// between each rope's lower and upper floor node (world.ropeLinks, 'a>b' -> {a, b, k, up}), so A* routes may run over a rope.
// ropeBot runs right after the bot brain each tick and only takes over around a rope link in the bot's route:
//  - the next hops of u.route contain a rope link and the bot is on that link's floor: walk to the rope (lower end: the hang
//    point; upper end: the step-off point on the ledge) and press Use within reach (the motor's Use edge grabs the rope);
//  - on the rope: climb toward the link's other floor (input.climb = +1 up / -1 down), facing the ledge; the motor steps the
//    bot off at the top or lets go at the bottom, after which the route continues from the link's far node.
// Bots fire from ropes like players (same motor spread state); a bot that sees an enemy while climbing keeps climbing.
import Motor from './motor.cjs';
const REACH=Motor.ROPE.reach*.75;
export function ropeBot(sim,u){const W=sim.world,R=W.ropes,links=W.ropeLinks;if(!R||!links||!links.size||!u.alive)return;
 const i=u.input||(u.input={});
 if(u.rope){const r=R[u.rope-1],go=u.ropeGo&&u.ropeGo.k===u.rope-1?u.ropeGo:null;if(go)go.on=true;const up=go?go.up:(u.y<(r.y0+r.y1)/2?1:0);
  i.forward=0;i.side=0;i.jump=false;i.walk=false;i.duck=false;i.use=false;i.climb=up?1:-1;if(!i.fire)u.look=Math.atan2(r.x-r.ex,r.z-r.ez);u.inputAt=sim.time;return;}
 i.climb=undefined;
 if(u.ropeGo&&!u.ropeGo.on&&sim.time-u.ropeGo.at<.6){/* within reach, the grab is on its way: keep pressing Use */const g=u.ropeGo,r=R[g.k];u.look=Math.atan2(u.x-(g.up?r.x:r.ex),u.z-(g.up?r.z:r.ez));i.forward=0;i.side=0;i.jump=false;i.use=!i.use;u.inputAt=sim.time;return;}
 if(u.ropeGo){/* got off (or the grab failed): continue from the link's far node */const g=u.ropeGo;u.ropeGo=null;i.use=false;if(g.on&&u.route){const k=u.route.indexOf(g.b);if(k>0)u.route.splice(0,k);}}
 const route=u.route;if(!route||!route.length||i.fire)return;
 // the hop from where the bot stands (its route may already have dropped the link's start node: within accept of it) and the next hops
 const here=W.near?W.near(u.x,u.z,u.y):-1;
 for(let j=-1;j<Math.min(3,route.length-1);j++){const L=links.get((j<0?here:route[j])+'>'+route[j+1]);if(!L)continue;const r=R[L.k],sx=L.up?r.x:r.ex,sz=L.up?r.z:r.ez,sy=L.up?r.y0:r.y1;
  if(Math.abs(u.y-sy)>.9)continue;const d=Math.hypot(u.x-sx,u.z-sz);if(d>4)return;
  u.look=Math.atan2(u.x-sx,u.z-sz);i.side=0;i.jump=false;u.inputAt=sim.time;
  if(d<=REACH&&!(u.ropeCd>0)){i.forward=0;i.use=!i.use;/* an edge every other tick until the motor grabs */u.ropeGo={...L,at:sim.time,on:false};route.splice(0,j+1);return;}
  i.use=false;i.forward=1;i.walk=d<1.5;return;}
 if(i.use)i.use=false;}
