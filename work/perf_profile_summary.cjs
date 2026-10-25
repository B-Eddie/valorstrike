// Summarise a CDP .cpuprofile: self and inclusive milliseconds per function (time deltas, not sample counts).
//   node work/perf_profile_summary.cjs <file.cpuprofile> [names,comma,separated]
const fs=require('fs');const P=JSON.parse(fs.readFileSync(process.argv[2]));const want=(process.argv[3]||'').split(',').filter(Boolean);
const N=new Map(P.nodes.map(n=>[n.id,n]));const par=new Map();for(const n of P.nodes)for(const c of n.children||[])par.set(c,n.id);
const self=new Map();P.samples.forEach((s,i)=>{const d=(P.timeDeltas[i+1]||0)/1000;self.set(s,(self.get(s)||0)+d);});
const key=n=>{const f=n.callFrame;return (f.functionName||'(anon)')+' '+f.url.split('/').pop().slice(0,28)+':'+(f.lineNumber+1);};
const bySelf=new Map(),byIncl=new Map();let total=0,idle=0;
for(const [id,ms] of self){total+=ms;const n=N.get(id);const k=key(n);if(/^\((idle|program)\)/.test(k))idle+=ms;bySelf.set(k,(bySelf.get(k)||0)+ms);
 const seen=new Set();let x=id;while(x!==undefined){const kk=key(N.get(x));if(!seen.has(kk)){seen.add(kk);byIncl.set(kk,(byIncl.get(kk)||0)+ms);}x=par.get(x);}}
const r=v=>+v.toFixed(0);
console.log(JSON.stringify({totalMs:r(total),idleOrProgramMs:r(idle),activeMs:r(total-idle),
 topSelf:[...bySelf].filter(([k])=>!/^\((idle|program|root)\)/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k,v])=>[k,r(v)]),
 topIncl:[...byIncl].filter(([k])=>!/^\((idle|program|root)\)/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>[k,r(v)]),
 named:want.map(w=>[w,r([...byIncl].filter(([k])=>k.startsWith(w+' ')).reduce((s,[,v])=>s+v,0))])},null,1));
