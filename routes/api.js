//
const network = require('../build_network/network.json');
console.log('network loaded');

const path = require('ngraph.path');
const createGraph = require('ngraph.graph');
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

const pathFinder = path.aStar(graph,  {
  distance(fromNode, toNode, link) {
  return link.data.MINUTES;
}});



const appRouter = function(app) {

  app.post("/route-data", function(req, res) {

    const payload = req.body;
    console.log(payload);

    return res.send(JSON.stringify(payload));
  });

  app.get("/route-one", function(req, res) {

    let foundPath = pathFinder.find("-157.844498,21.292105", "-158.054916,21.50502");

    const arr_length_minus_one = foundPath.length - 1;
    const segments = [];

    for (let i = 0; i < arr_length_minus_one; i++) {
      const thisId = foundPath[i].id;
      const nextId = foundPath[i + 1].id;
      foundPath[i].links.forEach(link => {
        if (link.id === `${thisId}👉 ${nextId}` || link.id === `${nextId}👉 ${thisId}`) {
          segments.push(link.data);
        }
      });
    }

    return res.status(200).json(segments);
  })

};

module.exports = appRouter;