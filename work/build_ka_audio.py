#!/usr/bin/env python3
"""Register Kingdom Archives audio (voicelines + killbanner sounds) in audio/manifest.json.
Idempotent: entries whose key already exists with the same url are kept. Duration via ffprobe."""
import json, os, subprocess, hashlib, sys
from concurrent.futures import ThreadPoolExecutor
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man_path = os.path.join(root, 'audio/manifest.json')
man = json.load(open(man_path))
files = man['files']
new = {}  # key -> relpath
# Voicelines: assets/voicelines/<Agent>/<event>.mp3
vl_root = os.path.join(root, 'assets/voicelines')
for ag in sorted(os.listdir(vl_root)):
    d = os.path.join(vl_root, ag)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        if f.endswith('.mp3'):
            new[f'ka/vl/{ag}/{f[:-4]}'] = f'assets/voicelines/{ag}/{f}'
# Killbanners: assets/killbanners/**/audios/*.mp3
kb_root = os.path.join(root, 'assets/killbanners')
for dirpath, _, names in os.walk(kb_root):
    for f in sorted(names):
        if not f.endswith('.mp3'): continue
        rel = os.path.relpath(os.path.join(dirpath, f), root).replace(os.sep, '/')
        slug = rel.split('/')[2]
        new[f'ka/kb/{slug}/{f[:-4]}'] = rel
def probe(item):
    key, rel = item
    p = os.path.join(root, rel)
    b = open(p, 'rb').read()
    try:
        out = subprocess.run(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0', p], capture_output=True, text=True, timeout=30)
        dur = round(float(out.stdout.strip()), 3)
    except Exception:
        dur = None
    return key, {'url': rel, 'sha256': hashlib.sha256(b).hexdigest(), 'bytes': len(b), 'duration': dur, 'source': 'kingdomarchives.com (Riot Games asset, fan project)'}
todo = [(k, v) for k, v in new.items() if k not in files or files[k].get('url') != v]
print('registering', len(todo), 'of', len(new))
added = 0
with ThreadPoolExecutor(max_workers=12) as ex:
    for key, entry in ex.map(probe, todo):
        files[key] = entry
        added += 1
json.dump(man, open(man_path, 'w'), indent=1)
print('added', added, 'total', len(files))
