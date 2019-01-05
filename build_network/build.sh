#!/usr/bin/env bash

wget https://ops.fhwa.dot.gov/freight/freight_analysis/faf/faf3/netwkdbflow/network/esri/faf3_4_esri.zip
unzip faf3_4_esri.zip
mv ./FAF3_4_ESRI/FAF3.4_NETWORK.DBF ./FAF3_4_ESRI/FAF3.4_Network.dbf

ogr2ogr -f GeoJSON -t_srs crs:84 ./faf.geojson ./FAF3_4_ESRI/FAF3.4_Network.shp

# map out only fields needed, first and last coord of each segment
node reduceNetwork.js

# build out zipcode to node lookup
wget https://raw.githubusercontent.com/royhobbstn/zip-coordinates/master/zip_lookup.json

node createZipNodeLookup.js
