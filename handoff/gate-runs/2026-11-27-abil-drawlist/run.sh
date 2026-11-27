#!/bin/bash
# DL=1 draw-list match runs (BASE then LANE), same config as gates2 mbaseU1/mlaneU1 (runmatch.sh: bind low 960x540, PRE, agents.cjs, SETTLE=3) + UU=1 VW=1.
export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers UU=1 VW=1 DL=1
G=/workspace/work/qa/gates3; T=/workspace/work/qa/three; PY=/workspace/work/venv/bin/python
LANE=/workspace/work/vs-lane-three; BASE=/workspace/work/qa/three/base_wt
PRE="F_MATES.splice(0,4,'Sova','Chamber','Tejo','Miks');F_EN.splice(0,5,'KAY/O','Reyna','Yoru','Gekko','Brimstone');xTmPreDrawn=true;{let s=777;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}xskGive('Vandal','prime');xskEquip('Vandal','prime.1');xskGive('Knife','blastx');xskEquip('Knife','blastx');1"
note() { echo "$(date -u '+%F %T UTC') $*" >> $G/PROGRESS.md; }
rec() { echo "[$(date -u '+%F %T UTC')] exit=$2 :: $1" >> $G/gates.txt; }
chk() { $PY -c "import json,sys;d=json.load(open(sys.argv[1]));dl=d.get('dl',{});print(len(d.get('shots',{})),sum(1 for k in ('abil_a0','abil_a1','abil_a2') if k in dl),d.get('cfg',{}).get('UU'),all(x['matched'] for x in d.get('uu',[]) or [{'matched':False}]))" "$1" 2>/dev/null || echo "0 0 0 False"; }
run() { tag=$1; R=$2; [ -f $G/.done.$tag ] && return; note "$tag start ROOT=$R sha=$(git -C $R rev-parse HEAD)"
 for att in 0 1 2 3 4 5; do
  rm -f $G/out/bind-low-$tag.json
  dm0=$(dmesg 2>/dev/null | wc -l)
  (cd $T && PRE="$PRE" WEAP=vandal ROOT=$R MODE=match MAP=bind GQ=low W=960 H=540 TAG=$tag OUTD=$G/out/ STEPS=node:$T/agents.cjs SETTLE=3 timeout 2400 node $G/h_drawlist.cjs > $G/out/stdout-$tag-a$att.txt 2>&1); rc=$?
  dmesg 2>/dev/null | tail -n +$((dm0+1)) > $G/out/dmesg-$tag-a$att.txt; oom=$(grep -ci 'oom\|killed process' $G/out/dmesg-$tag-a$att.txt)
  c=$(chk $G/out/bind-low-$tag.json); set -- $c
  cp $G/out/bind-low-$tag.json $G/out/bind-low-$tag.attempt$att.json 2>/dev/null; cp $G/out/bind-low-$tag.log $G/out/bind-low-$tag.attempt$att.log 2>/dev/null
  rec "DL=1 UU=1 VW=1 h_drawlist.cjs bind low 960 540 $tag ROOT=$R (attempt $att) [shots=$1 dl_abil=$2 UU=$3 uu_matched=$4 oom_lines=$oom]" $rc
  if [ "$4" != True ]; then note "$tag attempt $att UU not matched - abort"; exit 3; fi
  if [ "$1" -ge 12 ] && [ "$2" = 3 ]; then note "$tag attempt $att complete (shots=$1)"; touch $G/.done.$tag; return; fi
  note "$tag attempt $att incomplete (shots=$1 dl=$2 oom_lines=$oom)"; done
 note "$tag FAILED after 6 attempts"; exit 4; }
run mbaseDL $BASE
run mlaneDL $LANE
note "ALL DONE"
