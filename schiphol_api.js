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
const maxPages = 50; // 203 was vorige keer de limit

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
    "First 2 arrival flights (full details):",
    JSON.stringify(arrivalFlights.slice(0, 2), null, 2)
  );

  const filteredArrivalFlights = arrivalFlights.map((flight) => ({
    iataMain: flight.aircraftType.iataMain,
    iataSub: flight.aircraftType.iataSub,
    mainFlight: flight.mainFlight,
    codeshares: flight.codeshares?.codeshares || [],
    estimatedLandingTime: flight.estimatedLandingTime,
    flightName: flight.flightName,
    airlineCode: flight.airlineCode,
    destinations: flight.route.destinations,
  }));

  console.log(
    "First 10 arrival flights (filtered fields):",
    JSON.stringify(filteredArrivalFlights.slice(0, 10), null, 2)
  );
}

// Main function to start the process
async function main() {
  let maxPages = 80; // This will be updated based on the quarter calculation
  const initialReq = https.request(options, function (res) {
    const linkHeader = res.headers["link"];
    if (linkHeader) {
      const lastPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="last"/);
      if (lastPageMatch) {
        const lastPageUrl = lastPageMatch[1];
        const pageNumMatch = lastPageUrl.match(/page=(\d+)/);
        const totalPages = pageNumMatch ? parseInt(pageNumMatch[1]) : 80;

        console.log("Total pages available:", totalPages);

        // Calculate the second quarter of pages
        const quarterSize = Math.floor(totalPages / 4);
        const startPage = quarterSize;
        const endPage = quarterSize * 2;
        maxPages = endPage - startPage + 1;

        console.log(`Starting fetch from page ${startPage} to ${endPage}`);
        const targetUrl = `/public-flights/flights?page=${startPage}`;
        fetchPage(targetUrl);
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
