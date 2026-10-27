// Ability animation audit (lane abilanim, user: "some agents' abilities don't have animations"). Headless, no browser.
// For every agent x C / Q / E / X it presses the key in a live match on the real page (work/page_harness.cjs offline 5v5,
// or ONLINE=1: the page against the in-process game server, as test_client_online_abilities.cjs), FIRE for an equipped
// ability, then a follow-up click, and records per frame:
//  FP: is the ability first-person layer on (XAF.on), which phase / clip, does the clip time move (u), or is the gun pose
//      left frozen (nothing drives the arms);
//  TP: what a third-person observer is told (every unit's upper-body cast / pose request: xCaBotGo / xEqTpGo calls,
//      M.xCast, the held-ability pose request of the ABILITY ANIM block M.xab when present) for (offline) the player's
//      own unit as an ally bot sees it via the P2P relay, and (online) a remote human casting the same kit.
// Output: JSON matrix to stdout (or OUT=path). Pose deltas on the real rigs are measured by work/test_ability_anim.cjs.
//   node work/abil_anim_audit.cjs            offline
//   ONLINE=1 node work/abil_anim_audit.cjs   online
//   AGENTS=Jett,Reyna node work/abil_anim_audit.cjs
const fs=require('fs'),path=require('path');
const ONLY=process.env.AGENTS?process.env.AGENTS.split(','):null,ONLINE=!!process.env.ONLINE;
const REC=`(()=>{if(window.__aa)return true;window.__aa={on:0,fr:[],tp:[]};
 const v0=vmTick;vmTick=function(dt){const r=v0.apply(this,arguments);try{const A=window.__aa;if(A.on){const L=typeof XAF!=="undefined"&&XAF.last;const xb=typeof XABA!=="undefined"?XABA.fp:null;
  A.fr.push({on:!!(typeof XAF!=="undefined"&&XAF.on),m:typeof XAF!=="undefined"?XAF.mode:"",c:L&&XAF.on?L.clip:"",u:L&&XAF.on?+(+L.u).toFixed(3):-1,g:L&&XAF.on&&L.gun||"",ab:xb&&xb.on?xb.k+":"+xb.ph:"",gun:!!(gun&&gun.visible),kn:!!(knife&&knife.visible),eq:J.eq?J.eq.k+":"+J.eq.st:"",xca:!!XCA.on});
  for(const u of [].concat(bots,allies)){const M=u&&u.xm;if(!M)continue;const h=M.xab;if(h&&h.on)A.tp.push({n:u.name,k:"hold:"+h.k+":"+h.ph});}}}catch(e){window.__aa.err=String(e);}return r;};
 const g0=xCaBotGo;xCaBotGo=function(R){try{const A=window.__aa;if(A.on){const u=[].concat(bots,allies).find(x=>x&&x.xm===R);A.tp.push({n:u&&u.name,k:"go"});}}catch(e){}return g0.apply(this,arguments);};
 if(typeof xEqTpGo==="function"){const t0=xEqTpGo;xEqTpGo=function(u,ag,k){try{const A=window.__aa;if(A.on)A.tp.push({n:u&&u.name,k:"relay:"+ag+":"+k+":"+xEqType(k,ag)});}catch(e){}return t0.apply(this,arguments);};}
 return true;})()`;
function summarise(fr){ // FP verdict from the per-frame log
 const on=fr.filter(f=>f.on||f.ab),clips=[...new Set(on.map(f=>f.c||f.ab).filter(Boolean))],us=on.map(f=>f.u).filter(u=>u>=0);
 const moved=us.length>1&&Math.max(...us)-Math.min(...us)>0.05,hidden=fr.filter(f=>!f.gun&&!f.kn).length;
 return {frames:fr.length,fpOn:on.length,clips,moved,modes:[...new Set(on.map(f=>f.m))],abil:[...new Set(fr.map(f=>f.ab).filter(Boolean))],gunHidden:hidden,eq:[...new Set(fr.map(f=>f.eq).filter(Boolean))],xca:fr.some(f=>f.xca)};
}
async function offline(){
 const {boot}=require('./page_harness.cjs');const H=boot({real3:true,seed:3}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);};const click=async(b=0,ms=60)=>{H.mouse(b,true);await adv(ms);H.mouse(b,false);};
 const through=async agent=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}await adv(100);}return false;};
 xe(REC);const AG=xe('Object.keys(KITS)').filter(a=>!ONLY||ONLY.includes(a)),out={};
 for(const agent of AG){H.$('pm5v5').click();await adv(50);if(!(await through(agent))){out[agent]={err:'no match'};continue;}xe('FV.buy=0.05;true');await adv(300);out[agent]={};
  for(const code of ['KeyC','KeyQ','KeyE','KeyX']){const k=code[3].toLowerCase();
   xe(`(()=>{const M=K().mx;J.c=Math.max(J.c|0,M.c||1);J.q=Math.max(J.q|0,M.q||1);J.e=Math.max(J.e|0,M.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};player.hp=Math.max(player.hp,100);})()`);await adv(150);
   xe('window.__aa.on=1;window.__aa.fr=[];window.__aa.tp=[];true');
   // the relay path: what a third-person observer of this player gets (P2P host / trusted server replay both end in mpFx)
   const relay=xe(`(()=>{const u=allies.find(a=>a&&a.alive&&a.xm);if(!u)return null;const n0=window.__aa.tp.length;try{xEqTpGo(u,J.pick,${JSON.stringify(k)});}catch(e){return String(e);}return window.__aa.tp.slice(n0).map(x=>x.k);})()`);
   await tap(code,80);await adv(300);let equip=false;if(xe('!!(J.eq&&J.eq.st!=="rec")')){equip=true;await adv(400);await click(0);}await adv(900);
   const fr1=xe('window.__aa.fr.slice()');await click(0);await adv(500);await click(2);await adv(500);
   const fr=xe('window.__aa.fr.slice()'),tp=xe('window.__aa.tp.slice()');xe('window.__aa.on=0;true');
   out[agent][k]={equip,press:summarise(fr1),all:summarise(fr),relay,tp:[...new Set(tp.map(x=>x.k))]};
   await tap('Digit1',40);await adv(300);}
  xe('if(running){FV.sp.st="carry";fCheck(true,"QA")}true');await adv(7600);H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);H.$('xHome').click();await adv(1500);}
 out.__err=xe('window.__aa.err||null');out.__pageErrors=H.errors.slice(0,5).map(String);return out;
}
(async()=>{const out=ONLINE?await require('./abil_anim_audit_online.cjs').online(REC,summarise,ONLY):await offline();
 const s=JSON.stringify(out,null,1);if(process.env.OUT)fs.writeFileSync(process.env.OUT,s);else console.log(s);process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
