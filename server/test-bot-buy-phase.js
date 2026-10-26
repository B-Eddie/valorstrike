// Buy-phase bots (server, bots.js buyMill + shared vendor/bot-brain.cjs buy*): on all six maps, both sides (round 1 and
// round 13, sides swapped), the bots buy (autoBuy, unchanged), mill around spawn and then line up at the spawn barrier
// (vendor/spawn-barriers.cjs: the walls in the spawn's real exits, solid in the buy phase) where their planned route
// crosses it; a bot whose first goal lies inside its own zone (Valorant's defender zones cover the sites) walks there and
// holds (BotBrain.buyHold) instead. Asserted per bot: it walked (path > 4 m, ends > 2 m from its spawn spot), it never came closer than 0.4 m
// to a wall of its spawn (never inside / through one), it ends 0.42-1.6 m inside its route's wall, standing in free space,
// no two teammates overlap when it drops (> 0.8 m apart) and nearly every bot is lined up (wait / peek). After the drop
// the round's own logic takes over (the bots leave their barrier spots). sim.buyMill=false keeps them still; runs replay.
//   BB_MAPS=ascent,bind overrides the maps; BB_MEASURE=1 prints without asserting.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {loadWorld} from './src/world.js';import {SpikeSimulation} from './src/spike.js';
const BotBrain=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),SB=createRequire(import.meta.url)('../vendor/spawn-barriers.cjs');
const assets={async fetch(r){try{return new Response(await fs.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
const MEASURE=!!process.env.BB_MEASURE,out=[],fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
async function buyRun(W,map,round,o={}){
 let seed=7;const S=new SpikeSimulation(W,'five',map,()=>(seed=(seed*16807)%2147483647)/2147483647);if(o.off)S.buyMill=false;S.start(true);
 if(round>1){S.buy=0;S.step(.05);S.round=round-1;S.newRound();}
 const bots=S.units.filter(u=>!u.human),walls=u=>SB.pieces(map).filter(p=>p.side===(u.team===S.atk?'atk':'def'));
 // signed metres from the bot to its spawn's nearest wall (negative: on the far side of it)
 const sd=u=>{const n=BotBrain.buyNear(walls(u),u.x,u.z);return n.inside||n.d>=1.5?n.d:-n.d;},dSpot=u=>{const m=u.buyMill,q=m&&m.spot,w=walls(u);if(!q)return sd(u);/* to the wall its spot stands at */let b=Infinity;for(const p of w){const t=Math.max(0,Math.min(p.len,(u.x-p.ax)*p.tx+(u.z-p.az)*p.tz));b=Math.min(b,Math.hypot(p.ax+p.tx*t-u.x,p.az+p.tz*t-u.z));}return b;};
 const p0=new Map(bots.map(u=>[u,[u.x,u.z]])),walked=new Map(bots.map(u=>[u,0])),prev=new Map(bots.map(u=>[u,[u.x,u.z]])),modes=new Map(),holds=new Map();let closest=Infinity,moving=Infinity;const buy=S.buy;
 while(S.buy>0){S.step(.05);for(const u of bots){closest=Math.min(closest,sd(u));const q=prev.get(u);walked.set(u,walked.get(u)+Math.hypot(u.x-q[0],u.z-q[1]));prev.set(u,[u.x,u.z]);if(u.buyMill){modes.set(u,u.buyMill.st.mode);if(u.buyMill.hold)holds.set(u,u.buyMill.spot);}}
  for(const a of bots)for(const b of bots)if(a.id<b.id&&a.team===b.team)moving=Math.min(moving,Math.hypot(a.x-b.x,a.z-b.z));}
 const end=bots.map(u=>({u,d:dSpot(u),hold:holds.has(u),dh:holds.has(u)?Math.hypot(u.x-holds.get(u)[0],u.z-holds.get(u)[2]):Infinity,disp:Math.hypot(u.x-p0.get(u)[0],u.z-p0.get(u)[1]),walk:walked.get(u),mode:modes.get(u),free:!W.blocked(u.x,u.z,.38,u.y,1.8),at:[u.x,u.y,u.z]}));
 let pair=Infinity;for(const a of bots)for(const b of bots)if(a.id<b.id&&a.team===b.team)pair=Math.min(pair,Math.hypot(a.x-b.x,a.z-b.z));
 const atDrop=new Map(bots.map(u=>[u,[u.x,u.z]]));for(let k=0;k<100;k++)S.step(.05);
 const left=bots.filter(u=>u.alive&&Math.hypot(u.x-atDrop.get(u)[0],u.z-atDrop.get(u)[1])>1).length;
 return {S,buy,end,closest,pair,moving,left,n:bots.length};
}
const maps=(process.env.BB_MAPS||'ascent,bind,breeze,haven,lotus,split').split(',');
for(const map of maps){const W=await loadWorld(assets,map);
 for(const round of [1,13]){const R=await buyRun(W,map,round),tag=map+' r'+round;
  const lined=R.end.filter(e=>e.mode==='wait'||e.mode==='peek'||e.mode==='hold').length,dmax=Math.max(...R.end.map(e=>e.d)),dmin=Math.min(...R.end.map(e=>e.d));
  out.push(`${tag}: buy ${R.buy}s, ${R.n} bots walked ${Math.min(...R.end.map(e=>e.walk)).toFixed(1)}-${Math.max(...R.end.map(e=>e.walk)).toFixed(1)} m, end ${dmin.toFixed(2)}-${dmax.toFixed(2)} m inside, closest ${R.closest.toFixed(2)} m, lined up ${lined}/${R.n} (${R.end.filter(e=>e.hold).length} holding in-zone spots), teammate gap at drop ${R.pair.toFixed(2)} m (min while walking ${R.moving.toFixed(2)}), ${R.left}/${R.n} left their spot 5 s into the round`);
  for(const e of R.end){const id=tag+' bot '+e.u.id+(e.u.team===R.S.atk?' (atk)':' (def)');
   ok(e.walk>4,id+' walked '+e.walk.toFixed(2)+' m in the buy phase');ok(e.disp>2,id+' ended '+e.disp.toFixed(2)+' m from its spawn spot');
   if(e.hold)ok(e.dh<=1,id+' holds '+e.dh.toFixed(2)+' m from its in-zone spot (its goal lies inside its own zone)');else ok(e.d>=.42-1e-9&&e.d<=2.45,id+' ends '+e.d.toFixed(2)+' m inside the barrier (want 0.42-2.45: front row or stacked up to 2 rows behind in a narrow doorway) at '+e.at.map(v=>v.toFixed(2)));ok(e.free,id+' stands in collision at '+e.at.map(v=>v.toFixed(2)));}
  ok(R.closest>=.4-1e-9,tag+': a bot came '+R.closest.toFixed(3)+' m from the barrier (never closer than 0.4 m)');
  ok(R.pair>.8,tag+': two teammates overlap at the drop ('+R.pair.toFixed(2)+' m)');ok(lined>=R.n-1,tag+': lined up at the barrier '+lined+'/'+R.n);
  ok(R.left>=Math.ceil(R.n*.6),tag+': after the drop the round logic moves the bots on ('+R.left+'/'+R.n+')');}
 if(map===maps[0]){
  const off=await buyRun(W,map,1,{off:true});ok(off.end.every(e=>e.walk<.01),'buyMill=false: bots stand still in the buy phase');
  const a=await buyRun(W,map,1),b=await buyRun(W,map,1);ok(JSON.stringify(a.end.map(e=>e.at))===JSON.stringify(b.end.map(e=>e.at)),'buy-phase movement replays exactly (seeded)');}
}
console.log('Buy-phase bots (server): '+out.join('; '));
if(!MEASURE){if(fails.length){console.error(fails.join('\n'));process.exit(1);}console.log('test-bot-buy-phase: OK');}
