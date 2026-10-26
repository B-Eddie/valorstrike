// hk-33: the local cluster (tools/local-cluster.mjs) runs worker.js in a vm with its imports stripped, so fog.js fogView /
// fogCast and skins.js cleanSkins only exist there when handed in. The browser bridge (tools/browser-bridge.mjs) uses
// prod:true so a rendered online page gets fog of war as deployed; before, GameRoom.view's typeof guard sent whole
// frames and the bridge's fog check (work/browser_online_fog.cjs) saw a hidden enemy at its true spot.
// Checks: prod:true -> GameRoom.view at spawn hides every enemy ([22] = 1, no position) and sim.fogOff turns it off;
// default -> whole frames (the acceptance tests' rooms are unchanged).
import assert from 'node:assert/strict';import {localCluster} from './tools/local-cluster.mjs';
async function spawnView(prod,code){
 const C=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'},prod});let room=null,started=false,me=null;
 const p=await C.profile(),s=C.connect({create:1,code,mode:'five',map:'ascent'});
 s.on('message',m=>{if(process.env.DBG)console.log(JSON.stringify(m).slice(0,160));if(m.t==='welcome')me=m.you;else if(m.t==='room')room=m;else if(m.t==='start'){started=true;s.send(JSON.stringify({t:'ready'}));}});
 s.on('error',e=>console.log('connect error',String(e).slice(0,200)));s.on('open',()=>s.send(JSON.stringify({t:'hi',n:'FogLC',ag:'Sova',token:p.token})));
 const until=async(c,ms,w)=>{const end=C.clock.now()+ms;while(!c()){if(C.clock.now()>end)throw Error('timed out: '+w);await C.advance(50);}};
 await until(()=>room,5000,'room');s.send(JSON.stringify({t:'start'}));await until(()=>started,20000,'start');
 const R=C.room(code),sim=R.sim;sim.bot=u=>{u.input={};u.inputAt=sim.time;};sim.phase='game';
 const h=sim.units.find(u=>u.id===me);const enemies=v=>v.u.filter(r=>r[1]!==h.team);
 const v1=R.view(sim.snapshot(),h);sim.fogOff=true;const v2=R.view(sim.snapshot(),h);
 return {fogged:enemies(v1).filter(r=>r[22]===1).length,n:enemies(v1).length,off:enemies(v2).filter(r=>r[22]===1).length,hasCast:typeof R.view==='function'};}
const a=await spawnView(true,'FGLCAA');assert.equal(a.n,5);assert.equal(a.fogged,5,'prod cluster: spawn to spawn every enemy is fogged ('+JSON.stringify(a)+')');assert.equal(a.off,0,'sim.fogOff sends whole frames');
const b=await spawnView(false,'FGLCAB');assert.equal(b.fogged,0,'default cluster: whole frames (acceptance rooms unchanged)');
console.log('local cluster fog: prod view fogs',a.fogged+'/'+a.n,'enemies at spawn, fogOff 0; default cluster whole frames');
process.exit(0);
