#!/bin/bash
# usage: runpair.sh MAP GQ TAGSUFFIX [extra env...]  -> base then lane, map-only views
cd /workspace/work/qa/three
M=$1; G=$2; S=$3
ROOT=/workspace/work/qa/three/base_wt MAP=$M GQ=$G TAG=base$S timeout 1500 node h.cjs > /dev/null 2>&1
ROOT=/workspace/work/vs-lane-three MAP=$M GQ=$G TAG=lane$S timeout 1500 node h.cjs > /dev/null 2>&1
echo DONE $M $G $S >> pairs.done
