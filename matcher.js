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

////////////////////////////////////////////////////////////////////////
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

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

////////////////////////////////////////////////////////////////////////
// find the entries in the db between start and end for departure
// find the entries in the db between start and end for return
function matchFlights(departingFlight, returnFlight) {
  //   console.log("all deps: " + departingFlight);
  //   console.log("all rets: " + returnFlight);
  departingFlight.forEach((resultDepart) => {
    returnFlight.forEach((resultReturn) => {
      if (resultDepart.arrivalAirport === resultReturn.departureAirport) {
        console.log("found match on: " + resultReturn.departureAirport);
        console.log("Flying from: " + resultDepart.departureAirport);
        console.log("At: " + resultDepart.departureTimeLocal);
        console.log("Returning from: " + resultReturn.departureAirport);
        console.log("Arriving at " + resultReturn.arrivalTimeLocal);
      } else {
        console.log(
          "no match on: " +
            resultReturn.departureAirport +
            " and " +
            resultDepart.arrivalAirport
        );
      }
    });
  });
}

app.post("/", function (req, res) {
  const originInput = req.body.originName;
  const departureDateInput = req.body.departureDateName;
  const departureTimeStartInput = req.body.departureTimeStartName;
  const departureTimeEndInput = req.body.departureTimeEndName;
  const returnDateInput = req.body.returnDateName;
  const returnTimeStartInput = req.body.returnTimeStartName;
  const returnTimeEndInput = req.body.returnTimeEndName;

  console.log(originInput);

  // hier geven we een maand in al in een datum configuratie. Ik ga ervan uit dat dat betekent dat hij de string herkent als een datum, en de maand niet verandert.
  var departureStart_string =
    departureDateInput + " " + departureTimeStartInput + ":00";
  //   var departureStart_string_replaced = departureStart_string.replace(/-/g, "/");
  //   console.log("replaced: " + departureStart_string_replaced);
  var departure_start_zulu = new Date(departureStart_string.replace(/-/g, "/"));
  console.log(departure_start_zulu);

  var departureEnd_string =
    departureDateInput + " " + departureTimeEndInput + ":00";
  var departure_end_zulu = new Date(departureEnd_string.replace(/-/g, "/"));
  console.log(departure_end_zulu);

  var returnStart_string = returnDateInput + " " + returnTimeStartInput + ":00";
  var return_start_zulu = new Date(returnStart_string.replace(/-/g, "/"));
  console.log(return_start_zulu);

  var returnEnd_string = returnDateInput + " " + returnTimeEndInput + ":00";
  var return_end_zulu = new Date(returnEnd_string.replace(/-/g, "/"));
  console.log(return_end_zulu);

  console.log("searching");

  const departureIntervalStart = departure_start_zulu;
  const departureIntervalEnd = departure_end_zulu;
  const returnIntervalStart = returnStart_string;
  const returnIntervalEnd = returnEnd_string;

  // wat we gaan doen, is de inputdatum veranderen naar de laatste weekdag (voor dewelke we data hebben) op die datum
  const departureDayOfWeek = "";
  const returnDayOfWeek = "";

  ////////////////////////////////////////////////////////////////////////
  // filter the table for the dep and ret intervals and call the function to check if there is a match

  //// hier moeten we een manier vinden om de laatste data op die weekdag te vinden
  ////

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
});

// Dit zijn onze testdatums. Ze geven twee resultaten, Madrid en Barcelona
// Wanneer we een datum genereren met Date zijn maanden vanaf 0. We moeten dus oktober hebben, niet september
// En is de tijd de browser tijd, het zal converted worden naar Zulu tijd.
// const departureIntervalStart = new Date(2022, 9, 10, 14, 0, 0);
// const departureIntervalEnd = new Date(2022, 9, 10, 15, 0, 0);
// const returnIntervalStart = new Date(2022, 9, 11, 1, 0, 0);
// const returnIntervalEnd = new Date(2022, 9, 11, 3, 0, 0);

// console.log(departureIntervalStart);
// console.log(departureIntervalEnd);
// console.log(returnIntervalStart);
// console.log(returnIntervalEnd);

app.listen(process.env.PORT || 3000, function () {
  console.log("listening");
});
