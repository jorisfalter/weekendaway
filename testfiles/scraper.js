const request = require("request");
const cheerio = require("cheerio");

function scrapeArrivals() {
  const baseUrl = "https://www.flightradar24.com/airport/";
  const airportCode = "FRA";
  const movementType = "arrivals";

  request(
    `${baseUrl}${airportCode}${movementType}`,
    (error, response, html) => {
      if (error) {
        console.log(error);
      } else if (!error && response.statusCode == 200) {
        const $ = cheerio.load(html);
        console.log($);

        const arrivals = [];
        $(".arr-dep").each((i, element) => {
          //   const flightNumber = $(element).find(".PM").text().trim();
          const from = $(element).find(".sub-content-area").text().trim();
          //   const expectedTime = $(element).find(".PM").text().trim();

          arrivals.push({
            // flightNumber,
            from,
            // expectedTime,
          });
        });

        console.log(arrivals);
      }
    }
  );
}

scrapeArrivals();
