const fs = require('fs').promises;
const KDBush = require('kdbush');
const geokdbush = require('geokdbush');
const zipcodes = require('./zip_lookup.json');

main();

async function main() {

  const raw_geo = await fs.readFile('./faf.geojson');

  const new_geo = JSON.parse(raw_geo).features
    .filter(f => {
      // filter out STATUS = 2 (ferry route)
      return f.properties.STATUS !== 2
    })
    .filter(f => {
      // filter out road no name (presumably not a major road)
      return f.properties.SIGN1;
    });


  // get unique nodes
  const uniqueNodesSet = getUniqueNodes(new_geo);

  // format for kdbush
  const points = Object.keys(uniqueNodesSet).map(node => {
    const coords = node.split(',');
    return {
      node,
      lon: Number(coords[0]),
      lat: Number(coords[1])
    };
  });

  // index all the points
  const index = new KDBush(points, (p) => p.lon, (p) => p.lat);

  // find closest neighbor for each pair of zip
  const closest = {};
  const used_zip_points = [];
  Object.keys(zipcodes).forEach(key => {
    const obj = zipcodes[key];
    const nearest = geokdbush.around(index, obj.lng, obj.lat, 1);
    closest[key] = nearest[0].node;
    used_zip_points.push(nearest[0].node);
  });

  // save closest nodes (will be used in routing api)
  fs.writeFile('./closest_nodes.json', JSON.stringify(closest), 'utf8')
    .then(() => {
      console.log('done');
    })
    .catch(e => {
      console.log(e);
    });

  // get all single valency points
  let single_valency = getSingleValency(uniqueNodesSet, used_zip_points);
  console.log(`initial single valency (and unused): ${single_valency.length}`);
  console.log(`out of ${Object.keys(uniqueNodesSet).length} unique points`);

  let geo = [...new_geo];

  while(single_valency.length) {
    geo = removeFromGeoJson(single_valency, geo);
    const uniqueNodes = getUniqueNodes(geo);
    single_valency = getSingleValency(uniqueNodes, used_zip_points);

    console.log(`single valency (and unused): ${single_valency.length}`);
    console.log(`out of ${Object.keys(uniqueNodes).length} unique points`);
  }

  // todo combine alike segments

  // todo simplify geojson slightly (example it with mapshaper)

  // TODO export geo itself for tippecanoe (with just ID)

  const transformed = geo.map(f => {
      const MPH = getMPH(f.properties.NHS);
      const coords = f.geometry.coordinates;
      return {
        ID: f.properties.ID,
        MILES: f.properties.MILES,
        MPH: MPH,
        STFIPS: f.properties.STFIPS,
        CTFIPS: f.properties.CTFIPS,
        MINUTES: (60 / MPH) * f.properties.MILES,
        START: coords[0].join(','),
        END: coords[coords.length - 1].join(',')
      }
    });

  await fs.writeFile('./network.json', JSON.stringify(transformed), 'utf8');

}

function getMPH(nhs) {
  switch (nhs) {
    case 1:
      return 70;
    case 2:
      return 60;
    case 3:
      return 50;
    case 4:
      return 40;
    case 7:
      return 30;
    case 8:
      return 20;
    default:
      return 10;
  }

}

function getSingleValency (uniqueNodesSet, used_zip_points) {
  return Object.keys(uniqueNodesSet)
    .filter(key => {
      return uniqueNodesSet[key] === 1;
    })
    .filter(key => {
      // not one of the used_zip_points
      return !used_zip_points.includes(key);
    });

}

function removeFromGeoJson(single_valency, new_geo) {
  return new_geo.filter(feature => {
    const coords = feature.geometry.coordinates;
    const start = coords[0].join(',');
    const end = coords[coords.length - 1].join(',');
    return !single_valency.includes(start) && !single_valency.includes(end);
  });
}

function getUniqueNodes(geo) {
  const uniqueNodesSet = {};
  geo.forEach(feature => {
    const coords = feature.geometry.coordinates;
    // start
    const start = coords[0].join(',');
    if (!uniqueNodesSet[start]) {
      uniqueNodesSet[start] = 1;
    } else {
      uniqueNodesSet[start]++;
    }
    // end
    const end = coords[coords.length - 1].join(',');
    if (!uniqueNodesSet[end]) {
      uniqueNodesSet[end] = 1;
    } else {
      uniqueNodesSet[end]++;
    }
  });
  return uniqueNodesSet;
}