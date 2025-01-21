//jshint esversion:6
require("dotenv").config();
const https = require("https");
const fs = require("fs");
const airports = require("./airportsv2.js");
const airlines = require("./airlines.js");
const { FlightRadar24API } = require("flightradarapi");
const api = new FlightRadar24API();

// purpose is to test the Schiphol API only, for the project on Schiphol landings

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

const startPage = 135;
let pageCount = 0;
let maxPages = 80; // 203 was vorige keer de limit

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
async function processArrivalFlights(allFlights) {
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
    // sort by time to landing
    .sort(
      (a, b) =>
        new Date(a.estimatedLandingTime) - new Date(b.estimatedLandingTime)
    );

  // display flights to see the json format
  // console.log(
  // display flights to see the json format
  // console.log(
  //   "First 2 arrival flights (full details):",
  //   JSON.stringify(arrivalFlights.slice(0, 1), null, 2)
  // );

  // display all flights
  // console.log("Full details:", JSON.stringify(arrivalFlights, null, 2));
  //
  const filteredArrivalFlights = arrivalFlights
    .map((flight) => ({
      mainFlight: flight.mainFlight,
      airlineName: getAirlineName(flight.mainFlight),
      destinations: flight.route.destinations,
      destinationNames: flight.route.destinations.map((code) =>
        getAirportName(code)
      ),
      runwayOrCoordinates: "na",
      minutesUntilLanding: Math.round(
        (new Date(flight.estimatedLandingTime) - new Date()) / 60000
      ),
      iataSub: flight.aircraftType.iataSub,
      pageNumber: flight.pageNumber,
      registration: flight.aircraftRegistration,
      coordinates: [],
    }))
    .slice(0, 10); // Keep only the first 10 flights

  for (const flight of filteredArrivalFlights) {
    flight.coordinates = await getFlightData(flight.registration); // Append coordinates to the flight object
  }

  // console.log(
  //   "filtered details:",
  //   JSON.stringify(filteredArrivalFlights, null, 2)
  // );

  // Create HTML table
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Schiphol Arrival Flights</title>
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <meta http-equiv="refresh" content="60">
    <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h2>Upcoming Schiphol Arrivals</h2>
    <p>Last updated: ${new Date().toLocaleString()}</p>
    <table>
        <tr>
            <th>Main Flight</th>
            <th>Provenance</th>
            <th>Minutes Until Landing</th>
            <th>Aircraft Type</th>
            <th>Page Number</th>
            <th>Registration</th>
            <th>Coordinates</th>

        </tr>
        ${filteredArrivalFlights
          .map(
            (flight) => `
        <tr>
            <td>${flight.mainFlight} (${flight.airlineName})</td>
            <td>${flight.destinations
              .map(
                (code, index) => `${code} (${flight.destinationNames[index]})`
              )
              .join(", ")}</td>
            <td>${flight.minutesUntilLanding}</td>
            <td>${flight.iataSub}</td>
            <td>${flight.pageNumber}</td>
            <td>${flight.registration}</td>
            <td>${flight.coordinates}</td>

        </tr>
        `
          )
          .join("")}
    </table>
</body>
</html>
`;

  // Write HTML file
  fs.writeFileSync("arrivals.html", htmlContent, "utf8");

  console.log("HTML file generated: arrivals.html");
}

// Helper function to find airport name by code
function getAirportName(code) {
  const airport = airports.find((airport) => airport[0] === code);
  return airport ? airport[1] : code;
}

// Helper function to find airline name by code
function getAirlineName(flightNumber) {
  const airlineCode = flightNumber.substring(0, 2);
  const airline = airlines.find((airline) => airline[0] === airlineCode);
  return airline ? airline[1] : airlineCode;
}

// function which fetches coordinates from flightradar24
async function getFlightData(registration_input) {
  // const bounds = "52.8,51.5,2.5,7.75"; // [noord zuid west oost denk ik]
  // const aircraft_type = "A21N"; //   ("E190");
  // const airline = "KLM";
  const registration = registration_input; //"EI-SCB";

  try {
    // Fetch a list of current flights

    // from the fr repo:   async getFlights(airline = null, bounds = null, registration = null, aircraftType = null, details = false) {
    // const response = await api.getFlights(airline, bounds, null, aircraft_type);
    console.log("registrationAsIs", registration);
    const response = await api.getFlights(
      null,
      null,
      registration,
      null,
      false
    );

    // Check if flights is valid before proceeding
    if (!response || !Array.isArray(response) || response.length === 0) {
      // console.log("Error: No valid flight data returned.");

      // Attempt to modify the registration with hyphens
      const registrationWithHyphen1 =
        registration_input.slice(0, 1) + "-" + registration_input.slice(1);
      console.log("registrationWithHyphen1", registrationWithHyphen1);
      const response1 = await api.getFlights(
        null,
        null,
        registrationWithHyphen1,
        null,
        false
      );
      // console.log("response1:", response1);
      if (response1 && Array.isArray(response1) && response1.length > 0) {
        return [response1[0].latitude, response1[0].longitude];
      }

      const registrationWithHyphen2 =
        registration_input.slice(0, 2) + "-" + registration_input.slice(2);
      console.log("registrationWithHyphen2", registrationWithHyphen2);
      const response2 = await api.getFlights(
        null,
        null,
        registrationWithHyphen2,
        null,
        false
      );
      // console.log("response2:", response2);
      if (response2 && Array.isArray(response2) && response2.length > 0) {
        return [response2[0].latitude, response2[0].longitude];
      }

      return null; // Return null if no valid data
    }
    return [response[0].latitude, response[0].longitude];

    // Check if response contains valid latitude and longitude
    // if (!response || !response.latitude || !response.longitude) {
    //   console.error(
    //     "Error: No valid flight data returned or missing coordinates."
    //   );
    //   return null; // Return null if no valid data
    // }
  } catch (error) {
    console.error("Error fetching flight data:", error);
  }
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
        const endPage = 300;
        // maxPages = endPage - startPage + 1;

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
