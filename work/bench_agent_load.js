// Scripted real-browser timing of agent character loading (issue #10). Not part of the unit suite.
// Usage: NODE_PATH=<dir with playwright-core> node work/bench_agent_load.js [mbps=25] [latencyMs=40]
// Serves the repository root locally, throttles the network with CDP, and measures:
//   cold:   first visit, empty HTTP cache and empty Cache Storage
//   repeat: second visit in the same browser profile (HTTP cache + Cache Storage retained)
// Each visit reports when the selected agent (Jett) and when all twelve agents are usable.
const {chromium}=require('playwright-core'),http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const root=path.join(__dirname,'..'),mbps=+(process.argv[2]||25),latency=+(process.argv[3]||40);
const QA='/workspace/work/qa/',LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.glb':'model/gltf-binary','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(root,u==='/'?'index.html':u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  const st=fs.statSync(f);r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream','content-length':st.size,'last-modified':st.mtime.toUTCString(),'cache-control':'max-age=600'});fs.createReadStream(f).pipe(r);});
const AGENTS=['Jett','Phoenix','Sova','Sage','Reyna','Raze','Killjoy','Omen','Skye','Chamber','Breach','Cypher'];
async function visit(ctx,label){
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
  const cdp=await ctx.newCDPSession(page);await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency,downloadThroughput:mbps*125000,uploadThroughput:mbps*125000});
  let bytes=0;page.on('response',async r=>{if(/\/models\/valorant\//.test(r.url())){const h=await r.allHeaders().catch(()=>({}));bytes+=+(h['content-length']||0);}});
  const t0=Date.now();await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
  await page.waitForFunction(()=>window.xValorantAssets,null,{timeout:120000});const tScript=Date.now()-t0;
  // Ask exactly what the game asks for: every agent kit, the lobby's selected agent first.
  const r=await page.evaluate(async(agents)=>{const t=performance.now(),out={};const A=window.xValorantAssets;
    const one=await A.loadAgent(agents[0]).then(()=>performance.now()-t);out.first=one;
    await Promise.all(agents.map(a=>A.loadAgent(a)));out.all=performance.now()-t;out.nav=performance.now();return out;},AGENTS);
  await page.close();return {label,script:tScript,firstAgent:Math.round(r.first),allAgents:Math.round(r.all),sinceNavAll:Math.round(r.nav),errors};
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-bench-'));
  const ctx=await chromium.launchPersistentContext(dir,{headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript'});return r.abort();});
  const res=[];res.push(await visit(ctx,'cold'));res.push(await visit(ctx,'repeat'));
  console.log(JSON.stringify({mbps,latency,res},null,1));await ctx.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
