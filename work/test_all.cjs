// Run every client regression from the repository root, irrespective of caller cwd.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');const root=path.join(__dirname,'..'),files=fs.readdirSync(__dirname).filter(f=>/^test_.*\.cjs$/.test(f)&&f!=='test_all.cjs').sort().concat('test_feel.js');let passed=0;
for(const file of files){const run=spawnSync(process.execPath,[path.join(__dirname,file)],{cwd:root,encoding:'utf8'});if(run.status!==0){process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');console.error('FAILED:',file);process.exit(run.status||1);}passed++;console.log('PASS',file);}
console.log(passed+' client regression files passed');
