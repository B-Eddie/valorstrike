// Corner duels (bots-tune-4, item 3b): a bot that knows where an enemy holds (heard it there) takes the corner, the holder
// holds the angle (crosshair on the near corner edge, never moves off its spot). Real Simulation steps at 20 Hz (worker.js),
// Vandals, 150 HP each, to the first kill or 7 s. Geometry: a solid block x [-20, 0] z [-20, -2]; the peeker starts at
// (-5, 0, 2) south of it, the holder stands at (hx, 0, -11) east of it: the line opens as the peeker clears the corner (0, -2).
// The holder's crosshair sits on the near corner edge give or take up to 12 deg.
// hx 4 = a close angle, 9 = a long one. Reports peeker win %, peek styles, peeker time exposed before the first shot fired
// at it, both sides' time from first sight to first damage. Usage: node tools/bot-peek-bench.mjs [--before] [--json] [N]
//   --before: the pre-item-3b behaviour on the same tool (no peek styles: the peeker runs its path round the corner).
import {Simulation} from '../src/simulation.js';import {persona} from '../src/bots.js';import {createRequire} from 'node:module';
const B=createRequire(import.meta.url)('../../vendor/bot-brain.cjs');
const main=import.meta.url===new URL('file://'+process.argv[1]).href,before=main&&process.argv.includes('--before'),json=process.argv.includes('--json'),N=+(main&&process.argv.find(a=>/^\d+$/.test(a))||60);
const NAMES=['Bot Sage','Bot Omen','Bot Raze','Bot Sova','Bot Killjoy','Bot Jett','Bot Cypher','Bot Viper','Bot Reyna','Bot Yoru','Bot Breach','Bot Skye'];
const BOX=[-20,0,-20,-2],inBox=(x,z,r=0)=>x>BOX[0]-r&&x<BOX[1]+r&&z>BOX[2]-r&&z<BOX[3]+r;
function ray(o,d,max){/* slab test against the block in x / z (full height) */let t0=0,t1=max??1e9;for(const [a,lo,hi] of [[0,BOX[0],BOX[1]],[2,BOX[2],BOX[3]]]){if(Math.abs(d[a])<1e-9){if(o[a]<lo||o[a]>hi)return Infinity;continue;}let u=(lo-o[a])/d[a],v=(hi-o[a])/d[a];if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return Infinity;}return t0;}
function world(){const nodes=[],adj=[],idx=new Map();for(let x=-14;x<=14;x+=2)for(let z=-20;z<=8;z+=2){if(inBox(x,z,.6))continue;idx.set(x+','+z,nodes.length);nodes.push([x,0,z]);}
 for(const [k,i] of idx){const [x,z]=k.split(',').map(Number),a=[];for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2]]){const j=idx.get((x+dx)+','+(z+dz));if(j!=null)a.push(j);}adj[i]=a;}
 const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
 return {map:{attacker:[-5,0,6],defender:[8,0,-16],sites:{A:[8,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:(x,z,r)=>inBox(x,z,r||.4),ray};}
export function duel(k,hx){const s=new Simulation(world(),'tdm','ascent',B.rng(700+k));s.phase='game';s.remaining=1e9;s.maxKills=1e9;
 const p=s.add(NAMES[k%NAMES.length],'Jett',false),h=s.add(NAMES[(k+5)%NAMES.length]+' H','Sage',false);if(before){p.peekOff=true;h.peekOff=true;}
 Object.assign(p,{team:0,x:-5,y:0,z:2,look:Math.PI/2,weapon:'Vandal',ammo:25,hp:100,armor:50,loading:false,protectedUntil:0,invulnerableUntil:0});
 const hr=B.rng(4242+k),corner=Math.atan2(hx-0,-11-(-2))+(hr()-.5)*2*(hr()*12*Math.PI/180);/* the holder's crosshair: on the near corner edge, off by up to 12 deg (Gold placement median ~6 deg) */Object.assign(h,{team:1,x:hx,y:0,z:-11,look:corner,weapon:'Vandal',ammo:25,hp:100,armor:50,loading:false,protectedUntil:0,invulnerableUntil:0});
 for(const u of [p,h]){u.persona=null;persona(s,u).r=B.rng(k*11+(u===p?1:2));u.pitch=B.idlePitch(persona(s,u).brain);}
 const P=persona(s,h);P.hold=1;h.holdUntil=1e9;h.nextHoldAt=1e9;/* the holder never leaves its spot */
 p.mem=B.memNew();B.memNote(p.mem,h.id,h.x,0,h.z,0,'heard');/* the peeker heard the holder there */
 const R={style:null,win:null,pSee:-1,hSee:-1,pDmg:-1,hDmg:-1,exposed:-1,t:0};let firstShotAtP=-1;
 for(let i=0;i<140;i++){B.memNote(p.mem,h.id,h.x,0,h.z,s.time,'heard');h.x=hx;h.z=-11;h.vx=0;h.vz=0;s.step(.05);if(p.pkSt&&!R.style)R.style=p.pkSt.style;
  const see=ray([h.x,1.6,h.z],(()=>{const q=[p.x-h.x,0,p.z-h.z],l=Math.hypot(q[0],q[2]);return [q[0]/l,0,q[2]/l];})(),Math.hypot(p.x-h.x,p.z-h.z))===Infinity;
  if(see&&R.pSee<0){R.pSee=s.time;R.hSee=s.time;R.v0=Math.hypot(p.vx||0,p.vz||0);}
  for(const e of s.events){if(e[0]==='s'&&e[1]===h.id&&firstShotAtP<0)firstShotAtP=s.time;if(e[0]==='h'||e[0]==='d'){}}
  if(R.pDmg<0&&h.hp+h.armor<150)R.pDmg=s.time;if(R.hDmg<0&&p.hp+p.armor<150)R.hDmg=s.time;s.events.length=0;
  if(!p.alive||!h.alive){R.win=p.alive?'peeker':'holder';R.diedJig=!p.alive&&!!p.pkSt&&p.pkSt.style==='jiggle';break;}}
 R.exposed=R.pSee<0?-1:(firstShotAtP<0?(R.win?7:-1):firstShotAtP-R.pSee);R.style=R.style||'none';R.pTtd=R.pSee>=0&&R.pDmg>=0?R.pDmg-R.pSee:-1;R.hTtd=R.hSee>=0&&R.hDmg>=0?R.hDmg-R.hSee:-1;return R;}
const med=a=>{const b=a.filter(x=>x>=0).sort((x,y)=>x-y);return b.length?+b[b.length>>1].toFixed(3):null;};
export function run(hx,n){const T=[];for(let k=0;k<n;k++)T.push(duel(k,hx));const styles={},byStyle={};for(const t of T){styles[t.style]=(styles[t.style]||0)+1;const b=byStyle[t.style]||(byStyle[t.style]={n:0,win:0});b.n++;if(t.win==='peeker')b.win++;}
 const done=T.filter(t=>t.win);return {n:T.length,decided:done.length,peekerWin:+(100*done.filter(t=>t.win==='peeker').length/Math.max(1,done.length)).toFixed(1),styles,
  winByStyle:Object.fromEntries(Object.entries(byStyle).map(([k,v])=>[k,+(100*v.win/v.n).toFixed(0)])),peekerTtd:med(T.map(t=>t.pTtd)),holderTtd:med(T.map(t=>t.hTtd)),exposedBeforeShotAt:med(T.map(t=>t.exposed)),speedAtSight:Object.fromEntries(Object.keys(styles).map(k=>[k,med(T.filter(t=>t.style===k).map(t=>t.v0??-1))])),diedMidJiggle:T.filter(t=>t.diedJig).length};}
if(main){const out={close:run(4,N),long:run(9,N)};if(json)console.log(JSON.stringify(out));else for(const k in out)console.log(k.padEnd(6),JSON.stringify(out[k]));}
