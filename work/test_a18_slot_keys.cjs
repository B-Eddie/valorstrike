// Weapon slot keys and reload for the 18 agents (owner bug: "Hush cannot switch guns or melee"). The agents18 jKey wrapper used to
// answer every key for its agents offline (returning true swallowed 1/2/3 and R) and a18Key read any non-C/Q/E code as the ult.
// For each of the 18 agents plus a Jett control, on the real page (work/page_harness.cjs): with the ult fully charged and every
// ability charge up, 3 -> knife, 2 -> pistol, 1 -> primary, and R on a part-empty mag starts a reload; no ult point or charge is spent.
//   node work/test_a18_slot_keys.cjs     (in test_all)
const {boot}=require('./page_harness.cjs');
const fails=[];const fail=s=>fails.push(s);const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m+': got '+JSON.stringify(a)+' want '+JSON.stringify(b));};
(async()=>{
 const H=boot({real3:true,seed:3}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);xe('FV.buy=0;FV.menu=false;true');await adv(300);
 if(!xe('running&&mode==="five"'))fail('match did not start');
 const agents=['Jett'].concat(xe('[...A18SET]'));eq(agents.length,19,'18 agents + Jett control');
 const press=async(code)=>{H.key(code,true);await adv(60);H.key(code,false);await adv(500);};
 for(const ag of agents){
  xe(`J.pick=${JSON.stringify(ag)};J.a18=null;J.eq=null;player.hp=100;FV.buy=0;FV.menu=false;FV.pri=FV.pri||"Vandal";J.ult=K().u;J.c=J.q=J.e=2;J.cd={c:0,q:0,e:0,x:0};true`);
  if(ag!=='Jett')xe('a18Reset();true');
  const ch0=xe('[J.ult,J.c,J.q,J.e]');
  await press('Digit3');eq(xe('rw'),'knife',ag+': 3 -> knife');
  await press('Digit2');eq(xe('rw'),'pis',ag+': 2 -> pistol');
  await press('Digit1');eq(xe('rw'),'pri',ag+': 1 -> primary');
  xe('reloading=0;ammo=1;rsv=Math.max(rsv,30);true');await press('KeyR');if(!(xe('reloading')>0||xe('ammo')>1))fail(ag+': R starts a reload (reloading '+xe('reloading')+', ammo '+xe('ammo')+')');
  eq(xe('[J.ult,J.c,J.q,J.e]'),ch0,ag+': slot keys / reload spend no ult point or charge');
  eq(xe('!!J.eq'),false,ag+': no ability equipped by slot keys');
 }
 const errs=H.errors.filter(e=>!/\[object Object\]/.test(String(e)));if(errs.length)fail('page errors: '+errs.slice(0,3).map(String).join(' | '));
 if(fails.length){console.log(fails.join('\n'));process.exit(1);}
 console.log('slot keys 1/2/3 + reload: '+agents.length+' agents (18 + Jett control) switch weapons and reload, no ult or charge spent');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
