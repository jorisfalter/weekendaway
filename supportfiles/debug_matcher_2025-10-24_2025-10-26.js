// jshint esversion:6
require("dotenv").config();
const mongoose = require("mongoose");

// Connect to Atlas
async function connect() {
  await mongoose.connect(
    "mongodb+srv://joris-mongo:" +
      process.env.ATLAS_KEY +
      "@cluster1.dkcnhgi.mongodb.net/flightsDB-SchipholAPI",
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
}

// Schemas copied from matcher.js
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

function matchFlights(departingFlight, returnFlight) {
  const foundDestinationsInfo = [];
  const foundDestinationsDestinationsOnly = [];
  const seen = new Set();

  departingFlight.forEach((dep) => {
    returnFlight.forEach((ret) => {
      if (dep.arrivalAirport_city === ret.departureAirport_city) {
        const key = `${dep.flightNumber}|${ret.flightNumber}|${dep.departureTimeLocal}|${ret.arrivalTimeLocal}`;
        if (!seen.has(key)) {
          seen.add(key);
          foundDestinationsInfo.push({
            depAirport: dep.departureAirport_iata,
            depTime: dep.departureTimeLocal,
            depFlightNumber: dep.flightNumber,
            retAirport: ret.departureAirport_iata,
            arrTime: ret.arrivalTimeLocal,
            retFlightNumber: ret.flightNumber,
            destinationInFull: dep.arrivalAirport_city,
          });
        }
        foundDestinationsDestinationsOnly.push(ret.departureAirport_iata);
      }
    });
  });

  return [foundDestinationsInfo, foundDestinationsDestinationsOnly];
}

async function run() {
  try {
    await connect();
    const origin = "Amsterdam";

    // Fixed dates with generous full-day windows in UTC
    const depStart = new Date("2025-10-24T00:00:00Z");
    const depEnd = new Date("2025-10-25T00:00:00Z");
    const retStart = new Date("2025-10-26T00:00:00Z");
    const retEnd = new Date("2025-10-27T00:00:00Z");

    console.log("Searching with:");
    console.log(
      "  Departures: ",
      depStart.toISOString(),
      "->",
      depEnd.toISOString()
    );
    console.log(
      "  Returns:    ",
      retStart.toISOString(),
      "->",
      retEnd.toISOString()
    );

    const departing = await Departingflight.find({
      $and: [
        { departureTimeZulu: { $gte: depStart, $lt: depEnd } },
        { departureAirport_city: origin },
      ],
    }).limit(20000);

    console.log("Found", departing.length, "departing flights on Oct 24");

    const returning = await Returnflight.find({
      $and: [
        { arrivalTimeZulu: { $gte: retStart, $lt: retEnd } },
        { arrivalAirport_city: origin },
      ],
    }).limit(20000);

    console.log("Found", returning.length, "return flights on Oct 26");

    const [matches, destsOnly] = matchFlights(departing, returning);
    console.log("Matches:", matches.length);
    const sample = matches.slice(0, 10);
    if (sample.length) {
      console.log("Sample:");
      sample.forEach((m) =>
        console.log(
          `${m.destinationInFull}: ${m.depFlightNumber} at ${m.depTime} -> ${m.retFlightNumber} at ${m.arrTime}`
        )
      );
    }
  } catch (e) {
    console.error("Error:", e.message || e);
  } finally {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  }
}

run();
