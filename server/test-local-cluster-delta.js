// net lane: the local cluster (tools/local-cluster.mjs) strips worker.js's imports, so snapshot-codec.js encodeSnapshot was
// missing there and GameRoom.state's typeof guard sent every snapshot whole, even to a page that asked for deltas
// (hi batch/ack/delta = 1, as server_runtime.js does). The browser bridge (prod:true) then measured 2 KB full frames where
// the deployed worker sends ~0.6 KB deltas, and the page's delta decoder (netDecode 'sd') never ran in local QA.
// Checks: prod:true -> a delta/ack client receives 'sd' frames after its keyframe; default cluster unchanged (whole frames).
import assert from 'node:assert/strict';import {localCluster} from './tools/local-cluster.mjs';
async function frames(prod,code){
 const C=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'},prod});let room=null,started=false,q=null;const n={s:0,sd:0};
 const p=await C.profile(),s=C.connect({create:1,code,mode:'tdm',map:'ascent'});
 s.on('message',m=>{if(m.t==='room')room=m;else if(m.t==='start'){started=true;s.send(JSON.stringify({t:'ready'}));}else if(m.t==='s'||m.t==='sd'){n[m.t]++;q=m.q;}});
 s.on('open',()=>s.send(JSON.stringify({t:'hi',n:'DeltaLC',ag:'Sova',token:p.token,batch:1,ack:1,delta:1})));
 const until=async(c,ms,w)=>{const end=C.clock.now()+ms;while(!c()){if(C.clock.now()>end)throw Error('timed out: '+w);await C.advance(50);}};
 await until(()=>room,5000,'room');s.send(JSON.stringify({t:'start'}));await until(()=>started,20000,'start');
 for(let k=0;k<40;k++){await C.advance(50);if(q!=null)s.send(JSON.stringify({t:'hb',q}));}
 return n;}
const a=await frames(true,'DLLCAA');assert(a.s>=1&&a.sd>=20,'prod cluster: a delta/ack client gets sd frames ('+JSON.stringify(a)+')');
const b=await frames(false,'DLLCAB');assert.equal(b.sd,0,'default cluster: whole frames ('+JSON.stringify(b)+')');
console.log('local cluster delta: prod sends',a.sd,'sd /',a.s,'s; default',b.s,'s, 0 sd');
process.exit(0);
