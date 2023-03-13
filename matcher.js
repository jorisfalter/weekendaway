require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();

const airportsList = require("./airports.js");
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
    foundFlights: false,
    foundDestinations: "",
    inputDate1: departureDateInitialInput,
    inputTime1: departureTimeStartInput,
    inputTime2: departureTimeEndInput,
    inputDate2: returnDateInput,
    inputTime3: returnTimeStartInput,
    inputTime4: returnTimeEndInput,
    firstLoad: true,
  });
});

function getDestinationInFull(destinationAirportAbbreviated) {
  var longAirportName = "noname";

  for (let i = 0; i < airportsList.length; i++) {
    if (airportsList[i][0] === destinationAirportAbbreviated) {
      longAirportName = airportsList[i][1];
      i = airportsList.length;
    }
  }
  return longAirportName;
}

function getAirlineName(flightNumber) {
  var airlineName = "noname";

  var flightNumberCut = flightNumber.slice(0, 2);

  for (let i = 0; i < airlinesList.length; i++) {
    if (airlinesList[i][0] === flightNumberCut) {
      airlineName = airlinesList[i][1];
      i = airlinesList.length;
    }
  }
  return airlineName;
}

////////////////////////////////////////////////////////////////////////
// find the entries in the db between start and end for departure
// find the entries in the db between start and end for return
function matchFlights(departingFlight, returnFlight) {
  var foundFlights = false;
  var foundDestinations = [];
  departingFlight.forEach((resultDepart) => {
    returnFlight.forEach((resultReturn) => {
      if (resultDepart.arrivalAirport === resultReturn.departureAirport) {
        foundFlights = true;

        // Translate the Airport Code into a full name comprehensible for users
        var destinationInFull = getDestinationInFull(
          resultReturn.departureAirport
        );

        // Translate the Flight number into an airline
        var depAirline = getAirlineName(resultDepart.flightNumber);
        var retAirline = getAirlineName(resultReturn.flightNumber);

        // Push all info into the array
        foundDestinations.push({
          depAirport: resultDepart.departureAirport,
          depTime: resultDepart.departureTimeLocal,
          depFlightNumber: resultDepart.flightNumber,
          retAirport: resultReturn.departureAirport,
          arrTime: resultReturn.arrivalTimeLocal,
          retFlightNumber: resultReturn.flightNumber,
          depAirline: depAirline,
          retAirline: retAirline,
          destinationInFull: destinationInFull,
        });
      } else {
        // console.log(
        // "no match" //on: " +
        //     resultReturn.departureAirport +
        //     " and " +
        //     resultDepart.arrivalAirport
        // );
      }
    });
  });
  return [foundFlights, foundDestinations];
}

function calculateLocalTime(inputDate, inputTimeInHours, timeZone) {
  var mergedString = inputDate + " " + inputTimeInHours + ":00";
  var inputInBrowserTime = new Date(mergedString.replace(/-/g, "/"));
  var inputInAthensTimeString = inputInBrowserTime.toLocaleString("en-US", {
    timeZone: timeZone,
  });

  var inputInAthensTime = new Date(inputInAthensTimeString);

  var diff = inputInBrowserTime.getTime() - inputInAthensTime.getTime();
  var diffInHours = diff / 1000 / 3600;
  var correctInputInUtcInMilliseconds = inputInBrowserTime.getTime() + diff;

  var correctInputInUtc = new Date(correctInputInUtcInMilliseconds);
  correctInputInUtc.toUTCString();

  return correctInputInUtc;
}

app.post("/", function (req, res) {
  let originInput = req.body.originName;
  let departureDateInput = req.body.departureDateName;
  let departureTimeStartInput = req.body.departureTimeStartName;
  let departureTimeEndInput = req.body.departureTimeEndName;
  let returnDateInput = req.body.returnDateName;
  let returnTimeStartInput = req.body.returnTimeStartName;
  let returnTimeEndInput = req.body.returnTimeEndName;

  let originInputCode = "";

  console.log("origin: " + originInput);
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

  if (originInput === "Lisbon") {
    console.log("he wants Lisbon");
    originInputCode = "vtbs";
  }

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

  //   var departureStart_string =
  //     newDepDateString + " " + departureTimeStartInput + ":00";
  //   var departure_start_zulu = new Date(departureStart_string.replace(/-/g, "/"));
  //   console.log("new dep start: " + departure_start_zulu);
  var departure_start_zulu = calculateLocalTime(
    newDepDateString,
    departureTimeStartInput,
    "Europe/Lisbon"
  );
  console.log("new dep start: " + departure_start_zulu.toUTCString());

  //   var departureEnd_string =
  //     newDepDateString + " " + departureTimeEndInput + ":00";
  //   var departure_end_zulu = new Date(departureEnd_string.replace(/-/g, "/"));
  //   console.log("new dep end: " + departure_end_zulu);
  var departure_end_zulu = calculateLocalTime(
    newDepDateString,
    departureTimeEndInput,
    "Europe/Lisbon"
  );
  console.log("new dep end: " + departure_end_zulu.toUTCString());

  //   var returnStart_string =
  //     newRetDateString + " " + returnTimeStartInput + ":00";
  //   var return_start_zulu = new Date(returnStart_string.replace(/-/g, "/"));
  //   console.log("new ret start: " + return_start_zulu);
  var return_start_zulu = calculateLocalTime(
    newRetDateString,
    returnTimeStartInput,
    "Europe/Lisbon"
  );
  console.log("new ret start: " + return_start_zulu.toUTCString());

  var return_end_zulu = calculateLocalTime(
    newRetDateString,
    returnTimeEndInput,
    "Europe/Lisbon"
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

  var foundFlights; // volgens mij is dit een boolean om te zien of we vluchten gevonden hebben
  var foundDestinations = []; // dit is de enige die we uiteindelijk gebruiken in de frontend

  function displayFlights() {
    res.render("index", {
      foundFlights: foundFlights,
      foundDestinations: foundDestinations,
      inputDate1: departureDateInput,
      inputDate2: returnDateInput,
      inputTime1: departureTimeStartInput,
      inputTime2: departureTimeEndInput,
      inputTime3: returnTimeStartInput,
      inputTime4: returnTimeEndInput,
      firstLoad: false,
    });
  }
  Departingflight.find(
    // old code when not filtering on the airport
    // {
    // departureTimeZulu: {
    //   $gte: departureIntervalStart,
    //   $lte: departureIntervalEnd,
    // },

    {
      $and: [
        {
          departureTimeZulu: {
            $gte: departureIntervalStart,
            $lte: departureIntervalEnd,
          },
        },
        { departureAirport: originInputCode },
      ],
    }
  ).exec((err, departingFlight) => {
    if (err) {
      console.log(err);
    } else {
      Returnflight.find(
        // old code when not filtering on the airport
        // {arrivalTimeZulu: { $gte: returnIntervalStart, $lte: returnIntervalEnd },
        {
          $and: [
            {
              arrivalTimeZulu: {
                $gte: returnIntervalStart,
                $lte: returnIntervalEnd,
              },
            },
            { arrivalAirport: originInputCode },
          ],
        }
      ).exec((err, returnFlight) => {
        if (err) {
          console.log(err);
        } else {
          resultingFlights = matchFlights(departingFlight, returnFlight);
          foundFlights = resultingFlights[0];
          foundDestinations = resultingFlights[1];

          displayFlights();
        }
      });
    }
  });
});

// Dit zijn onze testdatums. Ze geven twee resultaten, Madrid en Barcelona
// Wanneer we een datum genereren met Date zijn maanden vanaf 0. We moeten dus oktober hebben, niet september
// En is de tijd de browser tijd, het zal converted worden naar Zulu tijd.
// const departureIntervalStart = new Date(2022, 9, 10, 14, 0, 0);
// const departureIntervalEnd = new Date(2022, 9, 10, 15, 0, 0);
// const returnIntervalStart = new Date(2022, 9, 11, 1, 0, 0);
// const returnIntervalEnd = new Date(2022, 9, 11, 3, 0, 0);

app.listen(process.env.PORT || 3000, function () {
  console.log("listening");
});
