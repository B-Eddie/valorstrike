// Offline enemy bots aim like mid-ranked players with the same model as the server (bots-human-1; vendor/bot-brain.cjs):
// the BOT VARIETY block's xbEngage(ctx) / xbFaceAim / xbReady / xbShot run here in a vm with THREE, and the base loop's wiring
// is pinned. Checks: reaction off-angle / flash costs, the visible yaw flicks (eases in and out, turn-rate limited, never a
// snap), a new pull waits for the flick, shots are judged against the server hit volumes (head share of hits 12-28 %,
// accuracy falls with range), the recoil pull is partial, a sloppy fight may fire before stopping, difficulty scales it.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),A='// ---- BOT VARIETY ----',Z='// ---- END BOT VARIETY ----',i=html.indexOf(A),j=html.indexOf(Z,i);assert(i>=0&&j>i,'bot variety block');
const block=html.slice(i,j+Z.length);
// base loop wiring (enemy bots)
for(const w of ['xbEngage(b, b.pre, { off: Math.abs(oy), e0y: oy, d, flashed:','typeof xbFaceAim === "function" ? xbFaceAim(b, Math.atan2(dx, dz), dt)','typeof xbShot === "function" ? xbShot(b, tg, from, w, W, d, D)',
 '((b.spd || 0) <= BOT_STOP || b.xbSl)','(b.bn > 0 || typeof xbReady !== "function" || xbReady(b, d))','b.see = see && !(b.blind > 0) ?','if (b.blind > 0) b.xbFl = performance.now();'])assert(html.includes(w),'wired: '+w);
assert(!/if \(see\) b\.g\.rotation\.y = Math\.atan2\(dx, dz\);/.test(html),'enemy bots no longer snap their yaw onto the target');
let now=0,rnd=1;const R=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647;};
const ctx={Math:Object.assign(Object.create(Math),{random:R}),Object,Number,Infinity,Set,Map,WeakMap,Array,Float64Array,Int32Array,Uint8Array,THREE,performance:{now:()=>now},window:{xBotSeed:77},mode:'five',running:true,
 player:{hp:100,x:0,y:0,z:0,ch:0},allies:[],bots:[],timeLeft:100,S:{diff:'normal'},FV:{you:0,them:0,map:'ascent',atk:true,dm:false,sp:null},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},nmActive:()=>null,xSmV:(u,dt,vx,vz)=>[vx,vz],xGoal:(u,t,a,o)=>o,nmClimbOk:()=>false,nmPath:()=>[0],nmNext:()=>[0],
 // bSpread stand-in: Vandal first-shot spread (0.25 deg) and the page's uncontrolled rifle climb (index.html bSpread: 0.0065 rad / shot up to 6, x0.6)
 bSpread:(b,w,W,dir,d,D)=>{if((b.lt||9)>.35)b.sn=0;const n=b.sn||0,s=.0044*(D&&D.ae?D.ae/1.3:1)*(b.mv?8:1),vy=Math.min(n,6)*.0065*.6*(D&&D.ae?D.ae/1.3:1);dir.x+=(R()-.5)*s*2;dir.y+=(R()-.5)*s*2+vy;dir.z+=(R()-.5)*s*2;dir.normalize();b.sn=n+1;b.lt=0;}};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(block+'\n;globalThis.BotBrain=BotBrain;',ctx);Object.assign(ctx.window,{BotRoutes:ctx.BotRoutes,BotBrain:ctx.BotBrain});
const B=ctx.BotBrain,mean=a=>a.reduce((s,v)=>s+v,0)/a.length,out=[];
const NAMES=['Jett','Omen','Raze','Sova','Sage','Reyna','Phoenix','Breach','Cypher','Skye'];
// 1. reaction costs through xbEngage(ctx), and the gate in ms
{const r={pre:[],side:[],behind:[],flash:[]};for(const n of NAMES)for(let k=0;k<20;k++){const u={name:'Bot '+n};ctx.xbEngage(u,true,{off:.1,e0y:.1,d:15});r.pre.push(u.rtE);ctx.xbEngage(u,false,{off:1.6,e0y:1.6,d:15});r.side.push(u.rtE);
  ctx.xbEngage(u,false,{off:3,e0y:3,d:15});r.behind.push(u.rtE);ctx.xbEngage(u,true,{off:.1,e0y:.1,d:15,flashed:true});r.flash.push(u.rtE);}
 assert(Math.min(...r.pre)>=.2&&Math.max(...r.pre)<=.35,'pre-aimed 200-350 ms');assert(mean(r.side)>mean(r.pre)+.15&&mean(r.behind)>mean(r.side)+.1&&mean(r.flash)>mean(r.pre)+.12,'side / behind / flashed slower');
 const u={name:'Bot Jett'};ctx.xbEngage(u,false,{off:1,e0y:1,d:15});assert.equal(ctx.xbRt(u,{rt:260}),u.rtE*1000,'no extra +150 ms on top of the model');assert(u.xbAP&&u.xbSpot&&u.xbPull>0&&u.xbPull<1,'plan, body spot, partial pull');
 out.push('reaction ms pre '+(mean(r.pre)*1000).toFixed(0)+' / side '+(mean(r.side)*1000).toFixed(0)+' / behind '+(mean(r.behind)*1000).toFixed(0)+' / flashed '+(mean(r.flash)*1000).toFixed(0));}
// 2. visible flick: a bot looking 60 deg away turns onto the target with a human curve at 60 fps
{const u={name:'Bot Raze',g:{rotation:{y:1.05}},see:0},want=0;ctx.xbEngage(u,false,{off:1.05,e0y:1.05,d:15});const ys=[],dt=1/60;
 for(let f=0;f<120;f++){u.g.rotation.y=ctx.xbFaceAim(u,want,dt);ys.push(u.g.rotation.y);u.see+=dt;}
 const steps=ys.map((y,k)=>k?Math.abs(y-ys[k-1]):0),turn=ctx.xbBrain(u).turn,first=steps.findIndex(v=>v>1e-6);
 assert(first>=Math.floor(u.rtE*60)-1,'still during the reaction ('+first+' frames)');assert(Math.max(...steps)<=turn*dt+1e-9,'never faster than the turn rate');
 const mid=steps.indexOf(Math.max(...steps));assert(steps[first+1]<steps[mid]*.5&&mid>first+2,'eases in (slow start, fast middle)');
 const minY=Math.min(...ys);assert(minY<0,'overshoots past the target ('+minY.toFixed(3)+')');assert(Math.abs(ys[119])<.06&&Math.abs(ys[119])>0,'settles near, not exactly on, the target');
 out.push('flick 60 deg: starts '+(first/60*1000).toFixed(0)+' ms, peak '+(Math.max(...steps)*60).toFixed(1)+' rad/s at '+(mid/60*1000).toFixed(0)+' ms, overshoot '+(-minY*180/Math.PI).toFixed(1)+' deg');
 const v={name:'Bot Raze',g:{rotation:{y:1.05}},see:0};ctx.xbEngage(v,false,{off:1.05,e0y:1.05,d:15});v.see=v.rtE*1.05;assert(!ctx.xbReady(v,15),'no new pull mid-flick');v.see=3;assert(ctx.xbReady(v,15),'fires once on target');}
// 3. shots against the player standing at range (no strafe): server hit volumes
function shoot(dist,diff){ctx.S.diff=diff||'normal';const st={shots:0,head:0,body:0,legs:0,first:0,firstHit:0};
 for(let k=0;k<NAMES.length*12;k++){const u={name:'Bot '+NAMES[k%NAMES.length]+'#'+k,g:{rotation:{y:.2}},see:0,cr:false,mv:false},tg={t:ctx.player,x:0,z:-dist},from={x:0,y:1.7,z:0};ctx.player.y=0;
  ctx.xbEngage(u,true,{off:.2,e0y:.2,d:dist});u.see=u.rtE+.05;let n=0;while(u.see<1.6){if(ctx.xbReady(u,dist)||n){const p=ctx.xbShot(u,tg,from,'Vandal',{rec:1},dist,{ae:1.3,rt:260});st.shots++;if(n===0){st.first++;if(p)st.firstHit++;}if(p)st[p]++;n++;u.see+=dist>20?.4:.103;now+=dist>20?400:103;}else{u.see+=1/60;now+=16;}}}
 st.hits=st.head+st.body+st.legs;st.acc=st.hits/st.shots;st.hs=st.head/Math.max(1,st.hits);return st;}
{const S={};for(const d of [8,15,25,40])S[d]=shoot(d);const H=[8,15,25,40].reduce((s,d)=>s+S[d].head,0),T=[8,15,25,40].reduce((s,d)=>s+S[d].hits,0);
 assert(H/T>.12&&H/T<.28,'headshot share 12-28 % of hits ('+(H/T*100).toFixed(1)+' %)');assert(S[8].acc>S[25].acc&&S[25].acc>S[40].acc,'accuracy falls with range');
 assert(S[40].firstHit/S[40].first<.5,'first shot at 40 m usually misses ('+(S[40].firstHit/S[40].first*100).toFixed(0)+' %)');
 const E=shoot(15,'easy'),Hd=shoot(15,'hard');assert(E.acc<S[15].acc&&Hd.acc>S[15].acc,'difficulty scales accuracy (easy '+(E.acc*100).toFixed(0)+' / normal '+(S[15].acc*100).toFixed(0)+' / hard '+(Hd.acc*100).toFixed(0)+' %)');ctx.S.diff='normal';
 // crouching target: the head drops with it
 ctx.player.ch=.45;const C=shoot(15);ctx.player.ch=0;assert(C.hits>0,'hits a crouching target');
 out.push('shots: HS '+(H/T*100).toFixed(0)+' % of hits; accuracy 8/15/25/40 m '+[8,15,25,40].map(d=>(S[d].acc*100).toFixed(0)).join('/')+' %; first shot at 40 m '+(S[40].firstHit/S[40].first*100).toFixed(0)+' %; easy/normal/hard 15 m '+[E,S[15],Hd].map(s=>(s.acc*100).toFixed(0)).join('/')+' %');}
// 4. discipline: some fights fire on the move, not all
{let sl=0,n=0;for(const nm of NAMES){const u={name:'Bot '+nm+' d'};for(let k=0;k<20;k++){ctx.xbEngage(u,true,{off:.1,e0y:.1,d:15});n++;if(u.xbSl)sl++;}}assert(sl/n>.05&&sl/n<.6,'some fights are not counter-strafed ('+(sl/n*100).toFixed(0)+' %)');out.push('sloppy fights '+(sl/n*100).toFixed(0)+' %');}
console.log('Offline bots human-like: '+out.join('; '));
