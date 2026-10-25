// Third-person grip vs the per-frame bot visual pass (browser finding, Oct 2026). The grip writes the held gun's
// quaternion in the animation tick; xVisB later ran `M.gun.rotation.x = M.ub ? 0 : -b.xap` every frame, which
// re-derives the quaternion from Euler and threw the muzzle 30-60° off the aim on rendered frames. Runs the real
// xVisB statement from index.html against a gripped rig and checks the muzzle still follows the aim.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const _w=console.warn;console.warn=(...a)=>{if(!/boneTransform/.test(String(a[0])))_w(...a);};
(async()=>{
 const G=await import(path.join(root,'server/tools/grip-view.mjs'));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const vis=html.slice(html.indexOf('function xVisB('),html.indexOf('\n}',html.indexOf('function xVisB(')));
 const line=vis.split('\n').find(l=>l.includes('M.xap = b.xap;'));assert(line,'xVisB aim-pitch statement found');
 const stmt=line.slice(line.indexOf('M.xap = b.xap;'),line.indexOf('if (M.hd)'));
 assert(!/M\.gun\.rotation\.x\s*=\s*M\.ub\s*\?/.test(stmt),'xVisB no longer writes the gripped gun rotation for native rigs');
 const api=G.runtime();
 for(const [agent,weapon] of [['jett','vandal'],['breach','operator'],['jett','sheriff']]){const R=await G.build(agent,weapon,api);
  R.M.ub=1;for(const pit of [-0.4,0,0.4]){R.play('idle','aim');R.X.pit=pit;R.step(30);const before=G.measure(R).aimErr;
   // the bot visual pass runs after the animation tick on the same frame
   new Function('M','b',stmt)(R.M,{xap:pit});R.M.gun.updateMatrixWorld(true);const after=G.measure(R).aimErr;
   assert(before<0.01,agent+'/'+weapon+'/'+pit+' grip aims '+before.toFixed(4));
   assert(after<0.01,agent+'/'+weapon+'/'+pit+' muzzle still on the aim after the bot visual pass '+after.toFixed(4));}}
 console.log('grip survives the per-frame bot visual pass');
})().catch(e=>{console.error(e);process.exit(1);});
