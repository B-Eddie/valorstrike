// Chamber Tour De Force spread = the server's (qa-32). Server: simulation.js ABILITY_GUNS['Tour De Force'] is the Operator's
// calibration (spread, adsStats) with its own damage / fire rate, and ults.js swaps the real Operator in, so a TDF shot has the
// Operator's spread (very loose unscoped, pinpoint scoped). The page's bcFire shot the exact screen centre, scoped or not (fails before).
// Checks: the server block is the Operator's spread; a page TDF shot goes through gFire("Operator"); unscoped TDF shots spread like the
// page's unscoped Operator (gSpread), scoped (setScope -> ads 2 while holding TDF: xTdfOp) they are tight; spending the 5th round unscopes.
//   node work/test_tdf_spread.cjs
const assert=require('assert/strict');const path=require('path');const {pathToFileURL}=require('url');const {boot}=require('./page_harness.cjs');
(async()=>{
 const S=await import(pathToFileURL(path.join(__dirname,'../server/src/simulation.js')).href),T=S.ABILITY_GUNS['Tour De Force'],O=S.weapons.Operator;
 for(const k of Object.keys(O))if(!/^(fireRate|damageRanges|adsStats)$/.test(k))assert.deepEqual(T[k],O[k],'server Tour De Force '+k+' = Operator');
 for(const k of Object.keys(O.adsStats||{}))if(k!=='fireRate')assert.deepEqual(T.adsStats[k],O.adsStats[k],'server Tour De Force adsStats.'+k+' = Operator');
 assert.equal(S.gunOf({agent:'Chamber',ultWeapon:{},weapon:'Operator'}),T,'server gunOf: Chamber holding TDF fires the TDF block');
 const H=boot({real3:true,seed:5}),xe=H.xe,e0=H.errors.length;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Chamber";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);xe('FV.buy=0;true');await adv(300);
 assert.ok(xe('running&&mode==="five"'),'match started');
 xe('window.__gf=[];{const g=gFire;gFire=function(d,w){const a=d.clone();const r=g.apply(this,arguments);window.__gf.push([w,a.angleTo(d)]);return r;};}bots.forEach(b=>{b.g.position.set(player.x+200,player.y-50,player.z+200);});true');
 const shots=(scoped,n)=>xe(`(()=>{const o=[];for(let i=0;i<${n};i++){player.hp=100;player.mv=0;player.sf=0;player.air=0;player.lp=0;spray=0;rcl=0;rclH=0;BC.eq="sn";BC.td=5;BC.cd=0;setScope(${scoped});o.push([ads,bcFire()]);}return o;})()`);
 const un=shots(false,40),gu=xe('window.__gf.splice(0)');
 assert.ok(un.every(r=>r[0]===0&&r[1]===true),'unscoped TDF shots fired: '+JSON.stringify(un.slice(0,3)));
 assert.ok(gu.length===40&&gu.every(r=>r[0]==='Operator'),'every TDF shot goes through gFire("Operator"): '+JSON.stringify(gu.slice(0,3)));
 const exp=xe('gSpread("Operator",WEAP.Operator)'),mean=gu.reduce((a,r)=>a+r[1],0)/gu.length;
 assert.ok(exp>0.05,'page unscoped Operator spread is loose: '+exp);
 assert.ok(mean>exp*0.3&&mean<exp*2,'unscoped TDF deviation like the unscoped Operator: mean '+mean.toFixed(4)+' rad, Operator spread '+exp.toFixed(4));
 const sc=shots(true,20),gs=xe('window.__gf.splice(0)');
 assert.ok(sc.every(r=>r[0]===2),'holding TDF, setScope(true) scopes as the Operator (ads 2): '+JSON.stringify(sc.slice(0,3)));
 const ms=gs.reduce((a,r)=>Math.max(a,r[1]),0);assert.ok(ms<0.01,'scoped TDF shots are tight: max '+ms.toFixed(5)+' rad');
 assert.equal(xe('xSCw()'),'Operator','zoom levels follow the Operator while TDF is held');
 xe('BC.eq="sn";BC.td=1;BC.cd=0;setScope(true);window.__ls=[ads];bcFire();true');const le=xe('[BC.eq,ads,BC.td,window.__ls[0]]');assert.deepEqual(JSON.parse(JSON.stringify(le.slice(0,2))),['',0],'the last round unscopes and ends TDF: '+JSON.stringify(le));
 assert.equal(H.errors.length,e0,'no page errors: '+JSON.stringify(H.errors.slice(0,3).map(e=>String(e&&e.stack||e.message||JSON.stringify(e)).slice(0,300))));
 console.log('test_tdf_spread: PASS (server TDF = Operator spread; page unscoped mean '+mean.toFixed(4)+' rad vs Operator '+exp.toFixed(4)+', scoped max '+ms.toFixed(5)+')');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
