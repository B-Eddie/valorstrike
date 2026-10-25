"""Build server/src/skins.json: Valorant skin collection NAMES (per-weapon skin names, which weapons each line covers,
chroma/variant names and the content tier) from the public valorant-api.com catalogue. Only names are used: every
visual is Valorstrike's own procedural shader design themed on the collection palette below (no Riot textures or
models are downloaded or shipped). The knife model is the standard tactical knife, so knife skins are named
"<Collection> Knife" (its variant names come from the line's melee where it has any).

usage: python3 work/build_skins_catalog.py [api_cache_dir]   (cache dir holds weapons.json, themes.json, tiers.json)
"""
import json, re, sys, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
API = 'https://valorant-api.com/v1/'
def load(name, ep):
    if len(sys.argv) > 1 and (Path(sys.argv[1]) / name).exists():
        return json.loads((Path(sys.argv[1]) / name).read_text())['data']
    with urllib.request.urlopen(API + ep, timeout=90) as r:
        return json.loads(r.read().decode())['data']
W = load('weapons.json', 'weapons'); TH = {t['uuid']: t['displayName'] for t in load('themes.json', 'themes')}
TIER = {t['uuid']: t['devName'] for t in load('tiers.json', 'contenttiers')}
CATS = [["Sidearms", ["Classic", "Shorty", "Frenzy", "Ghost", "Sheriff"]], ["SMGs", ["Stinger", "Spectre"]], ["Shotguns", ["Bucky", "Judge"]],
        ["Rifles", ["Bulldog", "Guardian", "Phantom", "Vandal"]], ["Sniper Rifles", ["Marshal", "Outlaw", "Operator"]], ["Heavy", ["Ares", "Odin"]], ["Melee", ["Knife"]]]
GAME = [w for _, l in CATS for w in l]
# id, Valorant theme name, procedural pattern (1 shards, 2 gilded bands, 3 camo, 4 circuit, 5 glowing seams, 6 gradient
# glow), palette (a base, b secondary, e emissive accent, p pulse) and a one-line description of the look.
LINES = [
    ('prime', 'Prime', 2, dict(a='#ece6d6', b='#c9a24a', e='#4fb6ff'), 'Ivory plating, gold trim and a blue energy core.'),
    ('prime2', 'Prime//2.0', 2, dict(a='#1c1f24', b='#d4af37', e='#ffcf4a'), 'Black alloy with gold bands and a warm core glow.'),
    ('reaver', 'Reaver', 5, dict(a='#17131d', b='#3a2a4a', e='#a45cff'), 'Gothic black metal split by violet soul-fire seams.'),
    ('glitchpop', 'Glitchpop', 4, dict(a='#2a1a4a', b='#ff4fd8', e='#3ff6ff', p=1), 'Hot-pink lacquer with live cyan circuit glitches.'),
    ('oni', 'Oni', 2, dict(a='#e8e2d8', b='#c4232f', e='#ff3b3b'), 'Lacquered white with crimson bands of a demon mask.'),
    ('elderflame', 'Elderflame', 5, dict(a='#2f1b12', b='#a8521c', e='#ff8a1f', p=1), 'Dragon-scale bronze cracked with breathing fire.'),
    ('ion', 'Ion', 4, dict(a='#eef2f5', b='#9aa6b2', e='#2fd8ff'), 'Clean white sci-fi panels with cyan energy traces.'),
    ('sovereign', 'Sovereign', 2, dict(a='#f2efe6', b='#d4af37', e='#7fe6d0'), 'Royal white and gold with a jade glow.'),
    ('rgx', 'RGX 11z Pro', 4, dict(a='#16181d', b='#363b45', e='#ff2a6d', p=1), 'Matte black tech with programmable neon lines.'),
    ('singularity', 'Singularity', 6, dict(a='#1b0f2e', b='#5b2a9a', e='#c76bff', p=1), 'Collapsing-star purple with a pulsing event glow.'),
    ('spectrum', 'Spectrum', 6, dict(a='#121418', b='#2b2f36', e='#5fffb0', p=1), 'Black chassis with a sound-reactive light bar.'),
    ('champions21', 'Champions 2021', 2, dict(a='#141518', b='#d4af37', e='#ffd23a'), 'Champions black and gold.'),
    ('forsaken', 'Forsaken', 5, dict(a='#1d2430', b='#4a5a70', e='#7fb8ff'), 'Weathered ritual steel with spectral blue seams.'),
    ('sentinels', 'Sentinels of Light', 1, dict(a='#e8f0ff', b='#7a8cff', e='#9fd8ff'), 'Radiant white stone with shards of light.'),
    ('recon', 'Recon', 3, dict(a='#5a6a3c', b='#26301c'), 'Field camouflage.'),
    ('ruination', 'Ruination', 5, dict(a='#162520', b='#2f4a3e', e='#3fffb0', p=1), 'Ruined black-green metal with mist-green seams.'),
]
# variant colour names -> (base, secondary, accent); None keeps the line's own value
COL = {'Red': ('#2a1214', '#c4232f', '#ff3048'), 'Blue': ('#121a2c', '#2f5fa8', '#3fa9ff'), 'Gold': ('#1d1a12', '#d4af37', '#ffd23a'), 'Yellow': ('#24210f', '#e3c22a', '#fff04a'),
       'Orange': ('#26170c', '#e8742a', '#ff9a2a'), 'Green': ('#10201a', '#2f8a5a', '#5fffb0'), 'Purple': ('#1b1030', '#6a2c9a', '#c66bff'), 'Teal': ('#0f2223', '#1f8a86', '#3ff0e0'),
       'Black': ('#0d0e10', '#24262b', None), 'White': ('#eceff2', '#b9c0c8', None), 'Silver': ('#c8cdd3', '#7d858f', None), 'Dark': ('#0d0e10', '#2a2228', None), 'Pink': ('#2a1424', '#ff6fb5', '#ff8ad0'),
       'Red/Green': ('#1e1414', '#c4232f', '#5fffb0'), 'Blue/Purple': ('#141433', '#2f5fa8', '#c66bff'), 'Purple/Pink': ('#1b1030', '#8a3ab9', '#ff6fd5'), 'Red/Yellow': ('#2a1410', '#c4402f', '#ffd23a'),
       'Red Camo': ('#6a3a32', '#2f1c18', None), 'Blue Camo': ('#3a4c66', '#1a2433', None), 'Green Camo': ('#4d5a35', '#26301c', None),
       'Kumo': ('#d9dde4', '#3b4a6b', '#9fc4ff'), 'Hana': ('#f0dde2', '#c4507a', '#ff8ab0'), 'Tsubame': ('#16171c', '#2f3a8a', '#6a7cff')}
VAR = re.compile(r'\(Variant\s+\d+\s+([^)]+)\)')
def chromas(skin):
    out = ['Base']
    for c in skin['chromas'][1:]:
        m = VAR.search(c['displayName'].replace('\r', ' ').replace('\n', ' '))
        out.append(m.group(1).strip() if m else 'Variant %d' % len(out))
    return out
cols = [dict(id='standard', name='Standard', tier='Standard', k=0, desc='The factory finish.', pal={}, cc={}, skins={w: dict(n=w, ch=['Base']) for w in GAME})]
for cid, theme, k, pal, desc in LINES:
    ids = {u for u, n in TH.items() if n == theme}; skins = {}; tiers = []; melee = None
    for w in W:
        name = 'Knife' if w['displayName'] == 'Melee' else w['displayName']
        for s in w['skins']:
            if s['themeUuid'] not in ids: continue
            if name == 'Knife':
                if melee is None or len(chromas(s)) > len(chromas(melee)): melee = s
                continue
            if name not in GAME: continue
            skins[name] = dict(n=s['displayName'], ch=chromas(s)); tiers.append(TIER.get(s.get('contentTierUuid')))
    skins['Knife'] = dict(n=theme + ' Knife', ch=chromas(melee) if melee else ['Base'])
    assert skins, theme
    tier = max(set(t for t in tiers if t), key=tiers.count) if any(tiers) else 'Premium'
    cc = {}
    for s in skins.values():
        for n in s['ch'][1:]:
            if n in COL: a, b, e = COL[n]; cc[n] = {x: v for x, v in (('a', a), ('b', b), ('e', e if e else pal.get('e'))) if v}
            else: cc[n] = dict(pal)
    cols.append(dict(id=cid, name=theme, tier=tier, k=k, desc=desc, pal=pal, cc=cc, skins={w: skins[w] for w in GAME if w in skins}))
out = dict(v=2, note='Valorant collection, skin and variant names (valorant-api.com catalogue; names only). Visuals are Valorstrike procedural designs themed on each palette; no Riot textures or models. Every skin is free. A skin id is a collection id (Base) or collection.N for the weapon\'s Nth variant.',
           categories=CATS, collections=cols)
(ROOT / 'server/src/skins.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
print(len(cols) - 1, 'lines,', sum(len(c['skins']) for c in cols[1:]), 'weapon skins')
