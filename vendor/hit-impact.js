// Valorant-style outgoing hit VFX (patch 1.07 model). Opaque-ish normal blending so red blood reads on bright walls; fades by shrinking.
// Fixed pools: two instanced draw calls, no per-hit GPU/DOM allocation.
//  kind 0 SPARK  client-predicted contact: tiny, world-space, never attached, never a damage confirmation
//  kind 1 BODY   confirmed body/leg hit: blood-shaped puff attached to the struck bone, moves with it (crouch, strafe)
//  kind 2 HEAD   confirmed headshot: distinct pale core + thin red streaks, deliberately SMALLER than BODY so the head stays trackable
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else {let C;root.HitImpact=function(scene,count){C=C||factory(root.THREE);return new C(scene,count);};}})(typeof globalThis!=='undefined'?globalThis:this,function(T){
  'use strict';
  const SHARDS=8;
  //          life   core   coreStretch  shards reach  shardLen shardW  core rgb            shard rgb           rise
  const KIND=[{life:.07,core:.022,cy:1,n:2,reach:.035,len:.03,w:.008,cr:[1,.92,.62],sr:[1,.8,.4],gain:.6,rise:0},
              {life:.20,core:.05,cy:1.15,n:5,reach:.085,len:.05,w:.014,cr:[.95,.16,.08],sr:[.85,.07,.04],gain:1,rise:-.03},
              {life:.20,core:.032,cy:1,n:6,reach:.06,len:.04,w:.007,cr:[1,.95,.85],sr:[1,.12,.06],gain:1,rise:.015}];
  return class HitImpact {
    constructor(scene,count=24){
      this.scene=scene;this.count=count;this.cursor=0;this.serial=0;this.emitted=[0,0,0];
      this.items=Array.from({length:count},()=>({age:1,life:.2,kind:0,anchor:null,local:new T.Vector3(),point:new T.Vector3(),head:false,predicted:false,seed:0}));
      this.obj=new T.Object3D();this.q=new T.Quaternion();this.spin=new T.Quaternion();this.axis=new T.Vector3(0,0,1);this.v=new T.Vector3();this.right=new T.Vector3();this.up=new T.Vector3();this.eye=new T.Vector3();this.col=new T.Color();this.inv=new T.Matrix4();this.zero=new T.Matrix4().makeScale(0,0,0);
      const make=(geometry,n,name)=>{const mat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,depthWrite:false,depthTest:true,blending:T.NormalBlending,toneMapped:false,side:T.DoubleSide});
        const m=new T.InstancedMesh(geometry,mat,n);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.raycast=()=>{};m.name=name;m.visible=false;
        for(let i=0;i<n;i++){m.setMatrixAt(i,this.zero);m.setColorAt(i,this.col.setRGB(0,0,0));}scene.add(m);return m;};
      const shard=new T.BufferGeometry();shard.setAttribute('position',new T.Float32BufferAttribute([-.5,0,0,.5,-.5,0,.5,.5,0],3));
      this.shards=make(shard,count*SHARDS,'character-hit-impact-shards');
      // blood-drop core: 6-sided blob (two quads' worth of triangles) instead of a sharp diamond
      const c=[],R=.5;for(let k=0;k<6;k++){const a0=k/6*Math.PI*2,a1=(k+1)/6*Math.PI*2;c.push(0,0,0,Math.cos(a0)*R,Math.sin(a0)*R,0,Math.cos(a1)*R,Math.sin(a1)*R,0);}
      const core=new T.BufferGeometry();core.setAttribute('position',new T.Float32BufferAttribute(c,3));
      this.cores=make(core,count,'character-hit-impact');
    }
    // point: world-space hit point. anchor: the struck bone/part (ignored for predicted sparks: they stay where the bullet landed)
    emit(point,anchor,head=false,predicted=false){
      if(!point||![point.x,point.y,point.z].every(Number.isFinite))return false;
      const kind=predicted?0:head?2:1,K=KIND[kind],e=this.items[this.cursor++%this.count];
      e.age=0;e.kind=kind;e.life=K.life;e.head=kind===2;e.predicted=kind===0;e.seed=++this.serial;e.point.copy(point);e.anchor=kind===0?null:(anchor||null);this.emitted[kind]++;
      if(e.anchor){e.anchor.updateWorldMatrix(true,false);this.inv.copy(e.anchor.matrixWorld).invert();e.local.copy(point).applyMatrix4(this.inv);}return true;
    }
    active(kind){let n=0;for(const e of this.items)if(e.age<e.life&&(kind===undefined||e.kind===kind))n++;return n;}
    tick(dt,camera){
      if(!camera)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
      camera.getWorldQuaternion(this.q);camera.getWorldPosition(this.eye);this.right.set(1,0,0).applyQuaternion(this.q);this.up.set(0,1,0).applyQuaternion(this.q);
      let active=0;
      for(let i=0;i<this.count;i++){
        const e=this.items[i];e.age+=dt;
        if(e.age>=e.life){e.anchor=null;this.cores.setMatrixAt(i,this.zero);for(let j=0;j<SHARDS;j++)this.shards.setMatrixAt(i*SHARDS+j,this.zero);continue;}
        active++;if(e.anchor){if(!e.anchor.parent&&e.anchor.type!=='Scene'){e.anchor=null;}else{e.anchor.updateWorldMatrix(true,false);e.point.copy(e.local).applyMatrix4(e.anchor.matrixWorld);}}
        const K=KIND[e.kind],t=e.age/e.life,shrink=t<.3?1:1-(t-.3)/.7,fade=(1-.35*t)*K.gain,size=K.core*(1+t*.8)*shrink;
        this.v.subVectors(this.eye,e.point).normalize().multiplyScalar(.025);
        this.obj.position.copy(e.point).add(this.v).addScaledVector(this.up,K.rise*t);this.obj.quaternion.copy(this.q);this.obj.scale.set(size,size*K.cy,1);this.obj.updateMatrix();this.cores.setMatrixAt(i,this.obj.matrix);
        this.col.setRGB(K.cr[0],K.cr[1],K.cr[2]).multiplyScalar(fade);this.cores.setColorAt(i,this.col);
        for(let j=0;j<SHARDS;j++){
          const index=i*SHARDS+j;if(j>=K.n){this.shards.setMatrixAt(index,this.zero);continue;}
          const angle=j/K.n*Math.PI*2+(e.seed*2.399963),reach=K.reach*(.25+t),x=Math.cos(angle),y=Math.sin(angle);
          this.obj.position.copy(e.point).add(this.v).addScaledVector(this.right,x*reach).addScaledVector(this.up,y*reach+K.rise*t);
          this.spin.setFromAxisAngle(this.axis,angle);this.obj.quaternion.copy(this.q).multiply(this.spin);this.obj.scale.set(K.len*(1-t*.5)*shrink,K.w*shrink,1);this.obj.updateMatrix();this.shards.setMatrixAt(index,this.obj.matrix);
          this.col.setRGB(K.sr[0],K.sr[1],K.sr[2]).multiplyScalar(fade);this.shards.setColorAt(index,this.col);
        }
      }
      for(const m of [this.cores,this.shards]){if(!m.parent)this.scene.add(m);m.visible=active>0;m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;}
    }
    clear(){for(const e of this.items){e.age=e.life;e.anchor=null;}this.cores.visible=this.shards.visible=false;}
    dispose(){this.clear();for(const m of [this.cores,this.shards]){m.removeFromParent();m.geometry.dispose();m.material.dispose();}}
  };
});
