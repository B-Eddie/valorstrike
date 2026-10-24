"""Snapshot the game's published weapon stats; runtime has no API dependency."""
import json,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.load(urllib.request.urlopen('https://valorant-api.com/v1/weapons'))['data'];names=set('Classic Shorty Frenzy Ghost Sheriff Stinger Spectre Bucky Judge Bulldog Guardian Phantom Vandal Marshal Outlaw Operator Ares Odin'.split());out={'retrieved':'2026-10-24','source':'https://valorant-api.com/v1/weapons','weapons':{w['displayName']:w['weaponStats'] for w in data if w['displayName'] in names}}
p=root/'models/valorant/weapon-calibration.json';p.write_text(json.dumps(out,indent=2));(root/'models/valorant/weapon-calibration.js').write_text('window.VALORANT_WEAPON_STATS='+json.dumps(out,separators=(',',':'))+';\n')
