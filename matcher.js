require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const fetch = require("node-fetch");

const app = express();

const airportsList = require("./airports.js");
const airportsListWithCoords = require("./airportsv2.js");
const airlinesList = require("./airlines.js");

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
  departureAirport_city: String,
  departureAirport_iata: String,
  arrivalAirport_city: String,
  arrivalAirport_iata: String,
  departureTimeZulu: Date,
  departureTimeLocal: String,
  departureTimeDayOfWeek: Number,
  flightNumber: String,
});

// setup return collection
const returnFlightSchema = new mongoose.Schema({
  TimeOfEntry: Date,
  departureAirport_city: String,
  departureAirport_iata: String,
  arrivalAirport_city: String,
  arrivalAirport_iata: String,
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

var airportObj = {};
var originInputTrf = "";
var missingAirports = [];

//////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////
// app starts here
app.get("/", function (req, res) {
  //
  // define default dates
  var dayOfFriday = 5;
  var dateOfToday = new Date();
  var dayOfToday = dateOfToday.getDay();
  var nextFridayInt = new Date(); //you have to initialise a day, so initialising it here to today
  var nextSundayInt = new Date();

  var daysToAdd = dayOfFriday - dayOfToday;
  if (daysToAdd < 0) {
    daysToAdd = daysToAdd + 7;
  }
  var daysToAddS = daysToAdd + 2;

  var nextFridayInt = nextFridayInt.setDate(
    nextFridayInt.getDate() + daysToAdd
  );
  var nextSundayInt = nextSundayInt.setDate(
    nextSundayInt.getDate() + daysToAddS
  );

  var nextFridayZulu = new Date(nextFridayInt);
  var nextSundayZulu = new Date(nextSundayInt);

  var nextFridayString =
    nextFridayZulu.getUTCFullYear() +
    "-" +
    ("0" + (nextFridayZulu.getUTCMonth() + 1)).slice(-2) + // adding +1 because months are counted from zero
    "-" +
    ("0" + nextFridayZulu.getUTCDate()).slice(-2);

  var nextSundayString =
    nextSundayZulu.getUTCFullYear() +
    "-" +
    ("0" + (nextSundayZulu.getUTCMonth() + 1)).slice(-2) + // adding +1 because months are counted from zero
    "-" +
    ("0" + nextSundayZulu.getUTCDate()).slice(-2);

  console.log(nextFridayString);

  let departureDateInitialInput = nextFridayString;
  let departureTimeStartInput = "18:00";
  let departureTimeEndInput = "20:00";
  let returnDateInput = nextSundayString;
  let returnTimeStartInput = "15:00";
  let returnTimeEndInput = "18:00";

  res.render("index", {
    // foundFlights: false,
    foundDestinations: "",
    inputDate1: departureDateInitialInput,
    inputTime1: departureTimeStartInput,
    inputTime2: departureTimeEndInput,
    inputDate2: returnDateInput,
    inputTime3: returnTimeStartInput,
    inputTime4: returnTimeEndInput,
    firstLoad: true,
    checkboxStatus: ["", "", "", "", "checked"],
    // foundDestinationsDestinationsOnlyTrf: [],
    testvariable: [1, 2],
  });
});

function getAirlineName(flightNumber) {
  var airlineName = "Unknown Airline";
  // console.log(flightNumber);
  // sometimes flight numbers are zero
  if (flightNumber !== null) {
    var flightNumberCut = flightNumber.slice(0, 2);

    for (let i = 0; i < airlinesList.length; i++) {
      if (airlinesList[i][0] === flightNumberCut) {
        airlineName = airlinesList[i][1];
        i = airlinesList.length;
      }
    }
  }
  return airlineName;
}

function getDestinationInFull(destinationAirportAbbreviated) {
  var longAirportName = "Unknown Airport";

  for (let i = 0; i < airportsList.length; i++) {
    if (airportsList[i][0] === destinationAirportAbbreviated) {
      longAirportName = airportsList[i][1];
      i = airportsList.length;
    }
  }
  if (
    longAirportName === "Unknown Airport" &&
    !missingAirports.includes(destinationAirportAbbreviated)
  ) {
    missingAirports.push(destinationAirportAbbreviated);
    console.log(missingAirports);
  }
  return longAirportName;
}

function getReturnAirportCoordinates(destinationAirportAbbreviated) {
  var airportCoords = { lat: 0, lng: 0 };
  for (let i = 0; i < airportsListWithCoords.length; i++) {
    if (airportsListWithCoords[i][0] === destinationAirportAbbreviated) {
      var airportXCoor = airportsListV2[i][2];
      var airportyCoor = airportsListV2[i][3];
      airportCoords = { lat: airportXCoor, lng: airportyCoor };
      i = airportsListWithCoords.length;
    }
  }
  return airportCoords;

  //// this is a test code to get airport data. Turns out this is way to expensive to do it like this.
  //// change function to an async function
  // const mapsKey = process.env.GOOGLE_MAPS_GEOCODER;
  // const address = airportWeAreSearching + " airport";
  // const URL =
  //   "https://maps.googleapis.com/maps/api/geocode/json?address=" +
  //   address +
  //   "&key=" +
  //   mapsKey;
  // async function fetchData(address) {
  //   try {
  //     const response = await fetch(URL);
  //     const json = await response.json();
  //     console.log(address);
  //     console.log("xcor: " + json.results[0].geometry.location.lat);
  //     console.log("ycor: " + json.results[0].geometry.location.lng);
  //     // setAirportCoords({
  //     //   xcor: json.results[0].geometry.location.lat,
  //     //   ycor: json.results[0].geometry.location.lng,
  //     // });
  //     // setLocation(json.results[0].address_components[0].long_name); for debugging only
  //   } catch (error) {
  //     console.log("error", error);
  //   }
  // }
  // fetchData(address);
}

////////////////////////////////////////////////////////////////////////
// find the entries in the db between start and end for departure
// find the entries in the db between start and end for return
function matchFlights(departingFlight, returnFlight) {
  // var foundFlights = false;
  var foundDestinationsInfo = [];
  var foundDestinationsDestinationsOnly = [];
  departingFlight.forEach((resultDepart) => {
    returnFlight.forEach((resultReturn) => {
      if (
        resultDepart.arrivalAirport_city === resultReturn.departureAirport_city
      ) {
        // foundFlights = true;

        // Translate the Airport Code into a full name comprehensible for users
        var destinationInFull = getDestinationInFull(
          resultReturn.departureAirport_iata
        );
        // console.log(destinationInFull);

        // Translate the Flight number into an airline
        var depAirline = getAirlineName(resultDepart.flightNumber);
        var retAirline = getAirlineName(resultReturn.flightNumber);

        // console.log("depflnumber: " + depAirline);
        // console.log("retflnumber: " + retAirline);

        // Push all info into the array
        foundDestinationsInfo.push({
          depAirport: resultDepart.departureAirport_iata,
          depTime: resultDepart.departureTimeLocal,
          depFlightNumber: resultDepart.flightNumber,
          retAirport: resultReturn.departureAirport_iata,
          arrTime: resultReturn.arrivalTimeLocal,
          retFlightNumber: resultReturn.flightNumber,
          depAirline: depAirline,
          retAirline: retAirline,
          destinationInFull: destinationInFull,
        });

        // push destination coordinates info into the array
        foundDestinationsDestinationsOnly.push(
          resultReturn.departureAirport_iata
          // airportCoordinates
        );
      } else {
        // console.log(
        //   "no match" + //on: " +
        //     resultReturn.departureAirport_iata +
        //     " and " +
        //     resultDepart.arrivalAirport_iata
        // );
      }
    });
  });
  return ["", foundDestinationsInfo, foundDestinationsDestinationsOnly];
}

function calculateLocalTime(inputDate, inputTimeInHours, timeZone) {
  var mergedString = inputDate + " " + inputTimeInHours + ":00";
  var inputInBrowserTime = new Date(mergedString.replace(/-/g, "/"));
  var inputInAthensTimeString = inputInBrowserTime.toLocaleString("en-US", {
    timeZone: timeZone,
  });

  var inputInAthensTime = new Date(inputInAthensTimeString);

  var diff = inputInBrowserTime.getTime() - inputInAthensTime.getTime();
  var correctInputInUtcInMilliseconds = inputInBrowserTime.getTime() + diff;

  var correctInputInUtc = new Date(correctInputInUtcInMilliseconds);
  correctInputInUtc.toUTCString();

  return correctInputInUtc;
}

app.post("/", function (req, res) {
  airportObj = {};
  let originInput = req.body.originName; // city name (eg Lisbon)
  let departureDateInput = req.body.departureDateName;
  let departureTimeStartInput = req.body.departureTimeStartName;
  let departureTimeEndInput = req.body.departureTimeEndName;
  let returnDateInput = req.body.returnDateName;
  let returnTimeStartInput = req.body.returnTimeStartName;
  let returnTimeEndInput = req.body.returnTimeEndName;

  originInputTrf = originInput; // to pass to the index.js

  // let originInputCode_iata = "";

  console.log("origin city name: " + originInput);
  console.log("departure date: " + departureDateInput);
  console.log("departure time start local: " + departureTimeStartInput);
  console.log("departure time end local: " + departureTimeEndInput);
  console.log("return date: " + returnDateInput);
  console.log("return time start local: " + returnTimeStartInput);
  console.log("return time end local: " + returnTimeEndInput);

  ///////////////////////////////////////////////////////////////
  // convert the airports into a code
  // I either need to change this in the fetching files (but then I would need to update each file, so I should probably make sure the files are able to run in one file)
  // >> technical debt
  // or I should bring this in an outside file

  // if (originInput === "Lisbon") {
  //   console.log("he wants Lisbon");
  //   originInputCode_iata = "lppt";
  // }

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
  //   console.log("dep interval : " + depInterval);
  //   console.log("ret interval : " + retInterval);

  let newDepDate = new Date();
  let newRetDate = new Date();
  newDepDate.setDate(newDepDate.getDate() + depInterval);
  newRetDate.setDate(newRetDate.getDate() + retInterval);

  var newDepDateString =
    newDepDate.getUTCFullYear() +
    "-" +
    (newDepDate.getUTCMonth() + 1) + // adding +1 because months are counted from zero
    "-" +
    newDepDate.getUTCDate();
  var newRetDateString =
    newRetDate.getUTCFullYear() +
    "-" +
    (newRetDate.getUTCMonth() + 1) + // adding +1 because months are counted from zero
    "-" +
    newRetDate.getUTCDate();

  let originInputTimeZone;
  switch (originInput) {
    case "Lisbon":
      originInputTimeZone = "Europe/Lisbon";
      checkboxStatusArray = ["checked", "", "", "", ""];
      break;
    case "Austin":
      originInputTimeZone = "America/Chicago";
      checkboxStatusArray = ["", "checked", "", "", ""];
      break;
    case "Bangkok":
      originInputTimeZone = "Asia/Bangkok";
      checkboxStatusArray = ["", "", "checked", "", ""];
      break;
    case "Phuket":
      originInputTimeZone = "Asia/Bangkok";
      checkboxStatusArray = ["", "", "", "checked", ""];
      break;
    case "Amsterdam":
      originInputTimeZone = "Europe/Amsterdam";
      checkboxStatusArray = ["", "", "", "", "checked"];
      break;
  }

  var departure_start_zulu = calculateLocalTime(
    newDepDateString,
    departureTimeStartInput,
    originInputTimeZone
  );
  console.log("new dep start: " + departure_start_zulu.toUTCString());

  var departure_end_zulu = calculateLocalTime(
    newDepDateString,
    departureTimeEndInput,
    originInputTimeZone
  );
  console.log("new dep end: " + departure_end_zulu.toUTCString());

  var return_start_zulu = calculateLocalTime(
    newRetDateString,
    returnTimeStartInput,
    originInputTimeZone
  );
  console.log("new ret start: " + return_start_zulu.toUTCString());

  var return_end_zulu = calculateLocalTime(
    newRetDateString,
    returnTimeEndInput,
    originInputTimeZone
  );
  console.log("new ret end: " + return_end_zulu.toUTCString());

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

  //// list of variables returning from matchflights function
  // var foundFlights; // volgens mij is dit een boolean om te zien of we vluchten gevonden hebben
  var foundDestinations = []; // dit wordt de array met een object met alle info over de bestemming en vluchten
  var foundDestinationsDestinationsOnly = []; // dit wordt enkel de iata bestemming afkorting

  function displayFlights() {
    res.render("index", {
      // foundFlights: foundFlights,
      foundDestinations: foundDestinations,
      inputDate1: departureDateInput,
      inputDate2: returnDateInput,
      inputTime1: departureTimeStartInput,
      inputTime2: departureTimeEndInput,
      inputTime3: returnTimeStartInput,
      inputTime4: returnTimeEndInput,
      firstLoad: false,
      checkboxStatus: checkboxStatusArray,
      // foundDestinationsDestinationsOnlyTrf: foundDestinationsDestinationsOnly,
      testvariable: [1, 2],
    });
  }
  Departingflight.find(
    // old code when not filtering on the airport
    // {
    //   departureTimeZulu: {
    //     $gte: departureIntervalStart,
    //     $lte: departureIntervalEnd,
    //   },

    {
      $and: [
        {
          departureTimeZulu: {
            $gte: departureIntervalStart,
            $lte: departureIntervalEnd,
          },
        },
        { departureAirport_city: originInput },
      ],
    }
  ).exec((err, departingFlight) => {
    if (err) {
      console.log(err);
    } else {
      Returnflight.find(
        // old code when not filtering on the airport
        // {
        //   arrivalTimeZulu: {
        //     $gte: returnIntervalStart,
        //     $lte: returnIntervalEnd,
        //   },
        {
          $and: [
            {
              arrivalTimeZulu: {
                $gte: returnIntervalStart,
                $lte: returnIntervalEnd,
              },
            },
            { arrivalAirport_city: originInput },
          ],
        }
      ).exec((err, returnFlight) => {
        if (err) {
          console.log(err);
        } else {
          resultingFlights = matchFlights(departingFlight, returnFlight);
          // foundFlights = resultingFlights[0]; // the info on position [0] is empty
          foundDestinations = resultingFlights[1]; // This contains the full array of information as separate objects
          var allDestinations = resultingFlights[2]; // this only contains the iata destination list as array
          // console.log("allDestinations: " + allDestinations);

          // this is to remove the duplicates in the array, but it only worked with destinations, not with the coordinates
          var uniqueDestinations = [...new Set(allDestinations)];
          console.log("uniqueDestinations: " + uniqueDestinations);

          // fetch coordinates for the airport
          // similar to getDestinationInFull function
          var airportCoordinates = [];

          uniqueDestinations.forEach((element) => {
            airportCoordinates = getReturnAirportCoordinates(element);
            airportObj[element] = airportCoordinates;
          });
          console.log(airportObj);
          displayFlights();
        }
      });
    }
  });
});

app.get("/about", function (req, res) {
  res.render("about");
});

app.get("/variable", function (req, res) {
  // console.log(airportObj);
  res.send({ variable: airportObj, departureAirport: originInputTrf });
});

app.listen(process.env.PORT || 3000, function () {
  console.log("listening");
});
