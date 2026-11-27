#!/bin/bash
# usage: runafter.sh QFILE  - waits for the current runq.sh queue to finish (by its END line count), then runs QFILE
while [ -n "$(ps -eo args | grep '^/bin/bash ./runq.sh' )" ]; do sleep 10; done
./runq.sh $1
