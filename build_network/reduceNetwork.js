console.time('programTime');

const fs = require('fs').promises;
const KDBush = require('kdbush');
const geokdbush = require('geokdbush');
const zipcodes = require('./zip_lookup.json');
const turf = require('@turf/turf');

main();

async function main() {

  const raw_geo = await fs.readFile('./faf.geojson');

  const new_geo = JSON.parse(raw_geo).features
    .filter(f => {
      // filter out STATUS = 2 (ferry route)
      return f.properties.STATUS !== 2
    });


  // get unique nodes
  const uniqueNodesSet = createValency(new_geo);

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

  while (single_valency.length) {
    geo = removeFromGeoJson(single_valency, geo);
    const uniqueNodes = createValency(geo);
    single_valency = getSingleValency(uniqueNodes, used_zip_points);

    console.log(`single valency (and unused): ${single_valency.length}`);
    console.log(`out of ${Object.keys(uniqueNodes).length} unique points`);
  }

  // todo combine alike segments

  let total_reduce_count = 0;
  let reduce = 1; // temp set reduce > 1

  while (reduce > 0) {
    console.log(`total_reduce_count: ${total_reduce_count}`);

    reduce = 0;

    already_processed_ids = [];

    // alike segments share 2-valency point
    const point_valency = createValency(geo);
    const dual_valency = getDualValency(point_valency);

    const dv_length = dual_valency.length;
    console.log(`${dv_length} dual valency points`);

    const legend = {};

    dual_valency.forEach((pt, index) => {

      legend[pt] = {
        start: undefined,
        end: undefined
      };

    });

    // START of one = END of the other, or END of one = START of other
    geo.forEach(segment => {
      const coords = segment.geometry.coordinates;
      const coord_start = coords[0].join(',');
      const coord_end = coords[coords.length - 1].join(',');

      if (legend[coord_start]) {
        legend[coord_start].start = segment;
      }
      if (legend[coord_end]) {
        legend[coord_end].end = segment;
      }

    });

    // loop through legend, check equality
    // attributes to check equality = MPH, STFIPS, CTFIPS, SIGN1, SIGN2

    const legend_keys = Object.keys(legend);
    console.log(`legend keys: ${legend_keys.length}`);

    for (let coordset of legend_keys) {
      const start = legend[coordset].start;
      const end = legend[coordset].end;

      if (!start || !end) {
        // this shouldn't happen but does.
        // could use some sort of precision check
        continue;
      }

      const start_id = start.properties.ID;
      const end_id = end.properties.ID;

      if(already_processed_ids.includes[start_id] || already_processed_ids.includes[end_id]) {
        continue;
      }


      const start_mph = start.properties.MPH;
      const start_stfips = start.properties.STFIPS;
      const start_ctfips = start.properties.CTFIPS;
      const start_sign1 = start.properties.SIGN1;
      const start_sign2 = start.properties.SIGN2;
      const start_sign3 = start.properties.SIGN3;
      const end_mph = end.properties.MPH;
      const end_stfips = end.properties.STFIPS;
      const end_ctfips = end.properties.CTFIPS;
      const end_sign1 = end.properties.SIGN1;
      const end_sign2 = end.properties.SIGN2;
      const end_sign3 = end.properties.SIGN3;

      const mph = start_mph === end_mph;
      const stfips = start_stfips === end_stfips;
      const ctfips = start_ctfips === end_ctfips;
      const sign1 = start_sign1 === end_sign1;
      const sign2 = start_sign2 === end_sign2;
      const sign3 = start_sign3 === end_sign3;

      if (mph && stfips && ctfips && sign1 && sign2 && sign3) {
        // segments can be combined
        reduce++;
        total_reduce_count++;

        // create new segment
        // attribute to combine = MILES
        // attributes to arbitrarily choose between = ID (higher)
        const MILES = start.properties.MILES + end.properties.MILES;
        const ID = start_id > end_id ? start_id : end_id;

        const properties = {
          MPH: start_mph, STFIPS: start_stfips, CTFIPS: start_ctfips, SIGN1: start_sign1,
          SIGN2: start_sign2, SIGN3: start_sign3, MILES, ID
        };

        // carefully combine geojson
        const geometry = {
          type: 'LineString',
          coordinates: [...end.geometry.coordinates, ...start.geometry.coordinates]
        };

        // create geojson feature
        const segment = {type: 'Feature', properties, geometry};

        // TODO seems like i can batch this together
        geo = geo.filter(feat => {
          return feat.properties.ID !== start_id && feat.properties.ID !== end_id;
        });

        // we process as much as we can on each pass by keeping a list of
        // ids we have already processed.  we don't process those ids again
        // until we re-calculate valency, etc on the entire network
        already_processed_ids.push(start_id);
        already_processed_ids.push(end_id);
        console.log(total_reduce_count);
        geo.push(segment);
      }

    }

  }

  // you can do more in a single pass than this.

  // todo simplify geojson slightly (example it with mapshaper) commandline?

  // TODO export geo itself for tippecanoe (with just ID)-

  await fs.writeFile('./full_network.geojson', JSON.stringify(turf.featureCollection(geo)), 'utf8');

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

  console.timeEnd('programTime');


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

function getSingleValency(uniqueNodesSet, used_zip_points) {
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

// createValency
function createValency(geo) {
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

function getDualValency(points) {
  return Object.keys(points).filter(pt => {
    return points[pt] === 2;
  });
  // array of pts ["lng,lat", "lng,lat"]
}