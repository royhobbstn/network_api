//
const fs = require('fs').promises;
const network = require('./network.json');
const KDBush = require('kdbush');
const geokdbush = require('geokdbush');
const zipcodes = require('./zip_lookup.json');

// get unique nodes
const uniqueNodesSet = new Set();
network.forEach(segment => {
  uniqueNodesSet.add(segment.START);
  uniqueNodesSet.add(segment.END);
});

// format for kdbush
const points = Array.from(uniqueNodesSet).map(node => {
  const coords = node.split(',');
  return {
    node,
    lon: Number(coords[0]),
    lat: Number(coords[1])
  };
});

// index all the points
const index = new KDBush(points, (p) => p.lon, (p) => p.lat);

// find closest neighbor for each pair of zip coordinates
const closest = {};
Object.keys(zipcodes).forEach(key => {
  const obj = zipcodes[key];
  const nearest = geokdbush.around(index, obj.lng, obj.lat, 1);
  closest[key] = nearest[0].node;
});

fs.writeFile('./closest_nodes.json', JSON.stringify(closest), 'utf8')
  .then(()=> {
    console.log('done');
  })
  .catch(e=> {
    console.log(e);
  });
