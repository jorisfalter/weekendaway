# VPS Egress Fixes (2026-05-11)

When this app runs from a datacenter IP (Hetzner DE on the production
Hetzner CPX32 VPS) two upstream services treat the egress as a bot and
refuse to serve normal content:

1. Google Flights / Google Travel Explore forces every plain HTTP request
   through a GDPR consent gate at `consent.google.com`.
2. FlightsFrom (`flightsfrom.com`) returns HTTP 403 / a Cloudflare
   "Performing security verification" page for every direct fetch.

Both produced silent "no flights returned" results in the UI even though
the container, the Express server, and the Playwright Explore step were
healthy. This document records what changed in code and why.

## 1. Google detail lookups: bridge Playwright consent to the HTTP client

### Symptom

`POST /api/search-stream` reported:

```text
Explore returned 24 destinations
Looking up exact flight times
Checking London details (1/8)
Skipped London
...
Finished details for 0 destinations
result_count: 0
```

Direct call inside the container:

```python
from google_flights import (FlightData, Passengers, create_filter,
                            get_round_trip_options)
get_round_trip_options(...)
# https://consent.google.com/m?continue=...&gl=DE
# AttributeError: 'NoneType' object has no attribute 'text'
```

### Cause

The Explore step (Playwright) already handles
`consent.google.com` via `accept_google_consent(page)`. The detail step
runs `google-flights==0.0.7`, which uses `primp` over plain HTTP. From a
Hetzner DE IP, Google redirects each detail request to the consent page
and the library cannot parse it.

### Fix

In `weekend_anywhere.py`, monkey-patch `google_flights.main.fetch_search`
and `fetch_booking` to read cookies from a module-level dict
`GF_HTTP_COOKIES`, and populate that dict from the Playwright browser
context after `accept_google_consent` runs:

```python
import google_flights.main as _gf_main

GF_HTTP_COOKIES = {"CONSENT": "PENDING+999"}

def update_google_http_cookies(playwright_cookies):
    for cookie in playwright_cookies:
        if "google.com" in cookie.get("domain", ""):
            GF_HTTP_COOKIES[cookie["name"]] = cookie["value"]

def _build_patched_fetch(url):
    def _patched(params):
        from primp import Client as _Client
        client = _Client(impersonate="chrome_126", verify=False)
        res = client.get(url, params=params, cookies=dict(GF_HTTP_COOKIES))
        return res if res.status_code == 200 else None
    return _patched

_gf_main.fetch_search = _build_patched_fetch("https://www.google.com/travel/flights")
_gf_main.fetch_booking = _build_patched_fetch("https://www.google.com/travel/flights/booking")
```

Then in `run(args)`:

```python
page.goto(url, wait_until="domcontentloaded", timeout=60_000)
accept_google_consent(page)
update_google_http_cookies(page.context.cookies())
```

The same Playwright session that fetches Explore now seeds the HTTP
client used for the per-destination detail queries.

### Verification

```sh
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"origin":"AMS","departureDate":"2026-05-22","returnDate":"2026-05-25",
       "limit":3,"detailLimit":4}' \
  http://127.0.0.1:8102/api/search-stream
# -> result_count: 5
# -> London €173, Dublin €184, Manchester €194, Munich €219, Salzburg €219
```

### Notes

- Running locally on a residential IP usually skips the consent gate, so
  this code path was invisible during local development.
- Rebuilding the image picks up the change automatically via `COPY . .`
  in `deploy/flaneurs.Dockerfile`.

## 2. FlightsFrom route source: fetch through r.jina.ai

### Symptom

Progress log:

```text
Trying flightsfrom fallback for 15 more option(s)
FlightsFrom fallback unavailable:
  Could not load FlightsFrom routes for AMS:
  FlightsFrom response did not contain route rows
```

### Cause

`route_sources/flightsfrom.py` fetched
`https://www.flightsfrom.com/<IATA>/destinations` directly with
`urllib.request`. From the VPS that returns HTTP 403 with a Cloudflare
"Performing security verification" page. The module's secondary URL was
also malformed (a double `https://r.jina.ai/http://r.jina.ai/http://...`
prefix), so the fallback never produced parseable output either.

### Fix

Rewrite `route_sources/flightsfrom.py` to:

1. Always fetch via `https://r.jina.ai/<target>` with header
   `X-Return-Format: html`. Jina Reader renders the page server-side and
   returns the HTML markup, bypassing Cloudflare's challenge.
2. Parse destinations directly from the `<li>` element FlightsFrom uses
   for each row:

   ```html
   <li class="airport-content-destination-listitem"
       data-name="Istanbul" data-time="205"
       data-country="Turkiye" data-iata="IST" ...>
   ```

   A simple regex extracts `data-name`, `data-time`, `data-country`,
   `data-iata` per `<li>`. No HTML parser needed; structure is stable.

The 72-hour on-disk cache and the existing bot-page / no-rows guards are
preserved, so a Jina outage falls back to the last cached response.

### Verification

```sh
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"origin":"AMS","departureDate":"2026-05-22","returnDate":"2026-05-25",
       "limit":3,"detailLimit":4,
       "routeSource":"flightsfrom","routeSourceLimit":20}' \
  http://127.0.0.1:8102/api/search-stream
# FlightsFrom added 16 route candidate(s)
# Finished details for 15 destinations
# (final payload now includes Paris CDG at €227.27,
#  source_order: 10003 -> FlightsFrom-sourced row)
```

### Risk to watch

The FlightsFrom fallback now depends on the third-party Jina Reader
service. If it becomes unreliable or rate-limits the VPS IP, swap the
fetcher for a Playwright-based scrape similar to the Explore step.

## Operational notes

- Both fixes are inside the application source tree and take effect on
  the next image build via `COPY . .` in `deploy/flaneurs.Dockerfile`.
- During this incident the patched files were hot-copied into the
  running container with `docker cp` and the container restarted, to
  avoid a full rebuild.
- The Cloudflare zone for `flightsforflaneurs.com` separately serves a
  JavaScript challenge to public clients ("Just a moment..."). That is
  unrelated to the egress fixes here — the origin on `127.0.0.1:8102`
  returns the real UI. Fix in the Cloudflare dashboard: disable Bot
  Fight Mode and lower the zone Security Level, or add a WAF Skip rule
  for the site.
