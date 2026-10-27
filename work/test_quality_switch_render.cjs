// Graphics quality switches keep the screen drawn (user: "if I change quality, everything turns black").
// The real page (work/page_harness.cjs, native: real native-map loader, nav, collision) with the REAL three r149
// WebGLRenderer running over a do-nothing WebGL context (work/fake_webgl.js), so render() executes three's own code:
// buffer creation, program setup, the draw calls. The native map scene is a small synthetic glTF stand-in that goes
// through the real prepare / optimize / budget path (attribute arrays and images dropped once uploaded), and its
// texture upload phase is stretched to 1.5 s, as a real map's reload takes seconds in a browser.
// A quality preset that toggles anti-aliasing makes a new WebGL context (xRemake) and reloads the map (nmRehydrate).
// A second context change while that reload was still uploading was ignored ("reload already running"): the reload's
// scene had been drawn by the in-between renderer (CPU copies gone), so the newest renderer threw on every frame
// ("THREE.WebGLAttributes: Unsupported buffer data format: null") before clearing, and the fresh canvas stayed black.
// Checked: every preset order, back-to-back AA toggles, render scale / resolution / shadows / skyline, the change made
// mid-match, paused in Settings, and in the lobby before a match: afterwards the current renderer draws every frame,
// no render exception at any point after the change, and the map scene on screen is the current one, visible and drawn.
//   node work/test_quality_switch_render.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const fails=[];const fail=s=>{fails.push(s);console.log('FAIL',s);};
async function run(name,steps,{lobbyFirst=false,pause=false}={}){
 const H=boot({real3:true,seed:3,native:true}),xe=H.xe,tick=()=>new Promise(r=>setImmediate(r));
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await tick();}};
 xe(fs.readFileSync(path.join(__dirname,'fake_webgl.js'),'utf8')+';true');
 // synthetic native map: 6 indexed meshes with textured materials (names the converter treats as floors / walls)
 xe(`THREE.WebGLRenderer=function(p){return __realRenderer(p);};
  window.__mkScene=function(){const g=new THREE.Group();for(let i=0;i<6;i++){const geo=new THREE.BoxGeometry(6,1+i,6,6,2,6);const t=new THREE.Texture({width:64,height:64});t.needsUpdate=true;const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({name:(i%2?'Brick_M'+i+'_MI':'Floor_M'+i+'_MI'),color:0x888888,map:t}));m.position.set(i*7-20,0,0);m.updateMatrix();g.add(m);}return g;};
  nmLoadScene=function(){return new Promise(r=>setTimeout(()=>r({scene:__mkScene(),animations:[]}),300));};
  {const up=nmUpload;nmUpload=async function(t,live){await new Promise(r=>setTimeout(r,1500));return up.apply(this,arguments);};}
  true`);
 xe('xRemake();true');if(xe('typeof renderer.__id')!=='number')throw Error('real renderer not installed');
 const click=(seg,v)=>xe(`(()=>{const b=[...document.querySelectorAll("#${seg} button")].find(b=>b.dataset.v===${JSON.stringify(v)});if(!b)return false;b.click();return true;})()`);
 const frame=async(ms)=>{const r0=xe('renderer.__id'),d0=xe('renderer.__draws'),e0=xe('__GL.errors.length');await adv(ms);return {same:xe('renderer.__id')===r0,draws:xe('renderer.__draws')-d0,errs:xe('__GL.errors.slice('+e0+').map(e=>e.msg)')};};
 if(lobbyFirst)for(const [seg,v,gap] of steps){if(!click(seg,v))fail(name+': no button '+seg+'='+v);await adv(gap);}
 xe(`J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true`);
 for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running&&!(NM.current&&NM.current.rehydrating))');i++)await adv(200);
 if(!xe('!!nmActive()&&running')){fail(name+': native match did not start');return;}
 await adv(2500);const base=await frame(1000);if(!base.draws||base.errs.length){fail(name+': baseline not drawing '+JSON.stringify(base));return;}
 if(pause){H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);try{H.$('xSet').click();}catch(e){}await adv(300);if(!xe('paused'))fail(name+': not paused');}
 const eStart=xe('__GL.errors.length');
 if(!lobbyFirst)for(const [seg,v,gap] of steps){if(!click(seg,v))fail(name+': no button '+seg+'='+v);await adv(gap);}
 // let every reload finish (stretched upload 1.5 s + load 0.3 s), then the screen must be drawn by the current renderer
 for(let i=0;i<40&&xe('!!(NM.current&&NM.current.rehydrating)');i++)await adv(250);
 await adv(500);const f=await frame(1000);
 const map=xe(`(()=>{const C=NM.current,s=C&&C.scene;if(!s)return null;let meshes=0,released=0,drawn=0;s.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;if(!p.array)released++;});let vis=true;for(let p=s;p;p=p.parent)if(!p.visible)vis=false;return {meshes,released,vis,inScene:C.M.g.children.includes(s),aa:XS.aa,id:renderer.__id,gq:localStorage.getItem('vs.gq')};})()`);
 const errsAll=xe('__GL.errors.length')-eStart;
 const ok=f.same&&f.draws>0&&!f.errs.length&&!errsAll&&map&&map.vis&&map.inScene&&map.meshes>0;
 console.log((ok?'ok  ':'FAIL')+' '+name+': renderer '+map.id+' aa '+map.aa+' gq '+map.gq+', draws/s '+f.draws+', render errors '+f.errs.length+' (since the change '+errsAll+')'+(f.errs.length?' ('+f.errs[0]+')':'')+', map visible '+(map&&map.vis)+' meshes '+(map&&map.meshes));
 if(!ok)fail(name+': screen not drawn after the change '+JSON.stringify({f:{...f,errs:f.errs.slice(0,1)},map}));
}
(async()=>{
 const G='xGQ';
 // the reported case: two presets that each toggle anti-aliasing, the second while the first map reload is still running
 await run('medium -> low -> medium (2nd change mid-reload)',[[G,'low',800],[G,'medium',100]]);
 await run('medium -> low -> high -> low, 0.6 s apart',[[G,'low',600],[G,'high',600],[G,'low',100]]);
 await run('medium -> low, then medium after the reload',[[G,'low',3000],[G,'medium',100]]);
 await run('anti-aliasing off/on back to back',[['xAA','0',700],['xAA','1',100]]);
 await run('render scale, resolution, shadows, skyline, low, high',[['xRsc','0.7',200],['xRes','std',200],['xShd','all',200],['xSky','0',200],[G,'low',700],[G,'high',100]]);
 await run('paused in Settings: low then medium',[[G,'low',800],[G,'medium',100]],{pause:true});
 await run('lobby: low then medium, then a match',[[G,'low',100],[G,'medium',100]],{lobbyFirst:true});
 if(fails.length){console.log(fails.length+' failure(s)');process.exit(1);}
 console.log('Quality switches keep the screen drawn: preset orders incl. a second context change mid map reload, AA toggles, render scale / resolution / shadows / skyline, paused in Settings, lobby; the current renderer draws every frame with no render exception and the map scene shown is the current one');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
