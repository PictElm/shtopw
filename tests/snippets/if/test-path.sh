#!/bin/sh
#:{}

if [ -d dir ]
    then
        echo yes
    else
        echo no
fi

if [ -d notDir ]
    then
        echo yes
    else
        echo no
fi

if [ -f file1 ]
    then
        echo yes
    else
        echo no
fi
