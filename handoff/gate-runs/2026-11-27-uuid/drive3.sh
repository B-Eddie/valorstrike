#!/bin/bash
# step 4 (NoAO lane copy) + step 3 (bot_feel UU=1). Resumable via .done.<step>.
export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers
G=/workspace/work/qa/gates2; T=/workspace/work/qa/three; PY=/workspace/work/venv/bin/python
LANE=/workspace/work/vs-lane-three; BASE=/workspace/work/qa/three/base_wt; NOAO=$G/noao_wt
cd $G
note() { echo "$(date '+%F %T %Z') $*" >> $G/PROGRESS.md; }
rec() { echo "[$(date '+%F %T %Z')] exit=$2 :: $1" >> $G/gates.txt; }
done_() { [ -f $G/.done.$1 ]; }
mark() { touch $G/.done.$1; note "step $1 done"; }
shots_n() { $PY -c "import json,sys;print(len(json.load(open(sys.argv[1])).get('shots',{})))" "$1" 2>/dev/null || echo 0; }
uu_ok() { $PY -c "import json,sys;d=json.load(open(sys.argv[1]));u=d.get('uu',[]);print('yes' if u and all(x['matched'] for x in u) and d.get('cfg',{}).get('UU')==1 else 'no')" "$1" 2>/dev/null || echo no; }
tag=mlaneNoAO; k=match_$tag
if ! done_ $k; then note "$k start (ROOT=$NOAO, scratch worktree at c6ed1efc with gltf-ao-channel + gltf-ao-uvcopy removed, vendor/three rebuilt)"
 for att in 0 1 2 3; do rm -f $T/shots/bind-low-$tag-hud.png $T/shots/bind-low-$tag.json
  C="cd $T && UU=1 VW=1 ./runmatch.sh bind low 960 540 $tag $NOAO"
  (cd $T && UU=1 VW=1 ./runmatch.sh bind low 960 540 $tag $NOAO) > $G/match/runmatch-$tag-a$att.stdout 2>&1; rc=$?
  n=$(shots_n $T/shots/bind-low-$tag.json); hud=no; [ -f $T/shots/bind-low-$tag-hud.png ] && hud=yes; uu=$(uu_ok $T/shots/bind-low-$tag.json)
  dmesg 2>/dev/null | tail -3 > $G/match/dmesg-$tag-a$att.txt
  rec "$C (attempt $att) [shots=$n hud=$hud uu_matched=$uu]" $rc
  cp $T/shots/bind-low-$tag.log $G/match/bind-low-$tag.attempt$att.log 2>/dev/null; cp $T/shots/bind-low-$tag.json $G/match/bind-low-$tag.attempt$att.json 2>/dev/null
  [ "$uu" != yes ] && { note "$tag UU not matched - abort"; exit 3; }
  if [ "$n" -ge 12 ] && [ $hud = yes ]; then note "$tag attempt $att complete"; break; fi; note "$tag attempt $att incomplete (shots=$n hud=$hud)"; done
 for p in "mlaneU1 mlaneNoAO" "mbaseU1 mlaneNoAO" "mbaseU2 mlaneNoAO" "mlaneU2 mlaneNoAO"; do set -- $p
  (cd $T && $PY cmp.py bind low $1 $2) > $G/match/cmp-$1-vs-$2.txt 2>&1; rec "cd $T && $PY cmp.py bind low $1 $2" $?; done
 mark $k; fi
# step 3: bot_feel under UU on LANE, then extra on BASE main
mkdir -p $G/botfeel
for spec in "lane $LANE" "base_extra $BASE"; do set -- $spec; s=$1; R=$2; k=botfeel_$s
 if ! done_ $k; then note "$k start (sha=$(git -C $R rev-parse HEAD))"; rm -f $G/botfeel/uu_$s.log
  C="cd $R && UU=1 UU_LOG=$G/botfeel/uu_$s.log NODE_OPTIONS='--require $G/uu_hook.cjs' node work/test_bot_feel_offline.cjs"
  t0=$(date +%s); (cd $R && UU=1 UU_LOG=$G/botfeel/uu_$s.log NODE_OPTIONS="--require $G/uu_hook.cjs" timeout 1500 node work/test_bot_feel_offline.cjs) > $G/botfeel/test_bot_feel_offline.$s.log 2>&1; rc=$?
  echo "EXIT $rc $(( $(date +%s)-t0 ))s" >> $G/botfeel/test_bot_feel_offline.$s.log; rec "$C" $rc; mark $k; fi; done
note "DRIVE3 DONE"
