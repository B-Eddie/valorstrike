#!/bin/bash
# run the 15 known-failing client tests in worktree $1, results to $2 (resumable)
WT=$1; OUT=$2; mkdir -p $OUT; cd $WT
for t in test_ability_unequip test_bot_feel_offline test_ability_first_cast_warm test_bot_ults_offline test_client_lifecycle test_client_online_gunplay test_client_online_abilities test_death_parity test_map_leash test_native_crouch test_player_clips test_skye_hawk_hold_client test_spectate_online_hud test_tp_body_stretch test_combat_stress_perf; do
 grep -q "^$t " $OUT/res.txt 2>/dev/null && continue; s=$(date +%s); timeout 1800 nice -n 10 node work/$t.cjs > $OUT/$t.log 2>&1; rc=$?; echo "$t rc=$rc $(( $(date +%s)-s ))s" >> $OUT/res.txt; done; echo DONE >> $OUT/res.txt
