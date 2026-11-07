// Bots perceive like mid-ranked players, no omniscience (bots-perception-2; shared vendor/bot-brain.cjs SENSE / inView /
// audible / mem*, wired into Simulation.bot + bots.js hearTick / botView; offline twin: work/test_bot_perception_offline.cjs).
//  1. view cone: a still, silent enemy in plain sight but outside the 103 deg view is never seen / shot; inside it is
//  2. no omniscience: with every enemy hidden and silent, a bot's path is the same wherever the enemies are
//  3. hearing: running footsteps within ~30 m (not 35 m, never walking), gunshots map-wide (suppressed Phantom within 40 m)
//     go into the bot's memory and turn its view there at its own turn rate; it never knows the exact spot
//  4. turn rate from a real sensitivity (0.35 sens / 800 DPI = 46.7 cm per 360): a 180 is several ticks; an enemy shooting
//     from behind is not killed instantly (behind-kill time vs front)
//  5. line of sight lost = the burst stops that tick (no stale fire)
//  6. glimpses: a 100 ms glimpse is never shot; a jiggle peek rarely dies
//  7. fire rate: a spraying Vandal bot never beats 9.75 rounds/s
//  8. Spike-mode sound reactions on the shared hearing model
//  9. flash reads: an enemy flash a bot would be blinded by is read and turned (Curveball mostly, Flashpoint rarely in time,
//     mid-fight reads rarer); blinded bots back out, hold or spray the angle they were fighting
// 10. corner peeks: clearing a corner onto a known enemy, bots jiggle / wide swing / tight peek / hold (BotBrain.peek), a jiggle
//     that sees the enemy holds fire; a still bot sees a moving bot peeker 70-100 ms late (peeker's advantage, bot vs bot)
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {persona,botView} from './src/bots.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[];
const NAMES=['Bot Sage','Bot Omen','Bot Raze','Bot Sova','Bot Breach','Bot Phoenix','Bot Cypher','Bot Skye','Bot Killjoy','Bot Jett'];
const nodes=[],adj=[];for(let i=0;i<21;i++)for(let j=0;j<21;j++){nodes.push([i*2-20,0,-j*2+20]);const k=i*21+j,a=[];if(i>0)a.push(k-21);if(i<20)a.push(k+21);if(j>0)a.push(k-1);if(j<20)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const WALL={on:false};const G=()=>({map:{attacker:[-20,0,20],defender:[20,0,-20],sites:{A:[-8,0,0],B:[8,0,0]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:(o,d,max)=>WALL.on?Math.min(1,max):Infinity});
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[b.length>>1]:NaN;};
function duo(k,{mode='tdm',bx=0,bz=0,look=0,tx=0,tz=-12,weapon='Vandal',hold=true}={}){WALL.on=false;const s=new Simulation(G(),mode,'ascent',B.rng(500+k)),t=s.add('Target','Jett',true),b=s.add(NAMES[k%NAMES.length],'Sage',false);
 s.phase='game';s.remaining=1e9;s.maxKills=1e9;if(hold){s.objectiveRoutes=true;s.holdTurn=false;}/* no roaming: the bot holds its spot, only its view moves; holdTurn false: the view cone checks keep the bot's own view (bug 8's hold turns a holder onto its best entry corner - here the open plane's site A, 90 deg off - which is test-bot-hold-aim's business) */
 Object.assign(t,{team:1,x:tx,y:0,z:tz,hp:100,armor:0,look:0,loading:false,protectedUntil:0,invulnerableUntil:0,input:{}});Object.assign(b,{team:0,x:bx,y:0,z:bz,look,weapon,ammo:1e9,loading:false,protectedUntil:0});
 persona(s,b);b.pitch=B.idlePitch(persona(s,b).brain);return {s,t,b};}
// one simulated tick for the bot only (the target is moved by the test): Simulation.step's bot + botView + the shot
function tick(s,b,dt=1/30){s.time+=dt;const L0=b.look;s.bot(b);botView(s,b,L0,dt);let shots=0;if(b.input.fire&&s.fire(b))shots=1;const ev=s.events.splice(0);return {shots,ev};}
// 1. view cone
{const inv=[];for(const [deg,want] of [[0,true],[40,true],[50,true],[56,false],[90,false],[135,false],[180,false]]){let seen=0,fired=0;
  for(let k=0;k<6;k++){const a=deg*Math.PI/180,{s,t,b}=duo(k,{tx:-Math.sin(a)*12,tz:-Math.cos(a)*12});t.hp=1e9;for(let i=0;i<60;i++){const r=tick(s,b);t.hp=1e9;if(b.sawTarget)seen++;fired+=r.shots;}}
  if(want)assert.ok(seen>0,'an enemy '+deg+' deg off the view (inside 103 deg) is seen');else{assert.equal(seen,0,'an enemy '+deg+' deg off the view (outside 103 deg) is never seen');assert.equal(fired,0,'and never shot');}inv.push(deg+':'+(seen?'seen':'unseen'));}
 assert.ok(B.inView(B.SENSE.fov/2-.01,20)&&!B.inView(B.SENSE.fov/2+.05,20),'103 deg cone (+ body half-width)');
 out.push('view cone '+inv.join(' '));}
// 2. no omniscience: hidden (walls everywhere) and silent enemies anywhere -> the same path
{const track=(tx,tz)=>{const {s,t,b}=duo(3,{hold:false,bx:-18,bz:18,tx,tz});WALL.on=true;const L=[];for(let i=0;i<300;i++){s.time+=.05;const L0=b.look;s.bot(b);botView(s,b,L0,.05);
   const i2=b.input,f=i2.forward||0,sd=i2.side||0,c=Math.cos(b.look),sn=Math.sin(b.look);b.x+=(-sn*f+c*sd)*.05*5;b.z+=(-c*f-sn*sd)*.05*5;L.push(b.x.toFixed(3)+','+b.z.toFixed(3));}WALL.on=false;return L.join(' ');};
 const a=track(18,-18),c=track(-18,-18),d=track(18,18);assert.equal(a,c,'path does not depend on where a hidden, silent enemy is');assert.equal(a,d);
 assert.ok(new Set(a.split(' ')).size>40,'the bot still moves (roams the map)');out.push('no omniscience: identical roam paths for 3 hidden enemy spots');}
// 3. hearing
{const heard=(kind,dist,weapon)=>{const {s,t,b}=duo(1,{look:0,tx:0,tz:dist});WALL.on=true;/* behind it, behind a wall */t.weapon=weapon||'Vandal';
  for(let i=0;i<6;i++){if(kind==='run'){t.vx=5.4;t.vz=0;t.input={forward:1};t.inputAt=s.time+1;}else if(kind==='walk'){t.vx=2.9;t.input={forward:1,walk:true};t.inputAt=s.time+1;}else if(kind==='shot'&&i===1)t.shotAt=s.time+1/30;tick(s,b);}
  const c=b.mem&&b.mem.c[t.id];WALL.on=false;return c?{c,err:Math.hypot(c.x-t.x,c.z-t.z),b,t}:null;};
 assert.ok(heard('run',25),'running footsteps 25 m away are heard');assert.ok(!heard('run',35),'not 35 m away (VALORANT minimap circle ~30 m)');assert.ok(!heard('walk',8),'walking is silent');
 assert.ok(heard('shot',100,'Vandal'),'a Vandal shot is heard across the map');assert.ok(!heard('shot',45,'Phantom'),'a suppressed Phantom is not heard at 45 m');assert.ok(heard('shot',30,'Phantom'),'but is within 40 m');
 assert.ok(B.audible('step',30)&&!B.audible('step',31)&&B.audible('cast',30)&&!B.audible('cast',31));
 const h=heard('run',25);assert.ok(h.err>0&&h.err<25*B.SENSE.ear+1e-9,'a heard enemy is placed roughly, never exactly ('+h.err.toFixed(2)+' m off)');
 // the view turns toward a sound behind at its own rate (no snap) and the bot then sees the enemy
 const {s,t,b}=duo(2,{look:0,tx:0,tz:14});const P=persona(s,b),turn=[];let seenAt=-1;t.shotAt=s.time+1/30;
 for(let i=0;i<60;i++){const l0=b.look,r=tick(s,b);turn.push(Math.abs(B.wrapA(b.look-l0)));if(b.sawTarget&&seenAt<0)seenAt=i;if(i<3)t.shotAt=-9;}
 assert.ok(Math.max(...turn)<=P.brain.turn/30+1e-9,'turns at most its turn rate per tick ('+(Math.max(...turn)*30).toFixed(1)+' rad/s, cap '+P.brain.turn.toFixed(1)+')');
 assert.ok(seenAt>=Math.floor(30*(Math.PI-B.SENSE.fov/2)/P.brain.turn)-1,'sees the shooter behind only after turning ('+(seenAt/30).toFixed(2)+' s)');
 out.push('hearing: run 25 m yes / 35 m no, walk silent, Vandal 100 m yes, Phantom 45 m no / 30 m yes, heard spot '+h.err.toFixed(1)+' m off at 25 m; turned and saw a shooter behind after '+(seenAt/30).toFixed(2)+' s');}
// 4. turn rate from sensitivity; behind-kill time vs front
{assert.ok(Math.abs(B.cm360(.35,800)-46.65)<.05,'0.35 sens 800 DPI = 46.7 cm / 360 ('+B.cm360(.35,800).toFixed(1)+')');
 const turns=NAMES.map(n=>B.personality(B.hash(n)).turn);for(const n of NAMES){const P=B.personality(B.hash(n));assert.ok(P.sens>=.31&&P.sens<=.41&&P.turn>=7&&P.turn<=14.5,n+' turn '+P.turn.toFixed(1)+' rad/s from sens '+P.sens);}
 const ttk=(behind)=>{const T=[];for(let k=0;k<20;k++){const {s,t,b}=duo(k,{look:behind?Math.PI:0,tx:0,tz:-12});t.shotAt=s.time+1/30;let dmg=0,at=-1;
   for(let i=0;i<120&&at<0;i++){if(i%3===0)t.shotAt=s.time+1/30;/* the enemy keeps shooting (heard) */const r=tick(s,b);for(const e of r.ev)if(e[0]==='h'&&e[1]===b.id){dmg+=e[5];if(dmg>=150&&at<0)at=s.time;}t.hp=100;}T.push(at<0?4:at);}return T;};
 const front=ttk(false),back=ttk(true),mf=median(front),mb=median(back);
 assert.ok(Math.min(...back)>.55,'never an instant kill on an enemy behind (fastest '+Math.min(...back).toFixed(2)+' s)');assert.ok(mb>mf+.3,'behind takes far longer than in front ('+mb.toFixed(2)+' vs '+mf.toFixed(2)+' s)');
 out.push('turn '+Math.min(...turns).toFixed(1)+'-'+Math.max(...turns).toFixed(1)+' rad/s (180 in '+(Math.PI/Math.max(...turns)).toFixed(2)+'-'+(Math.PI/Math.min(...turns)).toFixed(2)+' s); median TTK 150 HP front '+mf.toFixed(2)+' s, behind (shooting, heard) '+mb.toFixed(2)+' s');}
// 5. line of sight lost: no stale fire
{let stale=0,bursts=0;for(let k=0;k<20;k++){const {s,t,b}=duo(k,{tz:-10});t.hp=1e9;let firing=false;
  for(let i=0;i<90;i++){const r=tick(s,b);t.hp=1e9;if(r.shots)firing=true;if(firing&&!WALL.on){WALL.on=true;bursts++;continue;}if(WALL.on)stale+=r.shots;}WALL.on=false;}
 assert.ok(bursts>=15,'bots got into fights ('+bursts+')');assert.equal(stale,0,'no shot after line of sight is lost');out.push('LOS loss: '+stale+' stale shots over '+bursts+' broken bursts');}
// 6. glimpses and jiggle peeks
{let g100=0,jDeaths=0,jN=0,jShots=0;for(let k=0;k<30;k++){const {s,t,b}=duo(k,{tz:-12});WALL.on=true;
  // 100 ms glimpses every 0.6 s for 4 s
  for(let i=0;i<120;i++){WALL.on=(i%18)>=3;const r=tick(s,b);if(!WALL.on||r.shots)g100+=r.shots;t.hp=100;}
  // jiggle: 267 ms out and back (a 1.2 m swing at ~5.4 m/s), 700 ms behind cover, 4 times: dies if 150+ damage lands in one jiggle (armour 0, 100 HP + a 50 shield)
  const v=duo(k+100,{tz:-12});WALL.on=true;let dmg=0,died=false;for(let i=0;i<4*29;i++){const ph=i%29;WALL.on=ph>=8;if(ph===0)dmg=0;/* out and back across the gap at running speed */const q=ph<8?ph/8:0;v.t.x=Math.sin(Math.PI*q)*1.2;v.t.vx=ph<8?Math.cos(Math.PI*q)*Math.PI*1.2/(8/30):0;const r=tick(v.s,v.b);jShots+=r.shots;for(const e of r.ev)if(e[0]==='h'&&e[1]===v.b.id)dmg+=e[5];if(dmg>=150)died=true;v.t.hp=100;}
  jN++;if(died)jDeaths++;WALL.on=false;}
 assert.equal(g100,0,'a 100 ms glimpse is never shot ('+g100+' shots)');assert.ok(jDeaths/jN<.2,'a jiggle peeker rarely dies ('+jDeaths+'/'+jN+')');
 out.push('glimpse 100 ms: '+g100+' shots; jiggle 250 ms x4: '+jDeaths+'/'+jN+' died, '+jShots+' shots');}
// 7. fire-rate cap
{let worst=0,total=0,span=0;for(let k=0;k<10;k++){const {s,t,b}=duo(k,{tz:-6});t.hp=1e9;const times=[];for(let i=0;i<240;i++){const r=tick(s,b,1/60);t.hp=1e9;b.ammo=1e9;if(r.shots)times.push(s.time);}
  for(let i=0;i<times.length;i++){let n=0;for(let j=i;j<times.length&&times[j]-times[i]<1-1e-9;j++)n++;worst=Math.max(worst,n);}for(let i=1;i<times.length;i++){const g=times[i]-times[i-1];/* bots-tune-2: a shot lands on the first tick at or after it is due, so one gap may be up to a tick short of 1/rate while the cadence holds */assert.ok(g>=1/9.75-1/60-1e-6,'Vandal gap '+g.toFixed(4)+' s');}total+=times.length;span+=4;}
 assert.ok(worst<=10,'at most 10 Vandal rounds in any 1 s window ('+worst+')');
 // bots-tune-2: and the full cadence on the real 50 ms server tick (worker.js) and at 60 Hz: a held trigger fires 9.75/s
 // (it was 6.67/s at 20 Hz - every 0.1026 s interval rounded up to 3 ticks - and 8.57/s at 60 Hz), never more
 const rates=[];for(const dt of [.05,1/60]){const {s,t,b}=duo(0,{tz:-6});t.hp=1e9;b.ammo=1e9;b.input={fire:true};b.inputAt=1e9;const T=[];s.tickDt=dt;for(let i=0;i<Math.round(3/dt);i++){b.input={fire:true};b.ammo=1e9;s.fire(b);T.push(...(b.shotAt===s.time?[s.time]:[]));s.time+=dt;}
  const r=(T.length-1)/(T[T.length-1]-T[0]);rates.push(r);assert.ok(r>9.5&&r<=9.75+1e-6,'held Vandal cadence at '+(1/dt).toFixed(0)+' Hz: '+r.toFixed(2)+'/s (9.75)');}
 out.push('Vandal: '+worst+' rounds max in 1 s, min gap >= 1/9.75 - 1 tick, held cadence 20 / 60 Hz '+rates.map(r=>r.toFixed(2)).join(' / ')+'/s');}
// 8. Spike-mode sound reactions on the shared hearing model (bots-tune-1; before: steps only < 16 m at > 4.5 m/s, no casts)
{const SG={...G(),map:{attacker:[-20,0,20],defender:[20,0,-20],sites:{A:[-8,0,0],B:[8,0,0]}}};
 const react=(kind,d,{weapon='Vandal',walk=false}={})=>{const s=new SpikeSimulation(SG,'five','ascent',()=>.5),b=s.add('Bot Sage','Sage',false),e=s.add('Enemy','Jett',true);s.phase='game';s.round=2;s.atk=1;s.buy=0;
  Object.assign(b,{team:0,x:0,y:0,z:0,look:0,alive:true,hp:100,loading:false});Object.assign(e,{team:1,x:0,y:0,z:d,alive:true,hp:100,loading:false,weapon,vx:0,vz:0,input:{}});
  s.spike={st:'carry',carrier:e.id,x:0,y:0,z:0,t:45,pt:0,dt:0,site:'A'};s.remaining=80;s.time=5;e.inputAt=5;
  if(kind==='shot')e.shotAt=5;else if(kind==='cast')s.castEvents=[{t:'ac',i:e.id,ag:'Jett',k:'q'}];else{e.vx=5.4;e.input={walk};if(walk)e.vx=3.2;}
  s.botSense();return b.react&&['hold','push'].includes(b.react.kind)||!!(b.react&&b.react.kind==='hold');};
 const R=[['step',25,{},true],['step',29,{},true],['step',33,{},false],['step',10,{walk:true},false],['cast',25,{},true],['cast',33,{},false],['shot',33,{},true],['shot',38,{},false],['shot',33,{weapon:'Phantom'},true],['shot',38,{weapon:'Phantom'},false]];
 for(const [k,d,o,want] of R)assert.equal(react(k,d,o),want,'Spike botSense reacts to '+k+(o.walk?' (walking)':'')+(o.weapon?' '+o.weapon:'')+' at '+d+' m: '+want);
 for(const [k,w] of [['step',null],['cast',null],['shot','Vandal'],['shot','Phantom']])assert.equal(B.reactR(k,w),{step:30,cast:30}[k]||35,'reactR '+k+' '+w);
 out.push('Spike sound reactions: run 25/29 m yes, 33 no, walk silent; cast 25 yes / 33 no; Vandal 33 yes / 38 no; Phantom 33 yes / 38 no');}
// 9. flash reads (bots-tune-4, BotBrain.flashRead / blindPlay; tools/bot-flash-bench.mjs): before, every flash that would blind
// a bot did and a blinded bot stood still (Breach / Phoenix / Skye from cover: 100 / 93 / 100 % blinded, moved 0 m)
{const {scenario}=await import('./tools/bot-flash-bench.mjs');const pc=scenario('Phoenix',true,60),bc=scenario('Breach',true,60),pf=scenario('Phoenix',false,60),bf=scenario('Breach',false,60);
 assert.ok(pc.read>35&&pc.read<80,'reads a Curveball thrown from cover 35-80 %: '+pc.read);assert.ok(pc.blinded<70,'Curveball from cover blinds < 70 % (was 93): '+pc.blinded);assert.ok(pc.readBlinded<25,'a read beats the 0.4 s Curveball: '+pc.readBlinded+' % of reads still blinded');
 assert.ok(bc.blinded>pc.blinded+15,'Flashpoint (0.3 s) is much harder to turn than Curveball: '+bc.blinded+' vs '+pc.blinded);
 assert.ok(pf.read<pc.read*.7&&bf.read<bc.read*.7,'mid-fight reads are rarer: '+pf.read+' / '+bf.read+' vs '+pc.read+' / '+bc.read);
 assert.ok(bc.movedWhileBlind>.8&&bc.acts.back>5&&bc.acts.hold>5&&!bc.acts.none,'blinded from cover: backs out or holds ('+JSON.stringify(bc.acts)+', moved '+bc.movedWhileBlind+' m)');
 assert.ok(pf.acts.spray>5&&pf.shotsWhileBlind>.5,'blinded mid-fight: some spray the angle ('+JSON.stringify(pf.acts)+', '+pf.shotsWhileBlind+' shots)');
 out.push('flash reads: Curveball from cover read '+pc.read+' % / blinded '+pc.blinded+' % (was 93), Flashpoint '+bc.blinded+' % (was 100), mid-fight read '+pf.read+' %; blinded back / hold / spray '+JSON.stringify(bc.acts)+' '+JSON.stringify(pf.acts));}
// 10. corner peeks (bots-tune-4, BotBrain.peek / peekStep / PEEK.adv; tools/bot-peek-bench.mjs). Before (c1b420c): every
// peeker ran its path round the corner (styles none 100 %), peeker win 37 % close / 37 % long.
{const {run}=await import('./tools/bot-peek-bench.mjs');const c=run(4,60),l=run(9,60);
 for(const [k,r] of [['close',c],['long',l]]){for(const st of ['jiggle','wide','tight','hold'])assert.ok((r.styles[st]||0)>=6,k+': '+st+' peeks used ('+JSON.stringify(r.styles)+')');
  assert.ok(r.peekerWin>25&&r.peekerWin<55,k+': peeker win 25-55 % (holder favoured, as Riot designs it): '+r.peekerWin);assert.ok(r.diedMidJiggle<=3,k+': jiggles are rarely converted: '+r.diedMidJiggle);}
 assert.ok(l.winByStyle.wide>=l.winByStyle.tight,'a wide swing beats a tight peek on a long angle held off the close edge: '+l.winByStyle.wide+' vs '+l.winByStyle.tight);
 const P=B.personality(77),r1=B.rng(5),r2=B.rng(5);let a=0,b=0;for(let i=0;i<400;i++){a+=B.reaction(P,r1,{pre:true});b+=B.reaction(P,r2,{pre:true,peeked:true});}
 const adv=(b-a)/400;assert.ok(adv>.06&&adv<.11,"peeker's advantage 70-100 ms: "+adv.toFixed(3));
 out.push('peeks close '+JSON.stringify(c.styles)+' peeker win '+c.peekerWin+' % (by style '+JSON.stringify(c.winByStyle)+'), long peeker win '+l.peekerWin+' % '+JSON.stringify(l.winByStyle)+", peeker's advantage "+(adv*1000).toFixed(0)+' ms');}
console.log('Bot perception: '+out.join('; '));
