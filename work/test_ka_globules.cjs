// Gekko reclaim globules + mosh model (Kingdom Archives device wiring): casting Wingman/Dizzy/Mosh
// attaches the real glb to the creature, and when the creature's fx ends a globule model (baby-*)
// stays at the end position until the reclaim timer returns the charge. Real page, real glbs.
const {boot}=require('./page_harness.cjs');
const fails=[];const fail=s=>{fails.push(s);console.log('FAIL',s);};
(async()=>{
 const H=boot({real3:true,seed:3,native:true,fastGlobal:true,glb:true}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 const tap=async(code,ms=80)=>{H.key(code,true);await adv(ms);H.key(code,false);};
 xe('J.pick="Gekko";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 xe('FV.buy=0;true');await adv(300);
 if(!xe('running&&mode==="five"')){fail('match did not start');process.exit(1);}
 const glob=()=>xe('(window.KAD?KAD.live.filter(r=>r.globule):[]).map(r=>r.globule+":"+(r.root&&!!r.root.parent)).join(",")');
 const wing=async()=>xe('!!window.KAD && KAD.live.length>=0 && true');
 // Wingman (q): creature cast -> model attach attempted; globule after creature ends
 xe('J.q=1;J.cd.q=0;J.a18gl={};true');
 xe('if(bots[0]){bots[0].hp=100;bots[0].alive=true;bots[0].g.position.set(player.x+6,player.y||0,player.z+6);}true');
 await tap('KeyQ',120);await adv(500);
 if(!xe('(J.a18gl||{}).q>0'))fail('wingman cast did not start reclaim timer');
 await adv(5500); // wing.life 5s
 let g=glob();
 if(!/q:true/.test(g))fail('no live wingman globule after creature end: '+g);
 // Dizzy (e)
 xe('J.e=1;J.cd.e=0;true');
 await tap('KeyE',120);await adv(1500);
 g=glob();
 if(!/e:true/.test(g))fail('no live dizzy globule: '+g);
 // Mosh (c)
 xe('J.c=1;J.cd.c=0;true');
 await tap('KeyC',120);await adv(3600); // mosh.life 3s
 g=glob();
 if(!/c:true/.test(g))fail('no live mosh globule: '+g);
 // reclaim completes (reclaim 10s from each cast) -> globules removed
 await adv(9000);
 g=glob();
 if(g!=='')fail('globules not cleared after reclaim: '+g+' vtxLive='+xe('vtxLive.length')+' ages='+xe('JSON.stringify(vtxLive.map(f=>[f.age,f.ttl]))')+' a18gl='+xe('JSON.stringify(J.a18gl||{})'));
 if(!xe('J.q>=1&&J.e>=1&&J.c>=1'))fail('charges not reclaimed: '+xe('JSON.stringify([J.c,J.q,J.e])'));
 if(fails.length)process.exit(1);
 console.log('PASS test_ka_globules');
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
