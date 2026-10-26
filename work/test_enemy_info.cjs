// Enemy info, as VALORANT (user 2026-10-26: "You shouldn't be able to spectate enemy or see what guns the enemy has"):
// the real page (page_harness, offline 5v5) shows of an ENEMY only agent, K / D / A, ult points and the credits they STARTED
// the round with - never their weapon, armor, HP or live credits:
//  - Tab scoreboard: enemy Loadout cell '—' (own team: weapon + shield), enemy Creds = the round-start figure taken just
//    before each bot shops (it stays put while the bots spend; own team's credits are live), ult pips present;
//  - spectate side panels (#xObs, dead + spectating, live round and buy phase): enemy rows have no weapon text, no HP / shield
//    bar and no credits; own rows keep theirs;
//  - online (server_runtime netFogPre / mpMkUnit, the TRUSTED ONLINE SERVER block): a hidden enemy row arrives with no
//    weapon ([11] = '', server fog.js fogRow) and the page keeps the gun it last saw (a new unit: Classic), never ''; the
//    server's round-start enemy credits (roundState.ec) are what the scoreboard shows.
const assert=require('assert/strict'),{boot}=require('./page_harness.cjs');
const H=boot({seed:5}),xe=H.xe,errs0=H.errors.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
(async()=>{
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 // a known round: everyone 4000 before shopping, then the bots shop (each fBotBuy reads its pre-buy credits)
 const r=JSON.parse(xe(`(()=>{for(const n in FV.bs)FV.bs[n].cr=4000;FV.ec=null;const T=sbTeams(),en=T[1],me=T[0].filter(n=>n!=='You');for(const n of en.concat(me)){const s=fBotBuy(n);FV.bs[n].w=s.w;FV.bs[n].arm=s.arm;}
  const u=bots.find(b=>b.name===en[0]);if(u){u.w='Operator';u.armor=50;}for(const n of en)FV.bs[n].cr=123;/* live enemy credits after buying: must not show */
  return JSON.stringify({en,me,ec:FV.ec,html:(board(),document.getElementById('xBoard').innerHTML)});})()`));
 assert.ok(r.en.length===5,'5 enemies '+JSON.stringify(r.en));
 for(const n of r.en)assert.equal(r.ec[n],4000,'round-start credits recorded for '+n+' '+JSON.stringify(r.ec));
 const rowOf=(html,n)=>{const i=html.indexOf('<td class="nm">'+n);assert.ok(i>0,'row '+n);const a=html.lastIndexOf('<tr',i),b=html.indexOf('</tr>',i);return html.slice(a,b);};
 for(const n of r.en){const row=rowOf(r.html,n);assert.match(row,/<td class="w"><span class="x-sbunknown">—<\/span><\/td>/,'enemy loadout hidden: '+n);assert.doesNotMatch(row,/Operator|x-sbshield|x-sbload/,'no enemy gun / shield: '+n);
  assert.match(row,/<td class="ec">4,000<\/td>/,'enemy creds = round start, not the live 123: '+n);assert.match(row,/class="x-sbp"/,'enemy ult pips shown');}
 for(const n of r.me){const row=rowOf(r.html,n);assert.match(row,/class="x-sbload"/,'own team loadout shown: '+n);}
 // a new round: the next shop records again
 const r2=JSON.parse(xe(`(()=>{FV.them++;const en=sbTeams()[1];for(const n of en){FV.bs[n].cr=900;fBotBuy(n);}return JSON.stringify(FV.ec);})()`));for(const n of r.en)assert.equal(r2[n],900,'next round recorded');
 // spectate side panels: dead + spectating, live round then buy phase
 const pan=buy=>JSON.parse(xe(`(()=>{FV.buy=${buy};allies.forEach(a=>{a.alive=true;a.hp=100;a.w='Vandal';a.armor=50});bots.forEach(b=>{b.alive=true;b.hp=100;b.w='Operator';b.armor=50});
  if(player.hp>0){player.hp=0;pDie(bots[0].name,'Vandal');}xSpec(2.1);xObsTick(true);const cols=document.querySelectorAll('#xObs .x-obc'),rd=c=>c.querySelectorAll('.x-obr').filter(x=>!x.hidden).map(x=>({n:x.querySelector('.x-obn').textContent,w:x.querySelector('.x-obw').textContent,cr:x.querySelector('.x-obcr').textContent,hp:parseFloat(x.querySelector('.hp').style.width)||0,sh:parseFloat(x.querySelector('.sh').style.width)||0,u:x.querySelectorAll('.x-obu i').length}));
  return JSON.stringify({on:document.getElementById('xObs').classList.contains('on'),al:rd(cols[0]),en:rd(cols[1]),sp:xKL.sp,cur:xKL.cur&&xKL.cur.name});})()`));
 for(const buy of [0,20]){const P=pan(buy);assert.ok(P.on,'panels up while spectating '+JSON.stringify(P).slice(0,200));assert.ok(P.cur&&!r.en.includes(P.cur),'spectating a teammate');
  assert.equal(P.en.length,5);for(const e of P.en)assert.ok(e.w===''&&e.hp===0&&e.sh===0&&e.cr===''&&e.u>0,'enemy panel row shows no gun / HP / shield / credits (buy '+buy+') '+JSON.stringify(e));
  assert.ok(P.al.some(a=>a.w==='Vandal'&&a.hp>0),'own team keeps weapon + HP '+JSON.stringify(P.al));}
 // online: a hidden row without its weapon; the round-start enemy credits from the server
 const o=JSON.parse(xe(`(()=>{const u={nid:4242,w:'Phantom',g:null};const e=[4242,1,'X','Jett',0,0,0,0,100,0,1,'',0,0,1,0,0,0,0,0,0,-1,1,0];const sock=NET.socket,b0=bots;NET.socket={};bots=b0.concat([u]);try{netFogPre({u:[e]});}finally{NET.socket=sock;bots=b0;}
  const f=[4243,1,'Y','Jett',0,0,0,0,100,0,1,'',0,0,1,0,0,0,0,0,0,-1,1,0];NET.socket={};try{netFogPre({u:[f]});}finally{NET.socket=sock;}return JSON.stringify([e[11],f[11]]);})()`));
 assert.deepEqual(o,['Phantom','Classic'],'hidden row: last seen gun kept, a new unit Classic, never empty');
 const ec=xe(`(()=>{const T=sbTeams()[1],n=T[0],m={b:0,tl:0};m.ec={};m.ec[n]=2400;const on=MP.on;try{mpCliRS(m);}catch(e){return 'threw '+e}return FV.ec[n]+'|'+sbCred(n,SB[n]||{});})()`);
 assert.equal(ec,'2400|2400','online: the server round-start credits (roundState.ec) shown');
 const errs=H.errors.slice(errs0);assert.equal(errs.length,0,'page errors '+JSON.stringify(errs.slice(0,3)));
 console.log('Enemy info: Tab enemy loadout hidden, enemy creds = round start (not live), ult pips kept; spectate panels show no enemy gun / HP / shield / credits; hidden online rows carry no weapon (page keeps the last seen gun); online round-start enemy credits shown');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
