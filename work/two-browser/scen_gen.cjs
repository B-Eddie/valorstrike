// Generic ability scenario with telemetry. env: KEY (KeyC/KeyQ/KeyE/KeyX), ULT=1 grants full ult, FIRE=1 clicks after the key (throwables),
// BX/BZ enemy offset from A, PITCH, TAG. Logs authoritative ability counters + server events + server fx + client fx before/after the cast and
// correlates every screenshot pair with the same sample (server time, hp, fx kinds, client fx kinds).
module.exports=async T=>{const {A,B,qa,code,log,check,SHOT}=T;const fs=require('fs');fs.mkdirSync(SHOT,{recursive:true});
 const KEY=process.env.KEY||'KeyC',TAG=process.env.TAG||'g',W=ms=>new Promise(r=>setTimeout(r,ms));
 await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};if(s.buy>0)s.buy=0.3;if(s.remaining!=null)s.remaining=900;return 1;`);
 for(const P of [A,B])await P.X('FV.mt=performance.now()+1e9;if(typeof paused!=="undefined"&&paused){const b=document.getElementById("xResume");if(b)b.click();}1');
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha');a.ability.c=2;a.ability.q=2;a.ability.e=2;${process.env.ULT?`a.ability.ult=99;`:''}return 1;`);
 await W(2000);
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');b.x=a.x+${+process.env.BX||0};b.z=a.z+${+process.env.BZ||-12};b.y=a.y;if(b.vy!==undefined)b.vy=0;${process.env.GOD?'b.invulnerableUntil=1e9;':''}return 1;`);
 await A.X(`yaw=0;pitch=${process.env.PITCH||-0.05};1`);await B.X(`yaw=${process.env.BYAW||'Math.PI'};pitch=0;1`);await W(2500);
 const frz=async v=>{await qa('C.freeze='+v+';return 1');await Promise.all([A,B].map(P=>P.X('window.__ts='+(v?0:1)+';window.__wsMute='+(v?'true':'false')+';1').catch(()=>0)));};
 const unp=()=>B.X('if(typeof paused!=="undefined"&&paused){const b=document.getElementById("xResume");if(b)b.click();}1').catch(()=>0);
 const snap=()=>qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');return {t:+s.time.toFixed(2),a:{ab:a.ability,hp:a.hp,pos:[a.x,a.y,a.z].map(n=>+n.toFixed(1))},b:{hp:b.hp,pos:[b.x,b.y,b.z].map(n=>+n.toFixed(1)),flash:+(Math.max(0,(b.flashUntil||0)-s.time)).toFixed(2),conc:+(Math.max(0,(b.concussUntil||0)-s.time)).toFixed(2)},sc:s.scores,ph:s.phase,rem:+(s.remaining||0).toFixed(0),bal:b.alive,aal:a.alive,fx:s.effects.map(e=>e.kind+':'+(e.p?e.p.map(n=>Math.round(n)).join(','):'')),ev:(s.events||[]).slice(-6).map(e=>JSON.stringify(e).slice(0,100))};`);
 const cl=async P=>P.X(`JSON.stringify({a18:(J.a18fx||[]).map(f=>f.kind+':'+(+f.age||0).toFixed(2)),net:(NET.fx||[]).map(f=>f.kind),a18net:(typeof a18Net!=='undefined'?[...a18Net.values()].map(r=>r.kind):'none'),phx:(typeof phxLive!=='undefined'?phxLive.map(f=>{const w=f.objs&&f.objs[0]&&f.objs[0].children&&f.objs[0].children[0];const u=w&&w.material&&w.material.uniforms;return [+f.age.toFixed(2),+f.ttl.toFixed(1),w?+w.scale.y.toFixed(2):null,u&&u.uG?+u.uG.value.toFixed(2):null,u&&u.uA?+u.uA.value.toFixed(2):null,w?w.position.y:null,w?!!w.visible:null]}):'none'),yox:(typeof yoxLive!=='undefined'?yoxLive.map(f=>(+f.age).toFixed(2)+'/'+f.ttl):'none'),netH:(typeof a18Net!=='undefined'?[...a18Net.values()].map(r=>r.kind+':'+(r.h?1:0)+':'+(r.m&&r.m.visible?1:0)):'none'),walls:J.walls.map(w=>[+w.t.toFixed(1),!!w.phx,w.m&&w.m.visible,+(w.h||0).toFixed(1)]),eq:J.eq,ult:J.ult})`).catch(e=>String(e));
 await frz(false);const before=await snap();const ab00=before.a.ab;log('before',JSON.stringify(before));
 await A.page.bringToFront();await W(500);await unp();
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha');const ab0=JSON.parse(JSON.stringify(a.ability));C.armed=null;C.arm=()=>{const x=a.ability;if(['c','q','e'].some(k=>x[k]<ab0[k])||x.ult<ab0.ult||Object.keys(x.cool||{}).length>0){C.freeze=true;C.armed=s.time;C.arm=null;}};return 1;`);
 await A.page.keyboard.down(KEY);await W(120);await A.page.keyboard.up(KEY);await W(400);
 // software GL: client frames take seconds, so the equip/draw timer lags the wall clock. Hold the server still, let the client clock run, and click only once the client says the ability is ready (or it already threw).
 await qa('C.freeze=true;return 1');await Promise.all([A,B].map(P=>P.X('window.__wsMute=true;1')));let eqs='?';for(let i=0;i<180;i++){eqs=await A.X('J.eq?J.eq.st:"none"').catch(()=>'err');if(eqs!=='draw')break;await W(500);}
 log('equip wait done',eqs);await Promise.all([A,B].map(P=>P.X('window.__wsMute=false;1')));await qa('C.freeze=false;return 1');
 log('after key (equipped?)',JSON.stringify({a:await cl(A),s:(await snap()).a.ab}));
 if(process.env.FIRE!=='0'){await A.page.mouse.down();await W(120);await A.page.mouse.up();}
 // the throw/cast message leaves on a later client frame (seconds in software GL); keep the room running and unmuted until the server has actually spent the charge, so the cast is not dropped by the freeze
 {const spentNow=async()=>{const a=(await snap()).a.ab;return ['c','q','e'].some(k=>a[k]<ab00[k])||a.ult<ab00.ult||Object.keys(a.cool||{}).length>0;};let ok=false;for(let i=0;i<300&&!(ok=await spentNow());i++)await W(200);log('server spent after fire',ok);if(ok){await frz(true);log('armed freeze at cast, server t',JSON.stringify(await qa('return C.armed')));}}
 if(process.env.BONFX){const r=await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');const e=s.effects.find(e=>e.p&&Math.hypot(e.p[0]-a.x,e.p[2]-a.z)>2);if(!e)return 'noeffect';b.x=e.p[0]+${+process.env.BOX||0};b.z=e.p[2]+${+process.env.BOZ||0};if(e.p[1]!==undefined&&!(b.vy>0))b.y=Math.max(b.y,0)+0;return e.kind+':'+e.p.map(n=>n.toFixed(1)).join(',');`);log('BONFX moved Bravo to effect',JSON.stringify(r));}
 const fr=P=>P.X('renderer.info.render.frame').catch(()=>0);
 const waitFrames=async(P,n)=>{const f0=await fr(P);for(let i=0;i<120;i++){if((await fr(P))>=f0+n)return;await W(250);}};
 let last=null,prev=0;
 // server time advances only inside the unfrozen windows; screenshots (slow in software GL) are taken with the room frozen
 if(process.env.AYAW2)await A.X('yaw='+process.env.AYAW2+';1');
 for(const [at,n] of (process.env.TIMES||'0.4,1.2,2.5,4,7,12').split(',').map((t,i)=>[+t,'abcdefgh'[i]])){await frz(false);await W((at-prev)*1000);prev=at;await frz(true);await waitFrames(A,3);await waitFrames(B,3);const s=await snap();last=s;log('state '+n+' @+'+at+'s',JSON.stringify({t:s.t,clientNow:[await A.X('Math.round(performance.now())'),await B.X('Math.round(performance.now())')],frames:[await fr(A),await fr(B)],ab:s.a.ab,b:s.b,fx:s.fx,ev:s.ev,A:await cl(A),B:await cl(B)}));await unp();await A.page.screenshot({path:SHOT+TAG+'_A_'+n+'.png'});await B.page.screenshot({path:SHOT+TAG+'_B_'+n+'.png'});}
 await frz(false);
 const ab0=before.a.ab,ab1=last.a.ab;const spent=['c','q','e'].some(k=>ab1[k]<ab0[k])||(ab1.ult<ab0.ult)||Object.keys(ab1.cool||{}).length>0;
 check('server: cast spent a charge/ult/cooldown (key '+KEY+')',spent,{before:ab0,after:ab1});
};
