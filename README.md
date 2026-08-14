# Taco Bank Discord Portal v2

This version fixes the GitHub Pages / Cloudflare cross-site-cookie problem by using
a signed, short-lived session token instead.

## Before upload

Open `app.js` and replace:

`https://taco-bank.fusepointjoe.workers.dev`

with your real Cloudflare Worker URL.

## Cloudflare Variables & Secrets

Set these on the `tacobank` Worker:

- `DISCORD_CLIENT_ID` — regular variable
- `DISCORD_CLIENT_SECRET` — Secret
- `FRONTEND_URL` — your full GitHub Pages site URL, such as `https://name.github.io/taco-bank`
- `SESSION_SECRET` — Secret; use a long random value

Keep `STATECRAFT_API_KEY` private for later. It is not used by this version.

## Discord OAuth redirect

Your Discord OAuth2 Redirect must be exactly:

`https://taco-bank.fusepointjoe.workers.dev/callback`

## New main-menu page

The navigation now contains `SIGN IN`, linking to `signin.html`.

## Login flow

1. User opens SIGN IN.
2. User signs in through Discord.
3. Worker validates Discord.
4. Worker creates an HMAC-signed 24-hour Taco Bank session.
5. Discord callback redirects to the portal with the token in the URL fragment.
6. `app.js` immediately stores it in localStorage and removes it from the visible URL.
7. Portal calls `/me` with `Authorization: Bearer ...`.
8. Discord identity appears in the bank portal.

Do not connect real StateCraft withdrawals until account linking and transaction
storage are implemented.
