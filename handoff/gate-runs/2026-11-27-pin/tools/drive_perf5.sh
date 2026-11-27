#!/bin/bash
# Perf NOOP-GL A/B (QA-README s7), runs after drive5 (match + bot_feel) is done. base,lane,base,lane. Resumable.
export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers
G=/workspace/work/qa/gates5; PY=/workspace/work/venv/bin/python; LANE=/workspace/work/vs-lane-three; BASE=/workspace/work/qa/three/base_wt
cd $G
note() { echo "$(date '+%F %T %Z') $*" >> $G/PROGRESS.md; }
rec() { echo "[$(date '+%F %T %Z')] exit=$2 :: $1" >> $G/perf/gates.txt; }
done_() { [ -f $G/.done.$1 ]; }; mark() { touch $G/.done.$1; note "step $1 done"; }
for i in $(seq 1 60); do grep -q 'DRIVE5 DONE' $G/PROGRESS.md && break; [ -f $G/.abort ] && exit 9; sleep 60; done
grep -q 'DRIVE5 DONE' $G/PROGRESS.md || { note "perf: drive5 never finished, perf not run"; exit 8; }
for spec in "base1 $BASE" "lane1 $LANE" "base2 $BASE" "lane2 $LANE"; do set -- $spec; tag=$1; R=$2; k=perf_$tag
 if ! done_ $k; then note "$k start (ROOT=$R sha=$(git -C $R rev-parse HEAD))"
  for att in 0 1 2; do
   C="TMO=1500 ROOT=$R MAP=ascent GQ=medium STEPS=noop,warm,meas MEAS_S=10 MEAS_N=3 HARN=/workspace/work/qa/cpu/lane.cjs /workspace/work/qa/cpu/run.sh $G/perf/perf_$tag.json"
   TMO=1500 ROOT=$R MAP=ascent GQ=medium STEPS=noop,warm,meas MEAS_S=10 MEAS_N=3 HARN=/workspace/work/qa/cpu/lane.cjs /workspace/work/qa/cpu/run.sh $G/perf/perf_$tag.json > $G/perf/perf_$tag.a$att.stdout 2>&1; rc=$?
   rcl=$(grep '^RC ' $G/perf/perf_$tag.a$att.stdout | tail -1); nm=$($PY -c "import json;print(len(json.load(open('$G/perf/perf_$tag.json')).get('meas',[])))" 2>/dev/null || echo 0)
   rec "$C (attempt $att) [$rcl meas=$nm]" $rc; [ "$nm" -ge 3 ] && break; note "perf $tag attempt $att incomplete"; cp $G/perf/perf_$tag.json.log $G/perf/perf_$tag.a$att.failed.log 2>/dev/null; done
  mark $k; fi; done
note "PERF5 DONE"
