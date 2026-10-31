// Offline twin of server/test-bot-feel3.js (lane-botfeel3; measured with work/probe_bot_feel3_offline.cjs): the page's bots
// share the fixes through the inlined vendor/bot-brain.cjs.
//  2. team economy: the page's BotBrain.teamBuy (XBV.call per team and round) never calls eco / save for a team on a win with
//     BUYK.bonus+ average credits (the pistol-round winners' bonus round buys)
//  3. plant spots: xbvPlantPt (the bot carrier's spot) lies BotBrain.PLANT.in m+ inside the plant zone (BotBrain.plantDeep, =
//     server plantGoal), so a carrier never stops just outside the zone (132dc0e: 66 / 96 Ascent picks within 1.1 m of the edge)
//   node work/test_bot_feel3_offline.cjs
const path=require('path'),assert=require('assert/strict');const {boot}=require(path.join(__dirname,'page_harness.cjs'));
(async()=>{const H=boot({real3:true,seed:3,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe(`J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;window.xBotSeed=3;xLob0=false;startFive();true`);
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 assert(xe('!!nmActive()'),'native Ascent loaded');
 // 2. economy
 const eco=JSON.parse(xe(`JSON.stringify((()=>{if(!BotBrain.BUYK)return null;const o={};for(let i=0;i<300;i++){const c=BotBrain.teamBuy([3700,3300,3700,3800,3700],0,2,BotRoutes.rng(i+1),12);o[c]=(o[c]||0)+1;}return o;})())`));
 assert(eco,'page BotBrain.BUYK (the shared bonus-round rule)');assert(!eco.eco&&!eco.save,'page: round 2 pistol winners never eco / save ('+JSON.stringify(eco)+')');
 // 3. plant spots
 const r=JSON.parse(xe(`JSON.stringify((()=>{const C=nmActive(),R=[[1,0],[.7071,.7071],[0,1],[-.7071,.7071],[-1,0],[-.7071,-.7071],[0,-1],[.7071,-.7071]],o={n:0,deep:0,ex:[]},y0=FV.you,t0=FV.them;
  for(let a=0;a<12;a++)for(let b=0;b<12;b+=3)for(const site of ['A','B']){FV.you=a;FV.them=b;const s={site,st:'carry'},q=xbvPlantPt(C,bots[0],s);if(!q)continue;o.n++;let k=0;for(const p of R)if(inSite({x:q[0]+p[0]*1.1,z:q[2]+p[1]*1.1})===site)k++;if(k===8)o.deep++;else if(o.ex.length<4)o.ex.push(site+' '+q.map(v=>+v.toFixed(2))+' ring '+k+'/8');}
  FV.you=y0;FV.them=t0;return o;})())`));
 assert.equal(r.n,96,'a plant spot for every round / site');
 assert.equal(r.deep,r.n,'every offline plant spot lies 1.1 m+ inside the zone: '+r.deep+'/'+r.n+' ('+r.ex.join(', ')+')');
 console.log('test_bot_feel3_offline: PASS - page teamBuy round-2 winners '+JSON.stringify(eco)+'; plant spots deep '+r.deep+'/'+r.n);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
