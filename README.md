# Taco Bank — Discord Login Version

Upload all files in this ZIP to the same GitHub repository.

## 1. Edit app.js
Change:
`const WORKER_URL = "https://YOUR-WORKER.workers.dev";`

to your actual Cloudflare Worker URL.

## 2. Cloudflare variables
Keep these in Cloudflare -> Worker -> Settings -> Variables and Secrets:
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET (Secret)
- FRONTEND_URL

FRONTEND_URL should be the exact origin of your GitHub Pages site, for example:
`https://YOURUSERNAME.github.io`

## 3. Discord redirect
Discord Developer Portal -> OAuth2 -> Redirects:
`https://YOUR-WORKER.workers.dev/callback`

## 4. What this version does
- Sign in with Discord
- Redirect back to Taco Bank
- Portal calls Worker `/me`
- Shows Discord display name, username, and Discord ID
- Logout button works

## IMPORTANT
Do not connect the StateCraft withdrawal API yet.
This version proves Discord identity on the portal, but the session cookie is still a test implementation and must be cryptographically signed before it protects real money.
