# Flights for Flaneurs Design Direction

## Reference

Primary inspiration: https://hotelist.com/

What works well there:

- The product opens as the actual tool, not a landing page.
- Map and list feel equally important.
- Filters are dense, direct, and always available.
- The visual language is opinionated: compact controls, bold contrast, playful utility.
- It feels personal and weird in a good way, not like a generic travel booking funnel.
- The copy has a point of view: it tells you why the product exists without becoming marketing fluff.

## Our Translation

Flights for Flaneurs should feel like an escape board for people who care more about the time window and price than the destination.

Core product feeling:

- Fast, curious, slightly impulsive.
- Built for "where can I disappear this weekend?"
- Useful first, charming second.
- Dense enough for repeated searching, but less corporate than a dashboard.
- The map is not decoration; it is part of scanning the possibility space.

## Visual Rules

- Keep the app as the first screen. No marketing hero before the tool.
- Use a left filter rail and right results/map surface.
- Prefer bold outlines, compact fields, high-contrast buttons, and visible state.
- Cards are for destination results only.
- Use strong but varied accents: warm orange, green, blue, cream, black.
- Avoid generic SaaS gradients, soft purple UI, and anonymous travel-stock vibes.
- Results should read like collectible escape tickets: city, price, times, airport, airline.
- Loading states should feel alive but still tell the truth.

## Product Copy

Tone:

- Short.
- Wry.
- Active.
- No fake luxury language.

Good:

- "The weekend escape board"
- "Pick a window, then disappear."
- "Scanning the cheap edge of the map..."
- "No clean escape found."

Avoid:

- "Discover amazing destinations"
- "Seamless travel planning"
- "Unlock your next adventure"
- Generic OTA wording.

## Deployment North Star

The public version should be honest about being experimental:

- It uses unofficial data sources.
- Prices and availability must be verified before booking.
- Route fallbacks can be incomplete or blocked.
- The value is exploration and filtering, not final ticketing.

Next product milestones before public deployment:

- A stable public name and URL.
- A deploy target with a persistent Python/Node runtime.
- Rate limiting and timeouts for external sources.
- A clear data-source note in the UI.
- Basic logging for failed searches.
- A small cache for route-source lookups.
