// Spawn barriers on the page (generated index.html): the shared vendor/spawn-barriers.cjs is inlined (byte-identical
// to the vendor file), and the native-map buy phase uses it instead of the old straight plane:
//  1. Visual creation (native_maps_runtime xSbBuild / xSbTick, run in a vm with real three.js): on each of the six maps,
//     once the buy phase runs, one mesh per wall piece is in the scene, centred on the piece at its height, its local x
//     axis along the piece and its width = the piece's length, height = its span; translucent, both sides, no depth
//     write, additive, drawn after the map; tinted by team (your spawn teal, the enemy's red, swapped when you swap sides).
//  2. Round start drop: FV.buy -> 0: the walls flash (glow up), sink and fade (alpha down every frame) and are hidden after
//     SpawnBarriers.DROP s; the next buy phase shows them again at full alpha on their spot.
//  3. Collision on the page: nmBlocked (player motor, bots, online prediction) reports a capsule touching a wall while
//     FV.buy > 0 in a 5v5, not after it, not in deathmatch; same answer as the shared SpawnBarriers.blocked the server's
//     world.blocked uses (parity).
//  4. The old plane: fiveTick / mpCliTick5 clamp the player to z = +-edge only when no native spawn walls are active
//     (xSbOn), and XBR's straight plane is hidden on a native map.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');const root=path.join(__dirname,'..');
const req=require('module').createRequire(path.join(root,'server/package.json')),T=req('three');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),vendor=fs.readFileSync(path.join(root,'vendor/spawn-barriers.cjs'),'utf8').trimEnd();
assert(html.includes(vendor),'index.html carries vendor/spawn-barriers.cjs verbatim (run python3 work/install_valorant.py)');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);if(i<0||j<0)throw Error('marker missing: '+a);return html.slice(i,j);};
const visual=cut('var XSBV={','window.xSbVis=XSBV;'),nmq=cut('var NM_Q=','\n'),onFn=cut('function xSbOn(){','\n'),nmB=cut('function nmBlocked(C,x,z,r,y,height=1.8){','\n}\n')+'\n}\n';
// 4. static: the plane clamp is the fallback only
const clamp=html.split('\n').filter(l=>l.includes('player.z = FV.atk ? Math.max(e, player.z) : Math.min(-e, player.z)'));
assert.equal(clamp.length,2,'fiveTick + mpCliTick5 buy clamps');for(const l of clamp)assert(/if \(!\(typeof xSbOn === "function" && xSbOn\(\)\)\)/.test(l),'plane clamp only without native walls: '+l.trim().slice(0,80));
assert(/A\.visible = B\.visible = !nat;/.test(html),'XBR plane hidden on a native map');
const maps=['ascent','bind','breeze','haven','lotus','split'];let summary=[];
for(const key of maps){
 const scene=new T.Scene(),ctx={THREE:T,Math,Object,Number,Infinity,Array,JSON,String,Error,console,scene,running:true,mode:'five',FV:{buy:30,dm:false,atk:true},performance:{now:()=>ctx.now},now:0};
 ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(vendor,ctx);
 const C={key,bvh:{shapecast(){return false;}}};ctx.nmActive=()=>C;ctx.nmHeight=()=>0;
 vm.runInContext(nmq+'\n'+onFn+'\n'+visual+'\nglobalThis.api={xSbTick,xSbBuild};\n'+nmB+'\nglobalThis.nmBlocked=nmBlocked;',ctx);
 const SB=ctx.SpawnBarriers,P=SB.pieces(key);assert(P.length>=4,key+' pieces');assert.equal(vm.runInContext('xSbOn()',ctx),true);
 const frame=dt=>{ctx.now+=dt*1000;ctx.api.xSbTick();};frame(.016);frame(.016);
 // 1. creation
 const M=ctx.XSBV.list;assert.equal(M.length,P.length,key+': one mesh per piece');
 M.forEach((m,i)=>{const p=P[i];assert(m.parent===scene&&m.visible,key+' mesh shown');m.updateMatrixWorld(true);
  const c=new T.Vector3().setFromMatrixPosition(m.matrixWorld);assert(Math.abs(c.x-(p.ax+p.bx)/2)<1e-6&&Math.abs(c.z-(p.az+p.bz)/2)<1e-6&&Math.abs(c.y-(p.y0+p.y1)/2)<1e-6,key+' mesh centred on its piece');
  const ax=new T.Vector3(1,0,0).transformDirection(m.matrixWorld);assert(Math.abs(Math.abs(ax.x*p.tx+ax.z*p.tz)-1)<1e-6,key+' mesh along its piece');
  const g=m.geometry.parameters;assert(Math.abs(g.width-p.len)<1e-9&&Math.abs(g.height-(p.y1-p.y0))<1e-9,key+' mesh size');
  const mt=m.material;assert(mt.transparent&&mt.side===T.DoubleSide&&mt.depthWrite===false&&mt.blending===T.AdditiveBlending,key+' translucent, both sides');assert(m.renderOrder>0);
  assert.equal(mt.uniforms.uA.value,1);const want=p.side==='atk'?0x35e0c8:0xff4655;assert.equal(mt.uniforms.uC.value.getHex(),want,key+' team tint ('+p.side+')');
  assert(/hx\(/.test(mt.fragmentShader)&&/gl_FragColor/.test(mt.fragmentShader),'hex lattice shader');});
 // 3. collision on the page (parity with the shared function the server uses)
 let hits=0;for(const p of P){const mx=(p.ax+p.bx)/2,mz=(p.az+p.bz)/2,y=p.y0+.4;for(const off of [0,.3,.44,.6]){const x=mx+p.nx*off,z=mz+p.nz*off,a=ctx.nmBlocked(C,x,z,.4,y,1.8),b=SB.blocked(key,x,z,.4,y,1.8);assert.equal(a,b,key+' page vs shared');if(a)hits++;}}
 assert(hits>=P.length*2,key+' walls block on the page');
 // 2. round start drop
 ctx.FV.buy=0;let lastA=2,lastY=Infinity,flash=0;for(let k=0;k<Math.ceil(SB.DROP/.05)-1;k++){frame(.05);const m=M[0],U=m.material.uniforms;if(!m.visible)break;assert(U.uA.value<=lastA+1e-12,key+' fades');assert(m.position.y<=lastY+1e-12,key+' sinks');lastA=U.uA.value;lastY=m.position.y;flash=Math.max(flash,U.uG.value);}
 assert(flash>1,key+' flashes as it drops');
 /* barrier-3: sky-tall walls (12 - 22 m) sink their whole height: on the last visible frame every wall's top is within a quarter of its height over its foot, and alpha is near 0 */
 M.forEach((m,i)=>{if(!m.visible)return;const p=P[i],h=p.y1-p.y0,top=m.position.y+h/2;assert(top-p.y0<=h*.25+1e-6,key+' wall '+i+' (h '+h.toFixed(1)+') sunk to '+(top-p.y0).toFixed(2)+' m over its foot near the end of the drop');assert(m.material.uniforms.uA.value<.05,key+' wall '+i+' faded');});
 P.forEach((p,i)=>{const h=p.y1-p.y0;assert(h-SB.drop(SB.DROP,h).sink<=1e-9,key+' wall '+i+' fully under its foot at DROP');});
 frame(.1);frame(.1);assert(M.every(m=>!m.visible),key+' hidden after the drop');
 {const p=P[0],mx=(p.ax+p.bx)/2,mz=(p.az+p.bz)/2;assert.equal(ctx.nmBlocked(C,mx,mz,.4,p.y0+.4,1.8),false,key+' no collision after the drop');ctx.FV.buy=5;ctx.FV.dm=true;assert.equal(ctx.nmBlocked(C,mx,mz,.4,p.y0+.4,1.8),false,key+' none in deathmatch');ctx.FV.dm=false;}
 // next buy phase, sides swapped: shown again, tints swap
 ctx.FV.buy=30;ctx.FV.atk=false;frame(.016);assert(M.every(m=>m.visible&&m.material.uniforms.uA.value===1),key+' back next round');
 M.forEach((m,i)=>{assert.equal(m.material.uniforms.uC.value.getHex(),P[i].side==='def'?0x35e0c8:0xff4655,key+' tint follows your side');assert(Math.abs(m.position.y-(P[i].y0+P[i].y1)/2)<1e-9);});
 summary.push(key+' '+P.length+' walls');}
console.log('Spawn barriers (page): '+summary.join(', '));console.log('test_spawn_barriers_client: OK');
