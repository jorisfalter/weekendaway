// jshint esversion:8
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

async function main() {
  const uri =
    "mongodb+srv://joris-mongo:" +
    process.env.ATLAS_KEY +
    "@cluster1.dkcnhgi.mongodb.net/flightsDB-SchipholAPI";

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });

  const departingFlightSchema = new mongoose.Schema(
    {
      departureTimeZulu: Date,
      flightNumber: String,
    },
    { collection: "departingflights" }
  );
  const returnFlightSchema = new mongoose.Schema(
    {
      arrivalTimeZulu: Date,
      flightNumber: String,
    },
    { collection: "returnflights" }
  );

  const Departingflight = mongoose.model(
    "Departingflight",
    departingFlightSchema
  );
  const Returnflight = mongoose.model("Returnflight", returnFlightSchema);

  const dates = [
    {
      label: "2025-10-21",
      start: new Date("2025-10-21T00:00:00.000Z"),
      end: new Date("2025-10-21T23:59:59.999Z"),
    },
    {
      label: "2025-10-22",
      start: new Date("2025-10-22T00:00:00.000Z"),
      end: new Date("2025-10-22T23:59:59.999Z"),
    },
  ];

  for (const d of dates) {
    const [depCount, retCount] = await Promise.all([
      Departingflight.countDocuments({
        departureTimeZulu: { $gte: d.start, $lte: d.end },
      }),
      Returnflight.countDocuments({
        arrivalTimeZulu: { $gte: d.start, $lte: d.end },
      }),
    ]);
    console.log(`${d.label} → Departing: ${depCount}, Returning: ${retCount}`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Query failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
