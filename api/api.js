//
const { routeOne, routeMany } = require('../routing/routing');

const appRouter = function(app) {

  app.post("/route-many", function(req, res) {
    console.log('route many');

    console.time('routeMany');
    const route_payload = req.body;

    const multisegments = routeMany(route_payload);
    console.log('all routes retrieved');
    console.timeEnd('routeMany');

    return res.status(200).json(multisegments);
  });

  app.get("/route-one", function(req, res) {

    const zip_from = req.query.from;
    const zip_to = req.query.to;

    if(!zip_from || !zip_to) {
      return res.status(400).json({msg: `Error:  you forgot to send 'from' and/or 'to' zipcodes as query parameters.`});
    }

    const segments = routeOne(zip_from, zip_to);

    return res.status(200).json(segments);
  })

};

module.exports = appRouter;