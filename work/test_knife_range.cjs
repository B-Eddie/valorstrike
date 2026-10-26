// Knife reach parity: 2 m from the eye for the client knife ray (5v5 / retake shoot, duel, aim training) and the server
// (simulation.js KNIFE_RANGE: the Knife trace limit and its damage row), so no swing lands on one side and not the other
// (was client 2.2 m, server damage row 3 m).   node work/test_knife_range.cjs
const assert=require('assert/strict'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/const KNIFE_RANGE = 2;/,'client KNIFE_RANGE 2 m');
 {const line=html.split('\n').find(l=>l.includes('const KNIFE_RANGE'));assert.ok(/\*\/ let kHv = 0, kLg = 0, kLx = 0, kLz = 0;$/.test(line),'knife state declarations still live on the KNIFE line (not swallowed by a comment)');}
 assert.equal((html.match(/ray\.far = KNIFE_RANGE;/g)||[]).length,3,'shoot, duel and aim-training knife rays use KNIFE_RANGE');
 assert(!/SFX\.knife\(\);[^\n]{0,80}ray\.far = 2\.2/.test(html)&&!/ray\.far = 2\.2; const hit/.test(html),'no 2.2 m knife ray left');
 const S=await import('file://'+path.join(root,'server/src/simulation.js'));
 assert.equal(S.KNIFE_RANGE,2);assert.equal(S.weapons.Knife.damageRanges.at(-1).rangeEndMeters,2,'server damage row ends at 2 m');
 const W={map:{attacker:[0,0,0],defender:[0,0,-2]},nav:{nodes:[[0,0,0],[0,0,-2]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const k=new S.Simulation(W,'tdm','ascent',()=>.5),a=k.add('a'),b=k.add('b');k.start(false);
 const swing=(z)=>{k.spawn(b);Object.assign(a,{weapon:'Knife',ammo:1,fireAt:0,x:0,y:0,z:0,look:0,pitch:0,sf:0,air:false,lp:0,protectedUntil:0,triggerHeld:false,alive:true,input:{fire:true}});
  Object.assign(b,{x:0,y:0,z,look:Math.PI,protectedUntil:0,armor:0,hp:200,alive:true});k.fire(a);return 200-b.hp;};
 let last=0,edge=null;for(let z=-1;z>=-3.5;z-=0.05){const d=swing(z);if(d>0)last=-z;else if(edge==null&&last)edge=-z;}
 assert.ok(last>1.5&&last<2.6,'server knife reach (target origin) '+last.toFixed(2)+' m');assert.equal(swing(-3),0,'no hit at 3 m');
 console.log('knife range: client KNIFE_RANGE 2 m (shoot / duel / aim) == server KNIFE_RANGE 2 m (trace + damage row); server last hit with the target '+last.toFixed(2)+' m away, none at 3 m');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
