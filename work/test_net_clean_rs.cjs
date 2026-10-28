// netClean round-state values (work/server_runtime.js rs()): a server 'rs' frame (alone, or inside 'start' / 'ao') reaches
// mpCliRS / netRS0 with typeof-number checks only, and JSON carries 1e999 (= Infinity) and any magnitude. Every number the
// page reads must arrive finite and in range: scalars (tm, b, tl, me) clamped or dropped, statuses / channel / ability
// block / spike row clamped or zeroed, scores and credits clamped; the real roundState() frame passes unchanged.
//   node work/test_net_clean_rs.cjs     (in test_all)
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const net=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i=net.indexOf('function netClean(m){'),j=net.indexOf('\nfunction netConnect(',i);assert(i>=0&&j>i,'netClean found');
const src=net.slice(i,j);/* netClean and its helpers (perf3: hoisted out of it) */assert(html.includes(src),'index.html carries this netClean (regen)');
const c={WEAP:{Classic:{},Vandal:{},Sheriff:{}},Date,Number,Math,Object,Array,JSON};vm.createContext(c);vm.runInContext(src+';globalThis.netClean=netClean;',c);
// re-parsed here so objects built in the vm context compare by value (deepStrictEqual checks prototypes)
const clean=m=>{const r=c.netClean(JSON.parse(JSON.stringify(m).replace(/"__INF__"/g,'1e999').replace(/"__NINF__"/g,'-1e999')));return r==null?r:JSON.parse(JSON.stringify(r));};
const INF='__INF__',NINF='__NINF__';
// a real frame (server/src/spike.js roundState shape) passes with its values intact
const real={t:'rs',tm:12.5,b:0,ld:['Vandal','Classic'],tw:null,tl:87.25,sc:[3,2],atk:1,me:2400,ab:{c:1,q:0,e:1,ult:4,cool:{c:10.2,e:41},anchor:null,rechargeAt:40,signatureKills:1,regrowthPool:100,regrowthActive:false,blades:0,bladesActive:false},reyna:null,channel:{kind:'step',remaining:.5},
 status:{concuss:0,blind:1.25,nearsight:0,slow:0,oslow:.5,sslow:4.2,detain:0,vulnerable:0,tether:0},rv:[[3,1,0,2]],cr:{a:2400,b:900},sp:['carry',4,12.5,-3,0,0,0,'',0]};
assert.deepEqual(clean(real),JSON.parse(JSON.stringify(real)),'real roundState frame unchanged');
// Infinity / huge / junk values: clamped or dropped, never reaching the page
const bad=clean({t:'rs',tm:INF,b:1e300,tl:NINF,me:-50,sc:[1e9,-3],atk:'1',bl:['Vandal',5,null],cr:{a:1e12,b:-1},
 ab:{c:INF,q:'2',e:-4,ult:1e9,cool:{c:INF,e:'x',q:5},rechargeAt:NINF,blades:99,regrowthPool:1e6,bladesActive:true},
 channel:{kind:7,remaining:INF},status:{concuss:INF,blind:'2',nearsight:-1,slow:1e5,sslow:INF,detain:3},
 sp:[5,INF,1e9,NINF,INF,-2,'x',null,'1']});
assert(bad,'frame kept (values repaired)');
assert.equal('tm' in bad,false,'tm Infinity dropped');assert.equal(bad.b,120,'buy time clamped');assert.equal('tl' in bad,false,'tl -Infinity dropped');assert.equal(bad.me,0,'credits clamped at 0');
assert.deepEqual(bad.sc,[99,0],'scores clamped');assert.equal(bad.atk,0,'atk only 1 / true');assert.deepEqual(bad.bl,['Vandal'],'buy list strings only');assert.deepEqual(bad.cr,{a:99999,b:0},'team credits clamped');
assert.deepEqual(bad.ab,{e:0,ult:20,cool:{q:5},blades:10,regrowthPool:100,bladesActive:true},'ability block: junk charges dropped, numbers clamped, booleans kept');
assert.deepEqual(bad.channel,{kind:'',remaining:0},'channel repaired');assert.deepEqual(bad.status,{concuss:0,blind:0,nearsight:0,slow:60,sslow:0,detain:3},'statuses finite 0..60 (Seekers sslow included)');
assert.deepEqual(bad.sp,['',-1,1e4,0,0,0,0,'',0],'spike row: state string, carrier -1, coordinates / timers finite and clamped, seen 0/1');
for(const v of [bad.b,bad.me,...bad.sc,...Object.values(bad.cr),...Object.values(bad.status),...bad.sp.filter(x=>typeof x==='number')])assert(Number.isFinite(v),'finite '+v);
// the same through 'ao' and 'start'
const ao=clean({t:'ao',k:'c',ok:true,rs:{...real,tl:INF,status:{blind:INF}}});assert.equal('tl' in ao.rs,false);assert.deepEqual(ao.rs.status,{blind:0});
const st=clean({t:'start',mode:'five',map:'ascent',you:1,u:[],rs:{...real,b:INF,sp:['plant',-1,INF,0,40,0,0,'A',1]}});assert.equal('b' in st.rs,false);assert.deepEqual(st.rs.sp,['plant',-1,0,0,40,0,0,'A',1]);
// structural rejects unchanged: no spike row / bad scores
assert.equal(clean({t:'rs',sp:[1,2]}),null);assert.equal(clean({t:'rs',...real,sc:[1,INF]}),null,'non-finite score pair rejects the frame (as before)');
console.log('netClean rs values: real frame unchanged; Infinity / huge / junk tm, b, tl, me, sc, atk, bl, cr, ability block, channel, statuses and the spike row clamped, zeroed or dropped (also inside ao / start)');
