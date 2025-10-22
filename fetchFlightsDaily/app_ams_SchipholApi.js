//jshint esversion:6
require("dotenv").config({ path: "../.env" });
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { setTimeout } = require("timers/promises");
const mongoose = require("mongoose");
const internal = require("stream");
const app = express();

// purpose of this is to fetch the data using the Schiphol api rather than flightaware
// pending getting the data from Schiphol

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

// Import airport data for IATA to city name conversion
const airportsListData = require("../airportsv2.js");

function getDestinationInFull(destinationAirportAbbreviated) {
  var longAirportName = "Unknown Airport";
  for (let i = 0; i < airportsListData.length; i++) {
    if (airportsListData[i][0] === destinationAirportAbbreviated) {
      longAirportName = airportsListData[i][1];
      i = airportsListData.length;
    }
  }
  return longAirportName;
}

console.log("length of list: " + airportsList.length);

let endOfTheList = false;

// variables used for testing
let deleteDbAtStart = false;
let pageCounterLimit = 50; // fetch 50 pages per batch
let sleepBetweenBatches = 60000; // sleep 1 minute between batches (60 seconds)
let totalPagesFetched = 0;
let maxTotalPages = 250; // maximum total pages to fetch

// MongoDB connection management
let mongooseConnection = null;
let isConnected = false;

const connectToMongoDB = async () => {
  try {
    if (!isConnected) {
      await mongoose.connect(
        "mongodb+srv://joris-mongo:" +
          process.env.ATLAS_KEY +
          "@cluster1.dkcnhgi.mongodb.net/flightsDB-SchipholAPI",
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          bufferCommands: false,
        }
      );
      isConnected = true;
      console.log("✅ MongoDB connected successfully");
    }
  } catch (error) {
    console.log("❌ MongoDB connection failed:", error.message);
    isConnected = false;
    throw error;
  }
};

const ensureConnection = async () => {
  if (!isConnected || mongoose.connection.readyState !== 1) {
    console.log("🔄 Reconnecting to MongoDB...");
    await connectToMongoDB();
  }
};

const fireItAllUp = async () => {
  await connectToMongoDB();

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

  // Create the function for Schiphol API Call
  // direction is either "departure" or "return"
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
        Accept: "application/json",
        resourceversion: "v4",
        app_id: process.env.SCHIPHOL_APP_ID,
        app_key: process.env.SCHIPHOL_API_KEY,
      },
    })
      .then(function (response) {
        // Store the response headers for pagination
        const linkHeader = response.headers.get("link");
        return response.json().then((data) => ({ data, linkHeader }));
      })
      .then(function ({ data, linkHeader }) {
        console.log(
          `📡 Fetched ${data.flights?.length || 0} flights from Schiphol API`
        );
        if (direction === "departure") {
          // Schiphol API returns flights array, filter for departures
          const departureFlights = data.flights.filter(
            (flight) => flight.flightDirection === "D"
          );

          for (let i = 0; i < departureFlights.length; i++) {
            if (
              !departureFlights[i].route ||
              !departureFlights[i].route.destinations ||
              departureFlights[i].route.destinations.length === 0
            ) {
              continue; // Skip flights with no destinations
            }

            // define variables with data from Schiphol API
            let originAirport_iata = "AMS"; // Amsterdam Schiphol
            let originAirport_city = "Amsterdam";
            let arrivalAirport_iata = departureFlights[i].route.destinations[0]; // First destination
            let arrivalAirport_city = getDestinationInFull(arrivalAirport_iata); // Convert IATA to city name
            let departureTimeZulu = new Date(
              departureFlights[i].scheduleDateTime
            );
            let departureTimeLocal = departureTimeZulu.toLocaleString("en-GB", {
              timeZone: originTimeZone,
            });
            let departureTimeDayOfWeek = departureTimeZulu.getDay();
            let flightNumber = departureFlights[i].mainFlight;

            // use findOne instead on date and flight number
            // here we check for duplicates
            const saveDepartingFlight = async () => {
              try {
                await ensureConnection();
                const flight = await Departingflight.findOne({
                  departureTimeZulu: departureTimeZulu,
                  flightNumber: flightNumber,
                });

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
                  await newDepartingFlightEntry.save();
                  // console.log(`✅ Saved departing flight: ${flightNumber}`);
                } else {
                  // console.log(`⏭️  Duplicate departing flight skipped: ${flightNumber}`);
                }
              } catch (error) {
                console.log(
                  `❌ Error saving departing flight ${flightNumber}:`,
                  error.message
                );
              }
            };
            saveDepartingFlight();
          }
        } else if (direction === "return") {
          // Schiphol API returns flights array, filter for arrivals
          const arrivalFlights = data.flights.filter(
            (flight) => flight.flightDirection === "A"
          );

          for (let i = 0; i < arrivalFlights.length; i++) {
            if (
              !arrivalFlights[i].route ||
              !arrivalFlights[i].route.destinations ||
              arrivalFlights[i].route.destinations.length === 0
            ) {
              continue; // Skip flights with no destinations (which represent origins for arrivals)
            }

            // define variables with data from Schiphol API
            let arrivalAirport_iata = "AMS"; // Amsterdam Schiphol
            let arrivalAirport_city = "Amsterdam";
            let departureAirport_iata = arrivalFlights[i].route.destinations[0]; // For arrivals, destinations contains the origin
            let departureAirport_city = getDestinationInFull(
              departureAirport_iata
            ); // Convert IATA to city name
            let arrivalTimeZulu = new Date(arrivalFlights[i].scheduleDateTime);
            let arrivalTimeLocal = arrivalTimeZulu.toLocaleString("en-GB", {
              timeZone: originTimeZone,
            });
            let arrivalTimeDayOfWeek = arrivalTimeZulu.getDay();
            let flightNumber = arrivalFlights[i].mainFlight;

            // use findOne instead on date and flight number
            const saveReturnFlight = async () => {
              try {
                await ensureConnection();
                const flight = await Returnflight.findOne({
                  arrivalTimeZulu: arrivalTimeZulu,
                  flightNumber: flightNumber,
                });

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
                  await newReturnFlightEntry.save();
                  // console.log(`✅ Saved return flight: ${flightNumber}`);
                } else {
                  // console.log(`⏭️  Duplicate return flight skipped: ${flightNumber}`);
                }
              } catch (error) {
                console.log(
                  `❌ Error saving return flight ${flightNumber}:`,
                  error.message
                );
              }
            };
            saveReturnFlight();
          }
        } else {
          console.log("direction error");
        }

        pageCounter++;
        let numberOfPages = pageCounter;
        console.log(
          `📄 Page ${numberOfPages}/${pageCounterLimit} (${direction})`
        );

        // Fetch the next page from the Schiphol API
        // Schiphol API uses Link header for pagination, not data.links
        if (
          linkHeader &&
          pageCounter < pageCounterLimit &&
          totalPagesFetched < maxTotalPages
        ) {
          const nextPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextPageMatch && nextPageMatch[1]) {
            const nextPageUrl = nextPageMatch[1];
            // console.log(`Fetching next page: ${nextPageUrl}`);

            // Delay the requests to not pass the api rate limit and call the function again to fetch the next page
            const delayForRateLimitAndCallNextPage = async () => {
              await setTimeout(2000); // Schiphol API has different rate limits
              // console.log("Waited 2s");

              // Check connection before continuing
              try {
                await ensureConnection();
                fetchAirportData(
                  nextPageUrl,
                  direction,
                  pageCounter,
                  originTimeZone,
                  returnUrl,
                  originAirport_iata
                );
              } catch (error) {
                console.log(
                  "❌ Connection lost, stopping fetch:",
                  error.message
                );
              }
            };
            delayForRateLimitAndCallNextPage();
          }

          // check if we bounce against the pagecounter
          if (pageCounter === pageCounterLimit - 1) {
            totalPagesFetched += pageCounterLimit;

            // Check if we've reached the maximum total pages
            if (totalPagesFetched >= maxTotalPages) {
              console.log(
                `🛑 Reached maximum pages limit (${maxTotalPages}). Stopping batch.`
              );
              // Continue to the normal completion flow below
            } else {
              console.log(
                `⏸️  Batch complete. Sleeping 1min before next batch... (${totalPagesFetched}/${maxTotalPages} pages)`
              );

              // Sleep for 1 minute then start next batch
              const sleepAndContinue = async () => {
                await setTimeout(sleepBetweenBatches);
                console.log("🔄 Starting next batch...");

                // Check connection before starting new batch
                try {
                  await ensureConnection();

                  // Start next batch from current page
                  const nextBatchUrl = linkHeader
                    ? linkHeader.match(/<([^>]+)>;\s*rel="next"/)[1]
                    : direction === "departure"
                    ? "https://api.schiphol.nl/public-flights/flights?flightDirection=D"
                    : "https://api.schiphol.nl/public-flights/flights?flightDirection=A";

                  fetchAirportData(
                    nextBatchUrl,
                    direction,
                    0, // Reset page counter for new batch
                    originTimeZone,
                    returnUrl,
                    originAirport_iata
                  );
                } catch (error) {
                  console.log(
                    "❌ Connection lost, stopping batch:",
                    error.message
                  );
                }
              };
              sleepAndContinue();
              return; // Exit early to prevent the completion flow below
            }
          }
        } else {
          // when we have all the information from all pages or reached max pages
          console.log(
            `✅ Finished ${direction} flights (${totalPagesFetched} pages)`
          );

          // Check if we've reached the maximum total pages
          if (totalPagesFetched >= maxTotalPages) {
            console.log(
              `🛑 Reached maximum pages limit (${maxTotalPages}). Stopping completely.`
            );
            const delayForCheckingIfDbisUpdated = async () => {
              await setTimeout(10000);
              countDocuments();
            };
            delayForCheckingIfDbisUpdated();
            return; // Exit completely
          }

          // If we checked for departures, we will now check for returns
          if (direction === "departure") {
            console.log("🔄 Starting return flights...");
            totalPagesFetched = 0; // Reset counter for return flights
            fetchAirportData(
              returnUrl,
              "return",
              0,
              originTimeZone,
              returnUrl,
              originAirport_iata
            );
          } else {
            console.log("🎉 All flights processed!");
            const delayForCheckingIfDbisUpdated = async () => {
              await setTimeout(10000);
              // console.log("Waited 10s to make sure db is updated");
              countDocuments();
            };
            delayForCheckingIfDbisUpdated();
          }
        }
      })
      .catch(function (error) {
        console.log("Request failed", error);
      });
  }
  const countDocuments = async () => {
    try {
      await ensureConnection();
      const depCount = await Departingflight.countDocuments({});
      const retCount = await Returnflight.countDocuments({});
      console.log(
        `📊 Final counts - Departing: ${depCount}, Returning: ${retCount}`
      );
    } catch (error) {
      console.log("❌ Error counting documents:", error.message);
    } finally {
      try {
        await mongoose.disconnect();
        isConnected = false;
        console.log("🔌 Database disconnected");
      } catch (error) {
        console.log("❌ Error disconnecting:", error.message);
      }
    }
  };

  // Start fetching data from Schiphol API
  function startDataFetching() {
    for (let j = 0; j < airportsList.length; j++) {
      let originAirport_iata = airportsList[j].originAirport_iata;
      let originTimeZone = airportsList[j].originTimeZone;

      // Get start page from command line argument or default to 0
      let startPage = parseInt(process.argv[2]) || 0;
      console.log(`Starting from page: ${startPage}`);

      // Schiphol API endpoints with start page parameter
      let departureUrl =
        startPage > 0
          ? `https://api.schiphol.nl/public-flights/flights?flightDirection=D&page=${startPage}`
          : "https://api.schiphol.nl/public-flights/flights?flightDirection=D";
      let returnUrl =
        startPage > 0
          ? `https://api.schiphol.nl/public-flights/flights?flightDirection=A&page=${startPage}`
          : "https://api.schiphol.nl/public-flights/flights?flightDirection=A";

      if (j === airportsList.length - 1) {
        endOfTheList = true;
      }

      // Start with departures
      fetchAirportData(
        departureUrl,
        "departure",
        startPage,
        originTimeZone,
        returnUrl,
        originAirport_iata
      );
    }
  }

  startDataFetching();
};

fireItAllUp();
