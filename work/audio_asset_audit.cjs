#!/usr/bin/env node
// Audio asset audit (lane-audio3): decodes every file in audio/manifest.json with ffmpeg and measures
// sample rate / channels / bitrate, sample peak, DC offset, leading silence (to -45 dBFS), momentary-max
// loudness (K-weighted 400 ms window, LUFS, BS.1770 filter), high band energy (>16 kHz, MP3 lowpass check),
// and clipping (runs of >= 3 samples at |x| >= 0.999).
// Usage: node work/audio_asset_audit.cjs [out.json]   (needs ffmpeg / ffprobe on PATH)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '..');
const man = JSON.parse(fs.readFileSync(path.join(root, 'audio/manifest.json'), 'utf8'));
const SR = 48000;
function probe(file) {
  const o = JSON.parse(cp.execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]).toString());
  const s = o.streams.find((x) => x.codec_type === 'audio') || {};
  return { codec: s.codec_name, rate: +s.sample_rate, channels: +s.channels, bitrate: +(s.bit_rate || o.format.bit_rate || 0), duration: +o.format.duration };
}
function decode(file, ch) {
  const buf = cp.execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', String(ch), '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
// BS.1770 K-weighting at 48 kHz
function biq(x, b0, b1, b2, a1, a2) { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
function kw(x) { return biq(biq(x, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585), 1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621); }
function hp16k(x) { let y = x; for (let k = 0; k < 4; k++) { const w = Math.tan(Math.PI * 16000 / SR), q = Math.SQRT1_2, n = 1 / (1 + w / q + w * w); y = biq(y, n, -2 * n, n, 2 * (w * w - 1) * n, (1 - w / q + w * w) * n); } return y; }
function db(v) { return v > 0 ? 20 * Math.log10(v) : -120; }
function analyse(key, f) {
  const file = path.join(root, f.url), p = probe(file), ch = Math.max(1, Math.min(2, p.channels || 1));
  const inter = decode(file, ch), n = inter.length / ch, mono = new Float32Array(n);
  let peak = 0, clipRun = 0, clips = 0; const dc = new Array(ch).fill(0);
  for (let i = 0; i < n; i++) { let m = 0; for (let c = 0; c < ch; c++) { const v = inter[i * ch + c]; dc[c] += v; m += v; const a = Math.abs(v); if (a > peak) peak = a; if (a >= 0.999) { if (++clipRun === 3) clips++; } else clipRun = 0; } mono[i] = m / ch; }
  for (let c = 0; c < ch; c++) dc[c] /= Math.max(1, n);
  const thr = Math.pow(10, -45 / 20); let lead = 0; while (lead < n && Math.abs(mono[lead]) < thr) lead++;
  let tail = n - 1; while (tail > lead && Math.abs(mono[tail]) < thr) tail--;
  // first sample within 12 dB of the file peak: perceived onset
  let onset = 0; const thr2 = peak / 4; while (onset < n && Math.abs(mono[onset]) < thr2) onset++;
  const k = kw(mono), W = Math.round(0.4 * SR), H = Math.round(0.1 * SR); let mmax = 0, acc = 0;
  const sq = new Float64Array(n + 1); for (let i = 0; i < n; i++) sq[i + 1] = sq[i] + k[i] * k[i];
  if (n <= W) mmax = sq[n] / W; else for (let i = 0; i + W <= n; i += H) mmax = Math.max(mmax, (sq[i + W] - sq[i]) / W);
  acc = sq[n] / Math.max(1, n);
  const h = hp16k(mono); let he = 0, te = 0; for (let i = 0; i < n; i++) { he += h[i] * h[i]; te += mono[i] * mono[i]; }
  // first and last 64 samples: abrupt start / end (a click when it is played without a fade)
  let headAbs = 0, tailAbs = 0; for (let i = 0; i < Math.min(64, n); i++) { headAbs = Math.max(headAbs, Math.abs(mono[i])); tailAbs = Math.max(tailAbs, Math.abs(mono[n - 1 - i])); }
  return { key, url: f.url, cat: key.split('/')[0], ...p, peakDb: +db(peak).toFixed(2), dcDb: +db(Math.max(...dc.map(Math.abs))).toFixed(1), dc: +Math.max(...dc.map(Math.abs)).toFixed(5), clips,
    leadMs: +(lead / SR * 1000).toFixed(1), onsetMs: +(onset / SR * 1000).toFixed(1), activeMs: +((tail - lead) / SR * 1000).toFixed(1),
    lufsM: +(-0.691 + 10 * Math.log10(Math.max(1e-12, mmax))).toFixed(2), lufsAll: +(-0.691 + 10 * Math.log10(Math.max(1e-12, acc))).toFixed(2),
    hfDb: +(te > 0 ? 10 * Math.log10(Math.max(1e-12, he / te)) : -120).toFixed(1), headDb: +db(headAbs).toFixed(1), tailDb: +db(tailAbs).toFixed(1) };
}
if (require.main === module) {
  const out = process.argv[2] || path.join(root, 'work/validation/audio-asset-audit.json');
  const rows = [], all = Object.entries(man.files), a = +(process.argv[3] || 0), b = +(process.argv[4] || all.length);
  for (const [key, f] of all.slice(a, b)) { try { rows.push(analyse(key, f)); } catch (e) { rows.push({ key, url: f.url, error: String(e.message || e) }); } }
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(rows, null, 1) + '\n');
  console.log('wrote', out, rows.length);
}
module.exports = { analyse, man, root };
