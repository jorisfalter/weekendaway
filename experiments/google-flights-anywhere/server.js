const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const airports = require("../../airportsv2.js");

const app = express();
const experimentDir = __dirname;
const repoRoot = path.resolve(experimentDir, "../..");
const publicDir = path.join(experimentDir, "web");
const scriptPath = path.join(experimentDir, "weekend_anywhere.py");
const defaultPython = path.join(repoRoot, ".venv-google-flights/bin/python");
const pythonBin = process.env.GOOGLE_FLIGHTS_PYTHON || defaultPython;
const browserChannel = process.env.GOOGLE_FLIGHTS_BROWSER_CHANNEL || "chrome";
const maplibreDist = path.join(repoRoot, "node_modules/maplibre-gl/dist");
const coordinateFallbacks = {
  EIN: { code: "EIN", name: "Eindhoven", lat: 51.4501, lng: 5.3745 },
  RTM: { code: "RTM", name: "Rotterdam The Hague", lat: 51.9569, lng: 4.4372 },
  DUS: { code: "DUS", name: "Düsseldorf", lat: 51.2895, lng: 6.7668 },
  CGN: { code: "CGN", name: "Cologne Bonn", lat: 50.8659, lng: 7.1427 },
  BRU: { code: "BRU", name: "Brussels", lat: 50.9014, lng: 4.4844 },
  CRL: { code: "CRL", name: "Brussels Charleroi", lat: 50.4592, lng: 4.4538 },
  GRX: { code: "GRX", name: "Granada", lat: 37.1887, lng: -3.7774 },
  SEN: { code: "SEN", name: "London Southend", lat: 51.5714, lng: 0.6956 },
  LON: { code: "LON", name: "London", lat: 51.5074, lng: -0.1278 },
  MIL: { code: "MIL", name: "Milan", lat: 45.4642, lng: 9.19 },
};
const originAliases = {
  AMSTERDAM: "AMS",
  AMS: "AMS",
  EINDHOVEN: "EIN",
  EIN: "EIN",
  ROTTERDAM: "RTM",
  "ROTTERDAM THE HAGUE": "RTM",
  RTM: "RTM",
  DUSSELDORF: "DUS",
  "DÜSSELDORF": "DUS",
  DUS: "DUS",
  COLOGNE: "CGN",
  KOLN: "CGN",
  "KÖLN": "CGN",
  "COLOGNE BONN": "CGN",
  CGN: "CGN",
  BRUSSELS: "BRU",
  BRUSSEL: "BRU",
  BRUXELLES: "BRU",
  BRU: "BRU",
  CHARLEROI: "CRL",
  CRL: "CRL",
  LONDON: "LON",
  LON: "LON",
  PARIS: "PAR",
  PAR: "PAR",
  MILAN: "MIL",
  MIL: "MIL",
};

app.use(express.json());
app.use(express.static(publicDir));
app.use("/vendor/maplibre-gl", express.static(maplibreDist));

function findAirportCoordinates(code) {
  if (coordinateFallbacks[code]) {
    return coordinateFallbacks[code];
  }

  const airport = airports.find(
    (entry) =>
      entry[0] === code &&
      Number.isFinite(entry[2]) &&
      Number.isFinite(entry[3])
  );

  if (!airport) return null;
  return {
    code: airport[0],
    name: airport[1],
    lat: airport[2],
    lng: airport[3],
  };
}

function addCoordinates(payload) {
  const origin = findAirportCoordinates(payload.origin);
  const results = (payload.results || []).map((result) => {
    const airport =
      findAirportCoordinates(result.destination_airport_code) ||
      findAirportCoordinates(result.destination_code);
    return {
      ...result,
      coordinates: airport,
    };
  });

  return {
    ...payload,
    origin_coordinates: origin,
    results,
  };
}

function addResultCoordinates(result) {
  const airport =
    findAirportCoordinates(result.destination_airport_code) ||
    findAirportCoordinates(result.destination_code);
  return {
    ...result,
    coordinates: airport,
  };
}

function resultPrice(result) {
  return Number(result.detail_price ?? result.price);
}

function withinMaxPrice(result, maxPrice) {
  return !maxPrice || resultPrice(result) <= maxPrice;
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function normalizeOrigin(value) {
  const raw = String(value || "AMS").trim();
  const key = raw.toUpperCase();
  if (originAliases[key]) return originAliases[key];
  if (/^[A-Z]{3}$/.test(key)) return key;
  throw new Error("Origin must be a known city or a 3-letter IATA code.");
}

function buildScriptArgs(params) {
  const scrapeLimit = Math.min(Math.max(params.limit * 3, params.limit), 120);
  const detailLimit = Math.min(Math.max(params.detailLimit, params.limit), 50);
  const args = [
    scriptPath,
    "--origin",
    params.origin,
    "--departure-date",
    params.departureDate,
    "--return-date",
    params.returnDate,
    "--max-stops",
    String(params.maxStops),
    "--limit",
    String(scrapeLimit),
    "--sort",
    params.sort,
    "--wait-ms",
    String(params.waitMs),
    "--browser-channel",
    browserChannel,
  ];

  if (params.includeDetails) {
    args.push("--include-details", "--detail-limit", String(detailLimit));
  }
  args.push(
    "--options-per-destination",
    String(Math.max(1, Math.min(params.optionsPerDestination || 1, 5)))
  );
  if (params.routeSource && params.routeSource !== "none") {
    args.push(
      "--route-source",
      params.routeSource,
      "--route-source-limit",
      String(Math.max(10, Math.min(params.routeSourceLimit || 80, 200))),
      "--route-source-detail-limit",
      String(Math.max(1, Math.min(params.routeSourceDetailLimit || 16, 40)))
    );
  }
  if (params.progress) {
    args.push("--progress", "--stream-results");
  }
  if (params.outboundAfter) {
    args.push("--outbound-after", params.outboundAfter);
  }
  if (params.outboundBefore) {
    args.push("--outbound-before", params.outboundBefore);
  }
  if (params.returnAfter) {
    args.push("--return-after", params.returnAfter);
  }
  if (params.returnBefore) {
    args.push("--return-before", params.returnBefore);
  }
  if (params.maxPrice > 0) {
    args.push("--max-price", String(params.maxPrice));
  }

  return args;
}

function requestParams(body) {
  const origin = normalizeOrigin(body.origin);
  const departureDate = String(body.departureDate || "");
  const returnDate = String(body.returnDate || "");
  const maxStops = Number(body.maxStops ?? 0);
  const limit = Number(body.limit ?? 50);
  const waitMs = Number(body.waitMs ?? 18_000);
  const maxDurationMinutes = Number(body.maxDurationMinutes || 0);
  const maxPrice = Number(body.maxPrice || 0);
  const includeDetails = body.includeDetails !== false;
  const outboundAfter = String(body.outboundAfter || "");
  const outboundBefore = String(body.outboundBefore || "");
  const returnAfter = String(body.returnAfter || "");
  const returnBefore = String(body.returnBefore || "");
  const sort = ["price", "duration", "page"].includes(body.sort)
    ? body.sort
    : "price";
  const optionsPerDestination = Number(body.optionsPerDestination || 1);
  const routeSource = ["none", "flightsfrom"].includes(body.routeSource)
    ? body.routeSource
    : "flightsfrom";

  if (!isDate(departureDate) || !isDate(returnDate)) {
    throw new Error("Departure and return dates are required.");
  }

  if (new Date(returnDate) < new Date(departureDate)) {
    throw new Error("Return date must be after departure date.");
  }

  return {
    origin,
    departureDate,
    returnDate,
    maxStops: Math.max(0, Math.min(maxStops, 2)),
    limit: Math.max(5, Math.min(limit, 50)),
    waitMs: Math.max(8_000, Math.min(waitMs, 30_000)),
    maxDurationMinutes,
    maxPrice: Math.max(0, maxPrice),
    sort,
    includeDetails,
    detailLimit: Number(body.detailLimit || 50),
    optionsPerDestination: Math.max(1, Math.min(optionsPerDestination, 5)),
    routeSource,
    routeSourceLimit: Number(body.routeSourceLimit || 80),
    routeSourceDetailLimit: Number(body.routeSourceDetailLimit || 16),
    outboundAfter,
    outboundBefore,
    returnAfter,
    returnBefore,
  };
}

function finalizePayload(payload, params) {
  let results = payload.results || [];
  if (params.maxDurationMinutes > 0) {
    results = results.filter(
      (result) =>
        Number.isFinite(result.duration_minutes) &&
        result.duration_minutes <= params.maxDurationMinutes
    );
  }
  if (params.maxPrice > 0) {
    results = results.filter((result) => withinMaxPrice(result, params.maxPrice));
  }

  payload.max_duration_minutes = params.maxDurationMinutes || null;
  payload.max_price = params.maxPrice || null;
  payload.results = results.slice(0, Math.max(5, Math.min(params.limit, 50)));
  payload.result_count = payload.results.length;
  return addCoordinates(payload);
}

function runSearch(params) {
  return new Promise((resolve, reject) => {
    const args = buildScriptArgs(params);
    const child = spawn(pythonBin, args, {
      cwd: repoRoot,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Search timed out. Try fewer detailed results."));
    }, 240_000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || `Search exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Could not parse scraper output: ${error.message}`));
      }
    });
  });
}

app.post("/api/search", async (req, res) => {
  try {
    const params = requestParams(req.body);
    const payload = await runSearch(params);
    res.json(finalizePayload(payload, params));
  } catch (error) {
    res.status(error.message.includes("required") ? 400 : 500).json({
      error: error.message,
    });
  }
});

app.post("/api/search-stream", (req, res) => {
  let params;
  try {
    params = { ...requestParams(req.body), progress: true };
  } catch (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const writeEvent = (event) => {
    res.write(`${JSON.stringify(event)}\n`);
  };

  writeEvent({ type: "progress", message: "Starting search" });

  const child = spawn(pythonBin, buildScriptArgs(params), {
    cwd: repoRoot,
    env: process.env,
  });

  let stdout = "";
  let stderr = "";
  let stderrBuffer = "";

  const timer = setTimeout(() => {
    child.kill("SIGTERM");
    writeEvent({
      type: "error",
      error: "Search timed out. Try fewer detailed results.",
    });
    res.end();
  }, 240_000);

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() || "";

    lines.forEach((line) => {
      if (line.startsWith("PROGRESS:")) {
        writeEvent({ type: "progress", message: line.slice(9) });
      } else if (line.startsWith("RESULT:")) {
        try {
          const result = addResultCoordinates(JSON.parse(line.slice(7)));
          if (!withinMaxPrice(result, params.maxPrice)) return;
          writeEvent({
            type: "partial-result",
            result,
          });
        } catch (error) {
          stderr += `Could not parse partial result: ${error.message}\n`;
        }
      } else if (line.trim()) {
        stderr += `${line}\n`;
      }
    });
  });

  child.on("error", (error) => {
    clearTimeout(timer);
    writeEvent({ type: "error", error: error.message });
    res.end();
  });

  child.on("close", (code) => {
    clearTimeout(timer);
    if (res.writableEnded) return;

    if (stderrBuffer.startsWith("PROGRESS:")) {
      writeEvent({ type: "progress", message: stderrBuffer.slice(9) });
    } else if (stderrBuffer.startsWith("RESULT:")) {
      try {
        const result = addResultCoordinates(JSON.parse(stderrBuffer.slice(7)));
        if (withinMaxPrice(result, params.maxPrice)) {
          writeEvent({
            type: "partial-result",
            result,
          });
        }
      } catch (error) {
        stderr += `Could not parse partial result: ${error.message}\n`;
      }
    } else if (stderrBuffer.trim()) {
      stderr += `${stderrBuffer}\n`;
    }

    if (code !== 0) {
      writeEvent({
        type: "error",
        error: stderr || `Search exited with code ${code}`,
      });
      res.end();
      return;
    }

    try {
      const payload = finalizePayload(JSON.parse(stdout), params);
      writeEvent({ type: "result", payload });
    } catch (error) {
      writeEvent({
        type: "error",
        error: `Could not parse scraper output: ${error.message}`,
      });
    }
    res.end();
  });

  res.on("close", () => {
    if (!res.writableEnded) {
      child.kill("SIGTERM");
      clearTimeout(timer);
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, python: pythonBin });
});

const port = process.env.GOOGLE_FLIGHTS_UI_PORT || 3030;
app.listen(port, () => {
  console.log(`Google Flights Anywhere UI: http://localhost:${port}`);
});
