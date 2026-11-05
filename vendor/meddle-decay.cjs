// Meddle temporal HP debt shared by offline/server. Wiki /Meddle: max 90, total 5 s;
// decay ramp .75 s and restoration 1.75 s are wiki estimates, NOT measured game-file values.
// Other sources' decay debts are separate; overlapping-source stacking is not accepted yet.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MeddleDecay=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const C={max:90,ramp:.75,restore:1.75,life:5};
 function begin(u,t){if(u.medDecay)return false;u.medDecay={start:t,last:t,debt:0,applied:0,cap:Math.max(100,u.hp)};return true;}
 function tick(u,t,alive,maxHp){const s=u.medDecay;if(!s)return;if(!alive){u.medDecay=null;return;}
  const age=Math.max(0,t-s.start),want=C.max*Math.min(1,age/C.ramp),add=Math.max(0,want-s.applied);
  if(add>0){const n=Math.min(add,Math.max(0,u.hp-1));u.hp-=n;s.debt+=n;s.applied=want;}
  const a=Math.max(0,s.last-s.start-(C.life-C.restore)),b=Math.max(0,age-(C.life-C.restore));
  if(b>a){const n=Math.min(s.debt,(b-a)*C.max/C.restore);s.debt-=n;u.hp+=Math.min(n,Math.max(0,Math.max(maxHp||100,s.cap)-u.hp));}
  s.last=t;if(age>=C.life){if(s.debt>1e-8)u.hp+=Math.min(s.debt,Math.max(0,Math.max(maxHp||100,s.cap)-u.hp));u.medDecay=null;}
 }
 return {C,begin,tick};
});
