"""Foliage / thin-decor collision exclusion (user: "a plant ... blocking me", "a lilypad ... that blocks").

collision.bin (work/export_native_map.py) keeps every source object whose NAME misses its foliage regex, so plant beds,
potted plants, lilypads, hanging plants, wires and flat floor decor kept full player collision even though in VALORANT
players walk (and shoot) through foliage. collision.bin carries no material names, so each collision triangle is matched
to the identical render triangle in scene.gltf (positions agree to 1 mm) to get its material, then:
  WHOLE  - materials that are only foliage / thin decor: every triangle is dropped.
  MIXED  - atlases holding a pot/planter/trunk AND leaves (palms, flowering trees, potted-plant atlases): a triangle is
           dropped when the texture under its UVs is foliage-coloured (green, or the purple FlowerD canopy); pots,
           planters, trunks and gravel keep collision.
Everything else (planters, pots, trunks, arborvitae columns, giant Lotus vines, flags on poles, curtains, rolled rugs,
sacks, crates, all floor/wall surfaces incl. moss/grass-blend floors) keeps collision.
Safety: a dropped triangle is restored (with its whole welded component) when a valid navigation node stands on it and no
kept collision lies within DROP (1.3 m) below that node (the floor beneath must be the walkable surface; never open a hole).
Output models/valorant/maps/<key>/collision-exclude.bin: u32 runCount, then runCount x (u32 firstTriangle, u32 count)
over collision.bin triangle order. Applied by server/build-world.cjs and work/native_maps_runtime.js nmRawCollision.
Usage: python3 work/build_foliage_exclude.py [maps...]   (prints one JSON summary line per map)
"""
import json, re, sys, struct
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAPS = sys.argv[1:] or ['ascent', 'bind', 'haven', 'split', 'lotus', 'breeze']
WHOLE = [r'^(Range)?Plant_\d+_M\d+_',                     # every Plant_* foliage: beach cabbage, shrubs, ferns, bushes, desert plants, moss overgrowth, creepers, agave
         r'^PlantPotted_0_M0_A_MI', r'^PlantPotted_0_M[45]_Hanging', r'^Pot_1_M0_PlantAlpha',
         r'^Tree_\d+_M\d+_(PalmA_Leaves|TreeLeaf|VistaTreeLeaf|VistaTreeCanopy|Beech\w*Foliage)', r'^Tree_\d+_M[12]_Conifer_MI',
         r'^Tree_0_M0_Bananna', r'^Vista_\d+_M\d+_(TreeCard|TreeAFoliage)', r'^Grass_1_Clump', r'^Prop_0_M0_LillyPad',
         r'^VinesTech_0_M0_Cables(LeafsLightB|Moss)',
         r'^Wires(Dark|Yellow)?_\d+_(Ofset_)?MI$', r'^Wires_2_M0_RebelWiresMask', r'^Light_6_M0_WireSway', r'^M_Port_WindSway_Cable',
         r'^Mat_BendingRope', r'^Rope_\d+_(M0_)?MI$', r'^Ascender_0_M0_Cable', r'^SmallFlagsMovement',
         r'^Cloth_0_M0_HangingA', r'^Yarn_1_M0_HangingA', r'^Basket_1_M0_HangingA', r'^Rug_0_M0_HangingA',
         r'^Puddle_', r'^Rug_0_M0_(Floor|AreaRug)', r'^Rug_2_M0_LargeA', r'^Spice_M0_SpiceDecal', r'^Petals_M0_PetalsWall']
MIXED = [r'^Tree_1_M0_PalmA_MI$', r'^Tree_0_M1_Palm_MI$', r'^Tree_4_M0_BonsaiA', r'^Tree_1_M3_FlowerD', r'^Tree_1_M2_ConiferC',
         r'^Planter_0_M0_AMasked', r'^Garden_0_M0_PlantPotted', r'^Pot_1_M0_Plant_MI$']
# (x, floorY, z, why): plants kept because excluding them opened a NEW reachable void (qa reachvoid scan before/after)
KEEP = {'lotus': [(-60.0, 6.3, -6.25, 'only floor at a ledge west of C Main (reachvoid new-only cell)'),
                  (-59.75, 6.3, -5.25, 'only floor at a ledge west of C Main (reachvoid new-only cell)'),
                  (-41.25, 6.3, -17.0, 'fenced a pre-existing void edge (reachvoid new-only cell)')],
        # grass clumps that are the only floor at void edges beside A Main / A Lobby: the nodes next to them have real floor
        # within DROP, so the 1.3 m rule stopped restoring them (reachvoid new-only cells, exclusion v2)
        'split': [(49.5, 4.01, -36.5, 'grass clump = only floor at a void edge (reachvoid new-only cell)'), (51.0, 4.01, -35.75, 'grass clump = only floor at a void edge'),
                  (49.25, 4.01, -25.25, 'grass clump = only floor at a void edge'), (56.1, 4.01, -24.25, 'grass clump = only floor at a void edge'),
                  (57.0, 4.01, -19.75, 'grass clump = only floor at a void edge'), (62.0, 4.01, -14.0, 'grass clump = only floor at a void edge')]}
# Decal cards (graffiti, murals, container stickers): the page draws Decal/Floater materials whose texture has alpha as
# alpha-tested overlays (nmDecalStyle), so their cards are see-through; several float 2-5 cm off their wall and were the
# only thing a player touched (invisible walls, work/invis capsweep: Bind UrbanArtI, Breeze DefPathMidMural). Dropped
# like foliage (nav-ground safety still applies) when the texture really carries alpha (16x16 min alpha < 250, as the page).
DECAL = [r'Decal', r'Floater']
WRE = re.compile('|'.join(WHOLE)); MRE = re.compile('|'.join(MIXED)); DRE = re.compile('|'.join(DECAL), re.I)
# Nav-ground safety depth: a node the nav bake stood on a leaf top is only "unsupported" when no kept surface lies within
# DROP below it. Was 0.35 m: the beach-cabbage / desert-plant beds the bake walked over sit 0.36-1.3 m above the real
# ground, so whole welded beds (alpha-cut card edges included) were restored as solid along Breeze lane edges = the
# invisible walls "near the grasses on the side". Sinking <= 1.3 m through a plant onto the ground is how VALORANT plays.
DROP = 1.3
LOCAL = .6


def decal_alpha(D, g, m):
    t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if t is None: return False
    im = Image.open(D / g['images'][g['textures'][t['index']]['source']]['uri']).convert('RGBA').resize((16, 16), Image.BILINEAR)
    return int(np.asarray(im)[..., 3].min()) < 250
CT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}


def foliage_pixel(rgb, purple):
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    green = (g - np.maximum(r, b) >= 8) & (g > 40)
    return green | ((np.minimum(r, b) - g >= 12) if purple else False)


def tri_hash(P, I):
    q = np.round(P.astype(np.float64) * 1000).astype(np.int64)
    vh = (q[:, 0] * 73856093) ^ (q[:, 1] * 19349663) ^ (q[:, 2] * 83492791)
    t = np.sort(vh[I.reshape(-1, 3)], axis=1)
    return (t[:, 0] * 1000003) ^ (t[:, 1] * 998244353) ^ (t[:, 2] * 1234567891)


def build(key):
    D = ROOT / 'models/valorant/maps' / key; g = json.loads((D / 'scene.gltf').read_text()); bufs = {}
    def acc(i):
        a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
        if v['buffer'] not in bufs: bufs[v['buffer']] = (D / g['buffers'][v['buffer']]['uri']).read_bytes()
        n = NC[a['type']]; off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(bufs[v['buffer']], CT[a['componentType']], a['count'] * n, off).reshape(-1, n) if n > 1 else np.frombuffer(bufs[v['buffer']], CT[a['componentType']], a['count'], off)
    # render triangles of candidate materials only (keeps memory low): hash -> (decision)
    hashes, drop, mid = [], [], []
    for node in g['nodes']:
        if node.get('mesh') is None: continue
        for pr in g['meshes'][node['mesh']]['primitives']:
            m = g['materials'][pr['material']]; name = m['name']
            whole, mixed = bool(WRE.search(name)), bool(MRE.search(name))
            if not (whole or mixed) and DRE.search(name) and decal_alpha(D, g, m): whole = True
            if not (whole or mixed): continue
            P = acc(pr['attributes']['POSITION']); I = acc(pr['indices']).astype(np.int64)
            h = tri_hash(P, I)
            if whole: d = np.ones(len(h), bool)
            else:
                t = m['pbrMetallicRoughness']['baseColorTexture']['index']; ima = np.asarray(Image.open(D / g['images'][g['textures'][t]['source']]['uri']).convert('RGBA')); im = ima[..., :3]
                UV = acc(pr['attributes']['TEXCOORD_0']); T3 = I.reshape(-1, 3); H, W = im.shape[:2]
                purple = 'FlowerD' in name; votes = np.zeros(len(h), int)
                for w in ([1/3, 1/3, 1/3], [.6, .2, .2], [.2, .6, .2], [.2, .2, .6]):
                    uv = UV[T3[:, 0]] * w[0] + UV[T3[:, 1]] * w[1] + UV[T3[:, 2]] * w[2]
                    x = np.clip((np.mod(uv[:, 0], 1) * W).astype(int), 0, W - 1); y = np.clip((np.mod(uv[:, 1], 1) * H).astype(int), 0, H - 1)
                    # foliage-coloured, or cut away by the page's 0.45 alpha test (card texels around leaves often keep a
                    # non-green RGB under alpha 0: they drew see-through but stayed solid = invisible walls)
                    votes += foliage_pixel(im[y, x], purple) | (ima[y, x, 3] < 115)
                d = votes >= 3
            hashes.append(h); drop.append(d); mid.append(np.full(len(h), pr['material'], np.int32))
    H = np.concatenate(hashes); Dp = np.concatenate(drop); Mi = np.concatenate(mid); o = np.argsort(H, kind='stable'); H, Dp, Mi = H[o], Dp[o], Mi[o]
    b = (D / 'collision.bin').read_bytes(); nv, ni = struct.unpack_from('<II', b); CP = np.frombuffer(b, np.float32, nv * 3, 8).reshape(-1, 3); CI = np.frombuffer(b, np.uint32, ni, 8 + nv * 12).astype(np.int64)
    ch = tri_hash(CP, CI); k = np.searchsorted(H, ch); k = np.clip(k, 0, len(H) - 1); hit = H[k] == ch
    ex = hit & Dp[k]; cmat = np.where(hit, Mi[k], -1)
    # ---- safety: never open a hole under a valid nav node ----
    # kept ground also includes collision-patch.bin (floor patches, Lotus C water floor / void fill): plants lying on a
    # patched floor are excluded, plants that are the only surface over a void are kept
    nt0 = len(CI) // 3; CPa, T3 = CP, CI.reshape(-1, 3)
    if (D / 'collision-patch.bin').exists():
        pb = (D / 'collision-patch.bin').read_bytes(); pv, pi = struct.unpack_from('<II', pb)
        PP = np.frombuffer(pb, np.float32, pv * 3, 8).reshape(-1, 3); PI = np.frombuffer(pb, np.uint32, pi, 8 + pv * 12).astype(np.int64).reshape(-1, 3)
        CPa = np.concatenate([CP, PP]); T3 = np.concatenate([T3, PI + len(CP)]); ex = np.concatenate([ex, np.zeros(len(PI), bool)]); cmat = np.concatenate([cmat, np.full(len(PI), -2)])
    tri = CPa[T3]; mn = tri.min(1); mx = tri.max(1)
    nav = json.loads((D / 'navigation.json').read_text()); nodes = np.array(nav['nodes']); valid = np.array(nav.get('valid', [True] * len(nodes)), bool)
    # every valid node plus the midpoints toward its neighbours (nodes are 0.75 m apart): ground must survive at all of them
    # protected = valid nodes in nav components of >= 30 nodes (the playable set and rope-reached rooms such as Split Vent;
    # never the few-node islands the bake left on tree canopies / plant tops, which are not standable space)
    adj = nav['adj']; seen = np.zeros(len(nodes), bool); prot = np.zeros(len(nodes), bool)
    for s0 in range(len(nodes)):
        if seen[s0] or not valid[s0]: continue
        comp = [s0]; seen[s0] = True
        for c in comp:
            for j in adj[c]:
                if valid[j] and not seen[j]: seen[j] = True; comp.append(j)
        if len(comp) >= 30: prot[comp] = True
    vn = nodes[prot]; vn = np.concatenate([vn] + [vn + np.array(o) for o in ([.375, 0, 0], [-.375, 0, 0], [0, 0, .375], [0, 0, -.375])])
    def hits(nodeset, mask, lo=.35):
        # vertical ray at each node: triangles in mask whose surface lies in [y-lo, y+0.05] -> list of (node, tri, y)
        out = []; cand = np.nonzero(mask)[0]; cell = {}
        for t in cand:
            for gx in range(int(np.floor(mn[t, 0])), int(np.floor(mx[t, 0])) + 1):
                for gz in range(int(np.floor(mn[t, 2])), int(np.floor(mx[t, 2])) + 1): cell.setdefault((gx, gz), []).append(t)
        for i, (x, y, z) in enumerate(nodeset):
            for t in cell.get((int(np.floor(x)), int(np.floor(z))), []):
                if mn[t, 1] > y + .05 or mx[t, 1] < y - lo: continue
                a, bb, c = tri[t]; v0, v1 = bb - a, c - a; den = v0[0] * v1[2] - v0[2] * v1[0]
                if abs(den) < 1e-9: continue
                px, pz = x - a[0], z - a[2]; s = (px * v1[2] - pz * v1[0]) / den; u = (v0[0] * pz - v0[2] * px) / den
                if s < -1e-4 or u < -1e-4 or s + u > 1 + 1e-4: continue
                yy = a[1] + s * v0[1] + u * v1[1]
                if y - lo <= yy <= y + .05: out.append((i, t, yy))
        return out
    restored = 0; restored_at = []
    for _ in range(4):
        exh = hits(vn, ex); risky = sorted({i for i, _, _ in exh})
        if not risky: break
        keep = {i for i, _, _ in hits(vn[risky], ~ex, DROP)}; bad = {risky[j] for j in range(len(risky)) if j not in keep}
        if not bad: break
        # restore the LOWEST excluded surface under each bad node (moss carpet that IS the ground, not the lilypad lying
        # on it) with the part of its welded component within LOCAL m of the node: enough to stand on / fence a deep drop
        # where the nav walked over the plant, without bringing back the whole bed (whole beds restored this way were the
        # see-through invisible walls along Breeze lane edges)
        seeds = {}
        for i, t, yy in exh:
            if i in bad and (i not in seeds or yy < seeds[i][1]): seeds[i] = (t, yy)
        from scipy.sparse import coo_matrix
        from scipy.sparse.csgraph import connected_components
        et = np.nonzero(ex)[0]; m = len(et); vv = T3[et]
        rows = np.repeat(np.arange(m)[None, :], 3, 0).ravel()
        vk = (cmat[et][:, None].astype(np.int64) * len(CPa) + vv).T.ravel(); uk, cols = np.unique(vk, return_inverse=True); cols = cols + m  # weld only within one material
        G = coo_matrix((np.ones(len(rows), np.int8), (rows, cols)), shape=(m + len(uk), m + len(uk)))
        _, lab = connected_components(G, directed=False); pos = {t: j for j, t in enumerate(et)}; lab = lab[:m]
        sel = set()
        for i, (t, yy) in seeds.items():
            x, y, z = vn[i]; comp = et[lab == lab[pos[t]]]
            near = comp[(mn[comp, 0] <= x + LOCAL) & (mx[comp, 0] >= x - LOCAL) & (mn[comp, 2] <= z + LOCAL) & (mx[comp, 2] >= z - LOCAL) & (mx[comp, 1] >= y - DROP - 1) & (mn[comp, 1] <= y + .3)]
            sel.update(near.tolist()); sel.add(int(t))
        sel = np.array(sorted(sel), np.int64)
        restored += len(sel); ex[sel] = False
        for i, (t, yy) in seeds.items(): restored_at.append([round(float(c), 2) for c in vn[i]])
    # explicit keeps: spots where a reachable-void scan (0.25 m cells within 2.5 m of playable nodes, capsule fits, nothing
    # within 9.6 m below; qa reachvoid) found the excluded plant was the only floor, or the only thing fencing a player off
    # a pre-existing void. Every excluded triangle in a 0.45 m column around the spot (from 0.6 m below to 1.8 m above the
    # floor height) is restored with its welded component.
    kept = []
    for (kx, ky, kz, why) in KEEP.get(key, []):
        sel = np.nonzero(ex & (mn[:, 0] <= kx + .45) & (mx[:, 0] >= kx - .45) & (mn[:, 2] <= kz + .45) & (mx[:, 2] >= kz - .45) & (mx[:, 1] >= ky - .6) & (mn[:, 1] <= ky + 1.8))[0]
        if not len(sel): continue
        from scipy.sparse import coo_matrix
        from scipy.sparse.csgraph import connected_components
        et = np.nonzero(ex)[0]; m = len(et); vv = T3[et]
        rows = np.repeat(np.arange(m)[None, :], 3, 0).ravel()
        vk = (cmat[et][:, None].astype(np.int64) * len(CPa) + vv).T.ravel(); uk, cols = np.unique(vk, return_inverse=True); cols = cols + m
        G = coo_matrix((np.ones(len(rows), np.int8), (rows, cols)), shape=(m + len(uk), m + len(uk)))
        _, lab = connected_components(G, directed=False); pos = {t: j for j, t in enumerate(et)}
        want = {lab[pos[t]] for t in sel}; back = et[np.isin(lab[:m], list(want))]
        ex[back] = False; restored += len(back)
        kept.append({'at': [kx, ky, kz], 'why': why, 'tris': int(len(back)), 'materials': sorted({g['materials'][int(c)]['name'] for c in cmat[back] if c >= 0})})
    ex = ex[:nt0]; idx = np.nonzero(ex)[0]
    runs = []
    if len(idx):
        br = np.nonzero(np.diff(idx) != 1)[0]; starts = np.concatenate([[idx[0]], idx[br + 1]]); ends = np.concatenate([idx[br], [idx[-1]]])
        runs = np.stack([starts, ends - starts + 1], 1).astype('<u4')
    (D / 'collision-exclude.bin').write_bytes(struct.pack('<I', len(runs)) + (np.asarray(runs, '<u4').tobytes() if len(runs) else b''))
    return {'key': key, 'collisionTris': int(ni // 3), 'matched': int(hit.sum()), 'excluded': int(ex.sum()), 'runs': len(runs), 'restoredForNavGround': restored,
            'restoredAt': restored_at, 'kept': kept}


if __name__ == '__main__':
    rep = [build(k) for k in MAPS]
    for r in rep: print(json.dumps({k: v for k, v in r.items() if k != 'restoredAt'}))
