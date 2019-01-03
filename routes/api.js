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

const pathFinder = path.aStar(graph);



const appRouter = function(app) {

  app.post("/route-data", function(req, res) {

    const payload = req.body;
    console.log(payload);

    return res.send(JSON.stringify(payload));
  });

  app.get("/route-one", function(req, res) {

    // ngraph example goes here
    let foundPath = pathFinder.find("-157.844498,21.292105", "-157.839813,21.293901");
    console.log(foundPath);

    return res.status(200).json({});
  })

};

module.exports = appRouter;