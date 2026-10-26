// Offline friendly fire = the server's rule (server/src/abilities.js abilityDamage; wiki.playvalorant.com/en-us/Abilities:
// "abilities that damage allies deal 1/3 damage"; per ability "Affects allies/self?": Yes (damage reduced) for Paint Shells,
// Showstopper, Shock Bolt, Hot Hands, Blaze, Nanoswarm, Hunter's Fury, Aftershock ...; No for Boom Bot, Blast Pack, Turret).
// The real page (work/page_harness.cjs) in a live offline 5v5: the player's and the bots' damaging utility hit an ally for a
// third, never the caster; a teamkill is a death (victim's deaths +1, kill feed) with no kill, credits, ult point (either
// side), damage credit or TDM score for the caster. Also: bot damage is credited to the bot, not to "You" (the Alarmbot /
// Dismiss hurt wrapper dropped `by`). FFA Deathmatch: nobody is an ally.
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5}),xe=H.xe,errs0=H.errors.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
(async()=>{
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 // everyone in a 1.2 m cluster around the player (open floor: line of sight clear), full HP, no armor; frozen in place
 const J=o=>JSON.parse(xe('JSON.stringify('+o+')'));
 const setup=()=>xe(`(()=>{FV.buy=0;const P=player;P.hp=100;P.armor=0;const all=allies.concat(bots);all.forEach((u,i)=>{u.alive=true;u.hp=100;u.armor=0;u.ab=null;if(u.g){if(!u.g.parent)scene.add(u.g);u.g.position.set(P.x+0.4*((i%3)-1),u.g.position.y,P.z+0.4*(((i/3)|0)%3-1));}});
  sbReset(bots.map(b=>b.name),allies.map(a=>a.name));for(const k in xBotUC)delete xBotUC[k];F_EN.concat(F_MATES).forEach(n=>{if(FV.bs[n])FV.bs[n].cr=1000;});FV.cr=1000;J.ult=0;return 1;})()`);
 const st=()=>J(`{p:player.hp,a:allies.map(a=>[a.name,a.hp,a.alive]),b:bots.map(b=>[b.name,b.hp,b.alive]),sb:SB,uc:xBotUC,cr:FV.cr,bs:Object.fromEntries(Object.entries(FV.bs).map(([k,v])=>[k,v.cr])),ult:J.ult,k:stats.k,d:stats.d}`);
 const near=(a,b,m)=>assert.ok(Math.abs(a-b)<1e-6,m+': '+a+' vs '+b);
 // 1. the player's Paint Shells: enemies 55, allies a third, the player (caster) untouched
 setup();let s0=st();xe('rsBoom(new RV(player.x,0.6,player.z),4,55,"Paint Shells",0xffb21f);1');let s=st();
 s.b.forEach(b=>near(b[1],45,'player Paint Shells: enemy '+b[0]));s.a.forEach(a=>near(a[1],100-55/3,'player Paint Shells: ally '+a[0]+' takes a third'));near(s.p,100,'caster untouched');
 near(s.sb.You.dmg,55*s.b.length,'only the enemy damage is credited');
 // Blast Pack / Boom Bot: never allies (wiki: Affects allies/self? No)
 setup();xe('bots.forEach(b=>{b.hp=500});rsBoom(new RV(player.x,0.6,player.z),4,50,"Blast Pack",0xffb21f);rsBoom(new RV(player.x,0.6,player.z),1.5,80,"Boom Bot",0xff8a1f);1');s=st();s.a.forEach(a=>near(a[1],100,'Blast Pack / Boom Bot: ally '+a[0]+' untouched'));assert.ok(xe('running'),'round still live');
 // 2. the player's teamkill: a death for the ally, no kill / credits / ult point for the player
 setup();xe('allies[0].hp=10;1');s0=st();const mate=s0.a[0][0];xe('rsBoom(new RV(player.x,0.6,player.z),4,55,"Paint Shells",0xffb21f);1');s=st();
 assert.equal(s.a[0][2],false,'the ally dies');assert.equal(s.sb[mate].d,1,'victim deaths +1');assert.equal(s.sb.You.k,0,'no scoreboard kill');assert.equal(s.k,s0.k,'no player kill stat');
 assert.equal(s.cr,s0.cr,'no kill credits for the player');assert.equal(s.ult,s0.ult,'no ult point for the teamkill');assert.equal(s.uc[mate]||0,0,'no death ult point for the teamkilled bot');
 assert.ok(xe('[...document.getElementById("feed").children].some(d=>/'+mate+'/.test(d.textContent))'),'the teamkill reaches the kill feed');
 // 3. a bot's Paint Shells (xAoe): its own team takes a third, the caster none; the other team full
 setup();const c=s0.b[0][0];xe(`xAoe(bots[0],new RV(player.x,0.6,player.z),5,55,"Paint Shells");1`);s=st();
 near(s.b[0][1],100,'bot caster untouched');s.b.slice(1).forEach(b=>near(b[1],100-55/3,'bot Paint Shells: teammate '+b[0]+' a third'));near(s.p,45,'enemy player full');s.a.forEach(a=>near(a[1],45,'enemy ally full'));
 assert.ok(s.sb[c].dmg>=55*(1+s.a.length)-1e-6&&s.sb[c].dmg<=55*(1+s.a.length)+1e-6,'bot damage credited to the bot: '+s.sb[c].dmg);near(s.sb.You.dmg,0,'none of it credited to You');
 // bot teamkill: no credits, ult point or kill for the caster; no death ult point for the victim
 setup();xe('bots[1].hp=10;1');s0=st();const v=s0.b[1][0];xe(`xAoe(bots[0],new RV(player.x,0.6,player.z),5,55,"Showstopper");1`);s=st();
 assert.equal(s.b[1][2],false,'bot teammate dies');assert.equal(s.sb[c].k,0,'no kill for the bot');assert.equal(s.sb[v].d,1,'victim death counted');
 assert.equal(s.bs[c],s0.bs[c],'no kill credits for the bot');assert.equal(s.uc[c]||0,0,'no ult point for the bot');assert.equal(s.uc[v]||0,0,'no death ult point for the victim');
 // 4. an ally bot's utility kills the player: a death with no ult point for the player and no credits for the ally
 setup();xe('player.hp=10;1');s0=st();const am=s0.a[0][0];xe(`xAoe(allies[0],new RV(player.x,0.6,player.z),5,55,"Paint Shells");1`);s=st();
 assert.ok(s.p<=0,'player dies');assert.equal(s.d,s0.d+1,'player death counted');assert.equal(s.ult,s0.ult,'no death ult point (teamkill)');assert.equal(s.bs[am],s0.bs[am],'no credits for the ally');assert.equal(s.sb[am].k,0,'no kill for the ally');
 xe('player.hp=100;1');
 // 5. other casts: player Hot Hands zone / Nanoswarm / Shock Bolt share the rule (one tick each)
 setup();xe(`(()=>{const P=player;J.zones=J.zones||[];J.nanos=J.nanos||[];return 1})()`);
 const fx=xe(`(()=>{const o=[];const z={p:new RV(player.x,0,player.z),t:2,m:{material:{opacity:1}}};const A0=allies[0].hp;xFFArea("You",false,"Hot Hands",60*0.1,(x,q)=>Math.hypot(x-z.p.x,q-z.p.z)<2.5);o.push(A0-allies[0].hp);
  const A1=allies[0].hp;xFFArea("You",false,"Nanoswarm",4.5,(x,q)=>Math.hypot(x-z.p.x,q-z.p.z)<2.5);o.push(A1-allies[0].hp);const A2=allies[0].hp;xFFArea("You",false,"Turret",12,()=>true);o.push(A2-allies[0].hp);return JSON.stringify(o)})()`);
 const [hh,nn,tu]=JSON.parse(fx);near(hh,2,'Hot Hands tick 6 -> 2 to an ally');near(nn,1.5,'Nanoswarm 4.5 -> 1.5');near(tu,0,'Turret never hits allies');
 // the wiring: every damaging cast has its ally pass
 const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
 for(const w of ['"Hunter\'s Fury", XHFU.dmg','"Blaze", XBLZ.damage * dt','"Hot Hands", 60 * dt','"Shock Bolt", F.max','"Nanoswarm", XNANO.dps * dt','"Aftershock", 80','"Nanoswarm", 4.5'])assert.ok(html.includes('xFFArea("You", false, '+w)||html.includes(', '+w+', (x, z)')||html.includes('en, '+w),'ally pass for '+w);
 assert.ok(/xFFArea\(b, en, w, n,/.test(html)&&/xFFArea\(u, en, "Hunter's Fury", XHFU\.dmg/.test(html)&&/xFFArea\(o\.own, o\.en, w, n,/.test(html),'bot area / bot Hunter\'s Fury / P2P host ally passes');
 // 6. FFA Deathmatch: no allies
 assert.equal(xe('(()=>{const d=FV.dm,t=FV.tdm;FV.dm=true;FV.tdm=false;const n=xMates("You").length+xMates(bots[0]).length;FV.dm=d;FV.tdm=t;return n})()'),0,'FFA: nobody is an ally');
 assert.equal(H.errors.length,errs0,'page errors: '+H.errors.slice(errs0).join(' | '));
 console.log('Offline friendly fire: player and bot utility hit allies for a third (never the caster; not Boom Bot / Blast Pack / Turret); teamkills: death only, no kill / credits / ult point / damage credit; bot damage credited to the bot; FFA none');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
