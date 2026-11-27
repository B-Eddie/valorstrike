(()=>{const out={};window.__seed(4242);const C=window.__cp,y=C.gy;
const tries=[['xCbCloud',()=>xCbCloud(C.x-2.5,y+1.7,C.z-6,40)],['blazeWall',()=>blazeWall(C.x+2.5,y,C.z-5,0,-1)],['sgxBarrierWall',()=>sgxBarrierWall(new THREE.Vector3(C.x,y,C.z-9),0.3,{})],['brxSkySmokeAt',()=>brxSkySmokeAt(new THREE.Vector3(C.x+3,y,C.z-9),20,4)],['omxCoverDome',()=>omxCoverDome(new THREE.Vector3(C.x-3,y,C.z-10),3,20)]];
for(const [n,f] of tries){try{const r=f();out[n]='ok';}catch(e){out[n]='err '+String(e).slice(0,120);}}
// ability FX update their shader clocks from game time in the loop: one fixed-dt FX tick if the page has one, nothing else
return JSON.stringify(out);})()
