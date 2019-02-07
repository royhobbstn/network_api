console.time('programTime');

const fs = require('fs').promises;

const zipcodes = require('./zip_lookup.json');
const joinAlike = require('geojson-linestring-join-alike');
const snapNearby = require('geojson-network-node-snap');
const splitLines = require('geojson-split-crossing-lines');
const idAreas = require('geojson-id-disconnected-networks');
const createLookup = require('geojson-network-node-lookup');
const trimNetwork = require('geojson-trim-network');

main();

async function main() {

  console.log('loading raw network geojson file');
  const raw_geo = await fs.readFile('./faf.geojson');

  console.log('filter out ferry routes');
  const intermediate_geo = JSON.parse(raw_geo).features
    .filter(f => {
      // filter out STATUS = 2 (ferry route)
      return f.properties.STATUS !== 2
    });

  console.log('snapping nearby single-valency points');
  const new_geo = snapNearby(intermediate_geo, 0.05);

  console.log('joining alike lines');
  const attribute_settings = [
    {field: 'NHS', compare: 'must-equal'},
    {field: 'STFIPS', compare: 'must-equal'},
    {field: 'CTFIPS', compare: 'must-equal'},
    {field: 'SIGN1', compare: 'must-equal'},
    {field: 'SIGN2', compare: 'must-equal'},
    {field: 'SIGN3', compare: 'must-equal'},
    {field: 'ID', compare: 'keep-higher'},
    {field: 'MILES', compare: 'calc-sum'}];
  const reformatted = joinAlike(new_geo, attribute_settings);

  console.log('splitting intersecting lines');
  const crossing_lines = splitLines(reformatted);

  console.log('tagging subnetwork areas');
  const tagged = idAreas(crossing_lines);

  console.log('removing separated subnetworks');
  const filtered_by_tag = tagged.features.filter(f=> {
    return f.properties.subnetworkId === 1;
  });

  console.log('creating a zip-node lookup');
  const lookup = createLookup(filtered_by_tag, zipcodes, {asCoordString: true});

  console.log('saving zip-node lookup as "closest_nodes.json"');
  await fs.writeFile('./closest_nodes.json', JSON.stringify(lookup), 'utf8');

  console.log('trimming network');
  const trimmed = trimNetwork(filtered_by_tag, zipcodes);

  console.log('assigning new ID field');
  const overwrite_id = trimmed.features.map( (f, index) => {
    const properties = Object.assign({}, f.properties, {ID: index});
    return Object.assign({}, f, {properties});
  });

  console.log('producing a presentation network to be turned into map tiles');
  const only_id = overwrite_id.map(f=> {
    const properties = { ID: f.properties.ID};
    return Object.assign({}, f, {properties});
  });
  const fc = {
    "type": "FeatureCollection",
    "features": only_id
  };
  console.log('saving presentational network as "basic_network.geojson"');
  await fs.writeFile('./basic_network.geojson', JSON.stringify(fc), 'utf8');

  console.log('forming data into a new network');
  const transformed = overwrite_id.map(f => {
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
  console.log('saving primitive network file as "network.json"');
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
