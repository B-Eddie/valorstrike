// Texture-cap createImageBitmap hook: option preservation, probe closure, failure cleanup, passthrough shapes.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync('work/valorant_runtime.js','utf8');
const a=s.indexOf('// ---- VALORANT ASSET INTEGRATION ----'),b=s.indexOf('var XV = ');
assert(a>=0&&b>a,'hook region found');
const region=s.slice(a,b);
function mk(env){ // env: {gq, lowDev, mem, noCIB}
  const calls=[]; let closed=0;
  const native=(src,...rest)=>{
    calls.push({src,rest});
    const opts=(rest.length===1&&rest[0])||{};
    if(env.probeFail)return Promise.reject(new Error('probe decode fail'));
    if(env.resizeFail&&opts.resizeWidth)return Promise.reject(new Error('resize decode fail'));
    const w=opts.resizeWidth||src._w,h=opts.resizeHeight||src._h;
    return Promise.resolve({width:w,height:h,close(){closed++},_probe:!opts.resizeWidth});
  };
  class Blob{}
  const store={}; 
  const sb={ window:{}, console, Promise, Object, Math,
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v)},
    navigator:{deviceMemory:env.mem}, Blob, xLowDev:!!env.lowDev };
  if(env.gq)store['vs.gq']=env.gq;
  if(!env.noCIB)sb.createImageBitmap=native;
  vm.createContext(sb); vm.runInContext(region,sb);
  return {sb,calls,isClosed:()=>closed,blob:(w,h)=>{const x=new Blob();x._w=w;x._h=h;return x;}};
}
const OPTS={premultiplyAlpha:'none',colorSpaceConversion:'none',imageOrientation:'flipY'};
(async()=>{
  // 1. no cap: medium + 8GB -> wrapper not installed
  { const {sb}=mk({gq:'medium',mem:8}); assert.equal(typeof sb.createImageBitmap,'function'); assert.equal(sb.window.createImageBitmap,undefined); }
  // 2. low preset: cap 512; small texture passes through untouched, probe NOT closed
  { const {sb,calls,isClosed,blob}=mk({gq:'low',mem:8});
    const bm=await sb.window.createImageBitmap(blob(256,256),OPTS);
    assert.equal(calls.length,1); assert.equal(bm.width,256); assert.equal(isClosed(),0); }
  // 3. low preset: large texture resized with ALL original options preserved; probe closed
  { const {sb,calls,isClosed,blob}=mk({gq:'low',mem:8});
    const bm=await sb.window.createImageBitmap(blob(2048,1024),OPTS);
    assert.equal(calls.length,2);
    const o=calls[1].rest[0];
    assert.deepEqual({premultiplyAlpha:o.premultiplyAlpha,colorSpaceConversion:o.colorSpaceConversion,imageOrientation:o.imageOrientation},OPTS);
    assert.equal(o.resizeWidth,512); assert.equal(o.resizeHeight,256); assert.equal(o.resizeQuality,'high');
    assert.equal(bm.width,512); assert.equal(isClosed(),1); }
  // 4. deviceMemory<=4 with medium preset: cap 1024
  { const {sb,calls,blob}=mk({gq:'medium',mem:4});
    const bm=await sb.window.createImageBitmap(blob(2048,2048),OPTS);
    assert.equal(calls[1].rest[0].resizeWidth,1024); assert.equal(bm.width,1024); }
  // 5. non-(blob,options) shapes pass straight through even with cap active
  { const {sb,calls,blob}=mk({gq:'low',mem:8});
    await sb.window.createImageBitmap(blob(4096,4096)); // no options arg
    assert.equal(calls.length,1); assert.equal(calls[0].rest.length,0);
    await sb.window.createImageBitmap(blob(4096,4096),0,0,100,100,{});
    assert.equal(calls[1].rest.length,5); }
  // 6. probe decode failure propagates, no resize attempted
  { const {sb,blob}=mk({gq:'low',mem:8,probeFail:true});
    await assert.rejects(sb.window.createImageBitmap(blob(2048,2048),OPTS),/probe decode fail/); }
  // 7. resize decode failure falls back to the full-size probe, probe NOT closed
  { const {sb,isClosed,blob}=mk({gq:'low',mem:8,resizeFail:true});
    const bm=await sb.window.createImageBitmap(blob(2048,2048),OPTS);
    assert.equal(bm.width,2048); assert.equal(bm._probe,true); assert.equal(isClosed(),0); }
  // 8. Safari/Firefox path: no createImageBitmap -> hook skipped without throwing
  { const {sb}=mk({gq:'low',mem:8,noCIB:true}); assert.equal(sb.window.createImageBitmap,undefined); }
  // 9. touch/mobile default (no stored preset, xLowDev) -> low -> cap active
  { const {sb,calls,blob}=mk({lowDev:true,mem:8});
    await sb.window.createImageBitmap(blob(2048,2048),OPTS);
    assert.equal(calls[1]&&calls[1].rest[0].resizeWidth,512); }
  console.log('texcap hook: cap activation, option/orientation/alpha preservation, probe closure, decode-failure fallback, passthrough shapes, Safari/Firefox skip all pass');
})().catch(e=>{console.error(e);process.exit(1)});
