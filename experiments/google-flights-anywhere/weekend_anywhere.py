#!/usr/bin/env python3
"""Google Flights Explore proof of concept for destination-indifferent trips."""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import re
import sys
from dataclasses import asdict, dataclass, replace
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable
from urllib.parse import quote

from google_flights import (
    FlightData,
    Passengers,
    create_filter,
    get_one_way_options,
    get_round_trip_options,
    search_airport,
)
from playwright.sync_api import Page, TimeoutError, sync_playwright

# Bridge the Playwright consent flow to the google_flights HTTP client.
# Why: from an EU datacenter IP, every plain HTTP call to google.com/travel/flights
# is redirected to consent.google.com, which the upstream library cannot parse —
# so every detail lookup fails. Playwright already handles the consent screen for
# the Explore page; we harvest the resulting Google cookies and inject them into
# the primp client used by google_flights for the detail fetches.
import google_flights.main as _gf_main  # noqa: E402

GF_HTTP_COOKIES: dict[str, str] = {"CONSENT": "PENDING+999"}


def update_google_http_cookies(playwright_cookies):
    for cookie in playwright_cookies:
        domain = cookie.get("domain", "")
        if "google.com" in domain:
            GF_HTTP_COOKIES[cookie["name"]] = cookie["value"]


def _build_patched_fetch(url: str):
    def _patched(params):
        from primp import Client as _Client
        client = _Client(impersonate="chrome_126", verify=False)
        res = client.get(url, params=params, cookies=dict(GF_HTTP_COOKIES))
        return res if res.status_code == 200 else None
    return _patched


_gf_main.fetch_search = _build_patched_fetch("https://www.google.com/travel/flights")
_gf_main.fetch_booking = _build_patched_fetch("https://www.google.com/travel/flights/booking")

from route_sources.flightsfrom import get_routes


PRICE_RE = re.compile(r"^([€$£])\s?([\d.,]+)$")
STOPS_RE = re.compile(r"^(Non-stop|[0-9]+ stops?|[0-9]+ stop)$", re.IGNORECASE)
DURATION_RE = re.compile(r"^(?:(\d+)\s*hrs?)?(?:\s*(\d+)\s*min)?$")
DISTANCE_RE = re.compile(r"^\d+(?:\.\d+)?h$")
FOOTER_MARKERS = {
    "About",
    "Privacy",
    "Terms",
    "Explore nearby",
    "Keyboard shortcuts",
}
CURRENCY_BY_SYMBOL = {"€": "EUR", "$": "USD", "£": "GBP"}
CITY_AIRPORT_GROUPS = {
    "LONDON": ["LHR", "LGW", "STN", "LTN", "LCY", "SEN"],
    "LON": ["LHR", "LGW", "STN", "LTN", "LCY", "SEN"],
    "MILAN": ["MXP", "LIN", "BGY"],
    "MIL": ["MXP", "LIN", "BGY"],
    "PARIS": ["CDG", "ORY", "BVA"],
    "PAR": ["CDG", "ORY", "BVA"],
    "ROME": ["FCO", "CIA"],
    "ROM": ["FCO", "CIA"],
    "BRUSSELS": ["BRU", "CRL"],
    "BRU": ["BRU", "CRL"],
    "STOCKHOLM": ["ARN", "BMA", "NYO", "VST"],
    "STO": ["ARN", "BMA", "NYO", "VST"],
    "OSLO": ["OSL", "TRF"],
    "OSL": ["OSL", "TRF"],
    "WARSAW": ["WAW", "WMI"],
    "WAW": ["WAW", "WMI"],
    "VENICE": ["VCE", "TSF"],
    "VEN": ["VCE", "TSF"],
    "BARCELONA": ["BCN", "GRO", "REU"],
    "BCN": ["BCN", "GRO", "REU"],
}


def emit_progress(enabled: bool, message: str) -> None:
    if enabled:
        print(f"PROGRESS:{message}", file=sys.stderr, flush=True)


def emit_result(enabled: bool, result: "ExploreResult") -> None:
    if enabled:
        print(
            f"RESULT:{json.dumps(asdict(result), ensure_ascii=False)}",
            file=sys.stderr,
            flush=True,
        )


@dataclass
class ExploreResult:
    source_order: int
    destination: str
    price: float
    currency: str
    stops: str | None
    duration_minutes: int | None
    option_number: int | None = None
    destination_code: str | None = None
    destination_airport_code: str | None = None
    destination_airport_name: str | None = None
    return_airport_code: str | None = None
    return_airport_name: str | None = None
    detail_price: float | None = None
    detail_stops: str | None = None
    outbound_duration_minutes: int | None = None
    return_duration_minutes: int | None = None
    outbound_airlines: list[str] | None = None
    return_airlines: list[str] | None = None
    airline_codes: list[str] | None = None
    outbound_departure_time: str | None = None
    outbound_arrival_time: str | None = None
    return_departure_time: str | None = None
    return_arrival_time: str | None = None
    booking_url: str | None = None
    return_booking_url: str | None = None
    detail_error: str | None = None


def next_weekend(today: date | None = None) -> tuple[str, str]:
    today = today or date.today()
    days_until_friday = (4 - today.weekday()) % 7
    if days_until_friday == 0:
        days_until_friday = 7
    friday = today + timedelta(days=days_until_friday)
    sunday = friday + timedelta(days=2)
    return friday.isoformat(), sunday.isoformat()


def build_explore_url(
    *,
    origin: str,
    departure_date: str,
    return_date: str | None,
    currency: str,
    language: str,
    max_stops: int | None,
) -> str:
    if return_date:
        flight_data = [
            FlightData(date=departure_date, from_airport=[origin], to_airport=[]),
            FlightData(date=return_date, from_airport=[], to_airport=[origin]),
        ]
        trip = "round-trip"
    else:
        flight_data = [
            FlightData(date=departure_date, from_airport=[origin], to_airport=[]),
        ]
        trip = "one-way"

    tfs_filter = create_filter(
        flight_data=flight_data,
        trip=trip,
        passengers=Passengers(adults=1),
        seat="economy",
        max_stops=max_stops,
    )
    tfs = quote(tfs_filter.as_b64().decode("utf-8"))
    return (
        f"https://www.google.com/travel/explore?tfs={tfs}"
        f"&hl={language}&curr={currency}"
    )


def accept_google_consent(page: Page) -> None:
    if "consent.google.com" not in page.url:
        return

    for label in ("Reject all", "Accept all"):
        try:
            page.get_by_role("button", name=label).click(timeout=10_000)
            page.wait_for_load_state("domcontentloaded", timeout=45_000)
            return
        except TimeoutError:
            continue


def body_lines(page: Page, wait_ms: int) -> list[str]:
    page.wait_for_timeout(wait_ms)
    text = page.locator("body").inner_text(timeout=15_000)
    return [line.strip() for line in text.splitlines() if line.strip()]


def parse_price(raw: str) -> tuple[float, str] | None:
    match = PRICE_RE.match(raw)
    if not match:
        return None
    symbol, amount = match.groups()
    normalized = amount.replace(".", "").replace(",", ".")
    return float(normalized), CURRENCY_BY_SYMBOL.get(symbol, symbol)


def parse_duration(raw: str) -> int | None:
    match = DURATION_RE.match(raw)
    if not match or not any(match.groups()):
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    return hours * 60 + minutes


def parse_time_filter(raw: str | None) -> int | None:
    if not raw:
        return None
    match = re.match(r"^(\d{1,2}):(\d{2})$", raw)
    if not match:
        return None
    hours, minutes = int(match.group(1)), int(match.group(2))
    if hours > 23 or minutes > 59:
        return None
    return hours * 60 + minutes


def effective_price(result: ExploreResult) -> float:
    return result.detail_price if result.detail_price is not None else result.price


def within_max_price(result: ExploreResult, max_price: float | None) -> bool:
    return not max_price or effective_price(result) <= max_price


def date_tuple_to_iso(raw: list[int] | tuple[int, ...] | None) -> str | None:
    if not raw or len(raw) < 3:
        return None
    year, month, day = raw[:3]
    if year is None or month is None or day is None:
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def format_time(raw: list[int] | tuple[int, ...] | None) -> str | None:
    if not raw:
        return None
    hours = raw[0]
    minutes = raw[1] if len(raw) > 1 else 0
    if hours is None:
        return None
    if minutes is None:
        minutes = 0
    return f"{hours:02d}:{minutes:02d}"


def minutes_from_time(raw: list[int] | tuple[int, ...] | None) -> int | None:
    if not raw:
        return None
    hours = raw[0]
    minutes = raw[1] if len(raw) > 1 else 0
    if hours is None:
        return None
    if minutes is None:
        minutes = 0
    return hours * 60 + minutes


def airline_names(itinerary) -> list[str]:
    names: list[str] = []
    for flight in itinerary.flights or []:
        name = flight.airline_name or flight.airline
        if name and name not in names:
            names.append(name)
    return names


def airline_codes(itinerary) -> list[str]:
    codes: list[str] = []
    for flight in itinerary.flights or []:
        code = flight.airline
        if code and code not in codes:
            codes.append(code)
    return codes


def is_noise_line(raw: str) -> bool:
    return bool(
        parse_price(raw)
        or STOPS_RE.match(raw)
        or parse_duration(raw)
        or DISTANCE_RE.match(raw)
    )


def extract_results(lines: Iterable[str], limit: int, sort: str) -> list[ExploreResult]:
    results: list[ExploreResult] = []
    lines = list(lines)

    try:
        start = lines.index("About these results") + 1
    except ValueError:
        start = 0

    index = start
    while index < len(lines) - 1:
        current = lines[index]
        if current in FOOTER_MARKERS:
            break

        if is_noise_line(current):
            index += 1
            continue

        price_info = parse_price(lines[index + 1])
        if not price_info:
            index += 1
            continue

        destination = current
        price, currency = price_info
        stops = None
        duration_minutes = None
        duration_index = None

        lookahead = list(enumerate(lines[index + 2 : index + 7], start=index + 2))
        for item_index, item in lookahead:
            if stops is None and STOPS_RE.match(item):
                stops = item
                continue
            if duration_minutes is None:
                duration_minutes = parse_duration(item)
                if duration_minutes is not None:
                    duration_index = item_index

        results.append(
            ExploreResult(
                source_order=len(results) + 1,
                destination=destination,
                price=price,
                currency=currency,
                stops=stops,
                duration_minutes=duration_minutes,
            )
        )

        if duration_index is None:
            index += 2
        else:
            index = duration_index + 1
            if index < len(lines) and DISTANCE_RE.match(lines[index]):
                index += 1
            if index < len(lines) and parse_price(lines[index]):
                index += 1

    if sort == "price":
        results.sort(key=lambda result: (result.price, result.source_order))
    elif sort == "duration":
        results.sort(
            key=lambda result: (
                result.duration_minutes
                if result.duration_minutes is not None
                else 10_000_000,
                result.price,
            )
        )

    return results[:limit]


def resolve_destination_codes(destination: str) -> list[str]:
    destination_key = destination.upper()
    if destination_key in CITY_AIRPORT_GROUPS:
        return CITY_AIRPORT_GROUPS[destination_key]

    try:
        codes = search_airport(destination) or []
    except Exception:
        return []

    seen: set[str] = set()
    clean_codes: list[str] = []
    for code in codes:
        if not re.match(r"^[A-Z]{3}$", code):
            continue
        if code in seen:
            continue
        seen.add(code)
        if code in CITY_AIRPORT_GROUPS:
            for group_code in CITY_AIRPORT_GROUPS[code]:
                if group_code not in seen:
                    seen.add(group_code)
                    clean_codes.append(group_code)
            continue
        clean_codes.append(code)
    return clean_codes[:8]


def result_destination_codes(result: ExploreResult) -> list[str]:
    if result.destination_code and re.match(
        r"^[A-Z]{3}(?:/[A-Z]{3})*$", result.destination_code
    ):
        return result.destination_code.split("/")
    return resolve_destination_codes(result.destination)


def uses_city_airport_group(destination: str, codes: list[str]) -> bool:
    destination_key = destination.upper()
    if destination_key in CITY_AIRPORT_GROUPS:
        return True
    return any(code in CITY_AIRPORT_GROUPS for code in codes)


def option_passes_time_filters(
    option: dict,
    *,
    departure_date: str,
    return_date: str,
    max_stops: int | None,
    outbound_after: int | None,
    outbound_before: int | None,
    return_after: int | None,
    return_before: int | None,
) -> bool:
    outbound = option["outbound"]
    return_flight = option["return"]
    outbound_departure = minutes_from_time(outbound.departure_time)
    return_arrival = minutes_from_time(return_flight.arrival_time)
    outbound_stops = len(outbound.layovers or [])
    return_stops = len(return_flight.layovers or [])
    outbound_departure_date = date_tuple_to_iso(outbound.departure_date)
    return_departure_date = date_tuple_to_iso(return_flight.departure_date)
    return_arrival_date = date_tuple_to_iso(return_flight.arrival_date)

    if outbound_departure_date != departure_date:
        return False
    if return_departure_date != return_date:
        return False
    if return_arrival_date != return_date:
        return False
    if max_stops is not None and (
        outbound_stops > max_stops or return_stops > max_stops
    ):
        return False

    if outbound_after is not None and (
        outbound_departure is None or outbound_departure < outbound_after
    ):
        return False
    if outbound_before is not None and (
        outbound_departure is None or outbound_departure > outbound_before
    ):
        return False
    if return_after is not None and (
        return_arrival is None or return_arrival < return_after
    ):
        return False
    if return_before is not None and (
        return_arrival is None or return_arrival > return_before
    ):
        return False
    return True


def option_total_price(option: dict) -> float:
    if option.get("price") is not None:
        return option["price"]
    return option["outbound"].itinerary_summary.price or 10_000_000


def enrich_result_with_details(
    result: ExploreResult,
    *,
    origin: str,
    departure_date: str,
    return_date: str,
    currency: str,
    language: str,
    max_stops: int | None,
    outbound_after: int | None,
    outbound_before: int | None,
    return_after: int | None,
    return_before: int | None,
    options_per_destination: int,
) -> list[ExploreResult]:
    codes = result_destination_codes(result)
    if not codes:
        result.detail_error = "No airport code found"
        return []

    last_error = "No matching detail itinerary"
    grouped_search = uses_city_airport_group(result.destination, codes)
    result.destination_code = "/".join(codes) if grouped_search else codes[0]

    matching_options: list[dict] = []
    searched_pairs: set[tuple[tuple[str, ...], tuple[str, ...]]] = set()

    def collect_matching_options(
        outbound_codes: list[str], return_codes: list[str]
    ) -> None:
        nonlocal last_error
        pair_key = (tuple(outbound_codes), tuple(return_codes))
        if pair_key in searched_pairs:
            return
        searched_pairs.add(pair_key)

        detail_filter = create_filter(
            flight_data=[
                FlightData(
                    date=departure_date,
                    from_airport=[origin],
                    to_airport=outbound_codes,
                ),
                FlightData(
                    date=return_date,
                    from_airport=return_codes,
                    to_airport=[origin],
                ),
            ],
            trip="round-trip",
            passengers=Passengers(adults=1),
            seat="economy",
            max_stops=max_stops,
        )

        try:
            with contextlib.redirect_stdout(io.StringIO()):
                options = get_round_trip_options(
                    detail_filter,
                    currency=currency,
                    language=language,
                )
        except Exception as error:
            last_error = str(error)
            return

        matching_options.extend(
            option
            for option in options
            if option_passes_time_filters(
                option,
                departure_date=departure_date,
                return_date=return_date,
                max_stops=max_stops,
                outbound_after=outbound_after,
                outbound_before=outbound_before,
                return_after=return_after,
                return_before=return_before,
            )
        )

    def collect_one_way_mixed_options(pair_codes: list[str]) -> None:
        one_way_options: dict[tuple[str, str], list[dict]] = {}

        def get_one_way(origin_code: str, destination_code: str, flight_date: str) -> list[dict]:
            key = (origin_code, destination_code)
            if key in one_way_options:
                return one_way_options[key]

            one_way_filter = create_filter(
                flight_data=[
                    FlightData(
                        date=flight_date,
                        from_airport=[origin_code],
                        to_airport=[destination_code],
                    )
                ],
                trip="one-way",
                passengers=Passengers(adults=1),
                seat="economy",
                max_stops=max_stops,
            )
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    raw_options = get_one_way_options(
                        one_way_filter,
                        currency=currency,
                        language=language,
                    )
            except Exception:
                raw_options = []

            one_way_options[key] = raw_options[:4]
            return one_way_options[key]

        for outbound_code in pair_codes:
            outbound_options = get_one_way(origin, outbound_code, departure_date)
            for return_code in pair_codes:
                if outbound_code == return_code:
                    continue
                return_options = get_one_way(return_code, origin, return_date)
                for outbound_option in outbound_options:
                    for return_option in return_options:
                        outbound = outbound_option["flight"]
                        return_flight = return_option["flight"]
                        outbound_price = outbound.itinerary_summary.price
                        return_price = return_flight.itinerary_summary.price
                        if outbound_price is None or return_price is None:
                            continue
                        combined = {
                            "outbound": outbound,
                            "return": return_flight,
                            "price": outbound_price + return_price,
                            "url": outbound_option.get("url"),
                            "return_url": return_option.get("url"),
                            "mixed_airports": True,
                        }
                        if option_passes_time_filters(
                            combined,
                            departure_date=departure_date,
                            return_date=return_date,
                            max_stops=max_stops,
                            outbound_after=outbound_after,
                            outbound_before=outbound_before,
                            return_after=return_after,
                            return_before=return_before,
                        ):
                            matching_options.append(combined)

    if grouped_search:
        collect_matching_options(codes, codes)
        seen_group_airports = sorted(
            {
                option["outbound"].arrival_airport
                for option in matching_options
                if option["outbound"].arrival_airport in codes
            }
            | {
                option["return"].departure_airport
                for option in matching_options
                if option["return"].departure_airport in codes
            }
        )
        pair_codes = [
            code
            for code in [*seen_group_airports, *codes]
            if code in codes
        ]
        pair_codes = list(dict.fromkeys(pair_codes))[:6]
        collect_one_way_mixed_options(pair_codes)
    else:
        for code in codes[:4]:
            collect_matching_options([code], [code])

    if not matching_options:
        result.detail_error = last_error
        return []

    matching_options.sort(
        key=lambda option: (
            option_total_price(option),
            minutes_from_time(option["outbound"].departure_time) or 10_000_000,
        )
    )

    detailed_results: list[ExploreResult] = []
    seen_options: set[tuple] = set()
    for selected in matching_options:
        outbound = selected["outbound"]
        return_flight = selected["return"]
        unique_key = (
            outbound.arrival_airport,
            return_flight.departure_airport,
            format_time(outbound.departure_time),
            format_time(return_flight.departure_time),
            option_total_price(selected),
        )
        if unique_key in seen_options:
            continue
        seen_options.add(unique_key)

        option_result = replace(result, option_number=len(detailed_results) + 1)
        max_leg_stops = max(len(outbound.layovers or []), len(return_flight.layovers or []))
        option_result.detail_price = option_total_price(selected)
        option_result.currency = outbound.itinerary_summary.currency or option_result.currency
        option_result.detail_stops = (
            "Non-stop"
            if max_leg_stops == 0
            else f"{max_leg_stops} stop" if max_leg_stops == 1 else f"{max_leg_stops} stops"
        )
        option_result.outbound_duration_minutes = outbound.travel_time
        option_result.return_duration_minutes = return_flight.travel_time
        option_result.outbound_airlines = airline_names(outbound)
        option_result.return_airlines = airline_names(return_flight)
        option_result.airline_codes = sorted(
            set(airline_codes(outbound) + airline_codes(return_flight))
        )
        option_result.destination_airport_code = outbound.arrival_airport
        option_result.destination_airport_name = (
            outbound.flights[-1].arrival_airport_name if outbound.flights else None
        )
        option_result.return_airport_code = return_flight.departure_airport
        option_result.return_airport_name = (
            return_flight.flights[0].departure_airport_name
            if return_flight.flights
            else None
        )
        option_result.outbound_departure_time = format_time(outbound.departure_time)
        option_result.outbound_arrival_time = format_time(outbound.arrival_time)
        option_result.return_departure_time = format_time(return_flight.departure_time)
        option_result.return_arrival_time = format_time(return_flight.arrival_time)
        option_result.booking_url = selected.get("url")
        option_result.return_booking_url = selected.get("return_url")
        option_result.detail_error = None
        detailed_results.append(option_result)
        if len(detailed_results) >= options_per_destination:
            break

    return detailed_results


def enrich_results_with_details(
    results: list[ExploreResult],
    args: argparse.Namespace,
    *,
    departure_date: str,
    return_date: str,
) -> list[ExploreResult]:
    outbound_after = parse_time_filter(args.outbound_after)
    outbound_before = parse_time_filter(args.outbound_before)
    return_after = parse_time_filter(args.return_after)
    return_before = parse_time_filter(args.return_before)

    enriched: list[ExploreResult] = []
    candidates = results[: args.detail_limit]
    for index, result in enumerate(candidates, start=1):
        emit_progress(
            args.progress,
            f"Checking {result.destination} details ({index}/{len(candidates)})",
        )
        detailed_results = enrich_result_with_details(
            result,
            origin=args.origin,
            departure_date=departure_date,
            return_date=return_date,
            currency=args.currency,
            language=args.language,
            max_stops=args.max_stops,
            outbound_after=outbound_after,
            outbound_before=outbound_before,
            return_after=return_after,
            return_before=return_before,
            options_per_destination=args.options_per_destination,
        )
        if detailed_results:
            for detailed in detailed_results:
                if not within_max_price(detailed, args.max_price):
                    continue
                enriched.append(detailed)
                emit_result(args.stream_results, detailed)
            emit_progress(
                args.progress,
                f"Found {len(detailed_results)} option(s) for {result.destination}",
            )
        else:
            emit_progress(args.progress, f"Skipped {result.destination}")

    return enriched


def known_detail_keys(results: list[ExploreResult]) -> set[str]:
    keys: set[str] = set()
    for result in results:
        for code in (
            result.destination_airport_code,
            result.return_airport_code,
            result.destination_code,
        ):
            if code:
                keys.update(code.split("/"))
        keys.add(result.destination.upper())
    return keys


def load_route_source_candidates(
    args: argparse.Namespace,
    *,
    existing_results: list[ExploreResult],
) -> list[ExploreResult]:
    if args.route_source != "flightsfrom":
        return []

    try:
        routes = get_routes(args.origin, limit=args.route_source_limit)
    except Exception as error:
        emit_progress(args.progress, f"FlightsFrom fallback unavailable: {error}")
        return []

    seen = known_detail_keys(existing_results)
    candidates: list[ExploreResult] = []
    for route in routes:
        if route.destination_code in seen or route.destination.upper() in seen:
            continue
        candidates.append(
            ExploreResult(
                source_order=10_000 + len(candidates) + 1,
                destination=route.destination,
                price=10_000_000,
                currency=args.currency,
                stops="Non-stop",
                duration_minutes=route.duration_minutes,
                destination_code=route.destination_code,
                outbound_airlines=route.airlines,
                return_airlines=route.airlines,
            )
        )
        seen.add(route.destination_code)
        seen.add(route.destination.upper())

    emit_progress(
        args.progress,
        f"FlightsFrom added {len(candidates)} route candidate(s)",
    )
    return candidates


def run(args: argparse.Namespace) -> dict:
    departure_date = args.departure_date
    return_date = args.return_date
    if not departure_date:
        departure_date, default_return = next_weekend()
        return_date = return_date or default_return

    url = build_explore_url(
        origin=args.origin,
        departure_date=departure_date,
        return_date=return_date,
        currency=args.currency,
        language=args.language,
        max_stops=args.max_stops,
    )

    emit_progress(args.progress, "Opening Google Travel Explore")
    with sync_playwright() as playwright:
        launch_options = {"headless": not args.headful}
        if args.browser_channel != "chromium":
            launch_options["channel"] = args.browser_channel
        browser = playwright.chromium.launch(**launch_options)
        page = browser.new_page(
            viewport={"width": args.width, "height": args.height},
            locale=args.language,
        )
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        accept_google_consent(page)
        update_google_http_cookies(page.context.cookies())
        emit_progress(args.progress, "Waiting for Explore results")
        lines = body_lines(page, args.wait_ms)

        screenshot_path = None
        if args.screenshot:
            screenshot_path = str(Path(args.screenshot).resolve())
            page.screenshot(path=screenshot_path, full_page=True)

        final_url = page.url
        title = page.title()
        browser.close()

    explore_limit = args.limit
    if args.include_details:
        explore_limit = max(args.limit, args.detail_limit * 3)
    results = extract_results(lines, explore_limit, args.sort)
    results = [result for result in results if within_max_price(result, args.max_price)]
    emit_progress(args.progress, f"Explore returned {len(results)} destinations")

    if args.include_details and return_date:
        emit_progress(args.progress, "Looking up exact flight times")
        enriched_results = enrich_results_with_details(
            results,
            args,
            departure_date=departure_date,
            return_date=return_date,
        )
        if len(enriched_results) < args.limit and args.route_source != "none":
            remaining = args.limit - len(enriched_results)
            emit_progress(
                args.progress,
                f"Trying {args.route_source} fallback for {remaining} more option(s)",
            )
            route_candidates = load_route_source_candidates(
                args,
                existing_results=enriched_results,
            )
            if route_candidates:
                fallback_args = argparse.Namespace(**vars(args))
                fallback_args.detail_limit = min(len(route_candidates), args.route_source_detail_limit)
                fallback_args.options_per_destination = 1
                fallback_results = enrich_results_with_details(
                    route_candidates,
                    fallback_args,
                    departure_date=departure_date,
                    return_date=return_date,
                )
                enriched_results.extend(fallback_results)
        results = sorted(
            [
                result
                for result in enriched_results
                if within_max_price(result, args.max_price)
            ],
            key=lambda result: (
                effective_price(result),
                result.source_order,
            ),
        )[: args.limit]
        emit_progress(args.progress, f"Finished details for {len(results)} destinations")

    return {
        "provider": "google-travel-explore-unofficial",
        "origin": args.origin,
        "departure_date": departure_date,
        "return_date": return_date,
        "currency": args.currency,
        "language": args.language,
        "max_stops": args.max_stops,
        "max_price": args.max_price,
        "sort": args.sort,
        "include_details": args.include_details,
        "detail_limit": args.detail_limit,
        "options_per_destination": args.options_per_destination,
        "route_source": args.route_source,
        "outbound_after": args.outbound_after,
        "outbound_before": args.outbound_before,
        "return_after": args.return_after,
        "return_before": args.return_before,
        "url": final_url,
        "title": title,
        "screenshot": screenshot_path,
        "result_count": len(results),
        "results": [asdict(result) for result in results],
    }


def parser() -> argparse.ArgumentParser:
    default_departure, default_return = next_weekend()
    p = argparse.ArgumentParser(
        description="Find destination-indifferent Google Flights Explore results."
    )
    p.add_argument("--origin", default="AMS", help="Origin airport IATA code.")
    p.add_argument("--departure-date", default=default_departure)
    p.add_argument("--return-date", default=default_return)
    p.add_argument("--currency", default="EUR")
    p.add_argument("--language", default="en-GB")
    p.add_argument("--max-stops", type=int, default=0)
    p.add_argument("--max-price", type=float, default=0)
    p.add_argument("--limit", type=int, default=50)
    p.add_argument("--sort", choices=["price", "duration", "page"], default="price")
    p.add_argument("--include-details", action="store_true")
    p.add_argument("--detail-limit", type=int, default=50)
    p.add_argument("--options-per-destination", type=int, default=5)
    p.add_argument("--route-source", choices=["none", "flightsfrom"], default="none")
    p.add_argument("--route-source-limit", type=int, default=80)
    p.add_argument("--route-source-detail-limit", type=int, default=16)
    p.add_argument("--outbound-after")
    p.add_argument("--outbound-before")
    p.add_argument("--return-after")
    p.add_argument("--return-before")
    p.add_argument("--wait-ms", type=int, default=18_000)
    p.add_argument("--width", type=int, default=1440)
    p.add_argument("--height", type=int, default=1000)
    p.add_argument("--browser-channel", default="chrome")
    p.add_argument("--headful", action="store_true")
    p.add_argument("--screenshot")
    p.add_argument("--output")
    p.add_argument("--progress", action="store_true")
    p.add_argument("--stream-results", action="store_true")
    return p


def main() -> None:
    args = parser().parse_args()
    payload = run(args)
    output = json.dumps(payload, indent=2, ensure_ascii=False)

    if args.output:
        path = Path(args.output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(output + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
