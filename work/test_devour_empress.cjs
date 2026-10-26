// Reyna Devour (wiki.playvalorant.com/en-us/Devour, Stats + v12.02): 50 HP over 3 s; over 2.5 s while Empress is active
// (Empress: Devour auto-casts on a kill, keeps the Soul Orb, permanent heal). Server reyna.js DEVOUR = page XDEV.
// Offline page checked doing it: Empress kill -> auto Devour 20 HP/s for 2.5 s with the orb left; Q Devour outside Empress
// 50/3 HP/s for 3 s; Q Devour inside Empress 2.5 s. Plus the offline shell-by-shell reload (Bucky / Marshal, XRLP): the next
// shell after the first is timed by xRT() so the Empress stim (/1.1, v11.08) applies to every shell, as the server's reloadTime().
const assert=require('assert/strict'),path=require('path');const {boot}=require('./page_harness.cjs');
(async()=>{
 const R=await import(path.join(__dirname,'..','server','src','reyna.js'));assert.deepEqual({...R.DEVOUR},{heal:50,dur:3,empress:2.5});
 const SIM=await import(path.join(__dirname,'..','server','src','simulation.js'));
 const H=boot({real3:true,seed:5}),xe=H.xe,J=c=>JSON.parse(xe('JSON.stringify('+c+')'));
 assert.deepEqual(J('XDEV'),{heal:R.DEVOUR.heal,t:R.DEVOUR.dur,te:R.DEVOUR.empress},'page XDEV = server DEVOUR');
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 H.$('pm5v5').click();await adv(50);
 for(let t=0;t<30000&&!(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'));t+=100){
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}await adv(100);}
 assert.ok(xe('running'),'5v5 did not start');
 // Empress kill: auto Devour, orb kept, 2.5 s at 20 HP/s, cap 100
 const a=J(`(()=>{FV.buy=0;J.pick="Reyna";J.on=1;J.emp=1;J.so=[];J.hl=null;player.hp=40;const b=bots[0];rySoul(b);const h0={t:J.hl&&J.hl.t,r:J.hl&&J.hl.r,cap:J.hl&&J.hl.cap,orbs:J.so.length};
  const hp=[];for(let i=0;i<30;i++){sgTick(.1);hp.push(Math.round(player.hp*100)/100);}return {h0,hp,after:J.hl};})()`);
 assert.deepEqual(a.h0,{t:2.5,r:20,cap:100,orbs:1},'Empress kill: auto Devour 2.5 s at 20 HP/s, orb kept: '+JSON.stringify(a.h0));
 assert.ok(Math.abs(a.hp[9]-60)<1e-6,'1 s in Empress: +20 -> '+a.hp[9]);assert.ok(Math.abs(a.hp[23]-88)<1e-6,'2.4 s: +48 -> '+a.hp[23]);
 assert.ok(Math.abs(a.hp[29]-90)<1e-6,'Empress Devour: +50 total by 2.5 s -> '+a.hp[29]);assert.equal(a.after,null);
 // no auto Devour outside Empress
 assert.equal(J(`(()=>{J.emp=0;J.so=[];J.hl=null;rySoul(bots[0]);return J.hl;})()`),null,'no auto Devour without Empress');
 // Q Devour outside Empress: 3 s, 150 cap (overheal 10 s); inside Empress: 2.5 s, cap 100
 const q=J(`(()=>{J.emp=0;J.q=1;J.so=[];player.hp=100;const b=bots[0];b.g.position.set(player.x+2,b.g.position.y,player.z);rySoul(b);ryKey("KeyQ");const n={t:J.hl.t,r:J.hl.r,cap:J.hl.cap,q:J.q,oh:J.ohT};
  for(let i=0;i<25;i++)sgTick(.1);const at25=player.hp;for(let i=0;i<5;i++)sgTick(.1);const at30=player.hp;
  J.emp=1;J.so=[];J.hl=null;player.hp=30;rySoul(b);J.hl=null;ryKey("KeyQ");const e={t:J.hl.t,r:J.hl.r,cap:J.hl.cap};return {n,at25,at30,e};})()`);
 assert.deepEqual([q.n.t,q.n.cap,q.n.q,q.n.oh],[3,150,0,10],'Q Devour: 3 s, overheal to 150, charge spent, overheal 10 s');assert.ok(Math.abs(q.n.r-50/3)<1e-9);
 assert.ok(q.at25<150&&Math.abs(q.at25-(100+2.5*50/3))<1e-6,'outside Empress not done at 2.5 s: '+q.at25);assert.ok(Math.abs(q.at30-150)<1e-6,'outside Empress +50 at 3 s: '+q.at30);
 assert.deepEqual(q.e,{t:2.5,r:20,cap:100},'Q Devour in Empress: 2.5 s');
 // offline shell-by-shell reload: every shell after the first follows the Empress stim
 // the harness strips the VALORANT FEEL block; load its real Empress stim (xStimK) and xRT / xEq wrappers into the page
 {const F=require('fs').readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8').split('\n');const k=F.find(l=>l.startsWith('function xStimK(){')),w=F.find(l=>l.startsWith('{const rt0=xRT;xRT=function(){'));assert.ok(k&&w,'feel_runtime xStimK / xRT wrapper moved');xe(k+'\n'+w+'\ntrue');}
 const shell=async emp=>{xe(`(()=>{J.emp=${emp};J.hl=null;FV.buy=0;FV.pri="Bucky";rw="pri";ammo=1;rsv=10;reloading=.001;player.hp=100;})()`);
  for(let i=0;i<40&&xe('ammo')<2;i++){H.advance(5);await new Promise(r=>setImmediate(r));}
  return J('{ammo,reloading,w:wName()}');};
 const s0=await shell(0),s1=await shell(1);
 assert.equal(s0.w,'Bucky');assert.equal(s0.ammo,2);assert.equal(s1.ammo,2);
 assert.ok(s0.reloading>.47&&s0.reloading<=.5+1e-9,'next shell without Empress ~0.5 s: '+s0.reloading);
 assert.ok(s1.reloading>.42&&s1.reloading<=.5/1.1+1e-9,'next shell in Empress 0.5/1.1 s: '+s1.reloading);
 // the server's per-shell reload is reloadTime(u) on both the first and the next shell (RELOAD_ROUND / stimK)
 assert.ok(Math.abs(SIM.reloadTime({weapon:'Bucky',empress:true,ammo:1})-.5/1.1)<1e-9,'server Bucky shell /1.1');
 console.log('Devour Empress: server DEVOUR = page XDEV (50 HP, 3 s, 2.5 s in Empress); offline Empress kill auto-Devours 20 HP/s for 2.5 s and keeps the orb; Q Devour 3 s / 150 cap outside Empress, 2.5 s inside; offline Bucky next-shell reload 0.5 s, 0.5/1.1 s in Empress (= server reloadTime)');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
