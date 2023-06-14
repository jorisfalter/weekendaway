// this is the js for everything related to the index.html screen. Everything which relates to the browser window.

function getCoords(originInputInput) {
  console.log(originInputInput);
  var originInputCoords = [];
  switch (originInputInput) {
    case "Lisbon":
      originInputCoords = [38.7223, -9.1393];
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

function getMidPoint(lat1, lng1, lat2, lng2) {
  var latlngs = [];

  var latlng1 = [lat1, lng1];
  var latlng2 = [lat2, lng2];

  var offsetX = latlng2[1] - latlng1[1];
  var offsetY = latlng2[0] - latlng1[0];

  var r = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
  var theta = Math.atan2(offsetY, offsetX);

  var thetaOffset = 3.14 / 12;

  var r2 = r / 2 / Math.cos(thetaOffset);
  var theta2 = theta + thetaOffset;

  var midpointX = r2 * Math.cos(theta2) + latlng1[1];
  var midpointY = r2 * Math.sin(theta2) + latlng1[0];

  var midpointLatLng = [midpointY, midpointX];
  return midpointLatLng;
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

      const map = L.map("map").setView(cityCoords, 4);

      // attribution
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Draw lines for each pair of cities
      Object.keys(destinations).forEach((destinationName) => {
        const destination = destinations[destinationName];
        var midPoint = getMidPoint(
          cityCoords[0],
          cityCoords[1],
          destination.lat,
          destination.lng
        );
        console.log(midPoint);
        // const polyline = L.polyline(
        //   [cityCoords, [destination.lat, destination.lng]],
        //   { color: "red", weight: 1 }
        // ).addTo(map);

        var curvedPath = L.curve(
          ["M", cityCoords, "Q", midPoint, [destination.lat, destination.lng]],
          {
            animate: {
              duration: 2000,
              iterations: 1,
              easting: "ease-in-out",
            },
          },
          {
            color: "red",
            weight: 1,
          }
        ).addTo(map);
      });
    });
}

window.onload = function () {
  initMap();
};
