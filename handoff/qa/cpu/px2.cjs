// lane.cjs step: pixel A/B via compositor screenshots (GPU readPixels OOM-kills Chromium on this box). Loop stopped; per pose
// render OFF (three's update/skeleton/sort = origin/main) -> screenshot, ON -> screenshot, OFF again -> screenshot (noise check).
const fs=require('fs'),sharp=require('/workspace/work/vs-lane-cpu/server/node_modules/sharp');
module.exports=async(X,page,R,log)=>{
 const out=process.env.PX_OUT||'/workspace/work/qa/cpu/px';fs.mkdirSync(out,{recursive:true});const N=+(process.env.POSES||4);
 await X(`(()=>{cancelAnimationFrame(loop.id);loop=function(){};window.__pxSet=(on)=>{const f=on===true?'111':on===false?'000':on;XSGR.mw=f[0]==='1';XSGR.sk=f[1]==='1';XSGR.sort=f[2]==='1';};return 1;})()`);
 await page.waitForTimeout(1500);
 const base=JSON.parse(await X(`JSON.stringify({x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:camera.rotation.y})`));
 const box=JSON.parse(await X(`(()=>{const r=renderer.domElement.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,width:r.width,height:r.height});})()`));log('box',JSON.stringify(box));const lost=async(t)=>{const l=await X(`renderer.getContext().isContextLost()`);log('lost?',t,l);if(l)throw new Error('context lost at '+t);};await lost('start');log('xcr',await X(`String(window.XCR&&XCR.lost&&XCR.lost.message)+' '+(document.getElementById('xCtxLost')?'overlay':'nooverlay')+' canvases:'+document.querySelectorAll('canvas').length`));await X(`(()=>{const s=document.createElement('style');s.textContent='#xCtxLost{display:none!important}';document.head.appendChild(s);return 1;})()`);
 const shot=async(on)=>{await X(`__pxSet(${JSON.stringify(on)});renderer.render(scene,camera);1`);await page.waitForTimeout(400);const b=await page.screenshot({clip:box,timeout:300000});return (await sharp(b).raw().toBuffer());};
 R.px=R.px||[];
 for(let i=0;i<N;i++){const yaw=base.yaw+i*2*Math.PI/N;const t0=Date.now();
  await X(`camera.position.set(${base.x},${base.y},${base.z});camera.rotation.set(${i%2?-0.08:0.02},${yaw},0,'YXZ');camera.updateMatrixWorld();1`);
  await X(`__pxSet(false);renderer.render(scene,camera);__pxSet(true);renderer.render(scene,camera);1`);
  await lost('pre'+i);const A=await shot('000');const cf=(process.env.PXCFG||'111').split(',');const r0={};const W=Math.round(box.width);
  for(const c of cf){const B=await shot(c);let diff=0,max=0,where=[];for(let k=0;k<A.length;k+=3){let d=0;for(let q=0;q<3;q++)d=Math.max(d,Math.abs(A[k+q]-B[k+q]));if(d){diff++;if(d>max)max=d;if(where.length<12)where.push([(k/3)%W,Math.floor(k/3/W),d]);}}r0['c'+c]={diff,max,where};if(c==='111')await sharp(B,{raw:{width:W,height:Math.round(box.height),channels:3}}).png().toFile(out+'/'+R.map+'_'+R.gq+'_pose'+i+'.png');}
  const A2=await shot('000');let rep=0;for(let k=0;k<A.length;k++)if(A[k]!==A2[k])rep++;await lost('A2'+i);
  const info=JSON.parse(await X(`JSON.stringify({calls:renderer.info.render.calls,tris:renderer.info.render.triangles,sortF:XSGR.f,skipped:XSGR.skipped,deferred:XSGR.deferred,flushed:XSGR.flushed})`));
  const r={pose:i,px:A.length/3,...r0,offRepeatDiff:rep,...info,ms:Date.now()-t0};log('px',JSON.stringify(r));R.px.push(r);
 }
};
