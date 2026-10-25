// Slice runner: node test_slice.cjs FROM TO - runs sorted test_*.cjs files [FROM,TO) like test_all.cjs.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const from=+process.argv[2]||0,to=+process.argv[3]||1e9;
const root=path.join(__dirname,'..'),files=fs.readdirSync(__dirname).filter(f=>/^test_.*\.cjs$/.test(f)&&f!=='test_all.cjs'&&f!=='test_slice.cjs').sort().concat('test_feel.js');
const slice=files.slice(from,to);console.log('slice',from,to,'of',files.length,':',slice.length,'files');
for(const file of slice){const t0=Date.now();const run=spawnSync(process.execPath,[path.join(__dirname,file)],{cwd:root,encoding:'utf8'});
  if(run.status!==0){process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');console.error('FAILED:',file);process.exit(run.status||1);}
  console.log('PASS',file,((Date.now()-t0)/1000).toFixed(1)+'s');}
console.log('SLICE OK ('+slice.length+' passed)');
