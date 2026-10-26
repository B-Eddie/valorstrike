// Online Sage Slow Orb (server abilities.js SLOW_ORB: 7 s, 3.5 m, half speed for everyone in it, status 'oslow'): the
// page's status handler predicts the slow the server applies (player.tagT / tagK, read by the shared motor's speed), so a
// player standing in a Slow Orb online is not corrected back every frame. The generic 65 % slow (status 'slow') still wins.
//   node work/test_online_slow_orb.cjs
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('if(st.slow>0){player.tagT='),b=html.indexOf('const el=document.getElementById(\'netBlind\')',a);assert(a>0&&b>a,'status handler');
const src=html.slice(a,b);assert(src.includes('else if(st.oslow>0)'),'oslow handled');
const run=(st,p)=>{const c={st,player:Object.assign({},p),Math};vm.createContext(c);vm.runInContext(src,c);return c.player;};
let p=run({oslow:.2},{});assert.deepEqual([p.tagK,p.tagT],[.5,.2],'Slow Orb: half speed');
p=run({oslow:.2},{tagT:0,tagK:.35});assert.equal(p.tagK,.5,'an expired stronger slow does not stick');
p=run({oslow:.2},{tagT:.4,tagK:.275,tagS:0});assert.deepEqual([p.tagK,p.tagT],[.275,.4],'a live stronger tag keeps its factor and time');
p=run({oslow:.2},{tagT:.3,tagK:.7,tagS:1});assert.deepEqual([p.tagK,p.tagS],[.5,0],'a weaker soft tag gives way to the field');
p=run({slow:.2,oslow:.2},{});assert.equal(p.tagK,.35,'the generic slow wins over the orb');
const srv=fs.readFileSync(path.join(__dirname,'..','server','src','spike.js'),'utf8');assert(srv.includes('oslow:Math.max(0,(u.orbSlowUntil||0)-this.time)'),'server sends oslow');
console.log('Online Slow Orb: oslow status predicted at half speed, stronger slows kept, generic slow wins');
