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
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'2000',QA_BUY_SECONDS:'15'}),{qaCredits:2000,qaBuy:15});
 // malformed / out-of-range values fall back individually
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'abc',QA_BUY_SECONDS:'x'}),{});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'-5',QA_BUY_SECONDS:'0'}),{});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'2000.5',QA_BUY_SECONDS:'121'}),{});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'1e9',QA_BUY_SECONDS:'NaN'}),{});
 assert.deepEqual(qaOverrides({QA_TEST_HOOKS:'true',QA_CREDITS:'99999',QA_BUY_SECONDS:'120'}),{qaCredits:99999,qaBuy:120},'bounds are inclusive');
 // production config carries no QA overrides
 const cfg=fs.readFileSync(path.join(__dirname,'wrangler.jsonc'),'utf8');
 assert(!/QA_(TEST_HOOKS|CREDITS|BUY_SECONDS)/.test(cfg),'wrangler.jsonc must never define QA vars');
 // the message handler never reads client-supplied QA fields (source contract)
 const src=fs.readFileSync(path.join(__dirname,'src','worker.js'),'utf8');
 const handler=src.slice(src.indexOf('async message(ws,data)'));
 assert(!/QA_(CREDITS|BUY_SECONDS)/.test(handler),'client messages must not reach QA overrides');
 console.log('QA hooks: gate required, ranges validated, malformed ignored, production config clean, client input unreachable');
})().catch(e=>{console.error(e);process.exit(1);});
