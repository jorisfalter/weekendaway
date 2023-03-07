require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const app = express();

const fifteenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 15));
console.log(fifteenDaysAgo);

const fireItAllUp = async () => {
  await mongoose.connect(
    "mongodb+srv://joris-mongo:" +
      process.env.ATLAS_KEY +
      "@cluster1.dkcnhgi.mongodb.net/flightsDB",
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
  console.log("mongoose fired up");

  // setup the database
  // mongoose.connect("mongodb://localhost:27017/flightsDB", { useNewUrlParser: true }); //?retryWrites=true&w=majority

  // setup departure collection
  const departingFlightSchema = new mongoose.Schema({
    TimeOfEntry: Date,
    departureAirport: String,
    departureAirport_iata: String,
    arrivalAirport: String,
    departureTimeZulu: Date,
    departureTimeLocal: String,
    departureTimeDayOfWeek: Number,
    flightNumber: String,
  });

  // setup return collection
  const returnFlightSchema = new mongoose.Schema({
    TimeOfEntry: Date,
    departureAirport: String,
    arrivalAirport: String,
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

  // delete data
  try {
    const { deletedCount } = await Returnflight.deleteMany({
      TimeOfEntry: { $lte: fifteenDaysAgo },
    }).exec();

    // try to delete old data from Santander first
    // const { deletedCount } = await Departingflight.deleteMany({
    //   departureAirport: "vtbs",
    // }).exec();

    console.log(deletedCount + "Logs have been cleared");
  } catch (e) {
    console.error(e.message);
  }
};
fireItAllUp();
