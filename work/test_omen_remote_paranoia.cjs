// Remote Omen Paranoia: the non-auth flash branch draws the module bolt (omxParanoiaBolt) and not the generic orb. Source line extracted from index.html, world stubbed (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('  else if (ty === "flash" && nd && ag === "Omen"'),b=html.indexOf('\n',a);assert(a>0);
const line=html.slice(a,b),next=html.indexOf('\n',b+1);
assert.ok(/else if \(ty === "flash"\) \{ const ph = ag === "Phoenix"/.test(html.slice(b+1,next)),'generic flash branch follows (still used for others)');
const log=[];
const ctx=vm.createContext({ty:'flash',nd:true,ag:'Omen',o:{x:1,y:1.5,z:2},d:{x:0,y:0,z:-1},MPC:{d:{set(x,y,z){return {x,y,z};}}},omxParanoiaBolt:(o,d,t)=>log.push([o.x,d.z,t]),SFX:{ab:()=>log.push('sfx')},GENERIC:false});
const run=(over)=>{log.length=0;Object.assign(ctx,over);vm.runInContext('if(false){}'+line.replace(/^  else if/,'if')+' else { GENERIC = true; }',ctx);return log.slice();};
ctx.GENERIC=false;assert.deepEqual(run({}),[[1,-1,0],'sfx'],'remote Omen flash draws the module bolt');assert.equal(ctx.GENERIC,false);
run({nd:false});assert.equal(ctx.GENERIC,true,'auth/host path keeps the legacy orb');ctx.GENERIC=false;
run({nd:true,ag:'Jett'});assert.equal(ctx.GENERIC,true,'other agents unchanged');
console.log('omen remote paranoia module bolt ok (stub)');
