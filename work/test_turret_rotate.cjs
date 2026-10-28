// Killjoy Turret rotation + Sage Barrier Orb rotation on the real page (offline 5v5, native Ascent).
// Valorant: wiki.playvalorant.com/en-us/Turret (patch 12.04): "Can now be rotated while holding down ALT-FIRE. ACTIVATE now swaps its direction."
// wiki Barrier_Orb: "When first equipped in a round, the indicator will be oriented to be perpendicular to the direction Sage is facing. Sage can
// recast the ability to rotate this indicator 90 deg. Using Alternate Fire allows her to have full control over the exact angle ... If Sage unequips
// Barrier Orb, the orientation of the indicator upon reequipping will be the same as it was when she unequipped the ability."
// Was: ALT FIRE with the Turret / Barrier out cast it at once (no rotation), E / C again put it away; both always faced the view.
// Checked (work/ability_equip_runtime.js xRot*, work/ability_target_runtime.js arrow / line, index.html kjKey E / sgKey C, mpCastSelf fy / by):
//  Turret: placement ring carries a facing arrow; HOLD ALT FIRE + mouse turns the turret, not the view, and casts nothing; E again swaps it 180 deg
//  (still in hand); FIRE places it facing that way (J.tur fx / fz, mesh yaw); online cast sends m.fy. Barrier: line across the aim at first; C again
//  toggles 90 / 0 deg; HOLD ALT FIRE any angle; kept after putting it away and re-equipping; FIRE builds the wall at that angle; m.by; new round resets.
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const click=async(b=0)=>{H.mouse(b,true);await adv(40);H.mouse(b,false);await adv(60);};
const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),near=(a,b,e=1e-3)=>Math.abs(wrap(a-b))<e;
const start=async agent=>{xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through(agent),'offline 5v5 started as '+agent);assert.equal(xe('J.pick'),agent);
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});xBUse=function(){return false;};document.pointerLockElement=renderer.domElement;true');};
const msgOf=(k,face)=>xe('(()=>{let out=null;const s0=mpSend;mpSend=(c,m)=>{out=m;};const r=MP.role;try{MP.role="client";XABT.face='+face+';mpCastSelf("'+k+'");}finally{mpSend=s0;MP.role=r;XABT.face=null;}return out;})()');
(async()=>{
 await start('Killjoy');
 // ---- Turret ----
 xe('J.e=1;pitch=-0.3;true');await tap('KeyE');await adv(1300);let q=xe('J.eq&&{k:J.eq.k,st:J.eq.st}');assert.ok(q&&q.k==='e'&&q.st==='ready','turret in hand: '+JSON.stringify(q));
 const arrow=()=>xe('(()=>{const a=xPlace.st.arrow;return a?{on:!!a.parent,ry:a.rotation.y,x:a.position.x,z:a.position.z}:{on:false}})()'),face=()=>xe('xRotFace(J.eq)'),y0=xe('yaw');
 let a=arrow();check(a.on,'turret: facing arrow on the placement ring');check(near(a.ry,y0),'arrow faces the view at first '+a.ry+' vs '+y0);
 // HOLD ALT FIRE + mouse: the turret turns, the view stays, nothing is cast
 xe('mpAltHeld=true;true');H.mouse(2,true);await adv(60);for(let i=0;i<4;i++){H.look(150,40);await adv(60);}
 check(near(xe('yaw'),y0),'ALT FIRE held: the view does not turn ('+xe('yaw')+' vs '+y0+')');const f1=face();check(!near(f1,y0,.2),'ALT FIRE held: the turret turned ('+f1+')');check(f1<y0,'mouse right turns it right (yaw down)');
 check(xe('J.e')===1&&xe('!!J.eq&&J.eq.st!=="rel"')&&!xe('!!J.tur'),'ALT FIRE does not cast the turret');a=arrow();check(near(a.ry,f1),'the arrow follows the turret facing');
 xe('mpAltHeld=false;true');H.mouse(2,false);await adv(60);H.look(100,0);await adv(60);check(!near(xe('yaw'),y0),'ALT FIRE released: the mouse turns the view again');
 const off1=wrap(face()-xe('yaw'));
 // E again: swaps 180 deg, still in hand
 await tap('KeyE');await adv(100);check(xe('!!J.eq&&J.eq.k==="e"'),'E again keeps the turret in hand');check(near(wrap(face()-xe('yaw')),wrap(off1+Math.PI)),'E again swaps it 180 deg');
 const f2=face();await click(0);await adv(800);const T=xe('J.tur&&{fx:J.tur.fx,fz:J.tur.fz,ry:J.tur.m.rotation.y}');
 check(T&&Math.abs(T.fx+Math.sin(f2))<1e-3&&Math.abs(T.fz+Math.cos(f2))<1e-3,'turret placed facing the chosen way '+JSON.stringify(T)+' face '+f2);check(T&&near(T.ry,f2),'turret mesh faces it');check(!arrow().on,'arrow gone after the cast');
 let m=msgOf('e',1.2345);check(m&&m.fy===1.2345,'online turret cast sends fy '+JSON.stringify(m));m=msgOf('e','null');check(m&&!('fy' in m),'no facing chosen: no fy');
 // ---- Barrier Orb ----
 // as Sage (a fresh page boot is costly; switching J.pick is enough for the kit + equip tables, Sage's kit is plain sgKey)
 xe('J.eq=null;J.pick="Sage";true');
 xe('J.c=2;J.cd.c=0;J.sgBo=0;pitch=-0.3;true');await tap('KeyC');await adv(1000);q=xe('J.eq&&{k:J.eq.k,st:J.eq.st}');assert.ok(q&&q.k==='c'&&q.st==='ready','barrier in hand: '+JSON.stringify(q));
 const line=()=>xe('(()=>{const l=xPlace.st.line;return l?{on:!!l.parent,ry:l.rotation.y}:{on:false}})()');let L=line();const yv=xe('yaw');
 check(L.on&&near(L.ry,yv),'barrier line across the aim at first '+JSON.stringify(L)+' yaw '+yv);
 await tap('KeyC');await adv(100);check(xe('!!J.eq&&J.eq.k==="c"'),'C again keeps the barrier in hand');L=line();check(near(L.ry,yv+Math.PI/2),'C again: rotated 90 deg '+L.ry);
 await tap('KeyC');await adv(100);L=line();check(near(L.ry,yv),'C again: back to 0 deg');
 xe('mpAltHeld=true;true');H.mouse(2,true);await adv(60);for(let i=0;i<3;i++){H.look(-90,0);await adv(60);}xe('mpAltHeld=false;true');H.mouse(2,false);await adv(60);
 check(near(xe('yaw'),yv),'ALT FIRE: view still');const bo=xe('J.sgBo');check(bo>.05&&!near(bo,Math.PI/2,.05),'ALT FIRE: any angle ('+bo+')');check(xe('J.c')===2,'ALT FIRE casts nothing');
 L=line();check(near(L.ry,yv+bo),'line at the ALT FIRE angle');
 // put away (weapon key) and re-equip: the angle is kept
 await tap('Digit2');await adv(400);check(!xe('J.eq'),'put away');await tap('KeyC');await adv(1000);L=line();check(L.on&&near(L.ry,xe('yaw')+bo),'re-equipped: same angle '+L.ry);
 const fb=xe('xRotFace(J.eq)');await click(0);await adv(900);const S=xe('J.sw&&{ax:J.sw.ax,az:J.sw.az}');check(S&&Math.abs(S.ax-Math.cos(fb))<1e-3&&Math.abs(S.az+Math.sin(fb))<1e-3,'wall built at the indicator angle '+JSON.stringify(S));
 m=msgOf('c',-0.5);check(m&&m.by===-0.5,'online barrier cast sends by '+JSON.stringify(m));
 xe('jRound();true');await adv(100);check(xe('J.sgBo||0')===0,'a new round: perpendicular again');
 console.log(fails.length?'FAILED '+fails.length:'PASS turret rotate (ALT FIRE turns it, E swaps 180, arrow, fy) + barrier rotate (C 90/0, ALT FIRE any angle, kept between equips, by)');
 process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
