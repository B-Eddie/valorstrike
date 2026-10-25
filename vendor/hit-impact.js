// Localized, depth-tested hit confirms. Fixed pools: two draw calls, no per-hit GPU/DOM allocation.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else {let C;root.HitImpact=function(scene,count){C=C||factory(root.THREE);return new C(scene,count);};}})(typeof globalThis!=='undefined'?globalThis:this,function(T){
  'use strict';
  return class HitImpact {
    constructor(scene,count=24){
      this.scene=scene;this.count=count;this.cursor=0;this.serial=0;
      this.items=Array.from({length:count},()=>({age:1,life:.22,anchor:null,local:new T.Vector3(),point:new T.Vector3(),head:false,predicted:false,seed:0}));
      this.obj=new T.Object3D();this.q=new T.Quaternion();this.spin=new T.Quaternion();this.axis=new T.Vector3(0,0,1);this.v=new T.Vector3();this.right=new T.Vector3();this.up=new T.Vector3();this.eye=new T.Vector3();this.col=new T.Color();this.inv=new T.Matrix4();this.zero=new T.Matrix4().makeScale(0,0,0);
      const make=(geometry)=>{const mat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,side:T.DoubleSide});
        const m=new T.InstancedMesh(geometry,mat,count*8);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.raycast=()=>{};m.name='character-hit-impact';
        for(let i=0;i<count*8;i++){m.setMatrixAt(i,this.zero);m.setColorAt(i,this.col.setRGB(0,0,0));}scene.add(m);return m;};
      const shard=new T.BufferGeometry();shard.setAttribute('position',new T.Float32BufferAttribute([-.5,0,0,.5,-.5,0,.5,.5,0],3));
      this.shards=make(shard);
      const core=new T.BufferGeometry();core.setAttribute('position',new T.Float32BufferAttribute([0,.5,0,-.5,0,0,0,-.5,0,0,.5,0,0,-.5,0,.5,0,0],3));
      this.cores=make(core);this.cores.count=count;
    }
    emit(point,anchor,head=false,predicted=false){
      if(!point||![point.x,point.y,point.z].every(Number.isFinite))return false;
      const e=this.items[this.cursor++%this.count];this.idle=false;e.age=0;e.life=predicted?.07:head?.24:.18;e.head=!!head;e.predicted=!!predicted;e.seed=++this.serial;e.point.copy(point);e.anchor=anchor||null;
      if(e.anchor){e.anchor.updateWorldMatrix(true,false);this.inv.copy(e.anchor.matrixWorld).invert();e.local.copy(point).applyMatrix4(this.inv);}return true;
    }
    tick(dt,camera){
      if(!camera||this.idle)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
      camera.getWorldQuaternion(this.q);camera.getWorldPosition(this.eye);this.right.set(1,0,0).applyQuaternion(this.q);this.up.set(0,1,0).applyQuaternion(this.q);
      let active=0;
      for(let i=0;i<this.count;i++){
        const e=this.items[i];e.age+=dt;
        if(e.age>=e.life){e.anchor=null;this.cores.setMatrixAt(i,this.zero);for(let j=0;j<8;j++)this.shards.setMatrixAt(i*8+j,this.zero);continue;}
        active++;if(e.anchor){e.anchor.updateWorldMatrix(true,false);e.point.copy(e.local).applyMatrix4(e.anchor.matrixWorld);}
        const t=e.age/e.life,fade=(1-t)*(1-t),size=e.predicted?.025:e.head?.075:.045;
        this.v.subVectors(this.eye,e.point).normalize().multiplyScalar(.025);
        this.obj.position.copy(e.point).add(this.v);this.obj.quaternion.copy(this.q);this.obj.scale.set(size*(1+t),size*(e.head?1.8:1)*(1+t),1);this.obj.updateMatrix();this.cores.setMatrixAt(i,this.obj.matrix);
        this.col.setRGB(1,.57,.22).multiplyScalar(fade*(e.predicted?.45:1));this.cores.setColorAt(i,this.col);
        const n=e.predicted?2:e.head?7:4;
        for(let j=0;j<8;j++){
          const index=i*8+j;if(j>=n){this.shards.setMatrixAt(index,this.zero);continue;}
          const angle=j/n*Math.PI*2+(e.seed*2.399963),reach=(e.head?.14:.075)*(0.2+t),x=Math.cos(angle),y=Math.sin(angle);
          this.obj.position.copy(e.point).add(this.v).addScaledVector(this.right,x*reach).addScaledVector(this.up,y*reach+(e.head?.025:0)*t);
          this.spin.setFromAxisAngle(this.axis,angle);this.obj.quaternion.copy(this.q).multiply(this.spin);this.obj.scale.set((e.head?.09:.045)*(1-t*.5),e.head?.018:.012,1);this.obj.updateMatrix();this.shards.setMatrixAt(index,this.obj.matrix);
          this.col.setRGB(1,e.head?.24:.42,.055).multiplyScalar(fade);this.shards.setColorAt(index,this.col);
        }
      }
      for(const m of [this.cores,this.shards]){if(!m.parent)this.scene.add(m);m.visible=active>0;m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;}
      this.idle=active===0;
    }
    clear(){for(const e of this.items){e.age=e.life;e.anchor=null;}this.cores.visible=this.shards.visible=false;}
    dispose(){this.clear();for(const m of [this.cores,this.shards]){m.removeFromParent();m.geometry.dispose();m.material.dispose();}}
  };
});
