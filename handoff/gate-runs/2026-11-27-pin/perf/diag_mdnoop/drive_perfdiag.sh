#!/bin/bash
# DIAGNOSTIC (not the QA-README s7 protocol): same A/B with lane_mdnoop.cjs (noop also stubs WEBGL_multi_draw). base, lane.
export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers
G=/workspace/work/qa/gates5; PY=/workspace/work/venv/bin/python; LANE=/workspace/work/vs-lane-three; BASE=/workspace/work/qa/three/base_wt
note() { echo "$(date '+%F %T %Z') $*" >> $G/PROGRESS.md; }
rec() { echo "[$(date '+%F %T %Z')] exit=$2 :: $1" >> $G/perf/diag_mdnoop/gates.txt; }
mkdir -p $G/perf/diag_mdnoop
for spec in "base3md $BASE" "lane3md $LANE"; do set -- $spec; tag=$1; R=$2; k=perfdiag_$tag
 [ -f $G/.done.$k ] && continue; note "$k start (ROOT=$R sha=$(git -C $R rev-parse HEAD))"
 C="TMO=1500 ROOT=$R MAP=ascent GQ=medium STEPS=noop,warm,meas MEAS_S=10 MEAS_N=3 HARN=$G/perf/lane_mdnoop.cjs /workspace/work/qa/cpu/run.sh $G/perf/diag_mdnoop/perf_$tag.json"
 TMO=1500 ROOT=$R MAP=ascent GQ=medium STEPS=noop,warm,meas MEAS_S=10 MEAS_N=3 HARN=$G/perf/lane_mdnoop.cjs /workspace/work/qa/cpu/run.sh $G/perf/diag_mdnoop/perf_$tag.json > $G/perf/diag_mdnoop/perf_$tag.a0.stdout 2>&1; rc=$?
 rec "$C [$(grep '^RC ' $G/perf/diag_mdnoop/perf_$tag.a0.stdout | tail -1)]" $rc; touch $G/.done.$k; note "step $k done"; done
note "PERFDIAG DONE"
