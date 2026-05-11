FROM mcr.microsoft.com/playwright:v1.58.0-noble

WORKDIR /app

ENV NODE_ENV=production \
    GOOGLE_FLIGHTS_UI_PORT=3000 \
    GOOGLE_FLIGHTS_PYTHON=/app/.venv/bin/python \
    GOOGLE_FLIGHTS_BROWSER_CHANNEL=chromium \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3-venv python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY experiments/google-flights-anywhere/requirements.txt /tmp/google-flights-requirements.txt
RUN python3 -m venv /app/.venv \
    && /app/.venv/bin/python -m pip install --upgrade pip \
    && /app/.venv/bin/python -m pip install --no-cache-dir -r /tmp/google-flights-requirements.txt

COPY . .

EXPOSE 3000

CMD ["node", "experiments/google-flights-anywhere/server.js"]
