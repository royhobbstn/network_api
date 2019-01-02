//

const appRouter = function(app) {

  app.post("/route-data", function(req, res) {

    const payload = req.body;
    console.log(payload);

    return res.send(JSON.stringify(payload));
  });

  app.get("/route-one", function(req, res) {

    return res.status(200).json({});
  })

};

module.exports = appRouter;