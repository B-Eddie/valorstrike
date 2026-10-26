// Real native skins and packed runtime clips: virtual pelvis parenting, counter-turn and seam stretch.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {runtime,build,T,html}=require('./tp_body_harness.cjs');
(async()=>{
 const c=await runtime(),rows=[];
 // Negative control: disabling carry reproduces the old native crouch separation.
 const old=await build('jett',c),carry=c.xUbCarry;c.xUbCarry=()=>{};old.play('idle',1);
 for(let i=0;i<30;i++)old.step();const f=old.X.follow;
 const oldGap=f.s.position.distanceTo(f.offset.clone().applyQuaternion(f.p.quaternion).add(f.p.position));
 assert(oldGap>.2,'regression detects old crouch separation: '+oldGap);c.xUbCarry=carry;
 console.log('Negative control Jett crouch gap: '+(oldGap*100).toFixed(1)+' cm');
 for(const slug of Object.keys(c.packed.h.agents)){
  const R=await build(slug,c),{X,M,play,step,at}=R,F=c.api.xUbFollow(X);assert(F,slug+' sibling pelvis/spine');
  // Inspect triangle edges around the waist in the actual skin, comparing with bind length.
  const edges=[];X.sc.traverse(o=>{if(!o.isSkinnedMesh)return;const sk=o.skeleton,g=o.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
   const world=i=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),waist=[];
   const py=at('Pelvis').y;for(let i=0;i<p.count;i++)waist[i]=Math.abs(world(i).y-py)<.15;
   const seen=new Set(),idx=g.index,n=idx?idx.count:p.count;
   for(let t=0;t<n;t+=3)for(let j=0;j<3;j++){const a=idx?idx.getX(t+j):t+j,b=idx?idx.getX(t+(j+1)%3):t+(j+1)%3,key=[Math.min(a,b),Math.max(a,b)].join(',');if(!waist[a]||!waist[b]||seen.has(key))continue;seen.add(key);
    // Only edges spanning leg/pelvis and torso skin influences are relevant to the waist seam.
    const torso=i=>{let w=0;for(let k=0;k<4;k++)if(/^Spine/.test(sk.bones[si.array[i*4+k]].name))w+=sw.array[i*4+k];return w;};
    if(Math.abs(torso(a)-torso(b))<.1)continue;edges.push({o,a,b,rest:world(a).distanceTo(world(b))});
   }
  });assert(edges.length,slug+' waist edges');
  let gap=0,growth=0;
  for(const [state,lo,cb,yaw,dir]of [['idle','idle',0,0,1],['walk','walk',0,0,1],['jog','run',0,0,1],['strafeL','run',0,1.25,1],['strafeR','run',0,-1.25,1],['back','run',0,0,-1],['crouch','idle',1,0,1],['crouchWalk','walk',1,0,1]]){
   play(lo,cb,yaw);X.a[lo].timeScale=dir;
   for(let i=0;i<60;i++){
    step();const expected=F.offset.clone().multiply(F.p.scale).applyQuaternion(F.p.quaternion).add(F.p.position),d=expected.distanceTo(F.s.position);gap=Math.max(gap,d);assert(d<1e-6,`${slug} ${state} waist gap ${d}`);
    if(i%10===0){X.sc.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});for(const E of edges){const v=i=>{const p=new T.Vector3().fromBufferAttribute(E.o.geometry.attributes.position,i);E.o.applyBoneTransform(i,p);return p.applyMatrix4(E.o.matrixWorld);};growth=Math.max(growth,v(E.a).distanceTo(v(E.b))-E.rest);}}
   }
   X.a[lo].timeScale=1;
  }
  assert(growth<.065,slug+' waist edge growth '+growth.toFixed(3));
  // Isolate procedural yaw with identity quaternions. At Spine4 the net yaw must be zero.
  c.api.xUbPre(M);const saved=Object.values(X.b).map(b=>[b,b.quaternion.clone()]);for(const [b]of saved)b.quaternion.identity();
  X.yaw=1.25;X.pit=0;c.api.xUbPost(M);M.m.updateMatrixWorld(true);
  const q=R.bone('Spine4').getWorldQuaternion(new T.Quaternion());
  // Native ancestors have bind rotations; compare against the same identity-spine frame without procedural yaw.
  c.api.xUbPre(M);X.yaw=0;c.api.xUbPost(M);M.m.updateMatrixWorld(true);assert(q.angleTo(R.bone('Spine4').getWorldQuaternion(new T.Quaternion()))<1e-6,slug+' chest counter-turn');
  c.api.xUbPre(M);for(const [b,q]of saved)b.quaternion.copy(q);
  // Absolute carry is idempotent and resets to the skin bind before an unchanged mixer frame.
  c.api.xUbCarry(X);const pos=F.s.position.clone();for(let i=0;i<100;i++)c.api.xUbCarry(X);assert(F.s.position.distanceTo(pos)<1e-9);
  c.api.xUbPre(M);assert(F.s.position.distanceTo(F.bind)<1e-9);
  // Full death mixer also carries the torso. Restore offsets even when the animation value is unchanged.
  M.dead=true;for(let i=0;i<10;i++){c.api.xUbDead(M,1/60);assert(F.s.position.distanceTo(F.offset.clone().multiply(F.p.scale).applyQuaternion(F.p.quaternion).add(F.p.position))<1e-6,slug+' death waist');}
  rows.push({agent:slug,gapCm:+(gap*100).toFixed(4),edgeGrowthCm:+(growth*100).toFixed(2)});
 }
 // Keep source runtime and generated page in sync, and cover lobby mixer wiring.
 for(const f of ['valorant_runtime.js','repair_runtime.js'])assert(html.includes(fs.readFileSync(path.join(__dirname,f),'utf8').trim()),f+' installed');
 assert(html.includes('J.mx.update(0.033); xUbCarry(J.sx)'),'lobby carry');
 console.log('Native body stretch: '+JSON.stringify(rows));
})().catch(e=>{console.error(e);process.exit(1);});
