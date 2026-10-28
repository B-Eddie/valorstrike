// Offline Spike Rush = VALORANT = server (vs-lane-parity 2026-10-28). wiki.playvalorant.com/en-us/Spike_Rush:
//  Weapons: round 1 any sidearm with no shields, round 2 a primary costing 2050 or less with Light (25), round 3 and Endgame a primary
//  costing 2250 or more with Heavy (50) (Bandit is not in this game). "The number of ultimate points gained from both kills and deaths
//  is increased from 1 to 2 each"; "In the Endgame round, all players automatically start with some of their ult points, so that they
//  are 3 short". No starting ult otherwise. = server/src/modes.js SR_LOADOUT / VARIANT_RULES.sr.
// Was (page): any primary every round (incl. round 1), Heavy every round, ults starting at half, kills / deaths +1.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),h=fs.readFileSync(path.join(root,'index.html'),'utf8');
(async()=>{const M=await import(path.join(root,'server/src/modes.js'));
 const i=h.indexOf('const SR_LOAD =');assert(i>=0,'page SR_LOAD table');const line=h.slice(i,h.indexOf('\n',i));
 const c=vm.createContext({WEAP:new Proxy({},{get:()=>({})})});vm.runInContext(line.replace('const SR_LOAD','globalThis.SR_LOAD'),c);
 assert.equal(JSON.stringify(c.SR_LOAD),JSON.stringify(M.SR_LOADOUT),'page SR_LOAD = server SR_LOADOUT');
 const {boot}=require('./page_harness.cjs');const H=boot({real3:true,seed:9}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 const live=async()=>{for(let k=0;k<200&&!xe('running');k++)await adv(200);assert(xe('running'),'round live');};
 const end=w=>{xe(`FV.buy=0;FV.det=0;FV.sp.st="";fCheck(${w},"Test");true`);};
 xe('J.pick="Jett";FV.pick="ascent";window.xSwift=0;FV.repOn=0;xLob0=false;startSR();true');await adv(400);await live();
 assert.equal(xe('FV.sr'),true);const L=M.SR_LOADOUT;
 const chk=(r,tag)=>{const g=xe('FV.srG');assert(L[r].w.includes(g),tag+': '+g+' not in '+L[r].w);assert.equal(xe('player.armor'),L[r].a,tag+' player shields');
  const bad=xe(`JSON.stringify(srAll().filter(b=>b&&b.alive&&(b.w!==FV.srG||(b.armor||0)!==${L[r].a})).map(b=>[b.name,b.w,b.armor]))`);assert.equal(bad,'[]',tag+' bots: same gun and shields');};
 chk(0,'round 1 (sidearm, no shields)');assert.equal(xe('J.ult'),0,'no starting ult points');assert.equal(xe('Object.values(window.xBotUC).some(v=>v>0)'),false,'bots start at 0 too');
 xe('jKill();true');assert.equal(xe('J.ult'),2,'a kill: +2 ult points');
 end(true);await live();chk(1,'round 2 (cheap primary, Light)');end(false);await live();chk(2,'round 3 (expensive primary, Heavy)');
 // 3-3 -> Endgame: the round-3 set again, everyone 3 short of the ultimate
 xe('FV.you=2;FV.them=3;J.ult=0;Object.keys(window.xBotUC).forEach(k=>window.xBotUC[k]=0);true');end(true);await live();
 assert.equal(xe('FV.you+FV.them'),6);chk(2,'Endgame');assert.equal(xe('J.ult'),xe('K().u')-3,'Endgame: 3 short');
 assert.equal(xe('srAll().every(b=>(window.xBotUC[b.name]||0)===window.xBotUltCost(xAg(b))-3)'),true,'bots 3 short');
 console.log('Spike Rush offline: sidearm/0, <=2050/25, >=2250/50 (Endgame too), kill/death ult x2, Endgame 3 short, no starting ult');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
