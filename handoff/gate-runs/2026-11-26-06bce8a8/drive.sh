#!/bin/bash
# Gate driver for 06bce8a8 handoff checkpoint. Sequential, resumable (each step skipped if its .done marker exists).
# Logs: /workspace/work/qa/gates/<step>/ ; command+exit list: /workspace/work/qa/gates/gates.txt
export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers
G=/workspace/work/qa/gates; T=/workspace/work/qa/three; PY=/workspace/work/venv/bin/python
LANE=/workspace/work/vs-lane-three; BASE=/workspace/work/qa/three/base_wt
cd $G
note() { echo "$(date '+%F %T %Z') $*" >> $G/PROGRESS.md; }
rec() { echo "[$(date '+%F %T %Z')] exit=$2 :: $1" >> $G/gates.txt; }
done_() { [ -f $G/.done.$1 ]; }
mark() { touch $G/.done.$1; note "step $1 done"; }

# 1. targeted tests
if ! done_ tgt; then note "tgt start"; mkdir -p $G/tgt
 C="/workspace/work/qa/three/tgt/run.sh $LANE $G/tgt test_loader_retry test_map_load_memory test_crash_report test_map_prefetch test_asset_versions test_renderer_rebind test_render_quality test_frame_governor"
 $C > $G/tgt/run.stdout 2>&1; rec "$C" $?; mark tgt; fi

shots_n() { $PY -c "import json,sys;print(len(json.load(open(sys.argv[1])).get('shots',{})))" "$1" 2>/dev/null || echo 0; }

# 2. map pixel gate
for mg in "ascent medium" "bind low" "lotus low"; do set -- $mg; M=$1; Q=$2; k=map_$M
 if ! done_ $k; then note "$k start"; mkdir -p $G/map
  C="cd $T && ./runpair.sh $M $Q g1"; (cd $T && ./runpair.sh $M $Q g1) > $G/map/runpair-$M-$Q.stdout 2>&1; rec "$C" $?
  for side in base lane; do R=$BASE; [ $side = lane ] && R=$LANE; tag=${side}g1
   for att in 1 2; do n=$(shots_n $T/shots/$M-$Q-$tag.json); [ "$n" -ge 26 ] && break
    note "$M $Q $tag only $n shots; rerun attempt $att"; cp $T/shots/$M-$Q-$tag.log $G/map/$M-$Q-$tag.attempt$att-failed.log 2>/dev/null
    C2="cd $T && ROOT=$R MAP=$M GQ=$Q TAG=$tag timeout 1500 node h.cjs"; (cd $T && ROOT=$R MAP=$M GQ=$Q TAG=$tag timeout 1500 node h.cjs) > $G/map/rerun-$M-$Q-$tag-$att.stdout 2>&1; rc=$?; rec "$C2 (rerun $att)" $rc; done
   rec "shots in $M-$Q-$tag.json = $(shots_n $T/shots/$M-$Q-$tag.json)" 0; done
  C="$PY cmp.py $M $Q baseg1 laneg1"; (cd $T && $PY cmp.py $M $Q baseg1 laneg1) > $G/map/cmp-$M-$Q.txt 2>&1; rec "cd $T && $C" $?; mark $k; fi; done

# 3. match pixel gate
for spec in "mbaseG $BASE" "mbaseG2 $BASE" "mlaneG $LANE"; do set -- $spec; tag=$1; R=$2; k=match_$tag
 if ! done_ $k; then note "$k start"; mkdir -p $G/match
  for att in 0 1 2; do
   C="cd $T && VW=1 ./runmatch.sh bind low 960 540 $tag $R"; (cd $T && VW=1 ./runmatch.sh bind low 960 540 $tag $R) > $G/match/runmatch-$tag-a$att.stdout 2>&1; rc=$?
   n=$(shots_n $T/shots/bind-low-$tag.json); hud=no; [ -f $T/shots/bind-low-$tag-hud.png ] && hud=yes
   rec "$C (attempt $att) [shots=$n hud=$hud]" $rc; cp $T/shots/bind-low-$tag.log $G/match/bind-low-$tag.attempt$att.log 2>/dev/null
   if [ "$n" -ge 12 ] && [ $hud = yes ]; then break; fi; note "$tag attempt $att incomplete (shots=$n hud=$hud) - likely OOM"; rm -f $T/shots/bind-low-$tag-hud.png; done
  mark $k; fi; done
if ! done_ match_cmp; then
 (cd $T && $PY cmp.py bind low mbaseG mbaseG2) > $G/match/cmp-mbaseG-vs-mbaseG2.txt 2>&1; rec "cd $T && $PY cmp.py bind low mbaseG mbaseG2" $?
 (cd $T && $PY cmp.py bind low mbaseG mlaneG) > $G/match/cmp-mbaseG-vs-mlaneG.txt 2>&1; rec "cd $T && $PY cmp.py bind low mbaseG mlaneG" $?
 mark match_cmp; fi

# 4. perf NOOP-GL, alternate base,lane,base,lane
i=0; for spec in "base1 $BASE" "lane1 $LANE" "base2 $BASE" "lane2 $LANE"; do set -- $spec; tag=$1; R=$2; k=perf_$tag
 if ! done_ $k; then note "$k start"; mkdir -p $G/perf
  for att in 0 1 2; do
   C="TMO=1500 ROOT=$R MAP=ascent GQ=medium STEPS=noop,warm,meas MEAS_S=10 MEAS_N=3 HARN=/workspace/work/qa/cpu/lane.cjs /workspace/work/qa/cpu/run.sh $G/perf/perf_$tag.json"
   TMO=1500 ROOT=$R MAP=ascent GQ=medium STEPS=noop,warm,meas MEAS_S=10 MEAS_N=3 HARN=/workspace/work/qa/cpu/lane.cjs /workspace/work/qa/cpu/run.sh $G/perf/perf_$tag.json > $G/perf/perf_$tag.a$att.stdout 2>&1; rc=$?
   rcl=$(grep '^RC ' $G/perf/perf_$tag.a$att.stdout | tail -1); nm=$($PY -c "import json;print(len(json.load(open('$G/perf/perf_$tag.json')).get('meas',[])))" 2>/dev/null || echo 0)
   rec "$C (attempt $att) [$rcl meas=$nm]" $rc; [ "$nm" -ge 3 ] && break; note "perf $tag attempt $att incomplete"; cp $G/perf/perf_$tag.json.log $G/perf/perf_$tag.a$att.failed.log 2>/dev/null; done
  mark $k; fi; done

# 5. known set on lane
if ! done_ known; then note "known start"; mkdir -p $G/known
 C="/workspace/work/qa/cpu/known.sh $LANE /workspace/work/qa/assets/known_lane_g"; $C > $G/known/known.stdout 2>&1; rec "$C" $?
 sed 's#L=/workspace/work/qa/assets/known_lane$#L=/workspace/work/qa/assets/known_lane_g#' /workspace/work/qa/assets/known_cmp.sh > $G/known_cmp_g.sh; chmod +x $G/known_cmp_g.sh
 $G/known_cmp_g.sh > $G/known/known_cmp.txt 2>&1; rec "$G/known_cmp_g.sh  (copy of qa/assets/known_cmp.sh with L=/workspace/work/qa/assets/known_lane_g)" $?
 mark known; fi

# 6. menu (optional)
for spec in "menuBg $BASE" "menuLg $LANE"; do set -- $spec; tag=$1; R=$2; k=menu_$tag
 if ! done_ $k; then note "$k start"; mkdir -p $G/menu
  for att in 0 1 2; do
   C="cd $T && ROOT=$R MODE=map MAP=ascent GQ=medium TAG=$tag STEPS=node:/workspace/work/qa/three/menu.cjs timeout 1500 node h.cjs"
   (cd $T && ROOT=$R MODE=map MAP=ascent GQ=medium TAG=$tag STEPS=node:/workspace/work/qa/three/menu.cjs timeout 1500 node h.cjs) > $G/menu/$tag.a$att.stdout 2>&1; rc=$?
   n=$(shots_n $T/shots/ascent-medium-$tag.json); rec "$C (attempt $att) [shots=$n]" $rc; [ $rc -eq 0 ] && break; note "menu $tag attempt $att rc=$rc"; done
  mark $k; fi; done
if ! done_ menu_cmp; then (cd $T && $PY cmp.py ascent medium menuBg menuLg) > $G/menu/cmp-menu.txt 2>&1; rec "cd $T && $PY cmp.py ascent medium menuBg menuLg" $?; mark menu_cmp; fi
note "ALL DONE"
