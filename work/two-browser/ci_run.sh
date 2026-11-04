#!/bin/bash
# CI entry: ci_run.sh <slot>. Reads the slot's config line from slots.txt: slot|AGENT_A|KEY|SCEN|extra env assignments (space separated)
# so scenarios change by editing slots.txt (the workflow file itself rarely changes).
cd "$(dirname "$0")"
LINE=$(grep "^$1|" slots.txt | head -1)
[ -z "$LINE" ] && { echo "no slot $1"; exit 0; }
IFS='|' read -r NAME AGENT KEY SCEN EXTRA <<< "$LINE"
eval "export $EXTRA"
TAG="${AGENT}_${ABN:-$KEY}"
echo "slot=$NAME agent=$AGENT key=$KEY scen=$SCEN extra=$EXTRA"
mkdir -p "$GITHUB_WORKSPACE/shots"
env TEXCLOSE=1 AGENT_A=$AGENT AGENT_B=${AGENT_B:-Jett} SCEN=$PWD/$SCEN SHARECTX=1 MAP=${MAP:-lotus} KEY=$KEY TAG=$TAG $EXTRA \
  timeout 1500 node tb.cjs "$GITHUB_WORKSPACE/shots/$TAG.json" || true
tail -30 /tmp/bridge.log > "$GITHUB_WORKSPACE/shots/bridge_tail.txt" 2>/dev/null
echo "{\"slot\":\"$NAME\",\"agent\":\"$AGENT\",\"key\":\"$KEY\",\"ability\":\"${ABN:-}\",\"scen\":\"$SCEN\",\"extra\":\"$EXTRA\",\"commit\":\"$GITHUB_SHA\",\"cfg\":\"$(echo "$LINE" | sha1sum | cut -c1-8)\"}" > "$GITHUB_WORKSPACE/shots/manifest_$TAG.json"
