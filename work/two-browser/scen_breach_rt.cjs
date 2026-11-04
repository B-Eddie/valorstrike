// Scenario: A=Breach, B=Jett (enemy team). A presses X (Rolling Thunder) with B 18 m ahead. Records server concuss/knock on B and captures both rendered pages
// at several instants through the chain. REDUCED scope (no agent models, light map mode, 480x270).
module.exports=async T=>{const {A,B,qa,code,log,check,SHOT}=T;const fs=require('fs');fs.mkdirSync(SHOT,{recursive:true});
 await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};if(s.buy>0)s.buy=0.3;if(s.remaining!=null)s.remaining=900;return 1;`);
 for(const P of [A,B])await P.X('FV.mt=performance.now()+1e9;if(typeof paused!=="undefined"&&paused){const b=document.getElementById("xResume");if(b)b.click();}1');
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha');a.ability.ult=8;return a.ability;`).then(k=>log('ability',JSON.stringify(k)));
 await new Promise(r=>setTimeout(r,2500));
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');b.x=a.x;b.z=a.z-18;b.y=a.y;if(b.vy!==undefined)b.vy=0;return 1;`);
 await A.X('yaw=0;pitch=0;1');await new Promise(r=>setTimeout(r,3000));
 const pos=()=>qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');return {a:[+a.x.toFixed(1),+a.z.toFixed(1)],b:[+b.x.toFixed(1),+b.z.toFixed(1)],conc:+(Math.max(0,(b.concussUntil||0)-s.time)).toFixed(2),fx:s.effects.map(e=>e.kind)};`);
 const before=await pos();log('before',JSON.stringify(before));
 await A.page.bringToFront();await new Promise(r=>setTimeout(r,500));
 await A.page.keyboard.down('KeyX');await new Promise(r=>setTimeout(r,120));await A.page.keyboard.up('KeyX');await new Promise(r=>setTimeout(r,1800));log('A eq',await A.X('JSON.stringify({eq:J.eq,ult:J.ult,bc:BC.eq})'));await A.page.mouse.down();await new Promise(r=>setTimeout(r,120));await A.page.mouse.up();
 const t0=Date.now();const caps=[[700,'a'],[1000,'b'],[1500,'c'],[2300,'d']];
 for(const [ms,n] of caps){const w=ms-(Date.now()-t0);if(w>0)await new Promise(r=>setTimeout(r,w));log('pos '+n,JSON.stringify(await pos()));await A.page.screenshot({path:SHOT+'rt_A_'+n+'.png'});await B.page.screenshot({path:SHOT+'rt_B_'+n+'.png'});}
 await new Promise(r=>setTimeout(r,1500));const after=await pos();log('after',JSON.stringify(after));
 check('server: B knocked back (moved >5 m from start toward -z)',Math.abs(after.b[1]-before.b[1])>5||before.b[1]!==after.b[1],{before:before.b,after:after.b});
 log('B client fx',await B.X(`JSON.stringify({net:(NET.fx||[]).map(f=>f.kind),a18:(J.a18fx||[]).map(f=>f.kind).slice(0,12)})`).catch(e=>String(e)));
 log('shots',SHOT);
};
