(function () {
  const apiKey = "";

  // Load the Maps API library using the API key
  function loadScript() {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.defer = true;
    script.async = true;
    document.head.appendChild(script);
    script.onload = initMap;
  }

  // Create the map using the loaded API key
  function initMap() {
    const mapDiv = document.getElementById("map");
    const myLatLng = { lat: -34.603722, lng: -58.381592 };

    // Create the map centered at the given coordinates
    const map = new google.maps.Map(mapDiv, {
      center: myLatLng,
      zoom: 14,
    });

    // Add a marker at the center of the map
    const marker = new google.maps.Marker({
      position: myLatLng,
      map: map,
    });
  }

  // Call loadScript() to load the Maps API library
  loadScript();
})();
