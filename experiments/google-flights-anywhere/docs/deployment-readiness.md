# Flights for Flaneurs Deployment Readiness

## Current State

The app runs locally with:

```bash
npm run flaneurs:start
```

It serves:

- Express backend
- Static frontend
- MapLibre assets from local `node_modules`
- Python scraper through `.venv-google-flights`

## Important Repo Note

The root deployment files are not yet for Flights for Flaneurs:

- `Dockerfile` currently starts `schiphol_api.js`
- `Procfile` currently starts `matcher.js`
- `fly.toml` is for the older `weekendaway` app

Do not deploy those as the public Flights for Flaneurs app without changing them.

## Runtime Needs

Public deployment needs a runtime with:

- Node.js 20+
- Python 3.10+
- Python dependencies from `experiments/google-flights-anywhere/requirements.txt`
- A Playwright-compatible browser or system Chrome
- Enough memory for browser automation, likely 1 GB minimum
- Outbound network access to Google Travel, Google Flights, OSM tiles, and optional route sources

## Recommended First Deploy

Use a separate app/service name, for example:

- `flights-for-flaneurs`
- primary region: `ams`
- one small machine/container
- no database initially
- route-source cache on disk only, acceptable for an experiment

The first public deployment should be framed as experimental. It should not promise final prices or guaranteed availability.

## Before Public Launch

- Split the flaneurs app from the old Schiphol project or make a dedicated deploy entrypoint.
- Add a production Dockerfile that installs Node, Python deps, and Playwright browser dependencies.
- Add request timeouts and per-IP rate limits.
- Cache FlightsFrom route-source results by origin.
- Add lightweight logging for failed searches.
- Add a visible data-source note in the UI.
- Decide the domain and final product name.

## Nice Next Step

Create a dedicated deploy folder:

```text
deploy/flaneurs.Dockerfile
deploy/fly.flaneurs.toml
```

That keeps the old weekendaway experiments intact while giving Flights for Flaneurs its own path to the world.
