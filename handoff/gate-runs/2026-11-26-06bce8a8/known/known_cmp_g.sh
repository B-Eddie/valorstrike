#!/bin/bash
# compare first failure line of each known test: base (qa/cpu/known_base) vs lane (qa/assets/known_lane)
B=/workspace/work/qa/cpu/known_base; L=/workspace/work/qa/assets/known_lane_g
for t in $(awk '{print $1}' $B/res.txt | grep ^test_); do
 lr=$(grep "^$t " $L/res.txt | awk '{print $2}'); [ -z "$lr" ] && { echo "$t PENDING"; continue; }
 fb=$(grep -m1 -E "Error|FAIL|✗" $B/$t.log | sed 's/[0-9.]\+ *ms//g'); fl=$(grep -m1 -E "Error|FAIL|✗" $L/$t.log | sed 's/[0-9.]\+ *ms//g')
 [ "$fb" == "$fl" ] && echo "$t $lr SAME" || { echo "$t $lr DIFF"; echo "   base: $fb"; echo "   lane: $fl"; }
done
