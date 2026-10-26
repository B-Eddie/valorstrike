// Offline bots perceive like the server's (bots-perception-2; vendor/bot-brain.cjs SENSE / inView / audible / mem*): the
// BOT VARIETY block's perception helpers run here in a vm, and the base loop's wiring is pinned.
//  1. view cone: enemy and ally bots pick a target only inside the 103 deg view (xbInView), a cached sighting outside it ends
//  2. no stale fire: every shot needs a fresh, uncached line (xbLosNow -> losRaw, not the 100 ms los cache); a failed one
//     ends the fight and the burst that frame
//  3. hearing: running footsteps within 30 m (the player's own too), gunshots across the map (suppressed Phantom within
//     40 m), a bot's ability cast within 30 m -> memory, placed roughly; walking / crouching never reach SFX.step
//  4. turn rate: off-fight facing (xFace) turns at the bot's own sensitivity-derived rate toward a sound or the freshest
//     contact (no lerp snap)
//  5. no omniscience: unsighted Deathmatch bots hunt a contact or roam the spawn points, never the enemy's real spot; peeks /
//     creeping use what the bot knows
//  6. the player's own ability casts (any charge / the ult spent) are heard within 30 m like a bot's (bots-tune-1)
//  7. unsighted ability logic (botAb, both teams) gets only the remembered contact (xbAbKnown), never the nearest real enemy
//  8. sound reactions (xHear / xbvSound) use the server botSense ranges (BotBrain.reactR): shots 35 m, steps / casts 30 m
//  9. flash reads (bots-tune-4, BotBrain.flashRead as the server's flashDodge): the player's flash throws warn enemy bots that
//     would be blinded; a read turns the body away at the bot's turn rate (xBotYaw) and holds fire; mid-fight reads are rarer;
//     no read facing away or without sight; blinded bots back out or hold (BotBrain.blindPlay)
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),A='// ---- BOT VARIETY ----',Z='// ---- END BOT VARIETY ----',i=html.indexOf(A),j=html.indexOf(Z,i);assert(i>=0&&j>i,'bot variety block');
const block=html.slice(i,j+Z.length),out=[];
// base loop wiring
for(const w of ['s = (typeof xbInView !== "function" || xbInView(b, f.x - p.x, f.z - p.z, fd)) && los(from, f.eye)',
 'if (see && typeof xbInView === "function" && !xbInView(b, dx, dz, d)) { see = false; b.xSe = false; b.xTh = 0; }',
 '(typeof xbLosNow !== "function" || xbLosNow(from, eye) || ((b.xSe = false), (b.xTh = 0), (b.bn = 0), false))',
 'if (d < td && (typeof xbInView !== "function" || xbInView(a, q.x - p.x, q.z - p.z, d)))',
 '(typeof xbLosNow !== "function" || xbLosNow(from, XTK.q.set(tg.g.position.x, (tg.g.position.y || 0) + 1.5, tg.g.position.z)) || ((a.xTg = null), (a.xTh = 0), false))',
 'if (typeof xbHunt === "function") [gx, gz] = xbHunt(b, tg, XG_V);','xPeekMove(b, dt, kd, kx, kz, vx, vz)','botWalk(b, see, kd)','xPeekMove(a, dt, apd, apx, apz, vx, vz)',
 'const y = typeof xbFaceTo === "function" ? xbFaceTo(u, t, dt) : null;',
 'botAb(b, dt, see, see || typeof xbAbKnown !== "function" ? tg : xbAbKnown(b), from);','else botAb(a, dt, false, typeof xbAbKnown === "function" ? xbAbKnown(a) : null, from);','d < (typeof xbEarR === "function" ? xbEarR() : 25)','botStep(b, dt, Math.hypot(p.x - bx0, p.z - bz0), b.cr || b.wk, b.spd);'/* footsteps by distance (shared motor footfall): crouching / walking bots pass quiet and never reach SFX.step */])assert(html.includes(w),'wired: '+w);
let now=0,rnd=7;const R=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647;};const calls={los:0,losRaw:0};
const SFX={at(p){ctx.xHear(p);},step(p){ctx.xHear(p);},selfStep(){}};/* index.html wraps SFX.at / SFX.step to call xHear(p) (the BOT VARIETY block then wraps both) */
const ctx={Math:Object.assign(Object.create(Math),{random:R}),Object,Number,Infinity,Set,Map,WeakMap,Array,Float64Array,Int32Array,Uint8Array,THREE,performance:{now:()=>now},window:{xBotSeed:91},mode:'five',running:true,
 player:{hp:100,x:0,y:0,z:0,ch:0},allies:[],bots:[],timeLeft:100,S:{diff:'normal'},FV:{you:0,them:0,map:'ascent',atk:true,dm:false,sp:null},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},
 nmActive:()=>null,xSmV:(u,dt,vx,vz)=>[vx,vz],xGoal:(u,t,a,o)=>o,nmClimbOk:()=>false,nmPath:()=>[0],nmNext:()=>[0],SFX,
 los:()=>{calls.los++;return true;},losRaw:()=>{calls.losRaw++;return ctx.wall?false:true;},wall:false,dmPts:()=>[[30,30],[-30,30],[30,-30],[-30,-30],[0,40]],wName:()=>'Phantom',
 xHear:function(p){/* base xHear range rule (index.html): the other side within xbEarR m turns toward it */for(const u of ctx.bots){const d=Math.hypot(u.g.position.x-p.x,u.g.position.z-p.z);if(d>1&&d<ctx.xbEarR()){u.hear=[p.x,p.z];u.hearT=1.2;}}},
 xBotYaw:function(){},botCanShoot:()=>true,XAB_REL:.2,xBUse:()=>true,xAng:a=>Math.atan2(Math.sin(a),Math.cos(a)),tick:function(){},J:{c:1,q:0,e:0,ult:0}};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(block+'\n;globalThis.BotBrain=BotBrain;globalThis.BotRoutes=BotRoutes;',ctx);Object.assign(ctx.window,{BotRoutes:ctx.BotRoutes,BotBrain:ctx.BotBrain});
const B=ctx.BotBrain,unit=(name,x,z,ry)=>({name,alive:true,hp:100,g:{position:{x,y:0,z},rotation:{y:ry||0}},see:0});
// xFace as in index.html (pinned above): the base function is not in the block, so it is evaluated from the page source
{const k=html.indexOf('function xFace(u, dt, vx, vz)'),e=html.indexOf('\n}\n',k);vm.runInContext(html.slice(k,e+2),ctx);}
// 1. view cone
{const u=unit('Bot Jett',0,0,0);const res=[];for(const deg of [0,45,50,56,90,180]){const a=deg*Math.PI/180;res.push(deg+':'+(ctx.xbInView(u,Math.sin(a)*12,Math.cos(a)*12,12)?'in':'out'));}
 assert.deepEqual(res,['0:in','45:in','50:in','56:out','90:out','180:out'],'103 deg view cone around rotation.y ('+res+')');out.push('view cone '+res.join(' '));}
// 2. fresh line of sight per shot
{calls.los=calls.losRaw=0;ctx.wall=false;assert.equal(ctx.xbLosNow({},{}),true);ctx.wall=true;assert.equal(ctx.xbLosNow({},{}),false,'a wall that just went up blocks the shot');ctx.wall=false;
 assert.equal(calls.losRaw,2);assert.equal(calls.los,0,'the cached los is never used for a shot');out.push('shot gate: uncached losRaw each shot');}
// 3. hearing
{const heard=(src,kind,d,w)=>{const L=unit('Bot Omen',0,0,0);ctx.bots=[L];ctx.allies=[];let sx=0,sz=d;if(src==='player'){ctx.player.x=sx;ctx.player.z=sz;ctx.player.hp=100;}else{ctx.allies=[unit('Ally Sage',sx,sz,0)];ctx.player.hp=0;}
  L.xMem=null;now+=5000;if(kind==='step'&&src==='player')ctx.SFX.selfStep();else if(kind==='cast')ctx.xBUse(ctx.allies[0],'q');else if(kind==='step')ctx.SFX.step({x:sx,y:0,z:sz});else ctx.SFX.at({x:sx,y:0,z:sz},w);
  const c=L.xMem&&L.xMem.c[src==='player'?'player':'Ally Sage'];return c?{c,err:Math.hypot(c.x-sx,c.z-sz),L}:null;};
 assert(heard('ally','step',25),'running ally footsteps 25 m away are heard');assert(!heard('ally','step',35),'not 35 m away');
 assert(heard('player','step',20),'the player running 20 m away is heard (SFX.selfStep)');assert(!heard('player','step',34),'not 34 m away');
 assert(heard('ally','shot',100,'Vandal'),'a Vandal shot across the map');assert(!heard('ally','shot',45,'Phantom'),'a suppressed Phantom not at 45 m');assert(heard('ally','shot',30,'Phantom'),'within 40 m it is');
 assert(heard('ally','cast',25),'an ability cast within 30 m');assert(!heard('ally','cast',40),'not 40 m away');
 const h=heard('ally','step',25);assert(h.err>0&&h.err<=25*B.SENSE.ear+1e-9,'placed roughly ('+h.err.toFixed(2)+' m)');assert(h.L.hearT>0,'a close sound also turns it (xbEarR 30 m)');
 const far=heard('ally','shot',100,'Vandal');assert(!(far.L.hearT>0),'a far gunshot is remembered but does not stop / turn it (35 m reaction range)');
 out.push('hearing: steps 25 m yes / 35 m no (player 20 yes / 34 no), Vandal 100 m yes, Phantom 45 no / 30 yes, cast 25 yes / 40 no, '+h.err.toFixed(1)+' m off at 25 m');}
// 4. off-fight facing turns at the bot's rate
{const u=unit('Bot Raze',0,0,0);ctx.bots=[u];const P=ctx.xbBrain(u);u.hear=[0,-10];u.hearT=1;const ys=[];for(let f=0;f<60;f++){const y0=u.g.rotation.y;ctx.xFace(u,1/60,0,0);ys.push(Math.abs(ctx.xAng(u.g.rotation.y-y0)));}
 assert(Math.max(...ys)<=P.turn/60+1e-9,'turns at most its turn rate ('+(Math.max(...ys)*60).toFixed(1)+' vs '+P.turn.toFixed(1)+' rad/s)');assert(Math.abs(ctx.xAng(u.g.rotation.y-Math.PI))<.05,'and gets there');
 const v=unit('Bot Sova',0,0,0);ctx.bots=[v];now+=9000;ctx.xbSeen(v,ctx.player,8,0,0);ctx.player.hp=100;for(let f=0;f<60;f++)ctx.xFace(v,1/60,0,0);assert(Math.abs(ctx.xAng(v.g.rotation.y-Math.PI/2))<.05,'faces the spot it last saw an enemy');
 out.push('xFace '+(Math.max(...ys)*60).toFixed(1)+' rad/s max (cap '+P.turn.toFixed(1)+'), 180 in '+(ys.findIndex((_,k)=>Math.abs(ctx.xAng(Math.PI-ys.slice(0,k+1).reduce((s,x)=>s+x,0)))<.05)/60).toFixed(2)+' s');}
// 5. no omniscience
{ctx.FV.dm=true;const u=unit('Bot Breach',0,0,0);u.xMem=null;now+=20000;const tg={x:3,z:4},g=ctx.xbHunt(u,tg,[0,0]);assert(!(g[0]===3&&g[1]===4),'no contact: does not go to the enemy');assert(ctx.dmPts().some(q=>q[0]===g[0]&&q[1]===g[1]),'roams a spawn point');
 ctx.player.hp=100;ctx.player.x=10;ctx.player.z=0;ctx.xbSeen(u,ctx.player,10,0,0);const g2=ctx.xbHunt(u,tg,[0,0]);assert.deepEqual([g2[0],g2[1]],[10,0],'hunts the last-known spot');
 const k0=ctx.xbKnown(unit('Bot Cypher',0,0,0),{x:0,z:0});assert.equal(k0[2],1e9,'nothing known: no peek / creep distance');ctx.FV.dm=false;
 out.push('DM: roams spawn points with nothing known, hunts last-known spot');}
// 6. the player's casts are heard (30 m) and turn / hold bots like a bot's cast
{const cast=d=>{const L=unit('Bot Omen',0,0,0);ctx.bots=[L];ctx.allies=[];L.xMem=null;L.hearT=0;L.xHeardAt=0;now+=5000;Object.assign(ctx.player,{x:0,z:d,hp:100});ctx.FV.dm=false;
  ctx.J.c=1;ctx.J.ult=0;ctx.tick(1/60);ctx.J.c=0;ctx.tick(1/60);const c=L.xMem&&L.xMem.c.player;return {c,L};};
 const a=cast(22),b=cast(38);assert(a.c&&a.c.kind==='heard','a player cast 22 m away is heard');assert(a.L.hearT>0,'and turns the bot (30 m reaction)');assert(!b.c,'not 38 m away');
 const L=unit('Bot Omen',0,0,0);ctx.bots=[L];L.xMem=null;Object.assign(ctx.player,{x:0,z:10});ctx.J.c=2;ctx.tick(1/60);ctx.J.c=3;ctx.tick(1/60);assert(!(L.xMem&&L.xMem.c.player),'buying a charge is silent');
 ctx.J.ult=7;ctx.tick(1/60);ctx.J.ult=0;ctx.tick(1/60);assert(L.xMem&&L.xMem.c.player,'an ult cast is heard');
 out.push('player casts: 22 m heard + turn, 38 m not, buying silent, ult heard');}
// 7. unsighted ability target = memory only
{const u=unit('Bot Raze',0,0,0);u.xMem=null;now+=20000;assert.equal(ctx.xbAbKnown(u),null,'nothing known: no ability target (was the nearest real enemy)');
 ctx.player.hp=100;ctx.player.x=4;ctx.player.z=9;ctx.xbSeen(u,ctx.player,4,0,9);ctx.player.x=-12;ctx.player.z=3;/* it moved since */const k=ctx.xbAbKnown(u);
 assert.deepEqual([k.x,k.z],[4,9],'the remembered spot, not where the enemy really is now');assert.equal(k.t,null,'no live unit handle');now+=11000;assert.equal(ctx.xbAbKnown(u),null,'forgotten after SENSE.hunt s');
 out.push('botAb unsighted: null with nothing known, last-known spot otherwise');}
// 8. reaction ranges = server botSense (BotBrain.reactR)
{const r=(k,w)=>{ctx.XBH.k=k;ctx.XBH.w=w;try{return ctx.xbEarR();}finally{ctx.XBH.k=null;ctx.XBH.w=null;}};
 assert.equal(r('shot','Vandal'),35);assert.equal(r('shot','Phantom'),35);assert.equal(r('step',null),30);assert.equal(r('cast',null),30);assert.equal(r(null,null),35,"the player's own shot (no XBH.k) is a 35 m shot");
 for(const [k,w] of [['shot','Vandal'],['step',null],['cast',null]])assert.equal(r(k,w),B.reactR(k,w),'offline = server '+k);
 out.push('reaction ranges shot 35 / step 30 / cast 30 = BotBrain.reactR');}
// 9. flash reads
{for(const w of ['xbFlashWarn(c.end, xWf("curveball"))','xbFlashWarn(p, xWf("flashpoint"))','xbFlashWarn(h.m.position.clone(), XGL.act)'])assert(html.includes(w),'wired: '+w);
 const pop=new THREE.Vector3(0,1.6,6),run=(popIn,fight,n)=>{let read=0,dodged=0,blind=0;for(let k=0;k<n;k++){const b=unit('Bot Flash'+k+(fight?'f':''),0,0,(R()-.5)*.8);b.see=fight?1:0;ctx.bots=[b];ctx.allies=[];Object.assign(ctx.player,{x:0,z:12,hp:100});
   now+=5000;ctx.xbFlashWarn(pop,popIn);if(b.xFd){read++;assert(ctx.botCanShoot(b)||now<b.xFd.at,'no shot while turning away');}
   for(let t=0;t<popIn;t+=1/60){now+=1000/60;ctx.xBotYaw(1/60);if(b.xFd&&now>=b.xFd.at)assert.equal(ctx.botCanShoot(b),false,'no shot while turning away');}
   const ry=b.g.rotation.y,f=(pop.x*Math.sin(ry)+pop.z*Math.cos(ry))/6;if(f>.3)blind++;else if(b.xFd)dodged++;}return {read:read/n,dodged:read?dodged/read:0,blind:blind/n};};
 const cb=run(.4,false,200),fp=run(.3,false,200),ft=run(.4,true,200),late=run(.05,false,100);
 assert(cb.read>.3&&cb.read<.85,'reads a Curveball it faces 30-85 % of the time: '+cb.read);assert(cb.dodged>.5,'most Curveball reads beat the 0.4 s pop: '+cb.dodged);
 assert(ft.read<cb.read*.7,'mid-fight reads are rarer (tunnel vision): '+ft.read+' vs '+cb.read);assert(late.dodged<.1,'a 0.05 s pop cannot be beaten: '+late.dodged);
 assert(cb.blind<.85&&fp.blind>cb.blind,'blinded Curveball '+cb.blind+' < Flashpoint '+fp.blind);
 {const b=unit('Bot Away',0,0,Math.PI);ctx.bots=[b];ctx.xbFlashWarn(pop,.4);assert(!b.xFd,'facing away: nothing to read');
  const c=unit('Bot Wall',0,0,0);ctx.bots=[c];const l0=ctx.los;ctx.los=()=>false;try{ctx.xbFlashWarn(pop,.4);}finally{ctx.los=l0;}assert(!c.xFd,'pop out of sight: nothing to read');}
 {const acts={};for(let k=0;k<200;k++){const b=unit('Bot Blind'+k,0,0,0);b.blind=2;b.xMem=null;const o=ctx.xGoal(b,1,true,[0,0]);const a=b.xBp.act;acts[a]=(acts[a]||0)+1;
   if(a==='back')assert(Math.abs(o[1]+3)<1e-9&&Math.abs(o[0])<1e-9,'backs out of the angle (3 m behind its view)');else assert.deepEqual(o,[0,0],'holds where it stands');b.blind=0;ctx.xGoal(b,1,true,[9,9]);assert.equal(b.xBp,null,'plan ends with the blind');}
  assert(acts.back>20&&acts.hold>20&&!acts.spray,'blinded: back '+acts.back+' / hold '+acts.hold);}
 out.push('flash reads: Curveball read '+(cb.read*100).toFixed(0)+' % / beaten '+(cb.dodged*100).toFixed(0)+' % of reads / blinded '+(cb.blind*100).toFixed(0)+' %, Flashpoint (0.3 s) blinded '+(fp.blind*100).toFixed(0)+' %, mid-fight read '+(ft.read*100).toFixed(0)+' %, 0.05 s pop beaten '+(late.dodged*100).toFixed(0)+' %; facing away / no sight: no read; blinded back / hold');}
console.log('Offline bot perception: '+out.join('; '));
