// Create a map object
var map = new google.maps.Map(document.getElementById("map"), {
  zoom: 6,
  center: { lat: 13.736717, lng: 100.523186 }, // Co-ordinates for Bangkok
});

// Create an array of latitudes and longitudes for each flight destination
var flightDestinations = [
  { lat: 18.7883, lng: 98.9853 }, // Chiang Mai
  { lat: 8.0863, lng: 98.9063 }, // Phuket
  { lat: 1.3521, lng: 103.8198 }, // Singapore
];

// Loop through the array and create a Polyline object for each flight destination
for (var i = 0; i < flightDestinations.length; i++) {
  var flightPath = new google.maps.Polyline({
    path: [
      { lat: 13.736717, lng: 100.523186 }, // Bangkok co-ordinates
      flightDestinations[i], // Co-ordinates for the destination city
    ],
    geodesic: true,
    strokeColor: "#FF0000",
    strokeOpacity: 1.0,
    strokeWeight: 2,
  });

  flightPath.setMap(map);
}

//
