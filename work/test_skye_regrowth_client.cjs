// Client lifecycle of the remote Skye Regrowth row (netSyncRegrowth). skxRegrowth is a recording stub: this checks create/follow/end,
// own-row skip and bad-row rejection, not the real module's construction or look.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('const netRg=new Map();'),j=html.indexOf('function netSyncEffects(rows)');assert(i>0&&j>i);
const log=[];const ctx=vm.createContext({MP:{me:7},skxRegrowth:(x,y,z,r)=>{const h={x,y,z,r,move(a,b,c){log.push(['move',a,b,c]);}};log.push(['new',x,y,z,r]);return h;},skxEnd:h=>log.push(['end',h.r])});
vm.runInContext(html.slice(i,j)+';this.sync=netSyncRegrowth;',ctx);
ctx.sync([{id:1,kind:'regrowth',o:3,p:[1,0,2],r:18,tl:3600}]);ctx.sync([{id:1,kind:'regrowth',o:3,p:[4,0,5],r:18,tl:3599}]);
assert.deepEqual(log.map(l=>l[0]),['new','move','move']);assert.deepEqual(log[2].slice(1),[4,0,5]);
ctx.sync([{id:2,kind:'regrowth',o:7,p:[0,0,0],r:18}]);assert.equal(log.filter(l=>l[0]==='new').length,1,'own Skye row skipped (local path draws it)');
ctx.sync([{id:3,kind:'regrowth',o:3,p:[NaN,0,0]}]);assert.equal(log.filter(l=>l[0]==='new').length,1,'bad row rejected');
ctx.sync([]);assert.equal(log[log.length-1][0],'end','row gone -> field ended');
console.log('skye regrowth client: create, follow, own-skip, reject, end (stub module)');
