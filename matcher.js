require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));

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
  res.render("index", { foundFlights: false, foundDestinations: "" });
});

////////////////////////////////////////////////////////////////////////
// find the entries in the db between start and end for departure
// find the entries in the db between start and end for return
function matchFlights(departingFlight, returnFlight) {
  //   console.log("all deps: " + departingFlight);
  //   console.log("all rets: " + returnFlight);
  var foundFlights = false;
  var foundDestinations = [];
  departingFlight.forEach((resultDepart) => {
    returnFlight.forEach((resultReturn) => {
      if (resultDepart.arrivalAirport === resultReturn.departureAirport) {
        console.log("found match"); // on: " + resultReturn.departureAirport);
        console.log("Flying from: " + resultDepart.departureAirport);
        console.log("At: " + resultDepart.departureTimeLocal);
        console.log("Returning from: " + resultReturn.departureAirport);
        console.log("Arriving at " + resultReturn.arrivalTimeLocal);
        foundFlights = true;
        foundDestinations.push(resultReturn.departureAirport);
      } else {
        // console.log(
        //   "no match on: " +
        //     resultReturn.departureAirport +
        //     " and " +
        //     resultDepart.arrivalAirport
        // );
      }
    });
  });
  return [foundFlights, foundDestinations];
}

app.post("/", function (req, res) {
  const originInput = req.body.originName;
  const departureDateInput = req.body.departureDateName;
  const departureTimeStartInput = req.body.departureTimeStartName;
  const departureTimeEndInput = req.body.departureTimeEndName;
  const returnDateInput = req.body.returnDateName;
  const returnTimeStartInput = req.body.returnTimeStartName;
  const returnTimeEndInput = req.body.returnTimeEndName;

  console.log("origin: " + originInput);
  console.log("departure date: " + departureDateInput);
  console.log("departure time start: " + departureTimeStartInput);
  console.log("departure time end: " + departureTimeEndInput);
  console.log("return date: " + returnDateInput);
  console.log("rerturn time start: " + returnTimeStartInput);
  console.log("return time end: " + returnTimeEndInput);

  ///////////////////////////////////////////////////////////////
  const todaysDate = new Date();
  const todaysDateNumber = todaysDate.getDate();

  // convert input date to day of week, eg Sunday Dec 11 (sunday is 0)

  // we hebben een string datum, die willen we converten naar een datum waarvoor we data beschikbaar hebben
  // maar javascript convert naar zulu time, dus een dag terug
  // eigenlijk hebben we alleen de day of week nodig van de string datum input

  var departureDateYear = parseFloat(departureDateInput.substr(0, 4));
  var departureDateMonth = parseFloat(departureDateInput.substr(5, 2)) - 1;
  var departureDateDay = parseFloat(departureDateInput.substr(8, 2));
  var departureDateInUtc = new Date(
    Date.UTC(departureDateYear, departureDateMonth, departureDateDay, 0, 0, 0)
  ); // If I don't break it down in peaces, he will convert my input date to a UTC date, which is 7 hours earlier, and thus the day before

  var returnDateYear = parseFloat(returnDateInput.substr(0, 4));
  var returnDateMonth = parseFloat(returnDateInput.substr(5, 2)) - 1;
  var returnDateDay = parseFloat(returnDateInput.substr(8, 2));
  var returnDateInUtc = new Date(
    Date.UTC(returnDateYear, returnDateMonth, returnDateDay, 0, 0, 0)
  ); // If I don't break it down in peaces, he will convert my input date to a UTC date, which is 7 hours earlier, and thus the day before

  const departureDayOfWeek = departureDateInUtc.getDay();
  const returnDayOfWeek = returnDateInUtc.getDay();
  const todayDayOfWeek = todaysDate.getDay(); // console.log(todayDayOfWeek);

  let depInterval = calculateInterval(todayDayOfWeek, departureDayOfWeek);
  let retInterval = calculateInterval(todayDayOfWeek, returnDayOfWeek);

  let newDepDate = new Date();
  let newRetDate = new Date();
  newDepDate.setDate(newDepDate.getDate() + depInterval);
  newRetDate.setDate(newRetDate.getDate() + retInterval);

  var newDepDateString =
    newDepDate.getUTCFullYear() +
    "-" +
    newDepDate.getUTCMonth() +
    "-" +
    newDepDate.getUTCDate();
  var newRetDateString =
    newRetDate.getUTCFullYear() +
    "-" +
    newRetDate.getUTCMonth() +
    "-" +
    newRetDate.getUTCDate();

  // below outputs should give the same date. We converted the input date to a recent date
  //   console.log("original dep date: " + departureDateInUtc);
  //   console.log("original ret date: " + returnDateInUtc);
  //   console.log("new dep date: " + newDepDate);
  //   console.log("new ret date: " + newRetDate);
  //   console.log("new dep date string: " + newDepDateString);
  //   console.log("new ret date string: " + newRetDateString);

  // NOTE: ik heb nu de datums terug kunnen herbouwen, maar nu staat de tijd in Zulu tijd. Wil ik dat wel?
  // controleer of de input geconvert wordt tot zulu tijd, en hoe zoek ik in de DB? in Zulu tijd?
  // ik bouw het nu eerst zoals het was

  // hier geven we een maand in al in een datum configuratie. Ik ga ervan uit dat dat betekent dat hij de string herkent als een datum, en de maand niet verandert.
  var departureStart_string =
    newDepDateString + " " + departureTimeStartInput + ":00";
  var departure_start_zulu = new Date(departureStart_string.replace(/-/g, "/"));
  console.log("new dep start: " + departure_start_zulu);

  var departureEnd_string =
    newDepDateString + " " + departureTimeEndInput + ":00";
  var departure_end_zulu = new Date(departureEnd_string.replace(/-/g, "/"));
  console.log("new dep end: " + departure_end_zulu);

  var returnStart_string =
    newRetDateString + " " + returnTimeStartInput + ":00";
  var return_start_zulu = new Date(returnStart_string.replace(/-/g, "/"));
  console.log("new ret start: " + return_start_zulu);

  var returnEnd_string = newRetDateString + " " + returnTimeEndInput + ":00";
  var return_end_zulu = new Date(returnEnd_string.replace(/-/g, "/"));
  console.log("new ret end: " + return_end_zulu);

  function calculateInterval(todaysDate, inputDate) {
    if (todaysDate - 2 - inputDate >= 0) {
      return inputDate - todaysDate;
    } else {
      return inputDate - todaysDate - 7;
    }
  }

  // legacy problem,
  // I've declared two different variables for the same content so mapping the one to the other
  const departureIntervalStart = departure_start_zulu;
  const departureIntervalEnd = departure_end_zulu;
  const returnIntervalStart = return_start_zulu;
  const returnIntervalEnd = return_end_zulu;

  //   console.log(departureIntervalStart);
  //   console.log(departure_start_zulu);
  //   console.log(departureIntervalEnd);
  //   console.log(departure_end_zulu);
  //   console.log(returnIntervalStart);
  //   console.log(return_start_zulu);
  //   console.log(returnIntervalEnd);
  //   console.log(return_end_zulu);

  // wat we gaan doen, is de inputdatum veranderen naar de laatste weekdag (voor dewelke we data hebben) op die datum

  ////////////////////////////////////////////////////////////////////////
  // filter the table for the dep and ret intervals and call the function to check if there is a match

  //// hier moeten we een manier vinden om de laatste data op die weekdag te vinden
  ////

  var foundFlights;
  var foundDestinations = [];

  function displayFlights() {
    console.log("foundFlights out of loop: " + foundFlights);
    res.render("index", {
      foundFlights: foundFlights,
      foundDestinations: foundDestinations,
    });
  }

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
        } else {
          resultingFlights = matchFlights(departingFlight, returnFlight);
          foundFlights = resultingFlights[0];
          foundDestinations = resultingFlights[1];
          console.log("foundFlights in loop: " + foundFlights);
          displayFlights();
        }
      });
  });
});

// we zitten hier vast in een situatie waarbij we moeten wachten op data voordat we kunnen returnen
// kunnen we ideeen halen uit app.js?

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
