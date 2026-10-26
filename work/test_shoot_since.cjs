// hk-36: shoot() must reset `since` (and the knife body / head) on every gun shot. 74a5da4 appended a comment in the middle of
// the fcd line, so `since = 0; body = W.body; head = W.head;` became comment text: since never reset on a gun shot, the
// camera kick always recovered at the idle rate (8 / s) mid-spray, and planting right after a shot was not refused.
const fs=require('fs'),path=require('path'),assert=require('assert');
const s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i=s.indexOf('function shoot(hv) {');assert(i>0,'shoot() found');
const body=s.slice(i,s.indexOf('\n}\n',i));
const code=body.split('\n').map(l=>{const k=l.indexOf('//');return k<0?l:l.slice(0,k);}).join('\n');
assert(/fcd = 1 \/ xRate\(W\)[^\n]*since = 0; body = W\.body; head = W\.head;/.test(code),'gun shot resets since / body / head (outside a comment)');
assert(/since = 0;/.test(s.slice(s.indexOf('function aimFire'),s.indexOf('function aimFire')+4000)),'aim-range shot resets since');
console.log('test_shoot_since: PASS');
