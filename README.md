# Taco Watch — GitHub Pages + API-only Worker

This package intentionally does NOT configure Cloudflare Static Assets.

## GitHub Pages serves
- index.html
- styles.css
- app.js

## Cloudflare Worker runs
- worker.js

The Wrangler config contains only:
- Worker name
- worker.js entry point
- compatibility date
- keep_vars

There is NO `assets` field.

Worker:
https://young-lab-523e.fusepointjoe.workers.dev

Frontend:
https://tacobellmedia.github.io/taco-watch/

## Cloudflare secrets / variables
- TREASURY_API_KEY (Secret)
- TREASURY_ACCOUNT_ID
- NOTE_MARKER
- NOTE_FACE_VALUE
- NOTE_SHOP_PRICE

Optional:
- TREASURY_PAGE_LIMIT
- TREASURY_PAGES

If Cloudflare still labels an existing deployment as Static Assets, check the
Cloudflare project's Build/Deploy settings: this repository config itself does
not enable Static Assets.
