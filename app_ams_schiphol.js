//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { setTimeout } = require("timers/promises");
const mongoose = require("mongoose");
const internal = require("stream");

const app = express();

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

//
const airportsList = [
  {
    originAirport_city: "Amsterdam",
    originAirport_iata: "AMS",
    originTimeZone: "Europe/Amsterdam",
  },
];

console.log("length of list: " + airportsList.length);

let endOfTheList = false;

// variables used for testing
let deleteDbAtStart = false;
let pageCounterLimit = 50; // set to a high number when you don't want a limit on the number of pages fetched.

const fireItAllUp = async () => {
  await mongoose.connect(
    "mongodb+srv://joris-mongo:" +
      process.env.ATLAS_KEY +
      "@cluster1.dkcnhgi.mongodb.net/flightsDB",
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
  console.log("mongoose fired up");

  // setup the database
  // mongoose.connect("mongodb://localhost:27017/flightsDB", { useNewUrlParser: true }); //?retryWrites=true&w=majority

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

  const Departingflight = mongoose.model(
    "Departingflight",
    departingFlightSchema
  );
  const Returnflight = mongoose.model("Returnflight", returnFlightSchema);

  // Delete the db when we rerun the query - for testing purposes only
  if (deleteDbAtStart) {
    Departingflight.deleteMany({}, function (err) {
      if (err) {
        console.log(err);
      } else if (!err) {
        console.log("departures db deleted before start");
      }
    });
    Returnflight.deleteMany({}, function (err) {
      if (err) {
        console.log(err);
      } else if (!err) {
        console.log("return db deleted before start");
      }
    });
  }

  function multiAirport() {
    for (let j = 0; j < airportsList.length; j++) {
      let originAirport_iata = airportsList[j].originAirport_iata;
      let departureUrl =
        "https://aeroapi.flightaware.com/aeroapi/airports/" +
        airportsList[j].originAirport_iata +
        "/flights/scheduled_departures?type=Airline";
      let returnUrl =
        "https://aeroapi.flightaware.com/aeroapi/airports/" +
        airportsList[j].originAirport_iata +
        "/flights/scheduled_arrivals?type=Airline";
      let originTimeZone = airportsList[j].originTimeZone;
      // console.log(originAirport_iata)
      // console.log(returnUrl)
      // console.log(originTimeZone)
      if (j === airportsList.length - 1) {
        endOfTheList = true;
      }

      // Initial API Call
      fetchAirportData(
        departureUrl,
        "departure",
        0,
        originTimeZone,
        returnUrl,
        originAirport_iata
      );
    }
  }
  multiAirport();

  // Create the function for API Call
  // direction is either "departure" or "return"; url is either "departureUrl" or "returnUrl"
  function fetchAirportData(
    url,
    direction,
    pageCounter,
    originTimeZone,
    returnUrl,
    originAirport_iata
  ) {
    fetch(url, {
      method: "GET",
      headers: {
        "x-apikey": process.env.API_KEY,
      },
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        console.log(data);
        if (direction === "departure") {
          for (let i = 0; i < data.scheduled_departures.length; i++) {
            if (data.scheduled_departures[i].destination === null) {
            } else {
              // define variables with data from api
              let originAirport_iata =
                data.scheduled_departures[i].origin.code_iata;
              let originAirport_city = data.scheduled_departures[i].origin.city;
              // I'm not sure why I'm fetching these two above variables as I already have them
              let arrivalAirport_iata =
                data.scheduled_departures[i].destination.code_iata;
              let arrivalAirport_city =
                data.scheduled_departures[i].destination.city;
              let departureTimeZulu = new Date(
                data.scheduled_departures[i].scheduled_out
              );
              let departureTimeLocal = departureTimeZulu.toLocaleString(
                "en-GB",
                { timeZone: originTimeZone }
              );
              let departureTimeDayOfWeek = departureTimeZulu.getDay(); // has to be zulu time because local time is a string, not a date
              let flightNumber = data.scheduled_departures[i].ident_iata;

              // use findOne instead on date and flight number
              // here we check for duplicates
              Departingflight.findOne({
                departureTimeZulu: departureTimeZulu,
                flightNumber: flightNumber,
              }).exec(function (err, flight) {
                if (err) {
                  console.log(err);
                } else {
                  if (flight == null) {
                    // put data in database
                    const newDepartingFlightEntry = new Departingflight({
                      TimeOfEntry: new Date(),
                      departureAirport_city: originAirport_city,
                      departureAirport_iata: originAirport_iata,
                      arrivalAirport_city: arrivalAirport_city,
                      arrivalAirport_iata: arrivalAirport_iata,
                      departureTimeZulu: departureTimeZulu,
                      departureTimeLocal: departureTimeLocal,
                      departureTimeDayOfWeek: departureTimeDayOfWeek,
                      flightNumber: flightNumber,
                    });
                    newDepartingFlightEntry.save();
                    // console.log("no duplicate found, new departing flight saved")
                  } else {
                    // console.log("duplicate found - no departing flight logged")
                  }
                }
              });
            }
          }
        } else if (direction === "return") {
          for (let i = 0; i < data.scheduled_arrivals.length; i++) {
            if (data.scheduled_arrivals[i].destination === null) {
            } else {
              // define variables with data from api
              let arrivalAirport_iata =
                data.scheduled_arrivals[i].destination.code_iata;
              let arrivalAirport_city =
                data.scheduled_arrivals[i].destination.city;
              let departureAirport_iata =
                data.scheduled_arrivals[i].origin.code_iata;
              let departureAirport_city =
                data.scheduled_arrivals[i].origin.city;
              let arrivalTimeZulu = new Date(
                data.scheduled_arrivals[i].scheduled_in
              );
              let arrivalTimeLocal = arrivalTimeZulu.toLocaleString("en-GB", {
                timeZone: originTimeZone,
              });
              let arrivalTimeDayOfWeek = arrivalTimeZulu.getDay();
              let flightNumber = data.scheduled_arrivals[i].ident_iata;

              // use findOne instead on date and flight number
              Returnflight.findOne({
                arrivalTimeZulu: arrivalTimeZulu,
                flightNumber: flightNumber,
              }).exec(function (err, flight) {
                if (err) {
                  console.log(err);
                } else {
                  if (flight == null) {
                    // put data in database
                    const newReturnFlightEntry = new Returnflight({
                      TimeOfEntry: new Date(),
                      departureAirport_iata: departureAirport_iata,
                      departureAirport_city: departureAirport_city,
                      arrivalAirport_city: arrivalAirport_city,
                      arrivalAirport_iata: arrivalAirport_iata,
                      arrivalTimeZulu: arrivalTimeZulu,
                      arrivalTimeLocal: arrivalTimeLocal,
                      arrivalTimeDayOfWeek: arrivalTimeDayOfWeek,
                      flightNumber: flightNumber,
                    });
                    newReturnFlightEntry.save();
                    // console.log("no duplicate found, new return flight saved")
                  } else {
                    // console.log("duplicate found - no return flight logged")
                  }
                }
              });
            }
          }
        } else {
          console.log("direction error");
        }

        pageCounter++;
        let numberOfPages = pageCounter;
        console.log("number of pages: " + numberOfPages);

        // Fetch the next page from the API
        if ((data.links != null) & (pageCounter < pageCounterLimit)) {
          // create URL of next page
          url_page_extension = data.links.next;
          url = "https://aeroapi.flightaware.com/aeroapi" + url_page_extension;

          if ((url_page_extension != "") & (url_page_extension != null)) {
            // Delay the requests to not pass the api rate limit and call the function again to fetch the next page
            const delayForRateLimitAndCallNextPage = async () => {
              await setTimeout(15000);
              console.log("Waited 15s");
              fetchAirportData(
                url,
                direction,
                pageCounter,
                originTimeZone,
                returnUrl,
                originAirport_iata
              );
            };
            delayForRateLimitAndCallNextPage();
          }

          // check if we bounce against the pagecounter
          if (pageCounter === pageCounterLimit - 1) {
            console.log("pagecounterlimit reached");
          }
        } else {
          // when we have all the information from all pages. We end up here.

          // If we checked for departures, we will now check for returns
          if (direction === "departure") {
            fetchAirportData(
              returnUrl,
              "return",
              0,
              originTimeZone,
              returnUrl,
              originAirport_iata
            );
          } else {
            if ((endOfTheList = false)) {
              return;
            } else if ((endOfTheList = true)) {
              console.log("finished departures and returns");
              const delayForCheckingIfDbisUpdated = async () => {
                await setTimeout(10000);
                console.log("Waited 10s to make sure db is updated");
                countDocuments();
              };
              delayForCheckingIfDbisUpdated();
            }
          }
        }
      })
      .catch(function (error) {
        console.log("Request failed", error);
      });
  }
  const countDocuments = async () => {
    console.log(
      "number of departing entries " +
        (await Departingflight.countDocuments({}))
    );
    console.log(
      "number of returning entries " + (await Returnflight.countDocuments({}))
    );
    mongoose.disconnect();
    console.log("db disconnected");
  };
};

fireItAllUp();
