// Bots aim like mid-ranked players (bots-human-1; user: "their aim is too good, make them feel more like actual players").
// Shared model in vendor/bot-brain.cjs (offline bots use the same functions), wired into the server's Simulation.bot.
// Deterministic: seeded shot RNG and seeded bot streams, so every number below replays exactly.
//  1. reaction: 200-350 ms on a pre-aimed angle with per-fight jitter; slower off-angle, from the side, from behind, after a flash
//  2. flick: minimum-jerk ease-in / ease-out (slow start, fast middle, slow end), overshoot past the target then a correction,
//     a resting error that never reaches zero; Fitts: bigger flicks take longer; never faster than the turn rate
//  3. where the crosshair sits: mostly chest / neck height, head for a minority of fights (more for accurate bots)
//  4. real server fights (Simulation.step: motor, spread, spray, hitboxes): headshot share 12-28 % of hits, accuracy falls with
//     range, the first shot at 25 m+ misses more often than not, a strafing target is hit less than a still one, a target
//     behind takes far longer to kill than one in front, partial recoil control, counter-strafe discipline varies per bot
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation} from './src/simulation.js';import {persona} from './src/bots.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[];
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)));};
const NAMES=['Bot Sage','Bot Omen','Bot Raze','Bot Sova','Bot Breach','Bot Phoenix','Bot Cypher','Bot Skye','Bot Killjoy','Bot Jett'];
// 1. Reaction time distribution
{const all={pre:[],cold:[],side:[],behind:[],flash:[]};
 for(const n of NAMES){const P=B.personality(B.hash(n)),r=B.rng(B.hash(n+'|rt'));for(let k=0;k<60;k++){
  all.pre.push(B.reaction(P,r,{pre:true,off:.1}));all.cold.push(B.reaction(P,r,{pre:false,off:.4}));all.side.push(B.reaction(P,r,{pre:false,off:1.6}));
  all.behind.push(B.reaction(P,r,{pre:false,off:3}));all.flash.push(B.reaction(P,r,{pre:true,off:.1,flashed:true}));}}
 assert.ok(Math.min(...all.pre)>=.2&&Math.max(...all.pre)<=.35,'pre-aimed reaction inside 200-350 ms');
 assert.ok(mean(all.pre)>.22&&mean(all.pre)<.3,'pre-aimed mean ~250 ms ('+(mean(all.pre)*1000).toFixed(0)+')');assert.ok(sd(all.pre)>.012,'jitter per fight (sd '+(sd(all.pre)*1000).toFixed(0)+' ms)');
 assert.ok(mean(all.cold)>mean(all.pre)+.03&&mean(all.side)>mean(all.cold)+.1&&mean(all.behind)>mean(all.side)+.1,'off-angle < side < behind each slower');
 assert.ok(mean(all.flash)>mean(all.pre)+.12,'just flashed: slower');assert.ok(Math.max(...all.behind)<1.1,'still a human, not frozen');
 const means=new Set(NAMES.map(n=>B.personality(B.hash(n)).react.toFixed(5)));assert.equal(means.size,NAMES.length,'every bot its own reaction mean');
 out.push('reaction ms pre '+(mean(all.pre)*1000).toFixed(0)+' / not pre-aimed '+(mean(all.cold)*1000).toFixed(0)+' / side '+(mean(all.side)*1000).toFixed(0)+' / behind '+(mean(all.behind)*1000).toFixed(0)+' / flashed '+(mean(all.flash)*1000).toFixed(0));}
// 2. Flick curve
{const P=B.personality(B.hash('Bot Jett')),A=B.aimPlan(P,B.rng(1),.6,.04,15,{start:.25}),at=t=>B.aimAt(A,t)[0];
 assert.equal(at(0),.6,'crosshair still during the reaction');assert.equal(at(.24),.6);
 const T=A.T1,q=k=>at(A.start+T*k),d1=q(0)-q(.1),d2=q(.45)-q(.55),d3=q(.9)-q(1);
 assert.ok(d2>d1*3&&d2>d3*3,'min-jerk flick: slow start, fast middle, slow end ('+[d1,d2,d3].map(v=>v.toFixed(4))+')');
 let mono=true;for(let k=1;k<=50;k++)if(q(k/50)>q((k-1)/50)+1e-12)mono=false;assert.ok(mono,'one smooth move toward the target (no jitter in the flick)');
 assert.ok(q(1)<0&&A.T2>0,'big flick overshoots past the target ('+q(1).toFixed(4)+' rad)');
 const end=at(A.start+A.T1+A.T2+.01);assert.ok(Math.abs(end-A.res[0])<.002,'correction lands on the resting error');
 const late=[];for(let t=2;t<4;t+=.05)late.push(Math.hypot(...B.aimAt(A,t)));assert.ok(Math.min(...late)>0&&mean(late)<.05,'never a perfect laser, never far off once settled');
 assert.ok(T>=.6/(P.turn*.9)-1e-9,'never faster than the turn rate');
 const small=B.aimPlan(P,B.rng(1),.02,0,15,{start:0}),big=B.aimPlan(P,B.rng(1),1.2,0,15,{start:0});assert.ok(big.T1>small.T1*2&&small.T2===0,'Fitts: a 69 deg flick takes far longer than a 1 deg nudge (no overshoot on a nudge)');
 assert.ok(big.T1>.2&&big.T1<.8,'a big flick takes 0.2-0.8 s ('+big.T1.toFixed(2)+')');
 out.push('flick 34 deg: '+(A.T1*1000).toFixed(0)+' ms + correction '+(A.T2*1000).toFixed(0)+' ms, overshoot '+(Math.abs(q(1))/.6*100).toFixed(0)+' %');}
// 3. Aim spot, recoil pull, discipline per bot
{const spots={head:0,neck:0,chest:0},pulls=[],disc=[];for(const n of NAMES){const P=B.personality(B.hash(n)),r=B.rng(B.hash(n+'|h'));for(let k=0;k<100;k++)spots[B.aimHeight(P,r)]++;pulls.push(B.recoilPull(P));disc.push(B.discipline(P));}
 const tot=spots.head+spots.neck+spots.chest;assert.ok(spots.head/tot>.06&&spots.head/tot<.3,'head-height crosshair in a minority of fights ('+(spots.head/tot*100).toFixed(0)+' %)');assert.ok(spots.chest>spots.head,'chest more often than head');
 assert.ok(Math.max(...pulls)<=.9&&Math.min(...pulls)>=.2&&sd(pulls)>.02,'partial recoil control that differs per bot');assert.ok(Math.max(...disc)<1&&sd(disc)>.02,'counter-strafe discipline differs per bot, never perfect');
 const hard=B.aimPlan(B.personality(1),B.rng(5),0,0,15,{level:'hard'}),easy=B.aimPlan(B.personality(1),B.rng(5),0,0,15,{level:'easy'});assert.ok(Math.abs(easy.res[0])>Math.abs(hard.res[0]),'difficulty scales the resting error');
 assert.equal(B.hitPart(0,1.82),'head');assert.equal(B.hitPart(0,1.2),'body');assert.equal(B.hitPart(0,.5),'legs');assert.equal(B.hitPart(.5,1.2),null);assert.equal(B.hitPart(0,1.82-.45,.45),'head','crouch lowers the head');
 out.push('aim spot head '+(spots.head/tot*100).toFixed(0)+' % / neck '+(spots.neck/tot*100).toFixed(0)+' % / chest '+(spots.chest/tot*100).toFixed(0)+' %, recoil pull '+Math.min(...pulls).toFixed(2)+'-'+Math.max(...pulls).toFixed(2));}
// 4. Real server fights on a flat grid (no walls): bot vs a target, 2 s each
const nodes=[],adj=[];for(let i=0;i<15;i++)for(let j=0;j<15;j++){nodes.push([i*2-14,0,-j*2]);const k=i*15+j,a=[];if(i>0)a.push(k-15);if(i<14)a.push(k+15);if(j>0)a.push(k-1);if(j<14)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const G={map:{attacker:[-14,0,0],defender:[14,0,-28],sites:{A:[-8,0,-14],B:[8,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
function fight(k,dist,off,strafe){const s=new Simulation(G,'tdm','ascent',B.rng(1000+k)),t=s.add('Target','Jett',true),b=s.add(NAMES[k%NAMES.length],'Sage',false);s.phase='game';s.remaining=1e9;s.maxKills=1e9;
 Object.assign(t,{team:1,x:0,y:0,z:-dist,hp:1e9,armor:0,look:0,loading:false,protectedUntil:0,invulnerableUntil:0});Object.assign(b,{team:0,x:0,y:0,z:0,look:off,weapon:'Vandal',ammo:1e9,loading:false,protectedUntil:0});
 b.persona=null;persona(s,b).r=B.rng(k*7+3);b.pitch=B.idlePitch(persona(s,b).brain);const R={shots:0,head:0,body:0,legs:0,first:null,dmg:0,ttk:-1};let side=1,flip=0;
 for(let i=0;i<120;i++){if(strafe){flip-=1/60;if(flip<=0){side=-side;flip=.45+((i*37)%10)/40;}}t.input=strafe?{side}:{};t.inputAt=s.time;t.hp=1e9;b.ammo=1e9;s.step(1/60);
  for(const e of s.events){if(e[0]==='s'&&e[1]===b.id){R.shots++;if(R.first===null)R.first='miss';}if(e[0]==='h'&&e[1]===b.id){const p=e[3]?'head':e[9]===2?'legs':'body';R[p]++;if(R.first==='miss'&&R.shots===1)R.first=p;R.dmg+=e[5];if(R.ttk<0&&R.dmg>=150)R.ttk=s.time;}}s.events.length=0;}
 return R;}
const stats={};
for(const [key,dist,off,str] of [['8',8,0,0],['15',15,0,0],['25',25,0,0],['40',40,0,0],['15s',15,0,1],['15b',15,2.8,0]]){const S={shots:0,head:0,body:0,legs:0,firstHit:0,firstN:0,ttk:[]};
 for(let k=0;k<60;k++){const R=fight(k,dist,off,str);for(const q of ['shots','head','body','legs'])S[q]+=R[q];if(R.first){S.firstN++;if(R.first!=='miss')S.firstHit++;}if(R.ttk>0)S.ttk.push(R.ttk);}
 S.hits=S.head+S.body+S.legs;S.acc=S.hits/S.shots;S.hs=S.head/S.hits;S.ttk.sort((a,b)=>a-b);S.med=S.ttk.length?S.ttk[S.ttk.length>>1]:9;stats[key]=S;}
const H=Object.values(stats).reduce((s,v)=>s+v.head,0),T=Object.values(stats).reduce((s,v)=>s+v.hits,0);
assert.ok(H/T>.12&&H/T<.28,'headshot share 12-28 % of hits overall ('+(H/T*100).toFixed(1)+' %)');
for(const k in stats)assert.ok(stats[k].hs<.36,k+' m: headshots '+(stats[k].hs*100).toFixed(0)+' % (no head-clicking machine)');
assert.ok(stats['15'].acc>stats['25'].acc&&stats['25'].acc>stats['40'].acc,'accuracy falls with range ('+['15','25','40'].map(k=>(stats[k].acc*100).toFixed(0)+'%')+')');
assert.ok(stats['15'].acc<.72&&stats['40'].acc<.36,'not a laser at 15 m, mostly misses at 40 m (bots also close in)');
const far1=(stats['25'].firstHit+stats['40'].firstHit)/(stats['25'].firstN+stats['40'].firstN);assert.ok(far1<.5,'first shot at 25-40 m usually misses ('+(far1*100).toFixed(0)+' % hit)');
assert.ok(stats['15s'].acc<stats['15'].acc,'a strafing target is hit less ('+(stats['15s'].acc*100).toFixed(0)+' % vs '+(stats['15'].acc*100).toFixed(0)+' %)');
assert.ok(stats['15b'].med>stats['15'].med+.3,'an enemy behind takes far longer to kill (turn + slower reaction: '+stats['15b'].med.toFixed(2)+' s vs '+stats['15'].med.toFixed(2)+' s)');
assert.ok(stats['15'].med>.3,'never an instant kill on sight (median '+stats['15'].med.toFixed(2)+' s incl. reaction)');
out.push('server fights: HS '+(H/T*100).toFixed(0)+' % of hits; accuracy 8/15/25/40 m '+['8','15','25','40'].map(k=>(stats[k].acc*100).toFixed(0)).join('/')+' %, strafing 15 m '+(stats['15s'].acc*100).toFixed(0)+' %; first shot hit at 25-40 m '+(far1*100).toFixed(0)+' %; median TTK (150 HP) 15 m '+stats['15'].med.toFixed(2)+' s, behind '+stats['15b'].med.toFixed(2)+' s');
// 5. Pace: attackers mostly default and take their time (a flat-out rush is rare), not everyone leaves spawn on the buzzer,
// starts are staggered (no robotic shared timing), some walk the default; rush rounds still go fast.
{const types={},wait=[],start=[],walkers=[0,0],rushD=[];for(let r=0;r<300;r++){const p=B.attackPlan(B.hash('pace|'+r),['A','B'],{});types[p.type]=(types[p.type]||0)+1;const R=B.roles(p,5,B.hash('roles|'+r),true,['A','B'],0);
  for(const e of R){if(p.type==='rush'){rushD.push(e.delay);continue;}if(!e.lurk){start.push(e.delay);if(e.delay>=2)wait.push(e.delay);}if(['default','execute','split'].includes(p.type)){walkers[1]++;if(e.walk)walkers[0]++;}}}
 const n=300,top=Object.entries(types).sort((a,b)=>b[1]-a[1])[0][0];assert.equal(top,'default','default is the most common attack');assert.ok((types.rush||0)/n<.1,'rush under 10 % of rounds ('+(types.rush||0)+'/300)');
 assert.ok(wait.length/start.length>.3&&wait.length/start.length<.8,'some attackers linger in spawn 2 s+ ('+(wait.length/start.length*100).toFixed(0)+' %)');assert.ok(Math.min(...start)>=.2,'nobody but a rusher leaves on the buzzer');assert.ok(mean(start)>1.5&&mean(start)<5,'mean start 1.5-5 s ('+mean(start).toFixed(1)+')');
 assert.ok(new Set(start.map(v=>v.toFixed(1))).size>40,'staggered, not shared, start times');assert.ok(walkers[0]/walkers[1]>.2,'some walk the default ('+(walkers[0]/walkers[1]*100).toFixed(0)+' %)');assert.ok(Math.max(...rushD)<=2,'a rush still goes at once');
 out.push('pace: '+Object.entries(types).map(([k,v])=>k+' '+v).join(' / ')+' of 300 rounds; '+(wait.length/start.length*100).toFixed(0)+' % of attackers wait 2 s+ in spawn, mean start '+mean(start).toFixed(1)+' s');}
console.log('Bots human-like: '+out.join('; '));
