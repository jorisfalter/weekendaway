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
const maxPages = 80; // 203 was vorige keer de limit

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
          const prevPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="prev"/);
          if (prevPageMatch && prevPageMatch[1]) {
            console.log("Fetching previous page:", prevPageMatch[1]);
            fetchPage(prevPageMatch[1], allFlights); // Recursively fetch previous page
          } else {
            console.log("No more pages.");
            processArrivalFlights(allFlights);
          }
        } else {
          console.log("No more pages or reached limit.");
          processArrivalFlights(allFlights);
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

// Helper function to process arrival flights (to avoid code duplication)
function processArrivalFlights(allFlights) {
  // First deduplicate by id
  const uniqueFlights = Array.from(
    new Map(allFlights.map((flight) => [flight.id, flight])).values()
  );

  console.log(`Total flights before deduplication: ${allFlights.length}`);
  console.log(
    `Total flights after initial deduplication: ${uniqueFlights.length}`
  );

  // Further deduplicate by mainFlight for codeshares
  const mainFlightMap = new Map();
  uniqueFlights.forEach((flight) => {
    const key = flight.mainFlight;
    if (!mainFlightMap.has(key)) {
      mainFlightMap.set(key, flight);
    }
  });
  const deduplicatedFlights = Array.from(mainFlightMap.values());

  console.log(
    `Total flights after codeshare deduplication: ${deduplicatedFlights.length}`
  );

  const arrivalFlights = deduplicatedFlights
    .filter(
      (flight) =>
        flight.flightDirection === "A" &&
        flight.estimatedLandingTime &&
        !flight.actualLandingTime
    )
    .sort(
      (a, b) =>
        new Date(a.estimatedLandingTime) - new Date(b.estimatedLandingTime)
    );

  console.log(
    "First 10 arrival flights with estimated landing times (sorted):",
    arrivalFlights.slice(0, 10)
  );
}

// Main function to start the process
async function main() {
  // First make a request to get the last page URL
  const initialReq = https.request(options, function (res) {
    const linkHeader = res.headers["link"];
    if (linkHeader) {
      const lastPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="last"/);
      if (lastPageMatch && lastPageMatch[1]) {
        console.log("Starting from last page:", lastPageMatch[1]);
        fetchPage(lastPageMatch[1]);
      } else {
        console.log("No last page found, starting from first page");
        fetchPage();
      }
    } else {
      console.log("No pagination headers found, starting from first page");
      fetchPage();
    }
  });

  initialReq.on("error", function (e) {
    console.error("Error fetching initial page:", e.message);
  });

  initialReq.end();
}

// Start the process
main();
