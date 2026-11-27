#!/bin/bash
# copy raw gate outputs + PNGs into the LANE commit dir
G=/workspace/work/qa/gates; T=/workspace/work/qa/three; S=$T/shots; PY=/workspace/work/venv/bin/python
O=/workspace/work/vs-lane-three/handoff/gate-runs/2026-11-26-06bce8a8
rm -rf $O; mkdir -p $O/{static,tgt,map/png,match/png,match/harness,perf,known,menu/png}
cp /tmp/static_gates.txt $O/static/static_gates.txt
cp $G/tgt/* $O/tgt/
# map
cp $G/map/*.txt $G/map/*.stdout $O/map/ 2>/dev/null; cp $G/map/*failed.log $O/map/ 2>/dev/null
for m in ascent-medium bind-low lotus-low; do for t in baseg1 laneg1; do cp $S/$m-$t.json $S/$m-$t.log $O/map/; done; done
$PY $G/mkimg.py $O/map/png ascent medium baseg1 laneg1; $PY $G/mkimg.py $O/map/png bind low baseg1 laneg1; $PY $G/mkimg.py $O/map/png lotus low baseg1 laneg1
# match
cp $G/match/*.txt $G/match/*.stdout $G/match/*.log $O/match/ 2>/dev/null
for t in mbaseG mbaseG2 mlaneG; do cp $S/bind-low-$t.json $S/bind-low-$t.log $O/match/harness/; cp $S/bind-low-$t-hud.png $O/match/png/ 2>/dev/null; done
$PY $G/mkimg.py $O/match/png bind low mbaseG mbaseG2; $PY $G/mkimg.py $O/match/png bind low mbaseG mlaneG
$PY $G/mkimg.py $O/match/png bind low mbaseG2 mlaneG
# perf
cp $G/perf/* $O/perf/
# known
cp $G/known/* $O/known/ 2>/dev/null; cp $G/known_cmp_g.sh $O/known/; mkdir -p $O/known/known_lane_g; cp /workspace/work/qa/assets/known_lane_g/* $O/known/known_lane_g/ 2>/dev/null
# menu
cp $G/menu/* $O/menu/ 2>/dev/null; for t in menuBg menuLg; do cp $S/ascent-medium-$t.json $S/ascent-medium-$t.log $O/menu/ 2>/dev/null; done
[ -f $S/ascent-medium-menuBg.json ] && $PY $G/mkimg.py $O/menu/png ascent medium menuBg menuLg
cp $G/gates.txt $O/gates.txt; cp $G/drive.sh $G/mkimg.py $G/assemble.sh $O/
du -sh $O $O/*/png
