// A main-thread stall is not network silence (browser-found, task 3: headless Chromium online at ~0.1 fps). The page's
// 10 s silence rule ran in the first timer tick after a 12 s frame, before the socket messages queued during that frame
// were handled, so a live connection was dropped ("Lost connection to the host.", socket closed 1005) even though the
// server had been sending all along. Boots the real page (page_harness) as an online client and checks:
//  - 9 s without messages keeps the connection; one 12 s stalled frame on top of that also keeps it (fails on the old page)
//  - genuine silence (10.5 s of normal ticks with no message) still drops it
//  - a hidden tab keeps the old rule (throttled timers are not a stall)
//  - a host's peer clients get the same stall allowance (their last-seen times move with the stall)
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
const H=boot({seed:5}),xe=H.xe,fails=[],out=[];
const adv=ms=>{for(let t=0;t<ms;t+=33)H.advance(Math.min(33,ms-t));};
xe('window.__off=0;const P=performance,p0=P.now.bind(P);P.now=()=>p0()+window.__off;true');
const client=()=>xe('MP.on=true;MP.role="client";MP.st="room";MP.closing=false;MP.loadT=0;MP.hc={open:true,send(){},close(){},on(){}};MP.last=performance.now();true');
const stall=ms=>{xe(`window.__off+=${ms};true`);H.advance(33);};
const alive=()=>xe('MP.on&&MP.role==="client"');
// 1. silence under the limit, then a stalled frame
client();adv(9000);if(!alive())fails.push('dropped after 9 s of silence (limit is 10 s)');
stall(12000);out.push('after 9 s silence + 12 s stalled frame: '+(alive()?'connected':'dropped'));if(!alive())fails.push('a 12 s main-thread stall was counted as silence and dropped the connection');
// messages resume (the queued ones are handled after the stall)
xe('MP.last=performance.now();true');adv(5000);if(!alive())fails.push('dropped after messages resumed');
// 2. genuine silence still drops
xe('MP.last=performance.now();true');adv(10500);out.push('after 10.5 s of real silence: '+(alive()?'connected':'dropped'));if(alive())fails.push('10.5 s of real silence did not drop the connection');
// 3. hidden tab: old rule
client();adv(1000);H.doc.hidden=true;stall(12000);out.push('hidden tab + 12 s gap: '+(alive()?'connected':'dropped'));if(alive())fails.push('a hidden tab gap was treated as a stall');H.doc.hidden=false;
// 4. host: peer clients' last-seen moves with the stall
{xe('MP.closing=false;MP.on=true;MP.role="host";MP.st="game";MP.m5=false;MP.starting=false;window.__peer={conn:{open:true,send(){},close(){window.__closed=1;}},last:performance.now(),loadT:0};MP.conns=[window.__peer];window.__closed=0;true');
 const l0=xe('window.__peer.last');adv(500);stall(12000);const l1=xe('window.__peer.last');out.push('host peer last-seen moved by '+(l1-l0)+' ms');
 if(!(l1-l0>=11900))fails.push('host peer last-seen not moved by the stall ('+(l1-l0)+')');if(xe('window.__closed'))fails.push('host dropped a peer over its own stall');
 xe('MP.on=false;MP.conns=[];true');}
if(process.env.VERBOSE||fails.length)console.log(out.join('\n'));
if(fails.length){console.error(fails.join('\n'));process.exit(1);}
console.log('Online silence vs main-thread stall: a 12 s stalled frame keeps a live connection (client and host peers), real 10 s silence still drops, hidden tabs unchanged');
process.exit(0);
