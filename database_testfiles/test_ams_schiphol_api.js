//jshint esversion:6
require("dotenv").config({ path: "../.env" });
const https = require("https");
const { MongoClient } = require("mongodb"); // Import MongoDB client

// purpose is to test the Schiphol API - this is a brand new file started from scratch

// MongoDB connection URL and database
const mongoUrl =
  "mongodb+srv://joris-mongo:" +
    process.env.ATLAS_KEY +
    "@cluster1.dkcnhgi.mongodb.net/flightsDB-SchipholAPI" ||
  "mongodb://localhost:27017";
const dbName = "flightsDB-SchipholAPI";

// Connect to MongoDB
async function connectToMongo() {
  const client = new MongoClient(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    console.log("Attempting to connect to MongoDB...");
    await client.connect(); // This is asynchronous, and the function will wait here until connection is successful
    console.log("Connected to MongoDB");
    return client.db(dbName); // If connected, return the db object
  } catch (err) {
    console.error("MongoDB connection error:", err);
    return null; // Return null if there's an error
  }
}

// Function to insert flight into the correct collection
async function insertFlight(db, flight) {
  // console.log(flight); // uncomment to see the flight
  const collectionName =
    flight.flightDirection === "A" ? "returnflights" : "departingflights";

  const collection = db.collection(collectionName);

  // Insert the flight into the correct collection

  // NEED IF ELSE BASED on flightDirection!!!
  // currently doing it based on departingflights
  // departureTimeZulu still todo
  // departureTimeDayOfWeek still todo

  await collection.insertOne({
    TimeOfEntry: new Date(),
    departureAirport_city: "Amsterdam", // we might not actually use this one
    departureAirport_iata: "AMS",
    arrivalAirport_city: "", // we might not actually use this one, so if it's not there, maybe it's not a problem
    arrivalAirport_iata: flight.route?.destinations[0] || ["NULL"], // we only take the first destination, this is something I should solve
    departureTimeZulu: "",
    // departureTimeLocal: new Date(flight.scheduleDateTime) || "NULL", // if I do it like this, it will assume it's in GMT timezone, so it will deduct two hours
    departureTimeLocal: new Date(flight.scheduleDateTime) || "NULL",
    departureTimeDayOfWeek: "",
    flightNumber: flight.mainFlight || "NULL",
    flightDirection: flight.flightDirection || "NULL", // just to check
  });
}

// HTTPS request options
const options = {
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

let pageCount = 0;
const maxPages = 10; // Limit to 10 pages

// Function to fetch a single page of data
async function fetchPage(url, db, allFlights = []) {
  if (pageCount >= maxPages) {
    console.log("Reached page limit of", maxPages);
    return; // Stop fetching more pages after reaching the limit
  }

  const currentOptions = { ...options, path: url || options.path };

  const req = https.request(currentOptions, function (res) {
    let chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", async function () {
      const body = Buffer.concat(chunks).toString();

      try {
        const jsonData = JSON.parse(body);
        allFlights.push(...jsonData.flights); // Accumulate flights
        pageCount++;

        // Insert flights into respective collections
        for (const flight of jsonData.flights) {
          if (
            flight.flightDirection === "A" ||
            flight.flightDirection === "D"
          ) {
            await insertFlight(db, flight); // Insert based on flightDirection
          }
        }

        // Check for pagination in the 'link' header
        const linkHeader = res.headers["link"];
        if (linkHeader && pageCount < maxPages) {
          const nextPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextPageMatch && nextPageMatch[1]) {
            console.log("Fetching next page:", nextPageMatch[1]);
            fetchPage(nextPageMatch[1], db, allFlights); // Recursively fetch next page
          } else {
            console.log("No more pages.");
          }
        } else {
          console.log("No more pages or reached limit.");
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    });
  });

  req.on("error", function (e) {
    console.error(e.message);
  });

  req.end();
}

// Main function to start the process
async function main() {
  console.log("Starting MongoDB connection...");
  const db = await connectToMongo(); // Wait for MongoDB connection
  // console.log("MongoDB connection result:", db); // This should log either the db object or null

  if (db) {
    console.log("MongoDB connected successfully, starting fetchPage...");
    fetchPage(null, db); // Start fetching pages after the db connection is successful
  } else {
    console.error("Could not establish MongoDB connection. Exiting.");
  }
}

// Start the process
main();
