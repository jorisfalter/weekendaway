// schiphol_api.js - Purpose is to convert the python script to js

// het lijkt trouwens dat dit hele andere data formaat als resultaat geeft dan het python script
const { FlightRadar24API } = require("flightradarapi");
const api = new FlightRadar24API();

async function getFlightData() {
  const bounds = "52.8,51.5,2.5,7.75"; // [noord zuid west oost denk ik]
  const aircraft_type = "A21N"; //   ("E190");
  const airline = "KLM";
  const registration = "N4064J"; // "EI-SCB";

  try {
    // Fetch a list of current flights

    // from the fr repo:   async getFlights(airline = null, bounds = null, registration = null, aircraftType = null, details = false) {
    // const response = await api.getFlights(airline, bounds, null, aircraft_type);
    const response = await api.getFlights(null, null, registration, null, true);
    console.log(response);

    // Print the length of the flights array
    console.log(`Number of flights retrieved: ${response.length}`);

    // Check if flights is valid before proceeding
    if (!response || !Array.isArray(response) || response.length === 0) {
      console.log("Error: No valid flight data returned.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching flight data:", error);
  }
}

if (require.main === module) {
  getFlightData();
}
