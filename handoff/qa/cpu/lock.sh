#!/bin/bash
# usage: lock.sh take|drop   (Chromium lock shared by all lanes)
L=/workspace/work/qa/LOCK-chromium.txt; S=/workspace/work/qa/LOCK-suite.txt
if [ "$1" = take ]; then
 for i in $(seq 1 500); do
  if [ ! -s $L ] && ! grep -q RUNNING $S 2>/dev/null && ! pgrep -x headless_shell >/dev/null && ! pgrep -f "chrome-linux|chromium" >/dev/null; then echo "cpu $(date -u +%Y-%m-%dT%H:%M:%SZ)" > $L; sleep 1; if grep -q '^cpu ' $L; then echo TAKEN; exit 0; fi; fi; sleep 10; done; echo TIMEOUT; exit 1
else if grep -q '^cpu ' $L 2>/dev/null; then : > $L; fi; echo DROPPED; fi
