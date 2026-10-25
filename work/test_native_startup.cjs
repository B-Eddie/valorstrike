// #11: agents only ever get the real Valorant rig. A cached kit attaches synchronously at creation; a missing kit
// leaves the agent hidden (weapon too) until it arrives. No legacy fallback queue or stand-in rig remains.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),s=fs.readFileSync(__dirname+'/valorant_runtime.js','utf8');
const a=s.indexOf('// #11: no stand-in bodies.'),b=s.indexOf('// Correct only',a);assert(a>0&&b>a,'attach block present');
let resolveLoad;const attached=[],loads=[];
const c={XVA:{kits:{Sage:{name:'Sage'}}},xAgent:(nm)=>({nm,gun:{visible:true}}),xvAgentName:n=>n,
  xvAgentLoad:n=>{loads.push(n);return new Promise(r=>resolveLoad=r);},xvAgent:(m,k)=>{attached.push([m,k]);m.valorant=1;if(m.xvWait){m.xvWait=0;m.gun.visible=true;}}};
vm.createContext(c);vm.runInContext(s.slice(a,b),c);
(async()=>{
  const ready=c.xAgent('Sage');assert.equal(attached.length,1,'cached kit attaches during creation');assert.equal(attached[0][0],ready);assert.equal(loads.length,0,'no load for a cached kit');assert.equal(ready.gun.visible,true);
  const late=c.xAgent('Jett');assert.equal(attached.length,1,'nothing substituted while the kit loads');assert.equal(late.xvWait,1);assert.equal(late.gun.visible,false,'weapon hidden until the body exists');assert.deepEqual(loads,['Jett']);
  resolveLoad({name:'Jett'});await new Promise(r=>setTimeout(r,0));assert.equal(attached.length,2);assert.equal(attached[1][0],late);assert.equal(attached[1][1].name,'Jett');assert.equal(late.gun.visible,true);
  assert(!/XSOL\.up|xUb\(|xSol\(|base\(M\)/.test(s),'no legacy fallback hooks in the native runtime');
  const html=fs.readFileSync(__dirname+'/../index.html','utf8');
  for(const gone of ['Soldier.glb','models/agent_m.glb','models/agent_f.glb','models/agent_anims.glb','function xSolLoad','function xUbLoad','function xSol(','function xUb(','function xSolKit','function xUbKit'])assert(!html.includes(gone),'removed: '+gone);
  const xa=html.slice(html.indexOf('function xAgent(name, rim, w) {'),html.indexOf('const XDEAD = [];'));assert(xa.length>100);
  assert(!/new THREE\.Mesh\(/.test(xa.replace('new THREE.Mesh(new THREE.RingGeometry','')),'xAgent builds no body meshes (team ring only)');assert(!/\bgB\(/.test(xa),'no primitive boxes');
  const lobby=html.slice(html.indexOf('// lobby showcase:'),html.indexOf('// ---- visual models'));assert(!lobby.includes('xAgent('),'lobby shows no placeholder build');assert(lobby.includes('xvAgentWaitLabel'),'lobby shows load progress');
  console.log('Native agents attach synchronously from cache, wait hidden (no stand-in) otherwise; Soldier/Quaternius/primitive bodies and lobby placeholder removed');
})().catch(e=>{console.error(e);process.exit(1)});
