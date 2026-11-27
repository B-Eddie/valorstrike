#!/bin/bash
# Gate run 4 (parity, UU=1) driver: lane 13005d5e vs base e2c14eda. Resumable via .done.<step>.
export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers UU=1 VW=1
G=/workspace/work/qa/gates4; T=/workspace/work/qa/three; PY=/workspace/work/venv/bin/python
LANE=/workspace/work/vs-lane-three; BASE=/workspace/work/qa/three/base_wt
cd $G
note() { echo "$(date '+%F %T %Z') $*" >> $G/PROGRESS.md; }
rec() { echo "[$(date '+%F %T %Z')] exit=$2 :: $1" >> $G/gates.txt; }
done_() { [ -f $G/.done.$1 ]; }
mark() { touch $G/.done.$1; note "step $1 done"; }
shots_n() { $PY -c "import json,sys;print(len(json.load(open(sys.argv[1])).get('shots',{})))" "$1" 2>/dev/null || echo 0; }
uu_ok() { $PY -c "import json,sys;d=json.load(open(sys.argv[1]));u=d.get('uu',[]);print('yes' if u and all(x['matched'] for x in u) and d.get('cfg',{}).get('UU')==1 else 'no')" "$1" 2>/dev/null || echo no; }
run_match() { tag=$1; R=$2; maxa=$3; k=match_$tag
 done_ $k && return; note "$k start (ROOT=$R sha=$(git -C $R rev-parse HEAD))"
 for att in $(seq 0 $((maxa-1))); do
  rm -f $T/shots/bind-low-$tag-hud.png $T/shots/bind-low-$tag.json $T/shots/bind-low-$tag-*.rgba
  C="cd $T && UU=1 VW=1 ./runmatch.sh bind low 960 540 $tag $R"; dm0=$(dmesg 2>/dev/null | wc -l)
  (cd $T && ./runmatch.sh bind low 960 540 $tag $R) > $G/match/runmatch-$tag-a$att.stdout 2>&1; rc=$?
  n=$(shots_n $T/shots/bind-low-$tag.json); hud=no; [ -f $T/shots/bind-low-$tag-hud.png ] && hud=yes; uu=$(uu_ok $T/shots/bind-low-$tag.json)
  dmesg 2>/dev/null | tail -n +$((dm0+1)) > $G/match/dmesg-$tag-a$att.txt; echo "(oom-kill lines: $(grep -ci 'oom\|killed process' $G/match/dmesg-$tag-a$att.txt))" >> $G/match/dmesg-$tag-a$att.txt
  rec "$C (attempt $att) [shots=$n hud=$hud uu_matched=$uu]" $rc
  cp $T/shots/bind-low-$tag.log $G/match/bind-low-$tag.attempt$att.log 2>/dev/null; cp $T/shots/bind-low-$tag.json $G/match/bind-low-$tag.attempt$att.json 2>/dev/null
  if [ "$n" -ge 12 ] && [ $hud = yes ] && [ "$uu" = yes ]; then note "$tag attempt $att complete (shots=$n uu=$uu)"; break; fi
  if [ "$n" -ge 12 ] && [ "$uu" != yes ]; then note "$tag attempt $att UU NOT MATCHED - abort driver"; exit 3; fi
  note "$tag attempt $att incomplete (shots=$n hud=$hud uu=$uu rc=$rc) - likely OOM"
  [ $att -eq $((maxa-1)) ] && { note "$tag exhausted $maxa attempts - abort"; exit 4; }; done
 mark $k; }
run_match mbaseP1 $BASE 6
run_match mlaneP1 $LANE 6
run_match mlaneP2 $LANE 6
if ! done_ match_cmp; then
 for p in "mbaseU1 mbaseP1" "mbaseP1 mlaneP1" "mbaseU1 mlaneP1" "mlaneP1 mlaneP2" "mbaseP1 mlaneP2" "mbaseU1 mlaneP2"; do set -- $p
  (cd $T && $PY cmp.py bind low $1 $2) > $G/match/cmp-$1-vs-$2.txt 2>&1; rec "cd $T && $PY cmp.py bind low $1 $2" $?; done
 mark match_cmp; fi
note "MATCH DONE"
k=botfeel_lane
if ! done_ $k; then R=$LANE; H=$LANE/handoff/qa/botfeel/uu_hook.cjs; note "$k start (sha=$(git -C $R rev-parse HEAD))"; rm -f $G/botfeel/uu_lane.log
  C="cd $R && UU=1 UU_LOG=$G/botfeel/uu_lane.log NODE_OPTIONS='--require $H' timeout 1500 node work/test_bot_feel_offline.cjs"
  t0=$(date +%s); (cd $R && UU=1 UU_LOG=$G/botfeel/uu_lane.log NODE_OPTIONS="--require $H" timeout 1500 node work/test_bot_feel_offline.cjs) > $G/botfeel/test_bot_feel_offline.lane.log 2>&1; rc=$?
  echo "EXIT $rc $(( $(date +%s)-t0 ))s" >> $G/botfeel/test_bot_feel_offline.lane.log; rec "$C" $rc; mark $k; fi
note "DRIVE4 DONE"
