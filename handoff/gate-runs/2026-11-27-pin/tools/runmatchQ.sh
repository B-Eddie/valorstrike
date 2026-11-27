#!/bin/bash
# = qa/three/runmatch.sh (identical PRE / env), except STEPS points at the read-only loadout observer that wraps agents.cjs.
# usage: runmatchQ.sh MAP GQ W H TAG ROOT
cd /workspace/work/qa/three
PRE="F_MATES.splice(0,4,'Sova','Chamber','Tejo','Miks');F_EN.splice(0,5,'KAY/O','Reyna','Yoru','Gekko','Brimstone');xTmPreDrawn=true;{let s=777;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}xskGive('Vandal','prime');xskEquip('Vandal','prime.1');xskGive('Knife','blastx');xskEquip('Knife','blastx');1" \
WEAP=vandal ROOT=$6 MODE=match MAP=$1 GQ=$2 W=$3 H=$4 TAG=$5 STEPS=node:/workspace/work/qa/gates5/loadout_probe.cjs SETTLE=3 timeout 2400 node h.cjs > /dev/null 2>&1
