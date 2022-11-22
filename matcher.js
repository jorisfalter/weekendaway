require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();

app.use(express.static("public")); // udemy class 248 15 minutes

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.listen(process.env.PORT || 3000, function () {
  console.log("listening");
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.post("/", function (req, res) {
  const originInput = req.body.originName;
  const departureDateInput = req.body.departureDateName;
  const departureTimeInput = req.body.departureTimeName;
  //   const returnDateInput = req.body.returnDateName;
  //   const returnTimeInput = req.body.returnTimeName;

  //   const data = {
  //   members: [{
  //     email_address: userEmail,
  //     status: "subscribed",
  //     merge_fields: {
  //       FNAME: firstName,
  //       LNAME: lastName
  //     }
  //   }]
  //   };

  console.log(originInput);
  console.log(departureDateInput);
  console.log(departureTimeInput);
  //   console.log(returnDateInput);
  //   console.log(returnTimeInput);
});

const departureIntervalStart = new Date(2022, 9, 10, 14, 0, 0); // months are from 0! // This is browser time, not zulu time
const departureIntervalEnd = new Date(2022, 9, 10, 15, 0, 0);
const returnIntervalStart = new Date(2022, 9, 11, 1, 0, 0);
const returnIntervalEnd = new Date(2022, 9, 11, 3, 0, 0);

let listOfDepartingFlights = [];
let listOfReturningFlights = [];

console.log(departureIntervalStart);
console.log(departureIntervalEnd);
console.log(returnIntervalStart);
console.log(returnIntervalEnd);

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

const Departingflight = mongoose.model(
  "Departingflight",
  departingFlightSchema
);
const Returnflight = mongoose.model("Returnflight", returnFlightSchema);

// find the entries in the db between start and end for departure
// find the entries in the db between start and end for return
function matchFlights(departingFlight, returnFlight) {
  // console.log("all deps: " + departingFlight)
  // console.log("all rets: " + returnFlight)
  departingFlight.forEach((resultDepart) => {
    returnFlight.forEach((resultReturn) => {
      if (resultDepart.arrivalAirport === resultReturn.departureAirport) {
        console.log(
          "found match on: " +
            resultReturn.departureAirport +
            " and " +
            resultDepart.arrivalAirport
        );
      } else
        console.log(
          "no match on: " +
            resultReturn.departureAirport +
            " and " +
            resultDepart.arrivalAirport
        );
    });
  });
}

// filter the table for the dep and ret intervals and call the function to check if there is a match
Departingflight.find({
  departureTimeZulu: {
    $gte: departureIntervalStart,
    $lte: departureIntervalEnd,
  },
}).exec((err, departingFlight) => {
  if (err) {
    console.log(err);
  } else
    Returnflight.find({
      arrivalTimeZulu: { $gte: returnIntervalStart, $lte: returnIntervalEnd },
    }).exec((err, returnFlight) => {
      if (err) {
        console.log(err);
      } else matchFlights(departingFlight, returnFlight);
    });
});
