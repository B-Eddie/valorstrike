// Touch Spike plant / defuse (ledger row 7): the real page on a coarse-pointer device (work/page_harness.cjs, coarse),
// an offline 5v5 round, real pointer events on the on-screen PLANT button (the 4 hold) through the page's own rAF loop:
//  - the touch controls are shown in the round and the PLANT button is visible; it is hidden in deathmatch (no Spike)
//  - holding PLANT in a site as the carrier plants in 4 s; releasing early resets the plant
//  - holding PLANT at the planted Spike as a defender defuses in 7 s; releasing after the half keeps the 3.5 s checkpoint
//  - the prompts match the button's own label ("4": "Hold 4 to plant / defuse")
//  - a lost pointer capture / cancel releases the hold (no stuck 4)
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,coarse:true}),xe=H.xe,fails=[],out=[],errs0=H.errors.length,x0=H.xErrCalls.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async()=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const btn=k=>H.doc.querySelector(`#xT .tb[data-k="${k}"]`);
const down=(k,id)=>H.dispatch(btn(k),H.mkEvent('pointerdown',{pointerId:id,clientX:40,clientY:200,pointerType:'touch'}));
const up=(id,type='pointerup')=>H.dispatch(H.$('xT'),H.mkEvent(type,{pointerId:id,pointerType:'touch'}));
const check=(name,ok,detail)=>{out.push((ok?'ok   ':'FAIL ')+name+(detail?' ('+detail+')':''));if(!ok)fails.push(name+(detail?': '+detail:''));};
const prompt=()=>{const d=H.$('defuse');return d&&d.style.display!=='none'&&d.firstChild?String(d.firstChild.textContent):'';};
// No AI (puppets), nobody can end the round while the hold is measured.
const freeze='for(const b of bots)b.nt=true;for(const a of allies)a.nt=true;player.hp=100;player.vx=player.vz=0;true';
(async()=>{
 xe('FV.pick="split";window.xQPick="split";try{mpSet("split")}catch(e){}true');
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe(freeze);xe('FV.buy=0;buyMenu(false);true');await adv(200);
 check('touch controls shown in the round',H.$('xT').classList.contains('on'));
 check('PLANT button visible in a Spike round',!btn('plant').classList.contains('hid'));
 // plant: carrier in a site
 const toSite=`${freeze};const s=FV.sp,k=Object.keys(SITES)[0];player.x=SITES[k][0];player.z=SITES[k][1];s.st="carry";s.c=player;s.pt=0;since=1;true`;
 xe(toSite);await adv(100);
 check('plant prompt matches the button label',/^Hold 4 to plant/.test(prompt())&&btn('plant').textContent.trim()==='4',prompt());
 down('plant',7);await adv(2000);const pt=xe('FV.sp.pt');check('PLANT hold advances the plant',pt>1.8&&pt<2.2,'pt '+pt.toFixed(2)+' after 2 s');
 check('prompt shows Planting while held',/^Planting/.test(prompt()),prompt());
 up(7);await adv(100);check('release before 4 s resets the plant',xe('FV.sp.pt')===0&&xe('FV.sp.st')==='carry'&&!xe('!!keys.Digit4'),'pt '+xe('FV.sp.pt')+' st '+xe('FV.sp.st'));
 down('plant',8);await adv(1000);up(8,'lostpointercapture');await adv(100);check('lost pointer capture releases the hold',!xe('!!keys.Digit4')&&xe('FV.sp.pt')===0);
 down('plant',9);await adv(1000);up(9,'pointercancel');await adv(100);check('pointercancel releases the hold',!xe('!!keys.Digit4')&&xe('FV.sp.pt')===0);
 xe(toSite);down('plant',10);await adv(4300);up(10);await adv(100);
 check('4 s PLANT hold plants the Spike',xe('FV.sp.st')==='plant',xe('FV.sp.st'));
 // defuse: player on the defending side, next to the planted Spike
 const toSpike=`${freeze};FV.atk=false;const s=FV.sp;s.st="plant";s.t=45;s.dt=0;s.x=player.x+0.5;s.z=player.z;timeLeft=45;true`;
 xe(toSpike);await adv(100);
 check('defuse prompt shown at the Spike',/^Hold 4 to defuse/.test(prompt()),prompt());
 down('plant',11);await adv(4500);up(11);await adv(100);const half=xe('FV.sp.dt');
 check('release after the half keeps the 3.5 s checkpoint',half===3.5,'dt '+half);
 down('plant',12);await adv(3700);up(12);await adv(300);
 check('PLANT hold completes the defuse (7 s with the checkpoint)',xe('FV.sp.st')==='done',xe('FV.sp.st')+' dt '+xe('FV.sp.dt'));
 // deathmatch: no Spike, no PLANT button
 await adv(6000);H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);if(H.$('xHome'))H.$('xHome').click();await adv(300);
 if(H.shown('result'))H.$('lobbyBtn').click();await adv(300);
 xe('FV.pick="ascent";window.xQPick=null;true');H.$('dmBtn').click();await adv(50);
 if(await through()){await adv(200);check('PLANT button hidden in deathmatch',btn('plant').classList.contains('hid'));}else check('deathmatch started',false);
 {const e=H.errors.slice(errs0),x=H.xErrCalls.slice(x0);if(e.length||x.length)fails.push('page exceptions: '+JSON.stringify({e:e.slice(0,4),x:x.slice(0,4)}));}
 if(process.env.VERBOSE||fails.length)console.log(out.join('\n'));
 if(fails.length){console.error(fails.join('\n'));process.exit(1);}
 console.log('Touch Spike: PLANT button visible in Spike rounds (hidden in DM); hold plants in 4 s, early release / cancel / lost capture resets, defuse hold keeps the half checkpoint and completes');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
