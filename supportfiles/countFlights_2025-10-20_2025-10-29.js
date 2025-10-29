// jshint esversion:6
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  try {
    await mongoose.connect(
      "mongodb+srv://joris-mongo:" +
        process.env.ATLAS_KEY +
        "@cluster1.dkcnhgi.mongodb.net/flightsDB-SchipholAPI",
      { useNewUrlParser: true, useUnifiedTopology: true }
    );

    const genericSchema = new mongoose.Schema({}, { strict: false });
    const Departingflight = mongoose.model("Departingflight", genericSchema);
    const Returnflight = mongoose.model("Returnflight", genericSchema);

    const start = new Date("2025-10-20T00:00:00Z");
    const endExclusive = new Date("2025-10-30T00:00:00Z"); // include 29th fully

    console.log(
      `Counting uploads by TimeOfEntry from ${start
        .toISOString()
        .slice(0, 10)} to ${new Date("2025-10-29T00:00:00Z")
        .toISOString()
        .slice(0, 10)} (inclusive)\n`
    );

    let current = new Date(start);
    while (current < endExclusive) {
      const next = new Date(current);
      next.setUTCDate(next.getUTCDate() + 1);

      // Count by TimeOfEntry (when the doc was inserted)
      const dep = await Departingflight.countDocuments({
        TimeOfEntry: { $gte: current, $lt: next },
      });
      const ret = await Returnflight.countDocuments({
        TimeOfEntry: { $gte: current, $lt: next },
      });

      const d = current.toISOString().slice(0, 10);
      const day = current.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "UTC",
      });
      console.log(
        `${d} (${day}) -> Departing=${dep}, Return=${ret}, Total=${dep + ret}`
      );

      current = next;
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  }
}

main();
