require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://joris-mongo:" +
    process.env.ATLAS_KEY +
    "@cluster1.dkcnhgi.mongodb.net/flightsDB-SchipholAPI",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

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

async function checkDates() {
  try {
    console.log("\n=== Checking Friday Oct 24, 2025 flights ===\n");

    // Friday Oct 24, 2025
    const fridayStart = new Date("2025-10-24T00:00:00Z");
    const fridayEnd = new Date("2025-10-25T00:00:00Z");

    const friDepFlights = await Departingflight.find({
      departureTimeZulu: { $gte: fridayStart, $lt: fridayEnd },
      departureAirport_city: "Amsterdam",
    });

    console.log(
      `Found ${friDepFlights.length} departing flights from Amsterdam on Oct 24`
    );
    if (friDepFlights.length > 0) {
      console.log("\nSample departing flights:");
      friDepFlights.slice(0, 3).forEach((flight) => {
        console.log(
          `  ${flight.flightNumber} -> ${flight.arrivalAirport_city} (${flight.arrivalAirport_iata}) at ${flight.departureTimeLocal} (day of week: ${flight.departureTimeDayOfWeek})`
        );
      });
    }

    console.log("\n=== Checking Sunday Oct 26, 2025 flights ===\n");

    // Sunday Oct 26, 2025
    const sundayStart = new Date("2025-10-26T00:00:00Z");
    const sundayEnd = new Date("2025-10-27T00:00:00Z");

    const sunRetFlights = await Returnflight.find({
      arrivalTimeZulu: { $gte: sundayStart, $lt: sundayEnd },
      arrivalAirport_city: "Amsterdam",
    });

    console.log(
      `Found ${sunRetFlights.length} return flights to Amsterdam on Oct 26`
    );
    if (sunRetFlights.length > 0) {
      console.log("\nSample return flights:");
      sunRetFlights.slice(0, 3).forEach((flight) => {
        console.log(
          `  ${flight.flightNumber} from ${flight.departureAirport_city} (${flight.departureAirport_iata}) arriving at ${flight.arrivalTimeLocal} (day of week: ${flight.arrivalTimeDayOfWeek})`
        );
      });
    }

    console.log("\n=== Testing matching logic ===\n");

    // Now test if they would match
    const matchingDestinations = [];
    friDepFlights.forEach((dep) => {
      sunRetFlights.forEach((ret) => {
        if (dep.arrivalAirport_city === ret.departureAirport_city) {
          matchingDestinations.push({
            destination: dep.arrivalAirport_city,
            depFlight: dep.flightNumber,
            retFlight: ret.flightNumber,
          });
        }
      });
    });

    console.log(`Found ${matchingDestinations.length} matching destinations`);
    if (matchingDestinations.length > 0) {
      console.log("\nSample matches:");
      matchingDestinations.slice(0, 5).forEach((match) => {
        console.log(
          `  ${match.destination}: ${match.depFlight} -> ${match.retFlight}`
        );
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkDates();
