function initMap() {
  const map = L.map("map").setView([13.7563, 100.5018], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Pairs of city coordinates
  const destinations = {
    "Chiang Mai": { lat: 18.7877, lng: 98.9931 },
    Phuket: { lat: 7.8804, lng: 98.3923 },
    Singapore: { lat: 1.3521, lng: 103.8198 },
  };

  // Draw lines for each pair of cities
  Object.keys(destinations).forEach((destinationName) => {
    const destination = destinations[destinationName];
    const polyline = L.polyline(
      [
        [13.7563, 100.5018],
        [destination.lat, destination.lng],
      ],
      { color: "red", weight: 3 }
    ).addTo(map);
  });
}

window.onload = function () {
  initMap();
};
