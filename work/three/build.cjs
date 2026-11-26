#!/usr/bin/env node
// Builds the vendored three.js the page loads (vendor/three/): three.min.js (core, window.THREE), GLTFLoader.js
// (THREE.GLTFLoader) and SkeletonUtils.js (THREE.SkeletonUtils), from the npm three package at THREE_VERSION, with the
// small source patches in work/three/patches.cjs applied (each is an exact-text replace that must match once) and the
// compat layer work/three/compat.js appended to the core (r149 API names the page still uses).
// Deterministic: same three version + same patches -> byte-identical files.
//   node work/three/build.cjs            (fetches three@THREE_VERSION with `npm pack` into $THREE_CACHE or /tmp)
//   THREE_SRC=/path/to/package node work/three/build.cjs   (an unpacked npm package instead)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '..', '..');
const THREE_VERSION = '0.170.0';
const OUT = path.join(ROOT, 'vendor', 'three');
const esbuild = require(path.join(ROOT, 'server', 'node_modules', 'esbuild'));
const { CORE, GLTF, SKEL } = require('./patches.cjs');

function pkgDir() {
  if (process.env.THREE_SRC) return process.env.THREE_SRC;
  const cache = process.env.THREE_CACHE || path.join(os.tmpdir(), 'vs-three-pkg');
  const dir = path.join(cache, 'three-' + THREE_VERSION);
  if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  fs.mkdirSync(dir, { recursive: true });
  const tgz = cp.execFileSync('npm', ['pack', 'three@' + THREE_VERSION, '--silent'], { cwd: cache, encoding: 'utf8' }).trim().split('\n').pop();
  cp.execFileSync('tar', ['xzf', path.join(cache, tgz), '-C', dir, '--strip-components=1']);
  return dir;
}

// esbuild plugin: exact-text patches on the listed source files (path relative to the package), each must match once
function patcher(PKG, list) {
  const byFile = new Map(); for (const p of list) { const f = path.join(PKG, p.file); if (!byFile.has(f)) byFile.set(f, []); byFile.get(f).push(p); }
  const used = new Set();
  return { plugin: { name: 'vs-three-patches', setup(b) {
    b.onLoad({ filter: /\.js$/ }, (a) => {
      const ps = byFile.get(a.path); if (!ps) return undefined;
      let s = fs.readFileSync(a.path, 'utf8');
      for (const p of ps) { const n = s.split(p.find).length - 1, want = p.n || 1; if (n !== want) throw new Error('patch ' + p.id + ': ' + n + ' matches in ' + p.file + ', want ' + want); s = s.split(p.find).join(p.replace); used.add(p.id); }
      return { contents: s, loader: 'js' };
    });
  } }, check() { for (const p of list) if (!used.has(p.id)) throw new Error('patch ' + p.id + ' not applied (file not in the bundle?)'); } };
}

// 'three' imported by the addons resolves to the page's global THREE (the core bundle), as the old examples/js files did
const globalThree = { name: 'global-three', setup(b) {
  b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'global-three' }));
  b.onLoad({ filter: /.*/, namespace: 'global-three' }, () => ({ contents: 'module.exports = window.THREE;', loader: 'js' }));
} };

async function bundle(PKG, entry, file, patches, plugins, banner) {
  const P = patcher(PKG, patches);
  const r = await esbuild.build({ stdin: { contents: entry, resolveDir: PKG, sourcefile: file.replace(/\.js$/, '.entry.js'), loader: 'js' },
    bundle: true, format: 'iife', target: 'es2018', minify: true, legalComments: 'none', charset: 'utf8', write: false,
    plugins: [P.plugin, ...plugins], logLevel: 'error' });
  P.check();
  // the only newlines esbuild leaves in minified output are inside template literals (GLSL chunks): trailing blanks there
  // are not significant and are dropped so `git diff --check` stays clean
  const code = banner + r.outputFiles[0].text.replace(/[ \t]+$/gm, '');
  fs.writeFileSync(path.join(OUT, file), code);
  return code.length;
}

(async () => {
  const PKG = pkgDir();
  const ver = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).version;
  if (ver !== THREE_VERSION) throw new Error('three package ' + ver + ' != ' + THREE_VERSION);
  fs.mkdirSync(OUT, { recursive: true });
  const lic = '/**\n * three.js r' + ver.split('.')[1] + ' (npm three@' + ver + '), MIT License, Copyright 2010-2024 Three.js Authors.\n * Built by work/three/build.cjs with the patches in work/three/patches.cjs (r149 behaviour kept where the page\n * depends on it) and work/three/compat.js. Do not edit: rebuild.\n */\n';
  const compat = fs.readFileSync(path.join(__dirname, 'compat.js'), 'utf8');
  const sizes = {};
  sizes['three.min.js'] = await bundle(PKG, "import * as T from './src/Three.js';\nconst THREE = Object.assign({}, T);\n" + compat + "\nwindow.THREE = THREE;\n", 'three.min.js', CORE, [], lic);
  sizes['GLTFLoader.js'] = await bundle(PKG, "import { GLTFLoader } from './examples/jsm/loaders/GLTFLoader.js';\nwindow.THREE.GLTFLoader = GLTFLoader;\n", 'GLTFLoader.js', GLTF, [globalThree], lic);
  sizes['SkeletonUtils.js'] = await bundle(PKG, "import * as S from './examples/jsm/utils/SkeletonUtils.js';\nwindow.THREE.SkeletonUtils = Object.assign({}, S);\n", 'SkeletonUtils.js', SKEL, [globalThree], lic);
  fs.copyFileSync(path.join(PKG, 'LICENSE'), path.join(OUT, 'LICENSE'));
  console.log('three', ver, JSON.stringify(sizes));
})().catch((e) => { console.error(e); process.exit(1); });
