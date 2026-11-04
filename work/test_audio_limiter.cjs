// Master limiter (lane-audio3). audio() puts a DynamicsCompressor after the master gain. Before it was a soft compressor,
// not a limiter: threshold -6 dB, knee 12 (Chromium's knee lies ABOVE the threshold, -6..+6 dBFS), ratio 8, attack 3 ms,
// release 250 ms, plus the automatic makeup gain (1 / curve(0 dBFS))^0.6 = +1.0 dB. Stacked voices that reach +3 / +9 dBFS
// came out at +0.5 / +1.4 dBFS - clipped at the output - and the 250 ms release held the bed down long after a burst.
// This checks the static curve (Chromium DynamicsCompressorKernel model: knee curve x' = t + (1 - e^(-k (x - t))) / k with k
// solved for slope 1/ratio at the knee end, makeup gain) and renders the loudest sustained mix (volume 100, own Odin full
// auto, two enemy rifles, a stacked Spike-explosion hit) through one-pole attack / release on the gain.
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const m=/limiter\.threshold\.value = (-?[\d.]+); limiter\.knee\.value = ([\d.]+); limiter\.ratio\.value = ([\d.]+); limiter\.attack\.value = ([\d.]+); limiter\.release\.value = ([\d.]+);/.exec(html);
assert(m,'audio() limiter settings found');const [thr,knee,ratio,att,rel]=m.slice(1).map(Number);
const L=JSON.parse(fs.readFileSync(path.join(root,'audio/levels.json'),'utf8')).files;
const SR=48000,db=x=>20*Math.log10(Math.max(1e-9,x)),lin=d=>Math.pow(10,d/20);
function curve(thrDb,kneeDb,ratio){const lt=lin(thrDb),kt=lin(thrDb+kneeDb),slope=1/ratio;
 const kc=(x,k)=>x<lt?x:lt+(1-Math.exp(-k*(x-lt)))/k;const slopeAt=(x,k)=>{const x2=x*1.001;return (db(kc(x2,k))-db(kc(x,k)))/(db(x2)-db(x));};
 let k=5;if(kneeDb>0){let lo=0.1,hi=10000;for(let i=0;i<60;i++){k=Math.sqrt(lo*hi);if(slopeAt(kt,k)>slope)lo=k;else hi=k;}}
 const ykt=kneeDb>0?db(kc(kt,k)):thrDb;return x=>{if(x<=lt)return x;if(kneeDb>0&&x<kt)return kc(x,k);return lin(ykt+slope*(db(x)-(kneeDb>0?thrDb+kneeDb:thrDb)));};}
function render(thrDb,kneeDb,ratio,att,rel){const sat=curve(thrDb,kneeDb,ratio),makeup=Math.pow(1/sat(1),0.6),N=SR*2.4,x=new Float32Array(N);
 let seed=1;const rnd=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296*2-1;const vol=1.0;
 const shot=(t0,peakDb,role,dec)=>{const a=lin(peakDb)*role*vol,s0=Math.round(t0*SR);for(let i=0;i<SR*0.3&&s0+i<N;i++)x[s0+i]+=a*rnd()*Math.exp(-i/(dec*SR));};
 const o=L['standard/Odin/fire'],p=L['standard/Phantom/fire'],b=L['event/boom'];
 for(let t=0.1;t<2.1;t+=1/12)shot(t,o.peak+o.g,0.65,0.03);
 for(let t=0.13;t<2.1;t+=1/11)shot(t,p.peak+p.g-6,0.65,0.03);for(let t=0.17;t<2.1;t+=1/11)shot(t,p.peak+p.g-6,0.65,0.03);
 shot(1.0,b.peak+b.g,0.65,0.25);
 const amb=lin(-30);let g=1,env=0,outPk=0;const ga=Math.exp(-1/(att*SR)),gr=Math.exp(-1/(rel*SR)),gains=[];
 for(let i=0;i<N;i++){const s=Math.abs(x[i])+amb;env=Math.max(s,env*Math.exp(-1/(0.002*SR)));const target=env>0?Math.min(1,sat(env)/env):1;g=target<g?ga*g+(1-ga)*target:gr*g+(1-gr)*target;if(i%48===0)gains.push(db(g));}
 let after=0;const last=gains.length-1;for(let i=Math.round(2.1*1000);i<=last;i++)if(gains[i]<-0.5)after=i;const rec=after?after/1000-2.1:0;
 const w=gains.slice(400,2000);return {maxGR:-Math.min(...w),makeup:db(makeup),ceil:Math.max(...[0,3,6,9,12].map(d=>db(sat(lin(d)))+db(makeup))),recover:Math.max(0,rec)};}
const old=render(-6,12,8,0.003,0.25),cur=render(thr,knee,ratio,att,rel);
const fmt=r=>'ceiling (0..+12 dBFS in) '+r.ceil.toFixed(2)+' dBFS, makeup +'+r.makeup.toFixed(1)+' dB, max GR '+r.maxGR.toFixed(1)+' dB, bed recovers '+(r.recover*1000).toFixed(0)+' ms after the burst';
console.log('limiter old -6/12/8/3ms/250ms: '+fmt(old));console.log('limiter now '+[thr,knee,ratio,att*1000+'ms',rel*1000+'ms'].join('/')+': '+fmt(cur));
assert(old.ceil>0,'model reproduces the old overs');
assert(cur.ceil<=-0.1,'output ceiling stays under 0 dBFS for inputs up to +12 dBFS (was '+old.ceil.toFixed(2)+')');
assert(cur.makeup<=1.5,'makeup gain <= 1.5 dB');
assert(cur.recover<=0.2,'the bed recovers within 200 ms after the gunfire stops');
assert(thr>=-3&&ratio>=12&&att<=0.002&&rel<=0.15,'a peak limiter: threshold >= -3 dBFS, ratio >= 12, attack <= 2 ms, release <= 150 ms');
