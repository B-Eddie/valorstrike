// Online client for the 18 added agents (work/agents18_runtime.js AGENTS 18 ONLINE block, installed in index.html):
// server fx rows (spike.js snapshot A18_NET_KINDS + tscreen) render per kind via a18NetSync, movers follow server
// positions, rows vanish when the server stops sending them, and the rs status block shows
// SUPPRESSED / JAMMED / HINDERED / HASTE / STIM / DECAYING HP chips (HINDERED also feeds slow prediction).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m0='// ---- AGENTS 18 ONLINE ----',m1='// ---- END AGENTS 18 ----';
const i=html.indexOf(m0),j=html.indexOf(m1,i);assert(i>0&&j>i,'online block installed in index.html');
const block=html.slice(i,j);
const ci=html.indexOf('function netStatusChips(st){'),cj=html.indexOf('\n',ci);assert(ci>0,'netStatusChips present');
const orig=html.slice(ci,cj);
const els={},said=[];let now=1000;
const document={getElementById:id=>els[id]||null,createElement:t=>({tag:t,style:{},textContent:''}),body:{appendChild:e=>e}};
const realCreate=document.createElement;document.createElement=t=>{const e=realCreate(t);return new Proxy(e,{set(o,k,v){o[k]=v;if(k==='id')els[v]=o;return true;}});};
const meshes=[];
function Mesh(g,mt){this.geometry=g;this.material=mt;const p={x:0,y:0,z:0,set(x,y,z){p.x=x;p.y=y;p.z=z;}};this.position=p;this.rotation={x:0,y:0};this.scale={setScalar(s){this.s=s}};meshes.push(this);}
const THREE={Mesh,BoxGeometry:class{constructor(...a){this.a=a}},MeshLambertMaterial:class{constructor(o){Object.assign(this,o)}},SphereGeometry:class{},RingGeometry:class{rotateX(){}},MeshBasicMaterial:class{constructor(o){Object.assign(this,o)}},AdditiveBlending:1,DoubleSide:2};
const ctx=vm.createContext({document,performance:{now:()=>now},say:(t,ms)=>said.push(t),Math,NET:{},netTb:new Map(),netWf:new Map(),skxEnd(){},mkxEnd(){},THREE,
 console,player:{tagT:0,tagK:0,tagS:0},
 jM:(g,m)=>new Mesh(g,m),ringGeo:{},smokeGeo:{},orbGeo:{},fireMat:(c,o)=>({color:c,opacity:o}),xSmokeM:(n,c1,c2)=>({name:n,opacity:1}),
 scene:{add(m){}},jRel:m=>{ctx.__rel=(ctx.__rel||0)+1;},xE:e=>{throw e;}});
vm.runInContext('const A18C={salvo:{r:4.5,inner:2.5,pulses:3,gap:0.8},frag:{r:4,inner:1,pulses:4,gap:1}};let __booms=0;function a18Fx(o){if(o.kind==="armagboom")__booms++}function a18Ring(){return {}}function groundAt(){return 0}let netVulnAt=0,netTetherAt=0,netDetainAt=0;function netSyncEffects(rows){}function netClearEffects(){}\n'+orig+'\n'+block+'\nthis.__api={a18NetSync,a18Net,netStatusChips,netClearEffects,A18VIS};',ctx);
const api=ctx.__api;
// fields / devices render and follow server rows
api.a18NetSync([{id:1,kind:'pit',p:[1,0,2],r:9,tl:10},{id:2,kind:'sdrone',p:[3,0,4],tl:8}]);
assert.equal(api.a18Net.size,2,'two fx rows tracked');
const drone=api.a18Net.get(2).m;
api.a18NetSync([{id:1,kind:'pit',p:[1,0,2],r:9,tl:9},{id:2,kind:'sdrone',p:[5,0,6],tl:7}]);
assert.equal(drone.position.x,5,'mover follows the server position');
assert.equal(api.a18Net.size,2,'no duplicates');
// walls take the server yaw; a sync is the server's full effect set, so rows it no longer sends are released
const rel0=ctx.__rel||0;
api.a18NetSync([{id:3,kind:'divide',p:[0,0,0],r:60,yaw:1.1,tl:20}]);
assert.equal(api.a18Net.get(3).m.rotation.y,-1.1,'wall yaw applied');
assert.equal(api.a18Net.size,1,'pit and sdrone released once the server stops sending them');assert.equal(ctx.__rel-rel0,2,'their meshes released');
api.a18NetSync([]);
assert.equal(api.a18Net.size,0,'gone rows dropped');
// Guided Salvo row: ground rings now, one fireball per pulse as the server clock passes 0 / 0.8 / 1.6 s after landing
{const f0=(ctx.__api.a18Net.size,0);const booms=()=>vm.runInContext('__booms',ctx);
 api.a18NetSync([{id:20,kind:'salvo',p:[0,0,0],r:4.5,tl:3.4+1.0,w:1.0}]);assert.equal(api.a18Net.get(20).kind,'salvo');assert.equal(api.a18Net.get(20).ms.length,2,'outer + inner ring');assert.equal(booms(),0,'no blast before landing');
 api.a18NetSync([{id:20,kind:'salvo',p:[0,0,0],r:4.5,tl:3.4,w:0}]);assert.equal(booms(),1,'pulse 1');
 api.a18NetSync([{id:20,kind:'salvo',p:[0,0,0],r:4.5,tl:3.4-0.85,w:0}]);assert.equal(booms(),2,'pulse 2');
 api.a18NetSync([{id:20,kind:'salvo',p:[0,0,0],r:4.5,tl:3.4-1.7,w:0}]);assert.equal(booms(),3,'pulse 3');
 api.a18NetSync([{id:20,kind:'salvo',p:[0,0,0],r:4.5,tl:0.5,w:0}]);assert.equal(booms(),3,'no repeats');
 const r0=ctx.__rel||0;api.a18NetSync([]);assert.equal(ctx.__rel-r0,2,'rings released');}
// KAY/O FRAG/ment row: 4 pulses 1 s apart after the 0.5 s windup (w), rings now
{const booms=()=>vm.runInContext('__booms',ctx);const b0=booms();
 api.a18NetSync([{id:21,kind:'frag',p:[0,0,0],r:4,tl:5.5,w:0.5}]);assert.equal(booms()-b0,0,'no blast during windup');
 api.a18NetSync([{id:21,kind:'frag',p:[0,0,0],r:4,tl:5,w:0}]);assert.equal(booms()-b0,1);
 api.a18NetSync([{id:21,kind:'frag',p:[0,0,0],r:4,tl:3.95,w:0}]);assert.equal(booms()-b0,2);
 api.a18NetSync([{id:21,kind:'frag',p:[0,0,0],r:4,tl:1.9,w:0}]);assert.equal(booms()-b0,4,'all 4 pulses, none more');
 api.a18NetSync([]);}
// unknown kinds are left to the base sync
api.a18NetSync([{id:9,kind:'barrier',p:[0,0,0]}]);assert.equal(api.a18Net.size,0,'barrier stays with netSyncEffects');
// clear hook releases everything
api.a18NetSync([{id:4,kind:'mosh',p:[0,0,0],r:5,tl:3},{id:5,kind:'gatefake',p:[2,0,3],r:1.2,tl:30}]);assert(api.a18Net.get(5),'Gatecrash fake decal renders');api.netClearEffects();assert.equal(api.a18Net.size,0,'netClearEffects clears a18 meshes');
// status chips: the six agents18 statuses surface on the HUD
api.netStatusChips({vulnerable:0,tether:0,supp:2.5,jam:1.5,hind:1.2,haste:3,stim:1,decay:40});
const t=els.netSt.textContent;
for(const x of['SUPPRESSED 2.5s','JAMMED 1.5s','HINDERED 1.2s','HASTE 3.0s','STIM','DECAYING 40 HP'])assert(t.includes(x),'chip: '+x);
api.netStatusChips({vulnerable:0,tether:0,deaf:6});assert(els.netSt.textContent.includes('DEAFENED 6.0s'),'Bassquake deafen chip');
assert(ctx.player.tagT>=1.2,'hinder feeds slow prediction');
api.netStatusChips({vulnerable:0,tether:0});
assert.equal(els.netSt.style.display,'none','chips hide when clear');
console.log('agents18 online: server fx rows render per kind (fields/walls/devices/movers follow p and yaw), drop on removal and on netClearEffects; rs status shows SUPPRESSED/JAMMED/HINDERED/HASTE/STIM/DECAYING HP chips');
