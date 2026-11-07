// Crosshair placement when holding an angle (bug 8, user 2026-11-06: "bad crosshair placement when bots hold angles").
// A bot standing on a defender spot of a real site (BotRoutes.spot 2-10 m round the site, as spike.js picks them), facing
// the way it walked in from its spawn, with nothing heard or seen: its idle view (botView -> holdLook) settles for 3 s, then
// an attacker walks the A* route from the attacker spawn onto the site. The tick the attacker's head first comes into a
// clear line from the bot's eye (no view cone): the angle between the bot's crosshair (yaw + pitch) and the head.
//  - median <= 15 deg and >= 50 % within 15 deg (N=12: before 74.2 deg / 22.5 %, after 6.1 deg / 59.2 %; before: the hold looked only toward the enemy spawn and only inside
//    the bot's current view, so a bot that walked in facing a wall kept facing it);
//  - pitch: the crosshair sits at head height - median |pitch - head centre (1.815 m)| <= 2.5 deg, and never on the floor
//    (pitch more than 8 deg under the head in < 10 % of cases);
//  - human, not an aimbot: under 30 % of first sights within 2 deg.
// Unit: BotBrain.holdCorners puts the corner at the edge of cover on the way in, at PRE.head, and ranks near chokes first.
//   node test-bot-hold-aim.js     (MAPS=ascent,bind,haven; N=spots per site; PROBE=1 prints and never fails)
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
import {SpikeSimulation} from './src/spike.js';import {loadWorld} from './src/world.js';import {botView,persona} from './src/bots.js';import {path} from './src/path.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),R=createRequire(import.meta.url)('../vendor/bot-routes.cjs');
const MAPS=(process.env.MAPS||'ascent,bind,haven').split(','),NS=+(process.env.N||6),PROBE=!!process.env.PROBE,D=180/Math.PI,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
// 1. unit: a corridor along +z from the bot, a wall hides everything past z = 6 except the lane at x 3
{const pts=[[0,0,1],[0,0,2],[0,0,3],[0,0,4],[0,0,5],[0,0,6],[0,0,7],[3,0,8],[3,0,9]],vis=q=>q[2]<=6.5;
 const A=B.holdCorners([{pts,w:1}],vis,0,0,0);assert.equal(A.length,1);assert.deepEqual([A[0].x,A[0].y,A[0].z],[0,B.PRE.head,6.5],'the corner: midway between the last point in sight and the first hidden one, at head height');
 const near=[[0,0,1],[0,0,2],[0,0,3]],far=[[5,0,0],[10,0,0],[15,0,0],[20,0,0]];const C=B.holdCorners([{pts:far,w:1},{pts:near,w:1}],q=>q[0]<12&&q[2]<2.5,0,0,0);
 assert.ok(C.length===2&&C[0].z===2.5,'a near choke ranks above a far one of the same weight');
 assert.equal(B.holdCorners([{pts:[[0,0,1],[0,0,2]],w:1}],q=>q[2]<1.5,0,0,0).length,0,'a corner at the shoulder (< HOLD.near m) is no angle');
 const r=B.rng(7),ks=new Set(),Aw=[{w:4},{w:2},{w:1}];let main=0;for(let i=0;i<400;i++){const n=B.holdNext(Aw,r);if(!n.k)main++;ks.add(n.k);assert.ok(n.dwell>=B.HOLD.dwell[0]&&n.dwell<=B.HOLD.dwell[1]);}assert.deepEqual([...ks].sort(),[0,1,2],'checks its other angles now and then');assert.ok(main>.6*400&&main<.85*400,'mostly the best angle ('+main+'/400)');}
// 2. real maps
const assets={async fetch(r){try{return new Response(await fs.readFile(new URL('./public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
const res=[];
for(const map of MAPS){const W=await loadWorld(assets,map),N=W.nav.nodes,M=W.map;
 for(const site of Object.keys(M.sites))for(let k=0;k<NS;k++){
  const S=new SpikeSimulation(W,'five',map,B.rng(100+k));const b=S.add('Bot Hold'+k,'Sage',false),e=S.add('Walker','Jett',true);S.phase='game';S.buy=0;S.round=1;S.remaining=90;S.atk=1;
  const c=M.sites[site],q=R.spot(W.nav,c,[],B.rng(B.hash(map+site+k)),{rMin:2,rMax:10,gap:4,ok:i=>!W.allowed||W.allowed.has(i)});if(q<0)continue;const n=N[q];
  const ds=W.near(M.defender[0],M.defender[2],M.defender[1]),into=path(W,ds,q);if(!into||into.length<3)continue;const pv=N[into[into.length-3]];
  Object.assign(b,{team:0,x:n[0],y:n[1],z:n[2],look:Math.atan2(pv[0]-n[0],pv[2]-n[2]),loading:false,alive:true});persona(S,b);b.pitch=B.idlePitch(persona(S,b).brain);
  const as=W.near(M.attacker[0],M.attacker[2],M.attacker[1]),route=path(W,as,W.near(c[0],c[2],c[1]));Object.assign(e,{team:1,x:N[as][0],y:N[as][1],z:N[as][2],loading:false,alive:true});
  S.spike={st:'carry',carrier:e.id,site,x:0,y:0,z:0,t:45,pt:0,dt:0};
  const dt=.05;for(let i=0;i<60;i++){S.time+=dt;b.input={};b.inputAt=S.time;const L0=b.look;botView(S,b,L0,dt);}
  let hit=null,j=0,fx=e.x,fz=e.z;const eye=()=>[b.x,b.y+1.6,b.z];
  for(let i=0;i<4000&&!hit&&j<route.length;i++){S.time+=dt;let step=5.4*dt;while(step>0&&j<route.length){const t=N[route[j]],dx=t[0]-fx,dz=t[2]-fz,l=Math.hypot(dx,dz);if(l<=step){fx=t[0];fz=t[2];e.y=t[1];step-=l;j++;}else{fx+=dx/l*step;fz+=dz/l*step;step=0;}}e.x=fx;e.z=fz;
   b.input={};b.inputAt=S.time;const L0=b.look;botView(S,b,L0,dt);const head=[e.x,e.y+1.815,e.z],d=Math.hypot(e.x-b.x,e.z-b.z);
   if(d<45&&S.canSee(b,e,eye(),head)){const want=Math.atan2(-(e.x-b.x),-(e.z-b.z)),ey=wrap(b.look-want),ep=b.pitch-Math.atan2(head[1]-(b.y+1.6),d);hit={a:Math.hypot(ey,ep)*D,ey:Math.abs(ey)*D,ep:ep*D,d};}}
  if(hit)res.push({map,site,...hit});}}
const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[s.length>>1]:NaN;},pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1);
const m=med(res.map(r=>r.a)),in15=res.filter(r=>r.a<=15).length,pm=med(res.map(r=>Math.abs(r.ep))),floor=res.filter(r=>r.ep<-8).length,snap=res.filter(r=>r.a<=2).length;
for(const map of MAPS){const a=res.filter(r=>r.map===map);console.log(`  ${map}: n ${a.length} median ${med(a.map(r=>r.a)).toFixed(1)} deg, within 15 deg ${pc(a.filter(r=>r.a<=15).length,a.length)} %, |pitch| ${med(a.map(r=>Math.abs(r.ep))).toFixed(1)} deg`);}
console.log(`hold aim at first sight: n ${res.length}, median ${m.toFixed(1)} deg (yaw ${med(res.map(r=>r.ey)).toFixed(1)}), within 15 deg ${pc(in15,res.length)} %, within 2 deg ${pc(snap,res.length)} %, |pitch - head| median ${pm.toFixed(1)} deg, >8 deg low ${pc(floor,res.length)} %, d ${med(res.map(r=>r.d)).toFixed(1)} m`);
const fails=[];if(res.length<20)fails.push(`enough first sights (${res.length} >= 20)`);
if(!(m<=15))fails.push(`median ${m.toFixed(1)} deg (<= 15)`);if(in15<.5*res.length)fails.push(`within 15 deg ${pc(in15,res.length)} % (>= 50 %)`);
if(!(pm<=2.5))fails.push(`pitch median ${pm.toFixed(1)} deg off the head (<= 2.5)`);if(floor>=.1*res.length)fails.push(`crosshair > 8 deg under the head ${pc(floor,res.length)} % (< 10 %)`);
if(snap>=.3*res.length)fails.push(`aimbot-like: ${pc(snap,res.length)} % within 2 deg (< 30 %)`);
if(fails.length&&!PROBE){console.error('FAIL test-bot-hold-aim\n - '+fails.join('\n - '));process.exit(1);}
console.log(fails.length?'PROBE (would fail): '+fails.join('; '):'test-bot-hold-aim ok');
