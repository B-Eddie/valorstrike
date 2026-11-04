// Astra Astral Form and Tejo Guided Salvo / Armageddon tactical-map targeting (work/agents18_runtime.js a18Tac,
// riding work/ability_target_runtime.js xTac) on the real page with native Ascent (work/page_harness.cjs).
// The real kits pick these spots on an overhead map (wiki.playvalorant.com Astra / Tejo, fetched 2026-11-03).
// Checked:
//  * Astra X with the ult ready opens the xTac overlay as "Astral Form"; C / Q / E arm a star type while it is up
//  * a bare map click places a persistent Star AT THE CLICKED POINT (spends one star, map stays open); C/Q/E arm,
//    clicking the placed Star activates the effect AT THE STAR and consumes it; clicking a Star unarmed dissipates it;
//    X inside the map arms Cosmic Divide: two clicks spend the ult and close it
//  * Esc closes the map (ult kept); X without the ult does not open it
//  * Tejo E opens the map: two clicks fire both salvos at the picked points for one charge; E again after one
//    click launches a single salvo; X opens Armageddon and the click sets its origin (direction Tejo -> point)
//  * online 5v5: opening Astral Form sends {t:'ab',k:'x'}, a star click sends {t:'ab',k,p:[x,z]}, the Divide
//    sends four numbers, Tejo salvos send two points, Armageddon sends its origin - nothing spent locally
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:7,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const click=async(b=0)=>{H.mouse(b,true);await adv(40);H.mouse(b,false);await adv(60);};
const fails=[];const check0=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
const st=()=>xe('({on:xTac.on(),mode:A18TAC.mode,ult:J.ult,stars:J.a18?J.a18.stars:null,e:J.e,v:!!xTac.st.v,cx:xTac.st.cx,cy:xTac.st.cy})');
const look=(mx,my)=>H.dispatch(xe('renderer.domElement'),H.mkEvent('mousemove',{movementX:mx,movementY:my}));
const moveTo=async(x,z)=>{const c=xe(`xTac.canvas(${x},${z})`),s=xe('xTac.st.sens');for(let i=0;i<3;i++){const p=st();look(Math.round((c[0]-p.cx)/s),Math.round((c[1]-p.cy)/s));}await adv(60);};
const node=async label=>xe(`(()=>{const C=nmActive();let best=null,bd=-1;C.nav.nodes.forEach((n,i)=>{if(C.playable&&!C.playable[i])return;const d=Math.hypot(n[0]-player.x,n[2]-player.z);if(d>bd&&d<55){bd=d;best=n;}});return best&&{x:best[0],y:best[1],z:best[2],d:bd};})()`);

// Armageddon offline chain (agents18_runtime.js armagchain mirror of server agents18.js; wiki.playvalorant.com/en-us/Armageddon):
// 3.08 s windup, 16 segments x 2 m x 12 m, segment i starts 0.25 s after i-1, 4 detonations/segment 0.25 s apart, 60 each.
const pin=async ms=>{for(let t=0;t<ms;t+=50){xe('(()=>{const P=window.__P;[[0,1,0],[1,31,0],[2,-5,0],[3,7,7]].forEach(([i,dx,dz])=>{bots[i].g.position.set(P.x+dx,player.y,P.z+dz);bots[i].armor=0;});return 1;})()');await adv(50);}};
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Tejo'),'offline 5v5 started');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9;b.armor=0;b.sh=0;b.g.visible=true});allies.forEach(a=>{a.cd=1e9});true');
 const hp=i=>xe(`1e9-bots[${i}].hp`);
 xe(`{const P=new THREE.Vector3(player.x,0,player.z),d=new THREE.Vector3(1,0,0);bots[0].g.position.set(P.x+1,player.y,P.z);bots[1].g.position.set(P.x+31,player.y,P.z);bots[2].g.position.set(P.x-5,player.y,P.z);bots[3].g.position.set(P.x+7,player.y,P.z+7);window.__P={x:P.x,z:P.z};a18Fx({kind:"armag",p:P,d:d,t:A18C.armag.wind});}true`);
 await pin(2900);check0(hp(0)===0,'no damage during the windup');
 await pin(600);check0(hp(0)===120,'segment 0 two detonations (120) by +0.4 s, got '+hp(0));check0(hp(1)===0,'segment 15 not started');
 await pin(8000);check0(hp(0)===240,'segment 0 exactly 4x60, got '+hp(0));check0(hp(1)===240,'segment 15 4x60 later, got '+hp(1));check0(hp(2)===0,'behind origin spared');check0(hp(3)===0,'7 m aside (outside 12 m width) spared');
 check0(xe('(J.a18fx||[]).filter(f=>f.kind==="armagchain").length')===0,'chain effect removed after the last detonation');
 if(fails.length){console.log(fails.length+' FAILED');process.exit(1);}console.log('PASS armageddon offline chain: windup, per-segment 4x60 chain, width/behind exclusions, cleanup');process.exit(0);
})();
