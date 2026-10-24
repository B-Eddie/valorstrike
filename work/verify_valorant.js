// Real-browser validation of native models, rigs, clips and the playable range.
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));if(m.type()==='warning'&&/PropertyBinding|bone|Valorant|native/.test(m.text()))warnings.push(m.text().slice(0,220));});
for(const [url,file]of [['**/three@*/build/three.min.js','three.min.js'],['**/three@*/examples/js/loaders/GLTFLoader.js','GLTFLoader.js'],['**/three@*/examples/js/utils/SkeletonUtils.js','SkeletonUtils.js']])await page.route(url,r=>r.fulfill({path:'/workspace/work/qa/'+file,contentType:'application/javascript'}));
await page.goto(process.env.GAME_URL||'http://localhost:8000/valorstrike/');await page.waitForFunction(()=>window.xValorantAssets);
await page.getByRole('button',{name:'Got it',exact:true}).click();await page.locator('#playBtn').click();await page.locator('#xqRange').click();await page.locator('#preGo').click();await page.waitForTimeout(7000);console.log('range start',await page.evaluate(()=>xValorantAssets.probe()),errors);await page.screenshot({path:'/tmp/valorant-range-start.png'});await page.locator('canvas').filter({visible:true}).first().click({position:{x:400,y:400},force:true}).catch(()=>{});
const states=[];for(const [key,weapon]of [['5','Vandal'],['2','Sheriff'],['7','Operator'],['8','Knife']]){
 await page.keyboard.press(key);await page.waitForFunction(w=>xValorantAssets.state.fp&&xValorantAssets.state.fp.w===w,weapon,{timeout:20000});await page.waitForTimeout(500);const p=await page.evaluate(()=>xValorantAssets.probe());if(p.failures&&Object.keys(p.failures).length)errors.push(JSON.stringify(p.failures));states.push(p.nativeFP);
 if(weapon==='Vandal'){await page.screenshot({path:'/tmp/valorant-range.png'});await page.keyboard.press('y');await page.waitForTimeout(500);await page.screenshot({path:'/tmp/valorant-inspect.png'});}
}
const matrix=await page.evaluate(async()=>{
 const A=xValorantAssets,agents=['Jett','Phoenix','Sova','Sage','Reyna','Raze','Killjoy','Omen','Skye','Chamber','Breach','Cypher'],weapons=['Classic','Shorty','Frenzy','Ghost','Sheriff','Stinger','Spectre','Bucky','Judge','Bulldog','Guardian','Phantom','Vandal','Marshal','Outlaw','Operator','Ares','Odin','Knife'],bad=[];let rigs=0,clips=0;
 for(const ag of agents){const kit=await A.loadAgent(ag);for(const c of Object.values(kit.C)){for(const t of c.tracks){if(!kit.gl.scene.getObjectByName(t.name.split('.')[0]))bad.push(ag+' missing '+t.name);}clips++;}}
 for(const [ag,w]of weapons.map(w=>['Jett',w]).concat(agents.slice(1).map(ag=>[ag,'Vandal']))){const F=await A.loadFP(ag,w);for(const entry of F.entries){const a=F.ac[entry.Name];if(!a){bad.push(ag+' '+w+' missing '+entry.Name);continue;}F.am.stopAllAction();a.play();for(const t of [0,.3,.8]){a.time=t*a.getClip().duration;F.am.update(0);F.sc.updateMatrixWorld(true);F.sc.traverse(o=>{if(o.isBone&&!o.matrixWorld.elements.every(Number.isFinite))bad.push(ag+' '+w+' invalid bone '+o.name);});}}
  F.am.stopAllAction();F.gm.stopAllAction();F.root.traverse(o=>{if(o.isMesh)[].concat(o.material||[]).forEach(m=>m.dispose());});rigs++;
 }
 return {agents:agents.length,movementClips:clips,firstPersonRigs:rigs,bad};
});
console.log(JSON.stringify({states,matrix,errors,warnings:[...new Set(warnings)].slice(0,12)},null,2));await browser.close();if(errors.length||matrix.bad.length||warnings.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
