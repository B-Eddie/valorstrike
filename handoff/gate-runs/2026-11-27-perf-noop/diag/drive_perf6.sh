#!/bin/bash
# Perf NOOP-GL A/B rerun (QA-README s7) with harness d405efb4 lane.cjs (+ diag md_attach.js step right after noop). base1,lane1,base2,lane2, one attempt each.
export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers
G=/workspace/work/qa/gates6; P=$G/perf; LANE=/workspace/work/vs-lane-three; BASE=/workspace/work/qa/three/base_wt
note() { echo "$(date -u '+%F %T UTC') $*" >> $G/PROGRESS.md; }
rec() { echo "[$(date -u '+%F %T UTC')] exit=$2 :: $1" >> $P/gates.txt; }
ST="noop,js:$P/md_check_pre.js,js:$P/md_attach.js,js:$P/md_check_post.js,warm,meas,js:$P/md_check_end.js"
for spec in "base1 $BASE" "lane1 $LANE" "base2 $BASE" "lane2 $LANE"; do set -- $spec; tag=$1; R=$2; k=perf_$tag
 [ -f $G/.done.$k ] && continue; note "$k start (ROOT=$R sha=$(git -C $R rev-parse HEAD))"
 C="TMO=1500 ROOT=$R MAP=ascent GQ=medium STEPS=$ST MEAS_S=10 MEAS_N=3 HARN=$P/lane_d405.cjs /workspace/work/qa/cpu/run.sh $P/perf_$tag.json"
 TMO=1500 ROOT=$R MAP=ascent GQ=medium STEPS=$ST MEAS_S=10 MEAS_N=3 HARN=$P/lane_d405.cjs /workspace/work/qa/cpu/run.sh $P/perf_$tag.json > $P/perf_$tag.a0.stdout 2>&1; rc=$?
 nm=$(/workspace/work/venv/bin/python -c "import json;print(len(json.load(open('$P/perf_$tag.json')).get('meas',[])))" 2>/dev/null || echo 0)
 rec "$C [$(grep '^RC ' $P/perf_$tag.a0.stdout | tail -1) meas=$nm]" $rc; touch $G/.done.$k; note "step $k done (meas=$nm)"
 [ "$nm" -ge 3 ] || { note "ABORT: $tag incomplete, not retrying"; exit 7; }
done
note "PERF6 DONE"
