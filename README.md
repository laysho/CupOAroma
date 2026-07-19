# Cup O'Aroma ☕

A pastel-themed coffee & pastries web app: a vanilla HTML/CSS/JS frontend with a
zero-dependency Node backend (menu + orders API).

## Pages
- `index.html` — **Landing / sign-in gate.** The first thing every visitor sees:
  the logo, the name, and a choice to continue with **Google**, **Facebook**, or as
  a **Guest**. Styling matches the shop (same pastel palette, same dark mode).
- `shop.html` — the coffee + pastries store (menu, cart, checkout, receipt).
- `fullmenu.html` — every item on the menu.

`shop.html` / `fullmenu.html` are **gated**: if you open them without signing in on
the landing page, they redirect back to `index.html`. Sign-in is tracked in
`sessionStorage` (`cupGate` = `open`) for the browsing session.

## Sign-in — demo vs. real OAuth
The landing works **today with no setup** (demo mode): clicking Google / Facebook /
Guest stores a simulated session (name shown in the shop navbar) and enters the shop,
so the whole flow is clickable and the rest of the site functions end-to-end. A
**Sign out** button in the shop navbar clears the session and returns to the landing.

To switch to **real Google/Facebook OAuth**, open `frontend/landing.js` and fill in
either or both of:
```js
const COA_AUTH = {
  googleClientId: '',   // Google Cloud Console → OAuth 2.0 Client ID (Web)
  facebookAppId: '',    // Facebook Developers → App ID
};
```
Each button goes live independently as soon as its ID is present (per-provider real
detection). In real mode the button performs an OAuth redirect (Implicit flow,
`access_token` returned in the URL hash); the landing then fetches the account's
name/email and drops you into the shop. Redirect URIs to allow:
- Google: `https://cup-o-aroma.vercel.app/` (and `http://localhost:8000/` for local)
- Facebook: same origins under "Valid OAuth Redirect URIs"

Set up:
- Google: https://console.cloud.google.com/apis/credentials (scope `email profile`)
- Facebook: https://developers.facebook.com/apps → add "Facebook Login" (Web)
  (permissions `email`, `public_profile`)

## Features
- Pastel UI with light + dark mode (shared across landing + shop)
- Menu of coffee & pastries (loaded from the backend)
- Quantity picker, cart drawer, billing form with an optional note to the seller
- Receipt with a friendly message, PHP (₱) pricing + 5% service charge
- Orders saved to `backend/data/orders.json` (local) or `/tmp` on Vercel

## Project layout
```
frontend/   index.html (landing) · shop.html · fullmenu.html
            styles.css · app.js (shop) · landing.js (sign-in) · favicon.svg
backend/     server.js · data/menu.json · data/orders.json (gitignored)
api/         menu.js · orders.js   (Vercel serverless functions)
```

## Run locally
Requires Node.js 18+.
```bash
node backend/server.js
# open http://localhost:8000   (lands on the sign-in page)
```

## Deploy (Vercel)
`vercel.json` sets `outputDirectory: "frontend"`. API routes (`/api/menu`,
`/api/orders`) are served by `api/menu.js` and `api/orders.js` (serverless
functions; orders persist to `/tmp`, which is ephemeral — fine for a demo, since the
UI never reads orders back).

## API
- `GET  /api/menu`   → `{ coffee: [...], pastries: [...] }`
- `POST /api/orders` → `{ items:[{id,qty}], customer:{...}, payment }`
  Returns the saved order with server-computed `subtotal`, `charge`, `total`.
  Prices are re-derived from `menu.json` (the client is never trusted with totals).
