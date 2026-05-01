# Flights for Flaneurs

Small hobby proof of concept for the Flights for Flaneurs idea: search Google Travel Explore with an open destination, then enrich route ideas with exact times, airlines, airport codes, booking links, and map coordinates.

This is unofficial scraping. Treat the output as experimental and verify prices before booking.

Design direction lives in [docs/design-direction.md](docs/design-direction.md).

## Setup

From the repo root:

```bash
python3 -m venv .venv-google-flights
. .venv-google-flights/bin/activate
python -m pip install -r experiments/google-flights-anywhere/requirements.txt
```

The script uses your installed Chrome via Playwright. If Chrome is not available, install Playwright's bundled browser and run with `--browser-channel chromium`.

## Run

```bash
. .venv-google-flights/bin/activate
python experiments/google-flights-anywhere/weekend_anywhere.py \
  --origin AMS \
  --departure-date 2026-05-08 \
  --return-date 2026-05-10 \
  --max-stops 1 \
  --output experiments/google-flights-anywhere/results/ams-weekend.json \
  --screenshot experiments/google-flights-anywhere/screenshots/ams-weekend.png
```

If dates are omitted, the script defaults to the next Friday through Sunday.

## Play With The Frontend

From the repo root:

```bash
npm run google-flights-ui
```

Then open `http://localhost:3030`.

The UI calls the Python scraper through a tiny Express server. Set `GOOGLE_FLIGHTS_UI_PORT=3031` if port 3030 is already in use, or `GOOGLE_FLIGHTS_PYTHON=/path/to/python` if you want to use a different virtualenv.

## What Works

- Destination-indifferent Google Travel Explore search.
- Round-trip search.
- JSON output with destination, price, currency, stops, and duration.
- Detail lookup for outbound and return times.
- Airline names, airport codes, and booking links.
- Departure/return time-window filtering.
- Multi-airport city grouping for places like London, Milan, Paris, Brussels, and Barcelona.
- Progressive frontend results while the backend is still searching.
- MapLibre map with route lines and destination price pins.
- Optional FlightsFrom route-source fallback.
- Automatic handling of Google's consent screen.
- Local frontend for playing with dates, stops, flight duration, sorting, result count, route fallback, and options per city.

## What Is Still Missing

- More robust extraction from the page's structured data instead of visible text.
- Production deployment setup.
- Rate limiting, caching, and observability for public use.
