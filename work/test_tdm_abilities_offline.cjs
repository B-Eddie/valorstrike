// TDM abilities + ultimates, page side (vs-lane-parity4 2026-10-28) = VALORANT (wiki.playvalorant.com/en-us/Team_Deathmatch
// "Abilities": TDM cooldown per use, signature full / basics 50 % at the start, ult 3 per kill / 10 per orb up to the TDM cost)
// = server (server/src/tdmabil.js, server/test-tdm-abilities.js).
//  A. page tables (xTdmAb cd / ult / kill / orb) == server TDM_CD / TDM_ULT / TDM_PTS.
//  B. offline TDM: Jett starts Tailwind 1, Cloudburst / Updraft 0; Cloudburst after 14.5 s, Updraft after 22 s, no 40 s refill of
//     the player; a kill = 3 points (pips of 8 for 60), no 2-kill Tailwind refill, a death gives nothing; Blade Storm at 60 spends them.
//  D. offline TDM bots: kit charges b.ab.kc on the same table, no 40 s full refill, no 2-kill signature refill.
//  C. online: a TDM round state with tab 1 turns the player's abilities on and its ab block sets the charges / pips; without tab 1
//     they stay off (old servers).
const assert=require('assert/strict'),path=require('path');
const {boot}=require('./page_harness.cjs');
(async()=>{const S=await import(path.join(__dirname,'..','server/src/tdmabil.js'));
 const H=boot({real3:true,seed:3}),xe=H.xe;
 const P=JSON.parse(xe('JSON.stringify(window.xTdmAb||null)'));assert(P,'page TDM ability table (xTdmAb)');
 assert.deepEqual(P.cd,JSON.parse(JSON.stringify(S.TDM_CD)),'cooldowns == server');assert.deepEqual(P.ult,{...S.TDM_ULT},'ult costs == server');assert.deepEqual([P.kill,P.orb],[S.TDM_PTS.kill,S.TDM_PTS.orb],'points == server');
 // B. offline TDM (the harness does not run the match clock: the test steps tdmTick itself)
 xe('J.pick="Jett";startTDM();true');for(let i=0;i<20;i++){H.advance(50);await new Promise(r=>setImmediate(r));}
 assert.equal(xe('!!(FV.tdm&&!FV.esc&&J.on)'),true,'offline TDM with abilities');
 const st=()=>JSON.parse(xe('JSON.stringify([J.c,J.q,J.e,J.ult,J.tp||0])'));
 assert.deepEqual(st(),[0,0,1,0,0],'start: Tailwind 1, basics 0, no ult');
 const tick=s=>xe(`window.xLdOn=false;DM.abT=1e9;for(let t=0;t<${s};t+=0.05)tdmTick(0.05);true`);
 tick(14.3);assert.equal(st()[0],0,'Cloudburst not at 14.3 s');tick(0.4);assert.equal(st()[0],1,'Cloudburst at 14.5 s (50 % start)');
 tick(7.5);assert.equal(st()[1],1,'Updraft at 22 s');
 xe("window.xLdOn=false;DM.abT=0;tdmTick(0.05);true");assert.deepEqual(st().slice(0,3),[1,1,1],'the 40 s refill no longer tops the player up');
 xe('J.e=0;J.tdp.e=0;jKill();jKill();true');assert.equal(st()[2],0,'no 2-kill Tailwind refill');assert.deepEqual(st().slice(3),[0,6],'2 kills = 6 points, 0 of 8 pips');
 xe('jUlt();true');assert.equal(st()[4],6,'a death (pDie -> jUlt) gives nothing');
 xe('for(let i=0;i<18;i++)jKill();true');assert.deepEqual(st().slice(3),[8,60],'20 kills = 60 points = full');
 xe('jKey("KeyX");tdmTick(0.05);true');assert.equal(xe('J.bsOn'),true,'Blade Storm');assert.deepEqual(st().slice(3),[0,0],'points spent');
 // D. offline TDM bots: their kit charges recharge on the same table (no 40 s full refill, no 2-kill signature refill)
 xe('startTDM();window.xLdOn=false;true');
 const bj=()=>JSON.parse(xe('(()=>{const b=srAll()[0];return b&&b.ab&&b.ab.kc?JSON.stringify([b.ab.kc.c,b.ab.kc.q,b.ab.kc.e,b.name]):"null"})()'));
 // give the first bot Jett so the numbers are known
 xe('(()=>{const b=srAll()[0];b.agent="Jett";b.ab=b.ab||{};b.ab.tdp=null;b.ab.kc=null;})();true');assert.equal(xe('xBAg(srAll()[0])'),'Jett');
 xe('tdmTick(0.05);true');
 assert.deepEqual(bj().slice(0,3),[0,0,1],'bot start: Tailwind 1, basics 0 (50 %)');
 xe('DM.abT=1e9;for(let t=0;t<14.6;t+=0.05)tdmTick(0.05);true');assert.equal(bj()[0],1,'bot Cloudburst after 14.5 s');assert.equal(bj()[1],0,'bot Updraft not yet');
 xe('DM.abT=0;tdmTick(0.05);true');assert.deepEqual(bj().slice(0,3),[1,0,1],'the 40 s refill no longer tops the bots up');
 xe('(()=>{const b=srAll()[0];b.ab.kc.e=0;b.ab.tdp.e=0;xBKill(b.name);xBKill(b.name);})();true');assert.equal(bj()[2],0,'no 2-kill Tailwind refill for a bot');
 // C. online round state
 xe('dmEnd&&0;J.on=false;MP.on=true;MP.st="game";NET.socket={readyState:1,send(){}};FV.tdm=true;FV.esc=false;J.pick="Sage";true');
 xe('mpCliRS({tm:1,tl:500,ab:{c:0,q:1,e:1,ult:3,cool:{}},status:{},channel:null,reyna:null,rv:[]});true');assert.equal(xe('J.on'),false,'no tab: abilities stay off online');
 xe('mpCliRS({tab:1,tm:1,tl:500,tp:20,uc:50,ab:{c:0,q:1,e:1,ult:2,cool:{}},status:{},channel:null,reyna:null,rv:[]});true');
 assert.equal(xe('J.on'),true,'tab 1: abilities on');assert.deepEqual(JSON.parse(xe('JSON.stringify([J.c,J.q,J.e,J.ult])')),[0,1,1,2],'charges / pips from the server');
 const v=JSON.parse(xe('JSON.stringify(netClean({t:"rs",tab:1,tm:1,tl:5,tp:20,uc:500,ab:{c:1,q:0,e:1,ult:2}}))'));
 assert(v&&v.tab===1&&v.uc===200&&v.tp===20&&!v.sp,'validator keeps a TDM round state without a Spike row (uc clamped)');
 assert.equal(xe('netClean({t:"rs",tm:1,ab:{}})'),null,'a Spike-mode round state still needs its Spike row');
 console.log('TDM abilities (page): tables == server; offline cooldown recharges (50 % start), no player refill, 3 points a kill (pips), none for a death, no 2-kill refill, ult spends the points; bots recharge on the same table (no 40 s refill, no 2-kill refill); online tab 1 round state turns them on');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
