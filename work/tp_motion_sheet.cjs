// Pose strips of third-person movement through the shipped animation pipeline (tp_anim_sim.cjs), rasterized offline.
//   node work/tp_motion_sheet.cjs <scenario> <out.png> [agent] [cells] [view side|front|back|q]
// scenarios: jump (standing jump), runjump (5.4 m/s run + jump), run (5.4 m/s), walk (3.24 m/s shift-walk), strafe (A at 5.4),
// diag (W+A), back (S), stop (run then release), jiggle (A/D peek), crouch (crouch-walk 2.0), turn (turn in place 90 deg).
// Also prints foot-slide numbers: world drift (cm) of each foot contact (foot bone within 1.2 cm of its standing height).
const {sim,T}=require('./tp_anim_sim.cjs'),{render}=require('./rig_harness.cjs'),fs=require('fs'),cp=require('child_process');
const SC={
 jump:{T:.9,pre:.4,f:(t)=>({x:0,z:0,y:arc(t-.4)})},
 runjump:{T:1.1,pre:.6,f:(t)=>({x:0,z:5.4*t,y:arc(t-.6)})},
 run:{T:.8,pre:.6,f:(t)=>({x:0,z:5.4*t,y:0})},
 walk:{T:1,pre:.6,f:(t)=>({x:0,z:3.24*t,y:0})},
 crouch:{T:1.2,pre:.6,cr:1,f:(t)=>({x:0,z:2.0*t,y:0})},
 strafe:{T:.8,pre:.6,f:(t)=>({x:5.4*t,z:0,y:0})},
 diag:{T:.8,pre:.6,f:(t)=>({x:5.4*t/Math.SQRT2,z:5.4*t/Math.SQRT2,y:0})},
 back:{T:1,pre:.6,f:(t)=>({x:0,z:-5.4*t,y:0})},
 stop:{T:.7,pre:.6,f:(t)=>{const r=Math.min(t,.6);const s=t<.6?0:Math.max(0,stopDist(t-.6));return {x:0,z:5.4*r+s,y:0};}},
 jiggle:{T:1.2,pre:.2,f:(t)=>({x:jig(t),z:0,y:0})},
 turn:{T:.8,pre:.3,f:(t)=>({x:0,z:0,y:0,yaw:Math.min(1,Math.max(0,(t-.3)/.25))*Math.PI/2})},
};
function arc(t){if(t<=0)return 0;const y=6.902*t-.5*20.45*t*t;return Math.max(0,y);}
function stopDist(t){let v=5.4,x=0;for(let s=0;s<t;s+=1/240){v=Math.max(0,v-(7.3625*v+46.5)/240);x+=v/240;}return x;} // VALORANT release friction
function jig(t){ // 0.15 s out at full accel, 0.15 back, 0.2 hold, repeated (the bots' jiggle)
 let x=0,v=0;for(let s=0;s<t;s+=1/240){const c=s%0.5,dir=c<.15?1:c<.3?-1:0;const tgt=dir*5.4;if(dir){v+=Math.sign(tgt-v)*Math.min(Math.abs(tgt-v),5.4/.288/240);}else{const d=(7.3625*Math.abs(v)+46.5)/240;v=Math.abs(v)<=d?0:v-Math.sign(v)*d;}x+=v/240;}return x;}
(async()=>{const [name='run',out='/tmp/tp.png',agent='jett',nc='8',view='side']=process.argv.slice(2),S=SC[name],n=+nc;if(!S)throw Error('scenario '+name);
 const sm=await sim(agent),dt=1/60,frames=Math.round(S.T/dt)+Math.round(S.pre/dt);const shots=[],files=[];const every=Math.max(1,Math.floor((frames-Math.round(S.pre/dt))/n));
 const stats={contacts:[],maxSlide:0};let plant=[null,null];
 for(let i=0;i<60;i++)sm.frame(dt,0,0,0,0,{cr:S.cr});const fy0=Math.min(sm.at('L_Foot').y,sm.at('R_Foot').y);
 for(let i=1;i<=frames;i++){const t=i*dt,p=S.f(t);sm.frame(dt,p.x,p.y,p.z,p.yaw||0,{cr:S.cr});
  ['L_Foot','R_Foot'].forEach((bn,k)=>{const f=sm.at(bn);const low=f.y-p.y<fy0+.012&&p.y<.01;if(low){if(!plant[k])plant[k]={x:f.x,z:f.z,d:0};else plant[k].d=Math.max(plant[k].d,Math.hypot(f.x-plant[k].x,f.z-plant[k].z));}else if(plant[k]){stats.contacts.push(+(plant[k].d*100).toFixed(1));plant[k]=null;}});
  if(i>=Math.round(S.pre/dt)&&(i-Math.round(S.pre/dt))%every===0&&shots.length<n){const f=`/tmp/tpms-${shots.length}.png`;const cx=p.x,cz=p.z;
   const eye=view==='front'?[cx,1.0,cz+3.6]:view==='back'?[cx,1.3,cz-3.6]:view==='q'?[cx+2.6,1.4,cz+2.6]:[cx+3.6,1.0,cz];
   const g=[];for(let gx=-3;gx<3;gx++)for(let gz=Math.floor(cz)-3;gz<Math.floor(cz)+3;gz++){const c=(gx+gz)&1?[105,105,105]:[135,135,135];g.push([[gx,0,gz],[gx+1,0,gz+1],[gx+1,0,gz],c],[[gx,0,gz],[gx,0,gz+1],[gx+1,0,gz+1],c]);}
   render([{o:sm.M.m,color:[150,160,180]}],f,{w:200,h:300,eye,target:[cx,.9+p.y*.5,cz],fov:44,extra:g});files.push(f);shots.push(t.toFixed(2));}}
 cp.execFileSync('python3',['-c',`import sys
from PIL import Image,ImageDraw
o=sys.argv[1];lab=sys.argv[2].split(',');fs=sys.argv[3:];ims=[Image.open(f) for f in fs];W=Image.new('RGB',(200*len(ims),316),(20,20,20));d=ImageDraw.Draw(W)
for i,im in enumerate(ims):W.paste(im,(200*i,16));d.text((200*i+4,2),lab[i],fill=(255,255,255))
W.save(o)`,out,[name+' '+agent].concat(shots.slice(1).map(s=>'t='+s)).map((s,i)=>i===0?s+' t='+shots[0]:s).join(','),...files]);
 console.log(JSON.stringify({scenario:name,agent,frames:shots,footContactsSlideCm:stats.contacts}));
})().catch(e=>{console.error(e);process.exit(1);});
