// Full production page and real-clock local WebSocket worker. SOLO/light map is explicitly partial acceptance.
module.exports=async({A,qa,code,log,check,SHOT})=>{
const fs=require('fs');fs.mkdirSync(SHOT,{recursive:true});const state=()=>qa(`const s=sim('${code}'),a=s.units.find(u=>u.name==='Alpha');return {time:s.time,buy:s.buy,ability:a.ability,fx:s.effects.filter(e=>e.owner===a.id).map(e=>({id:e.id,kind:e.kind,landAt:e.landAt,born:e.born,bm:!!e.bm}))};`);
await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};s.units.find(u=>u.name==='Alpha').ability.c=1;s.buy=.05;s.remaining=900;return 1;`);await A.X('FV.mt=performance.now()+1e9;yaw=0;pitch=-.3;if(paused){document.getElementById("xResume")?.click();}1');
await A.page.waitForTimeout(350);log('before',await state());await A.page.bringToFront();await A.page.keyboard.press('KeyC');await new Promise(r=>setTimeout(r,300));log('equipped',await A.X('JSON.stringify({pick:J.pick,eq:J.eq,paused,running})'));
const preClick=await state();log('after key before click',preClick);await A.page.mouse.click(240,135);const seen=[];let landed=false;for(let i=0;i<24;i++){const s=await state();seen.push(s);if(s.fx.some(e=>e.bm)){landed=true;break;}await new Promise(r=>setTimeout(r,150));}
log('natural clock states',seen);check('keyboard intent reaches server and lands',landed,seen.at(-1));if(!landed)throw Error('native input cast did not land');
await A.page.waitForFunction(()=>window.__xe('[...netWalls.values()].some(o=>o.userData.sgxh?.arms.some(a=>a.visible))'),null,{timeout:6000});check('client naturally deploys at least one terrain-supported arm',true,'server clock unmodified');log('client state',await A.X('JSON.stringify({ready:NET.ready,fx:[...netWalls.entries()].map(([id,o])=>({id,flight:!!o.userData.meshFlight,mesh:!!o.userData.sgxh})),map:NM.current?.key,frames:renderer.info.render.frame})'));
await A.page.screenshot({path:SHOT+'mesh-live-solo.png'});
};
