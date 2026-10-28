// Flash reads (bots-tune-4, item 3): how often an enemy flash that would blind a bot actually does, and what a blinded bot
// does. Real SpikeSimulation steps at 20 Hz (worker.js), a human caster throws Flashpoint (Breach, 0.5 s), Curveball
// (Phoenix, 0.6 s) or Guiding Light (Skye, stand-in pop 0.3 s) at a bot that faces the pop point (within 25 deg) 3-12 m away.
// Scenarios: 'cover' = thrown from out of the bot's sight (the caster's body blocks no sight line but its own), 'fight' = the
// caster is in sight (the bot is fighting it). Usage: node tools/bot-flash-bench.mjs [--before] [--json] [N]
//   --before: the pre-item-3 behaviour on the same tool (no flash reads, a blinded bot stands still).
import {SpikeSimulation} from '../src/spike.js';import {persona} from '../src/bots.js';import {createRequire} from 'node:module';
const B=createRequire(import.meta.url)('../../vendor/bot-brain.cjs');
const before=process.argv.includes('--before')&&import.meta.url===new URL('file://'+process.argv[1]).href,json=process.argv.includes('--json'),N=+(process.argv.find(a=>/^\d+$/.test(a))||80);
if(before){SpikeSimulation.prototype.flashDodge=()=>false;SpikeSimulation.prototype.blindInput=()=>({});}
const DT=+(process.env.BENCH_DT||.05);
const NAMES=['Bot Sage','Bot Omen','Bot Raze','Bot Sova','Bot Killjoy','Bot Jett','Bot Cypher','Bot Viper','Bot Reyna','Bot Yoru'];
function world(cover){const C={p:null};const nodes=[],adj=[];for(let i=0;i<11;i++)for(let j=0;j<11;j++){nodes.push([i*3-15,0,j*3-15]);const k=i*11+j,a=[];if(i>0)a.push(k-11);if(i<10)a.push(k+11);if(j>0)a.push(k-1);if(j<10)a.push(k+1);adj.push(a);}
 const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
 // cover: a ray that passes within 1.2 m of the caster (not one starting at it) stops there, and canSee never sees the caster:
 // the caster is out of sight, the pop point is not
 const ray=(o,d,max)=>{const c=C.p;if(!cover||!c)return Infinity;const w=[c.x-o[0],c.y+1-o[1],c.z-o[2]];if(Math.hypot(...w)<.6)return Infinity;const t=w[0]*d[0]+w[1]*d[1]+w[2]*d[2];if(t<0||t>(max??1e9))return Infinity;const q=[o[0]+d[0]*t-c.x,o[1]+d[1]*t-c.y-1,o[2]+d[2]*t-c.z];return Math.hypot(...q)<1.2?Math.max(0,t-1.2):Infinity;};
 return {W:{map:{attacker:[-12,0,12],defender:[12,0,-12],sites:{A:[0,0,0]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray},C};}
function trial(k,agent,cover){const {W,C}=world(cover),s=new SpikeSimulation(W,undefined,undefined,B.rng(500+k));const c=s.add('Caster',agent,true),v=s.add(NAMES[k%NAMES.length],'Sage',false);
 s.start(false);s.buy=0;s.roundDelay=0;C.p=c;if(cover){const cs=s.canSee.bind(s);s.canSee=(u,w,o,p)=>w===c||u===c?false:cs(u,w,o,p);}const r=B.rng(9000+k),dist=3+r()*9,ang=(r()-.5)*1.2;
 // the pop 'dist' m in front of the bot; caster placed so its throw lands there
 Object.assign(v,{x:0,y:0,z:0,look:0,pitch:0,team:1-c.team,loading:false,alive:true,hp:100});v.persona=null;persona(s,v).r=B.rng(k*13+5);
 const pop=[Math.sin(ang)*-dist,0,-Math.cos(ang)*dist];let d,o;
 if(agent==='Phoenix'){/* Curveball: 5 m ahead then 2.5 m left of the caster's aim */const yaw=r()*Math.PI*2,f=[-Math.sin(yaw),0,-Math.cos(yaw)],l=[f[2],0,-f[0]];o=[pop[0]-f[0]*5+l[0]*2.5,0,pop[2]-f[2]*5+l[2]*2.5];c.look=yaw;d=f;}
 else{const L=agent==='Skye'?6+r()*6:14,yaw=r()*Math.PI*2;d=[-Math.sin(yaw),0,-Math.cos(yaw)];o=[pop[0]-d[0]*L,0,pop[2]-d[2]*L];c.look=yaw;if(agent==='Skye')d=[...d];}
 Object.assign(c,{x:o[0],y:0,z:o[2],pitch:0,loading:false});c.ability={...c.ability,q:1,e:1,c:1};
 const key=agent==='Phoenix'?'e':agent==='Breach'?'q':'e';v.weapon='Vandal';v.primary='Vandal';v.ammo=25;
 if(!cover){/* fight: the bot has the caster in sight and is fighting it for 0.6 s before the throw */const h=c.hp;for(let i=0;i<Math.round(.6/DT);i++){c.input={};c.inputAt=s.time;c.hp=1e9;s.step(DT);}c.hp=h;s.events.length=0;if(!v.sawTarget)return null;}
 /* the open bench world has no wall for a human Breach's Flashpoint to pass through (abilities.js breachWall): cast it with the bot rule (the aim point) */
 const hu=c.human;if(agent==='Breach')c.human=false;const ok=s.command(c,{t:'ab',k:key,d:[d[0],0,d[2]]});c.human=hu;if(!ok)return null;const e=s.effects.find(x=>x.kind==='flash');if(!e)return null;
 // the bot faces the real pop point within 25 deg
 const q=[e.p[0]-v.x,e.p[2]-v.z],toward=Math.atan2(-q[0],-q[1]);v.look=toward+(r()-.5)*.87;v.pitch=0;
 const R={agent,cover,dist:Math.hypot(q[0],q[1]),windup:e.at-s.time,read:false,blind:0,acts:null,shots:0,moved:0,turned:0};const y0=v.look;let x0=null,shot0=0,maxT=0;
 for(let i=0;i<Math.ceil((e.at-s.time+2.6)/DT);i++){c.input={};c.inputAt=s.time;c.hp=1e9;s.step(DT);if(v.fdg&&v.fdg.id===e.id)R.read=true;
  if(s.time<=e.at+.06)maxT=Math.max(maxT,Math.abs(B.wrapA(v.look-y0)));
  if(v.blindUntil>s.time){if(!R.blind){R.blind=v.blindUntil-s.time+.05;x0=[v.x,v.z];}if(!R.acts&&v.bPlay&&v.bPlay.k===v.blindUntil)R.acts=v.bPlay.act;for(const ev of s.events)if(ev[0]==='s'&&ev[1]===v.id)R.shots++;}
  else if(x0&&!R.moved)R.moved=Math.hypot(v.x-x0[0],v.z-x0[1]);
  s.events.length=0;if(!v.alive)break;}
 if(R.blind&&!R.acts)R.acts='none';if(x0&&!R.moved)R.moved=Math.hypot(v.x-x0[0],v.z-x0[1]);
 R.turned=maxT;return R;}
export function scenario(agent,cover,N){const T=[];for(let k=0;k<N;k++){const t=trial(k,agent,cover);if(t)T.push(t);}
 const bl=T.filter(t=>t.blind>0),acts={},rd=T.filter(t=>t.read);for(const t of bl)acts[t.acts]=(acts[t.acts]||0)+1;
 return {n:T.length,read:+(100*rd.length/T.length).toFixed(1),blinded:+(100*bl.length/T.length).toFixed(1),readBlinded:+(100*rd.filter(t=>t.blind>0).length/Math.max(1,rd.length)).toFixed(1),
  windup:+(T[0]?.windup||0).toFixed(2),acts,shotsWhileBlind:+(bl.reduce((a,t)=>a+t.shots,0)/Math.max(1,bl.length)).toFixed(2),movedWhileBlind:+(bl.reduce((a,t)=>a+t.moved,0)/Math.max(1,bl.length)).toFixed(2)};}
if(import.meta.url===new URL('file://'+process.argv[1]).href){const out={};for(const agent of ['Breach','Phoenix','Skye'])for(const cover of [true,false])out[agent+(cover?' cover':' fight')]=scenario(agent,cover,N);
 if(json)console.log(JSON.stringify(out));else for(const k in out)console.log(k.padEnd(16),JSON.stringify(out[k]));}
