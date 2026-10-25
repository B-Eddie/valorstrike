// The deployed worker must carry the hit-volume table: bundle src/worker.js the way wrangler does (esbuild, ESM,
// cloudflare:workers external, JSON import attributes inlined) and check hitboxes.json is embedded, not left as a
// runtime import. `npx wrangler deploy --dry-run --outdir <dir>` gives the same result (checked 2026-10-25).
const assert=require('assert/strict'),esbuild=require('esbuild'),fs=require('fs');
const r=esbuild.buildSync({entryPoints:['src/worker.js'],bundle:true,format:'esm',platform:'neutral',mainFields:['module','main'],conditions:['workerd','worker','browser'],external:['cloudflare:workers','node:*'],write:false,logLevel:'silent'});
const code=r.outputFiles[0].text,table=JSON.parse(fs.readFileSync('src/hitboxes.json','utf8'));
assert(!/hitboxes\.json/.test(code.replace(/\/\/.*$/gm,'').replace(/"_source":[^\n]*/g,'')),'hitboxes.json left as a runtime import');
for(const k of ['headRadius','headOffsetY','bodyRadius','legsBelow'])assert(code.includes(k),'volume key '+k+' missing');
assert(code.includes(String(table.poses.stand.head[1]))&&code.includes(String(table.poses.crouch.pelvis[1])),'pose values missing');
assert(code.includes(String(table.volumes.headRadius)));
console.log('Bundle: worker bundle embeds hitboxes.json (volumes and poses), no runtime JSON import; '+(code.length/1024|0)+' KB');
