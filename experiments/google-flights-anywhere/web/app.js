const form = document.querySelector("#search-form");
const statusEl = document.querySelector("#status");
const submit = document.querySelector("#submit");
const grid = document.querySelector("#grid");
const title = document.querySelector("#result-title");
const eyebrow = document.querySelector("#eyebrow");
const sourceLink = document.querySelector("#source-link");
const mapEl = document.querySelector("#map");
const storageKey = "flaneurs:anywhere-settings:v1";

function nextWeekend() {
  const today = new Date();
  const day = today.getDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;

  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  return {
    departure: friday.toISOString().slice(0, 10),
    returnDate: sunday.toISOString().slice(0, 10),
  };
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return "Duration unknown";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function formPayload() {
  const data = new FormData(form);
  return {
    origin: data.get("origin"),
    departureDate: data.get("departureDate"),
    returnDate: data.get("returnDate"),
    maxStops: Number(data.get("maxStops")),
    maxDurationMinutes: Number(data.get("maxDurationMinutes")),
    outboundAfter: data.get("outboundAfter"),
    returnBefore: data.get("returnBefore"),
    includeDetails: true,
    detailLimit: Number(data.get("limit")),
    optionsPerDestination: Number(data.get("optionsPerDestination")),
    sort: data.get("sort"),
    limit: Number(data.get("limit")),
  };
}

function saveSettings(payload) {
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

function loadingMessages(payload) {
  const count = Math.max(1, Number(payload.detailLimit || payload.limit || 1));
  return [
    "Opening Google Travel Explore...",
    "Waiting for destination ideas...",
    `Checking exact flight times for up to ${count} destinations...`,
    "Still working; Google Flights can be slow here...",
  ];
}

function startFallbackProgress(payload) {
  const messages = loadingMessages(payload);
  let index = 0;
  setStatus(messages[index]);
  return setInterval(() => {
    index = Math.min(index + 1, messages.length - 1);
    setStatus(messages[index]);
  }, 9000);
}

async function readNdjson(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
  }

  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

function loadSettings() {
  const defaults = nextWeekend();
  const fallback = {
    origin: "Amsterdam",
    departureDate: defaults.departure,
    returnDate: defaults.returnDate,
    maxStops: 1,
    maxDurationMinutes: 0,
    outboundAfter: "17:00",
    returnBefore: "22:00",
    sort: "price",
    limit: 8,
    optionsPerDestination: 1,
  };

  try {
    return {
      ...fallback,
      ...JSON.parse(localStorage.getItem(storageKey) || "{}"),
    };
  } catch {
    return fallback;
  }
}

function applySettings(settings) {
  document.querySelector("#origin").value = settings.origin || "Amsterdam";
  document.querySelector("#departureDate").value = settings.departureDate || "";
  document.querySelector("#returnDate").value = settings.returnDate || "";
  document.querySelector("#maxStops").value = String(settings.maxStops ?? 1);
  document.querySelector("#maxDurationMinutes").value = String(
    settings.maxDurationMinutes ?? 0
  );
  document.querySelector("#outboundAfter").value = settings.outboundAfter || "";
  document.querySelector("#returnBefore").value = settings.returnBefore || "";
  document.querySelector("#sort").value = settings.sort || "price";
  document.querySelector("#limit").value = String(settings.limit ?? 8);
  document.querySelector("#optionsPerDestination").value = String(
    settings.optionsPerDestination ?? 1
  );
}

function stripHtml(raw) {
  return raw.replace(/<br>/g, " ").replace(/<[^>]+>/g, "");
}

function markerHtml(result) {
  const price = Math.round(result.detail_price || result.price);
  const airlines = formatAirlines(result);
  return `
    <strong>${result.destination}</strong><br>
    ${result.currency} ${price}<br>
    ${airlines ? `${airlines}<br>` : ""}
    Out ${result.outbound_departure_time || "?"} -> ${result.outbound_arrival_time || "?"}<br>
    Back ${result.return_departure_time || "?"} -> ${result.return_arrival_time || "?"}<br>
    ${result.detail_stops || result.stops || ""}
  `;
}

function formatAirlines(result) {
  const names = [
    ...(result.outbound_airlines || []),
    ...(result.return_airlines || []),
  ].filter(Boolean);
  return [...new Set(names)].join(" / ");
}

function payloadWithPartialResult(payload, partialResult) {
  const existing = payload.results || [];
  const key = `${partialResult.destination}:${partialResult.option_number || 1}:${partialResult.destination_airport_code || partialResult.destination_code}:${partialResult.return_airport_code || ""}`;
  const withoutDuplicate = existing.filter((result) => {
    const resultKey = `${result.destination}:${result.option_number || 1}:${result.destination_airport_code || result.destination_code}:${result.return_airport_code || ""}`;
    return resultKey !== key;
  });

  return {
    ...payload,
    result_count: withoutDuplicate.length + 1,
    results: [...withoutDuplicate, partialResult],
  };
}

let map;
let mapMarkers = [];

function initMap() {
  if (map || !window.maplibregl) return;

  map = new maplibregl.Map({
    container: mapEl,
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    },
    center: [4.7639, 52.3086],
    zoom: 4,
    attributionControl: false,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
}

function clearMapMarkers() {
  mapMarkers.forEach((marker) => marker.remove());
  mapMarkers = [];
}

function addMapMarker({ lng, lat, className, html, popup }) {
  const element = document.createElement("div");
  element.className = `map-pin ${className}`;
  element.innerHTML = html;
  const marker = new maplibregl.Marker({ element })
    .setLngLat([lng, lat])
    .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popup))
    .addTo(map);
  mapMarkers.push(marker);
}

function setLineLayer(origin, destinations) {
  if (!map.getSource("routes")) {
    map.addSource("routes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "routes",
      type: "line",
      source: "routes",
      paint: {
        "line-color": "#245b9d",
        "line-width": 1.6,
        "line-opacity": 0.5,
      },
    });
  }

  const features = origin
    ? destinations.map((result) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [origin.lng, origin.lat],
            [result.coordinates.lng, result.coordinates.lat],
          ],
        },
      }))
    : [];

  map.getSource("routes").setData({ type: "FeatureCollection", features });
}

function renderMap(payload) {
  initMap();
  if (!map) {
    mapEl.innerHTML = '<div class="map-empty">Map could not load.</div>';
    return;
  }

  const draw = () => {
    clearMapMarkers();
    const origin = payload.origin_coordinates;
    const destinations = (payload.results || []).filter((result) => result.coordinates);
    setLineLayer(origin, destinations);

    const bounds = new maplibregl.LngLatBounds();

    if (origin) {
      addMapMarker({
        lng: origin.lng,
        lat: origin.lat,
        className: "origin",
        html: "",
        popup: `<strong>${payload.origin}</strong><br>${origin.name}`,
      });
      bounds.extend([origin.lng, origin.lat]);
    }

    destinations.forEach((result) => {
      const price = Math.round(result.detail_price || result.price);
      addMapMarker({
        lng: result.coordinates.lng,
        lat: result.coordinates.lat,
        className: "destination",
        html: `<span>${result.currency} ${price}</span>`,
        popup: markerHtml(result),
      });
      bounds.extend([result.coordinates.lng, result.coordinates.lat]);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 46, maxZoom: 6, duration: 0 });
    }
    map.resize();
  };

  if (map.loaded()) draw();
  else map.once("load", draw);
}

function renderResults(payload) {
  const results = payload.results || [];
  grid.classList.toggle("empty", results.length === 0);
  grid.innerHTML = "";

  eyebrow.textContent = `${payload.origin} · ${payload.departure_date} to ${payload.return_date}`;
  title.textContent = payload.loading
    ? `Searching destinations${results.length ? ` (${results.length} found)` : ""}`
    : `${results.length} destination ideas`;
  sourceLink.hidden = !payload.url;
  sourceLink.href = payload.url || "#";
  renderMap(payload);

  if (!results.length && payload.loading) {
    grid.innerHTML = "<p>Waiting for the first matching destination...</p>";
    return;
  }

  if (!results.length) {
    grid.innerHTML = "<p>No destinations found. Try allowing more stops or increasing the result count.</p>";
    return;
  }

  const fragment = document.createDocumentFragment();
  results.forEach((result) => {
    const airportCode = result.destination_airport_code || result.coordinates?.code || "No airport";
    const returnAirport =
      result.return_airport_code && result.return_airport_code !== airportCode
        ? ` / ${result.return_airport_code}`
        : "";
    const optionSuffix =
      result.option_number && result.option_number > 1
        ? ` option ${result.option_number}`
        : "";
    const airlines = formatAirlines(result);
    const card = document.createElement("article");
    card.className = "result";
    card.innerHTML = `
      <div>
        <h3>${result.destination}${optionSuffix}</h3>
        <p class="price">${result.currency} ${Math.round(result.detail_price || result.price)}</p>
      </div>
      <div class="times">
        ${airlines ? `<span>${airlines}</span>` : ""}
        <span>Out ${result.outbound_departure_time || "?"} -> ${result.outbound_arrival_time || "?"}</span>
        <span>Back ${result.return_departure_time || "?"} -> ${result.return_arrival_time || "?"}</span>
      </div>
      <div class="meta">
        <span>${airportCode}${returnAirport}</span>
        <span>${result.detail_stops || result.stops || "Stops unknown"}</span>
        <span>Out ${formatDuration(result.outbound_duration_minutes || result.duration_minutes)}</span>
        ${
          result.return_duration_minutes
            ? `<span>Back ${formatDuration(result.return_duration_minutes)}</span>`
            : ""
        }
      </div>
      ${
        result.booking_url
          ? `<a class="booking" href="${result.booking_url}" target="_blank" rel="noreferrer">Open flights</a>`
          : ""
      }
    `;
    fragment.append(card);
  });
  grid.append(fragment);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formPayload();
  saveSettings(payload);

  submit.disabled = true;
  const partialPayload = {
    origin: payload.origin,
    departure_date: payload.departureDate,
    return_date: payload.returnDate,
    url: "",
    loading: true,
    results: [],
  };
  renderResults(partialPayload);
  const fallbackTimer = startFallbackProgress(payload);

  try {
    let finalPayload;
    const response = await fetch("/api/search-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Search failed.");
    }

    await readNdjson(response, (event) => {
      if (event.type === "progress") {
        setStatus(event.message);
      } else if (event.type === "partial-result") {
        partialPayload.results = payloadWithPartialResult(partialPayload, event.result).results;
        partialPayload.result_count = partialPayload.results.length;
        renderResults(partialPayload);
      } else if (event.type === "result") {
        finalPayload = event.payload;
      } else if (event.type === "error") {
        throw new Error(event.error || "Search failed.");
      }
    });

    if (!finalPayload) throw new Error("Search finished without results.");

    renderResults(finalPayload);
    setStatus("Done.");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    clearInterval(fallbackTimer);
    submit.disabled = false;
  }
});

applySettings(loadSettings());

form.addEventListener("change", () => {
  saveSettings(formPayload());
});
