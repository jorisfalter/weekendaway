//jshint esversion:6
require("dotenv").config({ path: "../.env" });
var https = require("https");
const fs = require("fs");

var options = {
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

// Create a writable stream for CSV output
const csvFile = fs.createWriteStream("flights.csv");
csvFile.write("scheduleDateTime,destinations,mainFlight,flightDirection\n"); // CSV header

// Function to fetch a single page of data
function fetchPage(url, allFlights = []) {
  if (pageCount >= maxPages) {
    console.log("Reached page limit of", maxPages);
    printFlightDirections(allFlights);
    // writeToCSV(allFlights);

    return; // Stop fetching more pages after reaching the limit
  }

  let currentOptions = { ...options, path: url || options.path };

  var req = https.request(currentOptions, function (res) {
    var chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      var body = Buffer.concat(chunks).toString();

      try {
        // Parse the JSON response
        var jsonData = JSON.parse(body);
        allFlights.push(...jsonData.flights); // Accumulate flights

        pageCount++;

        // Check for pagination in the 'link' header
        var linkHeader = res.headers["link"];
        if (linkHeader && pageCount < maxPages) {
          // Extract the "next" URL from the link header
          const nextPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextPageMatch && nextPageMatch[1]) {
            console.log("Fetching next page:", nextPageMatch[1]);
            fetchPage(nextPageMatch[1], allFlights); // Recursively fetch next page
          } else {
            // No more pages, output the flight directions
            printFlightDirections(allFlights);
            // writeToCSV(allFlights); // No more pages, write to CSV
          }
        } else {
          // No more pages or reached limit, output the flight directions
          printFlightDirections(allFlights);
          // writeToCSV(allFlights); // No more pages, write to CSV
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

// Function to print the flight directions
function printFlightDirections(flights) {
  // print everything
  // console.log(JSON.stringify(flights, null, 2));

  // print specific
  console.log("Flights:");
  flights.forEach((flight) => {
    console.log(flight.scheduleDateTime);
    console.log(flight.route.destinations || "NA");
    console.log(flight.mainFlight || "NA");
    console.log(flight.flightDirection || "NA");
    console.log("---------");
  });
}

// Function to write flights data to CSV
function writeToCSV(flights) {
  console.log("Writing to CSV file...");
  flights.forEach((flight) => {
    const scheduleDateTime = flight.scheduleDateTime || "NULL";
    const destinations = flight.route?.destinations?.join(", ") || "NULL";
    const mainFlight = flight.mainFlight || "NULL";
    const flightDirection = flight.flightDirection || "NULL";

    // Write each flight's data to CSV
    csvFile.write(
      `${scheduleDateTime},${destinations},${mainFlight},${flightDirection}\n`
    );
  });
  console.log("CSV file has been written.");
}

// Start by fetching the first page
fetchPage(null);
