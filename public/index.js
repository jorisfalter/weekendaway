// this is the js for everything related to the index.html screen. Everything which relates to the browser window.

function getCoords(originInputInput) {
  console.log(originInputInput);
  var originInputCoords = [];
  switch (originInputInput) {
    case "Lisbon":
      originInputCoords = [38.7223, -9.1393];
      console.log("in Lissabon");

      break;
    case "Bangkok":
      originInputCoords = [13.7563, 100.5018];
      break;
    case "Austin":
      originInputCoords = [30.2672, -97.7431];
      break;
  }
  return originInputCoords;
}

function initMap() {
  // Pairs of city coordinates
  fetch("/variable")
    .then((response) => response.json())
    .then((data) => {
      const destinations = data.variable;
      console.log(destinations);
      const origin = data.departureAirport;
      console.log(origin);
      var cityCoords = getCoords(origin);
      console.log(cityCoords);

      const map = L.map("map").setView(cityCoords, 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Draw lines for each pair of cities
      Object.keys(destinations).forEach((destinationName) => {
        const destination = destinations[destinationName];
        const polyline = L.polyline(
          [cityCoords, [destination.lat, destination.lng]],
          { color: "red", weight: 1 }
        ).addTo(map);
      });
    });
}

window.onload = function () {
  initMap();
};
