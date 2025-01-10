//jshint esversion:6
require("dotenv").config();
const https = require("https");

// purpose is to test the Schiphol API only, for another project

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
const maxPages = 200; // 203 was vorige keer de limit

// Function to fetch a single page of data
async function fetchPage(url, allFlights = []) {
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

        // Check for pagination in the 'link' header
        const linkHeader = res.headers["link"];
        if (linkHeader && pageCount < maxPages) {
          const nextPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextPageMatch && nextPageMatch[1]) {
            console.log("Fetching next page:", nextPageMatch[1]);
            fetchPage(nextPageMatch[1], allFlights); // Recursively fetch next page
          } else {
            console.log("No more pages.");
            const arrivalFlights = allFlights
              .filter(
                (flight) =>
                  flight.flightDirection === "A" &&
                  flight.estimatedLandingTime &&
                  !flight.actualLandingTime
              )
              .sort(
                (a, b) =>
                  new Date(a.estimatedLandingTime) -
                  new Date(b.estimatedLandingTime)
              );

            console.log(
              "First 10 arrival flights with estimated landing times (sorted):",
              arrivalFlights.slice(0, 10)
            );
            console.log(
              "Last arrival flight:",
              arrivalFlights[arrivalFlights.length - 1]
            );
          }
        } else {
          console.log("No more pages or reached limit.");
          const arrivalFlights = allFlights
            .filter(
              (flight) =>
                flight.flightDirection === "A" &&
                flight.estimatedLandingTime &&
                !flight.actualLandingTime
            )
            .sort(
              (a, b) =>
                new Date(a.estimatedLandingTime) -
                new Date(b.estimatedLandingTime)
            );

          console.log(
            "First 10 arrival flights with estimated landing times (sorted):",
            arrivalFlights.slice(0, 10)
          );
          console.log(
            "Last arrival flight:",
            arrivalFlights[arrivalFlights.length - 1]
          );
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

  // console.log(allFlights);
}

// Main function to start the process
async function main() {
  fetchPage();
}

// Start the process
main();
