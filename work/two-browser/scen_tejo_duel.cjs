// Scenario: A=Tejo (team 0), B=Jett (team 1) in one real match. Place B 7 m in front of A, A throws Special Delivery (Q) at B,
// check server damage/status, B's own client state, and capture BOTH rendered pages. REDUCED scope: no agent models, so players are stand-ins.
module.exports=async T=>{const {A,B,qa,code,log,check,SHOT}=T;const fs=require('fs');fs.mkdirSync(SHOT,{recursive:true});
 await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};if(s.buy>0)s.buy=0.3;if(s.remaining!=null)s.remaining=900;return 1;`);
 await B.page.getByText('RESUME',{exact:true}).click({timeout:5000}).catch(()=>{});
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha');const A=a.ability;A.q=2;A.e=2;A.c=2;A.x=0;return Object.keys(A);`).then(k=>log('ability keys',JSON.stringify(k)));
 await new Promise(r=>setTimeout(r,2500));
 const st=await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');b.x=a.x;b.z=a.z-7;b.y=a.y;if(b.vy!==undefined)b.vy=0;return {a:[a.x,a.y,a.z],b:[b.x,b.y,b.z],buy:s.buy,agA:a.agent,q:a.ability&&a.ability.q,ch:a.charges||a.ab};`);
 log('placed',JSON.stringify(st));
 await A.X('yaw=0;pitch=-0.12;1');await new Promise(r=>setTimeout(r,3000));
 const pos=async()=>qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');return {a:[+a.x.toFixed(1),+a.z.toFixed(1)],b:[+b.x.toFixed(1),+b.z.toFixed(1)],bhp:b.hp,ahp:a.hp,fx:s.effects.map(e=>e.kind)};`);
 log('before',JSON.stringify(await pos()));
 await A.page.screenshot({path:SHOT+'tb_A_before.png'});await B.page.screenshot({path:SHOT+'tb_B_before.png'});
 await A.page.keyboard.press('KeyQ');
 let seen=[],minhp=100;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,200));const q=await pos();minhp=Math.min(minhp,q.bhp);q.fx.forEach(k=>{if(!seen.includes(k))seen.push(k);});}
 const after=await pos();after.seenFx=seen;after.minhp=minhp;after.bhp=minhp;log('after Q',JSON.stringify(after));
 check('server applied damage or a Tejo effect to B',after.bhp<100||after.fx.length>0,after);
 const bseen=await B.X(`JSON.stringify({hp:typeof player!=='undefined'?player.hp:null,fx:(NET.fx||[]).length})`).catch(e=>String(e));log('B client',bseen);
 await A.page.screenshot({path:SHOT+'tb_A_after.png'});await B.page.screenshot({path:SHOT+'tb_B_after.png'});
 log('shots',SHOT);
};
