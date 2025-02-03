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
const wss = new WebSocket.Server({ noServer: true });
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

// Function to serve HTML content
function serveHtml(res, filteredArrivalFlights) {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Schiphol Arrival Flights</title>
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <meta http-equiv="refresh" content="60">
    <style>
        table { border-collapse: collapse; width: auto; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <h2>Upcoming Schiphol Arrivals</h2>
    <p>Last updated: ${new Date().toLocaleString()}</p>
    <table style="margin: 0 20px;">
        <tr>
            <th>Flight Number</th>
            <th>Airline</th>
            <th class="toggle-columns hidden">Provenance Code</th>
            <th>Provenance</th>
            <th>Minutes Until Landing</th>
            <th>Aircraft Type</th>
            <th class="toggle-columns hidden">Page Number</th>
            <th class="toggle-columns hidden">Registration</th>
            <th class="toggle-columns hidden">Coordinates</th>
            <th>Runway</th>
        </tr>
        ${filteredArrivalFlights
          .map(
            (flight) => `
        <tr>
            <td>${flight.mainFlight}</td>
            <td>${flight.airlineName}</td>
            <td class="toggle-columns hidden">${flight.destinations}</td>
            <td>${flight.destinationNames}</td>
            <td>${flight.minutesUntilLanding}</td>
            <td>${flight.iataSub}</td>
            <td class="toggle-columns hidden">${flight.pageNumber}</td>
            <td class="toggle-columns hidden">${flight.registration}</td>
            <td class="toggle-columns hidden">${flight.coordinates}</td>
            <td>${flight.runway}</td>
        </tr>
        `
          )
          .join("")}
    </table>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            const toggleButton = document.createElement("button");
            toggleButton.textContent = "Toggle Columns";
            toggleButton.style.margin = "10px"; // Updated margin style
            // Append the button after the table
            const table = document.querySelector("table");
            table.insertAdjacentElement("afterend", toggleButton);

            // Toggle button functionality
            const registrationCells = document.querySelectorAll(".toggle-columns");
            toggleButton.addEventListener("click", function() {
                registrationCells.forEach(cell => {
                    cell.classList.toggle("hidden");
                });
            });
        });
    </script>
</body>
</html>
`;

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(htmlContent);
}

// Initialize the HTTP server
const server = http.createServer(async (req, res) => {
  // I believe the arrivals route is legacy
  if (req.url === "/arrivals") {
    console.log("in the /arrivals");
    // Fetch the latest data before serving
    await main(); // Ensure this fetches and updates filteredArrivalFlights
  } else if (req.url === "/") {
    // Serve the HTML file on the root route
    fs.readFile(path.join(__dirname, "schiphol_arrivals.html"), (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("500 Internal Server Error");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

// Ensure the WebSocket server is set up correctly
server.on("upgrade", (request, socket, head) => {
  if (request.url === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy(); // Reject other upgrade requests
  }
});

// Start the server
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000/");
});

wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");

  // Send latest flight data immediately if available

  if (latestFlightData.length > 0) {
    console.log("📡 Sending cached flight data to new client...");
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
      runway: "",
    }))
    .slice(0, 10); // Keep only the first 10 flights

  for (const flight of filteredArrivalFlights) {
    flight.coordinates = await getFlightData(flight.registration); // Append coordinates to the flight object
    flight.runway = calculateRunway(flight.coordinates); // Calculate runway using coordinates
  }

  console.log("got coordinates and runway");
  // console.log(filteredArrivalFlights);
  // serveHtml(res, filteredArrivalFlights);
  sendUpdatedFlights(filteredArrivalFlights); // Send updated flights to clients

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

    server.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
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
function calculateRunway(coordinates) {
  if (!coordinates || coordinates.length < 2) {
    return "Coordinates Error"; // Return "Unknown" if coordinates are invalid
  }

  // Example logic (replace with actual runway calculation)
  const [latitude, longitude] = coordinates;
  switch (true) {
    case longitude < 4.76 && longitude > 4.73:
      return "18C Zwanenburgbaan"; // Example runway based on latitude
    case longitude >= 4.76:
      return "18C or 18R (expected)"; // Example runway based on latitude
    case longitude < 4.73 && longitude > 4.7:
      return "18R Polderbaan"; // Example runway based on latitude
    case longitude < 4.7:
      return "18R Polderbaan (expected)"; // Example runway based on latitude
    case latitude < 52.33 &&
      latitude > 52.31 &&
      longitude < 4.9 &&
      longitude > 4.75:
      return "27 Buitenveldertbaan";

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
