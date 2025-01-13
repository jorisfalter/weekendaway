//jshint esversion:6
require("dotenv").config();
const https = require("https");
const fs = require("fs");

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

const startPage = 50;
let pageCount = 0;
let maxPages; // 203 was vorige keer de limit

// Function to fetch a single page of data
async function fetchPage(url, allFlights = []) {
  if (pageCount >= maxPages) {
    console.log("Reached page limit of", maxPages);
    processArrivalFlights(allFlights); // Process flights when reaching page limit
    return;
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
        // Add page number to each flight entry
        const flightsWithPage = jsonData.flights.map((flight) => ({
          ...flight,
          pageNumber: pageCount + startPage,
        }));
        allFlights.push(...flightsWithPage);
        pageCount++;

        const linkHeader = res.headers["link"];
        if (linkHeader && pageCount < maxPages) {
          const nextPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextPageMatch && nextPageMatch[1]) {
            console.log("Fetching next page:", nextPageMatch[1]);
            fetchPage(nextPageMatch[1], allFlights);
          } else {
            console.log("No more pages.");
            processArrivalFlights(allFlights); // Process when no more pages
          }
        } else {
          console.log("No more pages or reached limit.");
          processArrivalFlights(allFlights); // Process when no more pages or reached limit
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
        processArrivalFlights(allFlights); // Process even if there's an error
      }
    });
  });

  req.on("error", function (e) {
    console.error(e.message);
  });

  req.end();

  // Write allFlights to a JSON file
  // fs.writeFileSync("flights.json", JSON.stringify(allFlights, null, 2), "utf8");
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

  // display flights to see the json format
  // console.log(
  //   "First 2 arrival flights (full details):",
  //   JSON.stringify(arrivalFlights.slice(0, 1), null, 2)
  // );

  // display all flights
  // console.log("Full details:", JSON.stringify(arrivalFlights, null, 2));
  //
  const filteredArrivalFlights = arrivalFlights.map((flight) => ({
    // iataMain: flight.aircraftType.iataMain,
    mainFlight: flight.mainFlight,
    destinations: flight.route.destinations,
    runwayOrCoordinates: "na",
    minutesUntilLanding: Math.round(
      (new Date(flight.estimatedLandingTime) - new Date()) / 60000
    ),
    // estimatedLandingTime: flight.estimatedLandingTime,
    iataSub: flight.aircraftType.iataSub,
    // codeshares: flight.codeshares?.codeshares || [],
    // flightName: flight.flightName,
    // airlineCode: flight.airlineCode,
    pageNumber: flight.pageNumber,
  }));
  // console.log(
  //   "filtered details:",
  //   JSON.stringify(filteredArrivalFlights, null, 2)
  // );

  // Create HTML table
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Arrival Flights</title>
    <meta http-equiv="refresh" content="60">
    <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h2>Upcoming Arrivals</h2>
    <p>Last updated: ${new Date().toLocaleString()}</p>
    <table>
        <tr>
            <th>Main Flight</th>
            <th>Provenance</th>
            <th>Minutes Until Landing</th>
            <th>Aircraft Type</th>
            <th>Page Number</th>
        </tr>
        ${filteredArrivalFlights
          .slice(0, 10)
          .map(
            (flight) => `
        <tr>
            <td>${flight.mainFlight}</td>
            <td>${flight.destinations.join(", ")}</td>
            <td>${flight.minutesUntilLanding}</td>
            <td>${flight.iataSub}</td>
            <td>${flight.pageNumber}</td>
        </tr>
        `
          )
          .join("")}
    </table>
</body>
</html>
`;

  // Write HTML file instead of JSON
  fs.writeFileSync("arrivals.html", htmlContent, "utf8");

  console.log("HTML file generated: arrivals.html");
}

// Main function to start the process
async function main() {
  const initialReq = https.request(options, function (res) {
    const linkHeader = res.headers["link"];
    if (linkHeader) {
      const lastPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="last"/);
      if (lastPageMatch) {
        const lastPageUrl = lastPageMatch[1];
        const pageNumMatch = lastPageUrl.match(/page=(\d+)/);
        const totalPages = pageNumMatch ? parseInt(pageNumMatch[1]) : 80;

        console.log("Total pages available:", totalPages);

        // Calculate the first half of pages
        // const halfSize = Math.floor(totalPages / 2);
        const endPage = 150;
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

async function startScheduler() {
  console.log("Starting scheduler...");

  // Run immediately on start
  await main();

  // Then run every minute
  setInterval(async () => {
    console.log("\n--- Running scheduled update ---");
    pageCount = 0; // Reset the page counter
    await main();
  }, 60000); // 60000 ms = 1 minute
}

startScheduler();
