from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


# FlightsFrom puts each destination into a <li class="airport-content-destination-listitem">
# element whose data-* attributes carry everything we need:
#   data-name="Istanbul" data-time="205" data-country="Turkiye" data-iata="IST"
LISTITEM_RE = re.compile(r"<li([^>]*data-iata=\"[A-Z]{3}\"[^>]*)>")
LISTITEM_ATTR_RE = re.compile(r"data-(name|time|country|iata)=\"([^\"]*)\"")


@dataclass
class RouteCandidate:
    destination: str
    destination_code: str
    country: str | None = None
    duration_minutes: int | None = None
    airlines: list[str] | None = None


def cache_path(origin: str) -> Path:
    base = Path(__file__).resolve().parents[1] / ".cache" / "flightsfrom"
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{origin.upper()}.html"


def fetch_via_jina(origin: str, timeout: int = 30) -> str:
    # Direct fetch from flightsfrom.com fails with HTTP 403 / Cloudflare bot
    # challenge from datacenter egress IPs. r.jina.ai is a reader proxy that
    # accepts arbitrary URLs and returns the rendered page; with
    # X-Return-Format: html we get the full markup including data-iata.
    target = f"https://www.flightsfrom.com/{origin}/destinations"
    request = Request(
        f"https://r.jina.ai/{target}",
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
            ),
            "X-Return-Format": "html",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def load_source_html(origin: str, *, max_age_hours: int = 72) -> str:
    origin = origin.upper()
    path = cache_path(origin)
    if path.exists() and time.time() - path.stat().st_mtime < max_age_hours * 3600:
        return path.read_text(encoding="utf-8")

    try:
        raw = fetch_via_jina(origin)
    except (OSError, URLError) as error:
        if path.exists():
            return path.read_text(encoding="utf-8")
        raise RuntimeError(
            f"Could not load FlightsFrom routes for {origin}: {error}"
        )

    if "Performing security verification" in raw or "Just a moment" in raw:
        if path.exists():
            return path.read_text(encoding="utf-8")
        raise RuntimeError("FlightsFrom returned a bot-verification page")

    if not LISTITEM_RE.search(raw):
        if path.exists():
            return path.read_text(encoding="utf-8")
        raise RuntimeError("FlightsFrom response did not contain route rows")

    path.write_text(raw, encoding="utf-8")
    return raw


def parse_routes(html: str, limit: int) -> list[RouteCandidate]:
    routes: list[RouteCandidate] = []
    seen: set[str] = set()
    for match in LISTITEM_RE.finditer(html):
        attrs = {k: v for k, v in LISTITEM_ATTR_RE.findall(match.group(1))}
        iata = attrs.get("iata")
        if not iata or iata in seen:
            continue
        seen.add(iata)

        try:
            duration_minutes = int(attrs["time"]) if attrs.get("time") else None
        except ValueError:
            duration_minutes = None

        routes.append(
            RouteCandidate(
                destination=attrs.get("name") or iata,
                destination_code=iata,
                country=attrs.get("country") or None,
                duration_minutes=duration_minutes,
                airlines=None,
            )
        )
        if len(routes) >= limit:
            break
    return routes


def get_routes(origin: str, limit: int = 80) -> list[RouteCandidate]:
    return parse_routes(load_source_html(origin), limit)
