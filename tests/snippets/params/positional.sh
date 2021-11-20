#!/bin/sh
#:{ "args": [ "dollar-one", "dollar-two" ], "hasPaths": [ "zero: '(.*?)'" ] }
echo "zero: '$0'"
echo "deux: '$2'"
echo "count: '$#'"
