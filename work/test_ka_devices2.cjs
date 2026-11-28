// Kingdom Archives device wiring, second batch: Vyse's Arc Rose (E), Deadlock's Barrier Mesh (C, after
// the flight lands) and Annihilation (X), and Tejo's Stealth Drone (C) attach the real downloaded
// glbs (arc-rose / barrier-mesh / annihilation / stealth-drone) on top of the procedural visuals,
// and each is removed when its effect ends. Real page, real glbs. Run: node work/test_ka_devices2.cjs
const {boot}=require('./page_harness.cjs');
const fails=[];const fail=s=>{fails.push(s);console.log('FAIL',s);};
(async()=>{
 const H=boot({real3:true,seed:3,native:true,fastGlobal:true,glb:true}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 const tap=async(code,ms=80)=>{H.key(code,true);await adv(ms);H.key(code,false);};
 const devs=slug=>xe(`(window.KAD?KAD.live.filter(r=>r.dev===${JSON.stringify(slug)}&&r.root&&r.root.parent):[]).length`);
 const start=async a=>{xe(`J.pick=${JSON.stringify(a)};FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true`);await adv(400);xe('FV.buy=0;true');await adv(300);if(!xe('running&&mode==="five"'))fail(a+': match did not start');};
 // Vyse E -> arc-rose
 await start('Vyse');
 xe('J.e=1;J.cd.e=0;true');
 await tap('KeyE',120);await adv(1800);
 if(devs('arc-rose')<1)fail('arc-rose.glb not live after Arc Rose');
 else console.log('vyse arc-rose ok');
 // Deadlock C -> barrier-mesh (aim down so the ballistic plan resolves, wait out the flight)
 await start('Deadlock');
 xe('J.c=1;J.cd.c=0;pitch=-0.8;true');
 await tap('KeyC',120);
 if(xe('!!(J.eq&&J.eq.st!=="rec")')){await adv(200);H.mouse(0,true);await adv(60);H.mouse(0,false);} // equip-then-fire: Barrier Mesh throws on FIRE
 await adv(3500);
 if(devs('barrier-mesh')<1)fail('barrier-mesh.glb not live after Barrier Mesh lands (flights='+xe('a18MeshFlights.length')+' meshes='+xe('a18Meshes.length')+')');
 else console.log('deadlock barrier-mesh ok');
 // Deadlock X -> annihilation projectile (fx ttl is 1s; check inside the window)
 xe('J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};pitch=0;if(bots[0]){bots[0].hp=100;bots[0].alive=true;bots[0].g.position.set(player.x+5,player.y||0,player.z+5);}true');
 await tap('KeyX',120);await adv(500);
 if(devs('annihilation')<1)fail('annihilation.glb not live after Annihilation (ult='+xe('J.ult')+')');
 else console.log('deadlock annihilation ok');
 await adv(1200); // projectile fx ends -> model must detach
 if(devs('annihilation')>0)fail('annihilation model survived its projectile fx');
 // Tejo C -> stealth-drone rides the throw, then hovers
 await start('Tejo');
 xe('J.c=1;J.cd.c=0;true');
 await tap('KeyC',120);await adv(1800);
 if(devs('stealth-drone')<1)fail('stealth-drone.glb not live after Stealth Drone');
 else console.log('tejo stealth-drone ok');
 await adv(8000); // sdrone.life 8s + flight -> drone removed
 if(devs('stealth-drone')>0)fail('stealth-drone model survived its lifetime');
 if(fails.length)process.exit(1);
 console.log('PASS test_ka_devices2');
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
