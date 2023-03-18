require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();

const airportsList = require("../airports.js");
const airlinesList = require("../airlines.js");

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public")); // udemy class 248 15 minutes

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Setup Mongoose
mongoose.connect(
  "mongodb+srv://joris-mongo:" +
    process.env.ATLAS_KEY +
    "@cluster1.dkcnhgi.mongodb.net/flightsDB",
  { useNewUrlParser: true, useUnifiedTopology: true }
);
console.log("mongoose fired up");

// setup departure collection
const departingFlightSchema = new mongoose.Schema({
  TimeOfEntry: Date,
  departureAirport: String,
  arrivalAirport: String,
  departureTimeZulu: Date,
  departureTimeLocal: String,
  departureTimeDayOfWeek: Number,
  flightNumber: String,
});

// setup return collection
const returnFlightSchema = new mongoose.Schema({
  TimeOfEntry: Date,
  departureAirport: String,
  arrivalAirport: String,
  arrivalTimeZulu: Date,
  arrivalTimeLocal: String,
  arrivalTimeDayOfWeek: Number,
  flightNumber: String,
});

// create constants
const Departingflight = mongoose.model(
  "Departingflight",
  departingFlightSchema
);
const Returnflight = mongoose.model("Returnflight", returnFlightSchema);

// trying to put all my test data here

// {"TimeOfEntry" : { $gte : new ISODate("2023-02-12T00:00:00Z") }}

Returnflight.find({
  TimeOfEntry: { $gte: new Date("2023-02-13T00:00:00Z") },
}).exec((err, foundFlight) => {
  if (err) {
    console.log(err);
  } else {
    console.log(foundFlight);
  }
});

// , $lt: new Date(“2023-02-13T00:00:00Z”)
// Departingflight
// Returnflight.find({"TimeOfEntry" : { $gte : new ISODate("2023-01-12"),$lt: new ISODate(“2023-02-13”) }}).exec((err, departingFlight) => {
