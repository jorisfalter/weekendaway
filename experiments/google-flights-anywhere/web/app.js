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
}

function stripHtml(raw) {
  return raw.replace(/<br>/g, " ").replace(/<[^>]+>/g, "");
}

function markerHtml(result) {
  const price = Math.round(result.detail_price || result.price);
  return `
    <strong>${result.destination}</strong><br>
    ${result.currency} ${price}<br>
    Out ${result.outbound_departure_time || "?"} -> ${result.outbound_arrival_time || "?"}<br>
    Back ${result.return_departure_time || "?"} -> ${result.return_arrival_time || "?"}<br>
    ${result.detail_stops || result.stops || ""}
  `;
}

function projectPoint(lat, lng, bounds, width, height) {
  const lngSpan = bounds.maxLng - bounds.minLng || 1;
  const latSpan = bounds.maxLat - bounds.minLat || 1;
  return {
    x: ((lng - bounds.minLng) / lngSpan) * width,
    y: ((bounds.maxLat - lat) / latSpan) * height,
  };
}

function payloadWithPartialResult(payload, partialResult) {
  const existing = payload.results || [];
  const key = `${partialResult.destination}:${partialResult.destination_airport_code || partialResult.destination_code}`;
  const withoutDuplicate = existing.filter((result) => {
    const resultKey = `${result.destination}:${result.destination_airport_code || result.destination_code}`;
    return resultKey !== key;
  });

  return {
    ...payload,
    result_count: withoutDuplicate.length + 1,
    results: [...withoutDuplicate, partialResult],
  };
}

function renderMap(payload) {
  const width = 1000;
  const height = 330;
  const origin = payload.origin_coordinates;
  const destinations = (payload.results || []).filter((result) => result.coordinates);
  const points = [
    ...(origin ? [origin] : []),
    ...destinations.map((result) => result.coordinates),
  ];

  if (!points.length) {
    mapEl.innerHTML = '<div class="map-empty">Map appears when results have coordinates.</div>';
    return;
  }

  const latValues = points.map((point) => point.lat);
  const lngValues = points.map((point) => point.lng);
  const bounds = {
    minLat: Math.min(...latValues) - 2,
    maxLat: Math.max(...latValues) + 2,
    minLng: Math.min(...lngValues) - 3,
    maxLng: Math.max(...lngValues) + 3,
  };
  const originPoint = origin ? projectPoint(origin.lat, origin.lng, bounds, width, height) : null;

  const lines = destinations
    .map((result) => {
      if (!originPoint) return "";
      const point = projectPoint(result.coordinates.lat, result.coordinates.lng, bounds, width, height);
      return `<line x1="${originPoint.x}" y1="${originPoint.y}" x2="${point.x}" y2="${point.y}" />`;
    })
    .join("");

  const markers = destinations
    .map((result) => {
      const point = projectPoint(result.coordinates.lat, result.coordinates.lng, bounds, width, height);
      const price = Math.round(result.detail_price || result.price);
      return `
        <g class="map-marker destination" transform="translate(${point.x} ${point.y})">
          <circle r="7"></circle>
          <text x="12" y="4">${result.destination} ${result.currency} ${price}</text>
          <title>${stripHtml(markerHtml(result))}</title>
        </g>
      `;
    })
    .join("");

  const originMarker = originPoint
    ? `
      <g class="map-marker origin" transform="translate(${originPoint.x} ${originPoint.y})">
        <circle r="8"></circle>
        <text x="12" y="4">${payload.origin}</text>
      </g>
    `
    : "";

  mapEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Destination map">
      <defs>
        <pattern id="gridPattern" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" />
        </pattern>
      </defs>
      <rect class="map-water" x="0" y="0" width="${width}" height="${height}"></rect>
      <rect class="map-grid" x="0" y="0" width="${width}" height="${height}"></rect>
      <g class="map-lines">${lines}</g>
      ${originMarker}
      ${markers}
    </svg>
  `;
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
    const card = document.createElement("article");
    card.className = "result";
    card.innerHTML = `
      <div>
        <h3>${result.destination}</h3>
        <p class="price">${result.currency} ${Math.round(result.detail_price || result.price)}</p>
      </div>
      <div class="times">
        <span>Out ${result.outbound_departure_time || "?"} -> ${result.outbound_arrival_time || "?"}</span>
        <span>Back ${result.return_departure_time || "?"} -> ${result.return_arrival_time || "?"}</span>
      </div>
      <div class="meta">
        <span>${airportCode}</span>
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
