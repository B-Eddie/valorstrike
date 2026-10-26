// Bot Jett Tailwind / Updraft (qa-31): the offline bots cast them like the server's bots, and both sides share one rule
// (vendor/bot-brain.cjs tailwindDash / tailwindKeys). An entry bot arms Tailwind in a fight (the E charge is spent, 1 s
// windup, 7.5 s window) and keeps the dash to get OUT: after a kill in the window, when hurt (under 50 HP or 30 lost since
// arming), or as the window runs out; the dash is the shared motor's 11 m / 0.45 s burst, backwards + a side from the enemy,
// and the bot does not walk while it runs (botK 0). With no E left an entry bot Updrafts (Q): the player's / server's jump,
// flown by xBJettMove off the floor snaps, landing back on the floor.
//   node work/test_bot_jett.cjs
const assert=require('assert/strict'),path=require('path');const {boot}=require('./page_harness.cjs');
const BB=require(path.join(__dirname,'..','vendor','bot-brain.cjs'));
// the shared rule
assert.equal(BB.tailwindDash({armed:false,hp:10,hp0:100,kills:3,left:5}),null,'not before the windup is over');
assert.equal(BB.tailwindDash({armed:true,hp:100,hp0:100,kills:0,left:5}),null,'armed, healthy, no kill: keep it');
assert.equal(BB.tailwindDash({armed:true,hp:100,hp0:100,kills:1,left:5}),'kill');
assert.equal(BB.tailwindDash({armed:true,hp:49,hp0:60,kills:0,left:5}),'hurt');
assert.equal(BB.tailwindDash({armed:true,hp:70,hp0:100,kills:0,left:5}),'hurt','30 lost since arming');
assert.equal(BB.tailwindDash({armed:true,hp:71,hp0:100,kills:0,left:5}),null);
assert.equal(BB.tailwindDash({armed:true,hp:100,hp0:100,kills:0,left:.5}),'expiring');
{const k=BB.tailwindKeys(()=>.2),k2=BB.tailwindKeys(()=>.8);assert.equal(k.f,-1);assert.equal(k2.f,-1);assert.deepEqual([k.s,k2.s],[-1,1]);}
(async()=>{
 // server: the armed dash waits, then goes backwards from the enemy the bot faces once it is hurt
 {const {SpikeSimulation}=await import(path.join(__dirname,'..','server','src','spike.js'));
  const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
  const s=new SpikeSimulation(W),j=s.add('j','Jett',false),o=s.add('o');s.start(false);s.buy=0;s.roundDelay=0;Object.assign(j,{x:0,y:0,z:0,look:0,hp:100});j.ability.e=1;j.ability.q=1;Object.assign(o,{x:0,y:0,z:-10});
  const P={role:'entry',util:0,r:()=>.3};s.botUtility(j,o,10,P,1);assert.ok(j.tailwind,'entry bot armed Tailwind');assert.equal(j.ability.e,0);assert.equal(j.tailwind.hp0,100);
  s.time=j.tailwind.armAt+.1;s.botUtility(j,o,10,P,1);assert.equal(j.dash||null,null,'armed and healthy: no dash yet');assert.ok(j.tailwind);
  j.hp=45;s.botUtility(j,o,10,P,1);assert.ok(j.dash,'hurt: dash');assert.equal(j.twOut,'hurt');assert.ok(j.dash.dz>0,'away from the enemy at -z ('+j.dash.dz.toFixed(2)+')');assert.ok(Math.abs(j.dash.dx)>.5,'and to a side');
  j.dash=null;j.utilAt=0;s.botUtility(j,o,10,P,1);assert.equal(j.ability.q,0,'no E left: Updraft');assert.ok(j.vy>10,'Updraft vy');
  // a kill in the window
  const s2=new SpikeSimulation(W),j2=s2.add('j2','Jett',false),o2=s2.add('o2');s2.start(false);s2.buy=0;s2.roundDelay=0;Object.assign(j2,{x:0,y:0,z:0,look:0,hp:100});j2.ability.e=1;Object.assign(o2,{x:0,y:0,z:-10});
  s2.botUtility(j2,o2,10,P,1);s2.time=j2.tailwind.armAt;s2.botUtility(j2,o2,10,P,1);assert.ok(!j2.dash);j2.kills=(j2.kills||0)+1;s2.botUtility(j2,o2,10,P,1);assert.ok(j2.dash,'kill: dash');assert.equal(j2.twOut,'kill');}
 // offline
 const H=boot({real3:true,seed:3}),xe=H.xe,J=c=>JSON.parse(xe('JSON.stringify('+c+')'));
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 H.$('pm5v5').click();await adv(50);
 for(let t=0;t<30000&&!(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'));t+=100){
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}await adv(100);}
 assert.ok(xe('running'),'5v5 did not start');
 const HT=require("fs").readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 assert.ok(HT.includes('if (ag === "Jett") xBJett(b, A, dt, see, tg, ch);'),'botAb runs xBJett for Jett bots');
 assert.ok(HT.includes('for (const b of bots) xBJettMove(b, dt); for (const a of allies) xBJettMove(a, dt);'),'jTick moves dashes / Updrafts every frame');
 const r=J(`(()=>{const b=bots.filter(b=>b.alive)[0],p=b.g.position,o={},br=b.brain,bs=b.brainS,hp=b.hp,p0=[p.x,p.y,p.z];
  try{b.brain={aggression:.9};b.brainS=xbvSeed();b.xdash=null;b.xup=null;const A={t:0,jU:.2},ch=Object.assign(xBCh(b),{c:0,q:1,e:1,tk:0}),tg={x:p.x,z:p.z-10};b.hp=100;
   for(let i=0;i<3;i++){A.t+=.1;xBJett(b,A,.1,true,tg,ch);}o.arm=!!A.tw;o.e=ch.e;o.q=ch.q;
   for(let i=0;i<12;i++){A.t+=.1;xBJett(b,A,.1,true,tg,ch);}o.wait=!b.xdash&&!!A.tw;
   b.hp=40;A.t+=.1;xBJett(b,A,.1,true,tg,ch);o.why=A.twOut;o.dash=!!b.xdash;o.k0=botK(b);const D=b.xdash;o.dz=D&&D.dz;o.dx=D&&D.dx;
   const x0=p.x,z0=p.z;let n=0;while(b.xdash&&n<40){xBJettMove(b,1/60);n++;}o.frames=n;o.moved=Math.hypot(p.x-x0,p.z-z0);o.k1=botK(b)>0;
   o.best=0;for(let k=0;k<16&&o.best<10.99;k++){p.set(p0[0],p0[1],p0[2]);const an=k*Math.PI/8;b.xdash=window.ValorantFeel.dash(1,0,an,XPAR2.tail,XPAR2.dashTime);let f=0;while(b.xdash&&f<60){xBJettMove(b,1/60);f++;}const mv=Math.hypot(p.x-p0[0],p.z-p0[2]);if(mv>o.best){o.best=mv;o.bestF=f;}}
   // a kill while armed (xBKill credits it)
   p.set(p0[0],p0[1],p0[2]);b.hp=100;const A2={t:0,jU:.2},ch2=Object.assign(xBCh(b),{c:0,q:0,e:1,tk:0});b.ab=Object.assign(b.ab||{},{tw:null});
   for(let i=0;i<14;i++){A2.t+=.1;xBJett(b,A2,.1,true,tg,ch2);}o.wait2=!b.xdash;b.ab.tw=A2.tw;xBKill(b.name);A2.t+=.1;xBJett(b,A2,.1,true,tg,ch2);o.why2=A2.twOut;b.xdash=null;b.ab.tw=null;
   // window runs out with the bot out of the fight: the charge is lost, no dash
   const A3={t:0,jU:.2},ch3=Object.assign(xBCh(b),{c:0,q:0,e:1,tk:0});for(let i=0;i<3;i++){A3.t+=.1;xBJett(b,A3,.1,true,tg,ch3);}for(let i=0;i<90;i++){A3.t+=.1;xBJett(b,A3,.1,false,null,ch3);}o.lost=A3.tw===null&&!b.xdash;
   // Updraft: no E, a Q
   p.set(p0[0],p0[1],p0[2]);const A4={t:0,jU:.2},ch4=Object.assign(xBCh(b),{c:0,q:1,e:0,tk:0});for(let i=0;i<3;i++){A4.t+=.1;xBJett(b,A4,.1,true,tg,ch4);}o.up=!!b.xup;o.q4=ch4.q;
   let top=p.y,m=0;const y0=p.y;while(b.xup&&m<300){xBJettMove(b,1/60);top=Math.max(top,p.y);m++;}o.rise=top-y0;o.air=m/60;o.land=p.y-y0;
   // botK / reset
   b.xdash={dx:0,dz:1,left:1,v:1};o.k2=botK(b);resetBotRoundAbilities();o.reset=!b.xdash&&!b.xup;
  }finally{b.brain=br;b.brainS=bs;b.hp=hp;b.xdash=null;b.xup=null;p.set(p0[0],p0[1],p0[2]);}return o;})()`);
 console.log(JSON.stringify(r));
 assert.ok(r.arm&&r.e===0&&r.q===1,'offline entry bot arms Tailwind (E spent)');
 assert.ok(r.wait,'armed + healthy: dash kept');
 assert.equal(r.why,'hurt');assert.ok(r.dash,'hurt: dash');assert.equal(r.k0,0,'no walking during the dash');
 assert.ok(r.dz>0&&Math.abs(r.dx)>.5,'backwards (+z, away from the enemy at -z) and to a side');
 assert.ok(r.frames>=26&&r.frames<=28||r.moved<10.9,'0.45 s at 60 fps ('+r.frames+')');assert.ok(r.best>10.99&&r.bestF>=26&&r.bestF<=28,'open direction: 11 m in 0.45 s ('+r.best.toFixed(2)+' m, '+r.bestF+' frames)');assert.ok(r.moved<=11.0001&&r.moved>2,'moved up to 11 m ('+r.moved.toFixed(2)+')');assert.ok(r.k1,'walks again after');
 assert.ok(r.wait2,'no dash before the kill');assert.equal(r.why2,'kill','a kill in the window: dash out');
 assert.ok(r.lost,'window over out of a fight: charge lost, no dash');
 assert.ok(r.up&&r.q4===0,'no E: Updraft (Q spent)');assert.ok(r.rise>2,'Updraft rises ('+r.rise.toFixed(2)+' m)');assert.ok(Math.abs(r.land)<.6,'lands back on the floor ('+r.land.toFixed(2)+')');assert.ok(r.air>.3&&r.air<2,'airtime '+r.air.toFixed(2)+' s');
 assert.equal(r.k2,0);assert.ok(r.reset,'round reset clears dash / Updraft');
 console.log('Bot Jett: shared tailwindDash rule (kill / hurt / expiring), server bot keeps the armed dash and dashes out backwards, Updraft with no E; offline bot arms, waits, dashes out 11 m / 0.45 s when hurt / after a kill, loses an unused window, Updrafts and lands');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
