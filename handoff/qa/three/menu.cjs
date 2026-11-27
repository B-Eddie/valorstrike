// menu renderers for the pixel gate (h.cjs MODE=map STEPS=node:menu.cjs,views): the skin collection 3D preview (XSK.pv,
// own WebGLRenderer, PMREM environment, legacy lights) and the agent-select viewer (AGV, own renderer, legacy lights),
// each frozen at a fixed pose, rendered once and read back with readPixels (raw RGBA, bottom-up, its own w x h).
const fs = require('fs');
module.exports = async (X, page, R, log) => {
  const base = '/workspace/work/qa/three/shots/' + R.map + '-' + R.gq + '-' + R.tag;
  await X(`window.__rpR=(r)=>{const gl=r.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,b=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);const i=r.info.render;let s='';for(let k=0;k<b.length;k+=32768)s+=String.fromCharCode.apply(null,b.subarray(k,k+32768));return JSON.stringify({w,h,calls:i.calls,tris:i.triangles,px:btoa(s)});};1`);
  const shot = async (name, js) => { const r = JSON.parse(await X(js)); fs.writeFileSync(base + '-' + name + '.rgba', Buffer.from(r.px, 'base64')); R.shots[name] = { calls: r.calls, tris: r.tris, w: r.w, h: r.h }; log('shot', name, r.w + 'x' + r.h, 'calls', r.calls, 'tris', r.tris); };
  const until = async (expr, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await X(expr)) return true; await page.waitForTimeout(1000); } return false; };
  // skin preview: Vandal Prime, then the BlastX knife
  for (const [w, sk, id] of [['Vandal', 'prime', 'prime.1'], ['Knife', 'blastx', 'blastx']]) {
    log('xsk', w, await X(`(()=>{try{xskGive(${JSON.stringify(w)},${JSON.stringify(sk)});xskEquip(${JSON.stringify(w)},${JSON.stringify(id)});}catch(e){return 'give err '+e;}if(document.getElementById('xSk')&&!document.getElementById('xSk').hidden&&XSK.w===${JSON.stringify(w)})return 'open';xskOpen('col');XSK.w=${JSON.stringify(w)};XSK.pick=null;xskRender();try{xskPreview();}catch(e){return 'pv err '+e;}return String(!!XSK.pv);})()`));
    const ok = await until(`!!(XSK.pv&&XSK.pv.state==='ready'&&XSK.pv.w>0)`, 120000); log('xsk ready', w, ok, await X(`XSK.pv&&(XSK.pv.key+' '+XSK.pv.state+' '+XSK.pv.w+'x'+XSK.pv.h)`));
    if (!ok) continue; await page.waitForTimeout(1500);
    await shot('xsk_' + w.toLowerCase(), `(()=>{const P=XSK.pv;cancelAnimationFrame(P.raf);P.raf=0;P.yaw=1.05;P.pitch=0.12;P.piv.rotation.set(P.pitch,P.yaw,0);P.r.render(P.sc,P.cam);return window.__rpR(P.r);})()`);
    await X(`xskClose();1`);
  }
  // agent select viewer: Sova, idle at a fixed time, fixed turn
  log('agv', await X(`(()=>{try{document.getElementById('pre').style.display='none';document.getElementById('xAg').style.display='flex';agView('Sova');}catch(e){return 'err '+e;}return String(!!AGV.cur);})()`));
  const okA = await until(`!!(AGV.r&&AGV.cur&&AGV.cur.valorant)`, 120000); log('agv ready', okA); await page.waitForTimeout(3000);
  if (okA) await shot('agv_sova', `(()=>{cancelAnimationFrame(AGV.raf);AGV.raf=0;AGV.tV=null;const M=AGV.cur;AGV.g.rotation.y=-0.35;
    let mx=null;for(const k of Object.keys(M)){const q=M[k];if(q&&typeof q==='object'&&q.mx&&typeof q.mx.setTime==='function'){mx=q;break;}}
    if(mx){mx.mx.stopAllAction();const A=mx.a||{};const k=['idle','Idle','stand'].find(n=>A[n])||Object.keys(A)[0];if(k){const a=A[k];a.reset();a.enabled=true;a.setEffectiveWeight(1);a.setEffectiveTimeScale(1);a.play();}mx.mx.setTime(0.5);}
    if(M.bd){M.bd.scale.set(1,1,1);M.bd.position.y=0;M.bd.rotation.set(0,0,0);}if(M.aL)M.aL.rotation.x=-1.25;if(M.aR)M.aR.rotation.x=-1.35;if(M.hd)M.hd.rotation.set(0,0,0);
    AGV.sc.updateMatrixWorld(true);AGV.r.render(AGV.sc,AGV.cam);return window.__rpR(AGV.r);})()`);
  await X(`document.getElementById('xAg').style.display='none';document.getElementById('pre').style.display='';1`);
};
