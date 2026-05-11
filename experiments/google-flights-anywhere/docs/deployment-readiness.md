# Flights for Flaneurs Deployment Readiness

## Current State

The app runs locally with:

```bash
npm run flaneurs:start
```

The Docker deployment files for this app live at:

```text
deploy/flaneurs.Dockerfile
deploy/flaneurs.compose.yml
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

## Hetzner VPS Deploy

Use the standard VPS layout:

```bash
ssh codex@100.102.30.80
cd /opt/codex-workspaces
git clone https://github.com/jorisfalter/weekendaway.git flights-for-flaneurs
cd flights-for-flaneurs
git checkout codex/flaneurs-public-prep
```

Pick a free local port:

```bash
ss -ltnp
```

Default for this app is `127.0.0.1:8102`. To use another one:

```bash
export FLANEURS_HOST_PORT=8103
```

Build and run:

```bash
docker compose -f deploy/flaneurs.compose.yml up -d --build
docker compose -f deploy/flaneurs.compose.yml ps
docker logs flightsforflaneurs --tail 100
curl -I http://127.0.0.1:${FLANEURS_HOST_PORT:-8102}
curl http://127.0.0.1:${FLANEURS_HOST_PORT:-8102}/api/health
```

When live, mirror/copy the runtime to:

```text
/opt/apps/flightsforflaneurs
```

Or keep the runtime driven from the workspace until the first deploy settles, then promote to `/opt/apps`.

## Domain Cutover

Current domain: `flightsforflaneurs.com`.

Goal:

```text
flightsforflaneurs.com -> Cloudflare Tunnel or reverse proxy -> http://127.0.0.1:8102
```

If Cloudflare Tunnel is used, create public hostnames:

```text
flightsforflaneurs.com      -> http://127.0.0.1:8102
www.flightsforflaneurs.com  -> http://127.0.0.1:8102
```

Then remove or replace the old Heroku DNS target. The exact DNS change depends on where DNS is authoritative:

- If Cloudflare is authoritative: update DNS/public hostname in Cloudflare.
- If Heroku DNS records are still at the registrar: remove Heroku CNAME/ALIAS and point to Cloudflare/proxy target.

Check before changing:

```bash
dig flightsforflaneurs.com
dig www.flightsforflaneurs.com
```

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

Document the live app in:

```text
/opt/vps-mgmt-docs/docs/inventory.md
/opt/vps-mgmt-docs/docs/runbooks.md
/opt/vps-mgmt-docs/docs/command-log.md
```

That keeps the old weekendaway experiments intact while giving Flights for Flaneurs its own path to the world.
