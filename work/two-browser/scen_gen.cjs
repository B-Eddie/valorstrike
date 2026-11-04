// Generic ability scenario with telemetry. env: KEY (KeyC/KeyQ/KeyE/KeyX), ULT=1 grants full ult, FIRE=1 clicks after the key (throwables),
// BX/BZ enemy offset from A, PITCH, TAG. Logs authoritative ability counters + server events + server fx + client fx before/after the cast and
// correlates every screenshot pair with the same sample (server time, hp, fx kinds, client fx kinds).
module.exports=async T=>{const {A,B,qa,code,log,check,SHOT}=T;const fs=require('fs');fs.mkdirSync(SHOT,{recursive:true});
 const KEY=process.env.KEY||'KeyC',TAG=process.env.TAG||'g',W=ms=>new Promise(r=>setTimeout(r,ms));
 await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};if(s.buy>0)s.buy=0.3;if(s.remaining!=null)s.remaining=900;return 1;`);
 for(const P of [A,B])await P.X('FV.mt=performance.now()+1e9;if(typeof paused!=="undefined"&&paused){const b=document.getElementById("xResume");if(b)b.click();}1');
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha');a.ability.c=2;a.ability.q=2;a.ability.e=2;${process.env.ULT?`a.ability.ult=99;`:''}return 1;`);
 await W(2000);
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');b.x=a.x+${+process.env.BX||0};b.z=a.z+${+process.env.BZ||-12};b.y=a.y;if(b.vy!==undefined)b.vy=0;return 1;`);
 await A.X(`yaw=0;pitch=${process.env.PITCH||-0.05};1`);await W(2500);
 const unp=()=>B.X('if(typeof paused!=="undefined"&&paused){const b=document.getElementById("xResume");if(b)b.click();}1').catch(()=>0);
 const snap=()=>qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');return {t:+s.time.toFixed(2),a:{ab:a.ability,hp:a.hp,pos:[a.x,a.y,a.z].map(n=>+n.toFixed(1))},b:{hp:b.hp,pos:[b.x,b.y,b.z].map(n=>+n.toFixed(1)),flash:+(Math.max(0,(b.flashUntil||0)-s.time)).toFixed(2),conc:+(Math.max(0,(b.concussUntil||0)-s.time)).toFixed(2)},fx:s.effects.map(e=>e.kind+':'+(e.p?e.p.map(n=>Math.round(n)).join(','):'')),ev:(s.events||[]).slice(-6).map(e=>JSON.stringify(e).slice(0,100))};`);
 const cl=async P=>P.X(`JSON.stringify({a18:(J.a18fx||[]).map(f=>f.kind),net:(NET.fx||[]).map(f=>f.kind),eq:J.eq,ult:J.ult})`).catch(e=>String(e));
 const before=await snap();log('before',JSON.stringify(before));
 await A.page.bringToFront();await W(500);await unp();
 await A.page.keyboard.down(KEY);await W(120);await A.page.keyboard.up(KEY);await W(1600);
 log('after key (equipped?)',JSON.stringify({a:await cl(A),s:(await snap()).a.ab}));
 if(process.env.FIRE!=='0'){await A.page.mouse.down();await W(120);await A.page.mouse.up();}
 const t0=Date.now();let last=null;
 for(const [ms,n] of [[300,'a'],[900,'b'],[1800,'c'],[3000,'d'],[5000,'e'],[8000,'f']]){const w=ms-(Date.now()-t0);if(w>0)await W(w);const s=await snap();last=s;log('state '+n,JSON.stringify({t:s.t,ab:s.a.ab,b:s.b,fx:s.fx,ev:s.ev,A:await cl(A),B:await cl(B)}));await unp();await A.page.screenshot({path:SHOT+TAG+'_A_'+n+'.png'});await B.page.screenshot({path:SHOT+TAG+'_B_'+n+'.png'});}
 const ab0=before.a.ab,ab1=last.a.ab;const spent=['c','q','e'].some(k=>ab1[k]<ab0[k])||(ab1.ult<ab0.ult)||Object.keys(ab1.cool||{}).length>0;
 check('server: cast spent a charge/ult/cooldown (key '+KEY+')',spent,{before:ab0,after:ab1});
};
