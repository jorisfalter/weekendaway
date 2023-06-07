//jshint esversion:6
require("dotenv").config();

const fetch = require("cross-fetch");

const airportsListWithCoords = require("./airportsv2.js");

require("dotenv").config();

const mapsKey = process.env.GOOGLE_MAPS_GEOCODER;
let address = "";
let URL = "";
let xcor = "";
let ycor = "";

var zeroAirportsList = [];

for (let i = 0; i < airportsListWithCoords.length; i++) {
  if (airportsListWithCoords[i][2] === 0) {
    zeroAirportsList.push(airportsListWithCoords[i]);
  }
}
// console.log(zeroAirportsList);

async function queryDatabase() {
  // console.log("db length: " + zeroAirportsList.length);

  // Loop through each row
  for (let i = 0; i < zeroAirportsList.length; i++) {
    // console.log("rij: " + zeroAirportsList[i]);
    address = zeroAirportsList[i][1] + " airport";

    //   let latns = row.properties.Latitude_NS.number;
    //   console.log("lat_ns: " + latns);
    URL =
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      address +
      "&key=" +
      mapsKey;

    try {
      // call the geocoder
      async function callGeocoder() {
        const response = await fetch(URL);
        const json = await response.json();
        // console.log(json);
        let xcor_notRounded = json.results[0].geometry.location.lat;
        let ycor_notRounded = json.results[0].geometry.location.lng;
        zeroAirportsList[i][2] = parseFloat(xcor_notRounded.toFixed(4));
        zeroAirportsList[i][3] = parseFloat(ycor_notRounded.toFixed(4));
        //   console.log(
        // "xcor: " +
        //   json.results[0].geometry.location.lat +
        //   " ycor: " +
        //   json.results[0].geometry.location.lng
        //   );
      }
      await callGeocoder();
    } catch (error) {
      console.log("error", error);
    }
  }

  // Return the complete list of results
  console.log(zeroAirportsList);
  return zeroAirportsList;
}

//// Call the function and log each row

queryDatabase().then((rows) => {
  // rows.forEach((row) => {
});
