// Offline Spike detonation (VALORANT, wiki.playvalorant.com/en-us/Spike; outer radius 3250 uu = 32.5 m, valorant.gs/rules):
// every player inside the sphere dies, either team, with no kill credit; the round is then decided once, as a detonation.
// Before, offline only printed kill-feed lines for defenders within 18 m and nobody died.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a);assert(i>=0,'missing '+a);const j=html.indexOf(b,i);assert(j>i,'missing end of '+a);return html.slice(i,j);};
const src=cut('const SPIKE_R = 32.5;','\nfunction fCheck(');
const at=(x,z,y=0)=>({x,y,z});
const c=vm.createContext({FV:{},log:[],checks:0});
c.player={x:5,y:0,z:0,hp:100};c.allies=[{name:'A1',alive:true,g:{position:at(31,0)}},{name:'A2',alive:true,g:{position:at(0,40)}}];
c.bots=[{name:'B1',alive:true,g:{position:at(0,-20)}},{name:'B2',alive:true,g:{position:at(0,0,40)}},{name:'B3',alive:false,g:{position:at(1,1)}}];
c.fAlive=u=>u===c.player?c.player.hp>0:u.alive;c.fPos=u=>u===c.player?c.player:u.g.position;
// the real death helpers end the round when a side is wiped; fCheck is guarded by FV.det while the blast resolves
c.fCheck=()=>{if(!c.FV.det)c.checks++;};
c.pDie=(by,w)=>{c.player.hp=0;c.log.push(['You',by,w]);c.fCheck();};
c.allyDie=(a,by,w)=>{a.alive=false;c.log.push([a.name,by,w]);c.fCheck();};
c.kill=(b,hs,by,w)=>{b.alive=false;c.log.push([b.name,by,w,hs]);c.fCheck();};
vm.runInContext(src+'\nthis.fDetonate=fDetonate;',c);
c.fDetonate({x:0,y:0,z:0});
assert.deepEqual(c.log.map(e=>e[0]).sort(),['A1','B1','You'],'inside 32.5 m dies (player 5 m, ally 31 m, enemy 20 m); 40 m away and 40 m above survive');
assert(c.log.every(e=>e[1]==='Spike'&&e[2]==='Spike'),'credited to the Spike, no player');assert.equal(c.log.find(e=>e[0]==='B1')[3],false);
assert.equal(c.checks,0,'no elimination round-end while the blast resolves');assert.equal(c.FV.det,0,'guard released');
assert.equal(c.allies[1].alive,true);assert.equal(c.bots[1].alive,true);
// legacy plant without a height: horizontal distance only
c.player.hp=100;c.log.length=0;c.bots[1].alive=true;c.fDetonate({x:0,z:0});assert.deepEqual(c.log.map(e=>e[0]).sort(),['B2','You']);
// wiring: the fuse calls it before deciding the round; fCheck holds off while FV.det; the plant records the height
assert.ok(/s\.t <= 0\) \{[^\n]*fDetonate\(s\); return fCheck\(FV\.atk, "Attackers win", "SPIKE DETONATED"\)/.test(html),'fuse -> fDetonate -> fCheck');
assert.ok(html.includes('function fCheck(win, text, title) {\n  if (!running || FV.det) return;'),'fCheck guard');
assert.ok(html.includes('s.x = p.x; s.y = p.y || 0; s.z = p.z;'),'plant height recorded');
// wiki Spike (patch 1.11): dying to the Spike is no KDA death: the scoreboard (sbKill) and the player's own stats (pDie) skip it
{const sb=cut('function sbKill(by, victim, hs) {','\n');const k=vm.createContext({XTKILL:false,SB:{V:{k:0,d:0,hs:0},E:{k:0,d:0,hs:0}},SBH:{},sbAst(){},sbScore:()=>[0,0]});vm.runInContext(sb,k);
 k.sbKill('Spike','V',false);assert.equal(k.SB.V.d,0,'Spike: no scoreboard death');k.sbKill('E','V',false);assert.equal(k.SB.V.d,1,'enemy kill: a death');assert.equal(k.SB.E.k,1);
 const pd=cut('function pDie(by, w) {','\n}\n');assert.ok(pd.includes('if (by !== "Spike") stats.d++;'),'pDie: no stats death for the Spike');}
console.log('Offline detonation: kills both teams within 32.5 m (3D), no credit, one round decision, no KDA death');
