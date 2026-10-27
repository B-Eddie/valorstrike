// Kill feed shows kills only, like Valorant (user 19:51 2026-10-26: "kill feed shows ability activations; Valorant doesn't").
// Valorant's top-right feed lists kills: killer, weapon or killing-ability icon, headshot / wallbang marks, own kills
// highlighted (and since patch 12.05 the assisting agent + ability icon, own team only). Ability casts never appear.
// Boots the real page (work/page_harness.cjs), starts an offline 5v5 and checks:
//  * every ability line the page posts ("Agent ▸ Ability", "Lockdown ▸ ... detained", "Trailblazer ▸ ...", "Resurrection ▸ ...",
//    the online cast line ag + " ▸ " + nm) adds no kill-feed row
//  * plain notes (pickups, Spike, comms, joins) also stay out of the kill feed; they go to the small system log (#xLog)
//  * a real kill (the player shooting a bot dead) still posts a kill row, mine-highlighted, and a teammate's kill too
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const H=boot({real3:true,seed:5}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const rows=()=>xe('JSON.stringify([...document.getElementById("feed").children].map(d=>({c:d.className,t:d.textContent})))');
(async()=>{
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'offline 5v5 started');xe('FV.buy=0.05;true');await adv(1500);
 xe('bots.forEach(b=>{b.cd=1e9});allies.forEach(a=>{a.cd=1e9});[...document.getElementById("feed").children].forEach(d=>kfRel(d));true');
 // every literal ability line in the page source, plus the dynamic ones
 const lit=[...new Set([...html.matchAll(/(?<![\w.])feed\("([^"]*▸[^"]*)"\)/g)].map(m=>m[1]))];
 assert.ok(lit.length>=30,'ability feed lines found in the page: '+lit.length);
 const bot=xe('bots[0].name'),mate=xe('allies[0].name');
 const dyn=['Jett ▸ Updraft','Sova ▸ Recon Bolt','Lockdown ▸ '+bot+' detained','Trailblazer ▸ '+bot+', '+mate,'Resurrection ▸ '+mate,'Resurrection ▸ You',(mate)+' ▸ Run It Back','Killjoy ▸ Turret destroyed'];
 const notes=['Picked up Vandal','Spike dropped',mate+' picked up the Spike','You (Jett): Need backup','Team: rotating','Ability charges refilled',mate+' joined'];
 for(const t of lit.concat(dyn,notes))xe('feed('+JSON.stringify(t)+');true');
 const after=JSON.parse(rows());assert.deepEqual(after,[],'ability lines / notes reached the kill feed: '+JSON.stringify(after.slice(0,5)));
 const log=xe('(()=>{const L=document.getElementById("xLog");return L?[...L.children].map(d=>d.textContent).join(" | "):null})()');
 assert.ok(log&&/picked up the Spike|joined|rotating/.test(log),'plain notes go to the system log: '+log);
 assert.ok(!/Updraft|Recon Bolt|detained|Trailblazer|Resurrection/.test(log),'ability casts are not logged anywhere: '+log);
 // a real kill: the player shoots a bot dead
 const place=`(()=>{const b=bots.find(x=>x.alive);window.__qaB=b;b.hp=1;b.armor=0;player.hp=100;yaw=0;pitch=0;
  b.g.position.set(player.x,player.y||0,player.z-8);b.g.updateMatrixWorld(true);camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(0,0,0,"YXZ");camera.updateMatrixWorld(true);
  ammo=30;reloading=0;fcd=0;VM.sw=0;try{spray=0;}catch(e){}return b.name;})()`;
 const vn=xe(place);xe('shoot(false);true');assert.equal(xe('__qaB.alive'),false,'bot killed');
 const k=JSON.parse(rows());assert.equal(k.length,1,'one kill row: '+JSON.stringify(k));assert.ok(/kf--k/.test(k[0].c)&&/kf--mine/.test(k[0].c)&&k[0].t.includes(vn),'own kill row, highlighted: '+JSON.stringify(k[0]));
 // a teammate's kill line still posts
 const v2=xe('bots.find(x=>x.alive).name');xe('feed('+JSON.stringify(mate+' ▸ '+v2)+');true');const k2=JSON.parse(rows());assert.equal(k2.length,2,'teammate kill row');assert.ok(/kf--k/.test(k2[0].c)&&!/kf--mine/.test(k2[0].c));
 console.log('Kill feed: '+lit.length+' page ability lines + '+dyn.length+' dynamic casts + '+notes.length+' notes post no kill-feed row (notes go to #xLog); own and teammate kills still post (own highlighted)');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
