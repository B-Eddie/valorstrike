// Offline enemy bots aim like mid-ranked players with the same model as the server (bots-human-1; vendor/bot-brain.cjs):
// the BOT VARIETY block's xbEngage(ctx) / xbFaceAim / xbReady / xbShot run here in a vm with THREE, and the base loop's wiring
// is pinned. Checks: reaction off-angle / flash costs, the visible yaw flicks (eases in and out, turn-rate limited, never a
// snap), a new pull waits for the flick, shots are judged against the server hit volumes (head share of hits 12-38 %,
// accuracy falls with range; bot-spray: head share 12-38 % = the server's all-hits window), the recoil pull is partial, a sloppy fight may fire before stopping, difficulty scales it.
// bot-gun: the shots fire along the bot's view, steered every frame by xbView (flick plan + tracking lag through the
// turn / acceleration limits); targets in front of the bot (+z).
// bots-tune-1: trigger pulls are the server's BotBrain.firePattern mix by range (xbBurst), spray control fades over a long
// spray (BotBrain.sprayFade), the visible yaw is acceleration-limited (BotBrain.turnStep with the bot's xTurnSt).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs')),MO=require(path.join(root,'vendor/valorant-feel.js'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),A='// ---- BOT VARIETY ----',Z='// ---- END BOT VARIETY ----',i=html.indexOf(A),j=html.indexOf(Z,i);assert(i>=0&&j>i,'bot variety block');
const block=html.slice(i,j+Z.length);
// base loop wiring (enemy bots)
for(const w of ['xbEngage(b, b.pre, { off: Math.abs(oy), e0y: oy, d, dy:','typeof xbFaceAim === "function" ? xbFaceAim(b, Math.atan2(dx, dz), dt)','typeof xbShot === "function" ? xbShot(b, tg, from, w, W, d, D)',
 '(botStopped(b) || b.xbSl)'/* 83b0d90: weapon deadzone stop (was BOT_STOP 1.4 m/s) */,'(b.bn > 0 || typeof xbReady !== "function" || xbReady(b, d))','b.see = see && !(b.blind > 0) ?','if (b.blind > 0) b.xbFl = performance.now();'])assert(html.includes(w),'wired: '+w);
assert(!/if \(see\) b\.g\.rotation\.y = Math\.atan2\(dx, dz\);/.test(html),'enemy bots no longer snap their yaw onto the target');
for(const w of ['b.bn = typeof xbBurst === "function" ? xbBurst(b, d, W) :','(b.xbPz != null ? Math.max(1 / (W.rate || 4), b.xbPz) :'])assert(html.includes(w),'wired: '+w);
for(const w of ['rc=u.xbPull&&S&&S.lastWeapon===w&&tm-(S.shot??-9)<.3?u.xbPull*BotBrain.sprayFade(S.sequence||0):0;','bSpread(u,w,W,aim,d,D);','u.xTurnSt||(u.xTurnSt={v:0})'])assert(block.includes(w),'block: '+w);
// bot-spray: the page's bSpread is the server's gun (shared motor spread + bloom + spray recoil), pinned; the stand-in below runs the same motor
for(const w of ['M.sprayStep(R, w, (M.REC[w] != null ? M.REC[w] : 1) * (b.cr ? 0.85 : 1) * M.recoilMove(st, w), t, Math.random, M.bloomCap(st, w, P));','const cone = M.spread(st, w, P) + M.sprayBloom(R, w, t);'])assert(html.includes(w),'bSpread: '+w);
let now=0,rnd=1;const R=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647;};
const ctx={Math:Object.assign(Object.create(Math),{random:R}),Object,Number,Infinity,Set,Map,WeakMap,Array,Float64Array,Int32Array,Uint8Array,THREE,performance:{now:()=>now},window:{xBotSeed:77},mode:'five',running:true,
 player:{hp:100,x:0,y:0,z:0,ch:0},allies:[],bots:[],timeLeft:100,S:{diff:'normal'},FV:{you:0,them:0,map:'ascent',atk:true,dm:false,sp:null},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},nmActive:()=>null,xSmV:(u,dt,vx,vz)=>[vx,vz],xGoal:(u,t,a,o)=>o,nmClimbOk:()=>false,nmPath:()=>[0],nmNext:()=>[0],
 // bSpread stand-in: the page's bSpread (= server fire) on the shared motor - spread + bloom from the spray state b.xsp, the spray's climb / drift, a disk sample of the cone (seeded)
 bSpread:(b,w,W,dir,d,D)=>{const t=now/1000,Rs=b.xsp||(b.xsp={});MO.sprayReset(Rs,w,t);const st={sf:b.mv?1:0,mv:!!b.mv,cr:!!b.cr,ads:0},cone=MO.spread(st,w,{})+MO.sprayBloom(Rs,w,t);MO.sprayStep(Rs,w,(MO.REC[w]??1)*(b.cr?.85:1)*MO.recoilMove(st,w),t,R,MO.bloomCap(st,w,{}));const r=new THREE.Vector3(-dir.z,0,dir.x).normalize(),q=new THREE.Vector3().crossVectors(r,dir).normalize(),[x,y]=MO.disk(R),kx=x*cone+Rs.recoilX,ky=y*cone+Rs.recoilY;dir.x+=r.x*kx+q.x*ky;dir.y+=r.y*kx+q.y*ky;dir.z+=r.z*kx+q.z*ky;dir.normalize();b.sn=Rs.sequence;b.lt=0;}};
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
 for(let k=0;k<NAMES.length*12;k++){const u={name:'Bot '+NAMES[k%NAMES.length]+'#'+k,g:{rotation:{y:.2},position:{x:0,y:0,z:0}},see:0,cr:false,mv:false},tg={t:ctx.player,x:0,z:dist},from={x:0,y:1.6,z:0};ctx.player.y=0;
  ctx.xbEngage(u,true,{off:.2,e0y:.2,d:dist});u.see=u.rtE+.05;let n=0,next=0;while(u.see<1.6){ctx.xbView(u,ctx.player,tg.x,0,tg.z,ctx.player.ch||0,1/60);/* bot-gun: the view (xbView) is what the shot fires along */if(u.see>=next&&(n||ctx.xbReady(u,dist))){const p=ctx.xbShot(u,tg,from,'Vandal',{rec:1},dist,{ae:1.3,rt:260});st.shots++;if(n===0){st.first++;if(p)st.firstHit++;}if(p)st[p]++;n++;next=u.see+(dist>20?.4:.103);}u.see+=1/60;now+=1000/60;}}
 st.hits=st.head+st.body+st.legs;st.acc=st.hits/st.shots;st.hs=st.head/Math.max(1,st.hits);return st;}
{const S={};for(const d of [8,15,25,40])S[d]=shoot(d);const H=[8,15,25,40].reduce((s,d)=>s+S[d].head,0),T=[8,15,25,40].reduce((s,d)=>s+S[d].hits,0);
 /* bot-spray: the shots now use the server's gun (motor spread + bloom + recoil, was ~3-4x wider), so the hits land where the crosshair is as on the server: this row (all hits over 1.6 s of fire, no kill) is the server's all-hits HS window: test-bot-human 12-36 % (33 % there), test-bot-aim-kpi long duels 12-38 %; was 12-28 % with the wide offline cone (offline now 36 %) */assert(H/T>.12&&H/T<.38,'headshot share 12-38 % of hits, = the server all-hits window ('+(H/T*100).toFixed(1)+' %)');assert(S[8].acc>S[25].acc&&S[25].acc>S[40].acc,'accuracy falls with range');
 assert(S[40].firstHit/S[40].first<.5,'first shot at 40 m usually misses ('+(S[40].firstHit/S[40].first*100).toFixed(0)+' %)');
 const E=shoot(15,'easy'),Hd=shoot(15,'hard');assert(E.acc<S[15].acc&&Hd.acc>S[15].acc,'difficulty scales accuracy (easy '+(E.acc*100).toFixed(0)+' / normal '+(S[15].acc*100).toFixed(0)+' / hard '+(Hd.acc*100).toFixed(0)+' %)');ctx.S.diff='normal';
 // crouching target: the head drops with it
 ctx.player.ch=.45;const C=shoot(15);ctx.player.ch=0;assert(C.hits>0,'hits a crouching target');
 out.push('shots: HS '+(H/T*100).toFixed(0)+' % of hits; accuracy 8/15/25/40 m '+[8,15,25,40].map(d=>(S[d].acc*100).toFixed(0)).join('/')+' %; first shot at 40 m '+(S[40].firstHit/S[40].first*100).toFixed(0)+' %; easy/normal/hard 15 m '+[E,S[15],Hd].map(s=>(s.acc*100).toFixed(0)).join('/')+' %');}
// bots-tune-2: a strafing (ADAD) target at 15 m is hit less - after each reversal the crosshair keeps going the old way
// (BotBrain.trackTurn, = server test-bot-human strafing row; x0.80 before it, x0.61 with it); bot-gun: the lag is now the view's (xbView, frame by
// frame through the turn limits): x0.77-0.87, window x0.5-0.9 (= server test-bot-human x0.55-0.9); the shots are 103 ms apart, the target reverses every 0.45-0.7 s
{const ST={hits:0,shots:0};for(let k=0;k<NAMES.length*12;k++){const u={name:'Bot '+NAMES[k%NAMES.length]+'#'+k,g:{rotation:{y:.2},position:{x:0,y:0,z:0}},see:0,cr:false,mv:false},tg={t:ctx.player,x:0,z:15},from={x:0,y:1.6,z:0};
  let vx=0,side=1,flip=.45+(k%10)/40,n=0;ctx.xbEngage(u,true,{off:.2,e0y:.2,d:15});u.see=u.rtE+.05;
  const adv=dt=>{for(let q=0;q<dt;q+=1/120){flip-=1/120;if(flip<=0){side=-side;flip=.45+((k*37+q*1e3)%10)/40;}vx+=Math.max(-1,Math.min(1,(side*5.4-vx)/(5.4*1/120/.12)))*5.4/120/.12;tg.x+=vx/120;}};
  let next=0;while(u.see<1.6){ctx.xbView(u,ctx.player,tg.x,0,tg.z,0,1/60);if(u.see>=next&&(n||ctx.xbReady(u,15))){const p=ctx.xbShot(u,tg,from,'Vandal',{rec:1},15,{ae:1.3,rt:260});ST.shots++;if(p)ST.hits++;n++;next=u.see+.103;}u.see+=1/60;now+=1000/60;adv(1/60);}}
 const still=shoot(15),r=(ST.hits/ST.shots)/still.acc;assert(r>.5&&r<.9,'ADAD target at 15 m hit less, not never ('+(ST.hits/ST.shots*100).toFixed(0)+' % vs '+(still.acc*100).toFixed(0)+' % standing, x'+r.toFixed(2)+')');
 out.push('ADAD 15 m '+(ST.hits/ST.shots*100).toFixed(0)+' % vs standing '+(still.acc*100).toFixed(0)+' %');}
// 4. discipline: some fights fire on the move, not all
{let sl=0,n=0;for(const nm of NAMES){const u={name:'Bot '+nm+' d'};for(let k=0;k<20;k++){ctx.xbEngage(u,true,{off:.1,e0y:.1,d:15});n++;if(u.xbSl)sl++;}}assert(sl/n>.05&&sl/n<.6,'some fights are not counter-strafed ('+(sl/n*100).toFixed(0)+' %)');out.push('sloppy fights '+(sl/n*100).toFixed(0)+' %');}
// bots-tune-1: fire mix by range (= server firePattern), semi-autos tap; acceleration-limited visible flick
{const u={name:'Bot Sova'},mix=(d,W)=>{const n={tap:0,burst:0,spray:0};for(let k=0;k<1500;k++){ctx.xbBurst(u,d,W);n[u.xbPat]++;assert(u.xbPz>0,'a pause after the pull');}return n;};
 const n8=mix(8,{rate:9.75}),n22=mix(22,{rate:9.75}),n40=mix(40,{rate:9.75}),sh=mix(15,{rate:4,semi:1});
 assert(n8.spray>n8.burst&&n22.burst>100&&n22.spray>100&&n40.tap>n8.tap*3,'tap / burst / spray mix by range ('+JSON.stringify([n8,n22,n40])+')');assert.equal(sh.tap,1500,'semi-auto: taps');
 const v={name:'Bot Raze',g:{rotation:{y:Math.PI-.01}},see:0},B=ctx.xbBrain(v),a=ctx.BotBrain.turnAcc(B),dt=1/60;let y0=v.g.rotation.y,w0=0,maxA=0;
 for(let f=0;f<60;f++){v.g.rotation.y=ctx.xbFaceTo(v,0,dt);const w=ctx.BotBrain.wrapA(v.g.rotation.y-y0)/dt;maxA=Math.max(maxA,Math.abs(w-w0)/dt);w0=w;y0=v.g.rotation.y;}
 assert(maxA<=a*1.0001,'off-fight 180 within the hand acceleration ('+maxA.toFixed(0)+' <= '+a.toFixed(0)+' rad/s^2)');assert(Math.abs(ctx.BotBrain.wrapA(v.g.rotation.y))<.02,'and it gets there');
 out.push('fire mix 8 m '+JSON.stringify(n8)+' 40 m '+JSON.stringify(n40)+'; 180 accel <= '+maxA.toFixed(0)+' rad/s^2');}
console.log('Offline bots human-like: '+out.join('; '));
