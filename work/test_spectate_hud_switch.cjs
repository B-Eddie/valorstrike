// Spectator HUD + target switching after the player's death (user 2026-10-29: "after i die, it sometimes shows the HUD from
// right when i died when im spectating and i cant switch spectating other players"). Real page (work/page_harness.cjs),
// offline 5v5, two living teammates told apart by health / armour / gun / agent:
//  1. a normal death (pDie): after the 2 s killed-by card the HUD is the followed teammate's live state (health, armour,
//     gun, magazine, their agent's ability bar), left click = next teammate, right click = previous, Space = next, the HUD
//     follows the switch at once; the followed teammate dies -> the next living one, HUD follows; never the player's own
//     values from the death frame.
//  2. the death message ahead of the death (online: the server's kill event can reach the page while its own row still
//     says alive - the render pass saw spectate state + hp > 0 and reset it, then the death came with no spectate state:
//     the camera still followed a teammate through xSpecPick, but xKL.sp stayed false, so the HUD wrapper / POV / click
//     handlers - all gated on xKL.sp - showed the frozen own HUD and ignored clicks). Must still end up spectating
//     properly: HUD = teammate, clicks switch.
//  3. a death that brings no kill message at all (hp 0 only, e.g. a lost / unattributed kill event): same.
//   node work/test_spectate_hud_switch.cjs
const {boot}=require('./page_harness.cjs');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{
 const H=boot({real3:true,seed:5}),xe=H.xe,errs0=H.errors.length;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 ok(xe('running&&player.hp>0'),'no live round');
 // a fixed scene: two teammates far from three frozen enemies; nobody can hurt anybody; the round clock held
 const setup=()=>xe(`(()=>{bots.forEach((b,i)=>{b.alive=true;b.hp=100;b.det=1e9;b.g.position.set(player.x+60+i*3,b.g.position.y,player.z+60);});
  allies.forEach((a,i)=>{a.alive=i<2;a.hp=i<2?[37,88][i]:0;a.armor=[25,50,0,0][i];a.w=["Spectre","Ghost","Classic","Classic"][i];a.xAm=null;a.det=1e9;a.g.position.set(player.x+2+i*2,a.g.position.y,player.z+1);});
  if(!window.__hu){window.__hu=hurt;hurt=function(t,n,by){if(t===player)return __hu.apply(this,arguments);return 0;};}
  player.hp=100;player.armor=50;timeLeft=999;ammo=7;rsv=21;return 1})()`);
 const hud=()=>JSON.parse(xe(`JSON.stringify({sp:!!xKL.sp,on:!!xKL.on,cur:xKL.cur?xKL.cur.name:null,fp:XOB.fp?XOB.fp.name:null,hp:$("xHp").textContent,arm:$("xArm").textContent,wn:$("xWn").textContent,mag:$("xMag").textContent,rs:$("xRs").textContent,ab:$("xAb").getAttribute("aria-label")||"",abOn:$("xAb").classList.contains("on"),label:xKL.sn?xKL.sn.textContent:""})`));
 const want=n=>JSON.parse(xe(`(()=>{const a=allies.find(x=>x.name===${JSON.stringify(n)});const A=xbAm(a);let ag="";try{ag=xspvAgent(a)}catch(e){}return JSON.stringify({hp:String(Math.ceil(a.hp)),arm:String(Math.ceil(a.armor)),wn:a.w,mag:String(A.mag),rs:String(A.res),ag})})()`));
 const hudIs=(tag,n)=>{const h=hud(),w=want(n);const good=h.sp&&h.cur===n&&h.fp===n&&h.hp===w.hp&&h.arm===w.arm&&h.wn===w.wn&&h.mag===w.mag&&h.rs===w.rs&&h.ab.indexOf(w.ag)===0&&h.abOn;ok(good,tag+': HUD = '+n+'\'s live state '+JSON.stringify({h,w}));return h;};
 const names=()=>xe('JSON.stringify(allies.slice(0,2).map(a=>a.name))');const [n0,n1]=JSON.parse(names());
 const click=async b=>{H.mouse(b,true);H.mouse(b,false);await adv(100);};
 const cycle=async(tag)=>{let h=hud();const first=h.cur;ok(first===n0||first===n1,tag+': following a teammate '+JSON.stringify(h));if(!(first===n0||first===n1))return;const other=first===n0?n1:n0;
  hudIs(tag+' first',first);
  await click(0);hudIs(tag+' left click -> next',other);
  await click(2);hudIs(tag+' right click -> previous',first);
  H.key('Space',true);H.key('Space',false);await adv(100);hudIs(tag+' Space -> next',other);
  xe(`allies.find(x=>x.name===${JSON.stringify(other)}).hp=61`);await adv(100);hudIs(tag+' live health',other);};
 // ---- 1. normal death ----
 setup();xe('hurt(player,500,bots[0].name);pDie(bots[0].name,"Vandal");true');await adv(2600);
 await cycle('normal death');
 { const h=hud();xe(`(()=>{const a=allies.find(x=>x.name===${JSON.stringify(h.cur)});allyDie(a,bots[0].name,"Vandal");return 1})()`);await adv(300);const left=h.cur===n0?n1:n0;hudIs('followed teammate died -> next living',left);
   await click(0);hudIs('one teammate left: click stays on them',left); }
 // ---- 2. the kill message ahead of the death ----
 xe('player.hp=100;xKLReset();true');setup();await adv(200);
 xe('xKLDie(bots[0].name,"Vandal");true');await adv(100);/* the page's own row still alive for a few frames */xe('player.hp=0;true');await adv(2600);
 await cycle('kill message ahead of the death');
 // ---- 3. no kill message ----
 xe('player.hp=100;xKLReset();true');setup();await adv(200);
 xe('player.hp=0;true');await adv(2600);
 await cycle('death without a kill message');
 // alive again: own HUD back
 xe('player.hp=100;xKLReset();true');setup();await adv(200);{const h=hud();ok(!h.sp&&h.hp==='100'&&h.mag==='7'&&h.ab.indexOf('Jett')===0,'alive again: the player\'s own HUD '+JSON.stringify(h));}
 if(H.errors.length>errs0)fails.push('page errors: '+H.errors.slice(errs0).map(e=>String(e&&e.msg||e).slice(0,160)).join(' | '));
 if(fails.length){console.error('FAIL:\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Spectator HUD = the followed teammate\'s live health / armour / gun / magazine / reserve / ability bar; left / right click and Space cycle teammates every time (normal death, kill message ahead of the death, death without a kill message, followed teammate dying); own HUD back on respawn');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
