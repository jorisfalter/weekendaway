from __future__ import annotations

import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


ROUTE_RE = re.compile(r"^(?:\*\s+)?(?P<name>.+?)\s+(?P<iata>[A-Z]{3})$")
AIRLINE_RE = re.compile(r"(?:Image\s+\d+:\s*)?([^\]]+)")
DURATION_RE = re.compile(r"^(?:(?P<hours>\d+)h)?\s*(?P<minutes>\d+)m$")
BLOCK_END_RE = ROUTE_RE


@dataclass
class RouteCandidate:
    destination: str
    destination_code: str
    country: str | None = None
    duration_minutes: int | None = None
    airlines: list[str] | None = None


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "img":
            attrs_dict = dict(attrs)
            alt = attrs_dict.get("alt")
            if alt:
                self.parts.append(f"[{alt}]")


def parse_duration(raw: str) -> int | None:
    match = DURATION_RE.match(raw.strip())
    if not match:
        return None
    return int(match.group("hours") or 0) * 60 + int(match.group("minutes") or 0)


def cache_path(origin: str) -> Path:
    base = Path(__file__).resolve().parents[1] / ".cache" / "flightsfrom"
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{origin.upper()}.txt"


def fetch_url(url: str, timeout: int = 30) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
            )
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def load_source_text(origin: str, *, max_age_hours: int = 72) -> str:
    origin = origin.upper()
    path = cache_path(origin)
    if path.exists() and time.time() - path.stat().st_mtime < max_age_hours * 3600:
        return path.read_text(encoding="utf-8")

    urls = [
        f"https://www.flightsfrom.com/{origin}/destinations",
        f"https://r.jina.ai/http://r.jina.ai/http://https://www.flightsfrom.com/{origin}/destinations",
    ]
    last_error = None
    for url in urls:
        try:
            raw = fetch_url(url)
        except (OSError, URLError) as error:
            last_error = error
            continue
        if "Performing security verification" in raw or "Just a moment" in raw:
            last_error = RuntimeError("FlightsFrom returned a bot-verification page")
            continue
        text = html_to_text(raw)
        if ROUTE_RE.search(text):
            path.write_text(text, encoding="utf-8")
            return text
        last_error = RuntimeError("FlightsFrom response did not contain route rows")

    if path.exists():
        return path.read_text(encoding="utf-8")
    raise RuntimeError(f"Could not load FlightsFrom routes for {origin}: {last_error}")


def html_to_text(raw: str) -> str:
    if raw.lstrip().startswith("<"):
        parser = TextExtractor()
        parser.feed(raw)
        return "\n".join(parser.parts)
    return raw


def parse_routes(text: str, limit: int) -> list[RouteCandidate]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    routes: list[RouteCandidate] = []
    index = 0
    while index < len(lines):
        match = ROUTE_RE.match(lines[index])
        if not match:
            index += 1
            continue

        destination = match.group("name").strip()
        destination_code = match.group("iata")
        country = None
        duration_minutes = None
        airlines: list[str] = []
        index += 1

        while index < len(lines) and not BLOCK_END_RE.match(lines[index]):
            line = lines[index]
            if country is None and not line.startswith("![") and not line.startswith("Flight time"):
                if not DURATION_RE.match(line) and not line.startswith("Next flight"):
                    country = line
            if duration_minutes is None:
                duration_minutes = parse_duration(line)
            airline_match = None
            if line.startswith("![") and "](" in line:
                airline_match = re.search(r"Image\s+\d+:\s*([^\]]+)", line)
            elif line.startswith("[") and line.endswith("]"):
                airline_match = AIRLINE_RE.search(line[1:-1])
            if airline_match:
                airline = airline_match.group(1).strip()
                if airline and airline not in airlines:
                    airlines.append(airline)
            index += 1

        routes.append(
            RouteCandidate(
                destination=destination,
                destination_code=destination_code,
                country=country,
                duration_minutes=duration_minutes,
                airlines=airlines or None,
            )
        )
        if len(routes) >= limit:
            break

    return routes


def get_routes(origin: str, limit: int = 80) -> list[RouteCandidate]:
    return parse_routes(load_source_text(origin), limit)
