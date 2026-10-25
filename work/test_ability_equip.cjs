// Valorant ability parity (work/ability_equip_runtime.js) on the real page (work/page_harness.cjs, real three.js scene):
// default binds C / Q / E / X (crouch Ctrl), a stored pre-C/Q/E/X bind map migrated to them, HUD slot labels following a
// rebind, and a rebound physical key casting the ability.
//   node work/test_ability_equip.cjs     (in test_all)
const {boot,lsStore}=require('./page_harness.cjs');
const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||3);
const fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m+': got '+JSON.stringify(a)+' want '+JSON.stringify(b));};
(async()=>{
 // a session that saved the legacy layout (abilities on Z / X / C) without ever choosing it
 const legacy={fwd:"KeyW",back:"KeyS",left:"KeyA",right:"KeyD",walk:"ShiftLeft",crouch:"KeyC",jump:"Space",use:"KeyF",abC:"KeyZ",abQ:"KeyX",abE:"KeyC",abX:"KeyV",ping:"KeyQ"};
 const store=lsStore([["vs.keys",JSON.stringify(legacy)]]);
 const H=boot({real3:true,seed:SEED,ls:store}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const errs0=H.errors.length;
 eq(xe('XKB.filter(a=>/^ab|crouch/.test(a[0])).map(a=>a[2])'),["ControlLeft","KeyC","KeyQ","KeyE","KeyX"],'defaults crouch/C/Q/E/X');
 eq(xe('[XS.keys.abC,XS.keys.abQ,XS.keys.abE,XS.keys.abX,XS.keys.crouch,XS.keys.ping]'),["KeyC","KeyQ","KeyE","KeyX","ControlLeft","KeyZ"],'legacy Z/X/C map migrated');
 eq(JSON.parse(store.getItem('vs.keys')).abQ,"KeyQ",'migration saved');
 eq(xe('xAbMigrate({abC:"KeyC",abQ:"KeyV",abE:"KeyE",abX:"KeyX"})'),false,'a player-edited map is kept');
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;startFive();true');await adv(400);xe('FV.buy=0;true');await adv(300);
 if(!xe('running&&mode==="five"'))fail('match did not start');
 eq(xe('["jC","jQ","jE","jX"].map(i=>document.getElementById(i).querySelector("b").textContent)'),["C","Q","E","X"],'HUD labels');
 // rebind Ability Q to V through the Controls row (click the row, press V)
 xe('xKbWait="abQ";true');H.dispatch(H.win,H.mkEvent('keydown',{code:'KeyV',key:'v',isTrusted:true}));await adv(60);
 eq(xe('XS.keys.abQ'),"KeyV",'rebind');eq(xe('document.getElementById("jQ").querySelector("b").textContent'),"V",'HUD label follows rebind');
 xe('J.q=2;J.cd.q=0;true');const q0=xe('J.q');
 for(const t of ['keydown','keyup'])H.dispatch(H.doc,H.mkEvent(t,{code:'KeyV',key:'v',isTrusted:true}));await adv(300);
 if(VERBOSE)console.log(xe("[J.pick,jOn(),FV.buy,J.q,player.hp,running,paused]"));eq(xe("J.q"),q0-1,'rebound physical V casts Ability Q');
 xe('XS.keys=xKbDef();xKbSave();true');eq(xe('document.getElementById("jQ").querySelector("b").textContent'),"Q",'reset restores label');
 if(H.errors.length>errs0)fail('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.message||e)).join(' | '));
 if(fails.length){console.log(fails.join('\n'));process.exit(1);}console.log('ability equip: binds, migration, HUD labels ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
