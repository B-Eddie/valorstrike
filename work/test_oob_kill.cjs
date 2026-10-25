// Out-of-bounds kill watch (map-holes follow-up): boundary gaps let actors ground themselves past
// nav coverage and get stuck. A grounded actor >4 units from every playable nav node gets a
// warning, then dies after 2 s; airborne or in-coverage actors are untouched. Offline only.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert(html.includes('function nmOobWatch(C)'),'watch is spliced into the generated page');
const body=src.slice(src.indexOf('function nmOobWatch('),src.indexOf("(window.XHK||(window.XHK=[])).push(()=>{const C=nmActive();if(C)nmOobWatch(C);})"));
function mk(){let now=0;const calls={say:[],hurt:[],kill:[],allyDie:[]};
 const ctx={performance:{now:()=>now},running:true,paused:false,console,
   nmNear:(C,x,z)=>(Math.hypot(x,z)<50?0:-1), // nodes live within 50 of origin
   nmHeight:(C,x,z,y)=>0,
   player:{x:0,y:0,z:0,hp:100},bots:[],allies:[],
   say:(m)=>calls.say.push(m),hurt:(t,n,by)=>{calls.hurt.push([t,n,by]);t.hp-=n;},
   kill:(b,hs,by)=>calls.kill.push([b,by]),allyDie:(a,by)=>calls.allyDie.push([a,by])};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(body+';const C={nav:{nodes:[[0,0,0]]}};globalThis.api={watch:()=>nmOobWatch(C)};',ctx);
 return {ctx,calls,advance:(ms)=>{now+=ms;ctx.api.watch();}};}
{const t=mk();t.advance(16);assert.equal(t.calls.say.length,0,'in-coverage player: no warning');assert.equal(t.calls.hurt.length,0,'in-coverage player: no kill');}
{const t=mk();t.ctx.player.x=200;t.advance(16);assert.deepEqual(t.calls.say,['Outside the map - get back!'],'first grounded OOB tick warns');assert.equal(t.calls.hurt.length,0,'warn before kill');
 t.advance(1000);assert.equal(t.calls.hurt.length,0,'kill clock still running at 1s');t.advance(1100);assert.equal(t.calls.hurt.length,1,'killed after 2s grounded OOB');assert.equal(t.calls.hurt[0][2],'Out of bounds');assert(t.ctx.player.hp<=0,'lethal');}
{const t=mk();t.ctx.player.x=200;t.ctx.player.y=5;t.advance(16);assert.equal(t.calls.say.length,0,'airborne OOB: no warning (mid-jump/fall)');t.advance(3000);assert.equal(t.calls.hurt.length,0,'airborne OOB: never killed');}
{const t=mk();t.ctx.bots=[{alive:true,g:{position:{x:300,y:0,z:0}}}];t.advance(16);t.advance(2100);assert.equal(t.calls.kill.length,1,'bot killed after 2s OOB');}
{const t=mk();t.ctx.allies=[{alive:true,g:{position:{x:300,y:0,z:0}}}];t.advance(16);t.advance(2100);assert.equal(t.calls.allyDie.length,1,'ally killed after 2s OOB');}
{const t=mk();t.ctx.player.x=200;t.advance(16);t.ctx.player.x=0;t.advance(500);assert.equal(t.ctx.player.nmOob,0,'returning to coverage resets the clock');t.ctx.player.x=200;t.advance(16);t.advance(1900);assert.equal(t.calls.hurt.length,0,'clock restarted - not killed early');}
{const t=mk();t.ctx.player.x=200;t.ctx.paused=true;t.advance(3000);assert.equal(t.calls.hurt.length+t.calls.say.length,0,'paused: watch inert');
 t.ctx.paused=false;t.ctx.running=false;t.advance(16);assert.equal(t.calls.say.length,0,'not running: watch inert');}
console.log('OOB kill watch: grounded actor past nav coverage warned then killed at 2s (player/bot/ally); airborne, in-coverage, paused and pre-match states untouched; re-entry resets the clock');
