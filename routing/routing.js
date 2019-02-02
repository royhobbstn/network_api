//
const network = require('../build_network/network.json');
console.log('network loaded');

const path = require('ngraph.path');
const createGraph = require('ngraph.graph');
const closest_node = require('../build_network/closest_nodes.json');
const present = require('present');

const cache = {};

const graph = createGraph();

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
    const splitA = a.id.split(',');
    const splitB = b.id.split(',');

    let aPos = {x: Number(splitA[1]), y: Number(splitA[0])};
    let bPos = {x: Number(splitB[1]), y: Number(splitB[0])};
    let dx = aPos.x - bPos.x;
    let dy = aPos.y - bPos.y;
    return Math.abs(dx) + Math.abs(dy);
    // return link.data.MINUTES; // TODO
    // benchmark Euclidean is 8083 (as Distance and Heuristic)
    // benchmark Manhattan is 7303 (as Distance and Heuristic)
    // benchmark without Heuristic is 49162
  },
  heuristic: (a, b, link) => {
    const splitA = a.id.split(',');
    const splitB = b.id.split(',');

    let aPos = {x: Number(splitA[1]), y: Number(splitA[0])};
    let bPos = {x: Number(splitB[1]), y: Number(splitB[0])};
    let dx = aPos.x - bPos.x;
    let dy = aPos.y - bPos.y;
    return Math.abs(dx) + Math.abs(dy);
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
