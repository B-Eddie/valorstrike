"""Install reviewed, original VALORANT MP3s without changing gameplay or mix settings.

Fetch each plan entry through GitHub's file API (base64 is supported), or its raw
commit URL, into SOURCE_DIR/<blob_sha>.mp3, then run:
    python3 work/apply_valorant_audio.py --source-dir SOURCE_DIR
The plan pins each source commit, Git blob hash, path, and byte length. This script
never invents a fallback, synthesizes audio, or runs git/npm/deployment commands.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
START = '// ---- DOWNLOADED GAME AUDIO ----'
END = '// ---- END DOWNLOADED GAME AUDIO ----'


def install(source_dir):
    plan = json.loads((ROOT / 'work/valorant_audio_replacements.json').read_text())
    manifest_path = ROOT / 'audio/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    # Validate every source before writing any runtime or manifest file.
    reviewed = []
    for job in plan:
        source = source_dir / (job['blob_sha'] + '.mp3')
        data = source.read_bytes()
        blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        assert len(data) == job['bytes'] and blob == job['blob_sha'], job['key']
        probe = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-show_entries',
            'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', str(source)]))
        assert probe['streams'][0]['codec_name'] == 'mp3', job['key']
        duration = float(probe['format']['duration'])
        assert 0 < duration < 30, job['key']
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(source),
                        '-f', 'null', '-'], check=True, capture_output=True)
        sha = hashlib.sha256(data).hexdigest()
        url = 'audio/' + job['key'].replace('/', '-') + '.' + sha[:12] + '.mp3'
        meta = dict(url=url, sha256=sha, bytes=len(data), duration=duration,
                    source='https://raw.githubusercontent.com/' + job['repository'] + '/' +
                    job['ref'] + '/' + quote(job['path'], safe='/'),
                    sourceRepository=job['repository'], sourceCommit=job['ref'],
                    sourcePath=job['path'], sourceBlobSha1=blob, conversion='none; original MP3 bytes')
        reviewed.append((job, data, meta))

    runtime_path = ROOT / 'work/audio_runtime.js'
    runtime = runtime_path.read_text()
    replacements = [
        ("boom:'scifi/explosionCrunch_000'", "boom:'event/boom'"),
        ("gaPlay(win?'ui/confirmation_004':'ui/error_006','voice'",
         "gaPlay(method==='fanfare'?(win?'event/matchVictory':'event/matchDefeat'):(win?'ui/confirmation_004':'event/roundLoss'),'voice'"),
        ("'impact/impactSoft_medium_000'", "'feedback/body'"),
        ("gaPlay('ui/confirmation_001','kill'", "gaPlay('feedback/kill','kill'"),
        ("gaPlay('impact/impactSoft_heavy_000','feedback'", "gaPlay('feedback/damage','feedback'"),
        ("gaWarm(gaWeapon('Knife','knife'));", "gaWarm(gaWeapon('Knife','knife'));gaWarm(gaWeapon('Knife','knifeHeavy'));"),
        ("for(const k of ['ui/click_001','ui/switch_002'",
         "for(const k of ['event/roundLoss','event/matchVictory','event/matchDefeat','feedback/kill','feedback/damage','ui/click_001','ui/switch_002'"),
        ("/* qa-37 heavy stab (ALT FIRE): the skin's swing clip slowed to 0.78x and louder, so it reads heavier than a light swing (no heavy clip downloaded) */const knifeH0=SFX.knifeHeavy;SFX.knifeHeavy=function(){return gaOriginal(knifeH0,this,arguments,gaPlay(gaWeapon('Knife','knife')",
         "/* Heavy stab keeps the existing gain/rate; use the native stab where supplied. */const knifeH0=SFX.knifeHeavy;SFX.knifeHeavy=function(){return gaOriginal(knifeH0,this,arguments,gaPlay(gaWeapon('Knife','knifeHeavy')||gaWeapon('Knife','knife')"),
    ]
    # Rerunning is safe: a reviewed replacement already installed is not edited again.
    for before, after in replacements:
        if after in runtime:
            continue
        assert before in runtime, 'Audio reference moved: ' + before
        runtime = runtime.replace(before, after)
    assert runtime.count(START) == runtime.count(END) == 1
    page_path = ROOT / 'index.html'
    page = page_path.read_text()
    assert page.count(START) == page.count(END) == 1

    obsolete = []
    for job, data, meta in reviewed:
        old = manifest['files'].get(job['key'])
        if old and old['url'] != meta['url']:
            obsolete.append(old['url'])
        (ROOT / meta['url']).write_bytes(data)
        manifest['files'][job['key']] = meta
        if job['key'].startswith('ability/'):
            manifest['abilities'][job['key'].split('/')[1]] = job['key']
        if job['key'] == 'standard/Knife/knifeHeavy':
            manifest['weapons']['Knife']['knifeHeavy'] = job['key']
    # The three native knife skins previously reused their own swing for heavy
    # attacks. Keep those existing references until each skin's stab is sourced.
    for profiles in manifest['skins'].values():
        if 'Knife' in profiles:
            knife = profiles['Knife']
            knife.setdefault('knifeHeavy', knife['knife'])
    manifest['sources']['SpikeMedia'] = (
        'Original VALORANT game audio from Dartsgame974/SpikeMedia; pinned source '
        'commit, path and Git blob hash per entry. Riot Games owns the game audio.')
    manifest['sources']['VallyBoard'] = (
        'Standard knife swing/equip/stab from Jai-R-Mehta/VallyBoard; pinned source '
        'commit, path and Git blob hash per entry. Riot Games owns the game audio.')
    embedded = json.dumps(manifest, separators=(',', ':'), ensure_ascii=True)
    rendered = runtime.strip().replace('/*GAME_AUDIO_JSON*/null', embedded)
    assert '/*GAME_AUDIO_JSON*/null' not in rendered
    a, b = page.index(START), page.index(END) + len(END)
    page_path.write_text(page[:a] + rendered + page[b:])
    runtime_path.write_text(runtime)
    manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')
    retained = {entry['url'] for entry in manifest['files'].values()}
    for path in obsolete:
        if path not in retained:
            (ROOT / path).unlink()
    print('Installed', len(reviewed), 'reviewed MP3s;', len(manifest['files']),
          'manifest entries; removed', len(set(obsolete) - retained), 'superseded files.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    install(parser.parse_args().source_dir)
