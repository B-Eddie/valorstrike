#!/bin/bash
# usage: env... run.sh out.json   (takes the Chromium lock, runs lane.cjs, drops the lock) - run with setsid nohup
Q=/workspace/work/qa/cpu; export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers; $Q/lock.sh take || exit 1
timeout ${TMO:-1500} node ${HARN:-$Q/lane.cjs} "$@"; rc=$?
$Q/lock.sh drop; echo "RC $rc"
