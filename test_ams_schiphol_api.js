//jshint esversion:6
require("dotenv").config();
var http = require("https");

// purpose of this is to fetch the data using the Schiphol api rather than flightaware. This script uses the example from Schiphol

var options = {
  method: "GET",
  hostname: "api.schiphol.nl",
  port: null,
  path: "/public-flights/flights",
  headers: {
    Accept: "application/json",
    resourceversion: "v4",
    app_id: process.env.SCHIPHOL_APP_ID,
    app_key: process.env.SCHIPHOL_API_KEY,
  },
};

var req = http.request(options, function (res) {
  var chunks = [];

  res.on("data", function (chunk) {
    chunks.push(chunk);
  });

  res.on("end", function () {
    var body = Buffer.concat(chunks);
    console.log(body.toString());
  });
});

req.end();
