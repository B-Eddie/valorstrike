#!/bin/bash
# waits for tgt/chain.sh (lane known set) to end, then reruns the known set on base_wt (resumable) under the Chromium lock
Q=/workspace/work/qa/cpu; export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers
while pgrep -f "tgt/chain[.]sh" >/dev/null; do sleep 20; done
$Q/lock.sh take || exit 1
$Q/known.sh $Q/base_wt $Q/known_base
$Q/lock.sh drop
