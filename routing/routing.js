//
const network = require('../build_network/network.json');
console.log('network loaded');

const path = require('ngraph.path');
const createGraph = require('ngraph.graph');
const closest_node = require('../build_network/closest_nodes.json');
const present = require('present');
const cheapRuler = require('cheap-ruler');

const cache = {};

const graph = createGraph();

const ruler = cheapRuler(40, 'miles');

// get unique nodes
const uniqueNodesSet = new Set();
network.forEach(segment => {
  uniqueNodesSet.add(segment.START);
  uniqueNodesSet.add(segment.END);
});

// add nodes to network
uniqueNodesSet.forEach(node => {
  graph.addNode(node);
});
console.log('nodes added');

// add links to network
network.forEach(segment => {
  graph.addLink(segment.START, segment.END, segment);
});
console.log('edges added');

const pathFinder = path.aStar(graph, {
  distance: (a, b, link)=> {
    return link.data.MINUTES;
    // benchmark without Heuristic is 19070 (Animals and Fish option)
    // benchmark with cheap-ruler distance Heuristic is 4059 (Animals and Fish option)
  },
  heuristic: (a, b) => {
    const splitA = a.id.split(',');
    const splitB = b.id.split(',');
    const coords_start = [Number(splitA[0]), Number(splitA[1])];
    const coords_end = [Number(splitB[0]), Number(splitB[1])];
    return ruler.distance(coords_start, coords_end);
  },
});

const routeOne = (zip_from, zip_to) => {

  const start_time = present();

  if(cache[`${zip_from}-${zip_to}`]) {
    return cache[`${zip_from}-${zip_to}`];
  }

  let foundPath = pathFinder.find(closest_node[zip_from], closest_node[zip_to]);

  const arr_length_minus_one = foundPath.length - 1;
  const segments = [];

  for (let i = 0; i < arr_length_minus_one; i++) {
    const thisId = foundPath[i].id;
    const nextId = foundPath[i + 1].id;
    foundPath[i].links.forEach(link => {
      if (link.id === `${thisId}👉 ${nextId}` || link.id === `${nextId}👉 ${thisId}`) {
        segments.push(link.data.ID);
      }
    });
  }

  cache[`${zip_from}-${zip_to}`] = segments;

  console.log(`routed: ${present() - start_time} ms`);

  return segments;
};


exports.routeOne = routeOne;

exports.routeMany = (multiroutes) => {
  return multiroutes.map(route => {
    return routeOne(route.from, route.to);
  });

};
