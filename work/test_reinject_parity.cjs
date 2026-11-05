// Reinjection parity: work/install_valorant.py rewrites index.html from work/*_runtime.js + vendor/*.
// Every non-blank line currently in index.html must survive a reinstall (multiset), otherwise a
// handler edited only in index.html would be silently erased. Runs the installer on a temp copy.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'reinj-'));
fs.copyFileSync(path.join(root,'index.html'),path.join(tmp,'index.html'));
for(const d of['work','vendor','audio'])if(fs.existsSync(path.join(root,d)))fs.cpSync(path.join(root,d),path.join(tmp,d),{recursive:true});
fs.mkdirSync(path.join(tmp,'models','valorant'),{recursive:true});fs.cpSync(path.join(root,'models','valorant','movement'),path.join(tmp,'models','valorant','movement'),{recursive:true});
fs.mkdirSync(path.join(tmp,'server','src'),{recursive:true});fs.copyFileSync(path.join(root,'server','src','skins.json'),path.join(tmp,'server','src','skins.json'));
const r=cp.spawnSync('python3',[path.join(tmp,'work','install_valorant.py')],{encoding:'utf8',timeout:90000});
if(r.status!==0){console.log('FAIL installer exit',r.status,r.stderr.slice(0,300));process.exit(1);}
const cnt=new Map();for(const l of fs.readFileSync(path.join(tmp,'index.html'),'utf8').split('\n')){const k=l.trimEnd();if(k.trim())cnt.set(k,(cnt.get(k)||0)+1);}
const lost=[];for(const l of fs.readFileSync(path.join(root,'index.html'),'utf8').split('\n')){const k=l.trimEnd();if(!k.trim())continue;const c=cnt.get(k)||0;if(c>0)cnt.set(k,c-1);else lost.push(k.slice(0,100));}
fs.rmSync(tmp,{recursive:true,force:true});
if(lost.length){console.log('FAIL reinjection would erase',lost.length,'lines, e.g.',lost.slice(0,5));process.exit(1);}
console.log('PASS reinjection preserves every index.html line');
