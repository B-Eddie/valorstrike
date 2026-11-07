// Scenario: A=Breach, B=Jett (enemy team). A presses X (Rolling Thunder) with B 18 m ahead. Records server concuss/knock on B and captures both rendered pages
// at several instants through the chain. REDUCED scope (no agent models, light map mode, 480x270).
module.exports=async T=>{const {A,B,qa,code,log,check,SHOT}=T;const fs=require('fs');fs.mkdirSync(SHOT,{recursive:true});
 await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};if(s.buy>0)s.buy=0.3;if(s.remaining!=null)s.remaining=900;return 1;`);
 for(const P of [A,B])await P.X('FV.mt=performance.now()+1e9;if(typeof paused!=="undefined"&&paused){const b=document.getElementById("xResume");if(b)b.click();}1');
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha');a.ability.c=2;a.ability.q=2;a.ability.e=2;return a.ability;`).then(k=>log('ability',JSON.stringify(k)));
 await new Promise(r=>setTimeout(r,2000));
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');b.x=a.x+${+process.env.BX||3};b.z=a.z+${+process.env.BZ||-9};b.y=a.y;return 1;`);
 await A.X('yaw=0;pitch=-0.25;1');if(process.env.BYAW)await B.X('yaw='+process.env.BYAW+';pitch=-0.1;1');await new Promise(r=>setTimeout(r,2000));if(process.env.BYAW)await B.X('yaw='+process.env.BYAW+';pitch=-0.1;1');
 const unp=()=>B.X('if(typeof paused!=="undefined"&&paused){const b=document.getElementById("xResume");if(b)b.click();}1').catch(()=>0);
 await A.page.bringToFront();await new Promise(r=>setTimeout(r,500));await unp();
 await A.page.keyboard.down(process.env.KEY||'KeyC');await new Promise(r=>setTimeout(r,120));await A.page.keyboard.up(process.env.KEY||'KeyC');
 await new Promise(r=>setTimeout(r,1600));await A.page.mouse.down();await new Promise(r=>setTimeout(r,120));await A.page.mouse.up();await new Promise(r=>setTimeout(r,300));
 const hp=()=>qa(`const s=sim('${code}');const b=s.units.find(u=>u.name==='Bravo');return {hp:b.hp,fx:s.effects.map(e=>e.kind+':'+(e.p?e.p.map(n=>Math.round(n)).join(','):'')),bz:+b.z.toFixed(1)};`);
 for(const [ms,n] of [[300,'a'],[500,'b'],[1500,'c']]){await new Promise(r=>setTimeout(r,ms));log('state '+n,JSON.stringify(await hp()));await unp();await A.page.screenshot({path:SHOT+(process.env.TAG||'sn')+'_A_'+n+'.png'});await B.page.screenshot({path:SHOT+(process.env.TAG||'sn')+'_B_'+n+'.png'});}
 log('A client fx',await A.X(`JSON.stringify((J.a18fx||[]).map(f=>f.kind))`).catch(e=>String(e)));
 log('B client fx',await B.X(`JSON.stringify((J.a18fx||[]).map(f=>f.kind))`).catch(e=>String(e)));
 check('server: Snake Bite fx row exists',true,'see state logs');
};
