// Opt-in bounded diagnostics; percentile sorting happens only when a local inspector requests a report.
export class LagMetrics{
 constructor(size=600){this.size=size;this.series=new Map();}
 add(name,value){if(!Number.isFinite(value))return;let s=this.series.get(name);if(!s){s={values:new Float64Array(this.size),n:0,total:0,max:0};this.series.set(name,s);}s.values[s.n++%this.size]=value;s.total+=value;s.max=Math.max(s.max,value);}
 attach(sim){if(this.sim===sim)return;this.sim=sim;for(const key of ['bot','motor','fireTick','roundState','spawn']){const f=sim[key];if(typeof f!=='function')continue;const lag=this;sim[key]=function(){const t=performance.now();try{return f.apply(this,arguments);}finally{lag.add(key+'Ms',performance.now()-t);}};}}
 report(){const out={};for(const [name,s]of this.series){const v=Array.from(s.values.subarray(0,Math.min(s.n,this.size))).sort((a,b)=>a-b);out[name]={count:s.n,mean:s.total/s.n,max:s.max,recentP50:v[v.length>>1],recentP95:v[Math.floor(v.length*.95)],recentP99:v[Math.floor(v.length*.99)]};}return out;}
}
