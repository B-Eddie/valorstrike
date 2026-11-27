#!/bin/bash
# usage: run.sh WT OUTDIR test1 test2 ...  (sequential, resumable; res.txt lines "name rc=N secs")
WT=$1; OUT=$2; shift 2; mkdir -p $OUT; cd $WT
for t in "$@"; do grep -q "^$t " $OUT/res.txt 2>/dev/null && continue; s=$(date +%s); timeout ${TTMO:-1200} nice -n 5 node work/$t.cjs > $OUT/$t.log 2>&1; rc=$?; echo "$t rc=$rc $(( $(date +%s)-s ))s" >> $OUT/res.txt; done; echo DONE >> $OUT/res.txt
