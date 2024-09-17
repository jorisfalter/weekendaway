//jshint esversion:6
require("dotenv").config({ path: "../.env" });
var https = require("https");

// purpose of this is to fetch the data using the Schiphol API rather than flightaware. This script uses the example from Schiphol

var options = {
  method: "GET",
  hostname: "api.schiphol.nl",
  port: 443,
  path: "/public-flights/flights",
  headers: {
    Accept: "application/json",
    resourceversion: "v4",
    app_id: process.env.SCHIPHOL_APP_ID,
    app_key: process.env.SCHIPHOL_API_KEY,
  },
};

var req = https.request(options, function (res) {
  var chunks = [];

  res.on("data", function (chunk) {
    chunks.push(chunk);
  });

  res.on("end", function () {
    var body = Buffer.concat(chunks).toString();

    try {
      // Parse the JSON response
      var jsonData = JSON.parse(body);

      // Pretty-print the JSON data with 2 spaces for indentation
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (error) {
      console.error("Error parsing JSON:", error);
    }
  });
});

req.on("error", function (e) {
  console.error(e.message);
});

req.end();
