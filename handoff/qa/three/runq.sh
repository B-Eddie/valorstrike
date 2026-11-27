#!/bin/bash
# sequential queue: each line of the file given is a command
while read -r l; do [ -z "$l" ] && continue; echo "START $l $(date -u +%H:%M:%S)" >> /workspace/work/qa/three/queue.log; bash -c "$l"; echo "END $(date -u +%H:%M:%S)" >> /workspace/work/qa/three/queue.log; done < $1
