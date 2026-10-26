// hk-37: offline Blade Storm FP probe (no browser): Jett Wushu X poses through the FOV-matched ability rig + floating daggers, rendered at the 70.53 deg world camera.
//   cd server && node tools/bs-fov-probe.mjs <out.png>
import * as THREE from 'three';import {runtime,build,renderCam,sheet} from './ability-fp-view.mjs';
const api=runtime(),B=await build('Jett',api),G=api.XAF_GUN.bs,R=B.R;B.cam.fov=70.53;B.cam.aspect=16/9;api.xAfFov(R,70.53);
const M=api.xAfGunModel(R,'bs');for(let i=0;i<200&&!M.ok;i++)await new Promise(r=>setTimeout(r,20));
const cells=[];
for(const [clip,u,n] of [[G.eq,.5,5],[G.idle,.3,5],[G.fire[0],.12,4],[G.fire[1],.14,3],[G.alt,.2,5],[G.idle,.6,2]]){api.xAfGunPose(R,'bs',{clip,u});M.g.visible=api.xAfKnifePose(R,M,n)>0;
  M.g.traverse(o=>{if(o.isMesh)o.name='xaf-prop-k';});let p=M.g;p.name='xaf-prop-ring';
  cells.push(renderCam(B.cam,null,{W:480,H:270,fov:70.53}));}
await sheet(process.argv[2]||'/tmp/bsfov.png',cells,3);
