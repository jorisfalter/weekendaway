const cheerio = require("cheerio");

async function scrapeArrivals() {
  const baseUrl = "https://www.flightradar24.com/airport/";
  const airportCode = "FRA";
  const movementType = "arrivals";
  const response = await fetch(`${baseUrl}${airportCode}${movementType}`);

  if (!response.ok) {
    throw new Error(`FlightRadar24 returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const arrivals = [];

  $(".arr-dep").each((i, element) => {
    // const flightNumber = $(element).find(".PM").text().trim();
    const from = $(element).find(".sub-content-area").text().trim();
    // const expectedTime = $(element).find(".PM").text().trim();

    arrivals.push({
      // flightNumber,
      from,
      // expectedTime,
    });
  });

  console.log(arrivals);
}

scrapeArrivals().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
