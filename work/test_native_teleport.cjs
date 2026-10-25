// Native Bind teleporters offline (row 3). The legacy bot pad check (xTpBots) carries the blockout's pad coordinates,
// which on the native map are ordinary floor: a bot crossing -27.5,8 was thrown to 13,18 (no walkable node within 5.8 m)
// at its old height. On a native map only the native pads (nmTeleports: callout entry -> exit, same pairs as the server)
// move units; the blockout keeps its legacy pads.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const slice=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,'section '+a);return html.slice(i,j);};
const tps=slice('const TPS = [','\n'),fn=slice('function xTpBots(dt) {','\n}\n')+'\n}\n';
const w0=src.indexOf('{const legacy=xTpBots;'),wrap=src.slice(w0,src.indexOf('\n',w0));assert(w0>0,'native wrapper present');
assert(html.includes(wrap),'installed into index.html');
const run=native=>{const bot={alive:true,g:{position:{x:-27.5,y:6.12,z:8}}};const c={xTpU:[],bots:[bot],allies:[],C:native?{key:'bind'}:null};c.nmActive=()=>c.C;vm.createContext(c);
 vm.runInContext(tps.replace('const TPS','var TPS')+'\n'+fn+'\n'+wrap+'\nglobalThis.tick=dt=>xTpBots(dt);',c);for(let i=0;i<4;i++)c.tick(.2);return bot.g.position;};
const n=run(true);assert.deepEqual([n.x,n.z],[-27.5,8],'native Bind: a bot on the blockout pad spot stays where it walked');
const l=run(false);assert.deepEqual([l.x,l.z],[13,18],'blockout Bind: legacy pad still teleports');
// native pads use the server's pairs (A Teleporter -> B Exit, B Teleporter -> A Exit) from the map callouts
assert(/\[\['A Teleporter','B Exit'\],\['B Teleporter','A Exit'\]\]/.test(src),'native pad pairs match the server');
const meta=JSON.parse(fs.readFileSync(path.join(__dirname,'..','models/valorant/maps/bind/map.json'),'utf8'));for(const k of ['A Teleporter','B Exit','B Teleporter','A Exit'])assert(meta.callouts.some(c=>c.name===k),'callout '+k);
console.log('Native teleporters: legacy blockout pads inert on native Bind (no stray bot teleports), blockout pads intact, native pairs = server');
