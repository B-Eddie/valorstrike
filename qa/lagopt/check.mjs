// Run dependency-free regressions from any cwd.
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../../',import.meta.url));let failed=0;
for(const test of ['test-codec.mjs','test-hotpaths.mjs','test-client-cache.cjs','test-diagnostics.cjs','test-interp-network.cjs','compare-traces.mjs']){
 const p=spawnSync(process.execPath,['qa/lagopt/'+test],{cwd,stdio:'inherit'});if(p.status!==0)failed++;
}
process.exitCode=failed?1:0;
