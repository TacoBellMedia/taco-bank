# Taco Bank Discord Worker

Upload these files to the GitHub repository connected to your Cloudflare Worker.

In Cloudflare Variables and Secrets add:
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET (Secret)
- FRONTEND_URL

In Discord Developer Portal -> OAuth2 -> Redirects add:
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/callback

Then test:
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/login

IMPORTANT: This is the Discord-login test stage only. Do not connect real StateCraft withdrawals yet; the login session must be hardened first.
