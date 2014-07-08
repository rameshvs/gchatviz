#!/bin/bash
set -e
source config.sh

mkdir -p rawchats convertedchats analyzed
$PYTHON downloader.py --outfile rawchats/tmp --username $1
FILES=rawchats/*
for f in $FILES
do
	echo "converting $f..." 
	$PYTHON convert.py $f convertedchats/${f##*/}
done
# $PYTHON analyze.py --infolder convertedchats/ --outfolder testanalyzed/ --plot --msg --anonymize --stats --fromsender $1
$PYTHON analyze2.py $1 static/chats.json convertedchats/*
cd static
$PYTHON -m SimpleHTTPServer &
$OPEN http://localhost:8000/ &
fg 1
cd ..
rm static/chats.json

