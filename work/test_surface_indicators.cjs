// Surface placement indicators + Breach through-wall reach on the real page (offline 5v5, native Ascent; work/ability_target_runtime.js xSurf*,
// index.html cyWireSpot / cyCamSpot / ryLeerSpot / bcWallSpot). Valorant wiki: Trapwire (max deploy distance 20 m, max wire length 15 m, two pieces of
// terrain opposite each other), Spycam (vertical terrain, 20 m, max deploy height 4.5 m), Leer (10 m, through terrain, pulled back out of it),
// Aftershock / Flashpoint (35 m, 10 m wall penetration; "red if ... the charge cannot pass through to the other side"). Colour on a viable spot, red
// on an unviable one, and an unviable cast is refused (the ability stays in hand). Was: no indicator for any of them, Trapwire 12 m with 2.5 m stubs,
// Spycam on floors / in mid-air, Leer at the first wall within 12 m, Breach a wall within 8 m.
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const click=async(b=0)=>{H.mouse(b,true);await adv(40);H.mouse(b,false);await adv(60);};
const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
const mesh=n=>xe('(()=>{const m=xSurf.st.m["'+n+'"];return m?{on:!!m.parent,x:m.position.x,y:m.position.y,z:m.position.z,sx:m.scale.x,col:m.material.color.getHex()}:{on:false}})()');
const RED=0xff4655,col=(c,h)=>[16,8,0].every(b=>Math.abs(((c>>b)&255)-((h>>b)&255))<=3);/* three's colour management can move a setHex by one step */
// headings from where the player stands: yaw a, pitch p -> the spot; the first that passes f(spot)
const scan=async(pitch,f,n=48)=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2;xe('yaw='+a+';pitch='+pitch+';true');await adv(50);const s=xe('(()=>{const s=xSurf.spot();return s&&JSON.parse(JSON.stringify(s))})()');if(s&&f(s))return {a,s};}return null;};
const equip=async(code,ms)=>{await tap(code);await adv(ms);return xe('J.eq&&J.eq.st');};
const as=agent=>xe('J.eq=null;J.pick="'+agent+'";true');
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Cypher'),'offline 5v5 started');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});xBUse=function(){return false;};document.pointerLockElement=renderer.domElement;true');
 const P=()=>xe('({x:player.x,y:player.y,z:player.z})');
 check(JSON.stringify(xe('[XWIRE.reach,XWIRE.len,XSPY.reach,XCAM.up,XLEERD.d,XBRW.reach,XBRW.depth]'))==='[20,15,20,4.5,10,35,10]','wiki values: wire 20 / 15 m, Spycam 20 m / 4.5 m up, Leer 10 m, Breach 35 / 10 m');
 // ---- Trapwire ----
 xe('J.c=2;J.cd.c=0;true');check(await equip('KeyC',900)==='ready','Trapwire in hand');
 let h=await scan(-0.08,s=>s.kind==='wire'&&s.ok);check(h,'some heading from the spawn has a viable wire');
 if(h){const s=h.s,L=Math.hypot(s.a.x-s.b.x,s.a.z-s.b.z),p=P();check(L<=15.01&&s.r1+s.r2<=15.01,'wire at most 15 m ('+L.toFixed(2)+')');check(Math.hypot(s.cx-p.x,s.cz-p.z)<=20.01,'within 20 m');
  const m=mesh('xSurfWire');check(m.on&&col(m.col,0x3fd0c0),'viable: a teal wire line '+JSON.stringify(m));check(Math.abs(m.sx-L)<.05&&Math.abs(m.x-(s.a.x+s.b.x)/2)<.05&&Math.abs(m.z-(s.a.z+s.b.z)/2)<.05,'the line spans the two anchors');
  const n0=xe('BC.cw.length');await click(0);await adv(900);check(xe('BC.cw.length')===n0+1&&xe('J.c')===1,'FIRE places the wire');const W=xe('(()=>{const w=BC.cw[BC.cw.length-1];return {a:w.a,b:w.b}})()');
  check(Math.hypot(W.a.x-s.a.x,W.a.z-s.a.z)<.3&&Math.hypot(W.b.x-s.b.x,W.b.z-s.b.z)<.3,'the wire is where the line was '+JSON.stringify([W,s.a,s.b]));check(!mesh('xSurfWire').on,'line gone after the cast');}
 // unviable (aimed at the sky: nothing within 20 m) -> nothing shown, refused; a wire longer than 15 m -> red
 xe('J.cd.c=0;true');check(await equip('KeyC',900)==='ready','Trapwire in hand again');xe('pitch=1.35;true');await adv(100);let n1=xe('BC.cw.length');await click(0);await adv(900);check(xe('BC.cw.length')===n1&&xe('J.c')===1,'aimed at the sky: refused, charge kept');
 h=await scan(-0.08,s=>s.kind==='wire'&&!s.ok&&!s.none);if(h){await adv(60);const m=mesh('xSurfWire');check(m.on&&col(m.col,RED),'too long / one side open: a red line');n1=xe('BC.cw.length');await click(0);await adv(900);check(xe('BC.cw.length')===n1,'red line: refused');}
 else console.log('note: no unviable wire heading at this spot (all walls within 15 m)');
 xe('J.eq=null;true');await adv(100);
 // ---- Spycam ----
 xe('BC.cam=null;BC.cv=false;true');check(await equip('KeyE',900)==='ready','Spycam in hand');
 h=await scan(0,s=>s.kind==='cam'&&s.ok);check(h,'some heading has a wall for the Spycam');
 if(h){const s=h.s,p=P();check(Math.abs(s.ny)<.5,'on vertical terrain');check(s.y-p.y<=4.51,'at most 4.5 m up');const m=mesh('xSurfCam');check(m.on&&col(m.col,0x3fd0c0)&&Math.hypot(m.x-s.x,m.z-s.z)<.05,'a teal disc on the wall '+JSON.stringify(m));
  await click(0);await adv(900);const c=xe('BC.cam&&{x:BC.cam.p.x,y:BC.cam.p.y,z:BC.cam.p.z}');check(c&&Math.hypot(c.x-s.x,c.z-s.z)<.05,'FIRE places the camera on that wall '+JSON.stringify(c));}
 xe('if(BC.cam){scene.remove(BC.cam.m);BC.cam=null;}BC.cv=false;J.eq=null;true');check(await equip('KeyE',900)==='ready','Spycam in hand again');
 xe('pitch=-1.3;true');await adv(100);let s=xe('JSON.parse(JSON.stringify(xSurf.spot()))');check(s&&!s.ok&&!s.none,'aimed at the floor: unviable ('+JSON.stringify(s)+')');check(col(mesh('xSurfCam').col,RED),'red disc on the floor');
 await click(0);await adv(900);check(!xe('BC.cam'),'floor: refused, no camera');xe('pitch=1.35;true');await adv(100);await click(0);await adv(900);check(!xe('BC.cam'),'open sky: refused');xe('J.eq=null;true');await adv(100);
 // ---- Leer ----
 as('Reyna');xe('J.c=2;J.cd.c=0;J.leer=J.leer||[];true');check(await equip('KeyC',1000)==='ready','Leer in hand');
 h=await scan(0,s=>s.kind==='leer'&&s.t>=9.99);check(h,'an open heading: the eye 10 m out');
 if(h){const m=mesh('xSurfLeer');check(m.on&&Math.abs(m.x-h.s.x)<.05&&Math.abs(m.z-h.s.z)<.05,'eye marker at its spot');const e=xe('pEye()'),sp=h.s;check(Math.abs(Math.hypot(sp.x-e.x,sp.y-e.y,sp.z-e.z)-10)<.05,'10 m from the eye');
  const n=xe('J.leer.length');await click(0);await adv(1200);const L=xe('(()=>{const l=J.leer[J.leer.length-1];return l&&{x:l.b.x,y:l.b.y,z:l.b.z}})()');check(xe('J.leer.length')===n+1&&L&&Math.hypot(L.x-sp.x,L.z-sp.z)<.3,'Leer flies to that spot '+JSON.stringify([L,sp]));}
 xe('J.cd.c=0;J.c=2;J.eq=null;true');check(await equip('KeyC',1000)==='ready','Leer again');h=await scan(0,s=>s.kind==='leer'&&s.t<9.99);
 if(h){const s2=h.s;check(!xe('ryLeerIn('+s2.x+','+s2.y+','+s2.z+')'),'into a wall: pulled back out of terrain ('+s2.t+' m)');}else console.log('note: every heading open for 10 m');
 xe('J.eq=null;true');await adv(100);
 // ---- Breach Aftershock ----
 as('Breach');xe('J.c=2;J.q=2;J.cd.c=0;J.cd.q=0;true');check(await equip('KeyC',1100)==='ready','Aftershock in hand');
 h=await scan(0,s=>s.kind==='breach'&&s.ok);check(h,'some heading has a wall Breach can fire through');
 if(h){const s=h.s,p=P(),nr=mesh('xSurfNear'),fr=mesh('xSurfFar');check(s.near.d<=35.01,'wall within 35 m');check(nr.on&&fr.on&&col(nr.col,0xf2a93a)&&col(fr.col,0xf2a93a),'near-face + far-side rings, yellow');
  const dn=Math.hypot(s.near.x-p.x,s.near.z-p.z),df=Math.hypot(s.far.x-p.x,s.far.z-p.z);check(df>dn+1,'the far ring is beyond the wall ('+dn.toFixed(1)+' -> '+df.toFixed(1)+')');check(df-dn<=10+1.3+.3,'at most 10 m through (+1.2 m past)');
  check(Math.abs(fr.x-s.far.x)<.05&&Math.abs(fr.z-s.far.z)<.05&&Math.abs(nr.x-s.near.x)<.1,'rings at the spots');
  const n=xe('BC.as.length');await click(0);await adv(1000);check(xe('BC.as.length')===n+1&&xe('J.c')===1,'FIRE: Aftershock cast');const a=xe('(()=>{const a=BC.as[BC.as.length-1];return {x:a.p.x,z:a.p.z}})()');check(Math.hypot(a.x-s.far.x,a.z-s.far.z)<.1,'Aftershock on the far side');}
 // aimed at the floor (no wall there): red near ring, refused; aimed at the sky: nothing shown, refused (a human keeps the charge)
 xe('J.cd.c=0;J.eq=null;true');check(await equip('KeyC',1100)==='ready','Aftershock in hand again');xe('pitch=-1.2;true');await adv(100);let nr=mesh('xSurfNear');check(nr.on&&col(nr.col,RED)&&!mesh('xSurfFar').on,'floor: red near ring, no far ring');
 let n=xe('BC.as.length');await click(0);await adv(900);check(xe('J.c')===1,'floor: refused, charge kept');
 xe('pitch=1.35;true');await adv(100);check(!mesh('xSurfNear').on,'sky: no ring');await click(0);await adv(900);check(xe('J.c')===1,'sky: refused');/* (BC.as itself shrinks as the first Aftershock ends) */xe('J.eq=null;true');await adv(100);
 // Flashpoint: same rule, the flash 1.8 m over the far floor
 check(await equip('KeyQ',1300)==='ready','Flashpoint in hand');h=await scan(0,s=>s.kind==='breach'&&s.ok);if(h){const q0=xe('J.q');await click(0);await adv(900);check(xe('J.q')===q0-1,'Flashpoint cast through the wall');}
 xe('J.eq=null;true');await adv(200);check(!['xSurfNear','xSurfFar','xSurfWire','xSurfCam','xSurfLeer'].some(k=>mesh(k).on),'no indicator left with nothing in hand');
 console.log(fails.length?'FAILED '+fails.length:'PASS surface indicators: Trapwire line (20 m / 15 m), Spycam on walls (20 m, 4.5 m up), Leer eye 10 m, Breach near + far rings (35 m / 10 m); unviable = red + refused');
 process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
