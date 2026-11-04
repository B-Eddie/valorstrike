// DC offset (lane-audio3): 7 ui cuts carry a DC offset (ui/glitch_001 -14.4 dBFS = 0.19 full scale, glitch_003 -21.6,
// glitch_002 -24.8, click_005 -26.2, click_003 -31.2, glitch_004 -36.9, click_002 -37; qa/audio3/assets.json from
// work/audio_asset_audit.cjs). A DC step through the 1.5 ms attack / 20 ms end fade is a low thump and eats headroom
// before the limiter. Decoded buffers get each channel's mean subtracted once (only when |mean| > -60 dBFS), in place.
'use strict';
const assert = require('assert/strict'); const { make } = require('./fake_mix.cjs');
(async () => {
  const F = make(); const N = 4800, dc = 0.19;
  const mk = (m) => { const ch = [new Float32Array(N), new Float32Array(N)]; for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) ch[c][i] = m[c] + 0.3 * Math.sin(2 * Math.PI * 440 * i / 48000); return { duration: N / 48000, length: N, numberOfChannels: 2, sampleRate: 48000, getChannelData: (c) => ch[c], ch }; };
  const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
  let next = null; F.ac.decodeAudioData = (b, ok) => ok(next);
  // a DC-offset cut: both channels centred after decode
  next = mk([dc, -0.05]); F.x('GA.buffers.delete("ui/glitch_001");GA.raw.set("ui/glitch_001",new ArrayBuffer(8))');
  const b = await F.x('gaDecode("ui/glitch_001")');
  const m0 = mean(b.ch[0]), m1 = mean(b.ch[1]);
  assert(Math.abs(m0) < 1e-4 && Math.abs(m1) < 1e-4, 'DC removed after decode: means ' + m0.toFixed(4) + ' / ' + m1.toFixed(4) + ' (was ' + dc + ' / -0.05)');
  // a clean cut is left untouched (no rewrite of every buffer)
  const clean = mk([0, 0]); clean.ch[0][0] += 1e-5; const before = clean.ch[0].slice(); next = clean;
  F.x('GA.buffers.delete("ui/click_001");GA.raw.set("ui/click_001",new ArrayBuffer(8))');
  await F.x('gaDecode("ui/click_001")'); assert.deepEqual(Array.from(clean.ch[0].slice(0, 64)), Array.from(before.slice(0, 64)), 'clean buffer untouched');
  // a buffer without getChannelData (old fakes / odd engines) still decodes
  next = { duration: 0.1, length: 4800, numberOfChannels: 1 }; F.x('GA.buffers.delete("ui/click_002");GA.raw.set("ui/click_002",new ArrayBuffer(8))');
  assert.equal((await F.x('gaDecode("ui/click_002")')).length, 4800, 'buffer without channel data passes through');
  console.log('audio dc: glitch_001 mean ' + dc + ' -> ' + m0.toExponential(1));
})().catch((e) => { console.error(e); process.exit(1); });
