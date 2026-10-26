// Bot vs mid-ranked (Gold-Plat) human benchmarks, measured on real server fights (Simulation.step: motor, spread, recoil,
// hitboxes). Deterministic (seeded). Usage: node tools/bot-benchmarks.mjs [--json]
// Benchmarks (bots-tune-1 notes): HS % of hits Gold 21.0 / Plat 23.4 (tracker.gg insights); time to damage from first
// contact Gold 630-651 / Plat 609-628 ms; crosshair placement at first contact Gold 6.1-6.4 / Plat 5.8-6.0 deg; Vandal
// visible-enemy bullets tap / burst (2-4) / spray (5+) Gold ~4.6 / 40 / 55 %, Plat ~4.9 / 41 / 54 % (offangle.pro/stats).
import {createRequire} from 'node:module';import {Simulation} from '../src/simulation.js';import {persona} from '../src/bots.js';
const B=createRequire(import.meta.url)('../../vendor/bot-brain.cjs');
const DT=+(process.env.BENCH_DT||.05);// server ticks are <= 0.05 s (worker.js)
const NAMES=['Bot Sage','Bot Omen','Bot Raze','Bot Sova','Bot Breach','Bot Phoenix','Bot Cypher','Bot Skye','Bot Killjoy','Bot Jett'];
const nodes=[],adj=[];for(let i=0;i<15;i++)for(let j=0;j<15;j++){nodes.push([i*2-14,0,-j*2]);const k=i*15+j,a=[];if(i>0)a.push(k-15);if(i<14)a.push(k+15);if(j>0)a.push(k-1);if(j<14)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const G={map:{attacker:[-14,0,0],defender:[14,0,-28],sites:{A:[-8,0,-14],B:[8,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),med=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[b.length>>1]:NaN;},pct=(a,q)=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[Math.min(b.length-1,Math.floor(q*b.length))]:NaN;};
// one fight: target at dist, bot looking off rad away (0 = crosshair on the angle), optional strafing target, hp = real (150 HP: 100 + heavy shield)
export function fight(k,dist,off,{strafe=false,secs=2.5,hp=150,stopAtKill=true}={}){const s=new Simulation(G,'tdm','ascent',B.rng(1000+k)),t=s.add('Target','Jett',true),b=s.add(NAMES[k%NAMES.length],'Sage',false);s.phase='game';s.remaining=1e9;s.maxKills=1e9;
 Object.assign(t,{team:1,x:0,y:0,z:-dist,hp:1e9,armor:0,look:0,loading:false,protectedUntil:0,invulnerableUntil:0});Object.assign(b,{team:0,x:0,y:0,z:0,look:off,weapon:'Vandal',ammo:1e9,loading:false,protectedUntil:0});
 b.persona=null;persona(s,b).r=B.rng(k*7+3);b.pitch=B.idlePitch(persona(s,b).brain);
 // crosshair placement error at first contact: angle between the view ray and the target's head (1.6 m eye -> head ~1.65 m)
 const head=[t.x,1.62,t.z],eye=[b.x,1.6,b.z],dx=head[0]-eye[0],dy=head[1]-eye[1],dz=head[2]-eye[2],L=Math.hypot(dx,dy,dz),v=[-Math.sin(b.look)*Math.cos(b.pitch),Math.sin(b.pitch),-Math.cos(b.look)*Math.cos(b.pitch)],cp=Math.acos(Math.max(-1,Math.min(1,(v[0]*dx+v[1]*dy+v[2]*dz)/L)))*180/Math.PI;
 const PB=persona(s,b).brain,R={shots:[],hits:[],head:0,body:0,legs:0,dmg:0,ttd:-1,ttk:-1,cp,yawV:[],yawA:[],acc:B.turnAcc(PB),turn:PB.turn};let side=1,flip=0,ly=b.look,lv=0;const dt=DT;
 for(let i=0;i<secs/dt;i++){if(strafe){flip-=dt;if(flip<=0){side=-side;flip=.45+((i*37)%10)/40;}}t.input=strafe?{side}:{};t.inputAt=s.time;t.hp=1e9;b.ammo=1e9;s.step(dt);
  const w=wrap(b.look-ly)/dt;R.yawV.push(Math.abs(w));if(i>0)R.yawA.push(Math.abs(w-lv)/dt);lv=w;ly=b.look;
  for(const e of s.events){if(e[0]==='s'&&e[1]===b.id)R.shots.push({t:s.time,hit:null,v:Math.hypot(b.vx||0,b.vz||0)});if(e[0]==='h'&&e[1]===b.id){const p=e[3]?'head':e[9]===2?'legs':'body';R[p]++;const sh=R.shots[R.shots.length-1];if(sh)sh.hit=p;R.dmg+=e[5];if(R.ttd<0)R.ttd=s.time;if(R.ttk<0&&R.dmg>=hp)R.ttk=s.time;}}s.events.length=0;if(stopAtKill&&R.ttk>0)break;}
 return R;}
// group shots into pulls (gap > 1.6 / fire rate = a new pull): tap 1, burst 2-4, spray 5+
export function pulls(shots,rate=9.75){const P=[];let n=0,last=-1e9;for(const s of shots){if(s.t-last>1.6/rate){if(n)P.push(n);n=0;}n++;last=s.t;}if(n)P.push(n);return P;}
export function bench({n=60}={}){const sc=[['8',8,0],['15',15,0],['25',25,0],['40',40,0],['15off',15,.35],['15side',15,1.2],['15s',15,0,true],['8s',8,0,true]],S={};
 for(const [key,dist,off,strafe] of sc){const A={shots:0,head:0,body:0,legs:0,ttd:[],ttk:[],cp:[],idx:{},tap:0,burst:0,spray:0,maxV:0,maxA:0,v99:[],first:[0,0],mov:0};
  for(let k=0;k<n;k++){const R=fight(k,dist,off,{strafe});A.shots+=R.shots.length;for(const q of R.shots)if(q.v>1.35)A.mov++;for(const q of ['head','body','legs'])A[q]+=R[q];if(R.ttd>0)A.ttd.push(R.ttd);if(R.ttk>0)A.ttk.push(R.ttk);A.cp.push(R.cp);
   {let j=0,last=-1e9;for(const s of R.shots){if(s.t-last>1.6/9.75)j=0;last=s.t;const i=j++;const b=i<1?'1':i<4?'2-4':i<9?'5-9':'10+';const c=A.idx[b]||(A.idx[b]=[0,0]);c[1]++;if(s.hit)c[0]++;}}if(R.shots.length){A.first[1]++;if(R.shots[0].hit)A.first[0]++;}
   for(const p of pulls(R.shots)){const k2=p===1?'tap':p<=4?'burst':'spray';A[k2]+=p;}A.maxV=Math.max(A.maxV,...R.yawV);A.maxA=Math.max(A.maxA,...R.yawA);A.v99.push(pct(R.yawV,.99));}
  const hits=A.head+A.body+A.legs;S[key]={heads:A.head,hits,hs:+(A.head/hits*100).toFixed(1),acc:+(hits/A.shots*100).toFixed(1),first:+(A.first[0]/A.first[1]*100).toFixed(0),ttd:+(med(A.ttd)*1000).toFixed(0),ttk:+med(A.ttk).toFixed(2),cp:+med(A.cp).toFixed(1),
   pattern:{tap:+(A.tap/A.shots*100).toFixed(0),burst:+(A.burst/A.shots*100).toFixed(0),spray:+(A.spray/A.shots*100).toFixed(0)},byBullet:Object.fromEntries(Object.entries(A.idx).map(([k,v])=>[k,+(v[0]/v[1]*100).toFixed(0)])),maxYawV:+A.maxV.toFixed(1),maxYawA:+A.maxA.toFixed(0),moving:+(A.mov/A.shots*100).toFixed(0)};}
 return {S};}
if(import.meta.url===`file://${process.argv[1]}`){const r=bench(),S=r.S;if(process.argv.includes('--json')){console.log(JSON.stringify(S));process.exit(0);}
 let H=0,T=0;for(const k in S){H+=S[k].heads;T+=S[k].hits;const v=S[k];console.log(k.padEnd(7),'HS',String(v.hs).padStart(5),'acc',String(v.acc).padStart(5),'1st',String(v.first).padStart(3),'ttd',String(v.ttd).padStart(4),'ttk',v.ttk,'cp',v.cp,'tap/burst/spray',v.pattern.tap+'/'+v.pattern.burst+'/'+v.pattern.spray,'mov%',String(v.moving).padStart(3),'bullet hit% 1/2-4/5-9/10+',['1','2-4','5-9','10+'].map(q=>v.byBullet[q]??'-').join('/'),'maxV',v.maxYawV,'maxA',v.maxYawA);}
 console.log('HS overall',(H/T*100).toFixed(1),'% of hits');}
