// VALORANT round timers + Spike times + economy constants, offline page (index.html) vs the server (server/src/spike.js) vs the wiki:
// wiki.playvalorant.com/en-us/Spike (plant 4 s, defuse 7 s, saved at 3.5 s, 45 s fuse; dying to the Spike is no KDA death, patch 1.11),
// wiki.playvalorant.com/en-us/Unrated (round 100 s, buy phase 30 s / 45 s for rounds 1, 13, 25, post-round 7 s),
// wiki.playvalorant.com/en-us/Credits (kill 200, plant 300 each attacker, win 3000, loss 1900 / 2400 / 2900, survivor 1000, cap 9000, start 800, overtime 5000).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),srv=fs.readFileSync(path.join(root,'server/src/spike.js'),'utf8');
const has=(s,t,m)=>assert.ok(s.includes(t),m+' ('+t+')');
// offline buy phase: evaluate the real expression for each round
{const m=html.match(/FV\.buy = (FV\.you \+ FV\.them === 0[^;]*);/);assert.ok(m,'offline buy-phase expression');
 const buy=(n,o={})=>vm.runInNewContext(m[1],{FV:{you:n,them:0,sw:false,sr:false,...o}});
 for(let n=0;n<30;n++)assert.equal(buy(n),n===0||n===12||n===24?45:30,'offline buy phase before round '+(n+1));}
// server buy phase / post-round / round / fuse
(async()=>{const S=await import(path.join(root,'server/src/spike.js'));
 for(let r=1;r<=30;r++)assert.equal(S.buyPhaseSeconds(r),r===1||r===13||r===25?45:30,'server buy phase round '+r);
 assert.equal(S.POST_ROUND,7,'server post-round 7 s');
 has(srv,'this.remaining=100;','server round 100 s');has(html,'timeLeft = 100; FV.buy','offline round 100 s');has(html,'}, over ? 2200 : 7000); // post-round 7 s','offline post-round 7 s');
 // Spike: plant 4, defuse 7, half 3.5, fuse 45
 has(srv,'if(sp.pt>=4){sp.st=\'plant\';sp.site=site;sp.t=45;','server plant 4 s, fuse 45 s');has(srv,'sp.dt=sp.dt>=3.5?3.5:0','server half defuse saved');has(srv,'if(sp.dt>=7){','server defuse 7 s');
 has(html,'if (s.pt >= 4) {','offline plant 4 s');has(html,'s.t = 45;','offline fuse 45 s');has(html,'if (s.dt >= 7) {','offline defuse 7 s');has(html,'s.dt = s.dt >= 3.5 ? 3.5 : 0','offline half defuse saved');
 // economy
 has(srv,'u.team===winner?3000:survivorLoss(this,u,text)?1000:Math.min(2900,1900+(this.losses[u.team]-1)*500)','server win 3000 / survivor 1000 / loss 1900-2400-2900');
 for(const [l,b] of [[1,1900],[2,2400],[3,2900],[6,2900]])assert.equal(Math.min(2900,1900+(l-1)*500),b,'loss streak '+l);
 has(srv,'v.credits=Math.min(9000,v.credits+300);/* plant bonus: every attacker','server plant 300 each attacker, cap');has(srv,'u.credits=Math.min(9000,u.credits+200);u.roundKills++','server kill 200, cap');
 has(html,'const LOSS_B = [1900, 2400, 2900];','offline loss bonus');has(html,'const capC = (n) => Math.min(9000, n);','offline cap 9000');has(html,'(win ? 3000 : fSurvLoss(','offline win 3000 / survivor 1000');has(html,'FV.cr = Math.min(9000, FV.cr + 200)','offline player kill 200');
 has(srv,'u.credits=this.qaCredits??800','server start 800');has(srv,'for(const u of this.units)u.credits=5000;','server overtime 5000');has(html,'if (ot) { FV.cr = 5000;','offline overtime 5000');
 // ult points (wiki agent pages, work/validation/abilities-wiki.json): server kits.json == table
 const wiki=JSON.parse(fs.readFileSync(path.join(root,'work/validation/abilities-wiki.json'),'utf8')),kits=JSON.parse(fs.readFileSync(path.join(root,'server/src/kits.json'),'utf8'));
 const want={Jett:8,Phoenix:7,Sova:8,Sage:7,Reyna:7,Omen:7,Killjoy:9,Raze:8,Skye:8,Breach:8,Cypher:7,Chamber:8};
 for(const [a,u] of Object.entries(want)){assert.equal(wiki[a].u,u,'wiki table '+a);assert.equal(kits[a].u,u,'server ult points '+a);}
 // offline KITS ult points
 const km=html.match(/const KITS = (\{[\s\S]*?\n\});/);assert.ok(km,'offline KITS');const K=vm.runInNewContext('('+km[1]+')');
 for(const [a,u] of Object.entries(want))assert.equal(K[a].u,u,'offline ult points '+a);
 console.log('Round timers / Spike / economy / ult points: offline page and server match the wiki (buy 45 s on rounds 1, 13, 25)');})().catch(e=>{console.error(e);process.exit(1);});
