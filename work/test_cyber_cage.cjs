// Cypher Cyber Cage offline (index.html cyKey Q / cyCage*), native Ascent. Valorant (wiki.playvalorant.com/en-us/Cyber_Cage): Q INSTANTLY
// tosses the cage as a projectile; it lands on the floor and waits, inactive, until Cypher activates it: Q while looking at a placed cage
// activates it (no charge spent) - the 3.72 m / 7.25 s hollow cylinder; with no charge left Q activates the cage nearest the crosshair.
// Was: Q equipped, FIRE placed an already-active cage 15 m ahead. Same rule as the server (server/test-cage.js, abilities.js cageCast).
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Cypher'),'offline 5v5 started');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});true');
 assert.equal(xe('!!(XAB_EQ.Cypher&&XAB_EQ.Cypher.q)'),false,'Cyber Cage is an instant toss, not equip-then-fire');
 const cages=()=>xe('(J.cyc||[]).map(c=>({x:+c.p.x.toFixed(2),y:+c.p.y.toFixed(2),z:+c.p.z.toFixed(2),landed:!!c.landed}))'),cyl=()=>xe('J.smokes.filter(s=>s.cyl).length');
 const look=c=>xe(`(()=>{const o=pEye();const dx=${c.x}-o.x,dy=${c.y}+0.2-o.y,dz=${c.z}-o.z;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));return true;})()`);
 // 1. Q tosses at once (charge spent, nothing active); it lands on the floor in front and waits
 xe('J.q=2;J.cd.q=0;pitch=0;true');const n0=cyl(),y0=xe('yaw'),p0=xe('({x:player.x,z:player.z})');await tap('KeyQ');
 assert.equal(xe('J.q'),1,'toss spends a charge at once');assert.equal(cyl(),n0,'not active in flight');let c=cages();assert.equal(c.length,1,'one cage');assert.equal(c[0].landed,false,'in flight');
 await adv(2000);c=cages();assert.equal(c[0].landed,true,'landed');const fl=xe(`groundAt(${c[0].x},${c[0].z},0.2,player.y+1)`);assert.ok(Math.abs(c[0].y-fl)<.1,'on the floor: '+c[0].y+' vs '+fl);
 const d=Math.hypot(c[0].x-p0.x,c[0].z-p0.z),fwd=(c[0].x-p0.x)*-Math.sin(y0)+(c[0].z-p0.z)*-Math.cos(y0);assert.ok(d>1.5&&d<15&&fwd>1,'in front: '+d.toFixed(2)+' m');
 await adv(5000);assert.equal(cyl(),n0,'stays inactive');
 // 2. look at it, Q: active cylinder at the cage, no charge spent, cage used up
 look(c[0]);xe('J.cd.q=0;true');await tap('KeyQ');assert.equal(xe('J.q'),1,'activation spends nothing');assert.equal(cyl(),n0+1,'active');assert.equal(cages().length,0,'used');
 const s=xe(`(()=>{const s=J.smokes.filter(s=>s.cyl).pop();return [+s.p.x.toFixed(2),+s.p.z.toFixed(2),s.r,+s.t.toFixed(2)];})()`);assert.ok(Math.hypot(s[0]-c[0].x,s[1]-c[0].z)<.05,'at the cage: '+JSON.stringify([s,c[0]]));assert.equal(s[2],3.72);assert.ok(s[3]>7&&s[3]<=7.25,'7.25 s');
 // 3. looking away with a charge: Q tosses another; with none left Q activates the nearest to the crosshair
 xe('J.smokes.forEach(s=>{if(s.cyl)s.t=0;});pitch=0;J.cd.q=0;true');await adv(300);await tap('KeyQ');assert.equal(xe('J.q'),0);await adv(2000);assert.equal(cages().length,1);
 xe('yaw+=Math.PI/2;J.cd.q=0;true');const n1=cyl();await tap('KeyQ');assert.equal(cyl(),n1+1,'no charge: activates the nearest');assert.equal(cages().length,0);
 xe('J.cd.q=0;true');await tap('KeyQ');assert.equal(cyl(),n1+1,'nothing left to toss or activate');
 // 4. round reset clears placed cages
 xe('J.q=1;J.cd.q=0;pitch=0;true');await tap('KeyQ');await adv(2000);assert.equal(cages().length,1);xe('bcClear();true');assert.equal(cages().length,0,'cleared on round reset (bcClear)');
 console.log('PASS Cyber Cage offline: instant toss lands on the floor and waits; Q at it (or with no charge, the nearest) activates the 3.72 m / 7.25 s cylinder; cleared on reset');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
