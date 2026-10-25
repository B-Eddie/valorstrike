// Native-only characters: no primitive boxes, no CC0/Soldier clones ever render
// as a third-person agent. Placeholder meshes hide at creation; native rig is the
// only tier; persistent failure retries twice then surfaces one error per agent.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
(async()=>{
 const src=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8');
 const a=src.indexOf('// No third-party fallback visuals'),b=src.indexOf('// Correct only the blended support-foot');
 assert(a>0&&b>a,'wrapper source found');
 const mesh=(n)=>({isMesh:true,name:n,visible:true,parent:null});
 const mkRig=()=>{const gun={isMesh:true,name:'gun',visible:true,parent:null},ring=mesh('ring'),body=mesh('body');gun.parent=body;const m={traverse(f){[body,gun,ring].forEach(f);}};return{m,gun,ring,body,nm:'Jett',dead:0};};
 const timers=[],errs=[],loads=[],applied=[];
 let fail=false;
 const c={console,setTimeout:(f)=>timers.push(f),Error,
  XV:{failures:{}},XUB_AG:{Jett:['f']},
  xAgOf:n=>n,xvAgentName:()=>'Jett',
  xAgent:()=>mkRig(),
  xvAgentLoad:(ag)=>{loads.push(ag);return fail?Promise.reject(new Error('404')):Promise.resolve('kit');},
  xvAgent:(M,kit)=>{applied.push(M);M.valorant=1;},
  xUb:()=>{throw new Error('CC0 clone tier must not run');},
  xE:(e)=>errs.push(String(e))};
 vm.createContext(c);
 vm.runInContext(src.slice(a,b)+';this.api={xvNativeAgent,xAgent,xUb};',c);
 // 1. Creation hides every placeholder mesh except ring + held gun, before the native kit lands.
 const M=c.api.xAgent('Jett',0xff4655,'Vandal');
 assert.equal(M.body.visible,false,'placeholder body hidden from birth');
 assert.equal(M.gun.visible,true,'held gun stays visible');
 assert.equal(M.ring.visible,true,'team ring stays visible');
 // 2. Native rig applies; the xUb route never builds the CC0 clone.
 await Promise.resolve();await Promise.resolve();
 assert.equal(applied.length,1,'native rig applied once');
 assert.equal(M.valorant,1,'native flag set');
 c.api.xUb(M); // routed via xSol for already-native rigs: must no-op
 assert.equal(applied.length,1,'no second application');
 // 3. Persistent failure: two retries, one toast, body stays hidden.
 fail=true;
 const M2=c.api.xAgent('Jett',0xff4655,'Vandal');
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(loads.filter(x=>x==='Jett').length,2,'first attempt failed');
 while(timers.length)timers.shift()(),await Promise.resolve(),await Promise.resolve(),await Promise.resolve();
 assert.equal(loads.length,1+3,'two retries after the initial failure, got '+loads.length);
 assert.equal(errs.length,1,'one error surfaced, got '+errs.length);
 assert.equal(M2.body.visible,false,'fallback body never shown even after total failure');
 assert.equal(M2.valorant,undefined,'never marked native');
 console.log('native-only characters: placeholder hidden at birth, CC0 tier removed, retry + single error on failure');
})().catch(e=>{console.error(e);process.exit(1)});
