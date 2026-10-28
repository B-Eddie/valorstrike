// Omen From the Shadows offline (index.html okFtsAt / okTick J.fts / ftsCancel) and online page rooting (work/ability_target_runtime.js
// xFtsNetTick), native Ascent. Valorant (wiki.playvalorant.com/en-us/From_the_Shadows): 4 s total = 1.5 s windup + 2.5 s at the target as a
// Shade, rooted (can turn); a bullet on the Shade or X again cancels it, back to the origin; the ult stays spent. Was: Omen walked freely
// for 4 s, then teleported. Same rule as the server (server/test-shadows.js).
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
const pos=()=>xe('({x:player.x,y:player.y,z:player.z,fts:J.fts?{t:J.fts.t,shade:J.fts.shade}:null,ult:J.ult,hp:player.hp})');
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Omen'),'offline 5v5 started');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});true');
 // a valid destination 10+ m away
 const T=xe(`(()=>{const C=nmActive();let best=null;for(let i=0;i<C.nav.nodes.length;i++){const n=C.nav.nodes[i];if(C.playable&&!C.playable[i])continue;const d=Math.hypot(n[0]-player.x,n[2]-player.z);if(d>12&&d<30){const v=okFtsValid(n[0],n[2]);if(v){best=v;break;}}}return best;})()`);
 assert.ok(T,'a destination');
 const cast=()=>{xe('J.ult=K().u;J.ftp=true;true');return xe(`okFtsAt(${T.x},${T.z})`);};
 // 1. windup: rooted at the origin even while walking
 const o=pos();check(cast(),'cast');check(xe('J.ult')===0,'ult spent');H.key('KeyW',true);await adv(1000);let p=pos();check(Math.hypot(p.x-o.x,p.z-o.z)<.05&&p.fts&&!p.fts.shade,'windup: rooted at the origin '+JSON.stringify(p));
 // 2. 1.5 s: a Shade at the target, rooted
 await adv(700);p=pos();check(p.fts&&p.fts.shade&&Math.hypot(p.x-T.x,p.z-T.z)<.05,'1.5 s: a Shade at the target '+JSON.stringify(p));await adv(1000);p=pos();check(Math.hypot(p.x-T.x,p.z-T.z)<.05,'Shade: rooted');
 // 3. real at 4 s, free again
 await adv(1350);p=pos();check(!p.fts&&Math.hypot(p.x-T.x,p.z-T.z)<1,'4 s: real at the target '+JSON.stringify(p)+' '+JSON.stringify(T));await adv(600);const p2=pos();check(Math.hypot(p2.x-p.x,p2.z-p.z)>.5,'walks again');H.key('KeyW',false);await adv(300);
 // 4. a hit on the Shade: back to the origin, no damage
 const o2=pos();cast();await adv(1800);check(pos().fts&&pos().fts.shade,'Shade again');const hp=xe('player.hp');xe('hurt(player,30,bots[0]&&bots[0].name)');p=pos();check(!p.fts&&Math.hypot(p.x-o2.x,p.z-o2.z)<.05&&p.hp===hp,'hit on the Shade: back at the origin, unhurt '+JSON.stringify(p));
 // 5. X as a Shade cancels; X in the windup does nothing
 cast();await adv(500);await tap('KeyX');check(pos().fts,'X in the windup: still going');await adv(1300);check(pos().fts&&pos().fts.shade,'Shade');await tap('KeyX');p=pos();check(!p.fts&&Math.hypot(p.x-o2.x,p.z-o2.z)<.05&&p.ult===0,'X as a Shade: back, ult spent '+JSON.stringify(p));
 // 6. online page: holds still through the server's channel (windup at the origin, Shade where the server snapped him)
 xe('NET.socket=NET.socket||{readyState:1,send(){}};window.__fakeNet=true;netChannel={kind:"shadows",remaining:3,shade:false};XABA.sent={t:"ab",k:"x",p:['+T.x+','+T.z+']};true');
 const o3=pos();H.key('KeyD',true);await adv(600);p=pos();check(Math.hypot(p.x-o3.x,p.z-o3.z)<.05,'online windup: holds at the origin '+JSON.stringify(p)+' '+JSON.stringify(o3));
 xe(`player.x=${T.x};player.z=${T.z};player.y=${T.y};netChannel={kind:"shadows",remaining:2,shade:true};true`);await adv(600);p=pos();check(Math.hypot(p.x-T.x,p.z-T.z)<.05,'online Shade: holds at the target');
 xe('netChannel=null;true');await adv(600);p=pos();check(Math.hypot(p.x-T.x,p.z-T.z)>.3,'online channel over: free');H.key('KeyD',false);
 xe('if(window.__fakeNet)NET.socket=null;true');
 console.log(fails.length?'FAILED '+fails.length:'From the Shadows: rooted 1.5 s windup, rooted 2.5 s Shade, a hit / X sends him back unhurt, real at 4 s; online page holds still through the server channel');
 process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
