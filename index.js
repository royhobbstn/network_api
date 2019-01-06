const express = require("express");
const app = express();
const bodyParser = require('body-parser');

// parse application/json
app.use(bodyParser.json({limit: '10mb', extended: true}));


app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

require("./api/api.js")(app);

const server = app.listen(4006, function() {
  console.log("Listening on port %s...", server.address().port);
});