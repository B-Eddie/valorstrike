const fs=require('fs'),vm=require('vm');const s=fs.readFileSync(process.argv[2]||'/workspace/work/vs-lane-gpu/index.html','utf8');let n=0,bad=0;
for(const m of s.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)){if(/type="(?!module|text\/javascript)/.test(m[1]))continue;n++;try{new vm.Script(m[2],{filename:'inline'+n});}catch(e){bad++;console.log('PARSE FAIL #'+n,e.message);}}
console.log('inline scripts',n,'parse failures',bad);process.exit(bad?1:0);
