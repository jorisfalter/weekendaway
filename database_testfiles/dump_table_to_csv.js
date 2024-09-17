//jshint esversion:6
require("dotenv").config({ path: "../.env" });
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const fs = require("fs");
const { Parser } = require("json2csv");

const app = express();

// this supporting file dumps the mongo db entries from FlightAware from last 7 days into a DB

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const fireItAllUp = async () => {
  await mongoose.connect(
    "mongodb+srv://joris-mongo:" +
      process.env.ATLAS_KEY +
      "@cluster1.dkcnhgi.mongodb.net/flightsDB",
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
  console.log("mongoose fired up");

  // setup departure collection
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

  // setup return collection
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

  // Function to export departing data from a collection to CSV
  const exportDepartToCSV = async (model, fileName, filter) => {
    const data = await model.find(filter).lean(); // use .lean() to get plain JSON objects
    const json2csvParser = new Parser({
      fields: [
        "TimeOfEntry",
        "departureAirport_city",
        "departureAirport_iata",
        "arrivalAirport_city",
        "arrivalAirport_iata",
        "departureTimeZulu",
        "departureTimeLocal",
        "departureTimeDayOfWeek",
        "flightNumber",
      ],
    });
    const csv = json2csvParser.parse(data);

    fs.writeFileSync(fileName, csv);
    console.log(`${fileName} successfully written.`);
  };

  // Function to export return data from a collection to CSV
  const exportReturnToCSV = async (model, fileName, filter) => {
    const data = await model.find(filter).lean(); // use .lean() to get plain JSON objects
    const json2csvParser = new Parser({
      fields: [
        "TimeOfEntry",
        "departureAirport_city",
        "departureAirport_iata",
        "arrivalAirport_city",
        "arrivalAirport_iata",
        "arrivalTimeZulu",
        "arrivalTimeLocal",
        "arrivalTimeDayOfWeek",
        "flightNumber",
      ],
    });
    const csv = json2csvParser.parse(data);

    fs.writeFileSync(fileName, csv);
    console.log(`${fileName} successfully written.`);
  };

  // Calculate the date one week ago from today
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Filter to get only entries from the last week
  const filter = {
    TimeOfEntry: { $gte: oneWeekAgo },
  };

  // Dump data from both collections with the last week's entries
  await exportDepartToCSV(
    Departingflight,
    "dump_departingFlights_lastWeek.csv",
    filter
  );
  await exportReturnToCSV(
    Returnflight,
    "dump_returnFlights_lastWeek.csv",
    filter
  );

  console.log("Data export for the last week completed.");
};

fireItAllUp();
