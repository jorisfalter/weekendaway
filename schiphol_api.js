//jshint esversion:6
require("dotenv").config();
const https = require("https");
const fs = require("fs");
const airports = require("./airportsv2.js");
const airlines = require("./airlines.js");
const { FlightRadar24API } = require("flightradarapi");
const { urlencoded } = require("body-parser");
const api = new FlightRadar24API();
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
let latestFlightData = []; // Store the latest flights

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

const express = require("express");
const app = express();

// Set up static file serving
app.use(express.static(path.join(__dirname, "public")));

// Create server using Express app
const server = http.createServer(app);

// Set up WebSocket server with the HTTP server
const wss = new WebSocket.Server({ server });

const currentHour = new Date().getHours();
let startPage;

if (currentHour < 9) {
  startPage = 0; // Before 9 AM
} else if (currentHour < 11) {
  startPage = 20; // At 9 AM
} else if (currentHour < 13) {
  startPage = 60; // At 11 AM
} else if (currentHour < 15) {
  startPage = 90; // At 1 PM
} else if (currentHour < 17) {
  startPage = 110; // At 3 PM
} else if (currentHour < 18) {
  startPage = 130; // At 5 PM
} else {
  startPage = 150; // At 6 PM and later
}
let pageCount = 0;
let maxPages = 80; // rond 230 is de limit

// om 9u zitten we rond pagina 50

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

// Add Express route for the root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "schiphol_arrivals.html"), (err) => {
    if (err) {
      console.error("Error sending HTML file:", err);
      res.status(500).send("500 Internal Server Error");
    }
  });
});

// Add a catch-all route for 404s
app.use((req, res) => {
  res.status(404).send("404 Not Found");
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});

wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");

  // Send latest flight data immediately if available

  if (latestFlightData.length > 0) {
    console.log("📡 Sending cached flight data to new client...");
    console.log(JSON.stringify(latestFlightData));
    ws.send(JSON.stringify(latestFlightData));
  }

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  ws.send(JSON.stringify({ message: "Connected to Schiphol WebSocket!" }));
});

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

  // // display flights to see the json format
  // console.log(
  //   "First arrival flight (full details):",
  //   JSON.stringify(arrivalFlights.slice(0, 1), null, 2)
  // );

  // display all flights
  // console.log("Full details:", JSON.stringify(arrivalFlights, null, 2));
  //
  const logoDirectory = path.join(__dirname, "airlines_logos");

  const filteredArrivalFlights = arrivalFlights
    .map((flight) => ({
      mainFlight: flight.mainFlight,
      airlineName: getAirlineName(flight.mainFlight),
      airlineCode: flight.mainFlight.substring(0, 2).toLowerCase(),
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
      runway: "",
    }))
    .slice(0, 10); // Keep only the first 10 flights

  for (const flight of filteredArrivalFlights) {
    flight.coordinates = await getFlightData(flight.registration); // Append coordinates to the flight object
    flight.runway = calculateRunway(
      flight.coordinates,
      flight.minutesUntilLanding
    ); // Calculate runway using coordinates
    const airlineName = flight.airlineName;
    console.log(airlineName);
    const logoFile = `${airlineName.replace(/\s+/g, "_")}.webp`; // Replace spaces with underscores
    console.log(logoFile);
    const logoPath = fs.existsSync(path.join(logoDirectory, logoFile))
      ? `/airlines_logos/${logoFile}`
      : null;
    console.log(logoPath);
    flight.logoPath = logoPath;
  }

  console.log("got coordinates and runway");
  // console.log(filteredArrivalFlights);
  // serveHtml(res, filteredArrivalFlights);
  if (filteredArrivalFlights.length > 0) {
    sendUpdatedFlights(filteredArrivalFlights); // Send only if there are flights
  } else {
    console.log("⚠️ No valid flights found. Skipping WebSocket update.");
  }
  // I could probably archive this
  if (!server) {
    // Check if server is already initialized
    console.log("in the !server");
    server = http.createServer(async (req, res) => {
      if (req.url === "/arrivals") {
        console.log("in the /arrivals");
        // Fetch the latest data before serving
        await main(); // Ensure this fetches and updates filteredArrivalFlights
      } else if (req.url === "/") {
        // Serve the HTML file on the root route

        const filePath = path.resolve(__dirname, "schiphol_arrivals.html");
        console.log("Trying to serve HTML from:", filePath);
        fs.readFile(
          path.join(__dirname, "schiphol_arrivals.html"),
          (err, data) => {
            // Adjust the filename if necessary
            if (err) {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end("500 Internal Server Error");
              return;
            }
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(data);
          }
        );
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
      }
    });

    server.on("upgrade", (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });

    // Start the server
    const PORT = process.env.PORT || 8080;

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
    });
  }
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

//
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

        const lastPage = startPage + maxPages;
        console.log(`Starting fetch from page ${startPage} to ${lastPage}`);
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

// Function to calculate runway based on coordinates
function calculateRunway(coordinates, minutesUntilLanding) {
  if (!coordinates || coordinates.length < 2) {
    return "Coordinates Error"; // Return "Unknown" if coordinates are invalid
  }
  if (minutesUntilLanding > 10) {
    return "Too far out";
  }

  // Example logic (replace with actual runway calculation)
  const [latitude, longitude] = coordinates;
  switch (true) {
    case longitude < 4.76 && longitude > 4.73 && latitude > 52.34:
      return "18C Zwanenburgbaan"; // Example runway based on latitude
    case longitude >= 4.76 && latitude > 52.34:
      return "18C or 18R (expected)"; // Example runway based on latitude
    case longitude < 4.73 && longitude > 4.7 && latitude > 52.34:
      return "18R Polderbaan"; // Example runway based on latitude
    case longitude < 4.7 && latitude > 52.34:
      return "18R Polderbaan (expected)"; // Example runway based on latitude
    case latitude < 52.33 &&
      latitude > 52.31 &&
      longitude < 4.9 &&
      longitude > 4.75:
      return "27 Buitenveldertbaan";
    case latitude < 52.34 && longitude < 4.72:
      return "06 Kaagbaan";
    case latitude < 52.34 && longitude > 4.72 && longitude < 4.74:
      return "36C Zwanenburgbaan";
    case latitude < 52.34 && longitude > 4.74:
      return "36R Aalsmeerbaan";

    // 32.34
    // de uitzondering voor baan 22 als ze last minute afdraaien
    // er is ook een uitzondering waar 24 en buitenveldertbaan overlappen

    default:
      return ""; // Default runway
  }
}

// Function to send updated flights to all connected clients
function sendUpdatedFlights(flights) {
  console.log("sendUpdatedFlights function");
  console.log(new Date().toLocaleString());

  // Prevent sending empty data
  if (!Array.isArray(flights) || flights.length === 0) {
    console.warn("⚠️ Attempted to send empty flight data. Skipping...");
    return;
  }

  // Store the latest flight data
  latestFlightData = flights;

  const flightsData = JSON.stringify(flights);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(flightsData);
    }
  });
}

async function startScheduler() {
  console.log("Starting scheduler...");

  // Run immediately on start
  await main();
  // const checkClients = setInterval(() => {
  //   if (wss && wss.clients.size > 0) {
  //     console.log("WebSocket clients detected. Starting data fetch.");
  //     clearInterval(checkClients);
  //     main(); // Start fetching flights once clients are connected
  //   } else {
  //     console.log("Waiting for WebSocket clients...");
  //   }
  // }, 2000); // Check every 2 seconds

  // Then run every minute
  setInterval(async () => {
    console.log("\n--- Running scheduled update ---");
    pageCount = 0; // Reset the page counter
    await main();
  }, 60000); // 60000 ms = 1 minute
}

startScheduler();
