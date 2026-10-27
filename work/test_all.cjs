// Run every client regression from the repository root, irrespective of caller cwd.
// Every file runs even after a failure, so one run reports all failures; each failure prints 'FAILED: <file>' and the
// exit status is non-zero when any failed. QA_FAIL_FAST=1 restores stop-at-first-failure.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');// Known-failing regressions kept out of the default run until fixed (QA_ALL=1 runs them too).
const KNOWN=new Set([]);const root=path.join(__dirname,'..'),files=fs.readdirSync(__dirname).filter(f=>/^test_.*\.cjs$/.test(f)&&f!=='test_all.cjs'&&f!=='test_slice.cjs'&&(process.env.QA_ALL||!KNOWN.has(f))).sort().concat('test_feel.js');let passed=0;const failed=[];
// CI sharding: SHARD_TOTAL=N SHARD_INDEX=i (0-based) runs the files whose position k in the sorted list has k % N == i;
// QA_LIST=1 prints the selected files and exits. Both unset = every file, as before.
const shardTotal=Number(process.env.SHARD_TOTAL||1),shardIndex=Number(process.env.SHARD_INDEX||0);
if(!Number.isInteger(shardTotal)||shardTotal<1||!Number.isInteger(shardIndex)||shardIndex<0||shardIndex>=shardTotal){console.error('bad SHARD_INDEX/SHARD_TOTAL',process.env.SHARD_INDEX,process.env.SHARD_TOTAL);process.exit(2);}
const selected=files.filter((f,k)=>k%shardTotal===shardIndex);if(process.env.QA_LIST){console.log(selected.join('\n'));process.exit(0);}
// QA_PERF_RETRY=1 (CI only): the wall-clock perf regressions below are rerun once after a failure (slow shared runners); a pass
// on the rerun counts. No other file is ever retried.
const PERF_RETRY=new Set(['test_round_start_perf.cjs','test_frame_perf.cjs']);
const runFile=file=>spawnSync(process.execPath,[path.join(__dirname,file)],{cwd:root,encoding:'utf8'});
for(const file of selected){let run=runFile(file);if(run.status!==0&&process.env.QA_PERF_RETRY&&PERF_RETRY.has(file)){process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');console.error('RETRY (wall-clock perf, once):',file);run=runFile(file);}if(run.status!==0){process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');console.error('FAILED:',file);failed.push([file,run.status||1]);if(process.env.QA_FAIL_FAST)process.exit(run.status||1);continue;}passed++;console.log('PASS',file);}
console.log(passed+' client regression files passed'+(failed.length?', '+failed.length+' failed: '+failed.map(f=>f[0]).join(' '):''));
if(failed.length)process.exit(failed[0][1]);
