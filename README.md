# Cup O'Aroma ☕

A pastel-themed coffee & pastries web app: a vanilla HTML/CSS/JS frontend with a
zero-dependency Node backend (menu + orders API).

## Features
- Pastel UI with light + dark mode
- Menu of coffee & pastries (loaded from the backend)
- Quantity picker, cart drawer, billing form with an optional note to the seller
- Receipt with a friendly message, PHP (₱) pricing + 5% service charge
- Orders saved to `backend/data/orders.json`

## Project layout
```
frontend/   index.html · styles.css · app.js
backend/     server.js · data/menu.json · data/orders.json (gitignored)
```

## Run locally
Requires Node.js 18+.
```bash
node backend/server.js
# open http://localhost:8000
```

## Deploy to Render (free)
1. Push this repo to GitHub (already done: `laysho/CupOAroma`).
2. Go to https://render.com → **New → Web Service** → connect the repo.
3. Settings:
   - **Environment:** Node
   - **Build Command:** *(leave blank — no deps)*
   - **Start Command:** `node backend/server.js`
   - **Instance Type:** Free
4. Click **Create Web Service**. Render auto-detects the `Procfile`.
   The app reads `process.env.PORT`, so no extra config is needed.
5. Once live, Render gives you a URL like `https://cup-o-aroma.onrender.com`.

## Deploy to Vercel
Vercel is serverless, so it uses the API functions in `api/` instead of the
persistent `backend/server.js`. The frontend is served statically from `frontend/`.

1. Push this repo to GitHub.
2. Go to https://vercel.com → **Add New → Project** → import `laysho/CupOAroma`.
3. Framework Preset: **Other**. Build Command: *(none)*. Output Directory: `frontend`.
4. Deploy. Vercel serves the site and runs `api/menu.js` / `api/orders.js` as functions.
5. Note: because Vercel's filesystem is read-only at runtime, orders are
   written to `/tmp` and do not persist across cold starts. For durable
   order history, wire up Vercel KV/Postgres (out of scope here).

## API
- `GET  /api/menu`   → `{ coffee: [...], pastries: [...] }`
- `POST /api/orders` → `{ items:[{id,qty}], customer:{...}, payment }`
  Returns the saved order with server-computed `subtotal`, `charge`, `total`.
  Prices are re-derived from `menu.json` (the client is never trusted with totals).
