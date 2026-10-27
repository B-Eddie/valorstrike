// Defender bots retake and defuse once the attackers are all dead (user 17:42 2026-10-26: "after attackers plant and die,
// defender bots stood still and never defused"). The real page (work/page_harness.cjs native: the real native-map loader on
// Ascent / Bind nav + collision, the shipped FEEL motor and BOT VARIETY block): an attacker plants on a site (the page's own
// plant transition values), then the player and every attacker die. Before the fix the enemy bot loop stopped at the first
// bot with no target in sight or memory (`if (!tg) break;` - no living enemy = no target) so every defender froze where it
// stood for the whole 45 s fuse; now they walk to the Spike and one defuses (no enemy alive: no clearing first).
// Also the mirror: the player defends, the attacker bots plant and all die, and the ally defenders defuse.
//   node work/test_bot_retake_defuse.cjs
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
async function scenario(map,site,playerAtk){
 const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="'+map+'";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true');
 for(let i=0;i<200&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);
 assert(xe('!!nmActive()'),map+': native map loaded');
 if(!playerAtk){xe('FV.atk=false;true');}
 xe('FV.buy=0;true');await adv(3000);assert(xe('running'),map+': round live');
 // plant on the site (the plant transition's own state: st plant, 45 s fuse, Spike at the planter's feet)
 const r=JSON.parse(xe(`(()=>{const C=nmActive(),g=C.siteGoals&&C.siteGoals["${site}"],m=C.meta.sites["${site}"],x=g?g[0]:m[0],z=g?g[1]:m[2],N=C.nav.nodes;let b=0,bd=1e9;for(let i=0;i<N.length;i++){if(C.playable&&!C.playable[i])continue;const d=Math.hypot(N[i][0]-x,N[i][2]-z)+Math.abs(N[i][1]-m[1]);if(d<bd){bd=d;b=i;}}
  const p=N[b],s=FV.sp,atkL=FV.atk?allies:bots;s.st="plant";s.site="${site}";s.pn=atkL[0].name;s.t=45;s.x=p[0];s.y=p[1];s.z=p[2];s.dt=0;s.beep=0;s.c=null;fsM.position.set(p[0],.4,p[2]);fsM.visible=true;fsSet();timeLeft=45;
  return JSON.stringify({x:p[0],z:p[2]});})()`));
 // every attacker dies: the player (attacking) + attacker allies, or the attacker bots
 if(playerAtk){xe('allies.forEach(a=>{if(a.alive)allyDie(a,"Test","Vandal");});pDie("Test","Vandal");true');}
 else xe('bots.forEach(b=>{if(b.alive)kill(b,false,"Test","Vandal");});true');
 assert(xe('running'),map+': the round goes on after the attackers die (the Spike is planted)');
 const defL=playerAtk?'bots':'allies',start=JSON.parse(xe(`JSON.stringify(${defL}.filter(u=>u.alive).map(u=>[u.g.position.x,u.g.position.z]))`));
 let t=0,res=null;for(;t<44&&!res;t+=.5){await adv(500);res=xe('FV.sp.st==="done"?"defused":!running?"over":null');}
 const moved=JSON.parse(xe(`JSON.stringify(${defL}.filter(u=>u.alive).map(u=>[u.g.position.x,u.g.position.z]))`)).map((p,i)=>start[i]?Math.hypot(p[0]-start[i][0],p[1]-start[i][1]):0);
 const fd=xe('(()=>{const f=[...document.querySelectorAll?[]:[]];return 0})()');
 console.log(map,site,playerAtk?'player attacks (enemy bots defend)':'player defends (ally bots defend)','defenders',start.length,'result',res,'after',t.toFixed(1)+' s','moved m',moved.map(v=>v.toFixed(1)).join(' '),'errors',H.errors.length);
 assert.equal(res,'defused',`${map} ${site}: a defender bot defuses the Spike with no attacker alive (got ${res} after ${t.toFixed(1)} s; defenders moved ${moved.map(v=>v.toFixed(1)).join(' ')} m)`);
 assert(t<=38,`${map}: defused in time (${t} s of 45)`);
 assert(Math.max(...moved)>3,map+': defenders walk to the Spike');
 assert(H.errors.length<=1,'no page errors: '+JSON.stringify(H.errors.slice(1,3)));
}
(async()=>{await scenario('ascent','A',true);await scenario('bind','B',false);console.log('bot retake + defuse with no enemies alive ok');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
