// Scenario: A=Tejo (team 0), B=Jett (team 1) in one real match. Place B 14 m in front of A, A throws Special Delivery (Q) at B,
// check server damage/status, B's own client state, and capture BOTH rendered pages. REDUCED scope: no agent models, so players are stand-ins.
module.exports=async T=>{const {A,B,qa,code,log,check,SHOT}=T;const fs=require('fs');fs.mkdirSync(SHOT,{recursive:true});
 await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};if(s.buy>0)s.buy=0.3;if(s.remaining!=null)s.remaining=900;return 1;`);
 for(const P of [A,B])await P.X('FV.mt=performance.now()+1e9;if(typeof paused!=="undefined"&&paused){const b=document.getElementById("xResume");if(b)b.click();}1');log('paused after resume',JSON.stringify([await A.X('paused'),await B.X('paused')]));
 await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha');const A=a.ability;A.q=2;A.e=2;A.c=2;A.x=0;return Object.keys(A);`).then(k=>log('ability keys',JSON.stringify(k)));
 await new Promise(r=>setTimeout(r,2500));
 const st=await qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');b.x=a.x;b.z=a.z-14;b.y=a.y;if(b.vy!==undefined)b.vy=0;return {a:[a.x,a.y,a.z],b:[b.x,b.y,b.z],buy:s.buy,agA:a.agent,q:a.ability&&a.ability.q,ch:a.charges||a.ab};`);
 log('placed',JSON.stringify(st));
 await A.X('yaw=0;pitch=0;1');await new Promise(r=>setTimeout(r,3000));
 const pos=async()=>qa(`const s=sim('${code}');const a=s.units.find(u=>u.name==='Alpha'),b=s.units.find(u=>u.name==='Bravo');return {a:[+a.x.toFixed(1),+a.z.toFixed(1)],b:[+b.x.toFixed(1),+b.z.toFixed(1)],bhp:b.hp,ahp:a.hp,fx:s.effects.map(e=>e.kind)};`);
 log('before',JSON.stringify(await pos()));
 await A.page.screenshot({path:SHOT+'tb_A_before.png'});await B.page.screenshot({path:SHOT+'tb_B_before.png'});
 await qa(`const s=sim('${code}');s.__rec={ids:[],fx:[],minb:100};const b=s.units.find(u=>u.name==='Bravo');clearInterval(s.__iv);s.__iv=setInterval(()=>{for(const e of s.effects)if(!s.__rec.ids.includes(e.id)){s.__rec.ids.push(e.id);s.__rec.fx.push([e.kind,e.p.map(n=>+n.toFixed(1)),+s.time.toFixed(2)]);}s.__rec.minb=Math.min(s.__rec.minb,b.hp);},15);return 1;`);
 await A.page.bringToFront();await new Promise(r=>setTimeout(r,500));log('A before Q',await A.X('JSON.stringify({run:running,paused:typeof paused!=="undefined"?paused:null,focus:document.hasFocus(),ab:J.a18&&1,q:J.q})'));await A.page.keyboard.down('KeyQ');await new Promise(r=>setTimeout(r,200));await A.page.keyboard.up('KeyQ');
 await new Promise(r=>setTimeout(r,5000));
 const rec=await qa(`const s=sim('${code}');clearInterval(s.__iv);return s.__rec;`);const after=await pos();after.seenFx=rec.fx;after.bhp=rec.minb;log('after Q',JSON.stringify(after));
 check('server applied damage or a Tejo effect to B',after.bhp<100||after.fx.length>0,after);
 const bseen=await B.X(`JSON.stringify({hp:typeof player!=='undefined'?player.hp:null,fx:(NET.fx||[]).length})`).catch(e=>String(e));log('B client',bseen);
 await A.page.screenshot({path:SHOT+'tb_A_after.png'});await B.page.screenshot({path:SHOT+'tb_B_after.png'});
 await B.page.bringToFront();await new Promise(r=>setTimeout(r,2500));
 log('B HUD after hit',await B.X(`JSON.stringify({hudHp:document.querySelector('#hp span').textContent,xHp:document.getElementById('xHp').textContent,shown:getComputedStyle(document.getElementById('xHp')).visibility,playerHp:player.hp,hpShown:getComputedStyle(document.getElementById('hp')).display,frame:renderer.info.render.frame})`));
 await B.page.screenshot({path:SHOT+'tb_B_posthit.png'});
 log('B cover',await B.X(`JSON.stringify({lob0:xLob0,res:xResUp(),setfull:xSetFull(),els:xCovEl.filter(e=>e.style.display==='flex').map(e=>e.id||e.className)})`));
 log('A cover',await A.X(`JSON.stringify({lob0:xLob0,res:xResUp(),setfull:xSetFull(),els:xCovEl.filter(e=>e.style.display==='flex').map(e=>e.id||e.className)})`));
 {const f=()=>B.X(`JSON.stringify([renderer.info.render.frame,document.getElementById('xHp').textContent,player.hp,Math.round(performance.now())])`);log('B loop a',await f());await new Promise(r=>setTimeout(r,3000));log('B loop b',await f());}
 log('B xHud direct',await B.X(`xHud();JSON.stringify({xHp:document.getElementById('xHp').textContent,hp:player.hp,mode:mode,running:running,paused:paused,docHidden:document.hidden,vis:document.visibilityState})`));
 log('shots',SHOT);
};
