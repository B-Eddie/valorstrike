// Capacity-limited FIFO model, NOT measured Internet/TCP. 20 Hz snapshots, 8-frame flow window,
// 40 ms each way, ACK on next 60 Hz input, one 300 ms downlink service stall at 5 s.
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {encodeSnapshot} from '../../server/src/snapshot-codec.js';
const frames=JSON.parse(gunzipSync(fs.readFileSync('qa/lagopt/before-tdm-frames.json.gz'))).filter((_,i)=>i%5===0);
function run(bytesPerSecond,delta){let delivered=0,sent=0,end=0,base=null,totalBytes=0,coalesced=0,pending=[];const inFlight=[],ages=[];
 for(let i=0;i<frames.length;i++){
  const t=i*50;while(inFlight.length&&inFlight[0].ackAt<=t){inFlight.shift();delivered++;}
  pending.push(...frames[i].ev);if(pending.length>256)pending.splice(0,pending.length-256);
  if(sent-delivered>=8){coalesced++;continue;}
  const frame={...frames[i],q:++sent,ev:pending};pending=[];let data;
  if(delta){const enc=encodeSnapshot(frame,base);base=enc.base;data=enc.data;}else data=JSON.stringify(frame);
  const bytes=Buffer.byteLength(data);totalBytes+=bytes;let start=Math.max(t,end);if(start>=5000&&start<5300)start=5300;
  end=start+bytes/bytesPerSecond*1000;if(start<5000&&end>5000)end+=300;
  const arrival=end+40;ages.push(arrival-t);inFlight.push({ackAt:arrival+40+1000/60});
 }
 ages.sort((a,b)=>a-b);return {sent,coalesced,totalBytes,stateAgeMs:{p50:ages[ages.length>>1],p95:ages[Math.floor(ages.length*.95)],max:ages.at(-1)}};
}
const out={fixture:'model only: 200 recorded real-simulation TDM snapshots for one of five clients, constant link rate; no RTT variance, congestion control, retransmission or physical network. Full/delta use identical frames.',rates:{}};
for(const rate of [16,32,64])out.rates[rate+'KiBps']={before:run(rate*1024,false),after:run(rate*1024,true)};
fs.writeFileSync('qa/lagopt/network-model.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
