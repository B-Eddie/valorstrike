// QA test-hook isolation: qaOverrides is inert without the explicit gate, validates ranges,
// ignores malformed values, and the production wrangler config never carries QA vars.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const wrk=fs.readFileSync(path.join(__dirname,'src','worker.js'),'utf8');
 const qaOverrides=new Function(wrk.slice(wrk.indexOf('function qaOverrides'),wrk.indexOf('export default'))+';return qaOverrides;')();
 // absent config: everything defaults
 assert.deepEqual(qaOverrides({}),{});
 assert.deepEqual(qaOverrides(undefined),{});
 // unauthorized: values present but the gate is not explicitly true -> ignored
 for(const env of [{QA_CREDITS:'2000',QA_BUY_SECONDS:'15'},{QA_TEST_HOOKS:'1',QA_CREDITS:'2000'},{QA_TEST_HOOKS:'yes',QA_CREDITS:'2000'},{QA_TEST_HOOKS:true,QA_CREDITS:'2000'}])
   assert.deepEqual(qaOverrides(env),{},'gate must require the exact string true: '+JSON.stringify(env));
 // gated + valid
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'2000',QA_BUY_SECONDS:'15',QA_BOTS:'0'}),{qaCredits:2000,qaBuy:15,qaBots:0});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_BOTS:'9'}),{qaBots:9},'bounds inclusive');
 for(const v of ['-1','10','2.5','x','NaN'])assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_BOTS:v}),{},'QA_BOTS malformed/out-of-range ignored: '+v);
 // malformed / out-of-range values fall back individually
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'abc',QA_BUY_SECONDS:'x'}),{});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'-5',QA_BUY_SECONDS:'0'}),{});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'2000.5',QA_BUY_SECONDS:'121'}),{});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'1e9',QA_BUY_SECONDS:'NaN'}),{});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'99999',QA_BUY_SECONDS:'120'}),{qaCredits:99999,qaBuy:120},'bounds are inclusive');
 // production config carries no QA overrides
 const cfg=fs.readFileSync(path.join(__dirname,'wrangler.jsonc'),'utf8');
 assert(!/QA_(TEST_HOOKS|CREDITS|BUY_SECONDS|BOTS)/.test(cfg),'wrangler.jsonc must never define QA vars');
 // the message handler never reads client-supplied QA fields (source contract)
 const src=fs.readFileSync(path.join(__dirname,'src','worker.js'),'utf8');
 const handler=src.slice(src.indexOf('async message(ws,data)'));
 assert(!/QA_(CREDITS|BUY_SECONDS|BOTS)/.test(handler),'client messages must not reach QA overrides');
 // Exercise the actual simulation consumers too: zero credits is a valid test override.
 const {SpikeSimulation}=await import('./src/spike.js');
 const world={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[20,0,20]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 for(const [credits,buy] of [[undefined,undefined],[0,1],[2000,15]]){
  const sim=new SpikeSimulation(world,'five','ascent',()=>.5);
  Object.assign(sim,qaOverrides(credits===undefined?{}:{QA_TEST_HOOKS:'true',QA_CREDITS:String(credits),QA_BUY_SECONDS:String(buy)}));
  const u=sim.add('qa');assert.equal(u.credits,credits??800);sim.start(false);assert.equal(sim.buy,buy??20);
 }
 console.log('QA hooks: gate required, ranges validated, malformed ignored, production config clean, client input unreachable');
})().catch(e=>{console.error(e);process.exit(1);});
