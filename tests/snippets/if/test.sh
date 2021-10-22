#!/bin/sh
#:{}

if [ 2 -lt 5 ]
    then
        echo a
        echo b
    else
        echo c
fi

if [ ! -n "$var" ]
    then echo hey
fi

var=yes
if [ yes = "$var" ]
    then echo something
fi
if [ "$var" = yes ]
    then echo gnihtemos
fi

if [ -z "$var" -o yes != "$var" ]
    then echo notquite
fi

if [ 1 -eq 1 -a 2 -ne 3 ]
    then echo moretests
fi
