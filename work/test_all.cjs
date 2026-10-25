// Run every client regression from the repository root, irrespective of caller cwd.
// Every file runs even after a failure, so one run reports all failures; each failure prints 'FAILED: <file>' and the
// exit status is non-zero when any failed. QA_FAIL_FAST=1 restores stop-at-first-failure.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');// Known-failing regressions kept out of the default run until fixed (QA_ALL=1 runs them too).
const KNOWN=new Set([]);const root=path.join(__dirname,'..'),files=fs.readdirSync(__dirname).filter(f=>/^test_.*\.cjs$/.test(f)&&f!=='test_all.cjs'&&(process.env.QA_ALL||!KNOWN.has(f))).sort().concat('test_feel.js');let passed=0;const failed=[];
for(const file of files){const run=spawnSync(process.execPath,[path.join(__dirname,file)],{cwd:root,encoding:'utf8'});if(run.status!==0){process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');console.error('FAILED:',file);failed.push([file,run.status||1]);if(process.env.QA_FAIL_FAST)process.exit(run.status||1);continue;}passed++;console.log('PASS',file);}
console.log(passed+' client regression files passed'+(failed.length?', '+failed.length+' failed: '+failed.map(f=>f[0]).join(' '):''));
if(failed.length)process.exit(failed[0][1]);
