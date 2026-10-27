"""Audit the tarball tree against main 63f8fe64 without using git.

Usage: python3 work/verify_rocklan_movement_scope.py [--output /tmp/proof.json]
Dependencies and interpreter caches are excluded; every original product/source/asset
file is hashed. Generated server world files must be removed after running tests.
"""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import tarfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'valorstrike-refresh/valorstrike-fresh.tar.gz'
COMMIT = '63f8fe64d749c6634273c92732f5f049712d0a79'
SKIP = {'.git', '.agents', '.codex', '.aws', 'node_modules', '__pycache__', '.cache', '.pytest_cache'}
CHANGED = {'index.html', 'work/install_valorant.py'}
ADDED = {
    'models/valorant/movement/movement.json', 'models/valorant/movement/movement.bin',
    'models/valorant/movement/tp-movement-baked.glb', 'models/valorant/movement/provenance.json',
    'work/build_rocklan_movement.cjs', 'work/rocklan_movement_runtime.js',
    'work/rocklan_movement_harness.cjs', 'work/test_rocklan_movement.cjs',
    'work/test_rocklan_movement_assets.cjs', 'work/verify_rocklan_movement_scope.py',
    'work/ROCKLAN_MOVEMENT_REPORT.md', 'work/validation/movement-only/scope-proof.json',
    'work/validation/movement-only/restoration-proof.json',
    'work/validation/movement-only/test-results.json',
}


def digest(stream):
    h = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        h.update(chunk)
    return h.hexdigest()


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    base = {}
    original = {}
    prefix = None
    with tarfile.open(ARCHIVE, 'r|gz') as archive:
        for member in archive:
            parts = PurePosixPath(member.name).parts
            prefix = prefix or parts[0]
            if not member.isfile() or SKIP.intersection(parts[1:]):
                continue
            name = '/'.join(parts[1:])
            with archive.extractfile(member) as stream:
                if name in CHANGED:
                    content = stream.read()
                    original[name] = content
                    base[name] = hashlib.sha256(content).hexdigest()
                else:
                    base[name] = digest(stream)
    assert prefix and prefix.endswith(COMMIT), 'Wrong base archive commit'
    current = {}
    for path in ROOT.rglob('*'):
        relative = path.relative_to(ROOT)
        if SKIP.intersection(relative.parts) or not path.is_file():
            continue
        with path.open('rb') as stream:
            current[relative.as_posix()] = digest(stream)
    changed = sorted(name for name in base.keys() & current.keys() if base[name] != current[name])
    added = sorted(current.keys() - base.keys())
    removed = sorted(base.keys() - current.keys())
    # Exact byte proof: removing the single movement block reproduces the original page.
    page = (ROOT / 'index.html').read_bytes()
    start = b'// ---- ROCKLAN MOVEMENT ----'
    end = b'// ---- END ROCKLAN MOVEMENT ----'
    assert page.count(start) == page.count(end) == 1, 'Movement overlay must be installed once'
    left, tail = page.split(b'\n' + start, 1)
    _, right = tail.split(end, 1)
    assert left + right == original['index.html'], 'Non-movement page bytes differ from base'
    generator = (ROOT / 'work/install_valorant.py').read_bytes()
    left, tail = generator.split(b'\n# Movement is an isolated overlay;', 1)
    _, right = tail.split(b"\nmark='xReady = true;", 1)
    assert left + b";mark='xReady = true;" + right == original['work/install_valorant.py'], 'Generator has unrelated changes'
    unexpected = sorted((set(changed) - CHANGED) | (set(added) - ADDED) | set(removed))
    proof = {
        'base_commit': COMMIT, 'base_archive': str(ARCHIVE), 'base_file_count': len(base),
        'changed': changed, 'added': added, 'removed': removed,
        'unexpected_paths': unexpected, 'excluded_components': sorted(SKIP),
        'page_outside_movement_block_byte_identical': True,
        'generator_outside_movement_install_byte_identical': True,
        'all_other_base_files_byte_identical': not (set(changed) - CHANGED) and not removed,
        'unchanged_base_animation_files': sum(name.startswith('models/valorant/animations/') for name in base if current.get(name) == base[name]),
        'mixed_locomotion_assets_unchanged': all(current.get(name) == base[name] for name in base if name.endswith('-locomotion.json') or name in {'models/valorant/agents/locomotion.json', 'models/valorant/agents/locomotion.bin'}),
        'movement_motor_unchanged': all(current.get(name) == base.get(name) for name in ['server/src/motor.cjs', 'vendor/valorant-feel.js', 'work/feel_runtime.js']),
        'hitboxes_unchanged': current.get('server/src/hitboxes.json') == base.get('server/src/hitboxes.json'),
        'test_client_online_unchanged': current.get('work/test_client_online.cjs') == base.get('work/test_client_online.cjs'),
    }
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps(proof, indent=2))
    assert not unexpected, 'Unexpected non-movement diff: ' + ', '.join(unexpected)
    assert proof['mixed_locomotion_assets_unchanged'] and proof['hitboxes_unchanged'] and proof['test_client_online_unchanged']


if __name__ == '__main__':
    run()
