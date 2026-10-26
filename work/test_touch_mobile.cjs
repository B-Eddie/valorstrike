// Mobile HUD redesign (touch layer #xT): few buttons, context buttons only when they do something, nothing over the
// crosshair / centre or the HUD panels.
//  A. layout math (lay() / wsLay() from index.html) at landscape phones 844x390, 932x430 (with and without notch insets) and
//     tablets 1024x768, 1180x820: every control and the weapon strip clear of each other, of the minimap, top bar, subtitle,
//     kill feed, health, credits + ammo and the crosshair, and out of the centre band. HUD rects are the coarse-pointer
//     rects measured in Chromium (work/browser_mobile_hud.cjs, before / after json in the project qa/mobile notes); the CSS
//     rules they come from are asserted below so a HUD move fails here.
//  B. the real page on a coarse pointer (work/page_harness.cjs): an offline 5v5 round start shows at most 9 buttons when
//     idle (10 in the buy phase: + BUY), RELOAD only with a partial magazine, INSPECT for a moment after a weapon switch,
//     USE / PLANT only near something, the weapon strip switches guns, the menu opens without pausing and holds
//     scoreboard / settings, the left FIRE / size / opacity settings apply.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fails=[],out=[];const check=(n,ok,d)=>{out.push((ok?'ok   ':'FAIL ')+n+(d?' ('+d+')':''));if(!ok)fails.push(n+(d?': '+d:''));};
// ---- A. layout math ----
{const a=html.indexOf('  const SV = (d) =>'),b=html.indexOf('  reset();',a);assert(a>0&&b>a,'layout section');
 const c={innerWidth:844,innerHeight:390,Math,Object,String,TO:{sz:1,op:.8,f2:false,cm:false}};vm.createContext(c);
 vm.runInContext(html.slice(a,b).replace(/\bconst (TB|DEF|DEFP|LAND|lay|wsLay|fit|reset|unit) =/g,'var $1 =').replace('let custom','var custom')+';globalThis.get=()=>L;globalThis.setSA=v=>{SA=v;};',c);
 // CSS the HUD rects come from (pointer: coarse block)
 assert(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'),'viewport-fit=cover');
 for(const r of ['#xMap,#game.x-mm #fps{margin:var(--sa-t) 0 0 var(--sa-l)}','#game .hud.x-top{margin:var(--sa-t) var(--sa-r) 0 0}','#game #xSub{margin-top:var(--sa-t)}','#game .hud.x-fw{margin:var(--sa-t) var(--sa-r) 0 0}','#game .hud.x-bl{margin-left:var(--sa-l)}','#game .x-brs{margin-right:var(--sa-r)}','@media (orientation:portrait){#game .hud.x-bl,#game .x-brs{margin-bottom:var(--sa-b)}}','#lobby{padding:var(--sa-t) var(--sa-r) var(--sa-b) var(--sa-l)}','--sa-l:env(safe-area-inset-left,0px)'])assert(html.includes(r),'safe-area rule missing: '+r);
 for(const r of ['#xMap{left:8px;top:8px;width:96px;height:96px}','#game .hud.x-fw{top:64px;right:8px}','#game .hud.x-bl{left:8px;bottom:8px;transform:none;min-width:128px;height:48px;','#game .x-brs{right:4px;bottom:4px}','#game .hud.x-br{height:44px;padding:4px 8px;max-width:150px}'])assert(html.includes(r),'HUD rule moved: '+r);
 const hud=(w,h)=>({minimap:[8,8,104,104],top:h<=560?[w-388,8,w-8,40]:[w/2-190,8,w/2+190,40],sub:[w/2-171,48,w/2+171,63],feed:h<=480?[w-308,64,w-8,92]:[w-308,64,w-8,190],health:[8,h-56,136,h-8],ammo:[w-91,h-73,w-4,h-4],crosshair:[w/2-24,h/2-24,w/2+24,h/2+24]});
 const ov=(p,q,g=0)=>p[0]<q[2]+g&&q[0]<p[2]+g&&p[1]<q[3]+g&&q[1]<p[3]+g;
 for(const [w,h,sa] of [[844,390],[932,430],[844,390,{l:47,r:47,t:0,b:21}],[932,430,{l:59,r:59,t:0,b:21}],[852,393,{l:59,r:59,t:0,b:21}],[812,375,{l:44,r:44,t:0,b:21}],[1024,768],[1180,820]]){
  const tag=w+'x'+h+(sa?' notch':'');c.innerWidth=w;c.innerHeight=h;c.setSA(sa||{l:0,r:0,t:0,b:0});c.reset();const L=c.get(),R={};
  for(const k in L){const p=L[k],x=p.x*w/100,y=p.y*h/100,r=p.s/2;R[k]=[x-r,y-r,x+r,y+r];}
  const ws=c.wsLay(w,h,sa);R.strip=[w-ws.r-(3*ws.m+8),h-ws.b-ws.h,w-ws.r,h-ws.b]; // widest strip: 3 chips at max width
  const H=hud(w,h);if(sa){const mv=(k,dx,dy)=>{const q=H[k];H[k]=[q[0]+dx,q[1]+dy,q[2]+dx,q[3]+dy];};mv('minimap',sa.l,sa.t);mv('top',h<=560?-sa.r:0,sa.t);mv('sub',0,sa.t);mv('feed',-sa.r,sa.t);mv('health',sa.l,0);mv('ammo',-sa.r,0);} // viewport-fit=cover: the HUD panels move in by the safe-area insets (margins below)
  let bad=[];for(const k in R)for(const n in H)if(ov(R[k],H[n],2))bad.push(k+'/'+n);
  check(tag+': controls clear of minimap, top bar, subtitle, kill feed, health, ammo, crosshair',!bad.length,bad.join(' '));
  const S0=sa||{l:0,r:0},sw=w-S0.l-S0.r,cz=[S0.l+0.3*sw,0.22*h,S0.l+0.7*sw,0.78*h];bad=Object.keys(R).filter(k=>ov(R[k],cz));check(tag+': centre band clear',!bad.length,bad.join(' '));
  bad=[];const ks=Object.keys(R),circ=(p,q)=>Math.hypot((p.x-q.x)*w/100,(p.y-q.y)*h/100)<(p.s+q.s)/2+4;for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const A=ks[i],Bk=ks[j];if(A==='strip'||Bk==='strip'?ov(R[A],R[Bk],2):circ(L[A],L[Bk]))bad.push(A+'/'+Bk);}check(tag+': no two controls (or the strip) overlap',!bad.length,bad.join(' '));
  const sz=Object.fromEntries(Object.keys(L).map(k=>[k,L[k].s]));check(tag+': FIRE the biggest button, utility buttons small',Object.keys(sz).every(k=>k==='fire'||sz[k]<sz.fire)&&sz.menu<=sz.fire/2+6&&sz.reload<sz.jump,JSON.stringify(sz));
  check(tag+': abilities in an arc above FIRE',['c','q','e','x'].every(k=>L[k].y<L.fire.y&&Math.abs(Math.hypot((L[k].x-L.fire.x)*w/100,(L[k].y-L.fire.y)*h/100)-112*c.unit(h))<1.5));
 }
 // size setting scales the defaults
 c.innerWidth=844;c.innerHeight=390;c.setSA({l:0,r:0,t:0,b:0});c.TO.sz=1.2;c.reset();check('size 120%: FIRE 86 px',c.get().fire.s===86,String(c.get().fire.s));c.TO.sz=1;c.reset();}
// ---- B. the real page ----
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:7,coarse:true}),xe=H.xe,errs0=H.errors.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async()=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const T=()=>H.$('xT'),btn=k=>H.doc.querySelector(`#xT .tb[data-k="${k}"]`),shownB=()=>[...H.doc.querySelectorAll('#xT .tb')].filter(b=>!b.classList.contains('hid')&&!b.classList.contains('off')).map(b=>b.dataset.k);
const pd=(el,id,x=600,y=200)=>H.dispatch(el,H.mkEvent('pointerdown',{pointerId:id,clientX:x,clientY:y,pointerType:'touch'}));const pu=id=>H.dispatch(T(),H.mkEvent('pointerup',{pointerId:id,pointerType:'touch'}));
const freeze='for(const b of bots)b.nt=true;for(const a of allies)a.nt=true;player.hp=100;player.vx=player.vz=0;true';
(async()=>{
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');xe(freeze);
 xe('FV.buy=Math.max(FV.buy,20);buyMenu(false);true');await adv(300);
 const buy=shownB();check('touch layer on in the round',T().classList.contains('on'));
 check('buy phase (menu closed): at most 10 buttons, BUY among them',buy.length<=10&&buy.includes('buy'),buy.join(','));
 xe('FV.buy=0;buyMenu(false);'+freeze);await adv(300);
 const idle=shownB();check('live round start, idle: at most 9 buttons',idle.length<=9,idle.length+': '+idle.join(','));
 for(const k of ['buy','plant','use','inspect','reload','drills','fire2'])check(k+' hidden at idle round start',!idle.includes(k));
 for(const k of ['fire','jump','duck','zoom','c','q','e','x','menu'])check(k+' shown at idle round start',idle.includes(k));
 check('old always-on buttons gone (pause / swap / ping are in the menu or the strip)',!btn('pause')&&!btn('swap')&&!btn('ping'));
 check('COMMS floating button collapsed by default',H.doc.documentElement.classList.contains('xt-nocm'));
 // weapon strip
 const chips=()=>[...H.doc.querySelectorAll('#xTW button')].map(b=>b.dataset.w+(b.classList.contains('on')?'*':''));
 check('weapon strip lists the loadout with the gun in hand marked',chips().some(s=>/\*$/.test(s))&&chips().includes('knife'),chips().join(','));
 // reload: only with a partial magazine
 xe('ammo=Math.max(1,ammo-3);true');await adv(200);check('RELOAD appears with a partial magazine',!btn('reload').classList.contains('hid'));
 pd(btn('reload'),21);pu(21);await adv(100);check('RELOAD starts a reload',xe('reloading>0'));
 xe('reloading=0;ammo=MAG();true');await adv(200);check('RELOAD hidden again with a full magazine',btn('reload').classList.contains('hid'));
 // tap the knife chip: knife in hand, ADS hidden, INSPECT for a moment
 const kb=H.doc.querySelector('#xTW button[data-w="knife"]');pd(kb,22);pu(22);await adv(200);
 check('tapping Knife in the strip switches to the knife',xe('rw')==='knife',xe('rw'));check('ADS hidden on the knife',btn('zoom').classList.contains('hid'));
 check('INSPECT shows after a weapon switch',!btn('inspect').classList.contains('hid'));await adv(3300);check('INSPECT gone 3 s later',btn('inspect').classList.contains('hid'));
 const pb=H.doc.querySelector('#xTW button[data-w="pis"]')||H.doc.querySelector('#xTW button[data-w="pri"]');pd(pb,23);pu(23);await adv(200);check('tapping the gun switches back',xe('rw')===pb.dataset.w,xe('rw'));
 // USE context: a floor gun under the crosshair shows the pick-up prompt
 xe('xdPrompt=function(){};true');xe('(function(){let e=document.getElementById("xdPrompt");if(!e){e=document.createElement("div");e.id="xdPrompt";document.body.appendChild(e);}e.style.display="flex";})();true');await adv(200);
 const useShown=!btn('use').classList.contains('hid');xe('document.getElementById("xdPrompt").style.display="none";true');await adv(200);
 check('USE appears with the pick-up prompt',useShown);check('USE hidden with nothing to use',btn('use').classList.contains('hid'));
 // menu: opens over the live round (no pause), scoreboard toggles, settings pauses
 pd(btn('menu'),24);pu(24);await adv(100);check('menu opens without pausing',T().classList.contains('mo')&&!xe('paused'));
 const mb=m=>H.doc.querySelector(`#xTM button[data-m="${m}"]`);pd(mb('board'),25);await adv(100);check('menu Scoreboard shows the board and closes the menu',H.$('xBoard').classList.contains('on')&&!T().classList.contains('mo'));
 pd(btn('menu'),26);pu(26);pd(mb('board'),27);await adv(100);check('second Scoreboard tap hides it',!H.$('xBoard').classList.contains('on'));
 pd(btn('menu'),28);pu(28);await adv(50);pd(H.$('xT'),29,500,200);pu(29);await adv(50);check('a touch elsewhere closes the menu',!T().classList.contains('mo'));
 pd(btn('menu'),30);pu(30);pd(mb('comms'),31);await adv(100);check('menu toggles the COMMS button',!H.doc.documentElement.classList.contains('xt-nocm'));pd(btn('menu'),32);pu(32);pd(mb('comms'),33);await adv(50);
 pd(btn('menu'),34);pu(34);pd(mb('set'),35);await adv(200);check('menu Settings pauses',xe('paused'));
 // settings: left FIRE, opacity, size
 H.$('xTf2').querySelector('button[data-v="1"]').click();H.$('sTo').value='50';H.$('sTo').oninput({target:H.$('sTo')});
 xe('closeAll&&closeAll();paused=false;true');try{xe('resume&&resume()');}catch(e){}xe('paused=false;'+freeze);await adv(300);
 check('Left FIRE setting shows the left FIRE button',!btn('fire2').classList.contains('hid'),shownB().join(','));
 check('opacity setting applies',String(T().style.getPropertyValue?T().style.getPropertyValue('--xto'):'')==='0.5'||/0\.5/.test(T().style.cssText||''),T().style.cssText);
 check('settings saved',/"f2":true/.test(String(H.win.__ls.getItem('vs.thud'))),String(H.win.__ls.getItem('vs.thud')));
 {const e=H.errors.slice(errs0);if(e.length)fails.push('page exceptions: '+JSON.stringify(e.slice(0,4)));}
 if(process.env.VERBOSE||fails.length)console.log(out.join('\n'));
 if(fails.length){console.error(fails.join('\n'));process.exit(1);}
 console.log('Touch mobile HUD: '+out.length+' checks: idle round start '+idle.length+' buttons ('+idle.join(' ')+'), buy phase '+buy.length+'; no overlap at 844x390 / 932x430 (+notch) / 1024x768 / 1180x820; context buttons, weapon strip, menu, settings');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
